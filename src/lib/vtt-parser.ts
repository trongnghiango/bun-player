import type { RawCue, SentenceCue } from "./types.ts";

/**
 * Parses timestamp string (00:00:01.000 or 00:01,000) into seconds
 */
export function parseTimestamp(timeStr: string): number {
  const clean = timeStr.trim().replace(",", ".");
  const parts = clean.split(":");
  let seconds = 0;

  if (parts.length === 3) {
    // HH:MM:SS.mmm
    seconds = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  } else if (parts.length === 2) {
    // MM:SS.mmm
    seconds = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  } else {
    seconds = parseFloat(clean);
  }

  return isNaN(seconds) ? 0 : seconds;
}

/**
 * Strips HTML tags, WebVTT cue settings, and Little Fox markup
 */
export function cleanSubtitleText(text: string): string {
  return text
    // Little Fox specific markup: [@word@] -> word, [i@...@i] -> ...
    .replace(/\[@(.*?)\@\]/g, "$1")
    .replace(/\[i\@(.*?)\@\i\]/g, "$1")
    .replace(/\[[a-z0-9@_]+\]/gi, "")
    // Standard HTML/VTT tags
    .replace(/<\/?[^>]+(>|$)/g, "")
    .replace(/\r\n|\r|\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks if a subtitle snippet is just non-verbal sound or music
 */
export function isPureSoundOrMusic(text: string): boolean {
  const clean = text.trim().toLowerCase();
  if (!clean) return true;
  if (/^(\[|\()[\w\s\-_]*(music|sound|applause|laughter|instrumental|bgm|intro|outro|theme|cheering|chuckle|sigh)[\w\s\-_]*(\]|\))$/i.test(clean)) {
    return true;
  }
  if (/^[♪♫#\s\-_=*~()\[\]]+$/.test(clean)) {
    return true;
  }
  return false;
}

/**
 * Parses raw WebVTT or SRT text into RawCue array
 */
export function parseSubtitleFile(content: string): RawCue[] {
  const lines = content.split(/\r\n|\r|\n/);
  const rawCues: RawCue[] = [];

  let currentStart = -1;
  let currentEnd = -1;
  let currentTextLines: string[] = [];

  const timeRegex = /((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})\s*-->\s*((?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3})/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      if (currentStart >= 0 && currentEnd >= 0 && currentTextLines.length > 0) {
        const text = cleanSubtitleText(currentTextLines.join(" "));
        if (text && !isPureSoundOrMusic(text)) {
          rawCues.push({
            startTime: currentStart,
            endTime: currentEnd,
            text,
          });
        }
      }
      currentStart = -1;
      currentEnd = -1;
      currentTextLines = [];
      continue;
    }

    const match = line.match(timeRegex);
    if (match) {
      currentStart = parseTimestamp(match[1]);
      currentEnd = parseTimestamp(match[2]);
      currentTextLines = [];
    } else if (currentStart >= 0) {
      // Ignore VTT header line "WEBVTT" or line numbers
      if (line !== "WEBVTT" && !line.startsWith("NOTE")) {
        currentTextLines.push(line);
      }
    }
  }

  // Push final cue if file doesn't end with blank line
  if (currentStart >= 0 && currentEnd >= 0 && currentTextLines.length > 0) {
    const text = cleanSubtitleText(currentTextLines.join(" "));
    if (text && !isPureSoundOrMusic(text)) {
      rawCues.push({
        startTime: currentStart,
        endTime: currentEnd,
        text,
      });
    }
  }

  return rawCues;
}

/**
 * Groups fragmented subtitle lines into complete natural spoken sentences
 */
export function groupIntoSentences(rawCues: RawCue[]): SentenceCue[] {
  if (rawCues.length === 0) return [];

  const sentenceCues: SentenceCue[] = [];
  let tempId = 1;

  let currentStart = rawCues[0].startTime;
  let currentEnd = rawCues[0].endTime;
  let accumulatedText = rawCues[0].text;

  // Regex to check if text ends with standard sentence endings (. ? ! or quotes after)
  const isSentenceEnd = (text: string) => /[.?!]["'”’]?\s*$/.test(text);

  for (let i = 1; i < rawCues.length; i++) {
    const nextCue = rawCues[i];
    const silenceGap = nextCue.startTime - currentEnd;

    // Condition to close the sentence:
    // 1. Text ends with punctuation (. ! ?) AND has at least 2 words (unless long silence)
    // 2. OR silence gap between cues is noticeable (> 1.2s)
    const wordCount = accumulatedText.trim().split(/\s+/).length;
    const endsWithPunct = isSentenceEnd(accumulatedText);
    const shouldClose =
      (endsWithPunct && (wordCount >= 2 || silenceGap > 1.0)) ||
      silenceGap > 1.5;

    if (shouldClose) {
      sentenceCues.push({
        id: tempId++,
        startTime: Math.round(currentStart * 1000) / 1000,
        endTime: Math.round(currentEnd * 1000) / 1000,
        text: accumulatedText,
      });

      currentStart = nextCue.startTime;
      currentEnd = nextCue.endTime;
      accumulatedText = nextCue.text;
    } else {
      // Continue grouping
      accumulatedText += " " + nextCue.text;
      currentEnd = nextCue.endTime;
    }
  }

  // Add the last accumulated sentence
  if (accumulatedText) {
    sentenceCues.push({
      id: tempId++,
      startTime: Math.round(currentStart * 1000) / 1000,
      endTime: Math.round(currentEnd * 1000) / 1000,
      text: accumulatedText,
    });
  }

  return sentenceCues;
}

/**
 * Faithful 1-to-1 subtitle importer:
 * Supports JSON project format, WebVTT, and SRT.
 * Preserves 100% of the cues in the file (e.g. 20 lines = 20 sentences).
 */
export function parseToSentenceCues(content: string): SentenceCue[] {
  // Check if content is JSON project
  try {
    const trimmed = content.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0 && typeof parsed[0].startTime === "number") {
        return parsed.map((c, i) => ({ ...c, id: i + 1 }));
      }
      if (parsed.cues && Array.isArray(parsed.cues) && parsed.cues.length > 0) {
        return parsed.cues.map((c: SentenceCue, i: number) => ({ ...c, id: i + 1 }));
      }
    }
  } catch {
    // Not valid JSON, continue with VTT/SRT
  }

  // Parse VTT / SRT lines
  const rawCues = parseSubtitleFile(content);
  return rawCues.map((c, idx) => ({
    id: idx + 1,
    startTime: Math.round(c.startTime * 1000) / 1000,
    endTime: Math.round(c.endTime * 1000) / 1000,
    text: c.text,
  }));
}

