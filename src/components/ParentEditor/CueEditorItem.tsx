import React, { memo } from "react";
import { Play, Minus, Plus, GitMerge, Scissors, Trash2, Magnet } from "../../lib/icons";
import { SentenceCue } from "../../lib/types";
import { usePlayerStore } from "../../stores/usePlayerStore";

interface Props {
  cue: SentenceCue;
  isActive: boolean;
  isFirst: boolean;
  isLast: boolean;
}

export const CueEditorItem: React.FC<Props> = memo(({ cue, isActive, isFirst, isLast }) => {
  const duration = usePlayerStore((s) => s.duration);
  const updateCueTiming = usePlayerStore((s) => s.updateCueTiming);
  const updateCueText = usePlayerStore((s) => s.updateCueText);
  const jumpToCue = usePlayerStore((s) => s.jumpToCue);
  const mergeWithNext = usePlayerStore((s) => s.mergeWithNext);
  const splitCue = usePlayerStore((s) => s.splitCue);
  const removeCue = usePlayerStore((s) => s.removeCue);
  const snapToPrevious = usePlayerStore((s) => s.snapToPrevious);

  const handleAdjustStart = (delta: number) => {
    updateCueTiming(cue.id, cue.startTime + delta, cue.endTime);
  };

  const handleAdjustEnd = (delta: number) => {
    updateCueTiming(cue.id, cue.startTime, cue.endTime + delta);
  };

  const maxDuration = duration > 0 ? duration : 300;

  return (
    <div
      className={`p-3.5 rounded-xl border transition-all ${
        isActive
          ? "bg-amber-500/10 border-amber-500/50 shadow-md ring-1 ring-amber-500/30"
          : "bg-slate-900/60 border-slate-800 hover:border-slate-700"
      }`}
    >
      {/* Top: Cue ID, Text, Actions */}
      <div className="flex items-start justify-between gap-2.5 mb-2.5">
        <div className="flex items-start gap-2 flex-1">
          <span className="w-6 h-6 rounded-full bg-slate-800 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
            {cue.id}
          </span>
          <input
            type="text"
            value={cue.text}
            onChange={(e) => updateCueText(cue.id, e.target.value)}
            className="w-full bg-transparent text-sm font-medium text-slate-200 border-b border-transparent focus:border-amber-400 focus:bg-slate-800/80 rounded px-1.5 py-0.5 outline-none transition-colors"
            title="Nhấp vào để sửa lại chữ hoặc sửa lỗi"
          />
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Snap to Previous Button */}
          {!isFirst && (
            <button
              onClick={() => snapToPrevious(cue.id)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-teal-600/20 hover:bg-teal-600/40 text-teal-300 hover:text-teal-100 transition-colors text-xs font-medium cursor-pointer border border-teal-500/30"
              title="Tự động nối tiếp ngay sau câu trước (bắt đầu câu này = kết thúc câu trước)"
            >
              <Magnet className="w-3.5 h-3.5" />
              <span>Nối</span>
            </button>
          )}

          {/* Split Button */}
          <button
            onClick={() => splitCue(cue.id)}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-pink-600/20 hover:bg-pink-600/40 text-pink-300 hover:text-pink-100 transition-colors text-xs font-medium cursor-pointer border border-pink-500/30"
            title="Tách câu này làm đôi (tại mốc video đang nghe hoặc chia đều)"
          >
            <Scissors className="w-3.5 h-3.5" />
            <span>Tách</span>
          </button>

          {/* Merge Button */}
          {!isLast && (
            <button
              onClick={() => mergeWithNext(cue.id)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-300 hover:text-indigo-100 transition-colors text-xs font-medium cursor-pointer border border-indigo-500/30"
              title="Gộp câu này với câu tiếp theo bên dưới"
            >
              <GitMerge className="w-3.5 h-3.5" />
              <span>Gộp</span>
            </button>
          )}

          {/* Play Snippet */}
          <button
            onClick={() => jumpToCue(cue.id - 1)}
            className="p-1.5 rounded-lg bg-sky-600/20 hover:bg-sky-600/40 text-sky-400 hover:text-sky-200 transition-colors cursor-pointer"
            title="Nghe thử đúng câu này"
          >
            <Play className="w-4 h-4 fill-sky-400/50" />
          </button>

          {/* Remove / Exclude Cue Button */}
          <button
            onClick={() => removeCue(cue.id)}
            className="p-1.5 rounded-lg bg-red-600/10 hover:bg-red-600/30 text-red-400 hover:text-red-200 transition-colors cursor-pointer border border-red-500/20"
            title="Bỏ câu này (đoạn nhạc dạo / khoảng trống / giới thiệu - không tính là câu học)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Timing Controls */}
      <div className="space-y-2 pt-1 border-t border-slate-800/80 text-xs">
        {/* Start Time Slider & Nudge */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-400 w-12 font-medium">Bắt đầu:</span>
          <span className="font-mono text-slate-300 w-14 font-semibold">{cue.startTime.toFixed(2)}s</span>

          <input
            type="range"
            min={0}
            max={maxDuration}
            step={0.05}
            value={cue.startTime}
            onChange={(e) => updateCueTiming(cue.id, parseFloat(e.target.value), cue.endTime)}
            className="flex-1 accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleAdjustStart(-0.1)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="-0.1s"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleAdjustStart(0.1)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="+0.1s"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* End Time Slider & Nudge */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-slate-400 w-12 font-medium">Kết thúc:</span>
          <span className="font-mono text-slate-300 w-14 font-semibold">{cue.endTime.toFixed(2)}s</span>

          <input
            type="range"
            min={0}
            max={maxDuration}
            step={0.05}
            value={cue.endTime}
            onChange={(e) => updateCueTiming(cue.id, cue.startTime, parseFloat(e.target.value))}
            className="flex-1 accent-amber-400 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
          />

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleAdjustEnd(-0.1)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="-0.1s"
            >
              <Minus className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleAdjustEnd(0.1)}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
              title="+0.1s"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});
