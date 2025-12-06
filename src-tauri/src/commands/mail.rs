use log::{info, debug, error, warn};
use tauri::{AppHandle, Emitter};

use crate::db::{self, models::{Account, Attachment, Group, Message, NewMessage}};
use crate::imap::{self, RawMessage};
use crate::mail::parse_email;
use crate::notification;

const FOLDER_INBOX: &str = "INBOX";

/// メールを同期（受信・送信両方）
#[tauri::command]
pub async fn sync_messages(app: AppHandle) -> Result<Vec<Message>, String> {
    let account = db::with_db(|conn| Account::get(conn))
        .map_err(|e| e.to_string())?
        .ok_or("Not authenticated")?;

    let access_token = account.access_token
        .as_ref()
        .ok_or("No access token")?
        .clone();

    let my_email = account.email.clone();

    info!("Starting mail sync for {}", my_email);

    // 受信メールを同期
    let inbox_messages = sync_folder(&my_email, &access_token, FOLDER_INBOX, false).await?;

    // 送信メールを同期（フォルダを自動検出）
    let mut sent_messages = Vec::new();
    let sent_folder_found = find_sent_folder_name(&my_email, &access_token).await;

    if let Some(ref folder_name) = sent_folder_found {
        match sync_folder(&my_email, &access_token, folder_name, true).await {
            Ok(messages) => {
                sent_messages = messages;
            }
            Err(e) => {
                warn!("Failed to sync sent folder {}: {}", folder_name, e);
            }
        }
    } else {
        warn!("Could not find sent mail folder, skipping sent mail sync");
    }

    // メールを保存
    let mut all_saved = Vec::new();

    let saved_inbox = save_messages(&inbox_messages, &my_email, false, FOLDER_INBOX)?;
    all_saved.extend(saved_inbox);

    if let Some(ref folder) = sent_folder_found {
        let saved_sent = save_messages(&sent_messages, &my_email, true, folder)?;
        all_saved.extend(saved_sent);
    }

    info!("Synced {} messages total", all_saved.len());

    // 新着通知（受信メールのみ）
    let new_inbox_count = inbox_messages.len();
    if new_inbox_count > 0 {
        let settings = db::with_db(|conn| crate::db::models::Settings::get(conn))
            .map_err(|e| e.to_string())?;

        if settings.notifications_enabled {
            if new_inbox_count == 1 {
                if let Some(msg) = all_saved.iter().find(|m| !m.is_sent) {
                    let from_name = msg.from_name.as_deref().unwrap_or(&msg.from_email);
                    let subject = msg.subject.as_deref().unwrap_or("(件名なし)");
                    let _ = notification::notify_new_mail(&app, from_name, subject);
                }
            } else {
                let _ = notification::notify_new_mails(&app, new_inbox_count);
            }
        }
    }

    // フロントエンドに通知
    if !all_saved.is_empty() {
        let _ = app.emit("new-messages", all_saved.len());
    }

    Ok(all_saved)
}

/// 送信フォルダ名を自動検出
async fn find_sent_folder_name(email: &str, access_token: &str) -> Option<String> {
    let email = email.to_string();
    let access_token = access_token.to_string();

    tokio::task::spawn_blocking(move || {
        let mut session = imap::connect(&email, &access_token).ok()?;
        imap::find_sent_folder(&mut session)
    })
    .await
    .ok()
    .flatten()
}

