import React, { useRef, useState } from "react";
import { usePlayerStore } from "../../stores/usePlayerStore";
import type { SentenceCue } from "../../lib/types.ts";

interface CueMarkersProps {
  cues: SentenceCue[];
  activeCueIndex: number;
  duration: number;
  onJump: (index: number) => void;
}

const CueMarkers: React.FC<CueMarkersProps> = React.memo(({ cues, activeCueIndex, duration, onJump }) => {
  return (
    <>
      {cues.map((cue, idx) => {
        const startPct = (cue.startTime / duration) * 100;
        const widthPct = Math.max(0.3, ((cue.endTime - cue.startTime) / duration) * 100);
        const isActive = idx === activeCueIndex;

        return (
          <div
            key={cue.id}
            onClick={(e) => {
              e.stopPropagation();
              onJump(idx);
            }}
            style={{ left: `${startPct}%`, width: `${widthPct}%` }}
            className={`absolute top-0 bottom-0 rounded-sm ${
              isActive
                ? "bg-amber-400 shadow-sm shadow-amber-400/50 z-10 ring-1 ring-amber-300"
                : "bg-emerald-500/35 hover:bg-emerald-400/60 z-5"
            }`}
          />
        );
      })}
    </>
  );
});

// Zero-re-render Playhead: Only this leaf component updates on video playback ticks
const Playhead: React.FC<{ duration: number }> = React.memo(({ duration }) => {
  const currentTime = usePlayerStore((s) => s.currentTime);
  if (duration <= 0) return null;
  const currentPercent = Math.min(100, Math.max(0, (currentTime / duration) * 100));

  return (
    <>
      {/* Current Playhead Bar */}
      <div
        style={{ width: `${currentPercent}%` }}
        className="h-full bg-gradient-to-r from-sky-500/30 to-sky-400/50 rounded-full pointer-events-none"
      />

      {/* Playhead Scrubber Thumb - Zero CSS layout thrashing */}
      <div
        style={{ left: `${currentPercent}%` }}
        className="absolute -top-1 w-3 h-5 -ml-1.5 bg-amber-400 rounded-full shadow-md border border-slate-900 z-30 group-hover:ring-2 group-hover:ring-amber-400/40 group-hover:bg-amber-300 pointer-events-none"
      />
    </>
  );
});

// In-Flight Sentence Marker Band (Only renders when user is actively marking)
const LiveMarkerBand: React.FC<{ duration: number }> = React.memo(({ duration }) => {
  const pendingMarkerStart = usePlayerStore((s) => s.pendingMarkerStart);
  const currentTime = usePlayerStore((s) => s.currentTime);

  if (pendingMarkerStart === null || duration <= 0) return null;

  const start = Math.min(pendingMarkerStart, currentTime);
  const end = Math.max(pendingMarkerStart, currentTime);
  const markerStartPct = (start / duration) * 100;
  const markerWidthPct = Math.max(0.5, ((end - start) / duration) * 100);

  return (
    <div
      style={{ left: `${markerStartPct}%`, width: `${markerWidthPct}%` }}
      className="absolute top-0 bottom-0 bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 opacity-90 rounded-sm z-20 animate-pulse border-y border-amber-300"
    >
      <div className="absolute left-0 -top-2 w-2 h-5 bg-emerald-400 rounded-sm shadow-md ring-1 ring-emerald-200" />
    </div>
  );
});

export const TimelineBar: React.FC = () => {
  const progressBarRef = useRef<HTMLDivElement>(null);
  const duration = usePlayerStore((s) => s.duration);
  const cues = usePlayerStore((s) => s.cues);
  const activeCueIndex = usePlayerStore((s) => s.activeCueIndex);
  const seekToTime = usePlayerStore((s) => s.seekToTime);
  const jumpToCue = usePlayerStore((s) => s.jumpToCue);

  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverText, setHoverText] = useState<string | null>(null);
  const [hoverPos, setHoverPos] = useState<number>(0);

  if (duration <= 0) return null;

  const formatTime = (seconds: number) => {
    const s = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = Math.round(ratio * duration * 100) / 100;
    seekToTime(newTime);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const hoverX = e.clientX - rect.left;
    const ratio = Math.max(0, Math.min(1, hoverX / rect.width));
    const t = Math.round(ratio * duration * 10) / 10;
    setHoverTime(t);
    setHoverPos(hoverX);

    // Check if hovering an existing cue
    const hoveredCue = cues.find((c) => t >= c.startTime && t <= c.endTime);
    if (hoveredCue) {
      setHoverText(`Câu ${hoveredCue.id}: ${hoveredCue.text}`);
    } else {
      setHoverText(null);
    }
  };

  const handleMouseLeave = () => {
    setHoverTime(null);
    setHoverText(null);
  };

  return (
    <div className="w-full px-4 md:px-6 pt-2 select-none">
      <div
        ref={progressBarRef}
        onClick={handleSeek}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="group relative w-full h-3 bg-slate-950/80 hover:bg-slate-950 rounded-full cursor-pointer transition-colors border border-slate-800 hover:border-slate-700 flex items-center overflow-visible"
        title="Bấm hoặc kéo để tua video"
      >
        {/* Existing Sentence Blocks on Timeline (Zero Reconciliation on playhead ticks) */}
        <CueMarkers
          cues={cues}
          activeCueIndex={activeCueIndex}
          duration={duration}
          onJump={jumpToCue}
        />

        {/* Live Active In-Flight Marker Strip */}
        <LiveMarkerBand duration={duration} />

        {/* Zero-Lag Isolated Playhead */}
        <Playhead duration={duration} />

        {/* Tooltip on Hover */}
        {hoverTime !== null && (
          <div
            style={{ left: `${hoverPos}px` }}
            className="absolute -top-9 -translate-x-1/2 bg-slate-900 border border-slate-700 text-slate-100 text-[11px] font-mono px-2 py-0.5 rounded shadow-xl pointer-events-none z-40 whitespace-nowrap"
          >
            <span>{formatTime(hoverTime)}</span>
            {hoverText && <span className="ml-1.5 text-amber-300 font-sans">{hoverText}</span>}
          </div>
        )}
      </div>
    </div>
  );
};
