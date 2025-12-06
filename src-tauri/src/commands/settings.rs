use log::info;
use crate::db::{self, models::Settings};

/// 設定を取得
#[tauri::command]
pub fn get_settings() -> Result<Settings, String> {
    db::with_db(|conn| Settings::get(conn))
        .map_err(|e| e.to_string())
}

/// 設定を更新
#[tauri::command]
pub fn update_settings(settings: Settings) -> Result<(), String> {
    db::with_db(|conn| Settings::save(conn, &settings))
        .map_err(|e| e.to_string())
}

/// メッセージとグループをリセット（文字化け修正用）
#[tauri::command]
pub fn reset_messages() -> Result<(), String> {
    info!("Resetting all messages and groups...");
    db::with_db(|conn| {
        // メッセージを削除
        conn.execute("DELETE FROM messages", [])?;
        // 添付ファイルを削除
        conn.execute("DELETE FROM attachments", [])?;
        // グループを削除
        conn.execute("DELETE FROM group_members", [])?;
        conn.execute("DELETE FROM groups", [])?;
        Ok(())
    }).map_err(|e: anyhow::Error| e.to_string())?;
    
    info!("Messages and groups reset successfully");
    Ok(())
}

