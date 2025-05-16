use super::ConfigFile;
use serde::{Deserialize, Serialize};
use std::error::Error;

#[derive(Deserialize, Serialize, Clone)]
pub struct Mnemonics {
    pub wallet: String,
    pub session: String,
}

impl ConfigFile<Option<Self>> for Mnemonics {
    const FILENAME: &'static str = "mnemonics.json";
}

impl Mnemonics {
    pub fn create(wallet: String, session: String) -> Result<Self, Box<dyn Error>> {
        let mnemonics = Self { wallet, session };
        mnemonics.save()?;
        Ok(mnemonics)
    }
}
