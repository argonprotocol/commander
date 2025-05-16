use crate::config::ConfigFile;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct Base {
    pub requires_password: bool,
}

impl ConfigFile<Self> for Base {
    const FILENAME: &'static str = "base.json";
}
