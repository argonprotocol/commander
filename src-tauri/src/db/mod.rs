use anyhow::{anyhow, Result};
use include_dir::{include_dir, Dir};
use lazy_static::lazy_static;
use log::info;
use rand::RngCore;
use rusqlite::{Connection, Params, Row};
use rusqlite_migration::Migrations;
use std::fs;
use std::fs::File;
use std::io::Read;
use std::path::PathBuf;
use std::sync::{Arc, LazyLock, Mutex};
use tokio::sync::OnceCell;
use crate::config::Config;

pub mod argon_activities;
pub mod bitcoin_activities;
pub mod bot_activities;
pub mod cohort_accounts;
pub mod cohort_frames;
pub mod cohorts;
pub mod frames;

pub use frames::Frames;
pub use argon_activities::ArgonActivities;
pub use argon_activities::ArgonActivityRecord;
pub use bitcoin_activities::BitcoinActivities;
pub use bitcoin_activities::BitcoinActivityRecord;
pub use bot_activities::BotActivities;
pub use bot_activities::BotActivityRecord;
pub use cohort_accounts::CohortAccounts;
pub use cohort_frames::CohortFrames;
pub use cohorts::Cohorts;

lazy_static! {
    static ref DB_CONN: OnceCell<Arc<Mutex<Connection>>> = OnceCell::new();
}

static MIGRATIONS: LazyLock<Migrations<'static>> =
    LazyLock::new(|| Migrations::from_directory(&MIGRATIONS_DIR).unwrap());

static MIGRATIONS_DIR: Dir = include_dir!("$CARGO_MANIFEST_DIR/migrations");

pub enum DbAuthType {
    None,
    Password(String),
    Keychain,
}

pub mod prelude {
    pub use super::RecordFromRow;
    pub use super::DB;
    pub use anyhow::Result;
    pub use macros::FromRow;
}

pub struct DB;

pub trait RecordFromRow {
    fn from_row(row: &rusqlite::Row<'_>) -> rusqlite::Result<Self>
    where
        Self: Sized;
}

impl DB {
    pub fn init() -> Result<()> {
        let db_path = Self::get_db_path();

        // If the parent directory does not exist, create it.
        if !db_path.exists() {
            let db_dir = db_path.parent().unwrap();
            fs::create_dir_all(db_dir)?;
        }

        // Create the database file.
        info!("Create/update database file at {}", db_path.display());

        // TODO: auth is always None for now. We need to figure out how to handle in UI.
        let auth_type = DbAuthType::None;
        let auth_key = match auth_type {
            DbAuthType::None => None,
            DbAuthType::Password(p) => Some(p),
            DbAuthType::Keychain => Some(Self::get_key_from_keychain()?),
        };

        let mut conn = Self::get_or_encrypt_db(&db_path, auth_key)?;

        MIGRATIONS.to_latest(&mut conn)?;
        DB_CONN.set(Arc::new(Mutex::new(conn)))?;

        Ok(())
    }

    pub fn execute<P: Params>(sql: &str, params: P) -> Result<usize> {
        let lock = Self::get_connection()?;
        let conn = lock.lock().unwrap();
        let mut stmt = conn.prepare(sql)?;
        let rows_affected = stmt.execute(params)?;
        Ok(rows_affected)
    }

    pub fn query_one<T: RecordFromRow, P: Params>(sql: &str, params: P) -> Result<T> {
        Self::query_one_map(sql, params, T::from_row)
    }

    pub fn query_one_map<T, F: FnMut(&Row<'_>) -> rusqlite::Result<T>, P: Params>(
        sql: &str,
        params: P,
        from_row: F,
    ) -> Result<T> {
        let lock = Self::get_connection()?;
        let conn = lock.lock().unwrap();
        let mut stmt = conn.prepare(sql)?;
        let row = stmt.query_row(params, from_row)?;
        Ok(row)
    }

    pub fn query<T: RecordFromRow, P: Params>(sql: &str, params: P) -> Result<Vec<T>> {
        Self::query_map(sql, params, T::from_row)
    }

    pub fn query_map<T, F: FnMut(&Row<'_>) -> rusqlite::Result<T>, P: Params>(
        sql: &str,
        params: P,
        map_rows: F,
    ) -> Result<Vec<T>> {
        let lock = Self::get_connection()?;
        let conn = lock.lock().unwrap();
        let mut stmt = conn.prepare(sql)?;
        let rows = stmt.query_map(params, map_rows)?;
        let records = rows.collect::<Result<Vec<_>, _>>()?;
        Ok(records)
    }

    fn get_connection() -> Result<Arc<Mutex<Connection>>> {
        let conn = DB_CONN.get().ok_or_else(|| anyhow!("DB not initialized"))?;
        Ok(conn.clone())
    }

    pub fn get_key_from_keychain() -> Result<String> {
        let key_entry = keyring::Entry::new("argon-commander", "db_key")?;
        let key = match key_entry.get_password() {
            Ok(k) => k,
            Err(_) => {
                let mut key = [0u8; 32]; // 256-bit key
                rand::thread_rng().fill_bytes(&mut key);
                let new_key = hex::encode(&key);

                key_entry.set_password(&new_key)?;
                new_key
            }
        };
        Ok(key)
    }

    pub fn get_or_encrypt_db(db_path: &PathBuf, key: Option<String>) -> Result<Connection> {
        info!("Opening database file at {}", db_path.display());
        let mut conn = Connection::open(&db_path)?;
        let Some(key) = key else {
            return Ok(conn);
        };

        if Self::is_existing_db_unencrypted(db_path) {
            conn.close().map_err(|(_c, e)| anyhow!(e))?;
            let encrypted_path = format!("{}.enc", db_path.display());
            info!("Database needs to be encrypted");
            let conn_encrypted = Connection::open(&encrypted_path)?;
            conn_encrypted.pragma_update(None, "key", &key)?;

            conn_encrypted.execute(
                &format!("ATTACH DATABASE '{}' AS plaintext KEY ''", db_path.display()),
                (),
            )?;

            conn_encrypted.query_row("SELECT sqlcipher_export('main', 'plaintext')", (), |_| {
                Ok(())
            })?;
            conn_encrypted.execute("DETACH DATABASE plaintext", ())?;
            conn_encrypted.close().map_err(|(_c, e)| anyhow!(e))?;
            fs::rename(db_path, format!("{}.old", db_path.display()))?;
            fs::rename(encrypted_path, db_path)?;
            conn = Connection::open(db_path)?;
        }

        conn.pragma_update(None, "key", key)?;

        Ok(conn)
    }

    fn is_existing_db_unencrypted(db_path: &PathBuf) -> bool {
        let mut header = [0u8; 16];
        let did_read = File::open(db_path)
            .and_then(|mut f| f.read_exact(&mut header))
            .is_ok();
        // if the file is not encrypted, it will start with "SQLite format 3"
        did_read && header.starts_with(b"SQLite format 3")
    }

    // Get the path where the database file should be located.
    pub fn get_db_path() -> PathBuf {
        Config::get_config_dir()
            .join("database.sqlite")
    }
}
