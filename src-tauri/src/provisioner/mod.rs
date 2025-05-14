use crate::config::{ConfigFile, ServerConnection, ServerStatus, ServerProgress , ServerStatusErrorType};
use crate::ssh::{SSHConfig, SSH};
use anyhow::Result;
use lazy_static::lazy_static;
use log::{error, info, trace};
use std::sync::Mutex;
use std::env;
use tauri::{AppHandle, Emitter};

lazy_static! {
    static ref RUNNING_TASK: Mutex<Option<tokio::task::JoinHandle<()>>> = Mutex::new(None);
}

pub struct Provisioner {}

impl Provisioner {
    pub async fn try_start(sshconfig: SSHConfig, app: AppHandle) -> Result<()> {
        let mut server_connection = ServerConnection::load()?;
        if !server_connection.is_connected {
            info!("Server is not connected, skipping Provisioner");
            return Ok(());
        }

        let ssh = SSH::connect(sshconfig).await?;
        let is_new_server = Self::is_new_server(&ssh).await?;
        info!("Is new server = {}", is_new_server);

        let (has_completed, has_error) = if is_new_server {
            (false, false)
        } else {
            let server_status = ServerStatus::load()?;
            let server_status = Self::update_server_status(&ssh, server_status).await?;
            let has_completed = Self::server_status_is_complete(&server_status);
            let has_error = Self::has_error(&server_status);
            (has_completed, has_error)
        };

        if has_completed {
            info!("Server is provisioned, exiting Provisioner");
            return Ok(());
        } else if has_error {
            info!("Server has error, exiting Provisioner");
            return Ok(());
        }

        server_connection.is_provisioned = false;
        server_connection.save()?;

        if !is_new_server {
            ServerProgress::delete()?;
            ServerStatus::delete()?;
        }

        let script_is_running = Provisioner::is_script_running(&ssh).await?;
        info!("Starting script = {}", !script_is_running);

        if !script_is_running {
            Self::upload_sha256(&ssh).await?;
            Self::start_script(&ssh).await?;
        }

        Self::monitor_setup(app, ssh).await?;
        trace!("Is now monitoring");

        Ok(())
    }

    pub async fn retry_failure(
        step_key: String,
        sshconfig: SSHConfig,
        app: AppHandle,
    ) -> Result<()> {
        let ssh = SSH::connect(sshconfig).await?;
        Self::upload_sha256(&ssh).await?;

        let script_is_running = Self::is_script_running(&ssh).await?;
        if script_is_running {
            return Ok(());
        }

        Self::clear_step(&ssh, step_key).await?;

        Provisioner::start_script(&ssh).await?;
        Provisioner::monitor(app, ssh).await?;

        Ok(())
    }

    pub async fn upload_system_files(ssh: &SSH, app: &AppHandle) -> Result<()> {
        ssh.upload_directory(&app, "deploy", "~/commander-deploy")
            .await?;
        Self::clear_step(ssh, ServerStatusErrorType::System.to_string()).await?;
        // don't delete the data step
        Self::clear_step(ssh, ServerStatusErrorType::BitcoinSync.to_string()).await?;
        Self::clear_step(ssh, ServerStatusErrorType::ArgonSync.to_string()).await?;
        Self::clear_step(ssh, ServerStatusErrorType::MinerLaunch.to_string()).await?;

        Ok(())
    }

    pub async fn upload_system_files_and_monitor(ssh: SSH, app: AppHandle) -> Result<()> {
        Self::upload_system_files(&ssh, &app).await?;
        let script_is_running = Provisioner::is_script_running(&ssh).await?;
        if !script_is_running {
            Provisioner::start_script(&ssh).await?;
            Provisioner::monitor(app, ssh).await?;
        }
        Ok(())
    }

    async fn clear_step(ssh: &SSH, step_key: String) -> Result<()> {
        if step_key == "all" {
            ssh.run_command("rm -rf ~/setup-logs/*").await?;
        } else {
            ssh.run_command(format!("rm -rf ~/setup-logs/{}.*", step_key).as_str())
                .await?;
        }

        Self::start_script(&ssh).await?;
        Self::monitor_setup(app, ssh).await?;

        Ok(())
    }

    pub async fn is_new_server(ssh: &SSH) -> Result<bool> {
        // Right now we're doing a simple check for the setup-script.sh file
        // TODO: Add more checks
        let (_output, code) = ssh.run_command("test -f ~/setup-script.sh").await?;

        // code == 0 if the file exists, otherwise it's a new server
        Ok(code != 0)
    }

    async fn is_script_running(ssh: &SSH) -> Result<bool> {
        match ssh.run_command("pgrep -f setup-script.sh").await {
            Ok((pid, _)) => Ok(!pid.trim().is_empty()),
            Err(_) => Ok(false),
        }
    }

    async fn upload_sha256(ssh: &SSH) -> Result<()> {
        let shasums = include_str!("../../../SHASUMS256");
        ssh.upload_file(shasums, "~/SHASUMS256").await?;

        Ok(())
    }

