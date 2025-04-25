use std::fs;
use std::path::Path;
use serde::{Deserialize, Serialize};
use super::Config;
use std::error::Error;

#[derive(Deserialize, Serialize, Clone)]
pub struct ServerProgress {
    #[serde(rename = "ssh")]
    pub ssh: f32,
    #[serde(rename = "ubuntu")]
    pub ubuntu: f32,
    #[serde(rename = "git")]
    pub git: f32,
    #[serde(rename = "docker")]
    pub docker: f32,
    #[serde(rename = "bitcoinsync")]
    pub bitcoinsync: f32,
    #[serde(rename = "argonsync")]
    pub argonsync: f32,
    #[serde(rename = "minerlaunch")]
    pub minerlaunch: f32,
}

impl ServerProgress {
    pub const FILENAME: &'static str = "serverProgress.json";

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

    pub fn remove_file(&self) -> Result<(), Box<dyn Error>> {
        let config_dir = Config::get_config_dir();
        let file_path = Path::new(&config_dir).join(Self::FILENAME);
        fs::remove_file(file_path).map_err(|e| e.into())
    }
}

impl Default for ServerProgress {
    fn default() -> Self {
        Self {
            ssh: 0.00,
            ubuntu: 0.00,
            git: 0.00,
            docker: 0.00,
            bitcoinsync: 0.00,
            argonsync: 0.00,
            minerlaunch: 0.00,
        }
    }
} 