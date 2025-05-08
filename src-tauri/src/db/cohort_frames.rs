use super::DB;
use anyhow::Result;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CohortFrameRecord {
    pub frame_id: u32,
    pub frame_id_at_cohort_activation: u32,
    pub blocks_mined: u32,
    pub argonots_mined: u64,
    pub argons_mined: u64,
    pub argons_minted: u64,
    pub created_at: String,
    pub updated_at: String,
}

pub struct CohortFrames;

impl CohortFrames {
    pub fn insert_or_update(
        frame_id: u32,
        frame_id_at_cohort_activation: u32,
        blocks_mined: u32,
        argonots_mined: u64,
        argons_mined: u64,
        argons_minted: u64,
    ) -> Result<CohortFrameRecord> {
        let lock = DB::get_connection()?;
        let conn = lock.lock().unwrap();
        
        let mut stmt = conn.prepare(
            "INSERT OR REPLACE INTO cohort_frames 
             (frame_id, frame_id_at_cohort_activation, blocks_mined, argonots_mined, argons_mined, argons_minted) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6) 
             RETURNING *"
        )?;
        
        let cohort_frame = stmt.query_row((frame_id, frame_id_at_cohort_activation, blocks_mined, argonots_mined, argons_mined, argons_minted), |row| {
            Ok(CohortFrameRecord {
                frame_id: row.get("frame_id")?,
                frame_id_at_cohort_activation: row.get("frame_id_at_cohort_activation")?,
                blocks_mined: row.get("blocks_mined")?,
                argonots_mined: row.get("argonots_mined")?,
                argons_mined: row.get("argons_mined")?,
                argons_minted: row.get("argons_minted")?,
                created_at: row.get("created_at")?,
                updated_at: row.get("updated_at")?,
            })
        })?;

        Ok(cohort_frame)
    }

    pub fn fetch_global_stats() -> Result<(u32, u64, u64, u64)> {
        let lock = DB::get_connection()?;
        let conn = lock.lock().unwrap();

        let mut stmt3 = conn.prepare("SELECT 
            COALESCE(sum(blocks_mined), 0) as total_blocks_mined,
            COALESCE(sum(argonots_mined), 0) as total_argonots_mined,
            COALESCE(sum(argons_mined), 0) as total_argons_mined,
            COALESCE(sum(argons_minted), 0) as total_argons_minted
        FROM cohort_frames")?;
        
        let (total_blocks_mined, total_argonots_mined, total_argons_mined, total_argons_minted) = stmt3.query_row([], |row| {
            Ok((
                row.get("total_blocks_mined")?,
                row.get("total_argonots_mined")?,
                row.get("total_argons_mined")?,
                row.get("total_argons_minted")?
            ))
        })?;

        Ok((total_blocks_mined, total_argonots_mined, total_argons_mined, total_argons_minted))
    }

    pub fn fetch_cohort_stats(frame_id_at_cohort_activation: u32) -> Result<(u32, u64, u64, u64)> {
        let lock = DB::get_connection()?;
        let conn = lock.lock().unwrap();

        let mut stmt = conn.prepare("SELECT 
            COALESCE(sum(blocks_mined), 0) as total_blocks_mined,
            COALESCE(sum(argonots_mined), 0) as total_argonots_mined,
            COALESCE(sum(argons_mined), 0) as total_argons_mined,
            COALESCE(sum(argons_minted), 0) as total_argons_minted
        FROM cohort_frames WHERE frame_id_at_cohort_activation = ?1")?;

        let (blocks_mined, argonots_mined, argons_mined, argons_minted) = stmt.query_row((frame_id_at_cohort_activation,), |row| {
            Ok((
                row.get("total_blocks_mined")?,
                row.get("total_argonots_mined")?,
                row.get("total_argons_mined")?,
                row.get("total_argons_minted")?
            ))
        })?;

        Ok((blocks_mined, argonots_mined, argons_mined, argons_minted))
    }
}
