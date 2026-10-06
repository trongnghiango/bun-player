/**
 * Dual-mode bridge: works seamlessly in Tauri Desktop App & Web Browser fallback
 */

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function resolveMediaUrl(pathOrUrl: string): Promise<string> {
  let rawPath = pathOrUrl;
  // Unwrap asset:// URL if stored in cache
  if (rawPath.startsWith("asset://localhost/")) {
    rawPath = decodeURIComponent(rawPath.replace("asset://localhost/", ""));
  }

  // Unwrap stream URLs with stale ports from previous session cache
  if (rawPath.includes("/stream?path=")) {
    const idx = rawPath.indexOf("/stream?path=");
    rawPath = decodeURIComponent(rawPath.substring(idx + 13));
  } else if (rawPath.includes("/media-stream?path=")) {
    const idx = rawPath.indexOf("/media-stream?path=");
    rawPath = decodeURIComponent(rawPath.substring(idx + 19));
  }

  if (isTauri()) {
    try {
      const { invoke, convertFileSrc } = await import("@tauri-apps/api/core");
      if (rawPath.startsWith("/") || /^[a-zA-Z]:[\\\/]/.test(rawPath)) {
        try {
          return await invoke<string>("get_stream_url", { path: rawPath });
        } catch {
          return convertFileSrc(rawPath);
        }
      }
    } catch (e) {
      console.warn("Could not get stream url, falling back:", e);
    }
  } else {
    // In Browser mode (pnpm run dev): Stream directly through Vite media server
    if (rawPath.startsWith("/") || /^[a-zA-Z]:[\\\/]/.test(rawPath)) {
      return `/media-stream?path=${encodeURIComponent(rawPath)}`;
    }
  }
  return rawPath;
}

/**
 * Attempt to extract embedded subtitles from a video file (MP4/MKV)
 */
export async function extractEmbeddedSubtitles(videoPath: string, videoFile?: File | null): Promise<string | null> {
  if (isTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return await invoke<string>("extract_subtitles", { videoPath });
    } catch {
      return null;
    }
  }

  // Browser Fallback (calls Vite dev server /api/extract-subtitles)
  try {
    let serverInputPath = videoPath;

    // If we have videoFile (browser file selection), upload to temp so ffmpeg can read it regardless of path!
    if (videoFile && (!serverInputPath || !serverInputPath.startsWith("/"))) {
      const uploadRes = await fetch(`/api/upload-temp-video?name=${encodeURIComponent(videoFile.name)}`, {
        method: "POST",
        body: videoFile,
      });
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json();
        serverInputPath = uploadData.path;
      }
    }

    if (!serverInputPath) return null;

    const res = await fetch("/api/extract-subtitles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoPath: serverInputPath }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.vtt || null;
    }
  } catch (e) {
    console.warn("Could not extract embedded subtitles:", e);
  }
  return null;
}

/**
 * Export video with embedded subtitles into a single self-contained MP4 file
 */
export async function exportEmbeddedVideo(
  videoPath: string | null,
  vttContent: string,
  defaultName: string,
  videoFile: File | null = null
): Promise<{ success: boolean; message: string; path?: string }> {
  const suggestedName = defaultName
    ? defaultName.replace(/\.[a-zA-Z0-9]+$/, "") + "_embedded.mp4"
    : "video_with_subtitles.mp4";

  if (isTauri()) {
    try {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const { invoke } = await import("@tauri-apps/api/core");

      const targetPath = await save({
        filters: [{ name: "MP4 Video with Subtitles (*.mp4)", extensions: ["mp4"] }],
        defaultPath: suggestedName,
      });

      if (!targetPath) {
        return { success: false, message: "Đã hủy xuất video." };
      }

      await invoke("export_embedded_mp4", {
        videoPath: videoPath || "",
        vttContent,
        outputPath: targetPath,
      });

      return {
        success: true,
        path: targetPath,
        message: `Xuất thành công video tích hợp phụ đề: ${targetPath}`,
      };
    } catch (err: unknown) {
      return {
        success: false,
        message: `Lỗi xuất video: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // Browser mode fallback via Vite endpoint
  try {
    let serverInputPath = videoPath;

    // If videoPath is a blob URL or doesn't start with / (i.e. browser file selection), upload videoFile to temp
    if (videoFile && (!serverInputPath || !serverInputPath.startsWith("/"))) {
      const uploadRes = await fetch(`/api/upload-temp-video?name=${encodeURIComponent(videoFile.name)}`, {
        method: "POST",
        body: videoFile,
      });
      if (!uploadRes.ok) {
        throw new Error("Không thể chuyển dữ liệu video sang bộ xử lý");
      }
      const uploadData = await uploadRes.json();
      serverInputPath = uploadData.path;
    }

    if (!serverInputPath || (!serverInputPath.startsWith("/") && !/^[a-zA-Z]:[\\\/]/.test(serverInputPath))) {
      // Prompt user to pick the video file if not in memory
      const picked = await openMediaDialog();
      if (picked?.file) {
        const uploadRes = await fetch(`/api/upload-temp-video?name=${encodeURIComponent(picked.file.name)}`, {
          method: "POST",
          body: picked.file,
        });
        if (!uploadRes.ok) {
          throw new Error("Không thể chuyển dữ liệu video sang bộ xử lý");
        }
        const uploadData = await uploadRes.json();
        serverInputPath = uploadData.path;
      } else if (picked?.path && (picked.path.startsWith("/") || /^[a-zA-Z]:[\\\/]/.test(picked.path))) {
        serverInputPath = picked.path;
      } else {
        return { success: false, message: "Cần chọn file video nguồn để tiến hành đóng gói." };
      }
    }

    const outputPath = `/tmp/${suggestedName}`;
    const res = await fetch("/api/export-mp4", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoPath: serverInputPath, vttContent, outputPath }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      // Trigger automatic browser download
      const a = document.createElement("a");
      a.href = `/api/download-file?path=${encodeURIComponent(outputPath)}`;
      a.download = suggestedName;
      a.click();

      return {
        success: true,
        path: outputPath,
        message: `Đã đóng gói thành công! Trình duyệt đang tải về: ${suggestedName}`,
      };
    } else {
      return { success: false, message: data.error || "Không thể xuất MP4" };
    }
  } catch (err: unknown) {
    return {
      success: false,
      message: `Lỗi xuất video: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

/**
 * Open Video or Audio File
 */
export async function openMediaDialog(): Promise<{ path: string; url: string; name: string; file?: File } | null> {
  if (isTauri()) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");

      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Video / Audio",
            extensions: ["mp4", "webm", "mkv", "mov", "mp3", "wav", "m4a"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        const url = await resolveMediaUrl(selected);
        const name = selected.split(/[\/\\]/).pop() || "media";
        return { path: selected, url, name };
      }
      return null;
    } catch (err) {
      console.warn("Tauri dialog error, falling back to web input:", err);
    }
  }

  // Browser Fallback
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "video/*,audio/*";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);
        resolve({ path: file.name, url, name: file.name, file });
      } else {
        resolve(null);
      }
    };
    input.click();
  });
}

