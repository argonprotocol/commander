use crate::config::{ConfigFile, ServerDetails, InstallStatus, Security, BiddingRules, InstallStatusErrorType, InstallStatusClient, InstallStatusServer};
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
    static ref IS_RUNNING: Mutex<Option<tokio::task::JoinHandle<()>>> = Mutex::new(None);
}

const CORE_DIRS: [&'static str; 4] = ["deploy", "bot", "calculator", "scripts"];

struct TmpInstallChecks {
    pub is_installing_fresh: bool,
    pub has_server_install_started: bool,
    pub has_server_install_completed: bool,
    pub remote_files_need_updating: bool,
}

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
        let (install_status, tmp_install_checks) = Self::check_install(&ssh).await?;
        let is_installing_fresh = tmp_install_checks.is_installing_fresh;
        let has_server_install_started = tmp_install_checks.has_server_install_started;
        let has_server_install_completed = tmp_install_checks.has_server_install_completed;
        let remote_files_need_updating = tmp_install_checks.remote_files_need_updating;

        info!("is_installing_fresh = {}", is_installing_fresh);
        info!("has_server_install_started = {}", has_server_install_started);
        info!("has_server_install_completed = {}", has_server_install_completed);
        info!("remote_files_need_updating = {}", remote_files_need_updating);
        info!("should_bypass_upgrade_check = {}", should_bypass_upgrade_check);
        info!("is_new_server = {}", server_details.is_new_server);
        
        if has_server_install_completed && !remote_files_need_updating {
            info!("Server is up-to-date, skipping Installer");
            server_details.is_requiring_upgrade = false;
            server_details.is_installing = false;
            server_details.is_installing_fresh = false;
            server_details.save()?;
            return Ok(());
        }

        let local_files_are_valid = Self::local_files_match_local_shumas(&app)?;
        if !local_files_are_valid {
            info!("Local shasums are not accurate, skipping Installer");
            return Ok(());
        }
        
        let is_within_install_process = (server_details.is_installing || has_server_install_started) && !has_server_install_completed;
        let needs_explicit_upgrade_approval = !is_within_install_process && !should_bypass_upgrade_check && !is_installing_fresh;
        if needs_explicit_upgrade_approval {
            info!("Server is not new so upgrade requires user approval, skipping Installer");
            server_details.is_requiring_upgrade = true;
            server_details.save()?;
            return Ok(());
        }

        // At this point we know the server is either brand new or has not completed its install. We will postpone
        // if there is an error, otherwise we start the install process.

        server_details.is_requiring_upgrade = false;
        server_details.is_installing = true;

        if tmp_install_checks.is_installing_fresh {
            server_details.is_installing_fresh = true;
        }

        server_details.save()?;

        let has_install_error = InstallerStatus::has_error(&install_status.server);
        if has_install_error {
            // If the server has an error, we don't want to start the install process again.
            info!("Server has error, exiting Installer: {:?}", install_status.server);
            return Ok(());
        }

        let mut install_status: InstallStatus = install_status.clone();
        if is_installing_fresh {
            install_status.client = InstallStatusClient::default();
            install_status.server = InstallStatusServer::default();
            install_status.save()?;
        }

        let is_waiting_for_dockers_to_sync: bool = install_status.server.docker_launch > 0.0;
        if is_waiting_for_dockers_to_sync && !remote_files_need_updating {
            info!("Install script has finished, only waiting for dockers to sync, exiting Installer");
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

        Self::clear_step_files(&ssh, vec![step_key]).await?;
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
        if let Some(_handle) = IS_RUNNING.lock().unwrap().as_ref() {
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

    async fn check_install(ssh: &SSH) -> Result<(InstallStatus, TmpInstallChecks)> {
        let install_status = InstallStatus::load()?;

        let is_installing_fresh = !Self::server_has_sha256_file(&ssh).await?;
        
        if is_installing_fresh {
            return Ok((install_status, TmpInstallChecks {
                is_installing_fresh,
                has_server_install_started: false,
                has_server_install_completed: false,
                remote_files_need_updating: true,
            }));
        }

        let has_server_install_started = InstallerStatus::has_server_install_started(&install_status.server);
        let remote_files_need_updating = !Self::remote_files_match_local_shasums(&ssh).await?;

        if remote_files_need_updating {
            return Ok((install_status, TmpInstallChecks {
                is_installing_fresh,
                has_server_install_started,
                has_server_install_completed: false,
                remote_files_need_updating,
            }));
        }

        let install_status = InstallerStatus::fetch_latest_install_status(&ssh, install_status).await?;
        let has_server_install_completed = InstallerStatus::has_server_install_completed(&install_status.server);

        Ok((install_status, TmpInstallChecks {
            is_installing_fresh,
            has_server_install_started,
            has_server_install_completed,
            remote_files_need_updating,
        }))
    }

    async fn remote_files_match_local_shasums(ssh: &SSH) -> Result<bool> {
        let (remote_shasums, _code) = ssh.run_command("cat ~/SHASUMS256.copied 2>/dev/null || true").await?;
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
        if let Some(_handle) = IS_RUNNING.lock().unwrap().take() {
            info!("Install thread already running, skipping");
            return Ok(());
        }

        let app = app.clone();
        let ssh = SSH::connect(ssh_config).await?;
        let steps_to_clear = vec![
            InstallStatusErrorType::FileCheck.to_string(),
            InstallStatusErrorType::BitcoinInstall.to_string(),
            InstallStatusErrorType::ArgonInstall.to_string(),
            InstallStatusErrorType::DockerLaunch.to_string(),
        ];

        Self::clear_step_files(&ssh, steps_to_clear).await?;
        Self::upload_sha256(&ssh).await?;

        let handle: tokio::task::JoinHandle<()> = tokio::spawn(async move {
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
            let _ = IS_RUNNING.lock().unwrap().take();
        });

        let _ = IS_RUNNING.lock().unwrap().insert(handle);

        Ok(())
    }

    async fn server_has_sha256_file(ssh: &SSH) -> Result<bool> {
        let (_output, code) = ssh.run_command("test -f ~/SHASUMS256").await?;
        Ok(code == 0)
    }

    async fn upload_sha256(ssh: &SSH) -> Result<()> {
        let local_shasums: &'static str = include_str!("../../../SHASUMS256");
        ssh.upload_file(local_shasums, "~/SHASUMS256").await?;
        ssh.run_command("rm ~/SHASUMS256.copied").await?;
        
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

        ssh.run_command("~/scripts/update_shasums.sh SHASUMS256.copied").await?;

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
    
    async fn clear_step_files(ssh: &SSH, step_keys: Vec<String>) -> Result<()> {
        if step_keys.contains(&"all".to_string()) {
            InstallStatus::delete()?;
            ssh.run_command("rm -rf ~/install-logs/*").await?;
            return Ok(());
        }

        let mut install_status = InstallStatus::load()?;
        install_status.server.error_type = None;
        install_status.server.error_message = None;

        for step_key in &step_keys {
            match step_key.as_str() {
                "UbuntuCheck" => {
                    install_status.client.ubuntu_check = 0.0;
                    install_status.server.ubuntu_check = 0;
                }
                "FileCheck" => {
                    install_status.client.file_check = 0.0;
                    install_status.server.file_check = 0;
                }
                "DockerInstall" => {
                    install_status.client.docker_install = 0.0;
                    install_status.server.docker_install = 0;
                }
                "BitcoinInstall" => {
                    install_status.client.bitcoin_install = 0.0;
                    install_status.server.bitcoin_install = 0;
                }
                "ArgonInstall" => {
                    install_status.client.argon_install = 0.0;
                    install_status.server.argon_install = 0;
                }
                "DockerLaunch" => {
                    install_status.client.docker_launch = 0.0;
                    install_status.server.docker_launch = 0.0;
                }
                _ => {}
            }
            ssh.run_command(format!("rm -rf ~/install-logs/{}.*", step_key).as_str())
            .await?;
        }

        install_status.save()?;

        Ok(())
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
