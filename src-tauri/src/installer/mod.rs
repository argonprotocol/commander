use crate::config::{ConfigFile, ServerDetails, InstallStatus, Security, BiddingRules, InstallStatusErrorType, InstallStatusClient};
use crate::ssh::{SSH, SSHConfig};
use crate::ssh::singleton::*;
use crate::utils::Utils;
use anyhow::Result;
use log::{error, info};
use std::env;
use tauri::AppHandle;
use lazy_static::lazy_static;
use std::sync::Mutex;
use std::path::Path;

pub mod status;
pub use status::InstallerStatus;

lazy_static! {
    static ref IS_RUNNING_INSTALL: Mutex<Option<tokio::task::JoinHandle<()>>> = Mutex::new(None);
}

const CORE_DIRS: [&'static str; 4] = ["deploy", "bot", "calculator", "scripts"];

pub struct Installer {}

impl Installer {
    pub async fn install_if_needed(app: &AppHandle, should_bypass_upgrade_check: bool) -> Result<()> {
        let mut server_details = ServerDetails::load()?;
        if !server_details.is_connected {
            info!("Server is not connected, skipping Installer");
            return Ok(());
        }

        let ssh = get_ssh_connection(server_details.ssh_config()?).await?;

        // If the install process is already running, we don't need to start it again.
        let install_process_is_running = Installer::is_install_running(&ssh).await?;
        if install_process_is_running {
            info!("Install process is already running, skipping Installer");
            server_details.is_installing = true;
            server_details.save()?;
            return Ok(());
        }

        // We will begin by running through a series of checks to determine if the install process
        // should be started. We don't use server_details.is_installing because the local value could
        // be out of date with the server.
        let (install_status, is_partially_installed, has_completed_install) 
            = Self::check_install(&ssh).await?;
        if has_completed_install {
            info!("Server is up-to-date, skipping Installer");
            server_details.requires_upgrade = false;
            server_details.is_installing = false;
            server_details.save()?;
            return Ok(());
        }

        let local_files_are_valid = Self::local_files_match_local_shumas(&app)?;
        if !local_files_are_valid {
            info!("Local shasums are not accurate, skipping Installer");
            return Ok(());
        }

        info!("is_partially_installed = {}, should_bypass_upgrade_check = {}, is_new_server = {}", 
            is_partially_installed, 
            should_bypass_upgrade_check, 
            server_details.is_new_server
        );
        
        let has_started_install = server_details.is_installing;
        let needs_explicit_upgrade_approval = !has_started_install && !is_partially_installed && !should_bypass_upgrade_check && !server_details.is_new_server;
        if needs_explicit_upgrade_approval {
            info!("Server is not new so upgrade requires user approval, skipping Installer");
            server_details.requires_upgrade = true;
            server_details.save()?;
            return Ok(());
        }

        // At this point we know the server is either brand new or has not completed its install. We will postpone
        // if there is an error, otherwise we start the install process.
        server_details.requires_upgrade = false;
        server_details.is_installing = true;
        server_details.save()?;

        if !is_partially_installed {
            let mut install_status = install_status.clone();
            install_status.client = InstallStatusClient::default();
            install_status.save()?;
        }

        let has_install_error = InstallerStatus::has_error(&install_status.server);
        if has_install_error {
            info!("Server has error, exiting Installer: {:?}", install_status.server);
            return Ok(());
        }

        info!("Starting install process");
        Self::launch_install_thread(&app, ssh.config.clone()).await?;

        Ok(())
    }

    pub async fn retry_failed_step(
        app: &AppHandle,
        step_key: String,
    ) -> Result<()> {
        let server_details = ServerDetails::load()?;
        let ssh = get_ssh_connection(server_details.ssh_config()?).await?;

        let script_is_running = Self::is_install_running(&ssh).await?;
        if script_is_running {
            return Ok(());
        }

        Self::clear_step_files(&ssh, step_key).await?;
        Self::install_if_needed(&app, true).await?;

        Ok(())
    }

    pub async fn update_bidding_bot(should_always_restart: bool) -> Result<()> {
        let server_details: ServerDetails = ServerDetails::load()?;
        let ssh = get_ssh_connection(server_details.ssh_config()?).await?;

        Self::upload_bot_config_files(&ssh).await?;

        if server_details.is_ready_for_mining || should_always_restart {
            Self::restart_bot_docker(&ssh).await?;
        }

        Ok(())
    }

    pub async fn test_server_connection(ssh_config: SSHConfig) -> Result<()> {
        let ssh = get_ssh_connection(ssh_config).await?;
        ssh.run_command("echo 'test'").await?;
        Ok(())
    }

    pub async fn shutdown_server() -> Result<()> {
        let server_details = ServerDetails::load()?;
        let ssh = get_ssh_connection(server_details.ssh_config()?).await?;

        Installer::stop_all_dockers(&ssh).await?;
        InstallStatus::delete()?;
        Ok(())
    }

    pub async fn is_install_running(ssh: &SSH) -> Result<bool> {
        if let Some(_handle) = IS_RUNNING_INSTALL.lock().unwrap().as_ref() {
            info!("Install process IS running locally");
            return Ok(true);
        } else {
            info!("Install process is NOT running locally");
        }

        match ssh.run_command(&format!("pgrep -f ~/scripts/install_server.sh")).await {
            Ok((pid, _)) => {
                let is_running = !pid.trim().is_empty();
                info!("Install process {} running remotely", if is_running { "IS" } else { "is NOT" });
                return Ok(is_running);
            }
            Err(_) => {
                info!("Install process is NOT running remotely");
                return Ok(false);
            }
        }
    }

    ////////////////////////////////////////////////////////////
    /// PRIVATE FUNCTIONS
    ////////////////////////////////////////////////////////////

    async fn check_install(ssh: &SSH) -> Result<(InstallStatus, bool, bool)> {
        let install_status = InstallStatus::load()?;
        let is_partially_installed = InstallerStatus::has_server_install_started(&install_status.server);

        let is_new_server = Self::is_new_server(&ssh).await?;
        info!("Is new server = {}", is_new_server);
        if is_new_server {
            return Ok((install_status, is_partially_installed, false));
        }

        let remote_files_need_updating = !Self::remote_files_match_local_shasums(&ssh).await?;
        if remote_files_need_updating {
            return Ok((install_status, is_partially_installed, false));
        }

        let install_status = InstallerStatus::fetch_latest_install_status(&ssh, install_status).await?;
        let has_completed_install = InstallerStatus::is_server_install_complete(&install_status.server);
        let is_partially_installed = InstallerStatus::has_server_install_started(&install_status.server);

        Ok((install_status, is_partially_installed, has_completed_install))
    }

    async fn remote_files_match_local_shasums(ssh: &SSH) -> Result<bool> {
        let (remote_shasums, _code) = ssh.run_command("cat ~/SHASUMS256.final 2>/dev/null || true").await?;
        let local_shasums: &'static str = include_str!("../../../SHASUMS256");
        let remote_files_match_local_shasums = local_shasums == remote_shasums;
        info!("Remote files match local shusums = {}", remote_files_match_local_shasums);
        
        if !remote_files_match_local_shasums {
            info!("Remote shasums: {}", remote_shasums);
            info!("Local shasums: {}", local_shasums);
        }

        Ok(remote_files_match_local_shasums)
    }

    fn local_files_match_local_shumas(app: &AppHandle) -> Result<bool> {
        let local_shasums: &'static str = include_str!("../../../SHASUMS256");
        let mut dynamic_shasums = String::new();

        for dir_name in CORE_DIRS {
            let shasum = Utils::create_shasum(app, Path::new(dir_name))?;

            if !dynamic_shasums.is_empty() {
                dynamic_shasums.push('\n');
            }
            dynamic_shasums.push_str(&format!("{} {}", dir_name, shasum));
        }

        let local_trimmed = local_shasums.trim();
        let dynamic_trimmed = dynamic_shasums.trim();        
        let local_lines: Vec<&str> = local_trimmed.lines().collect();
        let dynamic_lines: Vec<&str> = dynamic_trimmed.lines().collect();
        
        for (i, (local, dynamic)) in local_lines.iter().zip(dynamic_lines.iter()).enumerate() {
            if local != dynamic {
                info!("Mismatch at line {}:", i + 1);
                info!("  Local:   {}", local);
                info!("  Dynamic: {}", dynamic);
            }
        }
        
        let shumas_match = local_trimmed == dynamic_trimmed;
        info!("Local files match local shasums = {}", shumas_match);

        Ok(shumas_match)
    }

    async fn launch_install_thread(app: &AppHandle, ssh_config: SSHConfig) -> Result<()> {
        info!("Running install thread");
        if let Some(_handle) = IS_RUNNING_INSTALL.lock().unwrap().take() {
            info!("Install thread already running, skipping");
            return Ok(());
        }

        let app = app.clone();
        let ssh = SSH::connect(ssh_config).await?;

        Self::upload_sha256(&ssh).await?;

        let handle = tokio::spawn(async move {
            let mut error_message: String = "".to_string();

            let result = async {
                Self::upload_core_files(&ssh, &app).await?;
                Self::upload_bot_config_files(&ssh).await?;
                Self::start_install_script(&ssh).await?;
                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                
                let install_status_server = InstallerStatus::fetch(&ssh).await?;
                info!("install_status_server = {:?}", install_status_server);
                Ok::<(), anyhow::Error>(())
            }.await;

            if let Err(e) = result {
                error_message = format!("Installation failed: {}", e);
            }

            if !error_message.is_empty() {
                match InstallStatus::load() {
                    Ok(mut install_status) => {
                        let mut status_server = install_status.server;
                        status_server.error_type = Some(InstallStatusErrorType::FileCheck);
                        status_server.error_message = Some(error_message);
                        install_status.server = status_server;
                        if let Err(e) = install_status.save() {
                            error!("Failed to save install status: {}", e);
                        }
                    }
                    Err(e) => error!("Failed to load install status: {}", e),
                }
            }
            info!("Install thread finished");
            
            // Clear the running state when the thread completes
            let _ = IS_RUNNING_INSTALL.lock().unwrap().take();
        });

        let _ = IS_RUNNING_INSTALL.lock().unwrap().insert(handle);

        Ok(())
    }

    async fn upload_sha256(ssh: &SSH) -> Result<()> {
        let local_shasums: &'static str = include_str!("../../../SHASUMS256");
        ssh.upload_file(local_shasums, "~/SHASUMS256").await?;
        ssh.run_command("rm ~/SHASUMS256.final").await?;
        
        Ok(())
    }

    async fn upload_core_files(ssh: &SSH, app: &AppHandle) -> Result<()> {
        for local_dir in CORE_DIRS {
            let remote_dir: &str = &format!("~/{local_dir}");
            ssh.run_command(&format!("rm -rf {}", remote_dir)).await?;
            ssh.upload_directory(&app, local_dir, remote_dir)
                .await
                .map_err(|e| anyhow::anyhow!("Failed to upload {} directory to {}: {}", local_dir, remote_dir, e))?;
        }

        ssh.run_command("~/scripts/update_shasums.sh SHASUMS256.final").await?;

        Ok(())
    }

    async fn upload_bot_config_files(ssh: &SSH) -> Result<()> {
        let bidding_rules_str = BiddingRules::load_raw()?;

        if bidding_rules_str.is_none() {
            return Ok(());
        }

        let security = Security::load()?.ok_or(anyhow::anyhow!("Failed to load security config"))?;        
        let server_details = ServerDetails::load()?;

        let env_security = format!(
            "SESSION_KEYS_MNEMONIC=\"{}\"\nKEYPAIR_PASSPHRASE=",
            security.session_mnemonic
        );
        
        let env_state = format!(
            "OLDEST_FRAME_ID_TO_SYNC={}\nIS_READY_FOR_BIDDING={}\n",
            server_details.oldest_frame_id_to_sync.map_or("".to_string(), |id| id.to_string()),
            server_details.is_ready_for_mining
        );

        let files = [
            (&security.wallet_json, "~/config/wallet.json"),
            (bidding_rules_str.as_ref().unwrap(), "~/config/biddingRules.json"),
            (&env_security, "~/config/.env.security"),
            (&env_state, "~/config/.env.state"),
        ];

        ssh.run_command("mkdir -p config").await?;

        for (content, path) in files {
            ssh.upload_file(content, path)
                .await
                .map_err(|e| anyhow::anyhow!("Failed to upload file to {}: {}", path, e))?;
        }

        Ok(())
    }

    async fn stop_all_dockers(ssh: &SSH) -> Result<()> {
        Self::stop_mining_dockers(ssh).await?;
        Self::stop_bot_docker(ssh).await?;
        Ok(())
    }

    async fn stop_mining_dockers(ssh: &SSH) -> Result<()> {
        ssh.run_command("cd deploy && docker compose --profile miners down").await?;
        Ok(())
    }

    async fn restart_bot_docker(ssh: &SSH) -> Result<()> {
        Self::stop_bot_docker(&ssh).await?;
        Self::start_bot_docker(&ssh).await?;
        Ok(())
    }

    async fn stop_bot_docker(ssh: &SSH) -> Result<()> {
        ssh.run_command("cd deploy && docker compose down bot").await?;
        Ok(())
    }

    async fn start_bot_docker(ssh: &SSH) -> Result<()> {
        let env_file = Self::get_env_file();
        ssh.run_command(&format!(
            "cd deploy && docker compose --env-file={env_file} up bot -d"
        )).await?;
        Ok(())
    }
    
    fn get_env_file() -> String {
        let env_file = if env::var("CHAIN").unwrap_or_default() == "testnet" {
            ".env.testnet"
        } else {
            ".env"
        };
        env_file.to_string()
    }
    
    async fn clear_step_files(ssh: &SSH, step_key: String) -> Result<()> {
        if step_key == "all" {
            InstallStatus::delete()?;
            ssh.run_command("rm -rf ~/install-logs/*").await?;
        } else {
            let mut install_status = InstallStatus::load()?;
            let mut install_status_server = install_status.server;
            install_status_server.error_type = None;
            install_status_server.error_message = None;
            install_status.server = install_status_server;
            install_status.save()?;
            ssh.run_command(format!("rm -rf ~/install-logs/{}.*", step_key).as_str())
                .await?;
        }

        Ok(())
    }

    async fn is_new_server(ssh: &SSH) -> Result<bool> {
        // Right now we're doing a simple check for the install_server.sh script.
        // code == 0 if the file exists, otherwise it's a new server
        let (_output, code) = ssh.run_command("test -f ~/scripts/install_server.sh").await?;
        
        Ok(code != 0)
    }

    async fn start_install_script(ssh: &SSH) -> Result<()> {
        let chain = env::var("CHAIN").unwrap_or_else(|_| "mainnet".to_string());
        let remote_script_path = format!("~/scripts/install_server.sh");
        let remote_script_log_path = format!("~/install_server.log");

        // remove the log file if it exists
        ssh.run_command(&format!("rm -f {}", remote_script_log_path)).await?;

        // Now execute the script using run_command
        let shell_command = format!(
            "ARGON_CHAIN={} nohup {} > {} 2>&1 &",
            chain, remote_script_path, remote_script_log_path
        );
        
        // Execute the command - nohup will handle running in background
        if let Err(e) = ssh.run_command(&shell_command).await {
            error!("Error executing script: {}", e);
            return Err(e.into());
        }

        Ok(())
    }
}
