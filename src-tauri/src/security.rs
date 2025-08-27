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
    pub ssh_private_key: String,
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
            let ssh_private_key = fs::read_to_string(&private_key_path)?;

            Ok(Self {
                ssh_public_key,
                ssh_private_key,
                master_mnemonic,
            })
        } else {
            let security = Security::new()?;
            security.save(app)?;
            Ok(security)
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
        fs::write(
            absolute_config_dir.join("serverkey.pem"),
            &self.ssh_private_key,
        )?;

        // Set private key permissions to 600
        #[cfg(not(target_os = "windows"))]
        {
            let private_key_path = absolute_config_dir.join("serverkey.pem");
            let mut perms = fs::metadata(&private_key_path)?.permissions();
            perms.set_mode(0o600);
            fs::set_permissions(&private_key_path, perms)?;
        }

        Ok(())
    }

    pub fn new() -> Result<Self, Box<dyn std::error::Error>> {
        let (private_key, public_key) = SSH::generate_keys()?;

        Ok(Self {
            master_mnemonic: Self::generate_mnemonic()?,
            ssh_public_key: public_key,
            ssh_private_key: private_key,
        })
    }

    fn generate_mnemonic() -> Result<String, Box<dyn std::error::Error>> {
        let mut entropy = [0u8; 16];
        rand::thread_rng().fill_bytes(&mut entropy);

        let mnemonic = Mnemonic::from_entropy_in(Language::English, &entropy)?;

        Ok(mnemonic.to_string())
    }
}
