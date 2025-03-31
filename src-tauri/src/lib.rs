use tauri::Manager;
use window_vibrancy::*;
use server::Server;
use account::Account;
use parking_lot::Mutex;
use std::sync::Arc;
use tauri::State;

mod db;
mod ssh;
mod server;
mod account;

type SharedServerRecord = Arc<Mutex<server::ServerRecord>>;
type SharedAccountRecord = Arc<Mutex<account::AccountRecord>>;

#[derive(serde::Serialize)]
struct AppAccountRecord {
    #[serde(rename = "address")]
    address: String,
    #[serde(rename = "privateJson")]
    private_json: String,
    #[serde(rename = "requiresPassword")]
    requires_password: bool,
    #[serde(rename = "isSaved")]
    is_saved: bool,
}

#[derive(serde::Serialize)]
struct AppServerRecord {
    #[serde(rename = "address")]
    address: String,
    #[serde(rename = "publicKey")]
    public_key: String,    
    #[serde(rename = "setupStatus")]
    setup_status: AppSetupStatus,
    #[serde(rename = "requiresPassword")]
    requires_password: bool,
    #[serde(rename = "isSaved")]
    is_saved: bool,
}

#[derive(serde::Serialize)]
struct AppSetupStatus {
    #[serde(rename = "ubuntu")]
    ubuntu: i32,
    #[serde(rename = "git")]
    git: i32,
    #[serde(rename = "docker")]
    docker: i32,
    #[serde(rename = "blocksync")]
    blocksync: f32,
}

impl From<db::SetupStatus> for AppSetupStatus {
    fn from(status: db::SetupStatus) -> Self {
        AppSetupStatus {
            ubuntu: status.ubuntu,
            git: status.git,
            docker: status.docker,
            blocksync: status.blocksync,
        }
    }
}

#[tauri::command]
async fn fetch_account<'a>(account_record: State<'a, SharedAccountRecord>) -> Result<AppAccountRecord, String> {
    let account_record = account_record.lock();
    if account_record.address.is_empty() {
        return Err("AccountEmpty".to_string());
    }
    let record = AppAccountRecord {
        address: account_record.address.clone(),
        private_json: account_record.private_json.clone(),
        requires_password: account_record.requires_password,
        is_saved: account_record.is_saved.clone(),
    };
    Ok(record)
}

#[tauri::command]
async fn initialize_account<'a>(
    account_record: State<'a, SharedAccountRecord>, 
    address: String, 
    private_json: String, 
    requires_password: bool
) -> Result<AppAccountRecord, String> {
    if account_record.lock().is_saved {
        return Err("AccountExists".to_string());
    }
    
    let mut account = Account::from_record(account_record.lock().clone());
    account.update_record(address, private_json, requires_password).await?;

    *account_record.lock() = account.record.clone();

    let record = AppAccountRecord {
        address: account.record.address.clone(),
        private_json: account.record.private_json.clone(),
        requires_password: account.record.requires_password,
        is_saved: true,
    };
    Ok(record)
}

#[tauri::command]
async fn fetch_server<'a>(server_record: State<'a, SharedServerRecord>) -> Result<AppServerRecord, String> {
    let server_record = server_record.lock();
    let record = AppServerRecord {
        address: server_record.address.clone(),
        public_key: server_record.public_key.clone(),
        setup_status: AppSetupStatus::from(server_record.setup_status.clone()),
        requires_password: server_record.requires_password,
        is_saved: server_record.is_saved.clone(),
    };
    Ok(record)
}

#[tauri::command]
async fn initialize_server<'a>(server_record: State<'a, SharedServerRecord>, address: String) -> Result<String, String> {
    // Update IP address
    server_record.lock().address = address;

    let mut server = Server::from_record(server_record.lock().clone());
    server.save().await.map_err(|e| e.to_string())?;
    
    *server_record.lock() = server.record.clone();
    
    Ok("ServerSaved".to_string())
}

#[tauri::command]
async fn fetch_server_status<'a>(server_record: State<'a, SharedServerRecord>) -> Result<AppSetupStatus, String> {    
    let mut server = Server::from_record(server_record.lock().clone());
    server.refresh_setup_status().await.map_err(|e| e.to_string())?;
    
    *server_record.lock() = server.record.clone();

    Ok(AppSetupStatus::from(server_record.lock().setup_status.clone()))
}

////////////////////////////////////////////////////////////

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let server = match Server::init() {
        Ok(server) => server,
        Err(e) => panic!("Failed to initialize server: {}", e),
    };
    let server_record: Arc<parking_lot::lock_api::Mutex<parking_lot::RawMutex, server::ServerRecord>> = Arc::new(Mutex::new(server.record.clone()));
    
    let account = match Account::init() {
        Ok(account) => account,
        Err(e) => panic!("Failed to initialize account: {}", e),
    };
    let account_record: Arc<parking_lot::lock_api::Mutex<parking_lot::RawMutex, account::AccountRecord>> = Arc::new(Mutex::new(account.record.clone()));

    tauri::Builder::default()
        .setup(|app| {
            let window = app.get_webview_window("main").unwrap();

            #[cfg(target_os = "macos")]
            apply_vibrancy(&window, NSVisualEffectMaterial::HudWindow, None, Some(16.0))
                .expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");            

            Ok(())
        })
        .manage(server_record.clone())
        .manage(account_record.clone())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_os::init())
        .invoke_handler(tauri::generate_handler![fetch_account, initialize_account, fetch_server, initialize_server, fetch_server_status])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
