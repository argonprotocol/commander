use include_dir::{Dir, include_dir};
use tauri_plugin_sql::{Migration, MigrationKind};

static MIGRATIONS_DIR: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/migrations");

pub fn get_migrations() -> Vec<Migration> {
    MIGRATIONS_DIR
        .dirs()
        .filter_map(|dir| {
            let dir_name = dir.path().file_stem()?.to_str()?;
            let file_path = format!("{}/up.sql", dir.path().display());            
            let file = MIGRATIONS_DIR.get_file(&file_path)?;
            println!("Processing migration file: {} {}", file_path, file.contents_utf8()?);
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
