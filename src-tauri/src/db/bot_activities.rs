use super::DB;
use anyhow::Result;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BotActivityRecord {
    pub action: String,
    pub inserted_at: String,
}

pub struct BotActivities;

impl BotActivities {
    pub fn insert(action: &str, inserted_at: &str) -> Result<BotActivityRecord> {
        let lock = DB::get_connection()?;
        let conn = lock.lock().unwrap();
        let mut stmt = conn.prepare(
            "INSERT INTO bot_activities (action, inserted_at) 
             VALUES (?1, ?2) 
             RETURNING *",
        )?;
        let bot_activity = stmt.query_row((action, inserted_at), |row| {
            Ok(BotActivityRecord {
                action: row.get("action")?,
                inserted_at: row.get("inserted_at")?,
            })
        })?;
        Ok(bot_activity)
    }

    pub fn fetch_last_five_records() -> Result<Vec<BotActivityRecord>> {
        let lock = DB::get_connection()?;
        let conn = lock.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT * FROM bot_activities ORDER BY inserted_at DESC LIMIT 5"
        )?;
        let bot_activity_list = stmt
            .query_map([], |row| {
                Ok(BotActivityRecord {
                    action: row.get("action")?,
                    inserted_at: row.get("inserted_at")?,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(bot_activity_list)
    }
}
