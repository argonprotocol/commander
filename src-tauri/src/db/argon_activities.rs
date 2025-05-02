use super::DB;
use anyhow::Result;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArgonActivityRecord {
    pub localhost_block_number: u32,
    pub mainchain_block_number: u32,
    pub inserted_at: String,
}

pub struct ArgonActivities;

impl ArgonActivities {
    pub fn insert(localhost_block: u32, mainchain_block: u32) -> Result<ArgonActivityRecord> {
        let lock = DB::get_connection()?;
        let conn = lock.lock().unwrap();
        let mut stmt = conn.prepare(
            "INSERT INTO argon_activities (localhost_block_number, mainchain_block_number) 
             VALUES (?1, ?2) 
             RETURNING *",
        )?;
        let argon_activity = stmt.query_row((localhost_block, mainchain_block), |row| {
            Ok(ArgonActivityRecord {
                localhost_block_number: row.get("localhost_block_number")?,
                mainchain_block_number: row.get("mainchain_block_number")?,
                inserted_at: row.get("inserted_at")?,
            })
        })?;
        Ok(argon_activity)
    }

    pub fn fetch_last_five_records() -> Result<Vec<ArgonActivityRecord>> {
        let lock = DB::get_connection()?;
        let conn = lock.lock().unwrap();
        let mut stmt =
            conn.prepare("SELECT * FROM argon_activities ORDER BY inserted_at DESC LIMIT 5")?;
        let argon_activity_list = stmt
            .query_map([], |row| {
                Ok(ArgonActivityRecord {
                    localhost_block_number: row.get("localhost_block_number")?,
                    mainchain_block_number: row.get("mainchain_block_number")?,
                    inserted_at: row.get("inserted_at")?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(argon_activity_list)
    }
}

