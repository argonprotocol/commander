use rusqlite::{Connection, Result};
use std::fs;
use std::path::Path;

pub mod argon_activity;
pub mod bitcoin_activity;
pub mod bot_activity;

pub use argon_activity::ArgonActivity;
pub use bitcoin_activity::BitcoinActivity;
pub use bot_activity::BotActivity;

pub struct DB;

impl DB {
    pub fn init() -> Result<()> {
        if !Self::db_file_exists() {
            Self::create_db_file()?;
        }
        Ok(())
    }

    // Create the database file.
    fn create_db_file() -> Result<()> {
        let db_path = Self::get_db_path();
        let db_dir = Path::new(&db_path).parent().unwrap();

        // If the parent directory does not exist, create it.
        if !db_dir.exists() {
            fs::create_dir_all(db_dir).unwrap();
        }

        // Create the database file.
        println!("Creating database file at {}", db_path);
        fs::File::create(db_path).unwrap();
        Self::create_tables()?;
        Ok(())
    }

    fn create_tables() -> Result<()> {
        let conn = Connection::open(Self::get_db_path())?;
        // Create activity tables
        let sql_files = [
            "argon_activity.sql",
            "bitcoin_activity.sql",
            "bot_activity.sql",
        ];

        for sql_file in sql_files {
            let sql_path = format!("src/db-sql/{}", sql_file);
            let sql = fs::read_to_string(sql_path)
                .unwrap_or_else(|_| panic!("Failed to read {}", sql_file));

            conn.execute(&sql, ())?;
        }

        Ok(())
    }

    // Check whether the database file exists.
    fn db_file_exists() -> bool {
        let db_path = Self::get_db_path();
        Path::new(&db_path).exists()
    }

    // Get the path where the database file should be located.
    pub fn get_db_path() -> String {
        let home_dir = dirs::home_dir().unwrap();
        home_dir.to_str().unwrap().to_string() + "/.config/argon-commander/database.sqlite"
    }
}

// /// Attempts to fetch a server record, returns None if no records exist
// pub fn try_fetch_server_record() -> Result<Option<ServerRecord>> {
//     let conn = Connection::open(get_db_path())?;
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
//     let conn = Connection::open(get_db_path())?;
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
//     let conn = Connection::open(get_db_path())?;
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
//     let conn = Connection::open(get_db_path())?;
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
//     let conn = Connection::open(get_db_path())?;
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
//     let conn = Connection::open(get_db_path())?;
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
