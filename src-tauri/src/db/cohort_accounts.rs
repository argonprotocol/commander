use super::DB;
use anyhow::Result;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CohortAccountRecord {
    pub frame_id_at_cohort_activation: u32,
    pub idx: u32,
    pub address: String,
    pub argons_bid: u64,
    pub bid_position: u32,
    pub created_at: String,
    pub updated_at: String,
}

pub struct CohortAccounts;

impl CohortAccounts {
    pub fn delete_for_cohort(frame_id_at_cohort_activation: u32) -> Result<()> {
        let lock = DB::get_connection()?;
        let conn = lock.lock().unwrap();
        
        let mut stmt = conn.prepare("DELETE FROM cohort_accounts WHERE frame_id_at_cohort_activation = ?")?;
        stmt.execute((frame_id_at_cohort_activation,))?;
        
        Ok(())
    }

    pub fn insert(
        frame_id_at_cohort_activation: u32,
        idx: u32,
        address: String,
        argons_bid: u64,
        bid_position: u32,
    ) -> Result<CohortAccountRecord> {
        let lock = DB::get_connection()?;
        let conn = lock.lock().unwrap();
        
        let mut stmt = conn.prepare(
            "INSERT INTO cohort_accounts (frame_id_at_cohort_activation, idx, address, argons_bid, bid_position) 
             VALUES (?1, ?2, ?3, ?4, ?5) 
             RETURNING *",
        )?;

        let cohort_account = stmt.query_row((frame_id_at_cohort_activation, idx, address, argons_bid, bid_position), |row| {
            Ok(CohortAccountRecord {
                frame_id_at_cohort_activation: row.get("frame_id_at_cohort_activation")?,
                idx: row.get("idx")?,
                address: row.get("address")?,
                argons_bid: row.get("argons_bid")?,
                bid_position: row.get("bid_position")?,
                created_at: row.get("created_at")?,
                updated_at: row.get("updated_at")?,
            })
        })?;

        Ok(cohort_account)
    }
}
