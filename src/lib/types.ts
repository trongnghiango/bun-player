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
