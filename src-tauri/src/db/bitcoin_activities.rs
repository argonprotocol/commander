use super::prelude::*;

#[derive(Debug, Clone, serde::Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct BitcoinActivityRecord {
    pub localhost_block_number: u32,
    pub mainchain_block_number: u32,
    pub inserted_at: String,
}

pub struct BitcoinActivities;

impl BitcoinActivities {
    pub fn insert(
        localhost_block_number: u32,
        mainchain_block_number: u32,
    ) -> Result<BitcoinActivityRecord> {
        DB::query_one(
            "INSERT INTO bitcoin_activities (localhost_block_number, mainchain_block_number) 
             VALUES (?1, ?2) 
             RETURNING *",
            (localhost_block_number, mainchain_block_number),
        )
    }

    pub fn fetch_last_five_records() -> Result<Vec<BitcoinActivityRecord>> {
        DB::query(
            "SELECT * FROM bitcoin_activities ORDER BY inserted_at DESC LIMIT 5",
            (),
        )
    }
}
