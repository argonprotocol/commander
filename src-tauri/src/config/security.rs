use super::ConfigFile;
use serde::{Deserialize, Serialize};
use std::error::Error;

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Security {
    pub wallet_mnemonic: String,
    pub session_mnemonic: String,
    pub wallet_json: String,
}

impl ConfigFile<Option<Self>> for Security {
    const FILENAME: &'static str = "security.json";
}

impl Security {
    pub fn create(wallet_mnemonic: String, session_mnemonic: String, wallet_json: String) -> Result<Self, Box<dyn Error>> {
        let security = Self { wallet_mnemonic, session_mnemonic, wallet_json };
        security.save()?;
        Ok(security)
    }
}
