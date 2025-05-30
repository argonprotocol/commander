use stats::{Stats, IStats};
use config::{
    Config, ConfigFile, Security, ServerDetails, BiddingRules, 
    InstallStatus, InstallStatusClient, InstallStatusServer,
};
use log::{info, LevelFilter};
use installer::Installer;
use std::env;
use std::path::PathBuf;
use tauri::menu::{MenuItemBuilder, SubmenuBuilder};
use tauri::{AppHandle, Manager};
use tauri_plugin_log::fern::colors::ColoredLevelConfig;
use window_vibrancy::*;
use db::DB;
use installer::InstallerStatus;
use utils::Utils;
use ssh::singleton::*;

mod stats;
mod config;
mod db;
mod installer;
mod ssh;
mod utils;

#[derive(serde::Serialize, Debug)]
#[serde(rename_all = "camelCase")]
struct AppStartData {
    version: String,
    requires_password: bool,
    security: Option<Security>,
    server_details: ServerDetails,
    install_status: InstallStatus,
    bidding_rules: Option<BiddingRules>,
    stats: IStats,
}

#[tauri::command]
async fn start(app: AppHandle) -> Result<AppStartData, String> {
    info!("start");

    let config = match Config::load() {
        Ok(config) => config,
        Err(e) => panic!("ConfigFailed: {}", e),
    };

    Installer::install_if_needed(&app, false)
        .await
        .map_err(|e| e.to_string())?;

    let server_details = ServerDetails::load().map_err(|e| e.to_string())?;
    let install_status = InstallStatus::load().map_err(|e| e.to_string())?;
    let stats = Stats::fetch(&app, None).await.map_err(|e| e.to_string())?;

    let record = AppStartData {
        version: Utils::get_version(&app).map_err(|e| e.to_string())?,
        requires_password: config.requires_password,
        security: config.security.clone(),
        server_details: server_details.clone(),
        install_status: install_status.clone(),
        bidding_rules: config.bidding_rules.clone(),
        stats,
    };

    info!("Start Data: {:?}", record);

    Ok(record)
}

