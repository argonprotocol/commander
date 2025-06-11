use crate::utils::Utils;
use anyhow::Result;
use async_trait::async_trait;
use log::{error, info};
use rand::rngs::OsRng;
use russh::client::{AuthResult, Msg};
use russh::keys::ssh_key::LineEnding;
use russh::keys::*;
use russh::*;
use std::collections::HashSet;
use std::fmt::Display;
use std::fs;
use std::future::Future;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tauri::AppHandle;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::tcp::{OwnedReadHalf, OwnedWriteHalf};
use tokio::runtime::Handle;
use tokio::sync::{Mutex as TokioMutex, Mutex};

pub mod singleton;

#[derive(Clone)]
pub struct SSH {
    client: Arc<TokioMutex<client::Handle<ClientHandler>>>,
    pub config: SSHConfig,
}

#[derive(Clone, PartialEq)]
pub struct SSHConfig {
    addrs: (String, u16),
    username: String,
    private_key: Arc<PrivateKey>,
}

impl SSHConfig {
    pub fn new(host: &str, port: u16, username: String, private_key_str: String) -> Result<Self> {
        let private_key = decode_secret_key(&private_key_str, None)?;
        let addrs = (host.to_string(), port);
        Ok(SSHConfig {
            addrs,
            username: username.to_string(),
            private_key: Arc::new(private_key),
        })
    }

    pub fn get_private_key(&self) -> Result<Arc<PrivateKey>> {
        Ok(self.private_key.clone())
    }
}

// Explicitly implement Send for SSH
unsafe impl Send for SSH {}

impl Drop for SSH {
    fn drop(&mut self) {
        if let Ok(handle) = Handle::try_current() {
            let ssh_clone = self.client.clone();
            handle.spawn(async move {
                if let Ok(client) = ssh_clone.try_lock() {
                    if let Err(e) = client
                        .disconnect(Disconnect::ByApplication, "", "English")
                        .await
                    {
                        error!("Error disconnecting SSH client: {}", e);
                    }
                }
            });
        } else {
            info!("Warning: Could not close SSH connection during cleanup - no runtime available");
        }
    }
}

impl SSH {
    pub async fn find_available_port(start_port: u16) -> Result<u16> {
        let mut port = start_port;
        loop {
            match tokio::net::TcpListener::bind(format!("127.0.0.1:{}", port)).await {
                Ok(_) => {
                    return Ok(port);
                }
                Err(_) => {
                    if port == u16::MAX {
                        anyhow::bail!("No available ports found");
                    }
                    port += 1;
                }
            }
        }
    }

    pub async fn connect(config: &SSHConfig) -> Result<Self> {
        let client = Self::authenticate(&config).await?;
        let ssh = SSH {
            client: Arc::new(Mutex::new(client)),
            config: config.clone(),
        };
        Ok(ssh)
    }

    async fn authenticate(ssh_config: &SSHConfig) -> Result<client::Handle<ClientHandler>> {
        let config = client::Config {
            inactivity_timeout: None,
            ..<_>::default()
        };
        let config = Arc::new(config);

        let handler = ClientHandler {};

        let mut client = client::connect(config, ssh_config.addrs.clone(), handler).await?;
        // use publickey authentication, with or without certificate
        let auth_res = client
            .authenticate_publickey(
                &ssh_config.username,
                PrivateKeyWithHashAlg::new(ssh_config.private_key.clone(), None),
            )
            .await?;

        if let AuthResult::Failure {
            remaining_methods,
            partial_success,
        } = auth_res
        {
            anyhow::bail!(
                "Authentication (with publickey) failed for {}: {:?} (partial success: {})",
                ssh_config.username,
                remaining_methods,
                partial_success
            );
        }
        Ok(client)
    }

    pub async fn reconnect(&self) -> Result<()> {
        let client = Self::authenticate(&self.config).await?;
        *self.client.lock().await = client;
        Ok(())
    }

    async fn open_channel(&self) -> Result<Channel<Msg>> {
        if let Ok(channel) = self.client.lock().await.channel_open_session().await {
            return Ok(channel);
        }

        self.reconnect().await?;
        Ok(self.client.lock().await.channel_open_session().await?)
    }

