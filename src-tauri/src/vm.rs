use crate::utils::Utils;
use include_dir::{Dir, include_dir};
use std::fs;
use std::net::TcpListener;
#[cfg(not(target_os = "windows"))]
use std::os::unix::prelude::*;
use std::path::PathBuf;
use std::process::Command;
use tauri::AppHandle;

static VM_FILES: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/../local-machine");

pub struct Vm {
    pub ssh_port: u16,
}

#[tauri::command]
pub fn is_docker_running(_app: AppHandle) -> bool {
    // check if docker is running first
    let docker_check = Command::new("docker").arg("info").output();
    docker_check.is_ok() && docker_check.unwrap().status.success()
}

#[tauri::command]
pub fn check_needed_ports() -> Result<Vec<u16>, String> {
    let mut blocked_ports = vec![];
    let env_vars = Utils::get_server_env_vars()?;
    for (key, value) in env_vars {
        if key.ends_with("_PORT") {
            if let Ok(port) = value.parse::<u16>() {
                let is_in_use = TcpListener::bind(("0.0.0.0", port)).is_err();
                if is_in_use {
                    blocked_ports.push(port);
                }
            }
        }
    }
    Ok(blocked_ports)
}

#[tauri::command]
pub async fn create_local_vm(
    app: AppHandle,
    ssh_public_key: String,
    env_text: String,
) -> Result<u16, String> {
    let vm_path = get_vm_path(&app);
    let vm = Vm::create(vm_path, ssh_public_key, env_text)?;
    Ok(vm.ssh_port)
}

#[tauri::command]
pub async fn activate_local_vm(app: AppHandle) -> Result<u16, String> {
    let vm_path = get_vm_path(&app);
    let vm = Vm::activate(&vm_path)?;
    Ok(vm.ssh_port)
}

#[tauri::command]
pub async fn remove_local_vm(app: AppHandle) -> Result<(), String> {
    let vm_path = get_vm_path(&app);
    Vm::destroy(&vm_path)?;
    Ok(())
}

fn get_vm_path(app: &AppHandle) -> PathBuf {
    Utils::get_absolute_config_instance_dir(app).join("virtual-machine")
}

impl Vm {
    pub fn activate(vm_path: &PathBuf) -> anyhow::Result<Vm, String> {
        if !vm_path.exists() {
            return Err(format!("VM path {} does not exist", vm_path.display()));
        }
        Self::run_compose_command(vm_path, &["up", "-d"])?;
        Self::run_compose_command(&vm_path.join("server"), &["up", "-d"])?;
        Self::get_vm(vm_path)
    }

    pub fn create(
        vm_path: PathBuf,
        ssh_public_key: String,
        env_text: String,
    ) -> anyhow::Result<Vm, String> {
        if vm_path.exists() {
            std::fs::remove_dir_all(&vm_path)
                .map_err(|e| format!("Error removing VM directory {}: {}", vm_path.display(), e))?;
        }
        let ssh_path = vm_path.join(".ssh");

        if !ssh_path.exists() {
            fs::create_dir_all(&ssh_path)
                .map_err(|e| format!("Error creating directory {}: {}", ssh_path.display(), e))?;
            Vm::set_permissions(&ssh_path, 0o700)?;
        }
        let keys_path = ssh_path.join("authorized_keys");

        fs::write(&keys_path, ssh_public_key)
            .map_err(|e| format!("Error writing file {}: {}", keys_path.display(), e))?;

        Vm::set_permissions(&keys_path, 0o600)?;

        let env_path = vm_path.join(".env");
        fs::write(&env_path, env_text)
            .map_err(|e| format!("Error writing file {}: {}", env_path.display(), e))?;

        for file in VM_FILES.files() {
            let relative_path = file.path();
            let target_path = vm_path.join(relative_path);
            fs::write(&target_path, file.contents())
                .map_err(|e| format!("Error copying file to {}: {}", target_path.display(), e))?;
        }

        Self::run_compose_command(&vm_path, &["up", "-d", "--build", "--wait"])?;
        Self::get_vm(&vm_path)
    }

    pub fn get_vm(vm_path: &PathBuf) -> anyhow::Result<Vm, String> {
        if !vm_path.exists() {
            return Err(format!("VM path {} does not exist", vm_path.display()));
        }
        let port_output = Self::run_compose_command(vm_path, &["port", "vm", "22"])?;
        let port = port_output
            .split(':')
            .next_back()
            .ok_or("Failed to parse port")?;
        log::info!("VM SSH port: {}", port);
        let vm_port = port.parse::<u16>().map_err(|e| e.to_string())?;
        Ok(Vm { ssh_port: vm_port })
    }

    pub fn destroy(vm_path: &PathBuf) -> anyhow::Result<(), String> {
        log::info!("Removing local VM at {}", vm_path.display());
        if !vm_path.exists() {
            return Ok(());
        }
        let server_path = vm_path.join("server");
        if server_path.exists() {
            Self::run_compose_command(&server_path, &["down", "--rmi", "all"])?;
        }

        Self::run_compose_command(vm_path, &["down", "--rmi", "all"])?;
        std::fs::remove_dir_all(vm_path)
            .map_err(|e| format!("Error removing VM directory {}: {}", vm_path.display(), e))?;

        Ok(())
    }

    fn run_compose_command(vm_path: &PathBuf, args: &[&str]) -> anyhow::Result<String, String> {
        let output = Command::new("docker")
            .args(["compose"].iter().chain(args))
            .current_dir(vm_path)
            .output()
            .map_err(|e| format!("Failed to run docker compose: {}", e))?;

        if !output.status.success() {
            return Err(format!(
                "docker compose {:?} failed: {}",
                args,
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    }

    fn set_permissions(path: &PathBuf, mode: u32) -> anyhow::Result<(), String> {
        #[cfg(not(target_os = "windows"))]
        {
            let mut perms = fs::metadata(path).map_err(|e| e.to_string())?.permissions();
            perms.set_mode(mode);
            fs::set_permissions(path, perms).map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}
