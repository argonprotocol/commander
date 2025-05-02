use anyhow::{anyhow, Result};
use lazy_static::lazy_static;
use log::info;
use rand::RngCore;
use rusqlite::Connection;
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tokio::sync::OnceCell;

pub mod frames;
pub mod cohorts;
pub mod cohort_frames;
pub mod cohort_accounts;
pub mod argon_activities;
pub mod bitcoin_activities;
pub mod bot_activities;

pub use frames::Frames;
pub use cohorts::Cohorts;
pub use cohort_frames::CohortFrames;
pub use cohort_accounts::CohortAccounts;
pub use argon_activities::ArgonActivities;
pub use bitcoin_activities::BitcoinActivities;
pub use bot_activities::BotActivities;
pub use argon_activities::ArgonActivityRecord;
pub use bitcoin_activities::BitcoinActivityRecord;
pub use bot_activities::BotActivityRecord;

lazy_static! {
    static ref DB_CONN: OnceCell<Arc<Mutex<Connection>>> = OnceCell::new();
}

pub enum DbAuthType {
    None,
    Password(String),
    Keychain,
}

pub struct DB;

impl DB {
    pub fn init() -> Result<()> {
        let db_path = Self::get_db_path();
        let db_dir = Path::new(&db_path).parent().unwrap();

        // If the parent directory does not exist, create it.
        if !db_dir.exists() {
            fs::create_dir_all(db_dir)?;
        }

        // Create the database file.
        info!("Create/update database file at {}", db_path);

        // TODO: auth is always None for now. We need to figure out how to handle in UI.
        let auth_type = DbAuthType::None;
        let auth_key = match auth_type {
            DbAuthType::None => None,
            DbAuthType::Password(p) => Some(p),
            DbAuthType::Keychain => Some(Self::get_key_from_keychain()?),
        };

        let conn = Self::get_or_encrypt_db(&db_path, auth_key)?;

        // Create activity tables
        let sql_files = [
            include_str!("../db-sql/frames.sql"),
            include_str!("../db-sql/cohorts.sql"),
            include_str!("../db-sql/cohort_frames.sql"),
            include_str!("../db-sql/cohort_accounts.sql"),
            include_str!("../db-sql/argon_activities.sql"),
            include_str!("../db-sql/bitcoin_activities.sql"),
            include_str!("../db-sql/bot_activities.sql"),
        ];

        for sql_file in sql_files {
            conn.execute(&sql_file, ())?;
        }
        DB_CONN.set(Arc::new(Mutex::new(conn)))?;

        Ok(())
    }

    pub fn get_connection() -> Result<Arc<Mutex<Connection>>> {
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

    pub fn get_or_encrypt_db(db_path: &str, key: Option<String>) -> Result<Connection> {
        info!("Opening database file at {}", db_path);
        let mut conn = Connection::open(&db_path)?;
        let Some(key) = key else {
            return Ok(conn);
        };

        if let Ok(bytes) = fs::read(db_path) {
            if bytes.starts_with(b"SQLite format 3") {
                conn.close().map_err(|(_c, e)| anyhow!(e))?;
                let encrypted_path = format!("{}.enc", db_path);
                info!("Database needs to be encrypted");
                let conn_encrypted = Connection::open(&encrypted_path)?;
                conn_encrypted.pragma_update(None, "key", &key)?;

                conn_encrypted.execute(
                    &format!("ATTACH DATABASE '{db_path}' AS plaintext KEY ''",),
                    (),
                )?;

                conn_encrypted.query_row(
                    "SELECT sqlcipher_export('main', 'plaintext')",
                    (),
                    |_| Ok(()),
                )?;
                conn_encrypted.execute("DETACH DATABASE plaintext", ())?;
                conn_encrypted.close().map_err(|(_c, e)| anyhow!(e))?;
                fs::rename(db_path, format!("{}.old", db_path))?;
                fs::rename(encrypted_path, db_path)?;
                conn = Connection::open(db_path)?;
            }
        }

        conn.pragma_update(None, "key", key)?;

        Ok(conn)
    }

    // Get the path where the database file should be located.
    pub fn get_db_path() -> String {
        let home_dir = dirs::home_dir().unwrap();
        home_dir
            .join(".config")
            .join("argon-commander")
            .join("database.sqlite")
            .to_str()
            .unwrap()
            .to_string()
    }
}
