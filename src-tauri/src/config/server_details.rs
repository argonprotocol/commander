use crate::config::ConfigFile;
use crate::ssh::{SSHConfig, SSH};
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ServerDetails {
    pub ip_address: String,
    pub ssh_public_key: String,
    pub ssh_private_key: String,
    pub ssh_user: String,
    pub is_new_server: bool,
    pub requires_upgrade: bool,
    pub is_installing: bool,
    pub is_connected: bool,
    pub is_ready_for_mining: bool,
    pub has_mining_seats: bool,
    pub oldest_frame_id_to_sync: Option<u32>,
}

impl ConfigFile<Self> for ServerDetails {
    const FILENAME: &'static str = "serverDetails.json";
}

impl ServerDetails {
    pub fn ssh_config(&self) -> anyhow::Result<SSHConfig> {
        SSHConfig::new(
            &self.ip_address,
            22,
            self.ssh_user.clone(),
            self.ssh_private_key.clone(),
        )
    }
}

impl Default for ServerDetails {
    fn default() -> Self {
        let (ssh_private_key, ssh_public_key) =
            SSH::generate_keys().unwrap_or_else(|_| ("".to_string(), "".to_string()));

        Self {
            ip_address: "".to_string(),
            ssh_public_key,
            ssh_private_key,
            ssh_user: "root".to_string(),
            is_new_server: false,
            requires_upgrade: false,
            is_installing: false,
            is_connected: false,
            is_ready_for_mining: false,
            has_mining_seats: false,
            oldest_frame_id_to_sync: None,
        }
    }
}
