use super::prelude::*;

#[derive(Debug, Clone, serde::Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct CohortFrameRecord {
    pub frame_id: u32,
    pub cohort_id: u32,
    pub blocks_mined: u32,
    pub argonots_mined: u64,
    pub argons_mined: u64,
    pub argons_minted: u64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, FromRow)]
pub struct CohortFrameStats {
    pub total_blocks_mined: u32,
    pub total_argonots_mined: u64,
    pub total_argons_mined: u64,
    pub total_argons_minted: u64,
}

pub struct CohortFrames;

impl CohortFrames {
    pub fn insert_or_update(
        frame_id: u32,
        cohort_id: u32,
        blocks_mined: u32,
        argonots_mined: u64,
        argons_mined: u64,
        argons_minted: u64,
    ) -> Result<CohortFrameRecord> {
        DB::query_one(
            "INSERT OR REPLACE INTO cohort_frames 
             (frame_id, cohort_id, blocks_mined, argonots_mined, argons_mined, argons_minted) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6) 
             RETURNING *",
            (
                frame_id,
                cohort_id,
                blocks_mined,
                argonots_mined,
                argons_mined,
                argons_minted,
            )
        )
    }

    pub fn fetch_global_stats() -> Result<(u32, u64, u64, u64)> {
        let stats: CohortFrameStats = DB::query_one(
            "SELECT 
            COALESCE(sum(blocks_mined), 0) as total_blocks_mined,
            COALESCE(sum(argonots_mined), 0) as total_argonots_mined,
            COALESCE(sum(argons_mined), 0) as total_argons_mined,
            COALESCE(sum(argons_minted), 0) as total_argons_minted
        FROM cohort_frames",
            (),
        )?;

        Ok((
            stats.total_blocks_mined,
            stats.total_argonots_mined,
            stats.total_argons_mined,
            stats.total_argons_minted,
        ))
    }

    pub fn fetch_cohort_stats(cohort_id: u32) -> Result<(u32, u64, u64, u64)> {
        let stats: CohortFrameStats = DB::query_one(
            "SELECT 
            COALESCE(sum(blocks_mined), 0) as total_blocks_mined,
            COALESCE(sum(argonots_mined), 0) as total_argonots_mined,
            COALESCE(sum(argons_mined), 0) as total_argons_mined,
            COALESCE(sum(argons_minted), 0) as total_argons_minted
        FROM cohort_frames WHERE cohort_id = ?1",
            (cohort_id, ),
        )?;

        Ok((
            stats.total_blocks_mined,
            stats.total_argonots_mined,
            stats.total_argons_mined,
            stats.total_argons_minted,
        ))
    }
}
