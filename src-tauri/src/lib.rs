use log;
use log::trace;
use serde;
use ssh::SSH;
use ssh_singleton::*;
use std;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_log::fern::colors::ColoredLevelConfig;
use utils::Utils;
use window_vibrancy::*;

mod env;
mod menu;
mod migrations;
mod ssh;
mod ssh_singleton;
mod utils;

#[derive(serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
#[allow(dead_code)]
struct IKeys {
    private_key: String,
    public_key: String,
}

#[tauri::command]
async fn try_ssh_connection(
    host: &str,
    username: String,
    private_key: String,
) -> Result<String, String> {
    log::info!("try_ssh_connection");
    let (host, port) = Utils::extract_host_port(host);
    let ssh_config = ssh::SSHConfig::new(&host, port, username, private_key).unwrap();
    let ssh = SSH::connect(&ssh_config).await.map_err(|e| {
        log::error!("Error connecting to SSH: {:#}", e);
        e.to_string()
    })?;

    ssh.run_command("echo 'test'")
        .await
        .map_err(|e| e.to_string())?;
    replace_ssh_singleton_connection(ssh)
        .await
        .map_err(|e| e.to_string())?;

    Ok("success".to_string())
}

#[tauri::command]
async fn open_ssh_connection(
    host: &str,
    username: String,
    private_key: String,
) -> Result<String, String> {
    log::info!("ensure_ssh_connection");
    let (host, port) = Utils::extract_host_port(host);
    let ssh_config = ssh::SSHConfig::new(&host, port, username, private_key).unwrap();
    test_open_ssh_connection(&ssh_config).await.map_err(|e| {
        log::error!("Error connecting to SSH: {:#}", e);
        e.to_string()
    })?;

    Ok("success".to_string())
}

#[tauri::command]
async fn close_ssh_connection() -> Result<String, String> {
    log::info!("close_ssh_connection");
    close_ssh_singleton_connection()
        .await
        .map_err(|e| e.to_string())?;

    Ok("success".to_string())
}

#[tauri::command]
async fn ssh_run_command(command: String) -> Result<(String, u32), String> {
    let ssh: ssh::SSH = get_ssh_singleton_connection()
        .await
        .map_err(|e| e.to_string())?
        .ok_or("No SSH connection")?;
    let response = ssh.run_command(&command).await.map_err(|e| e.to_string())?;
    Ok(response)
}

#[tauri::command]
async fn ssh_upload_embedded_file(
    app: AppHandle,
    local_path: String,
    remote_path: String,
    event_progress_key: String,
) -> Result<String, String> {
    log::info!("ssh_upload_embedded_file: {}, {}", local_path, remote_path);
    let ssh: ssh::SSH = get_ssh_singleton_connection()
        .await
        .map_err(|e| e.to_string())?
        .ok_or("No SSH connection")?;
    ssh.upload_embedded_file(&app, &local_path, &remote_path, event_progress_key)
        .await
        .map_err(|e| e.to_string())?;
    Ok("success".to_string())
}

#[tauri::command]
async fn ssh_upload_file(contents: String, remote_path: String) -> Result<String, String> {
    log::info!("ssh_upload_file: {}, {}", contents, remote_path);
    let ssh: ssh::SSH = get_ssh_singleton_connection()
        .await
        .map_err(|e| e.to_string())?
        .ok_or("No SSH connection")?;
    ssh.upload_file(&contents.as_bytes(), &remote_path)
        .await
        .map_err(|e| e.to_string())?;
    Ok("success".to_string())
}

#[tauri::command]
async fn get_ssh_keys() -> Result<IKeys, String> {
    log::info!("get_ssh_keys");
    let (private_key, public_key) = SSH::generate_keys().inspect_err(|e| {
        log::error!("Error generating ssh_keys {}", e);
    })?;

    Ok(IKeys {
        private_key,
        public_key,
    })
}

#[tauri::command]
async fn read_embedded_file(app: AppHandle, path: String) -> Result<String, String> {
    log::info!("read_embedded_file: {}", path);
    let embedded_path = Utils::get_embedded_path(&app, path.clone())
        .map_err(|e| format!("Error resolving embedded path: {}", e))?;

    if !embedded_path.exists() {
        return Err(format!("File does not exist: {}", path).to_string());
    }

    let content = fs::read_to_string(&embedded_path)
        .map_err(|e| format!("Error reading file {}: {}", path, e))?;
    Ok(content)
}

////////////////////////////////////////////////////////////

fn init_logger(network_name: &String, instance_name: &String) -> tauri_plugin_log::Builder {
    let mut logger = tauri_plugin_log::Builder::new()
        .clear_targets()
        .target(tauri_plugin_log::Target::new(
            tauri_plugin_log::TargetKind::LogDir {
                file_name: Some(format!("{}-{}", network_name, instance_name)),
            },
        ))
        .target(tauri_plugin_log::Target::new(
            tauri_plugin_log::TargetKind::Stdout,
        ))
        .max_file_size(10_000_000)
        .with_colors(ColoredLevelConfig::default());

    let rust_log =
        std::env::var("RUST_LOG").unwrap_or("debug, tauri=debug, hyper=info, russh=error".into());

    for part in rust_log.split(',') {
        if let Some((target, level)) = part.split_once('=') {
            if let Ok(level) = level.parse::<log::LevelFilter>() {
                logger = logger.level_for(target.trim().to_owned(), level);
            }
        } else if let Ok(level) = part.parse::<log::LevelFilter>() {
            logger = logger.level(level);
        }
    }

    logger
}

fn init_config_instance_dir(
    app: &AppHandle,
    relative_config_dir: &PathBuf,
) -> Result<(), tauri::Error> {
    let config_instance_dir = app
        .path()
        .resolve(relative_config_dir, tauri::path::BaseDirectory::AppConfig)?;
    if !config_instance_dir.exists() {
        trace!(
            "Creating config directory at: {}",
            config_instance_dir.to_string_lossy()
        );
        std::fs::create_dir_all(&config_instance_dir).expect("Failed to create config directory");
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env::load_env_vars();

    color_backtrace::install();

    let network_name = Utils::get_network_name();
    let instance_name = Utils::get_instance_name();
    let logger = init_logger(&network_name, &instance_name);

    let relative_config_dir = Utils::get_relative_config_instance_dir();
    let db_relative_path = relative_config_dir.join("database.sqlite");
    let db_url = format!("sqlite:{}", db_relative_path.display());
    let migrations = migrations::get_migrations();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            log::info!(
                "Starting instance '{}' on network '{}'",
                instance_name,
                network_name
            );
            log::info!("Database URL = {}", db_relative_path.display());

            let window = app.get_webview_window("main").unwrap();
            let handle = app.handle();

            init_config_instance_dir(&handle, &relative_config_dir)?;

            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(16.0))
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

            // Create the application menu
            let menu = menu::create_menu(app)?;
            app.set_menu(menu)?;

            Ok(())
        })
        .on_menu_event(|app, event| {
            menu::handle_menu_event(&app, &event);
        })
        .plugin(tauri_plugin_http::init())
        .plugin(logger.build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(&db_url, migrations)
                .build(),
        )
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            try_ssh_connection,
            open_ssh_connection,
            close_ssh_connection,
            ssh_run_command,
            ssh_upload_embedded_file,
            ssh_upload_file,
            get_ssh_keys,
            read_embedded_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
