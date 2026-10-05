import React, { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "../../lib/icons";
import { usePlayerStore } from "../../stores/usePlayerStore";

const ITEMS_PER_PAGE = 7;

export const SentencePagination: React.FC = () => {
  const cues = usePlayerStore((s) => s.cues);
  const activeCueIndex = usePlayerStore((s) => s.activeCueIndex);
  const jumpToCue = usePlayerStore((s) => s.jumpToCue);
  const [currentPage, setCurrentPage] = useState(0);

  // Automatically keep current active sentence in view
  useEffect(() => {
    if (activeCueIndex >= 0) {
      const pageOfActive = Math.floor(activeCueIndex / ITEMS_PER_PAGE);
      setCurrentPage(pageOfActive);
    }
  }, [activeCueIndex]);

  if (cues.length === 0) return null;

  const totalPages = Math.ceil(cues.length / ITEMS_PER_PAGE);
  const startIdx = currentPage * ITEMS_PER_PAGE;
  const currentCues = cues.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  return (
    <div className="w-full py-2 px-4 flex items-center justify-center gap-2 select-none">
      {/* Prev Page Button */}
      <button
        onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
        disabled={currentPage === 0}
        className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
        title="Trang câu trước"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      {/* Numbered Little Fox Buttons */}
      <div className="flex items-center gap-2">
        {currentCues.map((cue, idx) => {
          const globalIdx = startIdx + idx;
          const isActive = globalIdx === activeCueIndex;

          return (
            <button
              key={cue.id}
              onClick={() => jumpToCue(globalIdx)}
              className={`paging-btn relative w-10 h-10 rounded-full font-bold text-sm flex items-center justify-center cursor-pointer transition-all shadow-md ${
                isActive
                  ? "bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 scale-110 shadow-amber-500/40 ring-4 ring-amber-400/20"
                  : "bg-slate-800/90 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60"
              }`}
              title={`Câu ${cue.id}: ${cue.text}`}
            >
              <span>{cue.id}</span>
              {cue.isAdjusted && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-slate-900" />
              )}
            </button>
          );
        })}
      </div>

      {/* Next Page Button */}
      <button
        onClick={() => setCurrentPage((p) => Math.min(totalPages - 1, p + 1))}
        disabled={currentPage >= totalPages - 1}
        className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-800 text-slate-300 hover:bg-slate-700 disabled:opacity-30 disabled:pointer-events-none transition-all cursor-pointer"
        title="Trang câu kế tiếp"
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};
