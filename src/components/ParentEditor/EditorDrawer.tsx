import React, { useState, useRef, useEffect } from "react";
import { X, Save, Sliders, ArrowLeftRight, Search, Check, Sparkles, Scissors, Plus, Film, FileVideo, Star, Repeat, Trash2, MapPin, Flag } from "../../lib/icons";
import { usePlayerStore } from "../../stores/usePlayerStore";
import { CueEditorItem } from "./CueEditorItem";
import { serializeToVtt } from "../../lib/vtt-serializer";
import { saveSubtitleFile, exportEmbeddedVideo } from "../../lib/tauri-bridge";

export const EditorDrawer: React.FC = () => {
  const videoSrc = usePlayerStore((s) => s.videoSrc);
  const videoName = usePlayerStore((s) => s.videoName);
  const videoPath = usePlayerStore((s) => s.videoPath);
  const videoFile = usePlayerStore((s) => s.videoFile);
  const cues = usePlayerStore((s) => s.cues);
  const activeCueIndex = usePlayerStore((s) => s.activeCueIndex);
  const subtitlePath = usePlayerStore((s) => s.subtitlePath);
  const isEditorOpen = usePlayerStore((s) => s.isEditorOpen);
  const toggleEditor = usePlayerStore((s) => s.toggleEditor);
  const shiftAllCues = usePlayerStore((s) => s.shiftAllCues);
  const autoMergeShort = usePlayerStore((s) => s.autoMergeShort);
  const autoSplitLong = usePlayerStore((s) => s.autoSplitLong);
  const addCueAtCurrentTime = usePlayerStore((s) => s.addCueAtCurrentTime);
  const sentenceLoopTarget = usePlayerStore((s) => s.sentenceLoopTarget);
  const setSentenceLoopTarget = usePlayerStore((s) => s.setSentenceLoopTarget);
  const recordedVoices = usePlayerStore((s) => s.recordedVoices);
  const clearAllRecordings = usePlayerStore((s) => s.clearAllRecordings);
  const pendingMarkerStart = usePlayerStore((s) => s.pendingMarkerStart);
  const toggleMarkerAtCurrentTime = usePlayerStore((s) => s.toggleMarkerAtCurrentTime);
  const [searchTerm, setSearchTerm] = useState("");
  const [saveStatus, setSaveStatus] = useState<{ success: boolean; message: string } | null>(null);
  const activeItemRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active sentence
  useEffect(() => {
    if (isEditorOpen && activeItemRef.current) {
      activeItemRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [activeCueIndex, isEditorOpen]);

  if (!isEditorOpen) return null;

  const filteredCues = cues.filter((c) =>
    c.text.toLowerCase().includes(searchTerm.toLowerCase()) || c.id.toString() === searchTerm.trim()
  );

  const handleSave = async (forceSaveAs: boolean = false) => {
    const vttContent = serializeToVtt(cues);
    const res = await saveSubtitleFile(subtitlePath, vttContent, forceSaveAs);
    if (res.success && res.path) {
      usePlayerStore.setState({ subtitlePath: res.path });
    }
    setSaveStatus({ success: res.success, message: res.message });
    setTimeout(() => {
      setSaveStatus(null);
    }, 6000);
  };

  const handleExportEmbeddedMp4 = async () => {
    if (!videoName || cues.length === 0) return;
    const vttContent = serializeToVtt(cues);
    let rawPath = videoPath || videoSrc || videoName;
    if (rawPath.startsWith("/media-stream?path=")) {
      rawPath = decodeURIComponent(rawPath.replace("/media-stream?path=", ""));
    } else if (rawPath.startsWith("asset://localhost/")) {
      rawPath = decodeURIComponent(rawPath.replace("asset://localhost/", ""));
    }

    setSaveStatus({ success: true, message: "Đang xử lý và đóng gói video..." });
    const res = await exportEmbeddedVideo(rawPath, vttContent, videoName, videoFile);
    setSaveStatus({ success: res.success, message: res.message });
    setTimeout(() => setSaveStatus(null), 8000);
  };

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[480px] bg-slate-950/95 backdrop-blur-xl border-l border-slate-800 z-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200 select-none">
      {/* Drawer Header */}
      <div className="p-4 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <Sliders className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-slate-100 text-sm">Khay Tinh Chỉnh Phụ Huynh</h3>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span className="truncate max-w-[130px]" title={subtitlePath || "Chưa có file"}>
                {subtitlePath ? `📄 ${subtitlePath.split(/[\/\\]/).pop()}` : "Chưa có file"}
              </span>
              <span
                className="text-emerald-400 font-mono text-[10px] bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800/60 shrink-0"
                title="Mọi chỉnh sửa đều được tự động lưu theo thời gian thực vào ~/.config/bun-player/cache.json"
              >
                ● Auto-saved
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Overwrite Save Button */}
          <button
            onClick={() => handleSave(false)}
            disabled={cues.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-md cursor-pointer bg-amber-500 hover:bg-amber-400 text-slate-950 disabled:opacity-40"
            title="Lưu đè file phụ đề hiện tại"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Lưu</span>
          </button>

          {/* Save As (Choose Directory) Button */}
          <button
            onClick={() => handleSave(true)}
            disabled={cues.length === 0}
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium transition-all shadow-md cursor-pointer bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 disabled:opacity-40"
            title="Chọn thư mục và đặt tên file mới để lưu (Save As)"
          >
            <span>Lưu thành...</span>
          </button>

          {/* Close Button */}
          <button
            onClick={() => toggleEditor(false)}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer border border-slate-800"
            title="Đóng (Phím tắt: E hoặc Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Save Status Notification Banner */}
      {saveStatus && (
        <div
          className={`px-4 py-2.5 text-xs border-b flex items-start gap-2 animate-in fade-in duration-200 ${
            saveStatus.success
              ? "bg-emerald-950/90 border-emerald-700 text-emerald-200"
              : "bg-red-950/90 border-red-700 text-red-200"
          }`}
        >
          <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
          <div className="flex-1">
            <p className="font-semibold break-all leading-relaxed">{saveStatus.message}</p>
          </div>
        </div>
      )}

      {/* Export Integrated Video Bar */}
      <div className="px-4 py-2 bg-indigo-950/40 border-b border-indigo-900/50 flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-indigo-300 font-medium">
          <Film className="w-3.5 h-3.5 text-indigo-400" />
          <span>Gói 1 file duy nhất:</span>
        </div>
        <button
          onClick={handleExportEmbeddedMp4}
          disabled={cues.length === 0 || !videoSrc}
          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition-all shadow-md shadow-indigo-600/30 disabled:opacity-40 cursor-pointer"
          title="Tích hợp toàn bộ phụ đề đã chỉnh sửa vào thẳng video thành 1 file MP4 duy nhất (chạy được trên mọi TV, iPad, điện thoại)"
        >
          <FileVideo className="w-3.5 h-3.5" />
          <span>Xuất MP4 kèm Sub</span>
        </button>
      </div>

      {/* Global Offset Bar */}
      <div className="px-4 py-2.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-xs">
        <span className="text-slate-400 flex items-center gap-1.5">
          <ArrowLeftRight className="w-3.5 h-3.5 text-sky-400" />
          <span>Dịch toàn bộ mốc:</span>
        </span>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => shiftAllCues(-0.5)}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer font-mono"
            title="Dịch sớm 0.5 giây"
          >
            -0.5s
          </button>
          <button
            onClick={() => shiftAllCues(-0.1)}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer font-mono"
            title="Dịch sớm 0.1 giây"
          >
            -0.1s
          </button>
          <button
            onClick={() => shiftAllCues(0.1)}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer font-mono"
            title="Dịch trễ 0.1 giây"
          >
            +0.1s
          </button>
          <button
            onClick={() => shiftAllCues(0.5)}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer font-mono"
            title="Dịch trễ 0.5 giây"
          >
            +0.5s
          </button>
        </div>
      </div>

      {/* Quick Tools Bar */}
      <div className="px-4 py-2 bg-slate-900/40 border-b border-slate-800/80 flex items-center justify-between text-xs">
        <span className="text-slate-400">Tự động:</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => autoMergeShort(3)}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition-colors cursor-pointer font-medium"
            title="Tự động tìm và gộp các câu thoại quá ngắn (< 3 từ)"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Gộp câu ngắn</span>
          </button>

          <button
            onClick={() => autoSplitLong(14)}
            className="flex items-center gap-1.5 px-2 py-1 rounded bg-pink-500/15 hover:bg-pink-500/25 text-pink-300 border border-pink-500/30 transition-colors cursor-pointer font-medium"
            title="Tự động tìm và tách các câu thoại quá dài (> 14 từ) tại dấu phẩy hoặc liên từ"
          >
            <Scissors className="w-3.5 h-3.5 text-pink-400" />
            <span>Tách câu dài</span>
          </button>
        </div>
      </div>

      {/* Manual Add & Live Marker Bar */}
      <div className="px-4 py-2 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-xs">
        <span className="text-slate-400">Làm dấu & Tạo câu:</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => toggleMarkerAtCurrentTime()}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              pendingMarkerStart !== null
                ? "bg-amber-400 text-slate-950 animate-pulse hover:bg-amber-300 shadow-md shadow-amber-400/30"
                : "bg-sky-600/20 hover:bg-sky-600/30 text-sky-300 border border-sky-500/30"
            }`}
            title="Làm dấu mốc đầu và cuối câu khi nghe video liên tục (Phím tắt: M)"
          >
            {pendingMarkerStart !== null ? (
              <Flag className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
            ) : (
              <MapPin className="w-3.5 h-3.5 text-sky-400" />
            )}
            <span>{pendingMarkerStart !== null ? "Chốt câu (M)" : "Làm dấu (M)"}</span>
          </button>
          <button
            onClick={addCueAtCurrentTime}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition-colors cursor-pointer"
            title="Tạo mốc câu học mới cố định ngay tại vị trí video đang nghe"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm +3s</span>
          </button>
        </div>
      </div>

      {/* Pedagogical Control Bar: Looping & Voice Shadowing */}
      <div className="px-4 py-2.5 bg-slate-900/80 border-b border-slate-800/80 flex flex-col gap-2 text-xs">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 flex items-center gap-1.5 font-medium">
            <Repeat className="w-3.5 h-3.5 text-amber-400" />
            <span>Chế độ lặp lại câu:</span>
          </span>
          <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-lg border border-slate-800">
            {([1, 2, 3, Infinity] as const).map((count) => (
              <button
                key={String(count)}
                onClick={() => setSentenceLoopTarget(count)}
                className={`px-2 py-0.5 rounded text-[11px] font-bold transition-all cursor-pointer ${
                  sentenceLoopTarget === count
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {count === Infinity ? "🔁 Vô tận" : `${count}x`}
              </button>
            ))}
          </div>
        </div>

        {cues.length > 0 && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-800/60">
            <div className="flex items-center gap-1.5 text-emerald-400 font-medium text-[11px]">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span>Tiến độ luyện đọc: </span>
              <span className="font-bold text-slate-200">
                {Object.keys(recordedVoices).length} / {cues.length} câu
              </span>
            </div>
            {Object.keys(recordedVoices).length > 0 && (
              <button
                onClick={() => {
                  if (window.confirm("Bạn có chắc muốn xóa tất cả các bản thu âm giọng đọc của bé?")) {
                    clearAllRecordings();
                  }
                }}
                className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/40 text-[10px] transition-colors cursor-pointer"
                title="Xóa toàn bộ bản thu âm để bé luyện đọc lại từ đầu"
              >
                <Trash2 className="w-3 h-3" />
                <span>Xóa hết bản thu</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Search Input */}
      <div className="p-3 border-b border-slate-800/80">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Tìm kiếm câu thoại hoặc số câu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
      </div>

      {/* Cues List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredCues.length > 0 ? (
          filteredCues.map((cue) => {
            const isActive = cue.id - 1 === activeCueIndex;
            const isFirst = cues.length > 0 && cue.id === cues[0].id;
            const isLast = cues.length > 0 && cue.id === cues[cues.length - 1].id;
            return (
              <div key={cue.id} ref={isActive ? activeItemRef : undefined}>
                <CueEditorItem cue={cue} isActive={isActive} isFirst={isFirst} isLast={isLast} />
              </div>
            );
          })
        ) : (
          <div className="h-40 flex flex-col items-center justify-center text-slate-500 text-xs">
            {cues.length === 0 ? "Chưa có file phụ đề nào được nạp." : "Không tìm thấy câu nào phù hợp."}
          </div>
        )}
      </div>
    </div>
  );
};