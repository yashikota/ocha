use tauri::AppHandle;

use crate::db::{self, models::Attachment};

/// 添付ファイルをダウンロード
#[tauri::command]
pub async fn download_attachment(
    _app: AppHandle,
    attachment_id: i64,
    _save_path: Option<String>,
) -> Result<String, String> {
    let attachment = db::with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, message_id, filename, mime_type, size, local_path FROM attachments WHERE id = ?1"
        ).map_err(anyhow::Error::from)?;
        
        let attachment = stmt.query_row(rusqlite::params![attachment_id], |row| {
            Ok(Attachment {
                id: row.get(0)?,
                message_id: row.get(1)?,
                filename: row.get(2)?,
                mime_type: row.get(3)?,
                size: row.get(4)?,
                local_path: row.get(5)?,
            })
        }).map_err(anyhow::Error::from)?;
        
        Ok(attachment)
    }).map_err(|e: anyhow::Error| e.to_string())?;
    
    // 既にダウンロード済みの場合はそのパスを返す
    if let Some(ref local_path) = attachment.local_path {
        if std::path::Path::new(local_path).exists() {
            return Ok(local_path.clone());
        }
    }
    
    // メッセージの本文から添付ファイルデータを取得
    // 注: 実際の実装では、メール本文をパースして添付ファイルを抽出する必要があります
    // ここでは簡略化のため、エラーを返します
    Err("添付ファイルのダウンロードは未実装です".to_string())
}

/// 添付ファイルを開く
#[tauri::command]
pub async fn open_attachment(_app: AppHandle, attachment_id: i64) -> Result<(), String> {
    let attachment = db::with_db(|conn| {
        let mut stmt = conn.prepare(
            "SELECT id, message_id, filename, mime_type, size, local_path FROM attachments WHERE id = ?1"
        ).map_err(anyhow::Error::from)?;
        
        let attachment = stmt.query_row(rusqlite::params![attachment_id], |row| {
            Ok(Attachment {
                id: row.get(0)?,
                message_id: row.get(1)?,
                filename: row.get(2)?,
                mime_type: row.get(3)?,
                size: row.get(4)?,
                local_path: row.get(5)?,
            })
        }).map_err(anyhow::Error::from)?;
        
        Ok(attachment)
    }).map_err(|e: anyhow::Error| e.to_string())?;
    
    // 既にダウンロード済みの場合はそのファイルを開く
    if let Some(ref local_path) = attachment.local_path {
        if std::path::Path::new(local_path).exists() {
            open::that(local_path).map_err(|e| e.to_string())?;
            return Ok(());
        }
    }
    
    Err("添付ファイルが見つかりません".to_string())
}

/// 添付ファイル一覧を取得
#[tauri::command]
pub fn get_attachments(message_id: i64) -> Result<Vec<Attachment>, String> {
    db::with_db(|conn| Attachment::list_by_message(conn, message_id))
        .map_err(|e| e.to_string())
}