/// 特定のフォルダからメールを同期
async fn sync_folder(email: &str, access_token: &str, folder: &str, _is_sent: bool) -> Result<Vec<RawMessage>, String> {
    let last_uid = db::with_db(|conn| Message::get_latest_uid(conn, folder))
        .map_err(|e| e.to_string())? as u32;

    let folder_name = folder.to_string();
    debug!("Syncing folder {} from UID {}", folder_name, last_uid);

    let email = email.to_string();
    let access_token = access_token.to_string();
    let folder_clone = folder_name.clone();

    let raw_messages = tokio::task::spawn_blocking(move || {
        let mut session = imap::connect(&email, &access_token)?;

        // フォルダを選択
        session.select(&folder_clone).map_err(|e| anyhow::anyhow!("Failed to select folder {}: {}", folder_clone, e))?;

        // メールを取得
        imap::fetch_messages_since_uid(&mut session, last_uid)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e: anyhow::Error| e.to_string())?;

    debug!("Fetched {} messages from {}", raw_messages.len(), folder_name);

    Ok(raw_messages)
}

/// 生メールを保存
fn save_messages(raw_messages: &[RawMessage], my_email: &str, is_sent: bool, folder: &str) -> Result<Vec<Message>, String> {
    let mut saved = Vec::new();

    for raw in raw_messages {
        // メールをパース
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

        // グループを決定
        // 送信メールの場合はTo、受信メールの場合はFromでグループを検索
        let (contact_email, contact_name) = if is_sent {
            // 送信メール: 宛先でグループを決定
            (parsed.to_email.clone().unwrap_or_default(), parsed.to_name.clone())
        } else {
            // 受信メール: 送信者でグループを決定
            (parsed.from_email.clone(), parsed.from_name.clone())
        };

        // 自分宛ての場合はスキップ（または別処理）
        if contact_email.is_empty() || contact_email.to_lowercase() == my_email.to_lowercase() {
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

        // メッセージを保存
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

        // 添付ファイルを保存
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

        // 保存したメッセージを取得
        let messages = db::with_db(|conn| Message::list_by_group(conn, group_id))
            .map_err(|e| e.to_string())?;

        if let Some(msg) = messages.into_iter().find(|m| m.id == message_id) {
            saved.push(msg);
        }
    }

    Ok(saved)
}

/// グループ内のメッセージを取得
#[tauri::command]
pub fn get_messages(group_id: i64) -> Result<Vec<Message>, String> {
    db::with_db(|conn| Message::list_by_group(conn, group_id))
        .map_err(|e| e.to_string())
}

/// メッセージを既読にする
#[tauri::command]
pub fn mark_as_read(message_id: i64) -> Result<(), String> {
    db::with_db(|conn| Message::mark_as_read(conn, message_id))
        .map_err(|e| e.to_string())
}

/// グループ内のメッセージをすべて既読にする
#[tauri::command]
pub fn mark_group_as_read(group_id: i64) -> Result<(), String> {
    db::with_db(|conn| Message::mark_group_as_read(conn, group_id))
        .map_err(|e| e.to_string())
}

/// 未読数を取得
#[tauri::command]
pub fn get_unread_counts() -> Result<Vec<(i64, i64)>, String> {
    db::with_db(|conn| Message::get_unread_counts(conn))
        .map_err(|e| e.to_string())
}

/// IMAP監視を開始
#[tauri::command]
pub async fn start_idle_watch(app: AppHandle) -> Result<(), String> {
    let account = db::with_db(|conn| Account::get(conn))
        .map_err(|e| e.to_string())?
        .ok_or("Not authenticated")?;

    let access_token = account.access_token
        .clone()
        .ok_or("No access token")?;

    let last_uid = db::with_db(|conn| Message::get_latest_uid(conn, FOLDER_INBOX))
        .map_err(|e| e.to_string())? as u32;

    let my_email = account.email.clone();
    let app_clone = app.clone();

    imap::start_idle_watch(
        account.email.clone(),
        access_token,
        last_uid,
        move |raw_messages| {
            // 新着メールを処理
            if let Ok(saved) = save_messages(&raw_messages, &my_email, false, FOLDER_INBOX) {
                if !saved.is_empty() {
                    // 通知
                    let settings = db::with_db(|conn| crate::db::models::Settings::get(conn));
                    if let Ok(settings) = settings {
                        if settings.notifications_enabled {
                            if saved.len() == 1 {
                                let msg = &saved[0];
                                let from_name = msg.from_name.as_deref().unwrap_or(&msg.from_email);
                                let subject = msg.subject.as_deref().unwrap_or("(件名なし)");
                                let _ = notification::notify_new_mail(&app_clone, from_name, subject);
                            } else {
                                let _ = notification::notify_new_mails(&app_clone, saved.len());
                            }
                        }
                    }

                    // フロントエンドに通知
                    let _ = app_clone.emit("new-messages", saved.len());
                }
            }
        },
    ).map_err(|e| e.to_string())
}

/// IMAP監視を停止
#[tauri::command]
pub fn stop_idle_watch() -> Result<(), String> {
    imap::stop_idle_watch();
    Ok(())
}
