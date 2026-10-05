export interface SentenceCue {
  id: number;              // 1-based index (matching button numbers)
  startTime: number;       // in seconds
  endTime: number;         // in seconds
  text: string;            // Sentence content
  isAdjusted?: boolean;    // Marked when modified by parent
}

export interface RawCue {
  startTime: number;
  endTime: number;
  text: string;
}

export type LoopTarget = 1 | 2 | 3 | typeof Infinity;

export interface VoiceRecordingItem {
  cueId: number;
  audioUrl: string;
  duration: number;
  recordedAt: string;
}
export interface MarkerResult {
  type: "start" | "end" | "ignored";
  cue?: SentenceCue;
  time: number;
}
