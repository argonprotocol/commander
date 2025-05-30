use std::path::{Path, PathBuf};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};
use anyhow::Result;
use std::os::unix::fs::MetadataExt;
use std::fs;
use sha2::{Sha256, Digest};

#[derive(Debug)]
pub struct FileInfo {
    pub absolute_path: PathBuf,
    pub relative_path: PathBuf,
    pub is_executable: bool,
}

pub struct Utils;

impl Utils {
    pub fn get_embedded_path(app: &AppHandle, path: impl AsRef<Path>) -> anyhow::Result<PathBuf> {
        let local_base_path = app
            .path()
            .resolve(PathBuf::from("..").join(path), BaseDirectory::Resource)?;
        Ok(local_base_path)
    }

    pub fn collect_files(
        app: &AppHandle,
        local_base_dir: &Path,
    ) -> Result<Vec<FileInfo>> {
        let mut stack = vec![PathBuf::new()];
        let mut files = Vec::new();

        while let Some(relative_dir_path) = stack.pop() {
            let absolute_dir_path: PathBuf = Self::get_embedded_path(app, &local_base_dir.join(&relative_dir_path))?;
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
        files.sort_by(|a, b| 
            a.absolute_path.to_string_lossy().as_bytes().cmp(b.absolute_path.to_string_lossy().as_bytes())
        );
    
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

    pub fn get_version(app: &AppHandle) -> Result<String> {
        let version = app.package_info().version.to_string();
        Ok(version)
    }
}