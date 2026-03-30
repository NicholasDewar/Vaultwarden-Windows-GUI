#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::env;

use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;

mod commands;

fn main() {
    let args: Vec<String> = env::args().collect();
    
    if args.contains(&"--backup".to_string()) {
        match commands::backup::backup_database(None) {
            Ok(info) => {
                println!("Backup completed: {}", info.path);
                if let Ok(deleted) = commands::backup::cleanup_old_backups(None, 7) {
                    if deleted > 0 {
                        println!("Cleaned up {} old backups", deleted);
                    }
                }
            }
            Err(e) => {
                eprintln!("Backup failed: {}", e);
            }
        }
        return;
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .setup(|app| {
            let is_hidden = commands::autostart::is_hidden_startup();

            if is_hidden {
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_secs(2));
                    if let Some(window) = handle.get_webview_window("main") {
                        let _ = window.emit("auto-start-vaultwarden", ());
                    }
                });
            } else {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.show();
                }
            }
            commands::background::BackgroundTasks::new(app.handle().clone()).start();

            let quit = MenuItem::with_id(app, "quit", "退出", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "显示主窗口", true, None::<&str>)?;
            let start = MenuItem::with_id(app, "start", "启动 Vaultwarden", true, None::<&str>)?;
            let stop = MenuItem::with_id(app, "stop", "停止 Vaultwarden", true, None::<&str>)?;
            let check_update = MenuItem::with_id(app, "check_update", "检查更新", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show, &start, &stop, &check_update, &quit])?;

            let _tray = TrayIconBuilder::new()
                .icon(Image::from_path("icons/icon.png").unwrap_or_else(|_| {
                    Image::from_bytes(include_bytes!("../icons/icon.png"))
                        .expect("Failed to load embedded icon")
                }))
                .menu(&menu)
                .tooltip("Vaultwarden Manager")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "quit" => {
                        let _ = commands::process::stop_vaultwarden();
                        app.exit(0);
                    }
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "start" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("tray-start", ());
                        }
                    }
                    "stop" => {
                        let _ = commands::process::stop_vaultwarden();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("status-changed", false);
                        }
                    }
                    "check_update" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("tray-check-update", ());
                        }
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
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

            if let Some(window) = app.get_webview_window("main") {
                let window_clone = window.clone();
                window.on_window_event(move |event| {
                    if let WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = window_clone.hide();
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::github::check_updates,
            commands::github::check_gui_updates,
            commands::github::get_gui_version,
            commands::github::get_releases,
            commands::github::download_binary,
            commands::github::get_latest_binary_version,
            commands::github::get_latest_webvault_version,
            commands::github::download_webvault,
            commands::github::check_webvault,
            commands::github::get_webvault_version,
            commands::github::check_binary_exists,
            commands::github::get_binary_version,
            commands::github::check_binary_update,
            commands::github::download_gui_installer,
            commands::github::install_gui_update,
            commands::github::relaunch_app,
            commands::process::start_vaultwarden,
            commands::process::stop_vaultwarden,
            commands::process::get_status,
            commands::process::validate_environment,
            commands::process::generate_certificates,
            commands::process::check_openssl_available,
            commands::process::check_cert_tools_available,
            commands::process::check_mkcert_available,
            commands::process::is_mkcert_ca_installed,
            commands::process::install_mkcert_ca,
            commands::process::generate_certificates_with_tool,
            commands::config::save_config,
            commands::config::load_config,
            commands::config::get_language,
            commands::config::set_language,
            commands::ip::get_local_ips,
            commands::logs::get_logs,
            commands::logs::add_log,
            commands::backup::get_backup_config,
            commands::backup::save_backup_config,
            commands::backup::backup_database,
            commands::backup::list_backups,
            commands::backup::delete_backup,
            commands::backup::cleanup_old_backups,
            commands::backup::check_database_activity,
            commands::backup::restore_backup,
            commands::backup::check_database_exists,
            commands::backup::get_last_backup_time,
            commands::backup::check_sqlite3_installed,
            commands::backup::download_sqlite3,
            commands::autostart::get_autostart_enabled,
            commands::autostart::set_autostart_enabled,
            commands::autostart::is_hidden_startup,
        ])
        .run(tauri::generate_context!())
        .unwrap_or_else(|e| {
            eprintln!("Fatal error: {}", e);
            std::process::exit(1);
        });
}
