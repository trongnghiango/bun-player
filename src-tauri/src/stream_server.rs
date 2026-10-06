use std::fs::File;
use std::io::{Read, Seek, SeekFrom, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU16, Ordering};
use std::thread;

static STREAM_PORT: AtomicU16 = AtomicU16::new(0);

pub fn init_stream_server() -> u16 {
    let listener = TcpListener::bind("127.0.0.1:0").expect("Failed to bind local media stream server");
    let port = listener.local_addr().unwrap().port();
    STREAM_PORT.store(port, Ordering::SeqCst);

    thread::spawn(move || {
        for stream in listener.incoming() {
            if let Ok(mut stream) = stream {
                thread::spawn(move || {
                    handle_client(&mut stream);
                });
            }
        }
    });

    port
}

pub fn get_stream_port() -> u16 {
    STREAM_PORT.load(Ordering::SeqCst)
}

fn handle_client(stream: &mut std::net::TcpStream) {
    let _ = stream.set_nodelay(true);
    let _ = stream.set_read_timeout(Some(std::time::Duration::from_secs(15)));
    let _ = stream.set_write_timeout(Some(std::time::Duration::from_secs(15)));

    let mut buffer = [0u8; 4096];
    let bytes_read = match stream.read(&mut buffer) {
        Ok(n) if n > 0 => n,
        _ => return,
    };

    let request = String::from_utf8_lossy(&buffer[..bytes_read]);
    let first_line = match request.lines().next() {
        Some(line) => line,
        None => return,
    };

    let parts: Vec<&str> = first_line.split_whitespace().collect();
    if parts.len() < 2 || parts[0] != "GET" {
        let _ = stream.write_all(b"HTTP/1.1 405 Method Not Allowed\r\n\r\n");
        return;
    }

    let uri = parts[1];
    let path_param = if let Some(idx) = uri.find("path=") {
        &uri[idx + 5..]
    } else {
        let _ = stream.write_all(b"HTTP/1.1 400 Bad Request\r\n\r\n");
        return;
    };

    // Strip any trailing query parameters
    let raw_encoded_path = path_param.split('&').next().unwrap_or(path_param);
    let decoded_path = decode_percent(raw_encoded_path);

    let file_path = PathBuf::from(&decoded_path);
    let mut file = match File::open(&file_path) {
        Ok(f) => f,
        Err(_) => {
            let _ = stream.write_all(b"HTTP/1.1 404 Not Found\r\n\r\n");
            return;
        }
    };

    let total_size = match file.metadata() {
        Ok(m) => m.len(),
        Err(_) => {
            let _ = stream.write_all(b"HTTP/1.1 500 Internal Error\r\n\r\n");
            return;
        }
    };

    let ext = file_path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase();

    let mime_type = match ext.as_str() {
        "mp4" | "m4v" => "video/mp4",
        "webm" => "video/webm",
        "mkv" => "video/webm", // Map MKV to webm so WebKit HTML5 element accepts it
        "mp3" => "audio/mpeg",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "m4a" => "audio/mp4",
        _ => "video/mp4",
    };

    // Parse Range header if present: Range: bytes=0-1048576
    let mut range_start: u64 = 0;
    let mut range_end: u64 = total_size.saturating_sub(1);
    let mut is_range = false;

    for line in request.lines() {
        if line.to_ascii_lowercase().starts_with("range:") {
            if let Some(eq_pos) = line.find('=') {
                let range_val = line[eq_pos + 1..].trim();
                let r_parts: Vec<&str> = range_val.split('-').collect();
                if let Ok(start) = r_parts[0].parse::<u64>() {
                    range_start = start;
                    is_range = true;
                }
                if r_parts.len() > 1 && !r_parts[1].is_empty() {
                    if let Ok(end) = r_parts[1].parse::<u64>() {
                        range_end = end.min(total_size.saturating_sub(1));
                    }
                }
            }
            break;
        }
    }

    if range_start >= total_size {
        let resp = format!(
            "HTTP/1.1 416 Range Not Satisfiable\r\nContent-Range: bytes */{}\r\n\r\n",
            total_size
        );
        let _ = stream.write_all(resp.as_bytes());
        return;
    }

    let content_len = (range_end - range_start) + 1;

    if file.seek(SeekFrom::Start(range_start)).is_err() {
        let _ = stream.write_all(b"HTTP/1.1 500 Seek Failed\r\n\r\n");
        return;
    }

    let header = if is_range {
        format!(
            "HTTP/1.1 206 Partial Content\r\n\
             Content-Type: {}\r\n\
             Content-Range: bytes {}-{}/{}\r\n\
             Content-Length: {}\r\n\
             Accept-Ranges: bytes\r\n\
             Access-Control-Allow-Origin: *\r\n\
             Connection: close\r\n\r\n",
            mime_type, range_start, range_end, total_size, content_len
        )
    } else {
        format!(
            "HTTP/1.1 200 OK\r\n\
             Content-Type: {}\r\n\
             Content-Length: {}\r\n\
             Accept-Ranges: bytes\r\n\
             Access-Control-Allow-Origin: *\r\n\
             Connection: close\r\n\r\n",
            mime_type, total_size
        )
    };

    if stream.write_all(header.as_bytes()).is_err() {
        return;
    }

    // High-performance streaming: stream exact bytes directly via std::io::copy
    let mut reader = file.take(content_len);
    let _ = std::io::copy(&mut reader, stream);
}

fn decode_percent(input: &str) -> String {
    let mut bytes = Vec::new();
    let mut chars = input.bytes();
    while let Some(b) = chars.next() {
        if b == b'%' {
            let h1 = chars.next();
            let h2 = chars.next();
            if let (Some(h1), Some(h2)) = (h1, h2) {
                let hex_str = [h1, h2];
                if let Ok(s) = std::str::from_utf8(&hex_str) {
                    if let Ok(val) = u8::from_str_radix(s, 16) {
                        bytes.push(val);
                        continue;
                    }
                }
            }
        }
        bytes.push(b);
    }
    String::from_utf8_lossy(&bytes).to_string()
}