#[tauri::command]
async fn save_security(wallet_mnemonic: String, session_mnemonic: String, wallet_json: String) -> Result<(), String> {
    info!("save_security");

    Security::create(wallet_mnemonic, session_mnemonic, wallet_json)
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn add_server(ip_address: String) -> Result<(), String> {
    info!("add_server");

    let mut server_details = ServerDetails::load().map_err(|e| e.to_string())?;

    if server_details.ip_address == ip_address {
        return Ok(());
    }

    server_details.ip_address = ip_address;

    let ssh_config = server_details.ssh_config().map_err(|e| e.to_string())?;
    Installer::test_server_connection(ssh_config).await.map_err(|e| e.to_string())?;

    server_details.is_new_server = true;
    server_details.is_connected = true;
    server_details.save().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn remove_server() -> Result<(), String> {
    info!("remove_server");

    let mut server_details = ServerDetails::load().map_err(|e| e.to_string())?;

    server_details.ip_address = String::from("");
    server_details.is_connected = false;
    server_details.is_installing = false;
    server_details.is_new_server = false;
    server_details.save().map_err(|e| e.to_string())?;

    Installer::shutdown_server().await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn fetch_install_status(install_status_client: InstallStatusClient) -> Result<InstallStatusServer, String> {
    info!("fetch_install_status");

    let mut install_status = InstallStatus::load().map_err(|e| e.to_string())?;
    
    install_status.client = install_status_client;
    install_status.save().map_err(|e| e.to_string())?;

    let server_details = ServerDetails::load().map_err(|e| e.to_string())?;
    let ssh_config = server_details.ssh_config().map_err(|e| e.to_string())?;
    let ssh = get_ssh_connection(ssh_config).await.map_err(|e| e.to_string())?;
    let install_status_server = InstallerStatus::fetch(&ssh).await.map_err(|e| e.to_string())?;

    Ok(install_status_server)
}

#[tauri::command]
async fn fetch_stats(app: AppHandle, cohort_id: u32) -> Result<(), String> {
    info!("fetch_stats");

    Stats::fetch(&app, Some(cohort_id)).await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn retry_failed_step(app: AppHandle, step_key: String) -> Result<(), String> {
    info!("retry_failed_step");

    Installer::retry_failed_step(&app, step_key)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn update_bidding_rules(bidding_rules: BiddingRules) -> Result<(), String> {
    info!("update_bidding_rules");

    bidding_rules.save().map_err(|e| e.to_string())?;

    Installer::update_bidding_bot(true)
        .await
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn upgrade_server(app: AppHandle) -> Result<(), String> {
    info!("upgrade_server");
    let server_details = ServerDetails::load().map_err(|e| e.to_string())?;

    if !server_details.is_connected {
        return Err("Server not connected".to_string());
    }

    if server_details.is_installing {
        return Err("Server is installing".to_string());
    }

    Installer::install_if_needed(&app, true).await.map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn launch_mining_bot() -> Result<(), String> {
    info!("launch_mining_bot");

    let mut server_details = ServerDetails::load().map_err(|e| e.to_string())?;

    if !server_details.is_connected {
        return Err("Server not connected".to_string());
    }

    if server_details.is_installing {
        return Err("Server is installing".to_string());
    }

    Installer::update_bidding_bot(true)
        .await
        .map_err(|e| e.to_string())?;

    if !server_details.is_ready_for_mining {
        server_details.is_ready_for_mining = true;
        server_details.save().map_err(|e| e.to_string())?;
    }

    Ok(())
}

pub fn readdir(path: &PathBuf) -> anyhow::Result<Vec<String>> {
    let dir = std::fs::read_dir(&path)?;
    let files = dir
        .filter_map(|entry| entry.ok())
        .filter(|entry| entry.path().is_file())
        .map(|entry| entry.file_name().to_string_lossy().into_owned())
        .collect::<Vec<_>>();
    Ok(files)
}

////////////////////////////////////////////////////////////

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    dotenv::dotenv().ok();

    let mut log_builder = tauri_plugin_log::Builder::new()
        .target(tauri_plugin_log::Target::new(
            tauri_plugin_log::TargetKind::Folder {
                path: std::path::PathBuf::from(DB::get_db_path())
                    .parent()
                    .unwrap()
                    .into(),
                file_name: None,
            },
        ))
        .max_file_size(10_000_000)
        // .target(tauri_plugin_log::Target::new(
        //     tauri_plugin_log::TargetKind::Webview,
        // ))
        .with_colors(ColoredLevelConfig::default());

    // testnet is default if debug or specified
    let mut chain = if cfg!(debug_assertions) || env::args().any(|arg| arg == "--testnet") {
        "testnet"
    } else {
        "mainnet"
    }
    .to_string();
    if let Some(env_chain) = env::var("CHAIN").ok() {
        chain = env_chain;
    }
    // allow for debug mode to hit mainnet
    if env::args().any(|arg| arg == "--mainnet") {
        chain = "mainnet".to_string();
    }
    let is_testnet = &chain == "testnet";
    env::set_var("CHAIN", chain);
    
    if !env::var("MAINCHAIN_URL").is_ok() {
        if is_testnet {
            env::set_var("MAINCHAIN_URL", "wss://rpc.testnet.argonprotocol.org");
        } else {
            env::set_var("MAINCHAIN_URL", "wss://rpc.argon.network");
        }
    }

    let rust_log =
        env::var("RUST_LOG").unwrap_or("debug, tauri=info, hyper=info, russh=error".into());
    for part in rust_log.split(',') {
        if let Some((target, level)) = part.split_once('=') {
            if let Ok(level) = level.parse::<LevelFilter>() {
                log_builder = log_builder.level_for(target.trim().to_owned(), level);
            }
        } else if let Ok(level) = part.parse::<LevelFilter>() {
            log_builder = log_builder.level(level);
        }
    }

    tauri::Builder::default()
        .plugin(log_builder.build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            if cfg!(debug_assertions) {
                let push_latest = MenuItemBuilder::new("Push Latest")
                    .id("push_latest")
                    .build(app)?;

                let docker_submenu = SubmenuBuilder::new(app, "Docker")
                    .item(&push_latest)
                    .build()?;
                let menu = app.menu().unwrap();
                menu.append(&docker_submenu)?;

                app.on_menu_event(move |app, event| {
                    if event.id() == "push_latest" {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Err(e) = upgrade_server(app_handle).await {
                                log::error!("Error updating server code: {}", e);
                            }
                        });
                    }
                });
            }

            let window = app.get_webview_window("main").unwrap();

            DB::init().map_err(|e| e.to_string())?;

            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(16.0))
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            start,
            save_security,
            add_server,
            remove_server,
            fetch_install_status,
            update_bidding_rules,
            retry_failed_step,
            launch_mining_bot,
            upgrade_server,
            fetch_stats,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
