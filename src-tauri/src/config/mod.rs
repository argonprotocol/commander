use std::fs;
use std::path::{PathBuf};
use std::sync::Mutex;
use lazy_static::lazy_static;

pub mod base;
pub mod bidding_rules;
pub mod security;
pub mod server_details;
pub mod install_status;

pub use base::Base;
pub use bidding_rules::BiddingRules;
pub use security::Security;
pub use server_details::ServerDetails;
pub use install_status::{InstallStatus, InstallStatusErrorType, InstallStatusClient, InstallStatusServer};

lazy_static! {
    static ref FILE_LOCKS: Mutex<std::collections::HashMap<String, Mutex<()>>> = Mutex::new(std::collections::HashMap::new());
}

#[derive(serde::Serialize, Clone)]
pub struct Config {
    pub requires_password: bool,
    pub server_details: ServerDetails,
    pub install_status: InstallStatus,
    pub bidding_rules: Option<BiddingRules>,
    pub security: Option<Security>,
}

impl Config {
    pub fn load() -> anyhow::Result<Self> {
        let base = Base::load()?;
        let bidding_rules = BiddingRules::load()?;
        let server_details = ServerDetails::load()?;
        let install_status = InstallStatus::load()?;
        let security = Security::load()?;

        Ok(Self {
            requires_password: base.requires_password,
            server_details,
            install_status,
            bidding_rules,
            security,
        })
    }

    // Get the path where the config files should be located.
    pub fn get_config_dir() -> PathBuf {
        let folder_name = std::env::var("COMMANDER_INSTANCE_NAME").unwrap_or("argon-commander".to_string());
        dirs::home_dir().unwrap().join(".config").join(folder_name)
    }
}

pub trait ConfigFile<T>
where
    T: Default + Clone + serde::Serialize + serde::de::DeserializeOwned,
    Self: Clone + serde::Serialize + serde::de::DeserializeOwned,
{
    const FILENAME: &'static str;

    fn load() -> anyhow::Result<T> {
        if let Some(contents) = Self::load_raw()? {
            // Try to parse the JSON, return None if parsing fails
            serde_json::from_str(&contents).map_err(|e| e.into())
        } else {
            Ok(T::default())
        }
    }

    fn load_raw() -> anyhow::Result<Option<String>> {
        let file_path = Self::get_file_path();
        if file_path.exists() {
            // Try to read the file, return error if it doesn't exist
            let contents = fs::read_to_string(&file_path)?;
            Ok(Some(contents))
        } else {
            Ok(None)
        }
    }

    fn save(&self) -> anyhow::Result<()> {
        let file_path = Self::get_file_path();
        let mut locks = FILE_LOCKS.lock().unwrap();
        let _lock = locks
            .entry(Self::FILENAME.to_string())
            .or_insert_with(|| Mutex::new(()))
            .lock()
            .unwrap();

        // Ensure the directory exists
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // Write to a temporary file first
        let temp_path = file_path.with_extension("tmp");
        let json = serde_json::to_string_pretty(&self)?;
        fs::write(&temp_path, json)?;

        // Atomically rename the temporary file to the target file
        fs::rename(temp_path, file_path)?;

        // Lock is automatically released when it goes out of scope
        Ok(())
    }

    fn delete() -> anyhow::Result<()> {
        let file_path = Self::get_file_path();
        if file_path.exists() {
            fs::remove_file(file_path)?;
        }
        Ok(())
    }

    fn get_file_path() -> PathBuf {
        Config::get_config_dir().join(Self::FILENAME)
    }
}