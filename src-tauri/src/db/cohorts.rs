use super::prelude::*;

#[derive(Debug, Clone, serde::Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CohortRecord {
    pub id: u32,
    pub progress: f32,
    pub transaction_fees: u64,
    pub argonots_staked: u64,
    pub argons_bid: u64,
    pub seats_won: u32,
    pub created_at: String,
    pub updated_at: String,
}

pub struct CohortRecordWithTicks {
    pub id: u32,
    pub frame_tick_start: u32,
    pub frame_tick_end: u32,
    pub transaction_fees: u64,
    pub argonots_staked: u64,
    pub argons_bid: u64,
    pub seats_won: u32,
}

pub struct Cohorts;

impl Cohorts {
    pub fn insert_or_update(
        id: u32,
        progress: f32,
        transaction_fees: u64,
        argonots_staked: u64,
        argons_bid: u64,
        seats_won: u32,
    ) -> Result<CohortRecord> {
        DB::query_one(
            "INSERT OR REPLACE INTO cohorts 
             (id, progress, transaction_fees, argonots_staked, argons_bid, seats_won) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6) 
             RETURNING *",
            (
                id,
                progress,
                transaction_fees,
                argonots_staked,
                argons_bid,
                seats_won,
            )
        )
    }

    pub fn fetch_latest_active_id() -> Result<Option<u32>> {
        let id = DB::query_map(
            "SELECT id FROM cohorts
            WHERE seats_won > 0
            ORDER BY id
            DESC LIMIT 1",
            [],
            |row| {
                Ok(row.get("id")?)
            },
        )?
        .pop();
        Ok(id)
    }

    pub fn fetch_by_id(id: u32) -> Result<Option<CohortRecordWithTicks>> {
        let record = DB::query_map(
            "SELECT cohorts.*, frames.tick_start FROM cohorts
            LEFT JOIN frames ON cohorts.id = frames.id
            WHERE seats_won > 0
            AND id = ?
            ORDER BY id
            DESC LIMIT 1",
            [id],
            |row| {
                Ok(CohortRecordWithTicks {
                    id: row.get("id")?,
                    frame_tick_start: row.get::<_, u32>("tick_start")?,
                    frame_tick_end: row.get::<_, u32>("tick_start")? + (1440 * 10),
                    transaction_fees: row.get("transaction_fees")?,
                    argonots_staked: row.get("argonots_staked")?,
                    argons_bid: row.get("argons_bid")?,
                    seats_won: row.get("seats_won")?,
                })
            },
        )?
        .pop();
        Ok(record)
    }

    pub fn fetch_global_stats(current_frame_id: u32) -> Result<(u32, u32, u64, u64)> {
        let (total_transaction_fees, total_argons_bid) = DB::query_one_map(
            "SELECT 
            COALESCE(sum(transaction_fees), 0) as total_transaction_fees, 
            COALESCE(sum(argons_bid), 0) as total_argons_bid
        FROM cohorts",
            [],
            |row| {
                Ok((
                    row.get("total_transaction_fees")?,
                    row.get("total_argons_bid")?,
                ))
            },
        )?;

        let oldest_active_frame_id = std::cmp::max(1, current_frame_id.saturating_sub(10));
        let (total_active_cohorts, total_active_seats) = DB::query_one_map(
            "SELECT 
            COALESCE(count(id), 0) as active_cohorts,
            COALESCE(sum(seats_won), 0) as active_seats
        FROM cohorts WHERE id >= ?",
            (oldest_active_frame_id,),
            |row| {
                Ok((
                    row.get::<_, u32>("active_cohorts")?,
                    row.get::<_, u32>("active_seats")?,
                ))
            },
        )?;

        Ok((
            total_active_cohorts,
            total_active_seats,
            total_transaction_fees,
            total_argons_bid,
        ))
    }
}
