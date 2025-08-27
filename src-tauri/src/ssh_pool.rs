use crate::ssh::SSH;
use crate::ssh::SSHConfig;
use anyhow::Result;
use lazy_static::lazy_static;
use std::collections::HashMap;
use std::time::Duration;
use tokio::sync::Mutex;

lazy_static! {
    static ref CONNECTIONS_BY_ADDRESS: Mutex<HashMap<String, SSH>> = Mutex::new(HashMap::new());
}

pub async fn close_connection(address: &str) -> Result<()> {
    let address = address.to_string();
    let mut connections_by_address = CONNECTIONS_BY_ADDRESS.lock().await;
    if let Some(ssh) = connections_by_address.remove(&address) {
        log::info!("Closing SSH connection to {}", address);
        if let Err(e) = ssh.close().await {
            log::error!("Error closing SSH connection to {}: {:#}", address, e);
        }
    }

    Ok(())
}

pub async fn get_connection(address: &str) -> Result<Option<SSH>> {
    let address = address.to_string();
    let connections_by_address = CONNECTIONS_BY_ADDRESS.lock().await;
    Ok(connections_by_address.get(&address).cloned())
}

pub async fn open_connection(
    address: &str,
    host: &str,
    port: u16,
    username: String,
    private_key: String,
) -> Result<SSH> {
    let address = address.to_string();
    let ssh_config = SSHConfig::new(host, port, username, private_key).unwrap();

    let mut connections_by_address = CONNECTIONS_BY_ADDRESS.lock().await;

    let needs_new_connection = match connections_by_address.get(&address) {
        Some(ssh) => {
            log::info!("Reconnecting to SSH: {:#}", ssh.config != ssh_config);
            ssh.config != ssh_config
        }
        None => {
            log::info!("No SSH connection found for {}, creating new one", address);
            true
        }
    };

    if needs_new_connection {
        // Close existing connection if it exists
        if let Some(ssh) = connections_by_address.remove(&address) {
            log::info!("Closing existing SSH connection to {}", address);
            if let Err(e) = ssh.close().await {
                log::error!("Error closing existing SSH connection: {:#}", e);
            }
        }

        // Create new connection with custom timeout
        let timeout_duration = Duration::from_secs(10);
        log::info!(
            "Creating new SSH connection to {} with {:?} timeout",
            ssh_config.host(),
            timeout_duration
        );
        let new_ssh = SSH::connect(&ssh_config, timeout_duration).await?;
        connections_by_address.insert(address.clone(), new_ssh.clone());
    }

    connections_by_address
        .get(&address)
        .ok_or_else(|| anyhow::anyhow!("Failed to create or retrieve SSH connection"))
        .cloned()
}
