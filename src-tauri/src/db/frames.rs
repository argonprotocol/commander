use super::prelude::*;

#[derive(Debug, Clone, serde::Serialize, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct FrameRecord {
    pub id: u32,
    pub progress: f32,
    pub tick_start: u32,
    pub tick_end: u32,
    pub is_processed: bool,
    pub created_at: String,
    pub updated_at: String,
}

pub struct Frames;

impl Frames {
    pub fn insert_or_update(
        id: u32,
        tick_start: u32,
        tick_end: u32,
        progress: f32,
        is_processed: bool,
    ) -> Result<FrameRecord> {
        DB::query_one(
            "INSERT OR REPLACE INTO frames (id, tick_start, tick_end, progress, is_processed) 
             VALUES (?1, ?2, ?3, ?4, ?5) 
             RETURNING *",
            (id, tick_start, tick_end, progress, is_processed),
        )
    }

    pub fn update(
        id: u32,
        tick_start: u32,
        tick_end: u32,
        progress: f32,
        is_processed: bool,
    ) -> Result<()> {
        DB::execute("UPDATE frames SET tick_start = ?, tick_end = ?, progress = ?, is_processed = ? WHERE id = ?",
                    (tick_start, tick_end, progress, is_processed, id))?;

        Ok(())
    }

    pub fn fetch_by_id(id: u32) -> Result<FrameRecord> {
        DB::query_one("SELECT * FROM frames WHERE id = ?", (id,))
    }

    pub fn fetch_record_count() -> Result<u32> {
        DB::query_one_map("SELECT COUNT(*) FROM frames", (), |row| row.get(0))
    }

    pub fn latest_id() -> Result<u32> {
        DB::query_one_map("SELECT COALESCE(MAX(id), 0) FROM frames", (), |row| {
            row.get(0)
        })
    }
}
