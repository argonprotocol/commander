use anyhow::Result;
use crate::ssh::{SSH, SSHDropGuard};
use crate::config::{Config, ServerConnection};
use crate::bidder_stats::BidderStats;
use tauri::{AppHandle, Emitter};
use std::sync::{Arc, Mutex};
use lazy_static::lazy_static;
use tokio::sync::Mutex as TokioMutex;
use std::path::PathBuf;

lazy_static! {
    static ref RUNNING_TASK: Mutex<Option<tokio::task::JoinHandle<()>>> = Mutex::new(None);
}
pub struct Bidder;

impl Bidder {
    pub async fn start(
        app: AppHandle,
        ssh_private_key: String,
        username: String, 
        host: String, 
        port: u16, 
        wallet_json: String,
        session_mnemonic: String,
    ) -> Result<()> {
        let mut ssh = SSH::connect(&ssh_private_key, &username, &host, port).await?;

        Self::upload_files(&mut ssh, wallet_json, session_mnemonic).await?;
        Self::start_docker(&mut ssh).await?;

        let mut server_connection = ServerConnection::load().unwrap();
        server_connection.is_ready_for_mining = true;
        server_connection.save().unwrap();
        
        Self::monitor(app, ssh).await?;

        Ok(())
    }

    pub async fn reconnect(
        ssh_private_key: String,
        username: String, 
        host: String, 
        port: u16, 
        app: AppHandle
    ) -> Result<()> {
        let mut ssh = SSH::connect(&ssh_private_key, &username, &host, port).await?;

        Self::monitor(app, ssh).await?;

        Ok(())
    }

    async fn upload_files(ssh: &mut SSH, wallet_json: String, session_mnemonic: String) -> Result<()> {
        let bidding_rules = Config::load_from_file("biddingRules.json").unwrap();
        let security_env = format!("SESSION_KEYS_MNEMONIC=\"{}\"\nKEYPAIR_PASSPHRASE=", session_mnemonic);

        ssh.run_command("mkdir -p commander-config").await?;
        ssh.upload_file(&wallet_json, "commander-config/wallet.json").await?;
        ssh.upload_file(&bidding_rules, "commander-config/biddingRules.json").await?;
        ssh.upload_file(&security_env, "commander-config/security.env").await?;

        ssh.run_command("mkdir -p commander-config/bidding-calculator").await?;
        let local_base_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap()
            .join("src/lib/bidding-calculator");
        let filenames = match std::fs::read_dir(&local_base_path) {
            Ok(entries) => entries
                .filter_map(|entry| entry.ok())
                .filter(|entry| entry.path().is_file())
                .map(|entry| entry.file_name().to_string_lossy().into_owned())
                .collect::<Vec<String>>()
                .join(" "),
            Err(e) => {
                return Err(e.into());
            }
        };
        println!("Calculator files: {}", filenames);

        for file in filenames.split_whitespace() {
            let local_file_path = format!("{}/{}", local_base_path.display(), file);
            let remote_file_path = format!("commander-config/bidding-calculator/{}", file);
            let script_contents = match std::fs::read_to_string(&local_file_path) {
                Ok(contents) => contents,
                Err(e) => {
                    return Err(e.into());
                }
            };
    
            ssh.upload_file(&script_contents, remote_file_path.as_str()).await?;
        }

        Ok(())
    }

    pub async fn start_docker(ssh: &mut SSH) -> Result<()> {
        ssh.run_command("cd commander-deploy && docker compose down bot").await?;
        ssh.run_command("cd commander-deploy && docker compose --env-file=.env.testnet up -d bot").await?;
        Ok(())
    }

    pub async fn monitor(
        app: AppHandle,
        mut ssh: SSH,
    ) -> Result<()> {
        if let Some(handle) = RUNNING_TASK.lock().unwrap().take() {
            handle.abort();
        }

        println!("Creating HTTP tunnel");
        let local_port = SSH::find_available_port(3600).await?;
        let remote_host = "127.0.0.1";
        let remote_port = 3000;
        ssh.create_http_tunnel(local_port, remote_host, remote_port).await?;

        let ssh = Arc::new(TokioMutex::new(ssh));
        let ssh_clone = ssh.clone();
        let _guard = SSHDropGuard(ssh_clone.clone());

        let handle = tokio::spawn(async move {
            let mut ssh = ssh_clone.lock().await;
            let mut bidder_stats = BidderStats::new(app, &mut ssh, local_port);
            loop {
                if let Err(e) = bidder_stats.run().await {
                    eprintln!("Error in bidder stats: {}", e);
                }
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            }
        });

        *RUNNING_TASK.lock().unwrap() = Some(handle);
        Ok(())
    }
}

