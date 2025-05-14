use super::prelude::*;

#[derive(Debug, Clone, serde::Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CohortAccountRecord {
    pub idx: u32,
    pub cohort_id: u32,
    pub address: String,
    pub argons_bid: u64,
    pub bid_position: u32,
    pub created_at: String,
    pub updated_at: String,
}

pub struct CohortAccounts;

impl CohortAccounts {
    pub fn delete_for_cohort(cohort_id: u32) -> Result<()> {
        let _ = DB::execute(
            "DELETE FROM cohort_accounts WHERE cohort_id = ?",
            (cohort_id,),
        );
        Ok(())
    }

    pub fn insert(
        idx: u32,
        cohort_id: u32,
        address: String,
        argons_bid: u64,
        bid_position: u32,
    ) -> Result<CohortAccountRecord> {
        DB::query_one(
            "INSERT INTO cohort_accounts (idx, cohort_id, address, argons_bid, bid_position) 
             VALUES (?1, ?2, ?3, ?4, ?5) 
             RETURNING *",
            (
                idx,
                cohort_id,
                address,
                argons_bid,
                bid_position,
            )
        )
    }
}
