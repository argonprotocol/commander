use super::ConfigFile;
use serde::{Deserialize, Serialize};
use std::fmt::Display;

#[derive(Deserialize, Serialize, Clone, Debug, PartialEq)]
pub enum InstallStatusErrorType {
    UbuntuCheck,
    FileCheck,
    DockerInstall,
    BitcoinInstall,
    ArgonInstall,
    DockerLaunch,
    Unknown,
}

impl Display for InstallStatusErrorType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        Ok(self.serialize(f)?)
    }
}

#[derive(Deserialize, Serialize, Clone, Default, Debug)]
#[serde(rename_all = "camelCase")]
pub struct InstallStatus {
    pub server: InstallStatusServer,
    pub client: InstallStatusClient,
}

impl Display for InstallStatus {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}", self)
    }
}

#[derive(Deserialize, Serialize, Clone, Default, Debug)]
#[serde(rename_all = "camelCase")]
pub struct InstallStatusServer {
    #[serde(rename = "UbuntuCheck")]
    pub ubuntu_check: i32,
    #[serde(rename = "FileCheck")]
    pub file_check: i32,
    #[serde(rename = "DockerInstall")]
    pub docker_install: i32,
    #[serde(rename = "BitcoinInstall")]
    pub bitcoin_install: i32,
    #[serde(rename = "ArgonInstall")]
    pub argon_install: i32,
    #[serde(rename = "DockerLaunch")]
    pub docker_launch: f32,
    pub error_type: Option<InstallStatusErrorType>,
    pub error_message: Option<String>,
    pub is_running: bool,
}

#[derive(Deserialize, Serialize, Clone, Default, Debug)]
pub struct InstallStatusClient {
    #[serde(rename = "ServerConnect")]
    pub server_connect: f32,
    #[serde(rename = "UbuntuCheck")]
    pub ubuntu_check: f32,
    #[serde(rename = "FileCheck")]
    pub file_check: f32,
    #[serde(rename = "DockerInstall")]
    pub docker_install: f32,
    #[serde(rename = "BitcoinInstall")]
    pub bitcoin_install: f32,
    #[serde(rename = "ArgonInstall")]
    pub argon_install: f32,
    #[serde(rename = "DockerLaunch")]
    pub docker_launch: f32,
}

impl ConfigFile<Self> for InstallStatus {
    const FILENAME: &'static str = "installStatus.json";
}