use super::ConfigFile;
use serde::{Deserialize, Serialize};
use std::fmt::Display;

#[derive(Deserialize, Serialize, Clone, Debug)]
#[serde(rename_all = "lowercase")]
pub enum ServerStatusErrorType {
    Ubuntu,
    Git,
    Docker,
    BitcoinSync,
    ArgonSync,
    MinerLaunch,
    Unknown,
}

impl Display for ServerStatusErrorType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        Ok(self.serialize(f)?)
    }
}

#[derive(Deserialize, Serialize, Clone, Default, Debug)]
#[serde(rename_all = "camelCase")]
pub struct ServerStatus {
    pub ubuntu: i32,
    pub git: i32,
    pub docker: i32,
    pub bitcoinsync: i32,
    pub argonsync: i32,
    pub minerlaunch: f32,
    pub error_type: Option<ServerStatusErrorType>,
    pub error_message: Option<String>,
}

impl Display for ServerStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

impl ConfigFile<Self> for ServerStatus {
    const FILENAME: &'static str = "serverStatus.json";
}
