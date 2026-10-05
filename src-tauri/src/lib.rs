mod stream_server;

use std::fs;
use std::path::PathBuf;
use std::process::Command;
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
fn extract_subtitles(video_path: String) -> Result<String, String> {
    let output = Command::new("ffmpeg")
        .args(["-v", "error", "-i", &video_path, "-map", "0:s:0", "-f", "webvtt", "-"])
        .output()
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    if output.status.success() {
        let content = String::from_utf8_lossy(&output.stdout).to_string();
        if !content.trim().is_empty() {
            return Ok(content);
        }
    }
    Err("No embedded subtitles found".to_string())
}

#[tauri::command]
fn export_embedded_mp4(video_path: String, vtt_content: String, output_path: String) -> Result<String, String> {
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    let temp_vtt = std::env::temp_dir().join(format!("bun_sub_{}.vtt", timestamp));
    fs::write(&temp_vtt, vtt_content).map_err(|e| format!("Failed to write temp vtt: {}", e))?;

    let output = Command::new("ffmpeg")
        .args([
            "-y",
            "-i",
            &video_path,
            "-i",
            &temp_vtt.to_string_lossy(),
            "-c:v",
            "copy",
            "-c:a",
            "copy",
            "-c:s",
            "mov_text",
            &output_path,
        ])
        .output()
        .map_err(|e| format!("Failed to run ffmpeg: {}", e))?;

    let _ = fs::remove_file(temp_vtt);

    if output.status.success() {
        Ok(output_path)
    } else {
        let err_msg = String::from_utf8_lossy(&output.stderr).to_string();
        Err(format!("ffmpeg export failed: {}", err_msg))
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

#[tauri::command]
fn clear_app_cache() -> Result<(), String> {
    let file_path = get_config_dir().join("cache.json");
    if file_path.exists() {
        let _ = fs::remove_file(file_path);
    }
    Ok(())
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
            clear_app_cache,
            get_stream_url,
            extract_subtitles,
            export_embedded_mp4
        ])
        .run(tauri::generate_context!())
        .expect("error while running bun-player application");
}
