use std::fs;
use std::path::{Path, PathBuf};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

pub mod base;
pub mod bidding_rules;
pub mod mnemonics;
pub mod server_connection;
pub mod server_progress;
pub mod server_status;

pub use base::Base;
pub use bidding_rules::BiddingRules;
pub use mnemonics::Mnemonics;
pub use server_connection::ServerConnection;
pub use server_progress::ServerProgress;
pub use server_status::{ServerStatus, ServerStatusErrorType};

#[derive(serde::Serialize, Clone)]
pub struct Config {
    pub requires_password: bool,
    pub server_connection: ServerConnection,
    pub server_status: ServerStatus,
    pub server_progress: ServerProgress,
    pub bidding_rules: Option<BiddingRules>,
    pub mnemonics: Option<Mnemonics>,
}

impl Config {
    pub fn get_embedded_path(app: &AppHandle, path: impl AsRef<Path>) -> anyhow::Result<PathBuf> {
        let local_base_path = app
            .path()
            .resolve(PathBuf::from("..").join(path), BaseDirectory::Resource)?;
        Ok(local_base_path)
    }

    pub fn load() -> anyhow::Result<Self> {
        let base = Base::load()?;
        let bidding_rules = BiddingRules::load()?;
        let server_connection = ServerConnection::load()?;
        let server_status = ServerStatus::load()?;
        let server_progress = ServerProgress::load()?;
        let mnemonics = Mnemonics::load()?;

        Ok(Self {
            requires_password: base.requires_password,
            server_connection,
            server_status,
            server_progress,
            bidding_rules,
            mnemonics,
        })
    }
    // Get the path where the config files should be located.
    fn get_config_dir() -> PathBuf {
        dirs::home_dir().unwrap().join(".config/argon-commander")
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

        // Ensure the directory exists
        if let Some(parent) = file_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let json = serde_json::to_string_pretty(&self)?;
        fs::write(&file_path, json)?;
        Ok(())
    }

    fn remove_file(&self) -> anyhow::Result<()> {
        let file_path = Self::get_file_path();
        Ok(fs::remove_file(file_path)?)
    }

    fn get_file_path() -> PathBuf {
        Config::get_config_dir().join(Self::FILENAME)
    }
}
