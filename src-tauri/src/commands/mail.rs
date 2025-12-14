use chrono::Utc;
use log::{info, debug, error};
use tauri::{AppHandle, Emitter};

use crate::db::{self, models::{Account, Attachment, Group, Message, NewMessage, OAuthConfig}};
use crate::imap::{self, RawMessage};
use crate::mail::parse_email;
use crate::notification;
use crate::oauth;

/// トークンが期限切れかチェックし、必要なら更新して有効なアクセストークンを返す
async fn get_valid_access_token() -> Result<(String, String), String> {
    let account = db::with_db(|conn| Account::get(conn))
        .map_err(|e| e.to_string())?
        .ok_or("Not authenticated")?;

    let access_token = account.access_token
        .as_ref()
        .ok_or("No access token")?
        .clone();

    // トークンの有効期限をチェック
    let needs_refresh = if let Some(expires_at) = &account.token_expires_at {
        if let Ok(expires) = chrono::DateTime::parse_from_rfc3339(expires_at) {
            // 5分のバッファを設けて早めにリフレッシュ
            expires.with_timezone(&Utc) < Utc::now() + chrono::Duration::minutes(5)
        } else {
            true
        }
    } else {
        true
    };

    if needs_refresh {
        info!("Access token expired or expiring soon, refreshing...");

        let config = db::with_db(|conn| OAuthConfig::get(conn))
            .map_err(|e| e.to_string())?
            .ok_or("OAuth config not found")?;

        let refresh_token = account.refresh_token
            .as_ref()
            .ok_or("No refresh token")?;

        let token_result = oauth::refresh_access_token(&config, refresh_token)
            .await
            .map_err(|e| format!("Token refresh failed: {}", e))?;

        // 更新されたトークンを保存
        db::with_db(|conn| {
            Account::save(
                conn,
                &account.email,
                &token_result.access_token,
                &token_result.refresh_token,
                &token_result.expires_at,
            )
        }).map_err(|e| e.to_string())?;

        info!("Token refreshed successfully");
        Ok((token_result.access_token, account.email))
    } else {
        Ok((access_token, account.email))
    }
}

/// メールを同期（すべてのメールフォルダから）
#[tauri::command]
pub async fn sync_messages(app: AppHandle) -> Result<Vec<Message>, String> {
    let (access_token, my_email) = get_valid_access_token().await?;

    info!("Starting mail sync for {}", my_email);

    // 「すべてのメール」フォルダを検索
    let all_mail_folder = find_folder(&my_email, &access_token, "All").await
        .unwrap_or_else(|| "INBOX".to_string());

    info!("Using folder: {}", all_mail_folder);

    // すべてのメールを同期
    let (all_messages, is_initial_sync) = sync_folder(&my_email, &access_token, &all_mail_folder).await?;

    // メールを保存
    let all_saved = save_messages(&all_messages, &my_email, &all_mail_folder)?;

    info!("Synced {} messages total", all_saved.len());

    // 新着通知（初回同期は除く）
    let new_count = all_saved.iter().filter(|m| !m.is_sent).count();
    if new_count > 0 && !is_initial_sync {
        let settings = db::with_db(|conn| crate::db::models::Settings::get(conn))
            .map_err(|e| e.to_string())?;

        if settings.notifications_enabled {
            if new_count == 1 {
                if let Some(msg) = all_saved.iter().find(|m| !m.is_sent) {
                    let from_name = msg.from_name.as_deref().unwrap_or(&msg.from_email);
                    let subject = msg.subject.as_deref().unwrap_or("(件名なし)");
                    let group_id = msg.group_id.unwrap_or(0); // group_id should exist
                    let _ = notification::notify_new_mail(&app, from_name, subject, group_id);
                }
            } else {
                let _ = notification::notify_new_mails(&app, new_count);
            }
        }
    }

    // フロントエンドに通知
    if !all_saved.is_empty() {
        let _ = app.emit("new-messages", all_saved.len());
    }

    Ok(all_saved)
}

/// フォルダを属性で検索
async fn find_folder(email: &str, access_token: &str, attr: &str) -> Option<String> {
    let email = email.to_string();
    let access_token = access_token.to_string();
    let attr = attr.to_string();

    tokio::task::spawn_blocking(move || {
        let mut session = imap::connect(&email, &access_token).ok()?;
        imap::find_folder_by_attr(&mut session, &attr)
    })
    .await
    .ok()
    .flatten()
}