    async fn start_script(ssh: &SSH) -> Result<()> {
        let chain = env::var("CHAIN").unwrap_or_else(|_| "mainnet".to_string());
        let script_contents = include_str!("../../setup-script.sh");
        let remote_script_path = "~/setup-script.sh";

        ssh.upload_file(&script_contents, remote_script_path)
            .await?;

        // Now execute the script using run_command
        let shell_command = format!(
            "chmod +x {} && ARGON_CHAIN={} nohup {} > /dev/null 2>&1 &",
            remote_script_path, chain, remote_script_path
        );
        info!("Running: {}", shell_command);
        
        // Execute the command - nohup will handle running in background
        if let Err(e) = ssh.run_command(&shell_command).await {
            error!("Error executing script: {}", e);
            return Err(e.into());
        }

        // Give it a moment to start
        tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;

        Ok(())
    }

    async fn emit_failed_status(
        app: &AppHandle,
        server_status: &mut ServerStatus,
        error_message: &str,
        error_type: ServerStatusErrorType,
    ) -> Result<()> {
        server_status.error_type = Some(error_type);
        server_status.error_message = Some(error_message.to_string());
        if let Err(e) = app.emit("ServerStatus", server_status.clone()) {
            error!("Error sending server status: {}", e);
        }
        server_status.save()?;
        Ok(())
    }

    pub async fn monitor_setup(app: AppHandle, ssh: SSH) -> Result<()> {
        if let Some(_handle) = RUNNING_TASK.lock().unwrap().take() {
            return Ok(());
        }

        let handle = tokio::spawn(async move {
            let mut server_status = ServerStatus::load().unwrap_or_default();
            let mut last_error = None;
            loop {
                match Self::update_server_status(&ssh, server_status.clone()).await {
                    Ok(files) => files,
                    Err(e) => {
                        let _ = Self::emit_failed_status(
                            &app,
                            &mut server_status,
                            &format!("{}", e),
                            ServerStatusErrorType::Unknown,
                        )
                        .await;
                        break;
                    }
                };

                match Provisioner::calculate_setup_status(&filenames, &ssh).await {
                    Ok(new_status) => {
                        server_status = new_status;
                        if let Err(e) = app.emit("ServerStatus", server_status.clone()) {
                            error!("Error sending server status: {}", e);
                        }        
                    }
                    Err(e) => {
                        error!("Error fetching server status: {}", e);
                        if let Err(e) = app.emit("FatalServerError", server_status.clone()) {
                            error!("Error sending FatalServerError: {}", e);
                        }
                        break;
                    }
                }

                if Self::has_error(&server_status) {
                    info!("Server has error, exiting Provisioner: {:?}", server_status);
                    break;
                } else if Self::server_status_is_complete(&server_status) {
                    if let Err(e) = Self::finish().await {
                        error!("Error finishing provisioning: {}", e);
                        if let Err(e) = app.emit("FatalServerError", server_status.clone()) {
                            error!("Error sending FatalServerError: {}", e);
                        }

                        if latest_status.system == 1
                            || (latest_status.error_type == Some(ServerStatusErrorType::System)
                                && should_retry_upload)
                        {
                            if let Err(e) = Self::upload_system_files(&ssh, &app).await {
                                error!("Error uploading system files: {}", e);
                                let _ = Self::emit_failed_status(
                                    &app,
                                    &mut server_status,
                                    &format!("{}", e),
                                    ServerStatusErrorType::Unknown,
                                )
                                .await;
                                break;
                            }
                            continue;
                        }

                        if Provisioner::has_error(&latest_status) {
                            break;
                        } else if Provisioner::is_provisioned(&latest_status) {
                            let mut server_connection = match ServerConnection::load() {
                                Ok(connection) => connection,
                                Err(e) => {
                                    error!("Error loading server connection: {}", e);
                                    break;
                                }
                            };
                            server_connection.is_provisioned = true;
                            server_connection.save().unwrap();
                            break;
                        }
                    }
                    break;
                        let _ = Self::emit_failed_status(
                            &app,
                            &mut server_status,
                            &format!("{}", e),
                            ServerStatusErrorType::Unknown,
                        )
                        .await;
                        break;
                    }
                }

                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            }
        });

