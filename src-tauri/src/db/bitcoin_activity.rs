use super::DB;
use anyhow::Result;

#[derive(Debug, Clone, serde::Serialize)]
pub struct BitcoinActivity {
    #[serde(rename = "localhostBlockNumber")]
    pub localhost_block_number: u32,
    #[serde(rename = "mainchainBlockNumber")]
    pub mainchain_block_number: u32,
    #[serde(rename = "insertedAt")]
    pub inserted_at: String,
}

impl BitcoinActivity {
    pub fn insert(
        localhost_block_number: u32,
        mainchain_block_number: u32,
    ) -> Result<BitcoinActivity> {
        let lock = DB::get_connection()?;
        let conn = lock.lock().unwrap();

        let mut stmt = conn.prepare(
            "INSERT INTO bitcoin_activity (localhost_block_number, mainchain_block_number) 
             VALUES (?1, ?2) 
             RETURNING *",
        )?;
        let bitcoin_activity =
            stmt.query_row((localhost_block_number, mainchain_block_number), |row| {
                Ok(BitcoinActivity {
                    localhost_block_number: row.get("localhost_block_number")?,
                    mainchain_block_number: row.get("mainchain_block_number")?,
                    inserted_at: row.get("inserted_at")?,
                })
            })?;
        Ok(bitcoin_activity)
    }

    pub fn fetch_last_five_records() -> Result<Vec<BitcoinActivity>> {
        let lock = DB::get_connection()?;
        let conn = lock.lock().unwrap();

        let mut stmt =
            conn.prepare("SELECT * FROM bitcoin_activity ORDER BY inserted_at DESC LIMIT 5")?;
        let bitcoin_activity_list = stmt
            .query_map([], |row| {
                Ok(BitcoinActivity {
                    localhost_block_number: row.get("localhost_block_number")?,
                    mainchain_block_number: row.get("mainchain_block_number")?,
                    inserted_at: row.get("inserted_at")?,
                })
            })?
            .flatten()
            .collect::<Vec<_>>();
        Ok(bitcoin_activity_list)
    }
}