    pub async fn run_command(&self, command: impl Display) -> Result<(String, u32)> {
        let shell_command = format!("bash -c '{}'", command);
        info!("Executing shell command: {}", shell_command);
        let mut channel = self.open_channel().await?;
        channel.exec(true, shell_command).await?;

        let mut code = None;
        let mut output = String::new();

        loop {
            // There's an event available on the session channel
            let Some(msg) = channel.wait().await else {
                break;
            };
            match msg {
                // Collect stdout data
                russh::ChannelMsg::Data { ref data } => {
                    output.push_str(&String::from_utf8_lossy(data));
                }
                // Collect stderr data
                russh::ChannelMsg::ExtendedData { ref data, ext } => {
                    if ext == 1 {
                        // 1 is stderr
                        output.push_str(&String::from_utf8_lossy(data));
                    }
                }
                // The command has returned an exit code
                russh::ChannelMsg::ExitStatus { exit_status } => {
                    code = Some(exit_status);
                    // cannot leave the loop immediately, there might still be more data to receive
                }
                _ => {}
            }
        }
        let _ = channel.close().await;
        let exit_code = code.ok_or_else(|| {
            anyhow::anyhow!("SSH command exited without status — likely failed early (e.g. bad command or missing file)")
        })?;

        Ok((output, exit_code))
    }

    pub async fn upload_directory(
        &self,
        app: &AppHandle,
        local_relative_dir: impl AsRef<Path>,
        remote_base_dir: &str,
    ) -> Result<()> {
        let local_relative_path = local_relative_dir.as_ref().to_path_buf();
        info!(
            "Uploading directory {}",
            local_relative_path.to_string_lossy()
        );
        let files_to_upload = Utils::collect_files(app, &local_relative_path)?;
        let mut remote_dirs_created = HashSet::new();

        // Upload each file
        for file in files_to_upload {
            let remote_file_path = PathBuf::from(remote_base_dir).join(&file.relative_path);
            let remote_parent_dir = remote_file_path
                .parent()
                .map(|p| p.to_string_lossy().to_string());
            let remote_file_path = remote_file_path.to_string_lossy().to_string();

            // Create remote parent directory if needed
            if let Some(parent) = remote_parent_dir {
                if remote_dirs_created.insert(parent.clone()) {
                    info!("Creating remote directory {}", parent);
                    self.run_command(format!("mkdir -p {}", parent)).await?;
                }
            }

            let script_contents = fs::read_to_string(&file.absolute_path)?;
            self.upload_file(&script_contents, &remote_file_path)
                .await?;

            // Set executable bit if needed
            if file.is_executable {
                info!("Setting executable bit for {}", remote_file_path);
                self.run_command(format!("chmod u+x {}", remote_file_path))
                    .await?;
            }
        }

        Ok(())
    }

    pub async fn upload_file(&self, contents: &str, remote_path: &str) -> Result<()> {
        // First, create the script in the remote server's home directory
        info!("Uploading file {}", remote_path);
        let mut channel = self.open_channel().await?;
        let scp_command = format!("cat > {}", remote_path);
        channel.exec(true, scp_command).await?;

        // Write the contents of the setup script
        channel.data(contents.as_bytes()).await?;
        channel.eof().await?;

        // Wait for the copy to complete
        while channel.wait().await.is_some() {}

        Ok(())
    }

    pub async fn close(&self) -> Result<()> {
        if let Ok(client) = self.client.try_lock() {
            client
                .disconnect(Disconnect::ByApplication, "", "English")
                .await?;
        }
        Ok(())
    }

    pub fn generate_keys() -> Result<(String, String), String> {
        // Generate a new key pair using Ed25519
        let private_key =
            PrivateKey::random(&mut OsRng, Algorithm::Ed25519).map_err(|e| e.to_string())?;

        // Derive the public key from the private key
        let public_key = PublicKey::from(&private_key);

        // Convert to OpenSSH format
        let public_key_openssh = public_key.to_openssh().map_err(|e| e.to_string())?;

        // Convert private key to OpenSSH format
        let private_key_openssh = private_key
            .to_openssh(LineEnding::LF)
            .map_err(|e| e.to_string())?
            .to_string();

        Ok((private_key_openssh, public_key_openssh))
    }

