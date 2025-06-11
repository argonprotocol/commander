use tauri_plugin_sql::{Migration, MigrationKind};

pub fn get_migrations() -> Vec<Migration> {
    let sql = include_str!("../migrations/01-bootup/up.sql");
    vec![Migration {
        version: 1,
        description: "bootup".into(),
        sql: sql,
        kind: MigrationKind::Up,
    }]
}
