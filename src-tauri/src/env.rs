use std;
use log;

/// Loads environment variables following Vite's loading order:
/// 1. .env (loaded in all cases)
/// 2. .env.local (loaded in all cases, ignored by git)
/// 3. .env.[mode] (only loaded in specified mode)
/// 4. .env.[mode].local (only loaded in specified mode, ignored by git)
pub fn load_env_vars() {
    let mode = get_mode();
    log::debug!("Loading environment variables for mode: {}", mode);
    
    // 1. Load .env (loaded in all cases)
    dotenv::dotenv().ok();
    
    // 2. Load .env.local (loaded in all cases, ignored by git)
    dotenv::from_filename(".env.local").ok();
    
    // 3. Load .env.[mode] (only loaded in specified mode)
    dotenv::from_filename(format!(".env.{}", mode)).ok();
    
    // 4. Load .env.[mode].local (only loaded in specified mode, ignored by git)
    dotenv::from_filename(format!(".env.{}.local", mode)).ok();

    // Resolve SSH key file path to absolute path
    if let Ok(keys_path) = std::env::var("SSH_KEY_FILE") {
        println!("SSH_KEY_FILE: {}", keys_path);
        if let Ok(current_dir) = std::env::current_dir() {
            // Get the parent directory of the current directory
            let path = current_dir.parent().unwrap().join(keys_path);
            println!("Resolved SSH key file path to: {}", path.to_string_lossy());
            unsafe {
                std::env::set_var("SSH_KEY_FILE", path.into_os_string());
            }
        }
    }
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