mod commands;
mod db;
mod imap;
mod mail;
mod notification;
mod oauth;

use log::{info, error};
use tauri::Manager;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri_plugin_log::{Target, TargetKind};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                .targets([
                    Target::new(TargetKind::Stdout),
                    Target::new(TargetKind::LogDir { file_name: None }),
                    Target::new(TargetKind::Webview),
                ])
                .level(log::LevelFilter::Debug)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            info!("ocha starting up...");

            // データディレクトリを取得してDBを初期化
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to get app data directory");

            info!("App data dir: {:?}", app_data_dir);

            if let Err(e) = db::init(app_data_dir) {
                error!("Failed to initialize database: {}", e);
                return Err(e.into());
            }

            info!("Database initialized successfully");

            // タスクトレイアイコンを設定
            let quit_item = MenuItem::with_id(app, "quit", "終了", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        info!("Quit from tray menu");
                        app.exit(0);
                    }
                    _ => {}
                })
                .build(app)?;

            info!("Tray icon initialized");

            // DevToolsを開く（デバッグ用）
            if let Some(window) = app.get_webview_window("main") {
                window.open_devtools();
                info!("DevTools opened");
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth
            commands::save_oauth_config,
            commands::get_oauth_config,
            commands::check_auth_status,
            commands::start_oauth,
            commands::perform_oauth,
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
            commands::merge_groups,
            commands::split_group,
            // Attachments
            commands::download_attachment,
            commands::open_attachment,
            commands::get_attachments,
            // Settings
            commands::get_settings,
            commands::update_settings,
            commands::reset_messages,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
