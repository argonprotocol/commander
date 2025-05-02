use crate::bidder::stats::BidderStats;
use crate::config::{Config, ServerConnection};
use crate::ssh::{SSHDropGuard, SSH};
use anyhow::Result;
use lazy_static::lazy_static;
use log::{error, info};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use tokio::sync::Mutex as TokioMutex;

pub mod stats;

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

        Self::upload_files(&app, &mut ssh, wallet_json, session_mnemonic).await?;
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
        app: AppHandle,
    ) -> Result<()> {
        let ssh = SSH::connect(&ssh_private_key, &username, &host, port).await?;

        Self::monitor(app, ssh).await?;

        Ok(())
    }

    pub fn get_bidding_calculator_path(app: &AppHandle) -> Result<PathBuf> {
        let local_base_path = app
            .path()
            .resolve("../src/lib/bidding-calculator", BaseDirectory::Resource)?;
        Ok(local_base_path)
    }

    pub fn get_calculator_files(path: &PathBuf) -> Result<Vec<String>> {
        let dir = std::fs::read_dir(&path)?;
        let files = dir
            .filter_map(|entry| entry.ok())
            .filter(|entry| entry.path().is_file())
            .map(|entry| entry.file_name().to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        Ok(files)
    }

    async fn upload_files(
        app: &AppHandle,
        ssh: &mut SSH,
        wallet_json: String,
        session_mnemonic: String,
    ) -> Result<()> {
        let bidding_rules = Config::load_from_file("biddingRules.json").unwrap();
        let security_env = format!(
            "SESSION_KEYS_MNEMONIC=\"{}\"\nKEYPAIR_PASSPHRASE=",
            session_mnemonic
        );

        ssh.run_command("mkdir -p commander-config").await?;
        ssh.upload_file(&wallet_json, "commander-config/wallet.json")
            .await?;
        ssh.upload_file(&bidding_rules, "commander-config/biddingRules.json")
            .await?;
        ssh.upload_file(&security_env, "commander-config/security.env")
            .await?;

        ssh.run_command("mkdir -p commander-config/bidding-calculator")
            .await?;
        let local_base_path = Self::get_bidding_calculator_path(app)?;
        let filenames = Self::get_calculator_files(&local_base_path)?;
        info!("Calculator files: {:?}", filenames);

        for file in filenames {
            let local_file_path = format!("{}/{}", local_base_path.display(), file);
            let remote_file_path = format!("commander-config/bidding-calculator/{}", file);
            let script_contents = match std::fs::read_to_string(&local_file_path) {
                Ok(contents) => contents,
                Err(e) => {
                    return Err(e.into());
                }
            };

            ssh.upload_file(&script_contents, remote_file_path.as_str())
                .await?;
        }

        Ok(())
    }

    pub async fn start_docker(ssh: &mut SSH) -> Result<()> {
        ssh.run_command("cd commander-deploy && docker compose down bot")
            .await?;
        ssh.run_command("cd commander-deploy && docker compose --env-file=.env.testnet up -d bot")
            .await?;
        Ok(())
    }

    pub async fn monitor(app: AppHandle, mut ssh: SSH) -> Result<()> {
        if let Some(handle) = RUNNING_TASK.lock().unwrap().take() {
            handle.abort();
        }

        info!("Creating HTTP tunnel");
        let local_port = SSH::find_available_port(3600).await?;
        let remote_host = "127.0.0.1";
        let remote_port = 3000;
        ssh.create_http_tunnel(local_port, remote_host, remote_port)
            .await?;

        let ssh = Arc::new(TokioMutex::new(ssh));
        let ssh_clone = ssh.clone();
        let _guard = SSHDropGuard(ssh_clone.clone());

        let handle = tokio::spawn(async move {
            let mut ssh = ssh_clone.lock().await;
            let mut bidder_stats = BidderStats::new(app, &mut ssh, local_port);
            loop {
                if let Err(e) = bidder_stats.run().await {
                    error!("Error in bidder stats: {}", e);
                }
                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            }
        });

        *RUNNING_TASK.lock().unwrap() = Some(handle);
        Ok(())
    }
}
