# SYSTEM ARCHITECTURE — BUN PLAYER

## 1. High-Level Overview
Bun Player is a hybrid desktop and web application designed for pedagogical English learning (sentence-by-sentence pacing, Little Fox inspired model).

```text
┌─────────────────────────────────────────────────────────────┐
│                       PRESENTATION LAYER                    │
│   React 19 + Tailwind v4 + Lucide Icons (Subpath Imports)   │
│   ├── KidPlayer (VideoStage, BigControls, Timeline, Paging) │
│   ├── VoiceShadowing (Mic Recorder, Compare Bar)            │
│   └── ParentEditor (EditorDrawer, CueEditorItem)            │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                    APPLICATION STATE LAYER                   │
│   Zustand Store (`usePlayerStore`)                          │
│   ├── Playback State Machine (Playhead, Rates, Loop Count)  │
│   ├── Cue Model & Timing Adjuster                           │
│   ├── Shadowing Voice Blob Registry (cueId -> audioBlob)    │
│   └── Resource Lifecycle & Revocation Guard                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
┌──────────────────────────────▼──────────────────────────────┐
│                     INFRASTRUCTURE LAYER                    │
│   ├── Subtitle Parser & Serializer (VTT / SRT / JSON)       │
│   ├── Tauri IPC Bridge (Native Dialogs & FS Plugin)         │
│   ├── Web Fallbacks (HTML5 Dialog, FileSystem Access API)   │
│   └── Dual Streaming Engine:                                │
│       • Desktop: Rust Multithreaded Range Server (Port 0)    │
│       • Browser Dev: Vite Middleware Range Server (1420)     │
└─────────────────────────────────────────────────────────────┘
```

## 2. Media Streaming Strategy
Linux WebKitGTK prevents HTML5 `<video>` elements from streaming directly over custom URI schemes (`asset://`). Bun Player resolves this through a local zero-dependency HTTP server responding with `206 Partial Content` and `Accept-Ranges: bytes`, supporting instant seeking and smooth byte-range caching.

## 3. Subtitle Timing & Sentence Model
A `SentenceCue` represents a pedagogical atomic unit:
```ts
interface SentenceCue {
  id: number;           // 1-based sequential number
  startTime: number;    // seconds
  endTime: number;      // seconds
  text: string;         // Spoken sentence content
  isAdjusted?: boolean; // Flagged when edited by parent
}
```
1-to-1 parsing fidelity is maintained: input cues are never collapsed silently unless explicitly invoked via Parent Drawer tools (`autoMergeShort` / `autoSplitLong`).

## 4. Resource Lifecycle Guarantee
All dynamically created browser Object URLs (`blob:` schemes for media streams, uploaded videos, or microphone recordings) must be explicitly managed and released via `URL.revokeObjectURL()` upon media replacement, project clearance, or recording overwrite.