use super::Config;
use serde::{Deserialize, Serialize};
use std::error::Error;
use std::path::Path;

#[derive(Deserialize, Serialize, Clone, Default)]
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
}
