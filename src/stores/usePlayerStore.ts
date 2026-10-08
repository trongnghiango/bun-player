import { create } from "zustand";
import type { SentenceCue, LoopTarget, MarkerResult } from "../lib/types.ts";
import { SAMPLE_CUES, SAMPLE_STORY_TITLE, SAMPLE_VIDEO_URL } from "../lib/sample-data.ts";
import { autoMergeShortCues, autoSplitLongCues, groupIntoSentences } from "../lib/vtt-parser.ts";
import { saveProjectCache, loadProjectCache, clearProjectCache } from "../lib/cache-storage.ts";
import { resolveMediaUrl } from "../lib/tauri-bridge.ts";
import {
  startMicrophoneRecording,
  stopMicrophoneRecording,
  playRecordedVoice,
  stopPlayingRecordedVoice,
  revokeAudioUrlSafely,
  stopMicrophoneRecordingSilently,
} from "../lib/audio-recorder.ts";

export interface PlayerStore {
  // Media State
  videoSrc: string | null;
  videoName: string;
  videoPath: string | null;
  videoFile: File | null;
  subtitlePath: string | null;
  cues: SentenceCue[];

  // Playback State
  currentTime: number;
  seekRequest: number | null;
  duration: number;
  isPlaying: boolean;
  activeCueIndex: number;
  playbackRate: number;
  targetStopSeconds: number | null; // For Little Fox auto-pause

  // Learning / Mode Toggles
  showSubtitle: boolean; // default false for kids
  autoPause: boolean;    // default true for sentence-by-sentence pacing
  sentenceLoopTarget: LoopTarget; // 1, 2, 3, or Infinity
  currentSentenceLoopCount: number; // tracks repetitions of current sentence
  isEditorOpen: boolean;
  isFullscreen: boolean;
  showSentencesInFullscreen: boolean;

  // Voice Shadowing State
  recordedVoices: Record<number, string>; // cueId -> blob URL
  recordedDurations: Record<number, number>; // cueId -> duration in seconds
  isRecording: boolean;
  recordingCueId: number | null;
  isPlayingRecording: boolean;

  // Live Marking State
  pendingMarkerStart: number | null;
  lastMarkerNotification: string | null;
  // Actions
  setMedia: (url: string, name: string, path?: string | null, file?: File | null) => void;
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
  autoGroupSentences: () => void;
  pauseAtSentenceEnd: (endTime: number) => void;
  setCurrentTime: (time: number) => void;
  seekToTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  setPlaybackRate: (rate: number) => void;
  setTargetStopSeconds: (seconds: number | null) => void;
  setSentenceLoopTarget: (target: LoopTarget) => void;
  cycleSentenceLoopTarget: () => void;
  incrementLoopAndReplay: () => void;

  toggleSubtitle: () => void;
  toggleAutoPause: () => void;
  toggleEditor: (open?: boolean) => void;
  toggleFullscreen: () => void;
  toggleSentencesInFullscreen: () => void;

  jumpToCue: (index: number) => void;
  replayCurrentCue: () => void;
  nextCue: () => void;
  prevCue: () => void;
  loadSampleDemo: () => void;
  restoreFromCache: () => Promise<boolean>;
  clearProject: () => Promise<void>;

  // Shadowing Actions
  startRecordingCue: (cueId: number) => Promise<boolean>;
  stopRecordingCue: () => Promise<string | null>;
  playRecordingForCue: (cueId: number) => void;
  stopPlayingRecording: () => void;
  deleteRecordingForCue: (cueId: number) => void;
  clearAllRecordings: () => void;
  toggleMarkerAtCurrentTime: () => MarkerResult;
  cancelPendingMarker: () => void;
  clearMarkerNotification: () => void;
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
        sentenceLoopTarget: state.sentenceLoopTarget === Infinity ? 999 : state.sentenceLoopTarget,
        savedAt: new Date().toISOString(),
      });
    }
  }, 600);
}

