use super::DB;
use anyhow::Result;

#[derive(Debug, Clone, serde::Serialize)]
pub struct BotActivity {
    #[serde(rename = "action")]
    pub action: String,
    #[serde(rename = "insertedAt")]
    pub inserted_at: String,
}

impl BotActivity {
    pub fn insert(action: &str, inserted_at: &str) -> Result<BotActivity> {
        let lock = DB::get_connection()?;
        let conn = lock.lock().unwrap();

        let mut stmt = conn.prepare(
            "INSERT INTO bot_activity (action, inserted_at) 
             VALUES (?1, ?2) 
             RETURNING *",
        )?;
        let bot_activity = stmt.query_row((action, inserted_at), |row| {
            Ok(BotActivity {
                action: row.get("action")?,
                inserted_at: row.get("inserted_at")?,
            })
        })?;
        Ok(bot_activity)
    }

    pub fn fetch_last_five_records() -> Result<Vec<BotActivity>> {
        let lock = DB::get_connection()?;
        let conn = lock.lock().unwrap();

        let mut stmt =
            conn.prepare("SELECT * FROM bot_activity ORDER BY inserted_at DESC LIMIT 5")?;
        let bot_activity_list = stmt
            .query_map([], |row| {
                Ok(BotActivity {
                    action: row.get("action")?,
                    inserted_at: row.get("inserted_at")?,
                })
            })?
            .flatten()
            .collect::<Vec<_>>();
        Ok(bot_activity_list)
    }
}
