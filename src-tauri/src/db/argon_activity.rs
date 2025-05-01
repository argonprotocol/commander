use super::DB;
use rusqlite::{Connection, Result};

#[derive(Debug, Clone, serde::Serialize)]
pub struct ArgonActivity {
    #[serde(rename = "localhostBlockNumber")]
    pub localhost_block_number: u32,
    #[serde(rename = "mainchainBlockNumber")]
    pub mainchain_block_number: u32,
    #[serde(rename = "insertedAt")]
    pub inserted_at: String,
}

impl ArgonActivity {
    pub fn insert(localhost_block: u32, mainchain_block: u32) -> Result<ArgonActivity> {
        let conn = Connection::open(DB::get_db_path())?;
        let mut stmt = conn.prepare(
            "INSERT INTO argon_activity (localhost_block_number, mainchain_block_number) 
             VALUES (?1, ?2) 
             RETURNING *",
        )?;
        let argon_activity = stmt.query_row((localhost_block, mainchain_block), |row| {
            Ok(ArgonActivity {
                localhost_block_number: row.get("localhost_block_number")?,
                mainchain_block_number: row.get("mainchain_block_number")?,
                inserted_at: row.get("inserted_at")?,
            })
        })?;
        Ok(argon_activity)
    }

    pub fn fetch_last_five_records() -> Result<Vec<ArgonActivity>> {
        let conn = Connection::open(DB::get_db_path())?;
        let mut stmt =
            conn.prepare("SELECT * FROM argon_activity ORDER BY inserted_at DESC LIMIT 5")?;
        let argon_activity_iter = stmt.query_map([], |row| {
            Ok(ArgonActivity {
                localhost_block_number: row.get("localhost_block_number")?,
                mainchain_block_number: row.get("mainchain_block_number")?,
                inserted_at: row.get("inserted_at")?,
            })
        })?;
        let argon_activity_list = argon_activity_iter.collect::<Result<Vec<_>>>()?;
        Ok(argon_activity_list)
    }
}
