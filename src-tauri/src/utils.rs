use anyhow::Result;
use rand::RngCore;
use std::env as std_env;
use std::path::{Path, PathBuf};
use tauri;
use tauri::{AppHandle, Manager};

pub struct Utils;

impl Utils {
    pub fn get_instance_name() -> String {
        if let Ok(instance) = std_env::var("COMMANDER_INSTANCE") {
            if let Some(name) = instance.split(':').next() {
                return name.to_string();
            }
        }

        // Default fallback
        "default".to_string()
    }

    pub fn get_network_name() -> String {
        std_env::var("ARGON_NETWORK_NAME").unwrap_or_else(|_| "mainnet".to_string())
    }

    pub fn get_relative_config_instance_dir() -> PathBuf {
        let instance_name = Self::get_instance_name();
        let network_name = Self::get_network_name();
        PathBuf::from(network_name).join(instance_name)
    }

    pub fn get_embedded_path(app: &AppHandle, path: impl AsRef<Path>) -> anyhow::Result<PathBuf> {
        let local_base_path = app.path().resolve(
            PathBuf::from("..").join(path),
            tauri::path::BaseDirectory::Resource,
        )?;
        Ok(local_base_path)
    }

    #[allow(unused)]
    pub fn get_key_from_keychain() -> Result<String> {
        let key_entry = keyring::Entry::new("argon-commander", "db_key")?;
        let key = match key_entry.get_password() {
            Ok(k) => k,
            Err(_) => {
                let mut key = [0u8; 32]; // 256-bit key
                rand::thread_rng().fill_bytes(&mut key);
                let new_key = hex::encode(&key);

                key_entry.set_password(&new_key)?;
                new_key
            }
        };
        Ok(key)
    }

    pub fn extract_host_port(host: &str) -> (String, u16) {
        if host.contains(":") {
            let mut parts = host.split(':');
            let host_str = parts.next().unwrap_or("").to_string();
            let port_str = parts.next().unwrap_or("22").parse().unwrap_or(22);

            (host_str, port_str)
        } else {
            (host.to_string(), 22)
        }
    }
}
