use serde::{Deserialize, Serialize};
use super::Config;
use std::error::Error;
use std::path::Path;

#[derive(Deserialize, Serialize, Clone)]
pub struct Base {
    #[serde(rename = "requiresPassword")]
    pub requires_password: bool,
}

impl Base {
    pub const FILENAME: &'static str = "base.json";

    pub fn load() -> Result<Self, Box<dyn Error>> {
        let file_path = Config::get_full_path(Self::FILENAME);

        if Path::new(&file_path).exists() {
            Config::load_from_json_file(Self::FILENAME)
        } else {
            Ok(Self::default())
        }
    }

    pub fn save(&self) -> Result<(), Box<dyn Error>> {
        Config::save_to_json_file(Self::FILENAME, self.clone())
    }
}

impl Default for Base {
    fn default() -> Self {
        Self {
            requires_password: false,
        }
    }
}
