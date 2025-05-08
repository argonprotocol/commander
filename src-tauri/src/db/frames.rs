use super::DB;
use anyhow::Result;

#[derive(Debug, Clone, serde::Serialize)]
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
        let lock = DB::get_connection()?;
        let conn = lock.lock().unwrap();
        let mut stmt = conn.prepare(
            "INSERT OR REPLACE INTO frames (id, tick_start, tick_end, progress, is_processed) 
             VALUES (?1, ?2, ?3, ?4, ?5) 
             RETURNING *",
        )?;
        let new_record = stmt.query_row((id, tick_start, tick_end, progress, is_processed), |row| {
            Ok(FrameRecord {
                id: row.get("id")?,
                progress: row.get("progress")?,
                tick_start: row.get("tick_start")?,
                tick_end: row.get("tick_end")?,
                is_processed: row.get("is_processed")?,
                created_at: row.get("created_at")?,
                updated_at: row.get("updated_at")?,
            })
        })?;

        Ok(new_record)
    }

    pub fn update(id: u32, tick_start: u32, tick_end: u32, progress: f32, is_processed: bool) -> Result<()> {
        let lock = DB::get_connection()?;
        let conn = lock.lock().unwrap();
        let mut stmt = conn.prepare("UPDATE frames SET tick_start = ?, tick_end = ?, progress = ?, is_processed = ? WHERE id = ?")?;
        stmt.execute((tick_start, tick_end, progress, is_processed, id))?;
        
        Ok(())
    }

    pub fn fetch_by_id(id: u32) -> Result<FrameRecord> {
        let lock = DB::get_connection()?;
        let conn = lock.lock().unwrap();
        let mut stmt = conn.prepare("SELECT * FROM frames WHERE id = ?")?;
        let record = stmt.query_row((id,), |row| {
            Ok(FrameRecord {
                id: row.get("id")?,
                tick_start: row.get("tick_start")?,
                tick_end: row.get("tick_end")?,
                progress: row.get("progress")?,
                is_processed: row.get("is_processed")?,
                created_at: row.get("created_at")?,
                updated_at: row.get("updated_at")?,
            })
        })?;

        Ok(record)
    }

    pub fn fetch_record_count() -> Result<u32> {
        let lock = DB::get_connection()?;
        let conn = lock.lock().unwrap();
        let mut stmt = conn.prepare("SELECT COUNT(*) FROM frames")?;
        let count = stmt.query_row([], |row| row.get(0))?;
        Ok(count)
    }

    pub fn latest_id() -> Result<u32> {
        let lock = DB::get_connection()?;
        let conn = lock.lock().unwrap();
        let mut stmt = conn.prepare("SELECT COALESCE(MAX(id), 0) FROM frames")?;
        let latest_id = stmt.query_row([], |row| row.get(0))?;
        
        Ok(latest_id)
    }
}
