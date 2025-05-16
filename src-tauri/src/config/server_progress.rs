use super::ConfigFile;
use serde::{Deserialize, Serialize};

#[derive(Deserialize, Serialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct ServerProgress {
    pub ssh: f32,
    pub ubuntu: f32,
    pub system: f32,
    pub docker: f32,
    pub bitcoinsync: f32,
    pub argonsync: f32,
    pub minerlaunch: f32,
}

impl ConfigFile<Self> for ServerProgress {
    const FILENAME: &'static str = "serverProgress.json";
}
