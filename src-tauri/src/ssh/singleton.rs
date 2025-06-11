use crate::ssh::SSHConfig;
use crate::ssh::SSH;
use anyhow::Result;
use lazy_static::lazy_static;
use log;
use std::sync::Arc;
use tokio::sync::Mutex;

lazy_static! {
    static ref SSH_CONNECTION: Mutex<Option<SSH>> = Mutex::new(None);
}

lazy_static! {
    static ref LOCAL_PORT: Mutex<Option<u16>> = Mutex::new(None);
}

pub async fn replace_ssh_connection(ssh: SSH) -> Result<()> {
    let mut ssh_connection = SSH_CONNECTION.lock().await;
    *ssh_connection = Some(ssh);

    Ok(())
}

pub async fn close_ssh_connection() -> Result<()> {
    let mut ssh_connection = SSH_CONNECTION.lock().await;
    if let Some(ssh) = ssh_connection.take() {
        log::info!("Closing existing SSH connection");
        if let Err(e) = ssh.close().await {
            log::error!("Error closing existing SSH connection: {:#}", e);
        }
        *ssh_connection = None;
    }

    Ok(())
}

pub async fn try_open_ssh_connection(ssh_config: &SSHConfig) -> Result<SSH> {
    let mut ssh_connection = SSH_CONNECTION.lock().await;

    let needs_new_connection = match &*ssh_connection {
        Some(ssh) => {
            log::info!("Reconnecting to SSH: {:#}", ssh.config != *ssh_config);
            ssh.config != *ssh_config
        }
        None => {
            log::info!("No SSH connection found, creating new one");
            true
        }
    };

    if needs_new_connection {
        // Close existing connection if it exists
        if let Some(ssh) = ssh_connection.take() {
            log::info!("Closing existing SSH connection");
            if let Err(e) = ssh.close().await {
                log::error!("Error closing existing SSH connection: {:#}", e);
            }
        }

        // Create new connection
        log::info!("Creating new SSH connection");
        let new_ssh = SSH::connect(&ssh_config).await?;
        *ssh_connection = Some(new_ssh.clone());
    }

    Ok(ssh_connection.as_ref().unwrap().clone())
}

pub async fn get_ssh_connection() -> Result<Option<SSH>> {
    let ssh_connection = SSH_CONNECTION.lock().await;
    Ok(ssh_connection.as_ref().cloned())
}

pub async fn try_adding_tunnel_to_connection(ssh: &SSH) -> Result<u16> {
    if let Some(handle) = LOCAL_PORT.lock().await.take() {
        return Ok(handle);
    }

    let local_port: u16 = SSH::find_available_port(3600).await?;
    let remote_host = "127.0.0.1";
    let remote_port = 3000;

    *LOCAL_PORT.lock().await = Some(local_port);

    let arc_ssh = Arc::new(ssh.clone());
    println!(
        "Creating tunnel from local port {} to {}:{}",
        local_port, remote_host, remote_port
    );
    arc_ssh
        .create_http_tunnel(local_port, remote_host, remote_port)
        .await?;

    Ok(local_port)
}
