use bip39::{Language, Mnemonic};
use rand::RngCore;
use std::fs;
#[cfg(not(target_os = "windows"))]
use std::os::unix::fs::PermissionsExt;
use tauri::AppHandle;

use crate::{ssh::SSH, utils::Utils};

#[derive(serde::Serialize, serde::Deserialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Security {
    pub master_mnemonic: String,
    pub ssh_public_key: String,
    pub ssh_private_key_path: String,
}

impl Security {
    pub fn load(app: &AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let absolute_config_dir = Utils::get_absolute_config_instance_dir(app);
        let mnemonic_file_path = absolute_config_dir.join("mnemonic");
        let public_key_path = absolute_config_dir.join("serverkey.pub");
        let private_key_path = absolute_config_dir.join("serverkey.pem");

        if mnemonic_file_path.exists() && public_key_path.exists() && private_key_path.exists() {
            // Load mnemonics
            let master_mnemonic = fs::read_to_string(&mnemonic_file_path)?;

            // Load SSH keys
            let ssh_public_key = fs::read_to_string(&public_key_path)?;

            Ok(Self {
                ssh_public_key,
                ssh_private_key_path: private_key_path.to_string_lossy().to_string(),
                master_mnemonic,
            })
        } else {
            Security::create(app)
        }
    }

    pub fn save(&self, app: &AppHandle) -> Result<(), Box<dyn std::error::Error>> {
        let absolute_config_dir = Utils::get_absolute_config_instance_dir(app);
        // Save mnemonics
        fs::write(absolute_config_dir.join("mnemonic"), &self.master_mnemonic)?;

        // Save SSH keys
        fs::write(
            absolute_config_dir.join("serverkey.pub"),
            &self.ssh_public_key,
        )?;

        // Set private key permissions to 600
        #[cfg(not(target_os = "windows"))]
        {
            let mut perms = fs::metadata(&self.ssh_private_key_path)?.permissions();
            perms.set_mode(0o600);
            fs::set_permissions(&self.ssh_private_key_path, perms)?;
        }

        Ok(())
    }

    pub fn create(app: &AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let (private_key, public_key) = SSH::generate_keys()?;
        let master_mnemonic = Self::generate_mnemonic()?;
        let config_dir = Utils::get_absolute_config_instance_dir(app);
        let ssh_private_key_path = config_dir.join("serverkey.pem");
        fs::create_dir_all(&config_dir)?;
        fs::write(&ssh_private_key_path, private_key)?;
        let instance = Self {
            master_mnemonic,
            ssh_public_key: public_key,
            ssh_private_key_path: ssh_private_key_path.to_string_lossy().to_string(),
        };
        instance.save(app)?;
        Ok(instance)
    }

    fn generate_mnemonic() -> Result<String, Box<dyn std::error::Error>> {
        let mut entropy = [0u8; 16];
        rand::thread_rng().fill_bytes(&mut entropy);

        let mnemonic = Mnemonic::from_entropy_in(Language::English, &entropy)?;

        Ok(mnemonic.to_string())
    }
}
