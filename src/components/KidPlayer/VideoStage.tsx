import React, { useRef, useEffect, useState } from "react";
import { Film, Sparkles, UploadCloud, AlertCircle } from "../../lib/icons";
import { usePlayerStore } from "../../stores/usePlayerStore";
import { openMediaDialog } from "../../lib/tauri-bridge";
import { parseToSentenceCues } from "../../lib/vtt-parser";

export const VideoStage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  const videoSrc = usePlayerStore((s) => s.videoSrc);
  const videoName = usePlayerStore((s) => s.videoName);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const showSubtitle = usePlayerStore((s) => s.showSubtitle);
  const targetStopSeconds = usePlayerStore((s) => s.targetStopSeconds);
  const activeCue = usePlayerStore((s) => (s.activeCueIndex >= 0 ? s.cues[s.activeCueIndex] : null));

  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const setTargetStopSeconds = usePlayerStore((s) => s.setTargetStopSeconds);
  const setMedia = usePlayerStore((s) => s.setMedia);
  const setCues = usePlayerStore((s) => s.setCues);
  const loadSampleDemo = usePlayerStore((s) => s.loadSampleDemo);

  useEffect(() => {
    setVideoError(null);
  }, [videoSrc]);

  // Sync isPlaying state to video element
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.play().catch((err) => {
        console.warn("Video playback interrupted or pending user interaction:", err);
      });
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying]);

  // Sync seek when currentTime changes significantly (from jumpToCue or replay)
  useEffect(() => {
    if (!videoRef.current) return;
    const diff = Math.abs(videoRef.current.currentTime - currentTime);
    if (diff > 0.3) {
      videoRef.current.currentTime = currentTime;
    }
  }, [currentTime]);

  // Sync playback rate
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Handle timeupdate & Little Fox Auto-pause
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    const current = videoRef.current.currentTime;

    // Check sentence auto-stop condition
    if (targetStopSeconds !== null && current >= targetStopSeconds) {
      videoRef.current.pause();
      setIsPlaying(false);
      setTargetStopSeconds(null);
      setCurrentTime(current);
      return;
    }

    setCurrentTime(current);
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  // Drag and drop handler for dropzone
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      const name = file.name.toLowerCase();
      if (name.endsWith(".mp4") || name.endsWith(".webm") || name.endsWith(".mp3") || name.endsWith(".m4a")) {
        const url = URL.createObjectURL(file);
        setMedia(url, file.name);
      } else if (name.endsWith(".vtt") || name.endsWith(".srt") || name.endsWith(".json")) {
        const text = await file.text();
        const sentenceCues = parseToSentenceCues(text);
        setCues(sentenceCues, file.name);
      }
    }
  };

  return (
    <div
      className="flex-1 w-full flex items-center justify-center relative bg-slate-950 p-2 md:p-4 overflow-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {videoSrc ? (
        <div className="relative w-full max-w-5xl aspect-video max-h-[72vh] rounded-2xl overflow-hidden shadow-2xl bg-black border border-slate-800/80 flex items-center justify-center">
          <video
            ref={videoRef}
            src={videoSrc}
            className="w-full h-full object-contain cursor-pointer"
            onClick={() => setIsPlaying(!isPlaying)}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            onError={(e) => {
              const target = e.currentTarget;
              const err = target.error;
              const ext = videoName.toLowerCase().split('.').pop();
              let msg = "Không thể phát video này.";
              if (err) {
                if (err.code === 3) msg = "Lỗi giải mã: Máy tính thiếu codec GStreamer hoặc file hỏng.";
                if (err.code === 4) {
                  if (ext === "mkv") {
                    msg = "Video dạng .mkv (codec AV1) cần gói 'gst-plugin-dav1d' trên Linux hoặc chuyển sang chuẩn .mp4 / .webm.";
                  } else {
                    msg = "Định dạng video không được hỗ trợ bởi WebKit trên hệ thống này.";
                  }
                }
              }
              setVideoError(msg);
            }}
            playsInline
          />

          {/* Video Error Overlay */}
          {videoError && (
            <div className="absolute inset-0 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10">
              <AlertCircle className="w-12 h-12 text-rose-500 mb-3" />
              <h4 className="text-lg font-bold text-rose-300 mb-1">Lỗi phát Video</h4>
              <p className="text-sm text-slate-300 max-w-md mb-4">{videoError}</p>
              <p className="text-xs text-slate-400 bg-slate-900 px-3 py-2 rounded-lg border border-slate-800 font-mono">
                Thử chạy qua trình duyệt: <span className="text-sky-400">pnpm run dev</span>
              </p>
            </div>
          )}

          {/* Subtitle Box - Disappears by default to avoid kid distraction, toggleable on demand */}
          {showSubtitle && activeCue && (
            <div className="absolute bottom-6 left-0 right-0 px-6 flex justify-center pointer-events-none transition-all">
              <div className="bg-slate-950/85 backdrop-blur-md border border-slate-700/60 text-white px-6 py-3 rounded-2xl shadow-2xl text-center max-w-3xl animate-in fade-in zoom-in-95 duration-200">
                <p className="text-xl md:text-2xl font-semibold tracking-wide text-amber-200 leading-snug drop-shadow-md">
                  {activeCue.text}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Empty State for Kid & Parent */
        <div className="w-full max-w-2xl p-8 rounded-3xl border-2 border-dashed border-slate-800 bg-slate-900/50 backdrop-blur-sm flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5 text-amber-400">
            <Film className="w-10 h-10" />
          </div>

          <h2 className="text-2xl font-bold text-slate-100 mb-2">Sẵn sàng để luyện tiếng Anh!</h2>
          <p className="text-sm text-slate-400 max-w-md mb-6 leading-relaxed">
            Kéo thả trực tiếp file <span className="text-sky-400 font-semibold">Video/Audio</span> và file{" "}
            <span className="text-emerald-400 font-semibold">Phụ đề (.vtt/.srt)</span> vào đây.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={async () => {
                const res = await openMediaDialog();
                if (res) setMedia(res.url, res.name);
              }}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm transition-all shadow-lg shadow-sky-600/20 cursor-pointer"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Chọn file từ máy</span>
            </button>

            <button
              onClick={loadSampleDemo}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-amber-500/20 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Chạy thử video mẫu</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
