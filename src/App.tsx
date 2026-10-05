import React, { useEffect } from "react";
import { HeaderBar } from "./components/KidPlayer/HeaderBar";
import { VideoStage } from "./components/KidPlayer/VideoStage";
import { SentencePagination } from "./components/KidPlayer/SentencePagination";
import { BigControls } from "./components/KidPlayer/BigControls";
import { EditorDrawer } from "./components/ParentEditor/EditorDrawer";
import { usePlayerStore } from "./stores/usePlayerStore";

export const App: React.FC = () => {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const isEditorOpen = usePlayerStore((s) => s.isEditorOpen);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const replayCurrentCue = usePlayerStore((s) => s.replayCurrentCue);
  const nextCue = usePlayerStore((s) => s.nextCue);
  const prevCue = usePlayerStore((s) => s.prevCue);
  const toggleSubtitle = usePlayerStore((s) => s.toggleSubtitle);
  const toggleEditor = usePlayerStore((s) => s.toggleEditor);
  const restoreFromCache = usePlayerStore((s) => s.restoreFromCache);

  // Auto-restore session from ~/.config/bun-player/cache.json on startup
  useEffect(() => {
    restoreFromCache();
  }, [restoreFromCache]);

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

      switch (e.code) {
        case "Space":
          e.preventDefault();
          setIsPlaying(!isPlaying);
          break;
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
        case "Escape":
          if (isEditorOpen) {
            e.preventDefault();
            toggleEditor(false);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isPlaying, isEditorOpen, setIsPlaying, replayCurrentCue, nextCue, prevCue, toggleSubtitle, toggleEditor]);

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans select-none relative">
      {/* 1. Header Bar: Open file & discreet settings */}
      <HeaderBar />

      {/* 2. Kid Player Stage: 16:9 Video & Subtitle */}
      <VideoStage />

      {/* 3. Little Fox Numbered Sentence Pagination */}
      <SentencePagination />

      {/* 4. Big Friendly Playback Controls */}
      <BigControls />

      {/* 5. Parent Editor Drawer (Slide-out) */}
      <EditorDrawer />
    </div>
  );
};

export default App;
