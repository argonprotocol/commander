use std::sync::Arc;
use std::time::Duration;
use async_trait::async_trait;
use anyhow::Result;
use russh_keys::*;
use russh::*;
use ssh_key::{PrivateKey, PublicKey, Algorithm, LineEnding};
use rand::rngs::OsRng;

pub struct SSH {
    client: client::Handle<ClientHandler>,
}

// Explicitly implement Send for SSH
unsafe impl Send for SSH {}

impl SSH {
    pub async fn connect(private_key: &str, mut username: &str, host: &str, port: u16) -> Result<Self> {
        let key_pair = decode_secret_key(private_key, None)?;
        let addrs = (host, port);
        if username.is_empty() {
            username = "root";
        }

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

        let mut client = client::connect(config, addrs, handler).await?;
        // use publickey authentication, with or without certificate
        let auth_res = client
            .authenticate_publickey(
                username,
                Arc::new(key_pair)
            )
            .await?;

        if !auth_res {
            anyhow::bail!("Authentication (with publickey) failed");
        }

        Ok(SSH { client })
    }

    pub async fn run_command(&mut self, command: &str) -> Result<(String, u32)> {
        let shell_command = format!("bash -c '{}'", command);
        println!("Executing shell command: {}", shell_command);
        let mut channel = self.client.channel_open_session().await?;
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
                    if ext == 1 { // 1 is stderr
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
        Ok((output, code.expect("program did not exit cleanly")))
    }

    pub async fn upload_file(&mut self, contents: &str, remote_path: &str) -> Result<()> {
        // First, create the script in the remote server's home directory
        let mut channel = self.client.channel_open_session().await?;
        let scp_command = format!("cat > {}", remote_path);
        channel.exec(true, scp_command).await?;

        println!("Creating remote file {}", remote_path);

        // Write the contents of the setup script        
        channel.data(contents.as_bytes()).await?;
        channel.eof().await?;

        // Wait for the copy to complete
        while let Some(_) = channel.wait().await {}

        Ok(())
    }
    
    pub async fn start_script(&mut self, relative_script_path: &str) -> Result<()> {
        let local_script_path = format!("{}/{}", env!("CARGO_MANIFEST_DIR"), relative_script_path);

        let script_contents = match std::fs::read_to_string(&local_script_path) {
            Ok(contents) => contents,
            Err(_) => {
                anyhow::bail!("Failed to read setup script");
            }
        };

        let remote_script_path = format!("~/{}", relative_script_path);
        
        self.upload_file(&script_contents, &remote_script_path).await?;

        // Now execute the script
        let shell_command = format!("chmod +x {} && nohup {} > /dev/null 2>&1 &", remote_script_path, remote_script_path);
        println!("Running: {}", shell_command);
        let mut channel = self.client.channel_open_session().await?;
        
        // Start execution but don't wait for it
        let _ = tokio::spawn(async move {
            if let Err(e) = SSH::exec_and_print_output_static(&mut channel, shell_command).await {
                eprintln!("Error executing script: {}", e);
            }
        });
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

        Ok(())
    }

    // Static version that doesn't need &mut self
    async fn exec_and_print_output_static(channel: &mut Channel<client::Msg>, command: String) -> Result<()> {
        channel.exec(true, command).await?;
        
        while let Some(msg) = channel.wait().await {
            match msg {
                russh::ChannelMsg::Data { ref data } => {
                    println!("{}", String::from_utf8_lossy(data));
                }
                russh::ChannelMsg::ExtendedData { ref data, ext } => {
                    if ext == 1 {
                        println!("{}", String::from_utf8_lossy(data));
                    }
                }
                russh::ChannelMsg::ExitStatus { exit_status } => {
                    println!("Exit status: {}", exit_status);
                }
                _ => {}
            }
        }

        Ok(())
    }
    
    pub async fn close(&mut self) -> Result<()> {
        self.client
            .disconnect(Disconnect::ByApplication, "", "English")
            .await?;
        Ok(())
    }

    pub fn generate_keys() -> Result<(String, String), String> {
        // Generate a new key pair using Ed25519
        let private_key = PrivateKey::random(&mut OsRng, Algorithm::Ed25519)
            .map_err(|e| e.to_string())?;
        
        // Derive the public key from the private key
        let public_key = PublicKey::from(&private_key);
        
        // Convert to OpenSSH format
        let public_key_openssh = public_key.to_openssh()
            .map_err(|e| e.to_string())?;
                
        // Convert private key to OpenSSH format
        let private_key_openssh = private_key.to_openssh(LineEnding::LF)
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

    async fn check_server_key(
        self,
        _server_public_key: &russh_keys::key::PublicKey,
    ) -> Result<(Self, bool), Self::Error> {
        Ok((self, true))
    }
}

