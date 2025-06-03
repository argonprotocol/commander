use std::env;
use std::fs;
use std::path::Path;

fn main() {
    println!("cargo:rerun-if-changed=migrations/");
    println!("cargo:rerun-if-changed=../SHASUMS256");
    
    // Load environment variables from .env.production if it exists
    let env_path = Path::new(".env.production");
    if env_path.exists() {
        let contents = fs::read_to_string(env_path).expect("Failed to read .env.production");
        for line in contents.lines() {
            if let Some((key, value)) = line.split_once('=') {
                println!("cargo:rustc-env={}={}", key.trim(), value.trim());
            }
        }
    }

    // Set default values if not present
    if env::var("MAINCHAIN_URL").is_err() {
        println!("cargo:rustc-env=MAINCHAIN_URL=wss://rpc.argon.network");
    }

    tauri_build::build()
}
