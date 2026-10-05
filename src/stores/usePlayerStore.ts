import { create } from "zustand";
import { SentenceCue } from "../lib/types";
import { SAMPLE_CUES, SAMPLE_STORY_TITLE, SAMPLE_VIDEO_URL } from "../lib/sample-data";
import { autoMergeShortCues, autoSplitLongCues } from "../lib/vtt-parser";
import { saveProjectCache, loadProjectCache } from "../lib/cache-storage";
import { resolveMediaUrl } from "../lib/tauri-bridge";

interface PlayerStore {
  // Media State
  videoSrc: string | null;
  videoName: string;
  subtitlePath: string | null;
  cues: SentenceCue[];

  // Playback State
  currentTime: number;
  duration: number;
  isPlaying: boolean;
  activeCueIndex: number;
  playbackRate: number;
  targetStopSeconds: number | null; // For Little Fox auto-pause

  // Learning / Mode Toggles
  showSubtitle: boolean; // default false for kids
  autoPause: boolean;    // default true for sentence-by-sentence pacing
  isEditorOpen: boolean;

  // Actions
  setMedia: (url: string, name: string) => void;
  setCues: (cues: SentenceCue[], path?: string) => void;
  updateCueTiming: (id: number, startTime: number, endTime: number) => void;
  updateCueText: (id: number, newText: string) => void;
  shiftAllCues: (offset: number) => void;
  mergeWithNext: (cueId: number) => void;
  splitCue: (cueId: number, customSplitTime?: number) => void;
  snapToPrevious: (cueId: number) => void;
  removeCue: (cueId: number) => void;
  addCueAtCurrentTime: () => void;
  autoMergeShort: (minWords?: number) => void;
  autoSplitLong: (maxWords?: number) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setTargetStopSeconds: (seconds: number | null) => void;

  toggleSubtitle: () => void;
  toggleAutoPause: () => void;
  toggleEditor: (open?: boolean) => void;

