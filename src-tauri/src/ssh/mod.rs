use crate::config::Config;
use crate::readdir;
use anyhow::Result;
use async_trait::async_trait;
use log::{error, info};
use rand::rngs::OsRng;
use russh::client::Msg;
use russh::*;
use russh_keys::*;
use ssh_key::{Algorithm, LineEnding, PrivateKey, PublicKey};
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tauri::AppHandle;
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::tcp::{OwnedReadHalf, OwnedWriteHalf};
use tokio::runtime::Handle;
use tokio::sync::{Mutex as TokioMutex, Mutex};

#[derive(Clone)]
pub struct SSH {
    client: Arc<TokioMutex<client::Handle<ClientHandler>>>,
    config: SSHConfig,
}

#[derive(Clone)]
pub struct SSHConfig {
    addrs: (String, u16),
    username: String,
    key_pair: russh_keys::key::KeyPair,
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

    pub async fn connect(
        private_key: &str,
        mut username: &str,
        host: &str,
        port: u16,
    ) -> Result<Self> {
        let key_pair = decode_secret_key(private_key, None)?;
        let addrs = (host.to_string(), port);
        if username.is_empty() {
            username = "root";
        }
        let config = SSHConfig {
            addrs,
            username: username.to_string(),
            key_pair: key_pair.clone(),
        };

        let client = Self::authenticate(&config).await?;
        let ssh = SSH {
            client: Arc::new(Mutex::new(client)),
            config,
        };
        Ok(ssh)
    }

    async fn authenticate(ssh_config: &SSHConfig) -> Result<client::Handle<ClientHandler>> {
        let config = client::Config {
            inactivity_timeout: Some(Duration::from_secs(5)),
            preferred: Preferred {
                kex: &[
                    russh::kex::CURVE25519_PRE_RFC_8731,
                    russh::kex::EXTENSION_SUPPORT_AS_CLIENT,
                ],
                ..Default::default()
            },
            ..<_>::default()
        };
        let config = Arc::new(config);

        let handler = ClientHandler {};

        let mut client = client::connect(config, ssh_config.addrs.clone(), handler).await?;
        // use publickey authentication, with or without certificate
        let auth_res = client
            .authenticate_publickey(
                ssh_config.username.clone(),
                Arc::new(ssh_config.key_pair.clone()),
            )
            .await?;

        if !auth_res {
            anyhow::bail!("Authentication (with publickey) failed");
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

    pub async fn run_command(&self, command: &str) -> Result<(String, u32)> {
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
        local_path_to_copy: PathBuf,
    ) -> Result<()> {
        let embedded_path = Config::get_embedded_path(&app, &local_path_to_copy)?;
        let filenames = readdir(&embedded_path)?;

        for file in filenames {
            let local_file_path = embedded_path.join(&file);
            let remote_file_path = PathBuf::from("commander-config")
                .join(&local_path_to_copy)
                .join(file);

            let script_contents = match std::fs::read_to_string(&local_file_path) {
                Ok(contents) => contents,
                Err(e) => {
                    return Err(e.into());
                }
            };

            self.upload_file(&script_contents, remote_file_path.to_str().unwrap())
                .await?;
        }
        Ok(())
    }

    pub async fn upload_file(&self, contents: &str, remote_path: &str) -> Result<()> {
        // First, create the script in the remote server's home directory
        let mut channel = self.open_channel().await?;
        let scp_command = format!("cat > {}", remote_path);
        channel.exec(true, scp_command).await?;

        info!("Creating remote file {}", remote_path);

        // Write the contents of the setup script
        channel.data(contents.as_bytes()).await?;
        channel.eof().await?;

        // Wait for the copy to complete
        while channel.wait().await.is_some() {}

        Ok(())
    }

    pub async fn start_script(&self) -> Result<()> {
        let script_contents = include_str!("../../setup-script.sh");

        let remote_script_path = "~/setup-script.sh";

        self.upload_file(&script_contents, remote_script_path)
            .await?;

        // Now execute the script
        let shell_command = format!(
            "chmod +x {} && nohup {} > /dev/null 2>&1 &",
            remote_script_path, remote_script_path
        );
        info!("Running: {}", shell_command);
        let mut channel = self.open_channel().await?;

        // Start execution but don't wait for it
        let _ = tokio::spawn(async move {
            if let Err(e) = SSH::exec_and_print_output_static(&mut channel, shell_command).await {
                error!("Error executing script: {}", e);
            }
        });
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

        Ok(())
    }

    // Static version that doesn't need &self
    async fn exec_and_print_output_static(
        channel: &mut Channel<client::Msg>,
        command: String,
    ) -> Result<()> {
        channel.exec(true, command).await?;

        while let Some(msg) = channel.wait().await {
            match msg {
                russh::ChannelMsg::Data { ref data } => {
                    info!("{}", String::from_utf8_lossy(data));
                }
                russh::ChannelMsg::ExtendedData { ref data, ext } => {
                    if ext == 1 {
                        info!("{}", String::from_utf8_lossy(data));
                    }
                }
                russh::ChannelMsg::ExitStatus { exit_status } => {
                    info!("Exit status: {}", exit_status);
                }
                _ => {}
            }
        }

        Ok(())
    }

    pub async fn close(&self) -> Result<()> {
        self.client
            .lock()
            .await
            .disconnect(Disconnect::ByApplication, "", "English")
            .await?;
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
                                        error!("Error creating channel: {}", e);
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

    async fn check_server_key(
        self,
        _server_public_key: &russh_keys::key::PublicKey,
    ) -> Result<(Self, bool), Self::Error> {
        Ok((self, true))
    }
}
