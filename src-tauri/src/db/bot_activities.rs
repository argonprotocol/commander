use super::prelude::*;


#[derive(Debug, Clone, serde::Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct BotActivityRecord {
    pub action: String,
    pub inserted_at: String,
}

pub struct BotActivities;

impl BotActivities {
    pub fn insert(action: &str, inserted_at: &str) -> Result<BotActivityRecord> {
        DB::query_one(
            "INSERT INTO bot_activities (action, inserted_at) 
             VALUES (?1, ?2) 
             RETURNING *",
            (action, inserted_at),
        )
    }

    pub fn fetch_last_five_records() -> Result<Vec<BotActivityRecord>> {
        DB::query(
            "SELECT * FROM bot_activities ORDER BY inserted_at DESC LIMIT 5",
            (),
        )
    }
}
