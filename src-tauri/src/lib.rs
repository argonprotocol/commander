use crate::db::{
    ArgonActivities, ArgonActivityRecord, BitcoinActivities, BitcoinActivityRecord, BotActivities,
    BotActivityRecord, DB,
};
use crate::ssh::SSH;
use bidder::stats::{BidderStats, ICohortStats, IGlobalStats};
use bidder::Bidder;
use config::{BiddingRules, Config, Mnemonics, ServerConnection, ServerProgress, ServerStatus};
use log::{info, LevelFilter};
use provisioner::Provisioner;
use std::env;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};
use tauri_plugin_log::fern::colors::ColoredLevelConfig;
use window_vibrancy::*;

mod bidder;
mod config;
mod db;
mod provisioner;
mod ssh;

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct AppConfig {
    requires_password: bool,
    mnemonics: Option<Mnemonics>,
    server_connection: ServerConnection,
    server_status: ServerStatus,
    server_progress: ServerProgress,
    bidding_rules: Option<BiddingRules>,
    argon_activity: Vec<ArgonActivityRecord>,
    bitcoin_activity: Vec<BitcoinActivityRecord>,
    bot_activity: Vec<BotActivityRecord>,
    global_stats: Option<IGlobalStats>,
    cohort_stats: Option<ICohortStats>,
}

#[tauri::command]
async fn start(app: AppHandle) -> Result<AppConfig, String> {
    info!("start");

    let config = match Config::load() {
        Ok(config) => config,
        Err(e) => panic!("ConfigFailed: {}", e),
    };

    let mut record = AppConfig {
        requires_password: config.requires_password,
        mnemonics: config.mnemonics.clone(),
        server_connection: config.server_connection.clone(),
        server_status: config.server_status.clone(),
        server_progress: config.server_progress.clone(),
        bidding_rules: config.bidding_rules.clone(),
        argon_activity: ArgonActivities::fetch_last_five_records().map_err(|e| e.to_string())?,
        bitcoin_activity: BitcoinActivities::fetch_last_five_records()
            .map_err(|e| e.to_string())?,
        bot_activity: BotActivities::fetch_last_five_records().map_err(|e| e.to_string())?,
        global_stats: None,
        cohort_stats: None,
    };
    let ssh_private_key = config.server_connection.ssh_private_key.clone();
    let ip_address = config.server_connection.ip_address.clone();
    let username = String::from("root");
    let port = 22;

    if config.server_connection.is_connected && !config.server_connection.is_provisioned {
        Provisioner::reconnect(ssh_private_key, username, ip_address, port, app)
            .await
            .map_err(|e| e.to_string())?;
    } else if config.server_connection.is_ready_for_mining {
        Bidder::reconnect(ssh_private_key, username, ip_address, port, app)
            .await
            .map_err(|e| e.to_string())?;
    }

    if config.server_connection.has_mining_seats {
        record.global_stats = Some(BidderStats::fetch_global_stats().map_err(|e| e.to_string())?);
        record.cohort_stats =
            BidderStats::fetch_latest_cohort_stats().map_err(|e| e.to_string())?;
    }

    Ok(record)
}

