import React, { useRef, useEffect, useState } from "react";
import { Film, Sparkles, UploadCloud, AlertCircle, Mic, Square, MapPin, X, Volume2 } from "../../lib/icons";
import { usePlayerStore } from "../../stores/usePlayerStore";
import { openMediaDialog, extractEmbeddedSubtitles } from "../../lib/tauri-bridge";
import { parseToSentenceCues } from "../../lib/vtt-parser";
import { subscribeToAudioLevel } from "../../lib/audio-recorder";

export const VideoStage: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoError, setVideoError] = useState<string | null>(null);

  const videoSrc = usePlayerStore((s) => s.videoSrc);
  const videoName = usePlayerStore((s) => s.videoName);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const seekRequest = usePlayerStore((s) => s.seekRequest);
  const playbackRate = usePlayerStore((s) => s.playbackRate);
  const showSubtitle = usePlayerStore((s) => s.showSubtitle);
  const isFullscreen = usePlayerStore((s) => s.isFullscreen);
  const toggleFullscreen = usePlayerStore((s) => s.toggleFullscreen);
  const activeCue = usePlayerStore((s) => (s.activeCueIndex >= 0 ? s.cues[s.activeCueIndex] : null));

  const pendingMarkerStart = usePlayerStore((s) => s.pendingMarkerStart);
  const lastMarkerNotification = usePlayerStore((s) => s.lastMarkerNotification);
  const cancelPendingMarker = usePlayerStore((s) => s.cancelPendingMarker);
  const clearMarkerNotification = usePlayerStore((s) => s.clearMarkerNotification);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [recordDuration, setRecordDuration] = useState<number>(0);
  const isPlayingRecording = usePlayerStore((s) => s.isPlayingRecording);
  const isRecording = usePlayerStore((s) => s.isRecording);
  const recordingCueId = usePlayerStore((s) => s.recordingCueId);
  const stopRecordingCue = usePlayerStore((s) => s.stopRecordingCue);

  const setCurrentTime = usePlayerStore((s) => s.setCurrentTime);
  const setDuration = usePlayerStore((s) => s.setDuration);
  const setIsPlaying = usePlayerStore((s) => s.setIsPlaying);
  const setMedia = usePlayerStore((s) => s.setMedia);
  const setCues = usePlayerStore((s) => s.setCues);
  const loadSampleDemo = usePlayerStore((s) => s.loadSampleDemo);

  useEffect(() => {
    setVideoError(null);
  }, [videoSrc]);
  // Subscribe to live audio volume levels and track recording seconds
  useEffect(() => {
    if (!isRecording) {
      setAudioLevel(0);
      setRecordDuration(0);
      return;
    }

    const unsubscribe = subscribeToAudioLevel((lvl) => {
      setAudioLevel(lvl);
    });

    const timer = setInterval(() => {
      setRecordDuration((prev) => prev + 1);
    }, 1000);

    return () => {
      unsubscribe();
      clearInterval(timer);
    };
  }, [isRecording]);

  useEffect(() => {
    if (lastMarkerNotification) {
      const timer = setTimeout(() => {
        clearMarkerNotification();
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [lastMarkerNotification, clearMarkerNotification]);


  // Sync explicit one-shot seek requests (zero playback interference)
  useEffect(() => {
    if (!videoRef.current || seekRequest === null) return;
    videoRef.current.currentTime = seekRequest;
    usePlayerStore.setState({ seekRequest: null });
  }, [seekRequest]);

  // Track active play promise to prevent DOMException AbortError and GStreamer pipeline lockup
  const playPromiseRef = useRef<Promise<void> | null>(null);

  // Sync isPlaying state safely with native video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      if (video.paused) {
        const promise = video.play();
        if (promise !== undefined) {
          playPromiseRef.current = promise;
          promise
            .then(() => {
              playPromiseRef.current = null;
              // If user requested pause while play() was still resolving
              if (!usePlayerStore.getState().isPlaying && !video.paused) {
                video.pause();
              }
            })
            .catch((err) => {
              playPromiseRef.current = null;
              // Benign AbortError caused by rapid subsequent pause(): do NOT override store!
              if (err.name === "AbortError") return;
              console.warn("Video playback error:", err);
              if (video.paused && usePlayerStore.getState().isPlaying) {
                usePlayerStore.setState({ isPlaying: false });
              }
            });
        }
      }
    } else {
      if (playPromiseRef.current) {
        // Play is in flight: wait for it to settle cleanly before calling pause()
        playPromiseRef.current
          .then(() => {
            if (!usePlayerStore.getState().isPlaying && !video.paused) {
              video.pause();
            }
          })
          .catch(() => {});
      } else if (!video.paused) {
        video.pause();
      }
    }
  }, [isPlaying]);

  // Sync playback rate
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate]);

  // Handle timeupdate from hardware decoder
  const handleTimeUpdate = () => {
    if (!videoRef.current) return;
    setCurrentTime(videoRef.current.currentTime);
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
      if (name.endsWith(".mp4") || name.endsWith(".webm") || name.endsWith(".mkv") || name.endsWith(".mp3") || name.endsWith(".m4a")) {
        const url = URL.createObjectURL(file);
        setMedia(url, file.name, file.name, file);
        const embeddedVtt = await extractEmbeddedSubtitles(file.name, file);
        if (embeddedVtt) {
          const sentenceCues = parseToSentenceCues(embeddedVtt);
          if (sentenceCues.length > 0) {
            setCues(sentenceCues, `${file.name} (Phụ đề nhúng sẵn)`);
          }
        }
      } else if (name.endsWith(".vtt") || name.endsWith(".srt") || name.endsWith(".json")) {
        const text = await file.text();
        const sentenceCues = parseToSentenceCues(text);
        setCues(sentenceCues, file.name);
      }
    }
  };

  return (
    <div
      className={`flex-1 w-full flex items-center justify-center relative bg-slate-950 overflow-hidden transition-all ${isFullscreen ? "p-0" : "p-2 md:p-4"}`}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {videoSrc ? (
        <div
          className={`relative w-full aspect-video flex items-center justify-center transition-all bg-black ${
            isFullscreen
              ? "max-w-none h-full max-h-none rounded-none border-none"
              : "max-w-5xl max-h-[72vh] rounded-2xl overflow-hidden shadow-2xl border border-slate-800/80"
          }`}
        >
          <video
            ref={videoRef}
            src={videoSrc}
            className="w-full h-full object-contain cursor-pointer"
            onClick={() => setIsPlaying(!isPlaying)}
            onDoubleClick={toggleFullscreen}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onEnded={() => setIsPlaying(false)}
            onPlay={() => {
              if (!usePlayerStore.getState().isPlaying) {
                usePlayerStore.setState({ isPlaying: true });
              }
            }}
            onPause={() => {
              if (usePlayerStore.getState().isPlaying) {
                usePlayerStore.setState({ isPlaying: false, targetStopSeconds: null });
              }
            }}
            onError={(e) => {
              const target = e.currentTarget;
              const err = target.error;
              let msg = "Không thể truy cập dữ liệu video từ nguồn cũ.";
              if (err) {
                if (err.code === 3) msg = "Lỗi giải mã video: File bị hỏng hoặc thiếu codec.";
                if (err.code === 4) msg = "Đường dẫn video cần được kết nối lại.";
              }
              setVideoError(msg);
            }}
            playsInline
          />

          {/* Live Sentence Marking Banner ("Làm dấu") */}
          {pendingMarkerStart !== null && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-amber-950/95 border border-amber-400/80 px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 z-30 animate-in fade-in zoom-in-95 duration-200">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
              <div className="flex items-center gap-1.5 text-xs text-amber-200 font-bold">
                <MapPin className="w-4 h-4 text-amber-400" />
                <span>Đang làm dấu câu... Bấm [M] hoặc nút "Chốt câu" khi dứt câu!</span>
              </div>
              <button
                onClick={cancelPendingMarker}
                className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-medium transition-colors cursor-pointer"
                title="Hủy mốc này (Esc)"
              >
                <X className="w-3 h-3" />
                <span>Hủy (Esc)</span>
              </button>
            </div>
          )}

          {/* Fleeting Marker Notification Toast */}
          {lastMarkerNotification && (
            <div className="absolute top-16 left-1/2 -translate-x-1/2 bg-slate-900/95 border border-slate-700/80 px-4 py-1.5 rounded-full shadow-xl flex items-center gap-2 z-25 animate-in fade-in slide-in-from-top-2 duration-200">
              <span className="text-xs text-slate-100 font-semibold">{lastMarkerNotification}</span>
            </div>
          )}

          {/* Floating Recording Indicator for Kid Shadowing with Live VU Meter */}
          {isRecording && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-rose-950/95 border-2 border-rose-500/80 px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 z-30 animate-in fade-in zoom-in-95 duration-200">
              <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
              
              <div className="flex items-center gap-2 text-xs text-rose-100 font-semibold">
                <Mic className="w-4 h-4 text-rose-400" />
                <span>Bé đang đọc Câu {recordingCueId}</span>
                <span className="font-mono text-amber-300 font-bold bg-rose-900/60 px-1.5 py-0.5 rounded">
                  00:{recordDuration.toString().padStart(2, "0")}s
                </span>
              </div>

              {/* Live Animated Audio Level VU Meter */}
              <div className="flex items-end gap-1 h-4 px-1" title="Mức âm lượng microphone">
                {[0.4, 0.7, 1.0, 0.6, 0.3].map((factor, i) => {
                  const barHeight = Math.max(3, Math.min(16, (audioLevel / 100) * 16 * factor + 3));
                  return (
                    <div
                      key={i}
                      style={{ height: `${barHeight}px` }}
                      className={`w-1 rounded-full transition-all duration-75 ${
                        audioLevel > 15 ? "bg-emerald-400 shadow-sm shadow-emerald-400/50" : "bg-rose-400/60"
                      }`}
                    />
                  );
                })}
              </div>

              <button
                onClick={() => stopRecordingCue()}
                className="flex items-center gap-1 px-3 py-1 rounded-full bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all cursor-pointer shadow hover:scale-105 active:scale-95"
              >
                <Square className="w-2.5 h-2.5 fill-white" />
                <span>Xong (V)</span>
              </button>
            </div>
          )}

          {/* Floating Pill when Playing Recorded Voice */}
          {isPlayingRecording && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-emerald-950/95 border border-emerald-500/80 px-4 py-1.5 rounded-full shadow-2xl flex items-center gap-2.5 z-30 animate-in fade-in zoom-in-95 duration-200">
              <Volume2 className="w-4 h-4 text-emerald-400 animate-bounce" />
              <span className="text-xs text-emerald-100 font-bold">
                🔊 Đang phát lại giọng đọc của bé...
              </span>
            </div>
          )}

          {/* Video Error Overlay with Easy Reconnect Button */}
          {videoError && (
            <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center p-6 text-center z-10 animate-in fade-in duration-200">
              <AlertCircle className="w-12 h-12 text-amber-400 mb-3" />
              <h4 className="text-lg font-bold text-slate-100 mb-1">Cần kết nối lại file Video</h4>
              <p className="text-xs text-slate-400 max-w-md mb-4 leading-relaxed">
                Các câu thoại của bạn vẫn được lưu nguyên vẹn 100%. Vui lòng bấm nút bên dưới để chọn lại file video{" "}
                <span className="text-amber-300 font-semibold">{videoName}</span>.
              </p>
              <button
                onClick={async () => {
                  const res = await openMediaDialog();
                  if (res) {
                    setMedia(res.url, res.name, res.path, res.file);
                    setVideoError(null);
                  }
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm transition-all shadow-lg shadow-sky-600/20 cursor-pointer"
              >
                <UploadCloud className="w-4 h-4" />
                <span>Chọn lại file: {videoName || "Video"}</span>
              </button>
            </div>
          )}

          {/* Subtitle Box - Disappears by default to avoid kid distraction, toggleable on demand */}
          {showSubtitle && activeCue && (
            <div className="absolute bottom-6 left-0 right-0 px-6 flex justify-center pointer-events-none transition-all">
              <div className="bg-slate-950/85 border border-slate-700/60 text-white px-6 py-3 rounded-2xl shadow-2xl text-center max-w-3xl animate-in fade-in zoom-in-95 duration-200">
                <p className="text-xl md:text-2xl font-semibold tracking-wide text-amber-200 leading-snug drop-shadow-md">
                  {activeCue.text}
                </p>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Empty State for Kid & Parent */
        <div className="w-full max-w-2xl p-8 rounded-3xl border-2 border-dashed border-slate-800 bg-slate-900/50 flex flex-col items-center justify-center text-center">
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
                if (res) {
                  setMedia(res.url, res.name, res.path, res.file);
                  const embeddedVtt = await extractEmbeddedSubtitles(res.path, res.file);
                  if (embeddedVtt) {
                    const sentenceCues = parseToSentenceCues(embeddedVtt);
                    if (sentenceCues.length > 0) {
                      setCues(sentenceCues, `${res.name} (Phụ đề nhúng sẵn)`);
                    }
                  }
                }
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