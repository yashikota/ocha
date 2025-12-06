use tauri::{AppHandle, Emitter};

use crate::db::{self, models::{Account, Attachment, Group, Message, NewMessage}};
use crate::imap::{self, RawMessage};
use crate::mail::parse_email;
use crate::notification;

/// メールを同期
#[tauri::command]
pub async fn sync_messages(app: AppHandle) -> Result<Vec<Message>, String> {
    let account = db::with_db(|conn| Account::get(conn))
        .map_err(|e| e.to_string())?
        .ok_or("Not authenticated")?;
    
    let access_token = account.access_token
        .as_ref()
        .ok_or("No access token")?
        .clone();
    
    let email = account.email.clone();
    
    // 最新UIDを取得
    let last_uid = db::with_db(|conn| Message::get_latest_uid(conn))
        .map_err(|e| e.to_string())? as u32;
    
    // バックグラウンドスレッドでIMAPに接続
    let raw_messages = tokio::task::spawn_blocking(move || {
        let mut session = imap::connect(&email, &access_token)?;
        imap::select_inbox(&mut session)?;
        imap::fetch_messages_since_uid(&mut session, last_uid)
    })
    .await
    .map_err(|e| e.to_string())?
    .map_err(|e: anyhow::Error| e.to_string())?;
    
    // メールを保存
    let saved_messages = save_messages(&raw_messages)?;
    
    // 新着通知
    if !saved_messages.is_empty() {
        let settings = db::with_db(|conn| crate::db::models::Settings::get(conn))
            .map_err(|e| e.to_string())?;
        
        if settings.notifications_enabled {
            if saved_messages.len() == 1 {
                let msg = &saved_messages[0];
                let from_name = msg.from_name.as_deref().unwrap_or(&msg.from_email);
                let subject = msg.subject.as_deref().unwrap_or("(件名なし)");
                let _ = notification::notify_new_mail(&app, from_name, subject);
            } else {
                let _ = notification::notify_new_mails(&app, saved_messages.len());
            }
        }
        
        // フロントエンドに通知
        let _ = app.emit("new-messages", saved_messages.len());
    }
    
    Ok(saved_messages)
}

/// 生メールを保存
fn save_messages(raw_messages: &[RawMessage]) -> Result<Vec<Message>, String> {
    let mut saved = Vec::new();
    
    for raw in raw_messages {
        // メールをパース
        let parsed = parse_email(raw)
            .map_err(|e| format!("Failed to parse email: {}", e))?;
        
        // 重複チェック
        if let Some(ref message_id) = parsed.message_id {
            let exists = db::with_db(|conn| Message::exists_by_message_id(conn, message_id))
                .map_err(|e| e.to_string())?;
            if exists {
                continue;
            }
        }
        
        // グループを検索または作成
        let group_id = db::with_db(|conn| {
            if let Some(group) = Group::find_by_email(conn, &parsed.from_email)? {
                Ok(group.id)
            } else {
                Group::create_for_email(conn, &parsed.from_email, parsed.from_name.as_deref())
            }
        }).map_err(|e: anyhow::Error| e.to_string())?;
        
        // メッセージを保存
        let new_message = NewMessage {
            uid: parsed.uid as i64,
            message_id: parsed.message_id.clone(),
            group_id: Some(group_id),
            from_email: parsed.from_email.clone(),
            from_name: parsed.from_name.clone(),
            subject: parsed.subject.clone(),
            body_text: parsed.body_text.clone(),
            body_html: parsed.body_html.clone(),
            received_at: parsed.received_at.clone(),
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
    
    let last_uid = db::with_db(|conn| Message::get_latest_uid(conn))
        .map_err(|e| e.to_string())? as u32;
    
    let app_clone = app.clone();
    
    imap::start_idle_watch(
        account.email.clone(),
        access_token,
        last_uid,
        move |raw_messages| {
            // 新着メールを処理
            if let Ok(saved) = save_messages(&raw_messages) {
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
