use std::sync::Arc;
use crate::ssh::SSH;
use crate::ssh::SSHConfig;
use lazy_static::lazy_static;
use anyhow::Result;
use tokio::sync::Mutex;

lazy_static! {
  static ref SSH_CONNECTION: Mutex<Option<SSH>> = Mutex::new(None);
}

lazy_static! {
  static ref LOCAL_PORT: Mutex<Option<u16>> = Mutex::new(None);
}

pub async fn get_ssh_connection(ssh_config: SSHConfig) -> Result<SSH> {
  let mut ssh_connection = SSH_CONNECTION.lock().await;
  
  // Check if we need to reconnect
  let needs_reconnect = match &*ssh_connection {
      Some(ssh) => ssh.config != ssh_config,
      None => true,
  };

  if needs_reconnect {
      // Close existing connection if it exists
      if let Some(ssh) = ssh_connection.take() {
          ssh.close().await?;
      }
      
      // Create new connection
      let new_ssh = SSH::connect(ssh_config).await?;
      *ssh_connection = Some(new_ssh.clone());
      Ok(new_ssh)
  } else {
      // Return existing connection
      Ok(ssh_connection.as_ref().unwrap().clone())
  }
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
  arc_ssh.create_http_tunnel(local_port, remote_host, remote_port).await?;

  Ok(local_port)
}

