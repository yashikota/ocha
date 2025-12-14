use log::{info, error};
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::db::{self, models::{Account, Attachment, Message}};
use crate::imap;
use crate::mail::extract_attachments_with_data;



/// 添付ファイルをダウンロード
#[tauri::command]
pub async fn download_attachment(
    app: AppHandle,
    attachment_id: i64,
    _save_path: Option<String>,
) -> Result<String, String> {
    info!("Downloading attachment: {}", attachment_id);

    // 添付ファイル情報を取得
    let attachment = db::with_db(|conn| Attachment::get(conn, attachment_id))
        .map_err(|e| e.to_string())?
        .ok_or("Attachment not found")?;

    // 既にダウンロード済みの場合はそのパスを返す
    if let Some(ref local_path) = attachment.local_path {
        if std::path::Path::new(local_path).exists() {
            info!("Attachment already downloaded: {}", local_path);
            return Ok(local_path.clone());
        }
    }

    // メッセージ情報を取得
    let message = db::with_db(|conn| Message::get(conn, attachment.message_id))
        .map_err(|e| e.to_string())?
        .ok_or("Message not found")?;

    // アカウント情報を取得
    let account = db::with_db(|conn| Account::get(conn))
        .map_err(|e| e.to_string())?
        .ok_or("Not authenticated")?;

    let access_token = account.access_token
        .as_ref()
        .ok_or("No access token")?;

    info!("Fetching message {} from IMAP...", message.uid);

    // IMAPに接続してメッセージを取得
    let mut session = imap::connect(&account.email, access_token)
        .map_err(|e| {
            error!("IMAP connection failed: {}", e);
            format!("IMAP connection failed: {}", e)
        })?;

    // フォルダを選択
    let folder = &message.folder;
    session.select(folder)
        .map_err(|e| {
            error!("Failed to select folder {}: {}", folder, e);
            format!("Failed to select folder: {}", e)
        })?;

    // メッセージを取得
    let raw_message = imap::fetch_message_by_uid(&mut session, message.uid as u32)
        .map_err(|e| {
            error!("Failed to fetch message: {}", e);
            format!("Failed to fetch message: {}", e)
        })?
        .ok_or("Message not found on server")?;

    // セッションを閉じる
    let _ = session.logout();

    info!("Parsing attachments from message...");

    // 添付ファイルを抽出
    let attachments = extract_attachments_with_data(&raw_message.body)
        .map_err(|e| format!("Failed to parse attachments: {}", e))?;

    // 対象の添付ファイルを探す
    let target_attachment = attachments.iter()
        .find(|a| a.filename == attachment.filename)
        .ok_or_else(|| format!("Attachment '{}' not found in message", attachment.filename))?;

    let data = target_attachment.data.as_ref()
        .ok_or("Attachment data is empty")?;

    // 設定を取得
    let settings = db::with_db(|conn| db::models::Settings::get(conn))
        .map_err(|e| e.to_string())?;

    let attachments_dir = match settings.download_path.as_str() {
        "custom" => {
            if let Some(path_str) = settings.download_custom_path {
                let path = PathBuf::from(path_str);
                if path.exists() {
                    path
                } else {
                    info!("Custom download path not found, falling back to downloads");
                    app.path()
                        .download_dir()
                        .map_err(|e| format!("Failed to get download directory: {}", e))?
                }
            } else {
                app.path()
                    .download_dir()
                    .map_err(|e| format!("Failed to get download directory: {}", e))?
            }
        },
        _ => {
            app.path()
                .download_dir()
                .map_err(|e| format!("Failed to get download directory: {}", e))?
        },
    };

    let safe_filename = attachment.filename.replace(['/', '\\', ':', '*', '?', '"', '<', '>', '|'], "_");
    // 常に元のファイル名を使用（衝突時は連番付与）
    let mut final_name = safe_filename.clone();
    let mut counter = 1;
    while attachments_dir.join(&final_name).exists() {
        let path = std::path::Path::new(&safe_filename);
        let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("file");
        let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");

        final_name = if ext.is_empty() {
            format!("{} ({})", stem, counter)
        } else {
            format!("{} ({}).{}", stem, counter, ext)
        };
        counter += 1;
    }
    let filename = final_name;

    let local_path = attachments_dir.join(&filename);

    info!("Saving attachment to: {:?}", local_path);

    fs::write(&local_path, data)
        .map_err(|e| format!("Failed to save attachment: {}", e))?;

    // local_pathを更新
    let local_path_str = local_path.to_string_lossy().to_string();
    db::with_db(|conn| Attachment::update_local_path(conn, attachment_id, &local_path_str))
        .map_err(|e| e.to_string())?;

    info!("Attachment downloaded successfully: {}", local_path_str);

    Ok(local_path_str)
}

/// 添付ファイルを開く
#[tauri::command]
pub async fn open_attachment(app: AppHandle, attachment_id: i64) -> Result<(), String> {
    // まずダウンロードを試みる
    let local_path = download_attachment(app, attachment_id, None).await?;

    // ファイルを開く
    info!("Opening attachment: {}", local_path);
    open::that(&local_path)
        .map_err(|e| format!("Failed to open file: {}", e))?;

    Ok(())
}

/// 添付ファイル一覧を取得
#[tauri::command]
pub fn get_attachments(message_id: i64) -> Result<Vec<Attachment>, String> {
    db::with_db(|conn| Attachment::list_by_message(conn, message_id))
        .map_err(|e| e.to_string())
}