/**
 * Open Subtitle File (.vtt, .srt)
 */
export async function openSubtitleDialog(): Promise<{ path: string; content: string; name: string } | null> {
  if (isTauri()) {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { readTextFile } = await import("@tauri-apps/plugin-fs");

      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "Subtitle",
            extensions: ["vtt", "srt"],
          },
        ],
      });

      if (selected && typeof selected === "string") {
        const content = await readTextFile(selected);
        const name = selected.split(/[\/\\]/).pop() || "subtitle.vtt";
        return { path: selected, content, name };
      }
      return null;
    } catch (err) {
      console.warn("Tauri subtitle dialog error, falling back to web input:", err);
    }
  }

  // Browser Fallback
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".vtt,.srt";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const content = await file.text();
        resolve({ path: file.name, content, name: file.name });
      } else {
        resolve(null);
      }
    };
    input.click();
  });
}

export interface SaveResult {
  success: boolean;
  path?: string;
  message: string;
}

/**
 * Save Subtitle Content to Disk with explicit path feedback
 */
export async function saveSubtitleFile(
  defaultPath: string | null,
  content: string,
  forceSaveAs: boolean = false
): Promise<SaveResult> {
  if (isTauri()) {
    try {
      const { writeTextFile } = await import("@tauri-apps/plugin-fs");
      const { save } = await import("@tauri-apps/plugin-dialog");

      let targetPath: string | null = null;
      const isAbsolutePath = defaultPath && /^([a-zA-Z]:[\\\/]|\/)/.test(defaultPath);

      if (forceSaveAs || !isAbsolutePath) {
        targetPath = await save({
          filters: [{ name: "WebVTT Subtitle (*.vtt)", extensions: ["vtt"] }],
          defaultPath: defaultPath ? defaultPath.replace(/\.srt$/i, ".vtt") : "adjusted_subtitles.vtt",
        });
      } else {
        targetPath = defaultPath;
      }

      if (targetPath) {
        await writeTextFile(targetPath, content);
        return {
          success: true,
          path: targetPath,
          message: `Đã lưu thành công vào: ${targetPath}`,
        };
      }
      return { success: false, message: "Đã hủy lưu file." };
    } catch (err: unknown) {
      console.error("Tauri save file error:", err);
      return {
        success: false,
        message: `Lỗi khi lưu file: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // Modern Browser File System Access API
  if (typeof window !== "undefined" && "showSaveFilePicker" in window) {
    try {
      const suggested = defaultPath ? defaultPath.replace(/\.srt$/i, ".vtt").split(/[\/\\]/).pop() : "adjusted_subtitles.vtt";
      // @ts-expect-error - File System Access API
      const handle = await window.showSaveFilePicker({
        suggestedName: suggested || "adjusted_subtitles.vtt",
        types: [
          {
            description: "WebVTT Subtitle (*.vtt)",
            accept: { "text/vtt": [".vtt"] },
          },
        ],
      });

      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();

      return {
        success: true,
        path: handle.name,
        message: `Đã lưu thành công vào file: ${handle.name}`,
      };
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        return { success: false, message: "Đã hủy lưu file." };
      }
      console.warn("showSaveFilePicker failed or cancelled, falling back to download:", err);
    }
  }

  // Browser Fallback: Blob Download
  const filename = defaultPath ? defaultPath.replace(/\.srt$/i, ".vtt").split(/[\/\\]/).pop() || "adjusted_subtitles.vtt" : "adjusted_subtitles.vtt";
  const blob = new Blob([content], { type: "text/vtt;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  return {
    success: true,
    path: filename,
    message: `Đã tải về thư mục Downloads: ${filename} (vui lòng chuyển vào cùng thư mục video)`,
  };
}