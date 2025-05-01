use super::Config;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::path::Path;

#[derive(Deserialize, Serialize, Clone)]
pub struct Mnemonics {
    pub wallet: String,
    pub session: String,
}

impl Mnemonics {
    pub const FILENAME: &'static str = "mnemonics.json";

    pub fn create(wallet: String, session: String) -> Result<Self, Box<dyn Error>> {
        let mnemonics = Self { wallet, session };
        mnemonics.save()?;
        Ok(mnemonics)
    }

    pub fn load() -> Result<Option<Self>, Box<dyn Error>> {
        let file_path = Config::get_full_path(Self::FILENAME);

        if Path::new(&file_path).exists() {
            Config::load_from_json_file(Self::FILENAME).map(Some)
        } else {
            Ok(None)
        }
    }

    pub fn save(&self) -> Result<(), Box<dyn Error>> {
        Config::save_to_json_file(Self::FILENAME, self.clone())
    }
}
