/**
 * Kid Voice Recorder Service
 * High-reliability audio recording using Web Audio API PCM capture (WAV encoding)
 * and MediaRecorder fallback with real-time volume level monitoring.
 */

let activeStream: MediaStream | null = null;
let activeAudioContext: AudioContext | null = null;
let activeProcessor: ScriptProcessorNode | null = null;
let activeSource: MediaStreamAudioSourceNode | null = null;
let activeMediaRecorder: MediaRecorder | null = null;
let activeAudioElement: HTMLAudioElement | null = null;

// Recorded PCM audio buffers
let pcmChunks: Float32Array[] = [];
let mediaChunks: BlobPart[] = [];
let totalSamples = 0;
let recordingStartTime = 0;
let currentVolumeLevel = 0;
let volumeListeners: ((level: number) => void)[] = [];

export interface RecorderResult {
  blob: Blob;
  url: string;
  duration: number; // in seconds
  size: number;     // in bytes
}

export function subscribeToAudioLevel(listener: (level: number) => void): () => void {
  volumeListeners.push(listener);
  return () => {
    volumeListeners = volumeListeners.filter((l) => l !== listener);
  };
}

function broadcastVolume(level: number) {
  currentVolumeLevel = level;
  for (const listener of volumeListeners) {
    try {
      listener(level);
    } catch {}
  }
}

export function getCurrentAudioLevel(): number {
  return currentVolumeLevel;
}

export async function isMicrophoneAvailable(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    return false;
  }
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.some((d) => d.kind === "audioinput");
  } catch {
    return true; // Assume available if enumeration is blocked
  }
}

/**
 * Start recording microphone input
 */
export async function startMicrophoneRecording(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microphone API is not supported in this environment");
  }

  // Stop any previous active recording or stream
  stopMicrophoneRecordingSilently();

  pcmChunks = [];
  totalSamples = 0;
  recordingStartTime = Date.now();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    activeStream = stream;

    // 1. Initialize Web Audio API for guaranteed uncompressed WAV capture & volume metering
    const AudioCtx = typeof window !== "undefined" ? (window.AudioContext || (window as any).webkitAudioContext) : null;
    if (AudioCtx) {
      try {
        const audioCtx = new AudioCtx();
        activeAudioContext = audioCtx;

        if (audioCtx.state === "suspended") {
          await audioCtx.resume();
        }

        const source = audioCtx.createMediaStreamSource(stream);
        activeSource = source;

        // Use 4096 buffer size (~92ms chunks at 44.1kHz)
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);
        activeProcessor = processor;

        processor.onaudioprocess = (e) => {
          const inputData = e.inputBuffer.getChannelData(0);
          const chunk = new Float32Array(inputData);
          pcmChunks.push(chunk);
          totalSamples += chunk.length;

          // Compute RMS volume for live audio level meter
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) {
            sum += inputData[i] * inputData[i];
          }
          const rms = Math.sqrt(sum / inputData.length);
          const level = Math.min(100, Math.round(rms * 350));
          broadcastVolume(level);
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
      } catch (err) {
        console.warn("Web Audio API PCM setup failed, continuing with stream:", err);
      }
    }

    
    // 2. Also start MediaRecorder for secondary/fallback capture
    if (typeof MediaRecorder !== "undefined") {
      try {
        let mimeType = "audio/webm";
        if (typeof MediaRecorder.isTypeSupported === "function") {
          if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
            mimeType = "audio/webm;codecs=opus";
          } else if (MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")) {
            mimeType = "audio/ogg;codecs=opus";
          } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
            mimeType = "audio/mp4";
          }
        }
        mediaChunks = [];
        const recorder = new MediaRecorder(stream, { mimeType });
        activeMediaRecorder = recorder;
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            mediaChunks.push(e.data);
          }
        };
        recorder.start(100);
      } catch (err) {
        console.warn("MediaRecorder initialization fallback:", err);
      }
    }

    return true;
  } catch (err: unknown) {
    stopMicrophoneRecordingSilently();
    throw err;
  }
}

/**
 * Stop active recording and return the recorded audio blob + URL + duration
 */
