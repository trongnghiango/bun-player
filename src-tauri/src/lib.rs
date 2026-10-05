mod stream_server;

use std::fs;
use std::path::PathBuf;
use stream_server::{get_stream_port, init_stream_server};

fn get_config_dir() -> PathBuf {
    if let Ok(home) = std::env::var("HOME") {
        PathBuf::from(home).join(".config").join("bun-player")
    } else if let Ok(userprofile) = std::env::var("USERPROFILE") {
        PathBuf::from(userprofile).join(".config").join("bun-player")
    } else {
        PathBuf::from(".bun-player")
    }
}

#[tauri::command]
fn get_stream_url(path: String) -> String {
    let port = get_stream_port();
    let mut encoded = String::new();
    for b in path.bytes() {
        if b.is_ascii_alphanumeric() || b == b'-' || b == b'_' || b == b'.' || b == b'~' {
            encoded.push(b as char);
        } else {
            encoded.push_str(&format!("%{:02X}", b));
        }
    }
    format!("http://127.0.0.1:{}/stream?path={}", port, encoded)
}

#[tauri::command]
fn save_app_cache(content: String) -> Result<String, String> {
    let dir = get_config_dir();
    fs::create_dir_all(&dir).map_err(|e| format!("Cannot create dir: {}", e))?;
    let file_path = dir.join("cache.json");
    fs::write(&file_path, content).map_err(|e| format!("Cannot write cache: {}", e))?;
    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
fn load_app_cache() -> Result<String, String> {
    let file_path = get_config_dir().join("cache.json");
    if file_path.exists() {
        fs::read_to_string(&file_path).map_err(|e| format!("Cannot read cache: {}", e))
    } else {
        Ok(String::new())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    init_stream_server();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            save_app_cache,
            load_app_cache,
            get_stream_url
        ])
        .run(tauri::generate_context!())
        .expect("error while running bun-player application");
}
