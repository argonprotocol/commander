use std::sync::Arc;
use std::time::Duration;
use async_trait::async_trait;
use anyhow::Result;
use russh_keys::*;
use russh::*;
use ssh_key::{PrivateKey, PublicKey, Algorithm, LineEnding};
use rand::rngs::OsRng;
use tokio::sync::Mutex as TokioMutex;
use tokio::runtime::Handle;
use tokio::io::{AsyncReadExt, AsyncWriteExt};

pub struct SSH {
    client: Arc<client::Handle<ClientHandler>>,
}

// Explicitly implement Send for SSH
unsafe impl Send for SSH {}

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

        Ok(SSH { client: Arc::new(client) })
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

    pub async fn create_http_tunnel(&mut self, local_port: u16, remote_host: &str, remote_port: u16) -> Result<()> {
        println!("Opening tunnel from local port {} to {}:{}", local_port, remote_host, remote_port);
        
        // Create a TCP listener on the local port
        let listener = tokio::net::TcpListener::bind(format!("127.0.0.1:{}", local_port)).await?;
        println!("TCP listener created on port {}", local_port);

        // Clone the client handle and remote host for use in the spawned task
        let client = Arc::clone(&self.client);
        let remote_host = remote_host.to_string();

        // Accept connections and forward them through the SSH tunnel
        tokio::spawn(async move {
            loop {
                match listener.accept().await {
                    Ok((local_stream, _)) => {
                        
                        // Clone the client handle for this connection
                        let client = Arc::clone(&client);
                        let remote_host = remote_host.clone();
                        
                        // Spawn a new task for each connection
                        tokio::spawn(async move {
                            // Create a new SSH channel for this connection
                            let mut channel = match client.channel_open_direct_tcpip(
                                &remote_host,
                                remote_port as u32,
                                "127.0.0.1",
                                local_port as u32
                            ).await {
                                Ok(channel) => channel,
                                Err(e) => {
                                    println!("Error creating SSH channel: {}", e);
                                    return;
                                }
                            };

                            // Split the local stream
                            let (mut local_read, mut local_write) = local_stream.into_split();

                            // Single task to handle both directions
                            let tunnel_task = async move {
                                let mut buf = vec![0u8; 4096];
                                let mut done = false;

                                while !done {
                                    tokio::select! {
                                        // Handle local to remote
                                        result = local_read.read(&mut buf) => {
                                            match result {
                                                Ok(0) => {
                                                    done = true;
                                                }
                                                Ok(n) => {
                                                    if let Err(e) = channel.data(&buf[..n]).await {
                                                        println!("Error writing to remote: {}", e);
                                                        done = true;
                                                    }
                                                }
                                                Err(e) => {
                                                    println!("Error reading from local: {}", e);
                                                    done = true;
                                                }
                                            }
                                        }
                                        // Handle remote to local
                                        msg = channel.wait() => {
                                            match msg {
                                                Some(russh::ChannelMsg::Data { data }) => {
                                                    if let Err(e) = local_write.write_all(&data).await {
                                                        println!("Error writing to local: {}", e);
                                                        done = true;
                                                    }
                                                }
                                                Some(russh::ChannelMsg::Eof) => {
                                                    println!("Remote end closed connection");
                                                    done = true;
                                                }
                                                Some(russh::ChannelMsg::Close) => {
                                                    println!("Channel closed by remote");
                                                    done = true;
                                                }
                                                None => {
                                                    println!("Channel closed");
                                                    done = true;
                                                }
                                                _ => {}
                                            }
                                        }
                                    }
                                }
                            };

                            // Run the tunnel task
                            tunnel_task.await;
                            println!("Connection closed");
                        });
                    }
                    Err(e) => {
                        println!("Error accepting connection: {}", e);
                        break;
                    }
                }
            }
            println!("Tunnel connection handler ended");
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

pub struct SSHDropGuard(pub Arc<TokioMutex<SSH>>);

impl Drop for SSHDropGuard {
    fn drop(&mut self) {
        if let Ok(handle) = Handle::try_current() {
            let ssh_clone = self.0.clone();
            handle.spawn(async move {
                if let Ok(mut guard) = ssh_clone.try_lock() {
                    if let Err(e) = guard.close().await {
                        println!("Error closing SSH connection during cleanup: {}", e);
                    }
                }
            });
        } else {
            println!("Warning: Could not close SSH connection during cleanup - no runtime available");
        }
    }
}