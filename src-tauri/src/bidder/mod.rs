use crate::bidder::stats::BidderStats;
use crate::config::{Config, ServerConnection};
use crate::ssh::SSH;
use anyhow::Result;
use lazy_static::lazy_static;
use log::{error, info};
use semver::Version;
use std::env;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::AppHandle;

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
        let ssh = SSH::connect(&ssh_private_key, &username, &host, port).await?;

        Self::upload_files(&app, &ssh, wallet_json, session_mnemonic).await?;
        Self::update_bot_if_needed(&app, &ssh).await?;
        Self::start_docker(&ssh).await?;

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

    pub async fn update_bot_if_needed(app: &AppHandle, ssh: &SSH) -> Result<()> {
        if Self::needs_new_bot_version(ssh, app).await? {
            ssh.upload_directory(app, "bot".into()).await?;
            ssh.upload_directory(app, "bot/src".into()).await?;
            Self::start_docker(ssh).await?;
        }
        Ok(())
    }

    async fn needs_new_bot_version(ssh: &SSH, app: &AppHandle) -> Result<bool> {
        let embedded_path = Config::get_embedded_path(&app, &PathBuf::from("bot"))?;
        let package_json = std::fs::read_to_string(&embedded_path.join("package.json"))?;
        let remote_version = match ssh
            .run_command("cat commander-config/bot/package.json")
            .await
        {
            Ok((output, _)) => output,
            Err(e) => {
                error!("Error fetching remote version: {}", e);
                return Ok(true);
            }
        };

        Self::is_package_json_newer(package_json, remote_version)
    }

    pub fn get_bidding_calculator_path(app: &AppHandle) -> Result<PathBuf> {
        crate::Config::get_embedded_path(app,  &PathBuf::from("bidding-calculator/src"))
    }

    fn is_package_json_newer(
        local_package_json: String,
        remote_package_json: String,
    ) -> Result<bool> {
        let package_json: serde_json::Value = serde_json::from_str(&local_package_json)?;

        let version = package_json
            .get("version")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Version not found in package.json"))?;

        let remote_package_json: serde_json::Value = serde_json::from_str(&remote_package_json)?;
        let remote_version = remote_package_json
            .get("version")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Version not found in remote package.json"))?;

        let local_version = Version::parse(version)?;
        let remote_version = Version::parse(remote_version)?;
        if local_version > remote_version {
            info!(
                "Local version {} is newer than remote version {}",
                local_version, remote_version
            );
            return Ok(true);
        }
        Ok(false)
    }

    async fn upload_files(
        app: &AppHandle,
        ssh: &SSH,
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

        ssh.upload_directory(app, "bidding-calculator/src".into())
            .await?;

        Ok(())
    }

    pub async fn start_docker(ssh: &SSH) -> Result<()> {
        let env_file = if env::var("CHAIN").unwrap_or_default() == "testnet" {
            ".env.testnet"
        } else {
            ".env"
        };
        ssh.run_command(&format!(
            "cd commander-deploy && docker compose --env-file={env_file} up -d bot"
        ))
        .await?;
        Ok(())
    }

    pub async fn monitor(app: AppHandle, ssh: SSH) -> Result<()> {
        if let Some(handle) = RUNNING_TASK.lock().unwrap().take() {
            handle.abort();
        }

        info!("Creating HTTP tunnel");
        let local_port = SSH::find_available_port(3600).await?;
        let remote_host = "127.0.0.1";
        let remote_port = 3000;

        let arc_ssh = Arc::new(ssh);
        arc_ssh
            .clone()
            .create_http_tunnel(local_port, remote_host, remote_port)
            .await?;

        let handle = tokio::spawn(async move {
            let mut bidder_stats = BidderStats::new(app, arc_ssh.clone(), local_port);
            loop {
                if let Err(e) = bidder_stats.run().await {
                    error!("Error in bidder stats: {}", e);
                    let _ = arc_ssh
                        .clone()
                        .create_http_tunnel(local_port, remote_host, remote_port)
                        .await
                        .inspect_err(|e| error!("Error in bidder stats: {}", e));
                }
                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            }
        });

        *RUNNING_TASK.lock().unwrap() = Some(handle);
        Ok(())
    }
}
