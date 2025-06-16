use include_dir::{Dir, include_dir};
use tauri_plugin_sql::{Migration, MigrationKind};

static MIGRATIONS_DIR: Dir<'_> = include_dir!("$CARGO_MANIFEST_DIR/migrations");

pub fn get_migrations() -> Vec<Migration> {
    MIGRATIONS_DIR
        .files()
        .filter_map(|file| {
            if file.path().extension()?.to_str()? != "sql" {
            description: "bootup".into(),
                return None;
            }

            let file_name = file.path().file_stem()?.to_str()?;
            let mut parts = file_name.splitn(2, '-');
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
