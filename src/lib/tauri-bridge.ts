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
export async function extractEmbeddedSubtitles(videoPath: string): Promise<string | null> {
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
    const res = await fetch("/api/extract-subtitles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoPath }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.vtt || null;
    }
  } catch {
    // Network or not supported
  }
  return null;
}

/**
 * Export video with embedded subtitles into a single self-contained MP4 file
 */
export async function exportEmbeddedVideo(
  videoPath: string,
  vttContent: string,
  defaultName: string
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
        videoPath,
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
    const outputPath = `/tmp/${suggestedName}`;
    const res = await fetch("/api/export-mp4", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoPath, vttContent, outputPath }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      return {
        success: true,
        path: data.path,
        message: `Đã đóng gói thành công 1 file MP4 tích hợp tại: ${data.path}`,
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
export async function openMediaDialog(): Promise<{ path: string; url: string; name: string } | null> {
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
        resolve({ path: file.name, url, name: file.name });
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