export async function stopMicrophoneRecording(): Promise<RecorderResult | null> {
  const duration = Math.max(0.2, (Date.now() - recordingStartTime) / 1000);

  // If we collected PCM samples via AudioContext: produce crystal-clear 16-bit WAV
  if (pcmChunks.length > 0 && totalSamples > 0 && activeAudioContext) {
    const sampleRate = activeAudioContext.sampleRate || 44100;
    const merged = new Float32Array(totalSamples);
    let offset = 0;
    for (const chunk of pcmChunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }

    stopMicrophoneRecordingSilently();

    const wavBlob = encodeWav(merged, sampleRate);
    const url = URL.createObjectURL(wavBlob);

    return {
      blob: wavBlob,
      url,
      duration: Math.round(duration * 10) / 10,
      size: wavBlob.size,
    };
  }

  // Fallback: If MediaRecorder chunks were captured
  if (activeMediaRecorder) {
    return new Promise((resolve) => {
      const rec = activeMediaRecorder!;
      rec.onstop = () => {
        if (mediaChunks.length > 0) {
          const mime = rec.mimeType || "audio/webm";
          const blob = new Blob(mediaChunks, { type: mime });
          const url = URL.createObjectURL(blob);
          stopMicrophoneRecordingSilently();
          resolve({
            blob,
            url,
            duration: Math.round(duration * 10) / 10,
            size: blob.size,
          });
        } else {
          stopMicrophoneRecordingSilently();
          resolve(null);
        }
      };

      try {
        rec.stop();
      } catch {
        stopMicrophoneRecordingSilently();
        resolve(null);
      }
    });
  }
  // Fallback: If no samples collected, clean up and return null
  stopMicrophoneRecordingSilently();
  return null;
}

/**
 * Immediate cleanup of recorder and microphone hardware stream
 */
export function stopMicrophoneRecordingSilently(): void {
  broadcastVolume(0);

  if (activeProcessor) {
    try {
      activeProcessor.disconnect();
    } catch {}
    activeProcessor = null;
  }

  if (activeSource) {
    try {
      activeSource.disconnect();
    } catch {}
    activeSource = null;
  }

  if (activeAudioContext) {
    try {
      activeAudioContext.close();
    } catch {}
    activeAudioContext = null;
  }

  if (activeMediaRecorder && activeMediaRecorder.state !== "inactive") {
    try {
      activeMediaRecorder.stop();
    } catch {}
  }
  activeMediaRecorder = null;

  if (activeStream) {
    try {
      activeStream.getTracks().forEach((track) => track.stop());
    } catch {}
    activeStream = null;
  }

  pcmChunks = [];
  totalSamples = 0;
}

/**
 * Plays a recorded audio URL, managing active audio instance
 */
export function playRecordedVoice(
  url: string,
  onEnded?: () => void,
  onError?: (err: unknown) => void
): HTMLAudioElement {
  stopPlayingRecordedVoice();

  const audio = new Audio();
  audio.src = url;
  activeAudioElement = audio;

  audio.onended = () => {
    if (activeAudioElement === audio) {
      activeAudioElement = null;
    }
    onEnded?.();
  };

  audio.onerror = (e) => {
    console.error("playRecordedVoice error:", e, audio.error);
    if (activeAudioElement === audio) {
      activeAudioElement = null;
    }
    onError?.(audio.error || e);
  };

  audio.play().catch((err) => {
    console.error("playRecordedVoice play catch:", err);
    if (activeAudioElement === audio) {
      activeAudioElement = null;
    }
    onError?.(err);
  });

  return audio;
}

/**
 * Stops playback of recorded voice
 */
export function stopPlayingRecordedVoice(): void {
  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch {}
    activeAudioElement = null;
  }
}

/**
 * Revoke an Object URL safely
 */
export function revokeAudioUrlSafely(url: string | null | undefined): void {
  if (url && typeof url === "string" && url.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(url);
    } catch {}
  }
}

/**
 * Pure 16-bit PCM WAV Encoder with standard RIFF header
 */
function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  writeString(view, 0, "RIFF");
  // file length
  view.setUint32(4, 36 + samples.length * 2, true);
  // RIFF type
  writeString(view, 8, "WAVE");
  // format chunk identifier
  writeString(view, 12, "fmt ");
  // format chunk length
  view.setUint32(16, 16, true);
  // sample format (1 = PCM)
  view.setUint16(20, 1, true);
  // channel count (1 = mono)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * 2 for 16-bit mono)
  view.setUint32(28, sampleRate * 2, true);
  // block align (1 channel * 2 bytes/sample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);
  // data chunk identifier
  writeString(view, 36, "data");
  // data chunk length
  view.setUint32(40, samples.length * 2, true);

  // Write 16-bit PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([view], { type: "audio/wav" });
}

function writeString(view: DataView, offset: number, string: string): void {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}