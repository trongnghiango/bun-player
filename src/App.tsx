import React, { useEffect, useRef } from "react";
import { HeaderBar } from "./components/KidPlayer/HeaderBar";
import { VideoStage } from "./components/KidPlayer/VideoStage";
import { SentencePagination } from "./components/KidPlayer/SentencePagination";
import { BigControls } from "./components/KidPlayer/BigControls";
import { EditorDrawer } from "./components/ParentEditor/EditorDrawer";
import { usePlayerStore } from "./stores/usePlayerStore";

export const App: React.FC = () => {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isEditorOpen = usePlayerStore((s) => s.isEditorOpen);
  const isFullscreen = usePlayerStore((s) => s.isFullscreen);
  const showSentencesInFullscreen = usePlayerStore((s) => s.showSentencesInFullscreen);
  const activeCueIndex = usePlayerStore((s) => s.activeCueIndex);
  const cues = usePlayerStore((s) => s.cues);
  const isRecording = usePlayerStore((s) => s.isRecording);

  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const replayCurrentCue = usePlayerStore((s) => s.replayCurrentCue);
  const nextCue = usePlayerStore((s) => s.nextCue);
  const prevCue = usePlayerStore((s) => s.prevCue);
  const toggleSubtitle = usePlayerStore((s) => s.toggleSubtitle);
  const toggleEditor = usePlayerStore((s) => s.toggleEditor);
  const toggleFullscreen = usePlayerStore((s) => s.toggleFullscreen);
  const restoreFromCache = usePlayerStore((s) => s.restoreFromCache);
  const cycleSentenceLoopTarget = usePlayerStore((s) => s.cycleSentenceLoopTarget);
  const startRecordingCue = usePlayerStore((s) => s.startRecordingCue);
  const stopRecordingCue = usePlayerStore((s) => s.stopRecordingCue);
  const pendingMarkerStart = usePlayerStore((s) => s.pendingMarkerStart);
  const toggleMarkerAtCurrentTime = usePlayerStore((s) => s.toggleMarkerAtCurrentTime);
  const cancelPendingMarker = usePlayerStore((s) => s.cancelPendingMarker);

  // Auto-restore session from ~/.config/bun-player/cache.json on startup
  useEffect(() => {
    restoreFromCache();
  }, [restoreFromCache]);

  // Sync fullscreen change state from browser Esc or system
  useEffect(() => {
    const handleFullscreenChange = () => {
      usePlayerStore.setState({ isFullscreen: !!document.fullscreenElement });
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const lastSpaceTimeRef = useRef<number>(0);

  // Global Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore shortcut if user is typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      // Ignore auto-repeated key events (e.g. user holding down Space or any shortcut key)
      if (e.repeat) {
        e.preventDefault();
        return;
      }

      switch (e.code) {
        case "Space": {
          e.preventDefault();
          const now = Date.now();
          if (now - lastSpaceTimeRef.current < 120) return;
          lastSpaceTimeRef.current = now;
          setIsPlaying(!isPlaying);
          break;
        }
        case "KeyR":
          e.preventDefault();
          replayCurrentCue();
          break;
        case "ArrowRight":
          e.preventDefault();
          nextCue();
          break;
        case "ArrowLeft":
          e.preventDefault();
          prevCue();
          break;
        case "KeyS":
          e.preventDefault();
          toggleSubtitle();
          break;
        case "KeyE":
          e.preventDefault();
          toggleEditor();
          break;
        case "KeyF":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "KeyL":
          e.preventDefault();
          cycleSentenceLoopTarget();
          break;
        case "KeyM":
          e.preventDefault();
          toggleMarkerAtCurrentTime();
          break;
        case "KeyV":
          e.preventDefault();
          if (isRecording) {
            stopRecordingCue();
          } else if (activeCueIndex >= 0 && cues[activeCueIndex]) {
            startRecordingCue(cues[activeCueIndex].id);
          }
          break;
        case "Escape":
          e.preventDefault();
          if (pendingMarkerStart !== null) {
            cancelPendingMarker();
          } else if (isEditorOpen) {
            toggleEditor(false);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isPlaying,
    isEditorOpen,
    isRecording,
    activeCueIndex,
    cues,
    setIsPlaying,
    replayCurrentCue,
    nextCue,
    prevCue,
    toggleSubtitle,
    toggleEditor,
    toggleFullscreen,
    cycleSentenceLoopTarget,
    startRecordingCue,
    stopRecordingCue,
    pendingMarkerStart,
    toggleMarkerAtCurrentTime,
    cancelPendingMarker,
  ]);

  return (
    <div className={`h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans select-none relative ${isFullscreen ? "fullscreen-active" : ""}`}>
      {/* 1. Header Bar: Auto-hide in Fullscreen to maximize immersion viewport */}
      {!isFullscreen && <HeaderBar />}

      {/* 2. Kid Player Stage: 16:9 Video & Subtitle */}
      <VideoStage />

      {/* 3. Little Fox Numbered Sentence Pagination: Always accessible and clickable */}
      {(!isFullscreen || showSentencesInFullscreen) && <SentencePagination />}

      {/* 4. Big Friendly Playback Controls */}
      <BigControls />

      {/* 5. Parent Editor Drawer (Slide-out) */}
      <EditorDrawer />
    </div>
  );
};

export default App;