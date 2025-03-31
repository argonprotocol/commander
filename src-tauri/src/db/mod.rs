use std::fs;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use rusqlite::{Connection, Result};
use serde_json;

#[derive(Default, Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct SetupStatus {
    pub ubuntu: i32,
    pub git: i32,
    pub docker: i32,
    pub blocksync: f32,
}

#[derive(Debug, Clone)]
pub struct ServerRecord {
    pub id: i64,
    pub address: String,
    pub private_key: String,
    pub public_key: String,
    pub requires_password: bool,
    pub setup_status: SetupStatus,
}

#[derive(Debug, Clone)]
pub struct AccountRecord {
    pub id: i64,
    pub address: String,
    pub private_json: String,
    pub requires_password: bool,
}

// Check if a database file exists, and create one if it does not.
pub fn init() -> Result<()> {
    if !db_file_exists() {
        create_db_file()?;
    }
    Ok(())
}

/// Attempts to fetch a server record, returns None if no records exist
pub fn try_fetch_server_record() -> Result<Option<ServerRecord>> {
    let conn = Connection::open(get_db_path())?;
    let mut stmt = conn.prepare("SELECT * FROM server")?;
    let mut server_iter = stmt.query_map([], |row| {
        let status_str: String = row.get(4)?;
        let setup_status: SetupStatus = serde_json::from_str(&status_str)
            .unwrap_or(SetupStatus::default());
            
        Ok(ServerRecord {   
            id: row.get(0)?,
            address: row.get(1)?,
            private_key: row.get(2)?,
            public_key: row.get(3)?,
            requires_password: if row.get::<_, i32>(4)? == 1 { true } else { false },
            setup_status,
        })
    })?;

    Ok(server_iter.next().transpose()?)
}

/// Attempts to fetch an account record, returns None if no records exist
pub fn try_fetch_account_record() -> Result<Option<AccountRecord>> {
    let conn = Connection::open(get_db_path())?;
    let mut stmt = conn.prepare("SELECT * FROM account")?;
    let mut account_iter = stmt.query_map([], |row| {            
        Ok(AccountRecord {   
            id: row.get(0)?,
            address: row.get(1)?,
            private_json: row.get(2)?,
            requires_password: if row.get::<_, i32>(3)? == 1 { true } else { false },
        })
    })?;

    Ok(account_iter.next().transpose()?)
}

/// Creates a new server record in the database
pub fn create_server_record(
    address: &str,
    private_key: &str,
    public_key: &str,
    setup_status: &SetupStatus,
    requires_password: bool,
) -> Result<i64> {
    let conn = Connection::open(get_db_path())?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
        .to_string();
    
    let setup_status_json = serde_json::to_string(setup_status)
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

    conn.execute(
        "INSERT INTO server (address, key_private, key_public, setup_status, requires_password, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        (address, private_key, public_key, setup_status_json, if requires_password { 1 } else { 0 }, &now, &now),
    )?;

    let id = conn.last_insert_rowid();
    
    Ok(id as i64)
}

/// Creates a new account record in the database
pub fn create_account_record(
    address: &str,
    private_json: &str,
    requires_password: bool,
) -> Result<i64> {
    let conn = Connection::open(get_db_path())?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
        .to_string();

    conn.execute(
        "INSERT INTO account (address, private_json, requires_password, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        (address, private_json, if requires_password { 1 } else { 0 }, &now, &now),
    )?;

    let id = conn.last_insert_rowid();
    
    Ok(id as i64)
}

/// Updates a server record in the database
pub fn update_server_record(
    id: &i64,
    address: &str,
    private_key: &str,
    public_key: &str,
    setup_status: &SetupStatus,
    requires_password: bool,
) -> Result<()> {
    let conn = Connection::open(get_db_path())?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
        .to_string();

    let setup_status_json = serde_json::to_string(setup_status)
        .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(e)))?;

    conn.execute(
        "UPDATE server 
         SET address = ?1, key_private = ?2, key_public = ?3, setup_status = ?4, requires_password = ?5, updated_at = ?6
         WHERE id = ?7",
        (address, private_key, public_key, setup_status_json, if requires_password { 1 } else { 0 }, &now, id),
    )?;

    Ok(())
}

/// Updates an account record in the database
pub fn update_account_record(
    id: &i64,
    address: &str,
    private_json: &str,
    requires_password: bool,
) -> Result<()> {
    let conn = Connection::open(get_db_path())?;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
        .to_string();

    conn.execute(
        "UPDATE account 
         SET address = ?1, private_json = ?2, requires_password = ?3, updated_at = ?4
         WHERE id = ?5",
        (address, private_json, if requires_password { 1 } else { 0 }, &now, id),
    )?;

    Ok(())
}


// Create the database file.
fn create_db_file() -> Result<()> {
    let db_path = get_db_path();
    let db_dir = Path::new(&db_path).parent().unwrap();

    // If the parent directory does not exist, create it.
    if !db_dir.exists() {
        fs::create_dir_all(db_dir).unwrap();
    }

    // Create the database file.
    println!("Creating database file at {}", db_path);
    fs::File::create(db_path).unwrap();
    create_server_table()?;
    create_account_table()?;
    Ok(())
}

// Check whether the database file exists.
fn db_file_exists() -> bool {
    let db_path = get_db_path();
    Path::new(&db_path).exists()
}

// Get the path where the database file should be located.
fn get_db_path() -> String {
    let home_dir = dirs::home_dir().unwrap();
    home_dir.to_str().unwrap().to_string() + "/.config/argon-commander/database.sqlite"
}

fn create_server_table() -> Result<()> {
    let conn = Connection::open(get_db_path())?;
    conn.execute(
        "CREATE TABLE server (
            id                INTEGER PRIMARY KEY,
            address           TEXT NOT NULL,
            private_key       TEXT NOT NULL,
            public_key        TEXT NOT NULL,
            requires_password BOOLEAN NOT NULL DEFAULT 0,
            setup_status      TEXT NOT NULL,
            created_at        TEXT NOT NULL,
            updated_at        TEXT NOT NULL
        )",
        (), // empty list of parameters.
    )?;

    Ok(())
}

fn create_account_table() -> Result<()> {
    let conn = Connection::open(get_db_path())?;
    conn.execute(
        "CREATE TABLE account (
            id                INTEGER PRIMARY KEY,
            address           TEXT NOT NULL,
            private_json      TEXT NOT NULL,
            requires_password BOOLEAN NOT NULL DEFAULT 0,
            created_at        TEXT NOT NULL,
            updated_at        TEXT NOT NULL
        )",
        (), // empty list of parameters.
    )?;

    Ok(())
}