use include_dir::{Dir, include_dir};
use tauri_plugin_sql::{Migration, MigrationKind};
use std::path::PathBuf;
use sqlx::{
    error::BoxDynError,
    migrate::{Migration as SqlxMigration, MigrationSource, Migrator},
};
use std::pin::Pin;
use std::future::Future;

static MIGRATIONS_DIR: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/migrations");

#[derive(Debug)]
struct MigrationList(Vec<Migration>);

impl MigrationSource<'static> for MigrationList {
    fn resolve(self) -> Pin<Box<dyn Future<Output = std::result::Result<Vec<SqlxMigration>, BoxDynError>> + Send + 'static>> {
        Box::pin(async move {
            let mut migrations = Vec::new();
            for migration in self.0 {
                if matches!(migration.kind, MigrationKind::Up) {
                    migrations.push(SqlxMigration::new(
                        migration.version,
                        migration.description.into(),
                        migration.kind.into(),
                        migration.sql.into(),
                        false,
                    ));
                }
            }
            Ok(migrations)
        })
    }
}

pub fn get_migrations() -> Vec<Migration> {
    MIGRATIONS_DIR
        .dirs()
        .filter_map(|dir| {
            let dir_name = dir.path().file_stem()?.to_str()?;
            let file_path = format!("{}/up.sql", dir.path().display());
            let file = MIGRATIONS_DIR.get_file(&file_path)?;
            println!(
                "Processing migration file: {}",
                file_path,
                // file.contents_utf8()?
            );
            let mut parts = dir_name.splitn(2, '-');
            let version = parts.next()?.parse::<i64>().ok()?;
            let description = parts.next()?;
            let sql = file.contents_utf8()?;

            Some(Migration {
                version,
                description,
                sql,
                kind: MigrationKind::Up,
            })
        })
        .collect()
}

pub async fn run_db_migrations(absolute_db_path: PathBuf) -> Result<(), String> {    
    let opts = sqlx::sqlite::SqliteConnectOptions::new()
        .filename(&absolute_db_path)
        .create_if_missing(true);

    let pool = sqlx::SqlitePool::connect_with(opts)
        .await
        .map_err(|e| format!("Failed to connect to database: {}", e))?;
    
    let migrations = MigrationList(get_migrations());
    let migrator = Migrator::new(migrations)
        .await
        .map_err(|e| format!("Failed to create migrator: {}", e))?;
    migrator.run(&pool)
        .await
        .map_err(|e| format!("Failed to run migrations: {}", e))?;

    pool.close().await;
    Ok(())
}