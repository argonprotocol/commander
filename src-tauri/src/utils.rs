use anyhow::Result;
use rand::RngCore;
use sha2::{Digest, Sha256};
use std::env as std_env;
use std::fs;
use std::os::unix::fs::MetadataExt;
use std::path::{Path, PathBuf};
use tauri;
use tauri::{AppHandle, Manager};

#[derive(Debug)]
pub struct FileInfo {
    pub absolute_path: PathBuf,
    pub relative_path: PathBuf,
    pub is_executable: bool,
}

pub struct Utils;

impl Utils {
    pub fn get_instance_name() -> String {
        // First try COMMANDER_INSTANCE_NAME
        if let Ok(name) = std_env::var("COMMANDER_INSTANCE_NAME") {
            return name;
        }
        
        // If not found, try COMMANDER_INSTANCE and split for name:port
        if let Ok(instance) = std_env::var("COMMANDER_INSTANCE") {
            if let Some(name) = instance.split(':').next() {
                return name.to_string();
            }
        }
        
        // Default fallback
        "default".to_string()
    }

    pub fn get_embedded_path(app: &AppHandle, path: impl AsRef<Path>) -> anyhow::Result<PathBuf> {
        let local_base_path = app.path().resolve(
            PathBuf::from("..").join(path),
            tauri::path::BaseDirectory::Resource,
        )?;
        Ok(local_base_path)
    }

    pub fn collect_files(app: &AppHandle, local_base_dir: &Path) -> Result<Vec<FileInfo>> {
        let mut stack = vec![PathBuf::new()];
        let mut files = Vec::new();

        while let Some(relative_dir_path) = stack.pop() {
            let absolute_dir_path: PathBuf =
                Self::get_embedded_path(app, &local_base_dir.join(&relative_dir_path))?;
            for item in fs::read_dir(&absolute_dir_path)?.flatten() {
                let absolute_file_path = item.path();
                let relative_file_path = relative_dir_path.join(item.file_name());

                if absolute_file_path.is_dir() {
                    stack.push(relative_file_path);
                } else {
                    let mode = absolute_file_path.metadata()?.mode();
                    let is_shell_script = relative_file_path.to_string_lossy().ends_with(".sh");
                    let is_executable = (mode & 0o100 != 0) || is_shell_script;
                    files.push(FileInfo {
                        absolute_path: absolute_file_path,
                        relative_path: relative_file_path,
                        is_executable,
                    });
                }
            }
        }
        Ok(files)
    }

    pub fn create_shasum(app: &AppHandle, local_base_dir: &Path) -> Result<String> {
        let mut files = Self::collect_files(app, local_base_dir)?;
        files.sort_by(|a, b| {
            a.absolute_path
                .to_string_lossy()
                .as_bytes()
                .cmp(b.absolute_path.to_string_lossy().as_bytes())
        });

        let mut hashes = Vec::new();
        for file in &files {
            let content = fs::read(file.absolute_path.as_path()).expect("Failed to read file");
            let mut hasher = Sha256::new();
            hasher.update(&content);
            let hash = hasher.finalize();
            let hash_hex = format!("{:x}", hash);
            hashes.push(hash_hex);
        }
        let concatenated = hashes.join("\n") + "\n";

        // Calculate final hash
        let mut hasher = Sha256::new();
        hasher.update(concatenated.as_bytes());

        Ok(format!("{:x}", hasher.finalize()))
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
