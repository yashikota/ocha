mod commands;
mod db;
mod imap;
mod mail;
mod notification;
mod oauth;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // データディレクトリを取得してDBを初期化
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");
            
            db::init(app_data_dir).expect("Failed to initialize database");
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
            commands::save_oauth_config,
            commands::get_oauth_config,
            commands::check_auth_status,
            commands::start_oauth,
            commands::handle_oauth_callback,
            commands::logout,
            commands::refresh_token,
            // Mail
            commands::sync_messages,
            commands::get_messages,
            commands::mark_as_read,
            commands::mark_group_as_read,
            commands::get_unread_counts,
            commands::start_idle_watch,
            commands::stop_idle_watch,
            // Groups
            commands::get_groups,
            commands::get_group,
            commands::create_group,
            commands::update_group,
            commands::delete_group,
            commands::get_group_members,
            commands::add_email_to_group,
            commands::remove_email_from_group,
            // Attachments
            commands::download_attachment,
            commands::open_attachment,
            commands::get_attachments,
            // Settings
            commands::get_settings,
            commands::update_settings,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
