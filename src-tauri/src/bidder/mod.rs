use crate::bidder::stats::BidderStats;
use crate::config::{Config, BiddingRules, ConfigFile, ServerConnection, Security};
use crate::ssh::{SSHConfig, SSH};
use anyhow::{anyhow, Result};
use lazy_static::lazy_static;
use log::{error, info};
use semver::Version;
use std::env;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use tauri::{AppHandle, Emitter};

pub mod stats;

lazy_static! {
    static ref RUNNING_TASK: Mutex<Option<tokio::task::JoinHandle<()>>> = Mutex::new(None);
}
pub struct Bidder;

impl Bidder {
    pub async fn try_start(
        app: AppHandle,
        sshconfig: SSHConfig,
    ) -> Result<()> {
        let server_connection = ServerConnection::load()?;
        let is_ready_for_bidding = server_connection.is_provisioned && server_connection.is_ready_for_mining;

        if !is_ready_for_bidding {
            info!("Server is not ready for mining, skipping Bidder");
            return Ok(());
        }

        let ssh = SSH::connect(sshconfig).await?;

        Self::update_bot_if_needed(&app, &ssh).await?;
        Self::monitor_stats(app, ssh).await?;

        Ok(())
    }

    pub async fn update_bot_if_needed(app: &AppHandle, ssh: &SSH) -> Result<()> {
        if Self::needs_new_bot_version(ssh, app).await? {
            info!("Uploading core files");
            Self::upload_core_files(&app, &ssh).await?;
            info!("Uploading bot");
            ssh.upload_directory(app, "bot", "commander-config").await?;
            info!("Starting docker");
            Self::start_docker(ssh).await?;
        } else {
            info!("Starting docker");
            Self::start_docker(&ssh).await?;
        }
        Ok(())
    }

    async fn needs_new_bot_version(ssh: &SSH, app: &AppHandle) -> Result<bool> {
        let remote_version = match ssh
            .run_command("cat commander-config/bot/package.json")
            .await
        {
            Ok((output, code)) => {
                if code != 0 {
                    info!("Remote bot version does not exist: {}", code);
                    return Ok(true);
                }
                output
            }
            Err(e) => {
                info!("Remote bot version does not exist: {}", e);
                return Ok(true);
            }
        };

        let embedded_path = Config::get_embedded_path(&app, &PathBuf::from("bot"))?;
        let package_json = std::fs::read_to_string(&embedded_path.join("package.json"))?;
        Self::is_package_json_newer(package_json, remote_version)
    }

    pub fn get_bidding_calculator_path(app: &AppHandle) -> Result<PathBuf> {
        crate::Config::get_embedded_path(app, &PathBuf::from("bidding-calculator/src"))
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

    async fn upload_core_files(
        app: &AppHandle,
        ssh: &SSH
    ) -> Result<()> {
        let security = Security::load()?.ok_or(anyhow!("Failed to load security config"))?;
        let bidding_rules_str = BiddingRules::load_raw()?.ok_or(anyhow!("Bidding rules not found"))?;
        let server_connection = ServerConnection::load().unwrap();
        
        let env_security = format!(
            "SESSION_KEYS_MNEMONIC=\"{}\"\nKEYPAIR_PASSPHRASE=",
            security.session_mnemonic
        );
        
        let env_state = format!(
            "OLDEST_FRAME_ID_TO_SYNC={}\n",
            server_connection.oldest_frame_id_to_sync.map_or("".to_string(), |id| id.to_string())
        );

        ssh.run_command("mkdir -p commander-config").await?;
        ssh.upload_file(&security.wallet_json, "commander-config/wallet.json")
            .await?;
        ssh.upload_file(&bidding_rules_str, "commander-config/biddingRules.json")
            .await?;
        ssh.upload_file(&env_security, "commander-config/.env.security")
            .await?;
        ssh.upload_file(&env_state, "commander-config/.env.state")
            .await?;

        ssh.run_command("mkdir -p commander-config/bidding-calculator")
            .await?;

        ssh.upload_directory(app, "bidding-calculator/src", "commander-config")
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

    async fn monitor_stats(app: AppHandle, ssh: SSH) -> Result<()> {
        if let Some(_handle) = RUNNING_TASK.lock().unwrap().take() {
            return Ok(());
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
            let mut bidder_stats = BidderStats::new(app.clone(), arc_ssh.clone(), local_port);
            let mut error_count = 0;
            loop {
                if let Err(e) = bidder_stats.run().await {
                    error_count += 1;
                    if error_count > 3 {
                        error!("Error in bidder stats, too many retries: {}", e);
                        if let Err(e) = app.emit("FatalServerError", ()) {
                            error!("Error sending FatalServerError: {}", e);
                        }
                        break;
                    } else {
                        error!("Error in bidder stats, retrying: {}", e);
                    }
                } else {
                    error_count = 0;
                }
                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            }
        });

        *RUNNING_TASK.lock().unwrap() = Some(handle);
        Ok(())
    }
}
