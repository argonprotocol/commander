use super::prelude::*;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct ArgonActivityRecord {
    pub localhost_block_number: u32,
    pub mainchain_block_number: u32,
    pub inserted_at: String,
}

pub struct ArgonActivities;

impl ArgonActivities {
    pub fn insert(localhost_block: u32, mainchain_block: u32) -> Result<ArgonActivityRecord> {
        DB::query_one(
            "INSERT INTO argon_activities (localhost_block_number, mainchain_block_number)
             VALUES (?1, ?2)
             RETURNING *",
            (localhost_block, mainchain_block),
        )
    }

    pub fn latest() -> Result<ArgonActivityRecord> {
        DB::query_one(
            "SELECT * FROM argon_activities ORDER BY inserted_at DESC LIMIT 1",
            (),
        )
    }

    pub fn fetch_last_five_records() -> Result<Vec<ArgonActivityRecord>> {
        DB::query(
            "SELECT * FROM argon_activities ORDER BY inserted_at DESC LIMIT 5",
            (),
        )
    }
}