export const usePlayerStore = create<PlayerStore>((set, get) => ({
  videoSrc: null,
  videoName: "",
  videoPath: null,
  videoFile: null,
  subtitlePath: null,
  cues: [],

  currentTime: 0,
  seekRequest: null,
  duration: 0,
  isPlaying: false,
  activeCueIndex: -1,
  playbackRate: 1.0,
  targetStopSeconds: null,

  showSubtitle: false, // Default false: Image & Video first for kids
  autoPause: true,     // Default true: Little Fox style sentence pause
  sentenceLoopTarget: 1, // Default 1x
  currentSentenceLoopCount: 0,
  isEditorOpen: false,
  isFullscreen: false,
  showSentencesInFullscreen: true, // Sentence buttons visible and clickable in fullscreen

  recordedVoices: {},
  recordedDurations: {},
  isRecording: false,
  recordingCueId: null,
  isPlayingRecording: false,
  pendingMarkerStart: null,
  lastMarkerNotification: null,

  setMedia: (url, name, path = null, file = null) => {
    const prevSrc = get().videoSrc;
    if (prevSrc && prevSrc !== url) {
      revokeAudioUrlSafely(prevSrc);
    }

    set({
      videoSrc: url,
      videoName: name,
      videoPath: path,
      videoFile: file,
      currentTime: 0,
      seekRequest: 0,
      activeCueIndex: -1,
      currentSentenceLoopCount: 0,
    });
    queueAutoSave(get);
  },

  setCues: (cues, path) => {
    set({
      cues,
      subtitlePath: path || null,
      activeCueIndex: cues.length > 0 ? 0 : -1,
      currentSentenceLoopCount: 0,
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

  autoGroupSentences: () => {
    const { cues } = get();
    if (cues.length <= 1) return;
    const rawCues = cues.map((c) => ({
      startTime: c.startTime,
      endTime: c.endTime,
      text: c.text,
    }));
    const newCues = groupIntoSentences(rawCues);
    set({
      cues: newCues,
      activeCueIndex: 0,
      lastMarkerNotification: `✨ Đã nhận diện và gộp thành ${newCues.length} câu hoàn chỉnh (từ ${cues.length} mốc)!`,
    });
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

      let restoredLoopTarget: LoopTarget = 1;
      if (cached.sentenceLoopTarget) {
        if (cached.sentenceLoopTarget === 999) restoredLoopTarget = Infinity;
        else if ([1, 2, 3].includes(cached.sentenceLoopTarget)) {
          restoredLoopTarget = cached.sentenceLoopTarget as LoopTarget;
        }
      }

      set({
        videoName: cached.videoName || "",
        videoSrc: resolvedSrc,
        subtitlePath: cached.subtitlePath || null,
        cues: cached.cues,
        sentenceLoopTarget: restoredLoopTarget,
        currentSentenceLoopCount: 0,
        activeCueIndex: 0,
        currentTime: cached.cues[0]?.startTime || 0,
        seekRequest: cached.cues[0]?.startTime || 0,
      });
      return true;
    }
    return false;
  },

  pauseAtSentenceEnd: (endTime) => {
    const { activeCueIndex } = get();
    set({
      currentTime: endTime,
      seekRequest: endTime,
      isPlaying: false,
      targetStopSeconds: null,
      currentSentenceLoopCount: 0,
      // Strictly maintain the sentence that just finished speaking!
      activeCueIndex: activeCueIndex >= 0 ? activeCueIndex : 0,
    });
  },

  setSentenceLoopTarget: (sentenceLoopTarget) => {
    set({ sentenceLoopTarget, currentSentenceLoopCount: 0 });
    queueAutoSave(get);
  },

  cycleSentenceLoopTarget: () => {
    const { sentenceLoopTarget } = get();
    let next: LoopTarget = 1;
    if (sentenceLoopTarget === 1) next = 2;
    else if (sentenceLoopTarget === 2) next = 3;
    else if (sentenceLoopTarget === 3) next = Infinity;
    else next = 1;

    set({ sentenceLoopTarget: next, currentSentenceLoopCount: 0 });
    queueAutoSave(get);
  },

  incrementLoopAndReplay: () => {
    const { activeCueIndex, cues, currentSentenceLoopCount } = get();
    if (activeCueIndex >= 0 && activeCueIndex < cues.length) {
      const cue = cues[activeCueIndex];
      set({
        currentTime: cue.startTime,
        seekRequest: cue.startTime,
        currentSentenceLoopCount: currentSentenceLoopCount + 1,
        isPlaying: true,
        targetStopSeconds: cue.endTime,
      });
    }
  },

  setCurrentTime: (time) => {
    const {
      cues,
      autoPause,
      targetStopSeconds,
      activeCueIndex,
      isPlaying,
      currentSentenceLoopCount,
      sentenceLoopTarget,
      incrementLoopAndReplay,
    } = get();

    // 1. Auto-pause check: ONLY evaluate when actively playing, target is armed, and NOT in live marking!
    if (autoPause && isPlaying && !get().pendingMarkerStart && targetStopSeconds !== null && time >= targetStopSeconds - 0.05) {
      if (currentSentenceLoopCount + 1 < sentenceLoopTarget) {
        incrementLoopAndReplay();
        return;
      }

      set({
        currentTime: targetStopSeconds,
        isPlaying: false,
        targetStopSeconds: null,
        currentSentenceLoopCount: 0,
        activeCueIndex: activeCueIndex >= 0 ? activeCueIndex : 0,
      });
      return;
    }

    // 2. High-performance O(1) cue boundary check:
    // In 95%+ of animation frames, time is still within the current active cue
    if (activeCueIndex >= 0 && activeCueIndex < cues.length) {
      const cur = cues[activeCueIndex];
      if (time >= cur.startTime && time < cur.endTime) {
        set({ currentTime: time });
        return;
      }

      // Check next adjacent cue first (covers linear spoken progression in O(1))
      if (activeCueIndex + 1 < cues.length) {
        const next = cues[activeCueIndex + 1];
        if (time >= next.startTime && time < next.endTime) {
          set({
            currentTime: time,
            activeCueIndex: activeCueIndex + 1,
          });
          return;
        }
      }
    }

    // 3. Fallback: Binary or linear scan only upon discontinuous scrub/seek
    let activeIdx = cues.findIndex((c) => time >= c.startTime && time < c.endTime);
    if (activeIdx === -1) {
      if (cues.length > 0 && time < cues[0].startTime) {
        activeIdx = 0;
      } else {
        activeIdx = activeCueIndex;
      }
    }

    set({
      currentTime: time,
      activeCueIndex: activeIdx >= 0 ? activeIdx : activeCueIndex,
    });
  },

  seekToTime: (time) => {
    const { cues, autoPause, isPlaying, duration } = get();
    const clamped = Math.max(0, Math.min(duration > 0 ? duration : time, time));

    let newIdx = cues.findIndex((c) => clamped >= c.startTime && clamped < c.endTime);
    if (newIdx === -1 && cues.length > 0) {
      if (clamped < cues[0].startTime) {
        newIdx = 0;
      } else {
        const upcoming = cues.findIndex((c) => c.startTime > clamped);
        newIdx = upcoming >= 0 ? upcoming : cues.length - 1;
      }
    }

    let newTargetStop: number | null = null;
    if (autoPause && isPlaying) {
      const cur = newIdx >= 0 ? cues[newIdx] : null;
      if (cur && cur.endTime > clamped + 0.1) {
        newTargetStop = cur.endTime;
      }
    }

    set({
      currentTime: clamped,
      seekRequest: clamped,
      activeCueIndex: newIdx,
      targetStopSeconds: newTargetStop,
      currentSentenceLoopCount: 0,
    });
  },

  setDuration: (duration) => set({ duration }),

  setIsPlaying: (isPlaying) => {
    const { cues, activeCueIndex, currentTime, autoPause, jumpToCue } = get();

    if (isPlaying) {
      const currentCue = activeCueIndex >= 0 ? cues[activeCueIndex] : null;

      // If paused at the end of the current sentence (and NOT in live marking):
      if (autoPause && !get().pendingMarkerStart && currentCue && currentTime >= currentCue.endTime - 0.15) {
        if (activeCueIndex < cues.length - 1) {
          jumpToCue(activeCueIndex + 1);
          return;
        } else {
          // At the end of the very last cue: Allow video to play freely without deadlock!
          set({
            isPlaying: true,
            targetStopSeconds: null,
            currentSentenceLoopCount: 0,
          });
          return;
        }
      }

      // If resuming within a sentence or in a gap:
      let nextTargetStop: number | null = null;
      if (autoPause) {
        let activeIdx = cues.findIndex((c) => currentTime >= c.startTime && currentTime < c.endTime);
        if (activeIdx === -1 && cues.length > 0) {
          const upcoming = cues.findIndex((c) => c.startTime > currentTime);
          activeIdx = upcoming >= 0 ? upcoming : cues.length - 1;
        }
        const cur = activeIdx >= 0 ? cues[activeIdx] : null;
        if (cur && cur.endTime > currentTime + 0.1) {
          nextTargetStop = cur.endTime;
        }
      }

      set({
        isPlaying: true,
        targetStopSeconds: nextTargetStop,
      });
      return;
    }

    // Always clear targetStopSeconds when pausing to prevent lingering traps
    set({
      isPlaying: false,
      targetStopSeconds: null,
    });
  },

  setPlaybackRate: (playbackRate) => set({ playbackRate }),
  setTargetStopSeconds: (targetStopSeconds) => set({ targetStopSeconds }),

  toggleSubtitle: () => set((state) => ({ showSubtitle: !state.showSubtitle })),
  toggleAutoPause: () => set((state) => ({ autoPause: !state.autoPause })),
  toggleEditor: (open) =>
    set((state) => ({ isEditorOpen: open !== undefined ? open : !state.isEditorOpen })),

  toggleFullscreen: async () => {
    const { isFullscreen } = get();
    if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
      try {
        const { getCurrentWindow } = await import("@tauri-apps/api/window");
        const win = getCurrentWindow();
        await win.setFullscreen(!isFullscreen);
        set({ isFullscreen: !isFullscreen });
        return;
      } catch (err) {
        console.warn("Tauri fullscreen error:", err);
      }
    }

    if (typeof document !== "undefined") {
      if (!document.fullscreenElement) {
        try {
          await document.documentElement.requestFullscreen();
          set({ isFullscreen: true });
        } catch (err) {
          console.warn("Fullscreen request error:", err);
        }
      } else {
        try {
          if (document.exitFullscreen) {
            await document.exitFullscreen();
          }
          set({ isFullscreen: false });
        } catch (err) {
          console.warn("Exit fullscreen error:", err);
        }
      }
    }
  },

  toggleSentencesInFullscreen: () =>
    set((state) => ({ showSentencesInFullscreen: !state.showSentencesInFullscreen })),

  jumpToCue: (index) => {
    const { cues, autoPause } = get();
    if (index >= 0 && index < cues.length) {
      const cue = cues[index];
      set({
        activeCueIndex: index,
        currentTime: cue.startTime,
        seekRequest: cue.startTime,
        currentSentenceLoopCount: 0,
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
        seekRequest: cue.startTime,
        currentSentenceLoopCount: 0,
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
    if (cues.length > 0 && typeof window !== "undefined" && window.confirm) {
      const ok = window.confirm("Bạn đang có các câu thoại đã chỉnh sửa. Bạn có chắc muốn nạp video mẫu và ghi đè không?");
      if (!ok) return;
    }
    set({
      videoSrc: SAMPLE_VIDEO_URL,
      videoName: SAMPLE_STORY_TITLE,
      cues: SAMPLE_CUES,
      activeCueIndex: 0,
      currentTime: 0,
      seekRequest: 0,
      currentSentenceLoopCount: 0,
      isPlaying: false,
      targetStopSeconds: null,
    });
    queueAutoSave(get);
  },

  clearProject: async () => {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    const { videoSrc, recordedVoices } = get();

    // Revoke previous video blob if any
    revokeAudioUrlSafely(videoSrc);

    // Revoke all voice recordings
    Object.values(recordedVoices).forEach((url) => revokeAudioUrlSafely(url));
    stopMicrophoneRecordingSilently();
    stopPlayingRecordedVoice();

    await clearProjectCache();
    set({
      videoSrc: null,
      videoName: "",
      videoPath: null,
      videoFile: null,
      subtitlePath: null,
      cues: [],
      currentTime: 0,
      seekRequest: null,
      duration: 0,
      isPlaying: false,
      activeCueIndex: -1,
      targetStopSeconds: null,
      currentSentenceLoopCount: 0,
      recordedVoices: {},
      recordedDurations: {},
      isRecording: false,
      recordingCueId: null,
      isPlayingRecording: false,
      pendingMarkerStart: null,
      lastMarkerNotification: null,
    });
  },

  // Shadowing & Kid Voice Actions
  startRecordingCue: async (cueId: number) => {
    // If video is currently playing, pause it so mic doesn't capture speaker sound
    if (get().isPlaying) {
      set({ isPlaying: false });
    }

    try {
      await startMicrophoneRecording();
      set({ isRecording: true, recordingCueId: cueId });
      return true;
    } catch (err) {
      console.warn("Could not start microphone recording:", err);
      set({ isRecording: false, recordingCueId: null });
      return false;
    }
  },

  stopRecordingCue: async () => {
    const { recordingCueId, recordedVoices } = get();
    if (recordingCueId === null) {
      stopMicrophoneRecordingSilently();
      set({ isRecording: false });
      return null;
    }

    const res = await stopMicrophoneRecording();
    if (res) {
      if (recordedVoices[recordingCueId]) {
        revokeAudioUrlSafely(recordedVoices[recordingCueId]);
      }

      const updated = {
        ...recordedVoices,
        [recordingCueId]: res.url,
      };
      const updatedDurations = {
        ...get().recordedDurations,
        [recordingCueId]: res.duration,
      };

      set({
        recordedVoices: updated,
        recordedDurations: updatedDurations,
        isRecording: false,
        recordingCueId: null,
        lastMarkerNotification: `🎉 Đã lưu giọng bé câu ${recordingCueId} (${res.duration}s)! Bấm nút "Giọng bé" để nghe lại.`,
      });
      return res.url;
    }

    set({
      isRecording: false,
      recordingCueId: null,
      lastMarkerNotification: "⚠️ Chưa thu được âm thanh (vui lòng nói to hơn hoặc cấp quyền micro)",
    });
    return null;
  },

  playRecordingForCue: (cueId: number) => {
    const { recordedVoices, isPlaying } = get();
    const url = recordedVoices[cueId];
    if (!url) return;

    // Pause video if playing
    if (isPlaying) {
      set({ isPlaying: false });
    }

    set({ isPlayingRecording: true });
    playRecordedVoice(
      url,
      () => set({ isPlayingRecording: false }),
      () => set({ isPlayingRecording: false })
    );
  },

  stopPlayingRecording: () => {
    stopPlayingRecordedVoice();
    set({ isPlayingRecording: false });
  },

  deleteRecordingForCue: (cueId: number) => {
    const { recordedVoices } = get();
    if (recordedVoices[cueId]) {
      revokeAudioUrlSafely(recordedVoices[cueId]);
      const next = { ...recordedVoices };
      delete next[cueId];
      const nextDurations = { ...get().recordedDurations };
      delete nextDurations[cueId];
      set({ recordedVoices: next, recordedDurations: nextDurations });
    }
  },


  toggleMarkerAtCurrentTime: () => {
    const { currentTime, pendingMarkerStart, cues, duration } = get();
    const now = Math.round(currentTime * 1000) / 1000;

    if (pendingMarkerStart === null) {
      const mins = Math.floor(now / 60);
      const secs = (now % 60).toFixed(1);
      const timeLabel = `${mins}:${secs.padStart(4, "0")}`;
      set({
        pendingMarkerStart: now,
        lastMarkerNotification: `📍 Bắt đầu câu: ${timeLabel}. Bấm phím lần nữa khi dứt câu!`,
      });
      return { type: "start", time: now };
    }

    let start = pendingMarkerStart;
    let end = now;

    if (end < start) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    if (end - start < 0.15) {
      return { type: "ignored", time: now };
    }

    const nextId = cues.length + 1;
    const newCue: SentenceCue = {
      id: nextId,
      startTime: Math.max(0, start),
      endTime: Math.min(duration > 0 ? duration : end, end),
      text: `Câu ${nextId}`,
      isAdjusted: true,
    };

    const newCues = [...cues, newCue]
      .sort((a, b) => a.startTime - b.startTime)
      .map((c, i) => ({ ...c, id: i + 1 }));

    const activeIdx = newCues.findIndex((c) => c.startTime === newCue.startTime);

    const sMins = Math.floor(start / 60);
    const sSecs = (start % 60).toFixed(1);
    const eMins = Math.floor(end / 60);
    const eSecs = (end % 60).toFixed(1);

    set({
      cues: newCues,
      pendingMarkerStart: null,
      targetStopSeconds: null, // Keep video streaming continuously without boundary freeze
      activeCueIndex: activeIdx >= 0 ? activeIdx : get().activeCueIndex,
      lastMarkerNotification: `✨ Đã tạo Câu ${activeIdx >= 0 ? activeIdx + 1 : nextId} (${sMins}:${sSecs} ➔ ${eMins}:${eSecs})`,
    });

    queueAutoSave(get);
    return { type: "end", cue: newCue, time: now };
  },

  cancelPendingMarker: () => {
    set({ pendingMarkerStart: null, lastMarkerNotification: "Đã hủy mốc làm dấu." });
  },

  clearMarkerNotification: () => {
    set({ lastMarkerNotification: null });
  },
  clearAllRecordings: () => {
    const { recordedVoices } = get();
    Object.values(recordedVoices).forEach((url) => revokeAudioUrlSafely(url));
    set({ recordedVoices: {} });
  },
}));