#[tauri::command]
async fn create_mnemonics(wallet: String, session: String) -> Result<(), String> {
    info!("create_mnemonics");

    Mnemonics::create(wallet, session).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn get_mainchain_url() -> Result<String, String> {
    info!("get_mainchain_url");

    let mainchain_url =
        env::var("MAINCHAIN_URL").unwrap_or_else(|_| "wss://rpc.argon.network".to_string());

    Ok(mainchain_url)
}

#[tauri::command]
async fn connect_server(app: AppHandle, ip_address: String) -> Result<(), String> {
    info!("connect_server");

    let mut config = match Config::load() {
        Ok(config) => config,
        Err(e) => return Err(format!("ConfigFailed: {}", e)),
    };

    let ssh_private_key = config.server_connection.ssh_private_key.clone();
    let username = String::from("root");
    let port = 22;

    Provisioner::start(ssh_private_key, username, ip_address.clone(), port, app)
        .await
        .map_err(|e| e.to_string())?;

    config.server_connection.ip_address = ip_address;
    config.server_connection.is_connected = true;
    config.server_connection.save().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn remove_server() -> Result<(), String> {
    info!("remove_server");

    let mut config = match Config::load() {
        Ok(config) => config,
        Err(e) => return Err(format!("ConfigFailed: {}", e)),
    };

    config.server_connection.ip_address = String::from("");
    config.server_connection.is_connected = false;
    config.server_connection.is_provisioned = false;
    config.server_connection.save().map_err(|e| e.to_string())?;

    config.server_status.remove_file()?;
    config
        .server_progress
        .remove_file()
        .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn update_server_progress(progress: ServerProgress) -> Result<(), String> {
    info!("update_server_progress");

    let mut config = match Config::load() {
        Ok(config) => config,
        Err(e) => return Err(format!("ConfigFailed: {}", e)),
    };

    config.server_progress = progress;
    config.server_progress.save().map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn retry_provisioning(app: AppHandle, step_key: String) -> Result<(), String> {
    info!("retry_provisioning");

    let config = match Config::load() {
        Ok(config) => config,
        Err(e) => return Err(format!("ConfigFailed: {}", e)),
    };

    let ssh_private_key = config.server_connection.ssh_private_key.clone();
    let ip_address = config.server_connection.ip_address.clone();
    let username = String::from("root");
    let port = 22;

    Provisioner::retry_failure(
        step_key,
        ssh_private_key,
        username,
        ip_address.clone(),
        port,
        app,
    )
    .await
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn update_bidding_rules(
    app: AppHandle,
    bidding_rules: BiddingRules,
    wallet_json: String,
    session_mnemonic: String,
) -> Result<(), String> {
    info!("update_bidding_rules");

    bidding_rules.save().map_err(|e| e.to_string())?;

    let server_connection = match ServerConnection::load() {
        Ok(config) => config,
        Err(e) => return Err(format!("ConfigFailed: {}", e)),
    };

    if server_connection.is_ready_for_mining {
        let ssh_private_key = server_connection.ssh_private_key.clone();
        let ip_address = server_connection.ip_address.clone();
        let username = String::from("root");
        let port = 22;

        Bidder::start(
            app,
            ssh_private_key,
            username,
            ip_address,
            port,
            wallet_json,
            session_mnemonic,
        )
        .await
        .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
async fn update_bot_src(app: AppHandle) -> Result<(), String> {
    info!("update_bot_src");
    let server_connection = match ServerConnection::load() {
        Ok(config) => config,
        Err(e) => return Err(format!("ConfigFailed: {}", e)),
    };

    if server_connection.is_ready_for_mining {
        let ssh_private_key = server_connection.ssh_private_key.clone();
        let ip_address = server_connection.ip_address.clone();
        let username = String::from("root");
        let port = 22;

        let ssh = SSH::connect(&ssh_private_key, &username, &ip_address, port)
            .await
            .map_err(|e| e.to_string())?;
        Bidder::update_bot_if_needed(&app, &ssh)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
async fn launch_mining_bot(
    app: AppHandle,
    wallet_json: String,
    session_mnemonic: String,
) -> Result<(), String> {
    info!("launch_mining_bot");

    let server_connection = match ServerConnection::load() {
        Ok(config) => config,
        Err(e) => return Err(format!("ConfigFailed: {}", e)),
    };

    let ssh_private_key = server_connection.ssh_private_key.clone();
    let ip_address = server_connection.ip_address.clone();
    let username = String::from("root");
    let port = 22;

    Bidder::start(
        app,
        ssh_private_key,
        username,
        ip_address,
        port,
        wallet_json,
        session_mnemonic,
    )
    .await
    .map_err(|e| e.to_string())?;

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
        env::var("RUST_LOG").unwrap_or("debug, tauri=info, hyper=info, russh=info".into());
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
            let window = app.get_webview_window("main").unwrap();

            DB::init().map_err(|e| e.to_string())?;

            // test paths

            let local_base_path = Bidder::get_bidding_calculator_path(app.handle())?;
            let filenames = readdir(&local_base_path)?;
            info!(
                "Have bidding calculator embedded: {}. {:#?}",
                local_base_path.display(),
                filenames
            );

            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(16.0))
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

            Ok(())
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![
            start,
            create_mnemonics,
            connect_server,
            remove_server,
            update_server_progress,
            update_bidding_rules,
            retry_provisioning,
            launch_mining_bot,
            get_mainchain_url,
            update_bot_src,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