    /// Creates a new SSH channel for a TCP connection.
    /// Returns true if the channel needs to reconnect
    pub async fn create_channel(
        &self,
        local_read: &mut OwnedReadHalf,
        local_write: &mut OwnedWriteHalf,
        remote_host: String,
        remote_port: u16,
        local_port: u16,
    ) -> Result<bool> {
        // just create this channel to make sure the connection is alive
        info!("Testing connection to {}", remote_host);
        let channel = self.open_channel().await?;
        drop(channel);

        // Create a new SSH channel for this connection
        let mut channel = self
            .client
            .lock()
            .await
            .channel_open_direct_tcpip(
                &remote_host,
                remote_port as u32,
                "127.0.0.1",
                local_port as u32,
            )
            .await
            .inspect_err(|e| {
                error!("Error opening SSH channel: {}", e);
            })?;

        // Split the local stream
        let mut buf = vec![0u8; 4096];

        loop {
            tokio::select! {
                // Handle local to remote
                result = local_read.read(&mut buf) => {
                    match result {
                        Ok(0) => {
                            return Ok(false); // EOF
                        }
                        Ok(n) => {
                            if let Err(e) = channel.data(&buf[..n]).await {
                                error!("Error writing to remote: {}", e);
                                return Ok(true);
                            }
                        }
                        Err(e) => {
                            error!("Error reading from local: {}", e);
                            return Ok(true);
                        }
                    }
                }
                // Handle remote to local
                msg = channel.wait() => {
                    match msg {
                        Some(russh::ChannelMsg::Data { data }) => {
                            if let Err(e) = local_write.write_all(&data).await {
                                error!("Error writing to local: {}", e);
                                return Ok(true);
                            }
                        }
                        Some(russh::ChannelMsg::Eof) => {
                            return Ok(false);
                        }
                        Some(russh::ChannelMsg::Close) => {
                            return Ok(true);
                        }
                        None => {
                            return Ok(false); // Channel closed
                        }
                        _ => {}
                    }
                }
            }
        }
    }

    pub async fn create_http_tunnel(
        self: Arc<Self>,
        local_port: u16,
        remote_host: &str,
        remote_port: u16,
    ) -> Result<()> {
        info!(
            "Opening tunnel from local port {} to {}:{}",
            local_port, remote_host, remote_port
        );

        // Create a TCP listener on the local port
        let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", local_port)).await?;

        // Clone the client handle and remote host for use in the spawned task
        let remote_host = remote_host.to_string();
        let client = Arc::clone(&self);

        // Accept connections and forward them through the SSH tunnel
        tokio::spawn(async move {
            // Spawn a new task for each connection
            let remote_host = remote_host.clone();
            let client = Arc::clone(&client);

            loop {
                match listener.accept().await {
                    Ok((local_stream, _)) => {
                        let remote_host = remote_host.clone();
                        let client = Arc::clone(&client);
                        tokio::spawn(async move {
                            let (mut local_read, mut local_write) = local_stream.into_split();
                            loop {
                                match Self::create_channel(
                                    &client,
                                    &mut local_read,
                                    &mut local_write,
                                    remote_host.clone(),
                                    remote_port,
                                    local_port,
                                )
                                .await
                                {
                                    Ok(should_reconnect) => {
                                        if should_reconnect {
                                            info!("Reconnecting to SSH tunnel...");
                                            continue;
                                        }
                                    }
                                    Err(e) => {
                                        error!("Error creating channel for tunnel: {}", e);
                                    }
                                }
                                // default is to break
                                break;
                            }
                        });
                    }
                    Err(e) => {
                        error!("Error accepting connection: {}", e);
                        break;
                    }
                }
            }
            println!("Dropping http tunnel listener");
            drop(listener);
            info!("Tunnel connection handler ended");
        });

        Ok(())
    }
}

struct ClientHandler {}

// Explicitly implement Send for ClientHandler
unsafe impl Send for ClientHandler {}

#[async_trait]
impl client::Handler for ClientHandler {
    type Error = russh::Error;

    fn check_server_key(
        &mut self,
        _server_public_key: &keys::PublicKey,
    ) -> impl Future<Output = std::result::Result<bool, Self::Error>> + Send {
        async { Ok(true) }
    }
}