/**
 * Merges any sentence that is under minWords into the next sentence
 */
export function autoMergeShortCues(cues: SentenceCue[], minWords: number = 3): SentenceCue[] {
  if (cues.length <= 1) return cues;

  const result: SentenceCue[] = [];
  let i = 0;

  while (i < cues.length) {
    let current = { ...cues[i] };
    const words = current.text.trim().split(/\s+/).length;

    // If current sentence is too short and there is a next sentence, merge!
    if (words < minWords && i < cues.length - 1) {
      const next = cues[i + 1];
      current.text = `${current.text.trim()} ${next.text.trim()}`;
      current.endTime = next.endTime;
      current.isAdjusted = true;
      i += 2; // skip both and check if we need to keep going
      result.push(current);
    } else {
      result.push(current);
      i++;
    }
  }

  // Re-index all IDs sequentially
  return result.map((c, idx) => ({ ...c, id: idx + 1 }));
}

/**
 * Splits any sentence that exceeds maxWords into two balanced clauses
 */
export function autoSplitLongCues(cues: SentenceCue[], maxWords: number = 14): SentenceCue[] {
  const result: SentenceCue[] = [];

  for (let i = 0; i < cues.length; i++) {
    const cue = cues[i];
    const words = cue.text.trim().split(/\s+/);

    if (words.length <= maxWords) {
      result.push(cue);
      continue;
    }

    // Try finding a natural break near the middle (between 30% and 70% of words)
    const minBreak = Math.floor(words.length * 0.3);
    const maxBreak = Math.ceil(words.length * 0.7);
    let bestBreakIdx = Math.floor(words.length / 2);

    // Look for punctuation (, ; :) or conjunctions
    const conjunctions = ["and", "but", "because", "so", "then", "when", "while", "as", "if"];
    let foundPunct = false;

    for (let w = minBreak; w <= maxBreak; w++) {
      const word = words[w];
      if (/[,;:]$/.test(word)) {
        bestBreakIdx = w + 1;
        foundPunct = true;
        break;
      }
    }

    if (!foundPunct) {
      for (let w = minBreak; w <= maxBreak; w++) {
        const word = words[w].toLowerCase();
        if (conjunctions.includes(word)) {
          bestBreakIdx = w;
          break;
        }
      }
    }

    const text1 = words.slice(0, bestBreakIdx).join(" ");
    const text2 = words.slice(bestBreakIdx).join(" ");

    const ratio = bestBreakIdx / words.length;
    const splitTime = Math.round((cue.startTime + (cue.endTime - cue.startTime) * ratio) * 1000) / 1000;

    result.push({
      id: 0,
      startTime: cue.startTime,
      endTime: splitTime,
      text: text1,
      isAdjusted: true,
    });

    result.push({
      id: 0,
      startTime: splitTime,
      endTime: cue.endTime,
      text: text2,
      isAdjusted: true,
    });
  }

  return result.map((c, idx) => ({ ...c, id: idx + 1 }));
}