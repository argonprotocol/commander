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
use tokio::runtime::Handle;
use tokio::sync::Mutex;

pub mod singleton;

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
        let code = code.ok_or_else(|| {
            anyhow::anyhow!("SSHCommandMissingExitStatus")
        })?;

        Ok((output, code))
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
