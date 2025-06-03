use crate::config::{ConfigFile, ServerDetails, InstallStatus, InstallStatusServer, InstallStatusErrorType, InstallStatusClient};
use crate::ssh::{SSH};
use crate::installer::Installer;
use log::{info};
use anyhow::Result;

pub struct InstallerStatus;

impl InstallerStatus {
    pub async fn fetch(ssh: &SSH) -> Result<InstallStatusServer> {
        let install_status = InstallStatus::load()?;
        let install_status = Self::fetch_latest_install_status(&ssh, install_status).await?;

        if Self::has_error(&install_status.server) {
            info!("Server has error, exiting InstallerStatus: {:?}", install_status.server);
            return Ok(install_status.server);
        }

        println!("IS SERVER STATUS COMPLETE: {:?}: {:?}", Self::is_server_install_complete(&install_status.server), install_status.server);
        if Self::is_server_install_complete(&install_status.server) {
            let mut server_details = ServerDetails::load()?;
            server_details.is_installing = false;
            server_details.is_new_server = false;
            server_details.save()?;
        }

        Ok(install_status.server)
    }

    pub fn has_error(status_server: &InstallStatusServer) -> bool {
      status_server.error_type.is_some()
    }

    pub fn is_server_install_complete(status_server: &InstallStatusServer) -> bool {
      status_server.ubuntu_check >= 100
          && status_server.file_check >= 100
          && status_server.docker_install >= 100
          && status_server.bitcoin_install >= 100
          && status_server.argon_install >= 100
          && status_server.docker_launch >= 100.0
    }

    pub fn has_server_install_started(status_server: &InstallStatusServer) -> bool {
      status_server.ubuntu_check > 0
    }

    pub async fn fetch_latest_install_status(ssh: &SSH, mut install_status: InstallStatus) -> Result<InstallStatus> {
        let mut install_status_server = install_status.server;

        let filenames = match Self::fetch_log_filenames(&ssh).await {
            Ok(filenames) => filenames,
            Err(e) => {
                install_status_server.error_type = Some(InstallStatusErrorType::Unknown);
                install_status_server.error_message = Some(format!("{}", e));
                Vec::new()
            }
        };

        match Self::calculate_status_server(&filenames, &ssh).await {
            Ok(status_server) => {
                install_status_server = status_server;
            }
            Err(e) => {
                install_status_server.error_type = Some(InstallStatusErrorType::Unknown);
                install_status_server.error_message = Some(format!("{}", e));
            }
        }

        install_status.server = install_status_server.clone();
        install_status.client = Self::calculate_status_client(&install_status)?;
        install_status.save()?;

        Ok(install_status)
    }


    fn calculate_status_client(install_status: &InstallStatus) -> Result<InstallStatusClient> {
        let status_server = install_status.server.clone();
        let mut status_client = install_status.client.clone();

        if status_server.ubuntu_check == 0 {
            status_client.file_check = 0.0;
        }

        if status_server.file_check == 0 {
            status_client.docker_install = 0.0;
        }

        if status_server.docker_install == 0 {
            status_client.bitcoin_install = 0.0;
        }

        if status_server.bitcoin_install == 0 {
            status_client.argon_install = 0.0;
        }

        if status_server.argon_install == 0 {
            status_client.docker_launch = 0.0;
        }

        Ok(status_client)
    }

    async fn calculate_status_server(filenames: &Vec<String>, ssh: &SSH) -> Result<InstallStatusServer> {
      info!("FILENAMES:");
      for filename in filenames {
          if !filename.is_empty() {
              info!("  - {}", filename);
          }
      }

      let mut status = InstallStatusServer::default();
      status.is_running = Installer::is_install_running(&ssh).await?;
      println!("IS RUNNING: {}", status.is_running);

      let s = |s: &str| s.to_string();

      if filenames.contains(&s("UbuntuCheck.finished")) {
          status.ubuntu_check = 100;
      } else if filenames.contains(&s("UbuntuCheck.failed")) {
          status.error_type = Some(InstallStatusErrorType::UbuntuCheck);
          return Ok(status);
      } else if filenames.contains(&s("UbuntuCheck.started")) {
          status.ubuntu_check = 1;
          return Ok(status);
      }

      if filenames.contains(&s("FileCheck.finished")) {
          status.file_check = 100;
      } else if filenames.contains(&s("FileCheck.failed")) {
          status.error_type = Some(InstallStatusErrorType::FileCheck);
          return Ok(status);
      } else if filenames.contains(&s("FileCheck.started")) {
          status.file_check = 1;
          return Ok(status);
      }

      if filenames.contains(&s("DockerInstall.finished")) {
          status.docker_install = 100;
      } else if filenames.contains(&s("DockerInstall.failed")) {
          status.error_type = Some(InstallStatusErrorType::DockerInstall);
          return Ok(status);
      } else if filenames.contains(&s("DockerInstall.started")) {
          status.docker_install = 1;
          return Ok(status);
      }

      if filenames.contains(&s("BitcoinInstall.finished")) {
          status.bitcoin_install += 50;
      } else if filenames.contains(&s("BitcoinInstall.failed")) {
          status.error_type = Some(InstallStatusErrorType::BitcoinInstall);
          return Ok(status);
      } else if filenames.contains(&s("BitcoinInstall.started")) {
          status.bitcoin_install = 1;
          return Ok(status);
      }

      // NOTE: combine BitcoinInstall and BitcoinData status
      if filenames.contains(&s("BitcoinData.finished")) {
          status.bitcoin_install += 50;
      } else if filenames.contains(&s("BitcoinData.failed")) {
          status.error_type = Some(InstallStatusErrorType::BitcoinInstall);
          return Ok(status);
      } else if filenames.contains(&s("BitcoinData.started")) {
          return Ok(status);
      }

      if filenames.contains(&s("ArgonInstall.finished")) {
          status.argon_install = 100;
      } else if filenames.contains(&s("ArgonInstall.failed")) {
          status.error_type = Some(InstallStatusErrorType::ArgonInstall);
          return Ok(status);
      } else if filenames.contains(&s("ArgonInstall.started")) {
          status.argon_install = 1;
          return Ok(status);
      }

      if filenames.contains(&s("DockerLaunch.failed")) {
          status.error_type = Some(InstallStatusErrorType::DockerLaunch);
          Ok(status)
      } else if filenames.contains(&s("DockerLaunch.started")) {
          status.docker_launch = Self::fetch_docker_launch_progress(ssh).await?;
          return Ok(status);
      } else {
          return Ok(status);
      }
  }

    async fn fetch_docker_launch_progress(ssh: &SSH) -> Result<f32> {
        // Run commands sequentially instead of concurrently
        let (argon_output, _) = ssh
            .run_command("docker exec deploy-argon-miner-1 syncstatus.sh")
            .await?;
        let (bitcoin_output, _) = ssh
            .run_command("docker exec deploy-bitcoin-1 syncstatus.sh")
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

    async fn fetch_log_filenames(ssh: &SSH) -> Result<Vec<String>> {
        let (output, _code) = match ssh.run_command("ls ~/install-logs").await {
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
}
