import React from "react";
import { Play, Pause, RotateCcw, SkipForward, Gauge } from "../../lib/icons";
import { usePlayerStore } from "../../stores/usePlayerStore";

const SPEEDS = [0.7, 0.85, 1.0, 1.2];

export const BigControls: React.FC = () => {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);
  const replayCurrentCue = usePlayerStore((s) => s.replayCurrentCue);
  const nextCue = usePlayerStore((s) => s.nextCue);

  const formatTime = (seconds: number) => {
    const s = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="h-20 px-6 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between z-10 select-none">
      {/* Left: Time Duration Display */}
      <div className="w-36 text-xs font-mono text-slate-400">
        <span className="text-slate-100 font-semibold">{formatTime(currentTime)}</span>
        <span className="mx-1 text-slate-600">/</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Center: Big Friendly Action Buttons */}
      <div className="flex items-center gap-4">
        {/* Replay Current Sentence Button */}
        <button
          onClick={replayCurrentCue}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-sm shadow-md transition-all active:scale-95 border border-slate-700 cursor-pointer"
          title="Nghe lại câu này từ đầu (Phím tắt: R)"
        >
          <RotateCcw className="w-5 h-5 text-amber-400" />
          <span>Nghe lại (R)</span>
        </button>

        {/* Big Play / Pause Button */}
        <button
          onClick={() => setIsPlaying(!isPlaying)}
          className="w-14 h-14 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          title="Chạy / Tạm dừng (Phím tắt: Space)"
        >
          {isPlaying ? <Pause className="w-6 h-6 fill-slate-950" /> : <Play className="w-6 h-6 fill-slate-950 ml-0.5" />}
        </button>

        {/* Next Sentence Button */}
        <button
          onClick={nextCue}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-sm shadow-md transition-all active:scale-95 border border-slate-700 cursor-pointer"
          title="Sang câu tiếp theo (Phím tắt: Mũi tên Phải)"
        >
          <span>Câu tiếp</span>
          <SkipForward className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {/* Right: Playback Speed Selector */}
      <div className="w-44 flex items-center justify-end gap-1.5">
        <Gauge className="w-4 h-4 text-slate-500 mr-1" />
        {SPEEDS.map((speed) => (
          <button
            key={speed}
            onClick={() => setPlaybackRate(speed)}
            className={`px-2 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              playbackRate === speed
                ? "bg-amber-500 text-slate-950 shadow-sm"
                : "bg-slate-800 text-slate-400 hover:text-slate-200"
            }`}
          >
            {speed}x
          </button>
        ))}
      </div>
    </div>
  );
};