  jumpToCue: (index: number) => void;
  replayCurrentCue: () => void;
  nextCue: () => void;
  prevCue: () => void;
  loadSampleDemo: () => void;
  restoreFromCache: () => Promise<boolean>;
}

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
function queueAutoSave(get: () => PlayerStore) {
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    const state = get();
    if (state.cues.length > 0) {
      saveProjectCache({
        videoName: state.videoName,
        videoSrc: state.videoSrc,
        subtitlePath: state.subtitlePath,
        cues: state.cues,
        savedAt: new Date().toISOString(),
      });
    }
  }, 250);
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  videoSrc: null,
  videoName: "",
  subtitlePath: null,
  cues: [],

  currentTime: 0,
  duration: 0,
  isPlaying: false,
  activeCueIndex: -1,
  playbackRate: 1.0,
  targetStopSeconds: null,

  showSubtitle: false, // Default false: Image & Video first for kids
  autoPause: true,     // Default true: Little Fox style sentence pause
  isEditorOpen: false,

  setMedia: (url, name) => {
    set({ videoSrc: url, videoName: name, currentTime: 0, activeCueIndex: -1 });
    queueAutoSave(get);
  },

  setCues: (cues, path) => {
    set({
      cues,
      subtitlePath: path || null,
      activeCueIndex: cues.length > 0 ? 0 : -1,
    });
    queueAutoSave(get);
  },

  updateCueTiming: (id, startTime, endTime) => {
    set((state) => ({
      cues: state.cues.map((c) =>
        c.id === id
          ? {
              ...c,
              startTime: Math.max(0, Math.round(startTime * 1000) / 1000),
              endTime: Math.max(startTime + 0.1, Math.round(endTime * 1000) / 1000),
              isAdjusted: true,
            }
          : c
      ),
    }));
    queueAutoSave(get);
  },

  updateCueText: (id, newText) => {
    set((state) => ({
      cues: state.cues.map((c) =>
        c.id === id
          ? {
              ...c,
              text: newText,
              isAdjusted: true,
            }
          : c
      ),
    }));
    queueAutoSave(get);
  },

  shiftAllCues: (offset) => {
    set((state) => ({
      cues: state.cues.map((c) => ({
        ...c,
        startTime: Math.max(0, Math.round((c.startTime + offset) * 1000) / 1000),
        endTime: Math.max(0.1, Math.round((c.endTime + offset) * 1000) / 1000),
        isAdjusted: true,
      })),
    }));
    queueAutoSave(get);
  },

  mergeWithNext: (cueId) => {
    const { cues } = get();
    const index = cues.findIndex((c) => c.id === cueId);
    if (index >= 0 && index < cues.length - 1) {
      const current = cues[index];
      const next = cues[index + 1];
      const mergedCue: SentenceCue = {
        id: current.id,
        startTime: current.startTime,
        endTime: next.endTime,
        text: `${current.text.trim()} ${next.text.trim()}`,
        isAdjusted: true,
      };
      const newCues = [
        ...cues.slice(0, index),
        mergedCue,
        ...cues.slice(index + 2),
      ].map((c, i) => ({ ...c, id: i + 1 }));

      set({ cues: newCues });
      queueAutoSave(get);
    }
  },

  splitCue: (cueId, customSplitTime) => {
    const { cues, currentTime } = get();
    const index = cues.findIndex((c) => c.id === cueId);
    if (index < 0) return;

    const cue = cues[index];
    let splitAt = (cue.startTime + cue.endTime) / 2;

    if (customSplitTime && customSplitTime > cue.startTime && customSplitTime < cue.endTime) {
      splitAt = customSplitTime;
    } else if (currentTime > cue.startTime + 0.3 && currentTime < cue.endTime - 0.3) {
      splitAt = Math.round(currentTime * 1000) / 1000;
    }

    const words = cue.text.trim().split(/\s+/);
    const ratio = (splitAt - cue.startTime) / (cue.endTime - cue.startTime);
    const splitWordIndex = Math.max(1, Math.min(words.length - 1, Math.round(words.length * ratio)));

    const text1 = words.slice(0, splitWordIndex).join(" ");
    const text2 = words.slice(splitWordIndex).join(" ");

    const cue1: SentenceCue = {
      id: cue.id,
      startTime: cue.startTime,
      endTime: Math.round(splitAt * 1000) / 1000,
      text: text1,
      isAdjusted: true,
    };

    const cue2: SentenceCue = {
      id: cue.id + 1,
      startTime: Math.round(splitAt * 1000) / 1000,
      endTime: cue.endTime,
      text: text2,
      isAdjusted: true,
    };

    const newCues = [
      ...cues.slice(0, index),
      cue1,
      cue2,
      ...cues.slice(index + 1),
    ].map((c, i) => ({ ...c, id: i + 1 }));

    set({ cues: newCues });
    queueAutoSave(get);
  },

  autoMergeShort: (minWords = 3) => {
    const { cues } = get();
    if (cues.length <= 1) return;
    const newCues = autoMergeShortCues(cues, minWords);
    set({ cues: newCues });
    queueAutoSave(get);
  },

  autoSplitLong: (maxWords = 14) => {
    const { cues } = get();
    if (cues.length === 0) return;
    const newCues = autoSplitLongCues(cues, maxWords);
    set({ cues: newCues });
    queueAutoSave(get);
  },

  snapToPrevious: (cueId) => {
    const { cues } = get();
    const index = cues.findIndex((c) => c.id === cueId);
    if (index <= 0) return;

    const prevCue = cues[index - 1];
    const currentCue = cues[index];
    const duration = Math.max(0.3, currentCue.endTime - currentCue.startTime);

    const newStart = Math.round(prevCue.endTime * 1000) / 1000;
    const newEnd = Math.round((newStart + duration) * 1000) / 1000;

    set((state) => ({
      cues: state.cues.map((c) =>
        c.id === cueId
          ? {
              ...c,
              startTime: newStart,
              endTime: newEnd,
              isAdjusted: true,
            }
          : c
      ),
    }));
    queueAutoSave(get);
  },

  removeCue: (cueId) => {
    const { cues, activeCueIndex } = get();
    const newCues = cues
      .filter((c) => c.id !== cueId)
      .map((c, i) => ({ ...c, id: i + 1 }));

    let newActiveIdx = activeCueIndex;
    if (newActiveIdx >= newCues.length) {
      newActiveIdx = newCues.length - 1;
    }
    set({ cues: newCues, activeCueIndex: newActiveIdx });
    queueAutoSave(get);
  },

  addCueAtCurrentTime: () => {
    const { cues, currentTime, duration } = get();
    const start = Math.max(0, Math.round(currentTime * 10) / 10);
    const end = Math.min(
      duration > 0 ? duration : start + 3,
      Math.round((start + 2.5) * 10) / 10
    );

    const newCue: SentenceCue = {
      id: 0,
      startTime: start,
      endTime: end,
      text: "New Sentence",
      isAdjusted: true,
    };

    const newCues = [...cues, newCue]
      .sort((a, b) => a.startTime - b.startTime)
      .map((c, i) => ({ ...c, id: i + 1 }));

    set({ cues: newCues });
    queueAutoSave(get);
  },

  restoreFromCache: async () => {
    const cached = await loadProjectCache();
    if (cached && cached.cues && cached.cues.length > 0) {
      let resolvedSrc = cached.videoSrc || null;
      if (resolvedSrc) {
        resolvedSrc = await resolveMediaUrl(resolvedSrc);
      }
      set({
        videoName: cached.videoName || "",
        videoSrc: resolvedSrc,
        subtitlePath: cached.subtitlePath || null,
        cues: cached.cues,
        activeCueIndex: 0,
        currentTime: cached.cues[0]?.startTime || 0,
      });
      return true;
    }
    return false;
  },

  setCurrentTime: (time) => {
    const { cues, autoPause, targetStopSeconds } = get();
    // Locate which sentence is currently active
    const activeIdx = cues.findIndex((c) => time >= c.startTime && time <= c.endTime);

    // Check if auto-pause threshold is reached
    if (autoPause && targetStopSeconds !== null && time >= targetStopSeconds) {
      set({
        currentTime: time,
        isPlaying: false,
        targetStopSeconds: null,
        activeCueIndex: activeIdx >= 0 ? activeIdx : get().activeCueIndex,
      });
      return;
    }

    set({
      currentTime: time,
      activeCueIndex: activeIdx >= 0 ? activeIdx : get().activeCueIndex,
    });
  },

  setDuration: (duration) => set({ duration }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  setTargetStopSeconds: (targetStopSeconds) => set({ targetStopSeconds }),

  toggleSubtitle: () => set((state) => ({ showSubtitle: !state.showSubtitle })),
  toggleAutoPause: () => set((state) => ({ autoPause: !state.autoPause })),
  toggleEditor: (open) =>
    set((state) => ({ isEditorOpen: open !== undefined ? open : !state.isEditorOpen })),

  jumpToCue: (index) => {
    const { cues, autoPause } = get();
    if (index >= 0 && index < cues.length) {
      const cue = cues[index];
      set({
        activeCueIndex: index,
        currentTime: cue.startTime,
        isPlaying: true,
        targetStopSeconds: autoPause ? cue.endTime : null,
      });
    }
  },

  replayCurrentCue: () => {
    const { cues, activeCueIndex, autoPause } = get();
    const idx = activeCueIndex >= 0 ? activeCueIndex : 0;
    if (cues[idx]) {
      const cue = cues[idx];
      set({
        activeCueIndex: idx,
        currentTime: cue.startTime,
        isPlaying: true,
        targetStopSeconds: autoPause ? cue.endTime : null,
      });
    }
  },

  nextCue: () => {
    const { cues, activeCueIndex, jumpToCue } = get();
    if (activeCueIndex < cues.length - 1) {
      jumpToCue(activeCueIndex + 1);
    }
  },

  prevCue: () => {
    const { activeCueIndex, jumpToCue } = get();
    if (activeCueIndex > 0) {
      jumpToCue(activeCueIndex - 1);
    }
  },

  loadSampleDemo: () => {
    const { cues } = get();
    if (cues.length > 0) {
      const ok = window.confirm("Bạn đang có các câu thoại đã chỉnh sửa. Bạn có chắc muốn nạp video mẫu và ghi đè không?");
      if (!ok) return;
    }
    set({
      videoSrc: SAMPLE_VIDEO_URL,
      videoName: SAMPLE_STORY_TITLE,
      cues: SAMPLE_CUES,
      activeCueIndex: 0,
      currentTime: 0,
      isPlaying: false,
      targetStopSeconds: null,
    });
    queueAutoSave(get);
  },
}));
