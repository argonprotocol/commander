use super::prelude::*;

#[derive(Debug, Clone, serde::Serialize, FromRow)]
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
        let _ = DB::execute(
            "DELETE FROM cohort_accounts WHERE frame_id_at_cohort_activation = ?",
            (frame_id_at_cohort_activation,),
        );
        Ok(())
    }

    pub fn insert(
        frame_id_at_cohort_activation: u32,
        idx: u32,
        address: String,
        argons_bid: u64,
        bid_position: u32,
    ) -> Result<CohortAccountRecord> {
        DB::query_one(
            "INSERT INTO cohort_accounts (frame_id_at_cohort_activation, idx, address, argons_bid, bid_position) 
             VALUES (?1, ?2, ?3, ?4, ?5) 
             RETURNING *",
            (
                frame_id_at_cohort_activation,
                idx,
                address,
                argons_bid,
                bid_position,
            )
        )
    }
}
