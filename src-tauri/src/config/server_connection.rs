use crate::config::ConfigFile;
use crate::ssh::{SSHConfig, SSH};
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ServerConnection {
    pub ip_address: String,
    pub ssh_public_key: String,
    pub ssh_private_key: String,
    pub ssh_user: String,
    pub oldest_frame_id_to_sync: Option<u32>,
    pub is_connected: bool,
    pub is_provisioned: bool,
    pub is_ready_for_mining: bool,
    pub has_mining_seats: bool,
}

impl ConfigFile<Self> for ServerConnection {
    const FILENAME: &'static str = "serverConnection.json";
}

impl ServerConnection {
    pub fn ssh_config(&self) -> anyhow::Result<SSHConfig> {
        SSHConfig::new(
            &self.ip_address,
            22,
            self.ssh_user.clone(),
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
            ssh_user: "root".to_string(),
            oldest_frame_id_to_sync: None,
            is_connected: false,
            is_provisioned: false,
            is_ready_for_mining: false,
            has_mining_seats: false,
        }
    }
}
