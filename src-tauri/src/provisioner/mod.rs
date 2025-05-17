use crate::config::{ConfigFile, ServerConnection, ServerStatus, ServerStatusErrorType};
use crate::ssh::{SSHConfig, SSH};
use anyhow::Result;
use lazy_static::lazy_static;
use log::{error, info, trace};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

lazy_static! {
    static ref RUNNING_TASK: Mutex<Option<tokio::task::JoinHandle<()>>> = Mutex::new(None);
}

pub struct Provisioner {}

impl Provisioner {
    pub async fn start(sshconfig: SSHConfig, app: AppHandle) -> Result<()> {
        let ssh = SSH::connect(sshconfig).await?;

        Self::upload_sha256(&ssh).await?;
        let script_is_running = Provisioner::is_script_running(&ssh).await?;
        if !script_is_running {
            Provisioner::start_script(&ssh).await?;
        }

        Provisioner::monitor(app, ssh).await?;
        trace!("finished start");
        Ok(())
    }

    pub async fn reconnect(sshconfig: SSHConfig, app: AppHandle) -> Result<()> {
        let ssh = SSH::connect(sshconfig).await?;

        Self::upload_sha256(&ssh).await?;
        let script_is_running = Provisioner::is_script_running(&ssh).await?;
        info!("need to start script = {}", !script_is_running);
        if !script_is_running {
            Provisioner::start_script(&ssh).await?;
        }

        Provisioner::monitor(app, ssh).await?;

        Ok(())
    }

    pub async fn retry_failure(
        step_key: String,
        sshconfig: SSHConfig,
        app: AppHandle,
    ) -> Result<()> {
        let ssh = SSH::connect(sshconfig).await?;
        Self::upload_sha256(&ssh).await?;

        let script_is_running = Provisioner::is_script_running(&ssh).await?;
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

        Ok(())
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
        ssh.start_script().await?;
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
        info!("EMITTING serverStatus1");
        if let Err(e) = app.emit("serverStatus", server_status.clone()) {
            error!("Error sending server status: {}", e);
        }
        server_status.save()?;
        Ok(())
    }

    pub async fn monitor(app: AppHandle, ssh: SSH) -> Result<()> {
        if let Some(handle) = RUNNING_TASK.lock().unwrap().take() {
            handle.abort();
        }

        let handle = tokio::spawn(async move {
            let mut server_status = ServerStatus::load().unwrap_or_default();
            let mut last_error = None;
            loop {
                let filenames = match Provisioner::fetch_filenames(&ssh).await {
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
                    Ok(latest_status) => {
                        info!("EMITTING serverStatus2");
                        if let Err(e) = app.emit("serverStatus", latest_status.clone()) {
                            error!("Error sending server status: {}", e);
                        }
                        latest_status.save().unwrap();
                        server_status = latest_status.clone();

                        let mut should_retry_upload = false;
                        if latest_status.error_type != last_error {
                            last_error = latest_status.error_type.clone();
                            should_retry_upload = last_error.is_some();
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
                }

                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
            }
        });

        *RUNNING_TASK.lock().unwrap() = Some(handle);
        Ok(())
    }

    fn is_provisioned(server_status: &ServerStatus) -> bool {
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
            status.minerlaunch = Provisioner::fetch_minerlaunch_progress(ssh).await?;
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
