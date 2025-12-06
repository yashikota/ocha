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

