import { SentenceCue } from "./types";

/**
 * Formats seconds into WebVTT timestamp (HH:MM:SS.mmm)
 */
export function formatVttTimestamp(seconds: number): string {
  const s = Math.max(0, seconds);
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const millis = Math.round((s % 1) * 1000);

  const hh = hours.toString().padStart(2, "0");
  const mm = minutes.toString().padStart(2, "0");
  const ss = secs.toString().padStart(2, "0");
  const mmm = millis.toString().padStart(3, "0");

  return `${hh}:${mm}:${ss}.${mmm}`;
}

/**
 * Serializes SentenceCue[] array back into standard WebVTT format
 */
export function serializeToVtt(cues: SentenceCue[]): string {
  let output = "WEBVTT - Exported from Little Fox Desktop Player\n\n";

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    const start = formatVttTimestamp(cue.startTime);
    const end = formatVttTimestamp(cue.endTime);

    output += `${cue.id}\n`;
    output += `${start} --> ${end}\n`;
    output += `${cue.text}\n\n`;
  }

  return output;
}
