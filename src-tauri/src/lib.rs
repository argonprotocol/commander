use log;
use log::trace;
use serde;
use std;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_log::fern::colors::ColoredLevelConfig;
use time::OffsetDateTime;
use utils::Utils;
#[cfg(target_os = "macos")]
use window_vibrancy::*;
use zip::DateTime;

mod migrations;
mod security;
mod ssh;
mod ssh_pool;
mod utils;

#[derive(serde::Serialize, serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
struct ISecurity {
    master_mnemonic: String,
    ssh_public_key: String,
    ssh_private_key: String,
}

#[tauri::command]
async fn open_ssh_connection(
    address: &str,
    host: &str,
    port: u16,
    username: String,
    private_key: String,
) -> Result<String, String> {
    log::info!("ensure_ssh_connection");
    ssh_pool::open_connection(&address, &host, port, username, private_key)
        .await
        .map_err(|e| {
            log::error!("Error connecting to SSH: {:#}", e);
            e.to_string()
        })?;

    Ok("success".to_string())
}

#[tauri::command]
async fn close_ssh_connection(address: &str) -> Result<String, String> {
    log::info!("close_ssh_connection");
    ssh_pool::close_connection(&address)
        .await
        .map_err(|e| e.to_string())?;

    Ok("success".to_string())
}

#[tauri::command]
async fn ssh_run_command(address: &str, command: String) -> Result<(String, u32), String> {
    let ssh: ssh::SSH = ssh_pool::get_connection(&address)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("No SSH connection")?;
    let response = ssh.run_command(&command).await.map_err(|e| e.to_string())?;
    Ok(response)
}

#[tauri::command]
async fn ssh_upload_file(
    address: &str,
    contents: String,
    remote_path: String,
) -> Result<String, String> {
    log::info!("ssh_upload_file: {}, {}", contents, remote_path);
    let ssh: ssh::SSH = ssh_pool::get_connection(&address)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("No SSH connection")?;
    ssh.upload_file(&contents.as_bytes(), &remote_path)
        .await
        .map_err(|e| e.to_string())?;
    Ok("success".to_string())
}

#[tauri::command]
async fn ssh_download_file(
    app: AppHandle,
    address: &str,
    remote_path: String,
    download_path: String,
    event_progress_key: String,
) -> Result<String, String> {
    log::info!("ssh_download_file: {}, {}", remote_path, download_path);
    let ssh: ssh::SSH = ssh_pool::get_connection(&address)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("No SSH connection")?;
    ssh.download_remote_file(&app, &remote_path, &download_path, event_progress_key)
        .await
        .map_err(|e| e.to_string())?;
    Ok("success".to_string())
}

#[tauri::command]
async fn ssh_upload_embedded_file(
    app: AppHandle,
    address: &str,
    local_relative_path: String,
    remote_path: String,
    event_progress_key: String,
) -> Result<String, String> {
    log::info!(
        "ssh_upload_embedded_file: {}, {}",
        local_relative_path,
        remote_path
    );
    let ssh: ssh::SSH = ssh_pool::get_connection(&address)
        .await
        .map_err(|e| e.to_string())?
        .ok_or("No SSH connection")?;
    ssh.upload_embedded_file(&app, &local_relative_path, &remote_path, event_progress_key)
        .await
        .map_err(|e| e.to_string())?;
    Ok("success".to_string())
}

#[tauri::command]
async fn read_embedded_file(app: AppHandle, local_relative_path: String) -> Result<String, String> {
    log::info!("read_embedded_file: {}", local_relative_path);
    let absolute_local_path = Utils::get_embedded_path(&app, local_relative_path.clone())
        .map_err(|e| format!("Error resolving embedded path: {}", e))?;

    if !absolute_local_path.exists() {
        return Err(format!("File does not exist: {}", local_relative_path).to_string());
    }

    let content = fs::read_to_string(&absolute_local_path)
        .map_err(|e| format!("Error reading file {}: {}", local_relative_path, e))?;
    Ok(content)
}

#[tauri::command]
async fn fetch_security(app: AppHandle) -> Result<ISecurity, String> {
    log::info!("fetch_security");
    let security = security::Security::load(&app).map_err(|e| e.to_string())?;

    Ok(ISecurity {
        master_mnemonic: security.master_mnemonic,
        ssh_public_key: security.ssh_public_key,
        ssh_private_key: security.ssh_private_key,
    })
}

#[tauri::command]
async fn overwrite_security(
    app: AppHandle,
    master_mnemonic: String,
    ssh_public_key: String,
    ssh_private_key: String,
) -> Result<String, String> {
    log::info!("overwrite_security");
    let new_security = security::Security {
        master_mnemonic: master_mnemonic,
        ssh_public_key: ssh_public_key,
        ssh_private_key: ssh_private_key,
    };
    new_security.save(&app).map_err(|e| e.to_string())?;

    Ok("success".to_string())
}

