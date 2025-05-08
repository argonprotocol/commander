use super::DB;
use anyhow::Result;

#[derive(Debug, Clone, serde::Serialize)]
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
        let lock = DB::get_connection()?;
        let conn = lock.lock().unwrap();
        let mut stmt = conn.prepare(
            "INSERT INTO bitcoin_activities (localhost_block_number, mainchain_block_number) 
             VALUES (?1, ?2) 
             RETURNING *",
        )?;
        let bitcoin_activity =
            stmt.query_row((localhost_block_number, mainchain_block_number), |row| {
                Ok(BitcoinActivityRecord {
                    localhost_block_number: row.get("localhost_block_number")?,
                    mainchain_block_number: row.get("mainchain_block_number")?,
                    inserted_at: row.get("inserted_at")?,
                })
            })?;
        Ok(bitcoin_activity)
    }

    pub fn fetch_last_five_records() -> Result<Vec<BitcoinActivityRecord>> {
        let lock = DB::get_connection()?;
        let conn = lock.lock().unwrap();
        let mut stmt =
            conn.prepare("SELECT * FROM bitcoin_activities ORDER BY inserted_at DESC LIMIT 5")?;
        let bitcoin_activity_list = stmt
            .query_map([], |row| {
                Ok(BitcoinActivityRecord {
                    localhost_block_number: row.get("localhost_block_number")?,
                    mainchain_block_number: row.get("mainchain_block_number")?,
                    inserted_at: row.get("inserted_at")?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(bitcoin_activity_list)
    }
}