/// 特定のフォルダからメールを同期
async fn sync_folder(email: &str, access_token: &str, folder: &str) -> Result<(Vec<RawMessage>, bool), String> {
    let last_uid = db::with_db(|conn| Message::get_latest_uid(conn, folder))
        .map_err(|e| e.to_string())? as u32;
    let is_initial = last_uid == 0;

    let folder_name = folder.to_string();
    debug!("Syncing folder {} from UID {}", folder_name, last_uid);

    let email = email.to_string();
    let access_token = access_token.to_string();
    let folder_clone = folder_name.clone();

    let raw_messages = tokio::task::spawn_blocking(move || {
        let mut session = imap::connect(&email, &access_token)?;
        session.select(&folder_clone).map_err(|e| anyhow::anyhow!("Failed to select folder {}: {}", folder_clone, e))?;
        imap::fetch_messages_since_uid(&mut session, last_uid)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e: anyhow::Error| e.to_string())?;

    debug!("Fetched {} messages from {}", raw_messages.len(), folder_name);

    Ok((raw_messages, is_initial))
}

/// 生メールを保存（送信/受信はFromアドレスで判別）
fn save_messages(raw_messages: &[RawMessage], my_email: &str, folder: &str) -> Result<Vec<Message>, String> {
    let mut saved = Vec::new();
    let my_email_lower = my_email.to_lowercase();

    for raw in raw_messages {
        let parsed = match parse_email(raw) {
            Ok(p) => p,
            Err(e) => {
                error!("Failed to parse email: {}", e);
                continue;
            }
        };

        // 重複チェック
        if let Some(ref message_id) = parsed.message_id {
            let exists = db::with_db(|conn| Message::exists_by_message_id(conn, message_id))
                .map_err(|e| e.to_string())?;
            if exists {
                continue;
            }
        }

        // 送信/受信を判別（Fromが自分なら送信）
        let is_sent = parsed.from_email.to_lowercase() == my_email_lower;

        // グループを決定
        let (contact_email, contact_name) = if is_sent {
            (parsed.to_email.clone().unwrap_or_default(), parsed.to_name.clone())
        } else {
            (parsed.from_email.clone(), parsed.from_name.clone())
        };

        // 自分宛て/自分からのメールはスキップ
        if contact_email.is_empty() || contact_email.to_lowercase() == my_email_lower {
            debug!("Skipping self-addressed email");
            continue;
        }

        let group_id = db::with_db(|conn| {
            if let Some(group) = Group::find_by_email(conn, &contact_email)? {
                Ok(group.id)
            } else {
                Group::create_for_email(conn, &contact_email, contact_name.as_deref())
            }
        }).map_err(|e: anyhow::Error| e.to_string())?;

        let new_message = NewMessage {
            uid: parsed.uid as i64,
            message_id: parsed.message_id.clone(),
            group_id: Some(group_id),
            from_email: parsed.from_email.clone(),
            from_name: parsed.from_name.clone(),
            to_email: parsed.to_email.clone(),
            subject: parsed.subject.clone(),
            body_text: parsed.body_text.clone(),
            body_html: parsed.body_html.clone(),
            received_at: parsed.received_at.clone(),
            is_sent,
            folder: folder.to_string(),
        };

        let message_id = db::with_db(|conn| Message::insert(conn, &new_message))
            .map_err(|e| e.to_string())?;

        for attachment in &parsed.attachments {
            db::with_db(|conn| {
                Attachment::insert(
                    conn,
                    message_id,
                    &attachment.filename,
                    Some(&attachment.mime_type),
                    attachment.size as i64,
                )
            }).map_err(|e| e.to_string())?;
        }

        let messages = db::with_db(|conn| Message::list_by_group(conn, group_id))
            .map_err(|e| e.to_string())?;

        if let Some(msg) = messages.into_iter().find(|m| m.id == message_id) {
            saved.push(msg);
        }
    }

    Ok(saved)
}

#[tauri::command]
pub fn get_messages(group_id: i64) -> Result<Vec<Message>, String> {
    db::with_db(|conn| Message::list_by_group(conn, group_id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn mark_as_read(message_id: i64) -> Result<(), String> {
    db::with_db(|conn| Message::mark_as_read(conn, message_id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn mark_group_as_read(group_id: i64) -> Result<(), String> {
    db::with_db(|conn| Message::mark_group_as_read(conn, group_id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_unread_counts() -> Result<Vec<(i64, i64)>, String> {
    db::with_db(|conn| Message::get_unread_counts(conn))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn toggle_message_bookmark(message_id: i64) -> Result<bool, String> {
    db::with_db(|conn| Message::toggle_bookmark(conn, message_id))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_bookmarked_messages() -> Result<Vec<Message>, String> {
    db::with_db(|conn| Message::list_bookmarks(conn))
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn start_idle_watch(app: AppHandle) -> Result<(), String> {
    let (access_token, email) = get_valid_access_token().await?;

    // すべてのメールフォルダを使用
    let all_mail_folder = find_folder(&email, &access_token, "All").await
        .unwrap_or_else(|| "INBOX".to_string());

    let last_uid = db::with_db(|conn| Message::get_latest_uid(conn, &all_mail_folder))
        .map_err(|e| e.to_string())? as u32;

    let my_email = email.clone();
    let app_clone = app.clone();
    let folder = all_mail_folder.clone();

    // トークンプロバイダー（クロージャ）
    let token_provider = move || -> Result<String, anyhow::Error> {
        // 非同期関数を同期的に実行
        tauri::async_runtime::block_on(async {
            get_valid_access_token().await
                .map(|(token, _)| token)
                .map_err(|e| anyhow::anyhow!(e))
        })
    };

    imap::start_idle_watch(
        email,
        token_provider,
        last_uid,
        move |raw_messages| {
            if let Ok(saved) = save_messages(&raw_messages, &my_email, &folder) {
                if !saved.is_empty() {
                    let settings = db::with_db(|conn| crate::db::models::Settings::get(conn));
                    if let Ok(settings) = settings {
                        if settings.notifications_enabled {
                            let new_count = saved.iter().filter(|m| !m.is_sent).count();
                            if new_count == 1 {
                                if let Some(msg) = saved.iter().find(|m| !m.is_sent) {
                                    let from_name = msg.from_name.as_deref().unwrap_or(&msg.from_email);
                                    let subject = msg.subject.as_deref().unwrap_or("(件名なし)");
                                    let group_id = msg.group_id.unwrap_or(0);
                                    let _ = notification::notify_new_mail(&app_clone, from_name, subject, group_id);
                                }
                            } else if new_count > 1 {
                                let _ = notification::notify_new_mails(&app_clone, new_count);
                            }
                        }
                    }
                    let _ = app_clone.emit("new-messages", saved.len());
                }
            }
        },
    ).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn stop_idle_watch() -> Result<(), String> {
    imap::stop_idle_watch();
    Ok(())
}
