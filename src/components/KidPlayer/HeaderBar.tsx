import React from "react";
import { FileVideo, Subtitles, Eye, EyeOff, SlidersHorizontal, Sparkles, PauseCircle, PlayCircle, RotateCcw } from "../../lib/icons";
import { usePlayerStore } from "../../stores/usePlayerStore";
import { openMediaDialog, openSubtitleDialog, extractEmbeddedSubtitles } from "../../lib/tauri-bridge";
import { parseToSentenceCues } from "../../lib/vtt-parser";

export const HeaderBar: React.FC = () => {
  const videoName = usePlayerStore((s) => s.videoName);
  const cuesCount = usePlayerStore((s) => s.cues.length);
  const showSubtitle = usePlayerStore((s) => s.showSubtitle);
  const autoPause = usePlayerStore((s) => s.autoPause);
  const isEditorOpen = usePlayerStore((s) => s.isEditorOpen);
  const toggleSubtitle = usePlayerStore((s) => s.toggleSubtitle);
  const toggleAutoPause = usePlayerStore((s) => s.toggleAutoPause);
  const toggleEditor = usePlayerStore((s) => s.toggleEditor);
  const setMedia = usePlayerStore((s) => s.setMedia);
  const setCues = usePlayerStore((s) => s.setCues);
  const loadSampleDemo = usePlayerStore((s) => s.loadSampleDemo);
  const restoreFromCache = usePlayerStore((s) => s.restoreFromCache);

  const handleOpenVideo = async () => {
    const res = await openMediaDialog();
    if (res) {
      setMedia(res.url, res.name);
      // Auto-extract embedded subtitles if present inside the container
      const embeddedVtt = await extractEmbeddedSubtitles(res.path);
      if (embeddedVtt) {
        const sentenceCues = parseToSentenceCues(embeddedVtt);
        if (sentenceCues.length > 0) {
          setCues(sentenceCues, `${res.name} (Phụ đề nhúng sẵn)`);
        }
      }
    }
  };

  const handleOpenSubtitle = async () => {
    const res = await openSubtitleDialog();
    if (res) {
      // 1-to-1 faithful parse: preserves ALL 20+ cues without collapsing
      const sentenceCues = parseToSentenceCues(res.content);
      setCues(sentenceCues, res.path);
    }
  };

  return (
    <header className="h-14 px-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-20 select-none">
      {/* Left: App Title & File Importers */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-amber-400 font-bold text-lg tracking-wide">
          <Sparkles className="w-5 h-5 fill-amber-400 text-amber-500" />
          <span>Bun Player</span>
        </div>

        <div className="h-5 w-px bg-slate-800 mx-1" />

        <button
          onClick={handleOpenVideo}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
          title="Chọn video hoặc audio từ máy tính"
        >
          <FileVideo className="w-4 h-4 text-sky-400" />
          <span>Mở Video</span>
        </button>

        <button
          onClick={handleOpenSubtitle}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 transition-colors cursor-pointer"
          title="Chọn file phụ đề .vtt hoặc .srt"
        >
          <Subtitles className="w-4 h-4 text-emerald-400" />
          <span>Mở Phụ đề</span>
        </button>

        {cuesCount === 0 && (
          <>
            <button
              onClick={async () => {
                const ok = await restoreFromCache();
                if (!ok) alert("Chưa có bài học nào được lưu trong cache ~/.config/bun-player/!");
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-xs font-medium text-indigo-300 border border-indigo-500/30 transition-colors cursor-pointer"
              title="Khôi phục lại phiên làm việc đã lưu từ ~/.config/bun-player/cache.json"
            >
              <RotateCcw className="w-3.5 h-3.5 text-indigo-400" />
              <span>Khôi phục bản lưu</span>
            </button>

            <button
              onClick={loadSampleDemo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-xs font-semibold text-amber-300 border border-amber-500/30 transition-colors cursor-pointer"
            >
              <span>✨ Dùng thử video mẫu</span>
            </button>
          </>
        )}
      </div>

      {/* Middle: Video title if loaded */}
      {videoName && (
        <div className="max-w-xs md:max-w-md truncate text-xs text-slate-400 font-medium px-2 py-1 rounded bg-slate-950/60 border border-slate-800/80">
          🎞️ {videoName}
        </div>
      )}

      {/* Right: Kid-friendly Toggles & Parent Editor Trigger */}
      <div className="flex items-center gap-2">
        {/* Toggle Subtitles (Off by default for kid focus) */}
        <button
          onClick={toggleSubtitle}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
            showSubtitle
              ? "bg-indigo-600/30 border-indigo-500/50 text-indigo-300"
              : "bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200"
          }`}
          title="Bật/Tắt chữ phụ đề (Phím tắt: S)"
        >
          {showSubtitle ? <Eye className="w-4 h-4 text-indigo-400" /> : <EyeOff className="w-4 h-4" />}
          <span>{showSubtitle ? "Hiện chữ: BẬT" : "Ẩn chữ (Tập trung)"}</span>
        </button>

        {/* Toggle Auto-pause at sentence end */}
        <button
          onClick={toggleAutoPause}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
            autoPause
              ? "bg-emerald-600/30 border-emerald-500/50 text-emerald-300"
              : "bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200"
          }`}
          title="Tự động dừng khi hết câu để bé luyện nói"
        >
          {autoPause ? <PauseCircle className="w-4 h-4 text-emerald-400" /> : <PlayCircle className="w-4 h-4" />}
          <span>{autoPause ? "Ngắt câu: BẬT" : "Chạy liên tục"}</span>
        </button>

        <div className="h-5 w-px bg-slate-800 mx-1" />

        {/* Parent Editor Drawer Button */}
        <button
          onClick={() => toggleEditor()}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer border ${
            isEditorOpen
              ? "bg-amber-500 text-slate-950 font-bold border-amber-400"
              : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white"
          }`}
          title="Mở khay chỉnh sửa câu cho phụ huynh (Phím tắt: E)"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Chỉnh câu (E)</span>
        </button>
      </div>
    </header>
  );
};
