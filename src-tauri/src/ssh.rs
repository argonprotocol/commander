use crate::utils::Utils;
use anyhow::Result;
use async_trait::async_trait;
use log::{error, info};
use rand::rngs::OsRng;
use russh::client::{AuthResult, Msg};
use russh::keys::ssh_key::LineEnding;
use russh::keys::*;
use russh::*;
use std::fmt::Display;
use std::future::Future;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};
use std::time::Duration;
use tokio::fs::File;
use tokio::io::{AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::runtime::Handle;
use tokio::sync::Mutex;
use tokio::time::timeout;

#[derive(Clone)]
pub struct SSH {
    client: Arc<Mutex<client::Handle<ClientHandler>>>,
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

    pub fn host(&self) -> String {
        format!("{}:{}", self.addrs.0, self.addrs.1)
    }
}

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
    pub async fn connect(config: &SSHConfig, timeout_duration: Duration) -> Result<Self> {
        let client = timeout(timeout_duration, Self::authenticate(config)).await
            .map_err(|_| anyhow::anyhow!("SSH connection timed out after {:?}", timeout_duration))??;
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
        info!("Executing ssh command: {}", command);
        let shell_command = format!("bash -c '{}'", command);
        let mut channel = self.open_channel().await?;
        channel.exec(true, shell_command).await?;
        channel.eof().await?;

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
                russh::ChannelMsg::ExtendedData { ref data, ext } => {
                    if ext == 1 {
                        // 1 is stderr
                        output.push_str(&String::from_utf8_lossy(data));
                    }
                }
                // The command has returned an exit code
                russh::ChannelMsg::ExitStatus { exit_status } => {
                    code = Some(exit_status);
                }
                _ => {}
            }
        }
        let _ = channel.close().await;
        let code = code.ok_or_else(|| anyhow::anyhow!("SSHCommandMissingExitStatus"))?;

        Ok((output, code))
    }

    pub async fn upload_file(&self, contents: &[u8], remote_path: &str) -> Result<()> {
        // First, create the script in the remote server's home directory
        info!("Uploading file {}", remote_path);
        let mut channel = self.open_channel().await?;
        let scp_command = format!("cat > {}", remote_path);
        channel.exec(true, scp_command).await?;

        // Write the contents of the setup script
        channel.data(contents).await?;
        channel.eof().await?;

        // Wait for the copy to complete
        while channel.wait().await.is_some() {}

        Ok(())
    }

    pub async fn upload_embedded_file(
        &self,
        app: &AppHandle,
        file_name: &str,
        remote_path: &str,
        event_progress_key: String,
    ) -> Result<()> {
        let path = Utils::get_embedded_path(app, file_name)?;
        let file = File::open(&path).await?;

        // ensure old file is removed
        let _ = self.run_command(format!("rm -f {}", remote_path)).await;

        let mut channel = self.open_channel().await?;
        channel.exec(true, format!("cat > {}", remote_path)).await?;
        let mut writer = channel.make_writer();

        let file_size = file.metadata().await?.len();
        let mut reader = BufReader::new(file);
        let mut buffer = [0u8; 8192];
        let mut total = 0;

        let mut last_percent = -1;
        loop {
            let n = reader.read(&mut buffer).await?;
            if n == 0 {
                break;
            }
            writer.write_all(&buffer[..n]).await?;
            total += n as u64;
            let percent = (total * 100 / file_size) as i32;
            if percent != last_percent {
                last_percent = percent;
                info!("Uploading {}: {}%", file_name, percent);
                app.emit(&event_progress_key, percent)?;
            }
        }

        app.emit(&event_progress_key, 100)?;
        writer.shutdown().await?;
        channel.eof().await?;
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