        *RUNNING_TASK.lock().unwrap() = Some(handle);
        Ok(())
    }

    async fn update_server_status(ssh: &SSH, mut server_status: ServerStatus) -> Result<ServerStatus> {
        let filenames = match Self::fetch_filenames(&ssh).await {
            Ok(files) => files,
            Err(e) => {
                server_status.error_type = Some(ServerStatusErrorType::Unknown);
                server_status.error_message = Some(format!("{}", e));
                server_status.save().unwrap();
                return Ok(server_status);
            }
        };

        match Self::calculate_setup_status(&filenames, &ssh).await {
            Ok(latest_status) => {
                latest_status.save().unwrap();
                return Ok(latest_status);
            }
            Err(e) => {
                server_status.error_type = Some(ServerStatusErrorType::Unknown);
                server_status.error_message = Some(format!("{}", e));
                server_status.save().unwrap();
                return Ok(server_status);
            }
        }
    }

    async fn finish() -> Result<()> {
        let mut server_connection = ServerConnection::load()?;
        server_connection.is_provisioned = true;
        server_connection.save().unwrap();

        Ok(())
    }

    fn server_status_is_complete(server_status: &ServerStatus) -> bool {
        server_status.ubuntu >= 100
            && server_status.system >= 100
            && server_status.docker >= 100
            && server_status.bitcoinsync >= 100
            && server_status.argonsync >= 100
            && server_status.minerlaunch >= 100.0
    }

    fn has_error(server_status: &ServerStatus) -> bool {
        server_status.error_type.is_some()
    }

    async fn fetch_filenames(ssh: &SSH) -> Result<Vec<String>> {
        let (output, _code) = match ssh.run_command("ls ~/setup-logs").await {
            Ok(result) => result,
            Err(_) => return Ok(Vec::new()),
        };
        let filenames: Vec<String> = output
            .split("\n")
            .filter(|s| !s.is_empty())
            .map(|s| s.to_string())
            .collect();
        Ok(filenames)
    }

    async fn calculate_setup_status(filenames: &Vec<String>, ssh: &SSH) -> Result<ServerStatus> {
        info!("FILENAMES:");
        for filename in filenames {
            if !filename.is_empty() {
                info!("  - {}", filename);
            }
        }

        let mut status = ServerStatus::default();
        let s = |s: &str| s.to_string();

        if filenames.contains(&s("ubuntu.finished")) {
            status.ubuntu = 100;
        } else if filenames.contains(&s("ubuntu.failed")) {
            status.error_type = Some(ServerStatusErrorType::Ubuntu);
            return Ok(status);
        } else if filenames.contains(&s("ubuntu.started")) {
            status.ubuntu = 1;
            return Ok(status);
        }

        if filenames.contains(&s("system.finished")) {
            status.system = 100;
        } else if filenames.contains(&s("system.failed")) {
            status.error_type = Some(ServerStatusErrorType::System);
            return Ok(status);
        } else if filenames.contains(&s("system.started")) {
            status.system = 1;
            return Ok(status);
        }

        if filenames.contains(&s("docker.finished")) {
            status.docker = 100;
        } else if filenames.contains(&s("docker.failed")) {
            status.error_type = Some(ServerStatusErrorType::Docker);
            return Ok(status);
        } else if filenames.contains(&s("docker.started")) {
            status.docker = 1;
            return Ok(status);
        }

        if filenames.contains(&s("bitcoinsync.finished")) {
            status.bitcoinsync += 50;
        } else if filenames.contains(&s("bitcoinsync.failed")) {
            status.error_type = Some(ServerStatusErrorType::BitcoinSync);
            return Ok(status);
        } else if filenames.contains(&s("bitcoinsync.started")) {
            status.bitcoinsync = 1;
            return Ok(status);
        }

        // NOTE: combine bitcoinsync and bitcoin data status
        if filenames.contains(&s("bitcoindata.finished")) {
            status.bitcoinsync += 50;
        } else if filenames.contains(&s("bitcoindata.failed")) {
            status.error_type = Some(ServerStatusErrorType::BitcoinSync);
            return Ok(status);
        } else if filenames.contains(&s("bitcoindata.started")) {
            return Ok(status);
        }

        if filenames.contains(&s("argonsync.finished")) {
            status.argonsync = 100;
        } else if filenames.contains(&s("argonsync.failed")) {
            status.error_type = Some(ServerStatusErrorType::ArgonSync);
            return Ok(status);
        } else if filenames.contains(&s("argonsync.started")) {
            status.argonsync = 1;
            return Ok(status);
        }

        if filenames.contains(&s("minerlaunch.failed")) {
            status.error_type = Some(ServerStatusErrorType::MinerLaunch);
            Ok(status)
        } else if filenames.contains(&s("minerlaunch.started")) {
            status.minerlaunch = Self::fetch_minerlaunch_progress(ssh).await?;
            return Ok(status);
        } else {
            return Ok(status);
        }
    }

    async fn fetch_minerlaunch_progress(ssh: &SSH) -> Result<f32> {
        // Run commands sequentially instead of concurrently
        let (argon_output, _) = ssh
            .run_command("docker exec commander-deploy-argon-miner-1 syncstatus.sh")
            .await?;
        let (bitcoin_output, _) = ssh
            .run_command("docker exec commander-deploy-bitcoin-1 syncstatus.sh")
            .await?;

        let argon_progress = argon_output
            .trim()
            .trim_end_matches('%')
            .parse::<f32>()
            .unwrap_or(0.0);
        let bitcoin_progress = bitcoin_output
            .trim()
            .trim_end_matches('%')
            .parse::<f32>()
            .unwrap_or(0.0);
        let progress = (argon_progress + bitcoin_progress) / 2.0;

        info!("ARGON PROGRESS = {}", argon_progress);
        info!("BITCOIN PROGRESS = {}", bitcoin_progress);
        info!("PROGRESS = {}", progress);
        Ok(progress)
    }
}
