use std::fs;
use std::path::Path;
use std::error::Error;
use serde_json;

pub mod bidding_rules;
pub mod server_connection;
pub mod server_status;
pub mod server_progress;
pub mod mnemonics;
pub mod base;

pub use bidding_rules::BiddingRules;
pub use server_connection::ServerConnection;
pub use server_status::{ServerStatus, ServerStatusErrorType};
pub use server_progress::ServerProgress;
pub use mnemonics::Mnemonics;
pub use base::Base;

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
    pub fn load() -> Result<Self, Box<dyn Error>> {
        let base = Base::load()?;
        let bidding_rules = BiddingRules::load()?;
        let server_connection = ServerConnection::load()?;
        let server_status = ServerStatus::load()?;
        let server_progress = ServerProgress::load()?;
        let mnemonics = Mnemonics::load()?;

        Ok(Self { 
            requires_password: base.requires_password,
            server_connection: server_connection,
            server_status: server_status,
            server_progress: server_progress,
            bidding_rules: bidding_rules,
            mnemonics: mnemonics,
         })
    }

    pub fn save_to_file(file_name: &str, data: String) -> Result<(), Box<dyn Error>> {
        let file_path = Self::get_full_path(file_name);
        
        // Ensure the directory exists
        let path = Path::new(&file_path);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        
        // Write the string to the file
        fs::write(&file_path, data)?;
        
        Ok(())
    }

    pub fn save_to_json_file<T: serde::Serialize>(file_name: &str, data: T) -> Result<(), Box<dyn Error>> {
        // Serialize the data to JSON
        let json = serde_json::to_string_pretty(&data)?;
        
        // Delegate the actual file writing to save_raw
        Self::save_to_file(file_name, json)
    }

    pub fn load_from_file(file_name: &str) -> Result<String, Box<dyn Error>> {
        let file_path = Self::get_full_path(file_name);
        
        // Try to read the file, return error if it doesn't exist
        fs::read_to_string(&file_path).map_err(|e| e.into())
    }
    
    pub fn load_from_json_file<T: serde::de::DeserializeOwned>(file_name: &str) -> Result<T, Box<dyn Error>> {
        // Get the raw string content from the file
        let json = Self::load_from_file(file_name)?;
        
        // Try to parse the JSON, return None if parsing fails
        serde_json::from_str(&json).map_err(|e| e.into())
    }

    pub fn get_full_path(file_name: &str) -> String {
        let config_dir = Self::get_config_dir();
        let file_path = Path::new(&config_dir).join(format!("{}", file_name));
        file_path.to_str().unwrap().to_string()
    }

    // Get the path where the config files should be located.
    fn get_config_dir() -> String {
        let home_dir = dirs::home_dir().unwrap();
        home_dir.to_str().unwrap().to_string() + "/.config/argon-commander"
    }
}
