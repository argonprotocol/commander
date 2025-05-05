use anyhow::{anyhow, Result};
use lazy_static::lazy_static;
use log::info;
use rand::RngCore;
use rusqlite::Connection;
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex};
use tokio::sync::OnceCell;

pub mod argon_activity;
pub mod bitcoin_activity;
pub mod bot_activity;

pub use argon_activity::ArgonActivity;
pub use bitcoin_activity::BitcoinActivity;
pub use bot_activity::BotActivity;

lazy_static! {
    static ref DB_CONN: OnceCell<Arc<Mutex<Connection>>> = OnceCell::new();
}
pub enum DbPassword {
    None,
    Password(String),
    Keychain,
}
pub struct DB;

impl DB {
    pub fn init(password: DbPassword) -> Result<()> {
        let db_path = Self::get_db_path();
        let db_dir = Path::new(&db_path).parent().unwrap();

        // If the parent directory does not exist, create it.
        if !db_dir.exists() {
            fs::create_dir_all(db_dir)?;
        }

        // Create the database file.
        info!("Create/update database file at {}", db_path);

        let key = match password {
            DbPassword::None => None,
            DbPassword::Password(p) => Some(p),
            DbPassword::Keychain => Some(Self::get_key_from_keychain()?),
        };

        let conn = Self::get_or_encrypt_db(&db_path, key)?;

        // Create activity tables
        let sql_files = [
            include_str!("../db-sql/argon_activity.sql"),
            include_str!("../db-sql/bitcoin_activity.sql"),
            include_str!("../db-sql/bot_activity.sql"),
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

// /// Attempts to fetch a server record, returns None if no records exist
// pub fn try_fetch_server_record() -> Result<Option<ServerRecord>> {
//     let conn = DB::get_connection()?;
//     let mut stmt = conn.prepare("SELECT * FROM server")?;
//     let mut server_iter = stmt.query_map([], |row| {
//         let status_str: String = row.get(5)?;
//         let setup_status: SetupStatus = serde_json::from_str(&status_str)
//             .unwrap_or(SetupStatus::default());

//         Ok(ServerRecord {
//             id: row.get(0)?,
//             address: row.get(1)?,
//             private_key: row.get(2)?,
//             public_key: row.get(3)?,
//             requires_password: if row.get::<_, i32>(4)? == 1 { true } else { false },
//             setup_status,
//         })
//     })?;

//     Ok(server_iter.next().transpose()?)
// }

// /// Attempts to fetch an account record, returns None if no records exist
// pub fn try_fetch_account_record() -> Result<Option<AccountRecord>> {
//     let conn = DB::get_connection()?;
//     let mut stmt = conn.prepare("SELECT * FROM account")?;
//     let mut account_iter = stmt.query_map([], |row| {
//         Ok(AccountRecord {
//             id: row.get(0)?,
//             address: row.get(1)?,
//             private_json: row.get(2)?,
//             requires_password: if row.get::<_, i32>(3)? == 1 { true } else { false },
//         })
//     })?;

//     Ok(account_iter.next().transpose()?)
// }

// /// Creates a new server record in the database
// pub fn create_server_record(
//     address: &str,
//     private_key: &str,
//     public_key: &str,
//     setup_status: &SetupStatus,
//     requires_password: bool,
// ) -> Result<i64> {
//     let conn = DB::get_connection()?;
//     let now = SystemTime::now()
//         .duration_since(UNIX_EPOCH)
//         .unwrap()
//         .as_secs()
//         .to_string();

//     let setup_status_json = serde_json::to_string(setup_status)
//         .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

//     conn.execute(
//         "INSERT INTO server (address, private_key, public_key, setup_status, requires_password, created_at, updated_at)
//          VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
//         (address, private_key, public_key, setup_status_json, if requires_password { 1 } else { 0 }, &now, &now),
//     )?;

//     let id = conn.last_insert_rowid();

//     Ok(id as i64)
// }

// /// Creates a new account record in the database
// pub fn create_account_record(
//     address: &str,
//     private_json: &str,
//     requires_password: bool,
// ) -> Result<i64> {
//     let conn = DB::get_connection()?;
//     let now = SystemTime::now()
//         .duration_since(UNIX_EPOCH)
//         .unwrap()
//         .as_secs()
//         .to_string();

//     conn.execute(
//         "INSERT INTO account (address, private_json, requires_password, created_at, updated_at)
//          VALUES (?1, ?2, ?3, ?4, ?5)",
//         (address, private_json, if requires_password { 1 } else { 0 }, &now, &now),
//     )?;

//     let id = conn.last_insert_rowid();

//     Ok(id as i64)
// }

// /// Updates a server record in the database
// pub fn update_server_record(
//     id: &i64,
//     address: &str,
//     private_key: &str,
//     public_key: &str,
//     setup_status: &SetupStatus,
//     requires_password: bool,
// ) -> Result<()> {
//     let conn = DB::get_connection()?;
//     let now = SystemTime::now()
//         .duration_since(UNIX_EPOCH)
//         .unwrap()
//         .as_secs()
//         .to_string();

//     let setup_status_json = serde_json::to_string(setup_status)
//         .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

//     conn.execute(
//         "UPDATE server
//          SET address = ?1, private_key = ?2, public_key = ?3, setup_status = ?4, requires_password = ?5, updated_at = ?6
//          WHERE id = ?7",
//         (address, private_key, public_key, setup_status_json, if requires_password { 1 } else { 0 }, &now, id),
//     )?;

//     Ok(())
// }

// /// Updates an account record in the database
// pub fn update_account_record(
//     id: &i64,
//     address: &str,
//     private_json: &str,
//     requires_password: bool,
// ) -> Result<()> {
//     let conn = DB::get_connection()?;
//     let now = SystemTime::now()
//         .duration_since(UNIX_EPOCH)
//         .unwrap()
//         .as_secs()
//         .to_string();

//     conn.execute(
//         "UPDATE account
//          SET address = ?1, private_json = ?2, requires_password = ?3, updated_at = ?4
//          WHERE id = ?5",
//         (address, private_json, if requires_password { 1 } else { 0 }, &now, id),
//     )?;

//     Ok(())
// }
