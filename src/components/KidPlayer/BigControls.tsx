import React from "react";
import {
  Play,
  Pause,
  RotateCcw,
  SkipForward,
  Gauge,
  Maximize2,
  Minimize2,
  Repeat,
  Repeat1,
  Mic,
  Square,
  Volume2,
  Trash2,
  Star,
  MapPin,
  Flag,
  X,
} from "../../lib/icons";
import { usePlayerStore } from "../../stores/usePlayerStore";
import { TimelineBar } from "./TimelineBar";

const SPEEDS = [0.7, 0.85, 1.0, 1.2];

const TimeDisplay: React.FC = React.memo(() => {
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);

  const format = (seconds: number) => {
    const s = Math.max(0, Math.floor(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="hidden sm:block w-28 text-xs font-mono text-slate-400">
      <span className="text-slate-100 font-semibold">{format(currentTime)}</span>
      <span className="mx-1 text-slate-600">/</span>
      <span>{format(duration)}</span>
    </div>
  );
});

export const BigControls: React.FC = () => {
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const isFullscreen = usePlayerStore((s) => s.isFullscreen);
  const showSentencesInFullscreen = usePlayerStore((s) => s.showSentencesInFullscreen);
  const sentenceLoopTarget = usePlayerStore((s) => s.sentenceLoopTarget);
  const currentSentenceLoopCount = usePlayerStore((s) => s.currentSentenceLoopCount);
  const activeCueIndex = usePlayerStore((s) => s.activeCueIndex);
  const cues = usePlayerStore((s) => s.cues);
  const recordedVoices = usePlayerStore((s) => s.recordedVoices);
  const recordedDurations = usePlayerStore((s) => s.recordedDurations);
  const isRecording = usePlayerStore((s) => s.isRecording);
  const isPlayingRecording = usePlayerStore((s) => s.isPlayingRecording);
  const pendingMarkerStart = usePlayerStore((s) => s.pendingMarkerStart);

  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const setPlaybackRate = usePlayerStore((s) => s.setPlaybackRate);
  const replayCurrentCue = usePlayerStore((s) => s.replayCurrentCue);
  const nextCue = usePlayerStore((s) => s.nextCue);
  const toggleFullscreen = usePlayerStore((s) => s.toggleFullscreen);
  const toggleSentencesInFullscreen = usePlayerStore((s) => s.toggleSentencesInFullscreen);
  const cycleSentenceLoopTarget = usePlayerStore((s) => s.cycleSentenceLoopTarget);
  const startRecordingCue = usePlayerStore((s) => s.startRecordingCue);
  const stopRecordingCue = usePlayerStore((s) => s.stopRecordingCue);
  const playRecordingForCue = usePlayerStore((s) => s.playRecordingForCue);
  const stopPlayingRecording = usePlayerStore((s) => s.stopPlayingRecording);
  const deleteRecordingForCue = usePlayerStore((s) => s.deleteRecordingForCue);
  const toggleMarkerAtCurrentTime = usePlayerStore((s) => s.toggleMarkerAtCurrentTime);
  const cancelPendingMarker = usePlayerStore((s) => s.cancelPendingMarker);

  const currentCue = activeCueIndex >= 0 ? cues[activeCueIndex] : null;
  const currentCueId = currentCue?.id;
  const currentRecordingUrl = currentCueId ? recordedVoices[currentCueId] : null;
  const recordedDuration = currentCueId ? recordedDurations[currentCueId] : undefined;
  const durationLabel = recordedDuration ? `${recordedDuration}s` : "";


  const getLoopBadgeText = () => {
    if (sentenceLoopTarget === Infinity) return "🔁 Vô tận";
    if (sentenceLoopTarget === 1) return "Lặp 1x";
    const currentIter = currentSentenceLoopCount + 1;
    return `Lặp ${sentenceLoopTarget}x (${currentIter}/${sentenceLoopTarget})`;
  };

  const handleToggleRecord = async () => {
    if (isRecording) {
      await stopRecordingCue();
    } else if (currentCueId) {
      await startRecordingCue(currentCueId);
    }
  };

  return (
    <div className="bg-slate-900/95 border-t border-slate-800 flex flex-col z-10 select-none">
      {/* 1. Sleek Interactive Timeline with Sentence Blocks and Live Markers */}
      <TimelineBar />

      {/* 2. Main Control Bar */}
      <div className="h-16 px-4 md:px-6 flex items-center justify-between gap-2">
        {/* Left: Time Duration Display, Smart Loop Switcher, and Live Sentence Marker */}
        <div className="flex items-center gap-2 md:gap-3">
          <TimeDisplay />

          {/* Smart Sentence Loop Button */}
          <button
            onClick={cycleSentenceLoopTarget}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
              sentenceLoopTarget > 1 || sentenceLoopTarget === Infinity
                ? "bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-sm"
                : "bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-slate-200"
            }`}
            title="Chọn số lần lặp lại câu trước khi dừng (Phím tắt: L)"
          >
            {sentenceLoopTarget === 1 ? (
              <Repeat1 className="w-3.5 h-3.5 text-slate-400" />
            ) : (
              <Repeat className="w-3.5 h-3.5 text-amber-400 animate-in spin-in-180 duration-200" />
            )}
            <span className="hidden sm:inline">{getLoopBadgeText()}</span>
          </button>

          {/* Live Sentence Marker Button ("Làm dấu") */}
          <div className="flex items-center gap-1">
            {pendingMarkerStart === null ? (
              <button
                onClick={() => toggleMarkerAtCurrentTime()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-800/90 hover:bg-slate-700 text-sky-300 border border-sky-500/30 transition-all cursor-pointer shadow-sm active:scale-95"
                title="Bấm để đánh dấu bắt đầu câu khi nghe liên tục (Phím tắt: M)"
              >
                <MapPin className="w-3.5 h-3.5 text-sky-400" />
                <span>Làm dấu (M)</span>
              </button>
            ) : (
              <div className="flex items-center gap-1 bg-amber-500/20 border border-amber-400/60 p-0.5 rounded-xl animate-pulse shadow-md shadow-amber-500/20">
                <button
                  onClick={() => toggleMarkerAtCurrentTime()}
                  className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-extrabold bg-amber-400 text-slate-950 transition-all cursor-pointer hover:bg-amber-300"
                  title="Bấm để chốt kết thúc câu và tạo câu mới (Phím tắt: M)"
                >
                  <Flag className="w-3.5 h-3.5 fill-slate-950 text-slate-950" />
                  <span>Chốt câu (M)</span>
                </button>
                <button
                  onClick={cancelPendingMarker}
                  className="p-1 rounded-lg hover:bg-rose-950/60 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                  title="Hủy mốc làm dấu này (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Center: Big Friendly Action Buttons & Kid Shadowing */}
        <div className="flex items-center gap-2 md:gap-3">
          {/* Replay Current Sentence Button */}
          <button
            onClick={replayCurrentCue}
            className="flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs md:text-sm shadow-md transition-all active:scale-95 border border-slate-700 cursor-pointer"
            title="Nghe lại câu này từ đầu (Phím tắt: R)"
          >
            <RotateCcw className="w-4 h-4 text-amber-400" />
            <span className="hidden sm:inline">Nghe lại (R)</span>
          </button>

          {/* Big Play / Pause Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-gradient-to-tr from-amber-500 to-amber-300 text-slate-950 flex items-center justify-center shadow-lg shadow-amber-500/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
            title="Chạy / Tạm dừng (Phím tắt: Space)"
          >
            {isPlaying ? (
              <Pause className="w-5 h-5 fill-slate-950" />
            ) : (
              <Play className="w-5 h-5 fill-slate-950 ml-0.5" />
            )}
          </button>

          {/* Next Sentence Button */}
          <button
            onClick={nextCue}
            className="flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-xs md:text-sm shadow-md transition-all active:scale-95 border border-slate-700 cursor-pointer"
            title="Sang câu tiếp theo (Phím tắt: Mũi tên Phải)"
          >
            <span className="hidden sm:inline">Câu tiếp</span>
            <SkipForward className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {/* Kid Voice Shadowing Button (Mic / Play voice) */}
          {currentCueId && (
            <div className="flex items-center gap-1 ml-1 pl-2 border-l border-slate-800">
              {isRecording ? (
                <button
                  onClick={handleToggleRecord}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 animate-pulse transition-all cursor-pointer"
                  title="Bấm để hoàn tất ghi âm"
                >
                  <Square className="w-3 h-3 fill-white" />
                  <span>Đang thu... (V)</span>
                </button>
              ) : currentRecordingUrl ? (
                <div className="flex items-center gap-1 bg-slate-950/60 p-0.5 rounded-full border border-emerald-500/30">
                  <button
                    onClick={() => {
                      if (isPlayingRecording) stopPlayingRecording();
                      else playRecordingForCue(currentCueId);
                    }}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                      isPlayingRecording
                        ? "bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30 animate-pulse"
                        : "bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30"
                    }`}
                    title={durationLabel ? `Nghe lại giọng bé đã thu cho câu này (${durationLabel})` : "Nghe lại giọng bé đã thu cho câu này"}
                  >
                    <Volume2 className="w-3 h-3 text-emerald-400" />
                    <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                    <span>{isPlayingRecording ? "Đang phát..." : durationLabel ? `Giọng bé (${durationLabel})` : "Giọng bé"}</span>
                  </button>

                  <button
                    onClick={handleToggleRecord}
                    className="p-1 rounded-full hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition-colors cursor-pointer"
                    title="Thu âm lại câu này (V)"
                  >
                    <Mic className="w-3 h-3" />
                  </button>

                  <button
                    onClick={() => deleteRecordingForCue(currentCueId)}
                    className="p-1 rounded-full hover:bg-rose-950/40 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Xóa bản thu âm này"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleToggleRecord}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-800 hover:bg-slate-700 text-sky-300 hover:text-sky-200 font-medium text-xs transition-all border border-slate-700 cursor-pointer"
                  title="Bé luyện nói và thu âm theo câu này (Phím tắt: V)"
                >
                  <Mic className="w-3 h-3 text-sky-400" />
                  <span>Luyện đọc (V)</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Right: Playback Speed Selector & Fullscreen */}
        <div className="flex items-center justify-end gap-1.5">
          <div className="flex items-center gap-0.5 bg-slate-950/40 p-0.5 rounded-xl border border-slate-800/80">
            <Gauge className="w-3 h-3 text-slate-500 ml-1 mr-0.5" />
            {SPEEDS.map((speed) => (
              <button
                key={speed}
                onClick={() => setPlaybackRate(speed)}
                className={`px-1.5 py-0.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  playbackRate === speed
                    ? "bg-amber-500 text-slate-950 shadow-sm"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {speed}x
              </button>
            ))}
          </div>

          {/* Optional Toggle Sentence Bar visibility in Fullscreen */}
          {isFullscreen && (
            <button
              onClick={toggleSentencesInFullscreen}
              className={`px-2 py-1 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                showSentencesInFullscreen
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:text-white"
              }`}
              title="Bật / Tắt hiển thị dãy số câu trong toàn màn hình"
            >
              {showSentencesInFullscreen ? "Ẩn số câu" : "Hiện số câu"}
            </button>
          )}

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-amber-400 transition-colors cursor-pointer border border-slate-700/60"
            title={isFullscreen ? "Thu nhỏ màn hình (Phím tắt: F hoặc Esc)" : "Toàn màn hình (Phím tắt: F)"}
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>
    </div>
  );
};