#[tauri::command]
async fn overwrite_mnemonic(app: AppHandle, mnemonic: String) -> Result<String, String> {
    log::info!("overwrite_mnemonic");
    let mut security = security::Security::load(&app).map_err(|e| e.to_string())?;
    security.master_mnemonic = mnemonic;
    security.save(&app).map_err(|e| e.to_string())?;
    Ok("success".to_string())
}
#[tauri::command]
async fn run_db_migrations(app: AppHandle) -> Result<(), String> {
    log::info!("run_db_migrations");
    let absolute_db_path = Utils::get_absolute_config_instance_dir(&app).join("database.sqlite");
    migrations::run_db_migrations(absolute_db_path)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
async fn create_zip(
    paths_with_prefixes: Vec<(PathBuf, PathBuf)>,
    zip_name: PathBuf,
) -> Result<PathBuf, String> {
    let file = fs::File::create(&zip_name).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let opts = zip::write::SimpleFileOptions::default();

    for (prefix, p) in paths_with_prefixes {
        // Walk children and prefix entries with the root directory name
        for entry in walkdir::WalkDir::new(&p).into_iter().flatten() {
            if entry.file_type().is_dir() {
                continue;
            }
            let path = entry.path();
            let rel = if p.is_file() {
                // If the path is a file, we need to strip the parent directory
                path.strip_prefix(p.parent().unwrap_or(&PathBuf::from("")))
            } else {
                path.strip_prefix(&p)
            }
            .unwrap_or(path);

            println!(
                "Processing entry: {} {}",
                rel.display(),
                path.to_string_lossy()
            );

            // Skip the directory itself; it"s already added
            if rel.as_os_str().is_empty() {
                continue;
            }

            let name = prefix.join(rel).to_string_lossy().replace("\\", "/");
            let mut file_opts = opts.clone();
            if let Ok(mtime) = entry.metadata().map_err(|e| e.to_string())?.modified() {
                if let Ok(zdt) = DateTime::try_from(OffsetDateTime::from(mtime)) {
                    file_opts = file_opts.last_modified_time(zdt);
                }
            }
            zip.start_file(name, file_opts).map_err(|e| e.to_string())?;
            let mut f = fs::File::open(path).map_err(|e| e.to_string())?;
            std::io::copy(&mut f, &mut zip).map_err(|e| e.to_string())?;
        }
    }

    zip.finish().map_err(|e| e.to_string())?;
    Ok(zip_name)
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

    // load rust log from runtime env, then build, then default
    let rust_log = std::env::var("RUST_LOG").unwrap_or(
        std::option_env!("RUST_LOG")
            .unwrap_or("info, russh=error, hyper=info, hyper_util=info")
            .to_string(),
    );

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
    color_backtrace::install();

    let network_name = Utils::get_network_name();
    let instance_name = Utils::get_instance_name();
    let enable_auto_update =
        option_env!("COMMANDER_ENABLE_AUTOUPDATE").map_or(true, |v| v == "true");
    let logger = init_logger(&network_name, &instance_name);

    let relative_config_dir = Utils::get_relative_config_instance_dir();
    let db_relative_path = relative_config_dir.join("database.sqlite");
    let db_url = format!("sqlite:{}", db_relative_path.display()).replace("\\", "/");
    let migrations = migrations::get_migrations();

    let network_name_clone = network_name.clone();
    let instance_name_clone = instance_name.clone();

    tauri::Builder::default()
        .on_page_load(move |app, _| {
            log::info!("Page loaded for instance '{}'", instance_name_clone);
            let window = app.get_webview_window("main").unwrap();
            window.eval(format!("window.__COMMANDER_INSTANCE__ = '{}'", instance_name_clone)).expect("Failed to set instance name in window");
            window.eval(format!("window.__ARGON_NETWORK_NAME__ = '{}'", network_name_clone)).expect("Failed to set network name in window");
            window.eval(format!("window.__COMMANDER_ENABLE_AUTOUPDATE__ = {}", enable_auto_update)).expect("Failed to set experimental flag in window");
        })
        .setup(move |app| {
            log::info!(
                "Starting instance '{}' on network '{}'",
                instance_name,
                network_name
            );
            log::info!("Database URL = {}", db_relative_path.display());

            let app_id = &app.config().identifier;

            if app_id.to_lowercase().contains("experimental") {
              if option_env!("ARGON_EXPERIMENTAL").is_none()  {
                panic!("Experimental app built without the ARGON_EXPERIMENTAL environment variable set. Please set it to 'true' to enable experimental features.");
              }
            }

            let window = app.get_webview_window("main").unwrap();

            let handle = app.handle();

            init_config_instance_dir(&handle, &relative_config_dir)?;

            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(16.0))
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

            Ok(())
        })
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
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
            open_ssh_connection,
            close_ssh_connection,
            ssh_run_command,
            ssh_upload_file,
            ssh_download_file,
            ssh_upload_embedded_file,
            read_embedded_file,
            fetch_security,
            overwrite_security,
            overwrite_mnemonic,
            run_db_migrations,
            create_zip,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
