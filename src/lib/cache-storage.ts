import { isTauri } from "./tauri-bridge";
import { SentenceCue } from "./types";

export interface ProjectCacheData {
  videoName: string;
  videoSrc: string | null;
  subtitlePath: string | null;
  cues: SentenceCue[];
  savedAt: string;
}

const LOCAL_STORAGE_KEY = "bun_player_cache_v1";

/**
 * Persists project to ~/.config/bun-player/cache.json (via Tauri) and localStorage
 */
export async function saveProjectCache(data: ProjectCacheData): Promise<{ success: boolean; path: string }> {
  const jsonString = JSON.stringify(data, null, 2);

  // 1. Always save to browser localStorage for instant local backup
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem(LOCAL_STORAGE_KEY, jsonString);
    }
  } catch (err) {
    console.warn("Could not save to localStorage:", err);
  }

  // 2. If in Tauri desktop, save to ~/.config/bun-player/cache.json
  if (isTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const savedPath = await invoke<string>("save_app_cache", { content: jsonString });
      return { success: true, path: savedPath };
    } catch (err) {
      console.error("Tauri invoke save_app_cache error:", err);
    }
  }

  return { success: true, path: "~/.config/bun-player/cache.json (hoặc localStorage)" };
}

/**
 * Loads cached project from ~/.config/bun-player/cache.json or localStorage
 */
export async function loadProjectCache(): Promise<ProjectCacheData | null> {
  // 1. Try Tauri native ~/.config/bun-player/cache.json first
  if (isTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const content = await invoke<string>("load_app_cache");
      if (content && content.trim()) {
        const parsed = JSON.parse(content);
        if (parsed && Array.isArray(parsed.cues) && parsed.cues.length > 0) {
          return parsed as ProjectCacheData;
        }
      }
    } catch (err) {
      console.warn("Could not load from Tauri app cache:", err);
    }
  }

  // 2. Fallback to browser localStorage
  try {
    if (typeof localStorage !== "undefined") {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && Array.isArray(parsed.cues) && parsed.cues.length > 0) {
          return parsed as ProjectCacheData;
        }
      }
    }
  } catch (err) {
    console.warn("Could not load from localStorage:", err);
  }

  return null;
}

/**
 * Clears cached project from both localStorage and ~/.config/bun-player/cache.json
 */
export async function clearProjectCache(): Promise<void> {
  // 1. Clear browser localStorage
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.removeItem(LOCAL_STORAGE_KEY);
      localStorage.clear();
    }
  } catch (err) {
    console.warn("Could not clear localStorage:", err);
  }

  // 2. Clear Tauri native cache
  if (isTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("clear_app_cache");
    } catch (err) {
      console.warn("Could not clear Tauri app cache:", err);
    }
  } else {
    // 3. Clear via Vite API
    try {
      await fetch("/api/clear-cache", { method: "POST" });
    } catch {}
  }
}
