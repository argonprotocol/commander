use bidder::Bidder;
use config::{BiddingRules, Config, Mnemonics, ServerConnection, ServerProgress, ServerStatus};
use db::{ArgonActivity, BitcoinActivity, BotActivity, DB};
use provisioner::Provisioner;
use tauri::{AppHandle, Manager};
use window_vibrancy::*;

mod bidder;
mod bidder_stats;
mod config;
mod db;
mod provisioner;
mod ssh;

#[derive(serde::Serialize)]
struct AppConfig {
    #[serde(rename = "requiresPassword")]
    requires_password: bool,

    #[serde(rename = "mnemonics")]
    mnemonics: Option<Mnemonics>,

    #[serde(rename = "serverConnection")]
    server_connection: ServerConnection,

    #[serde(rename = "serverStatus")]
    server_status: ServerStatus,

    #[serde(rename = "serverProgress")]
    server_progress: ServerProgress,

    #[serde(rename = "biddingRules")]
    bidding_rules: Option<BiddingRules>,

    #[serde(rename = "argonActivity")]
    argon_activity: Vec<ArgonActivity>,

    #[serde(rename = "bitcoinActivity")]
    bitcoin_activity: Vec<BitcoinActivity>,

    #[serde(rename = "botActivity")]
    bot_activity: Vec<BotActivity>,
}

#[tauri::command]
async fn start(app: AppHandle) -> Result<AppConfig, String> {
    println!("start");

    let config = match Config::load() {
        Ok(config) => config,
        Err(e) => panic!("ConfigFailed: {}", e),
    };

    let record = AppConfig {
        requires_password: config.requires_password,
        mnemonics: config.mnemonics.clone(),
        server_connection: config.server_connection.clone(),
        server_status: config.server_status.clone(),
        server_progress: config.server_progress.clone(),
        bidding_rules: config.bidding_rules.clone(),
        argon_activity: ArgonActivity::fetch_last_five_records().map_err(|e| e.to_string())?,
        bitcoin_activity: BitcoinActivity::fetch_last_five_records().map_err(|e| e.to_string())?,
        bot_activity: BotActivity::fetch_last_five_records().map_err(|e| e.to_string())?,
    };

    if config.server_connection.is_connected && !config.server_connection.is_provisioned {
        let ssh_private_key = config.server_connection.ssh_private_key.clone();
        let ip_address = config.server_connection.ip_address.clone();
        let username = String::from("root");
        let port = 22;

        Provisioner::reconnect(ssh_private_key, username, ip_address, port, app)
            .await
            .map_err(|e| e.to_string())?;
    } else if config.server_connection.is_ready_for_mining {
        let ssh_private_key = config.server_connection.ssh_private_key.clone();
        let ip_address = config.server_connection.ip_address.clone();
        let username = String::from("root");
        let port = 22;

        Bidder::reconnect(ssh_private_key, username, ip_address, port, app)
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(record)
}

#[tauri::command]
async fn create_mnemonics(wallet: String, session: String) -> Result<(), String> {
    println!("create_mnemonics");

    Mnemonics::create(wallet, session).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
async fn connect_server(app: AppHandle, ip_address: String) -> Result<(), String> {
    println!("connect_server");

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
    println!("remove_server");

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
    println!("update_server_progress");

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
    println!("retry_provisioning");

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
    println!("update_bidding_rules");

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
async fn launch_mining_bot(
    app: AppHandle,
    wallet_json: String,
    session_mnemonic: String,
) -> Result<(), String> {
    println!("launch_mining_bot");

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

////////////////////////////////////////////////////////////

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
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
            create_mnemonics,
            connect_server,
            remove_server,
            update_server_progress,
            update_bidding_rules,
            retry_provisioning,
            launch_mining_bot,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
