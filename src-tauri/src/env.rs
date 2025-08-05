use log;
use std;

/// Loads environment variables following Vite's loading order:
/// 1. .env (loaded in all cases)
/// 2. .env.local (loaded in all cases, ignored by git)
/// 3. .env.[mode] (only loaded in specified mode)
/// 4. .env.[mode].local (only loaded in specified mode, ignored by git)
pub fn load_env_vars() {
    let mode = get_mode();
    log::debug!("Loading environment variables for mode: {}", mode);

    // 1. Load .env (loaded in all cases)
    dotenvy::dotenv().ok();

    // 2. Load .env.local (loaded in all cases, ignored by git)
    dotenvy::from_filename_override(".env.local").ok();

    // 3. Load .env.[mode] (only loaded in specified mode)
    dotenvy::from_filename_override(format!(".env.{}", mode)).ok();

    // 4. Load .env.[mode].local (only loaded in specified mode, ignored by git)
    dotenvy::from_filename_override(format!(".env.{}.local", mode)).ok();
}

/// Determines the current mode following Vite's logic
fn get_mode() -> String {
    // Check if NODE_ENV is set (highest priority)
    if let Ok(node_env) = std::env::var("NODE_ENV") {
        return node_env;
    }

    // Check if we're in a release build (production)
    #[cfg(debug_assertions)]
    {
        "development".to_string()
    }

    #[cfg(not(debug_assertions))]
    {
        "production".to_string()
    }
}
