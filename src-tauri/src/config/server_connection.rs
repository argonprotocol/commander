use super::Config;
use crate::ssh::{SSHConfig, SSH};
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::path::Path;

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ServerConnection {
    pub ip_address: String,
    pub ssh_public_key: String,
    pub ssh_private_key: String,
    pub user: String,
    pub is_connected: bool,
    pub is_provisioned: bool,
    pub is_ready_for_mining: bool,
    pub has_mining_seats: bool,
}

impl ServerConnection {
    pub const FILENAME: &'static str = "serverConnection.json";

    pub fn load() -> Result<Self, Box<dyn Error>> {
        let file_path = Config::get_full_path(Self::FILENAME);

        if Path::new(&file_path).exists() {
            Config::load_from_json_file(Self::FILENAME)
        } else {
            let server_connection = Self::default();
            server_connection.save()?;
            Ok(server_connection)
        }
    }

    pub fn save(&self) -> Result<(), Box<dyn Error>> {
        Config::save_to_json_file(Self::FILENAME, self.clone())
    }
    
    pub fn ssh_config(&self) -> anyhow::Result<SSHConfig> {
        SSHConfig::new(
            &self.ip_address,
            22,
            self.user.clone(),
            self.ssh_private_key.clone(),
        )
    }
}

impl Default for ServerConnection {
    fn default() -> Self {
        let (ssh_private_key, ssh_public_key) =
            SSH::generate_keys().unwrap_or_else(|_| ("".to_string(), "".to_string()));

        Self {
            ip_address: "".to_string(),
            ssh_public_key,
            ssh_private_key,
            user: "root".to_string(),
            is_connected: false,
            is_provisioned: false,
            is_ready_for_mining: false,
            has_mining_seats: false,
        }
    }
}
