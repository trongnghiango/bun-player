// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Fix WebKitGTK video playback and hardware driver crash/freeze on Linux
    #[cfg(target_os = "linux")]
    {
        if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }

        // Fix AppImage GStreamer plugin isolation:
        // AppImage overrides GST_PLUGIN_SYSTEM_PATH_1_0 to its internal mount point,
        // which hides the host system /usr/lib/gstreamer-1.0 plugins (appsink, autoaudiosink).
        let host_gst_paths = [
            "/usr/lib/gstreamer-1.0",
            "/usr/lib64/gstreamer-1.0",
            "/usr/lib/x86_64-linux-gnu/gstreamer-1.0",
        ];

        let mut all_paths = Vec::new();
        if let Ok(existing) = std::env::var("GST_PLUGIN_SYSTEM_PATH_1_0") {
            if !existing.is_empty() {
                all_paths.push(existing);
            }
        }
        if let Ok(existing) = std::env::var("GST_PLUGIN_PATH_1_0") {
            if !existing.is_empty() {
                all_paths.push(existing);
            }
        }

        for path in host_gst_paths {
            if std::path::Path::new(path).is_dir() {
                all_paths.push(path.to_string());
            }
        }

        if !all_paths.is_empty() {
            let combined = all_paths.join(":");
            std::env::set_var("GST_PLUGIN_SYSTEM_PATH_1_0", &combined);
            std::env::set_var("GST_PLUGIN_PATH_1_0", &combined);
            std::env::set_var("GST_PLUGIN_PATH", &combined);
        }
    }

    bun_player_lib::run()
}
