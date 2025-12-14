mod commands;
mod db;
mod imap;
mod mail;
mod notification;
mod oauth;

use log::{info, error};
use tauri::Manager;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, TrayIconBuilder, TrayIconEvent};
use tauri_plugin_autostart::{MacosLauncher, ManagerExt};
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
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
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

            // 自動起動設定を適用
            if let Ok(settings) = db::with_db(|conn| db::models::Settings::get(conn)) {
                if settings.launch_at_login {
                    let _ = app.autolaunch().enable();
                    info!("Autolaunch enabled based on settings");
                } else {
                    let _ = app.autolaunch().disable();
                    info!("Autolaunch disabled based on settings");
                }
            }

            // タスクトレイアイコンを設定
            let show_item = MenuItem::with_id(app, "show", "表示", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "終了", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_item, &quit_item])?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        info!("Quit from tray menu");
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            info!("Tray icon initialized");

            // DevToolsを開く（開発時のみ）
            #[cfg(debug_assertions)]
            if let Some(window) = app.get_webview_window("main") {
                window.open_devtools();
                info!("DevTools opened");
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let minimize_to_tray = db::with_db(|conn| {
                    db::models::Settings::get(conn).map(|s| s.minimize_to_tray)
                }).unwrap_or(true);

                if minimize_to_tray {
                    let _ = window.hide();
                    api.prevent_close();
                }
            }
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
            commands::toggle_message_bookmark,
            commands::get_bookmarked_messages,
            commands::search_messages,
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
            // Tabs
            commands::get_tabs,
            commands::create_tab,
            commands::update_tab,
            commands::delete_tab,
            commands::update_tab_orders,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
