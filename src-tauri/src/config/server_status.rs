use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};
use super::Config;
use std::error::Error;
#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(rename_all = "lowercase")]
pub enum ServerStatusErrorType {
    Ubuntu,
    Git,
    Docker,
    BitcoinSync,
    ArgonSync,
    MinerLaunch,
    Unknown,
}

#[derive(Deserialize, Serialize, Clone)]
pub struct ServerStatus {
    #[serde(rename = "ubuntu")]
    pub ubuntu: i32,
    #[serde(rename = "git")]
    pub git: i32,
    #[serde(rename = "docker")]
    pub docker: i32,
    #[serde(rename = "bitcoinsync")]
    pub bitcoinsync: i32,
    #[serde(rename = "argonsync")]
    pub argonsync: i32,
    #[serde(rename = "minerlaunch")]
    pub minerlaunch: f32,
    #[serde(rename = "errorType")]
    pub error_type: Option<ServerStatusErrorType>,
    #[serde(rename = "errorMessage")]
    pub error_message: Option<String>,
}

impl std::fmt::Display for ServerStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "ServerStatus {{ ubuntu: {}, git: {}, docker: {}, bitcoinsync: {}, argonsync: {}, minerlaunch: {}, error_type: {:?}, error_message: {:?} }}",
            self.ubuntu, self.git, self.docker, self.bitcoinsync, self.argonsync, 
            self.minerlaunch, self.error_type, self.error_message)
    }
}

impl ServerStatus {
    pub const FILENAME: &'static str = "serverStatus.json";

    pub fn load() -> Result<Self, Box<dyn Error>> {
        let file_path = Config::get_full_path(Self::FILENAME);

        if Path::new(&file_path).exists() {
            Config::load_from_json_file(Self::FILENAME)
        } else {
            Ok(Self::default())
        }
    }

    pub fn save(&self) -> Result<(), Box<dyn Error>> {
        Config::save_to_json_file(Self::FILENAME, self.clone())
    }

    pub fn remove_file(&self) -> Result<(), String> {
        let config_dir = Config::get_config_dir();
        let file_path = Path::new(&config_dir).join(Self::FILENAME);
        fs::remove_file(file_path).map_err(|e| format!("Failed to remove {} file: {}", Self::FILENAME, e))
    }
}

impl Default for ServerStatus {
    fn default() -> Self {
        Self {
            ubuntu: 0,
            git: 0,
            docker: 0,
            bitcoinsync: 0,
            argonsync: 0,
            minerlaunch: 0.0,
            error_type: None,
            error_message: None,
        }
    }
} 