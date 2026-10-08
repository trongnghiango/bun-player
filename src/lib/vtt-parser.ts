import type { RawCue, SentenceCue } from "./types.ts";

/**
 * Decodes common HTML entities found in subtitle tracks
 */
export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#39;/gi, "'")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

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
 * Strips HTML tags, WebVTT cue settings, ASS/SSA tags, and Little Fox markup
 */
export function cleanSubtitleText(text: string): string {
  return decodeHtmlEntities(
    text
      // Little Fox specific markup: [@word@] -> word, [i@...@i] -> ...
      .replace(/\[@(.*?)\@\]/g, "$1")
      .replace(/\[i\@(.*?)\@\i\]/g, "$1")
      .replace(/\[[a-z0-9@_]+\]/gi, "")
      // ASS / SSA style override tags: {\an8}, {\pos(x,y)}, {\c&H...&}
      .replace(/\{[^\}]*\}/g, "")
      // Standard HTML / VTT tags: <font color="...">, </font>, <b>, <i>, <c.yellow>, etc.
      .replace(/<\/?[^>]+(>|$)/g, "")
      .replace(/\r\n|\r|\n/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );
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
      if (line !== "WEBVTT" && !line.startsWith("NOTE") && !/^\d+$/.test(line)) {
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
 * Normalizes text for comparing equality or prefix growth in karaoke cues
 */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/["'”’‘“]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Checks if a text snippet ends with sentence-terminating punctuation (. ? ! or closing quote)
 */
function isSentenceEnding(text: string): boolean {
  return /[.?!]["'”’]?\s*$/.test(text);
}

/**
 * Stage 1: Collapses repeating word-highlight cues or progressive karaoke sequences into single cues
 */
export function collapseKaraokeCues(rawCues: RawCue[]): RawCue[] {
  if (rawCues.length === 0) return [];

  const collapsed: RawCue[] = [];
  let group: RawCue[] = [rawCues[0]];

  for (let i = 1; i < rawCues.length; i++) {
    const curr = rawCues[i];
    const prev = group[group.length - 1];
    const groupBaseNorm = normalizeForComparison(group[0].text);
    const currNorm = normalizeForComparison(curr.text);
    const gap = curr.startTime - prev.endTime;

    // Condition 1: Identical clean text (e.g., font color tag moved to next word)
    const isIdentical = currNorm === groupBaseNorm;

    // Condition 2: Progressive prefix growth (e.g., "Mrs." -> "Mrs. Rabbit" -> "Mrs. Rabbit had...")
    const isPrefixGrowth =
      currNorm.startsWith(groupBaseNorm) &&
      currNorm.split(" ").length > groupBaseNorm.split(" ").length;

    if ((isIdentical || isPrefixGrowth) && gap <= 1.5) {
      group.push(curr);
    } else {
      let earliest = group[0].startTime;
      let latest = group[0].endTime;
      let bestText = group[0].text;

      for (let j = 0; j < group.length; j++) {
        if (group[j].startTime < earliest) earliest = group[j].startTime;
        if (group[j].endTime > latest) latest = group[j].endTime;
        if (group[j].text.length > bestText.length) bestText = group[j].text;
      }

      collapsed.push({
        startTime: earliest,
        endTime: latest,
        text: bestText,
      });
      group = [curr];
    }
  }

  if (group.length > 0) {
    let earliest = group[0].startTime;
    let latest = group[0].endTime;
    let bestText = group[0].text;
    for (let j = 0; j < group.length; j++) {
      if (group[j].startTime < earliest) earliest = group[j].startTime;
      if (group[j].endTime > latest) latest = group[j].endTime;
      if (group[j].text.length > bestText.length) bestText = group[j].text;
    }
    collapsed.push({
      startTime: earliest,
      endTime: latest,
      text: bestText,
    });
  }

  return collapsed;
}

/**
 * Stage 2: Groups fragmented subtitle lines and collapsed karaoke into complete natural spoken sentences
 */
export function groupIntoSentences(rawCues: RawCue[]): SentenceCue[] {
  if (rawCues.length === 0) return [];

  // Stage 1: Collapse karaoke highlights first
  const collapsed = collapseKaraokeCues(rawCues);
  if (collapsed.length === 0) return [];

  const results: SentenceCue[] = [];
  let curStart = collapsed[0].startTime;
  let curEnd = collapsed[0].endTime;
  let curText = collapsed[0].text;

  for (let i = 1; i < collapsed.length; i++) {
    const nextCue = collapsed[i];
    const silenceGap = nextCue.startTime - curEnd;
    const endsWithPunct = isSentenceEnding(curText);
    const words = curText.trim().split(/\s+/).length;

    // Sentence closure criteria:
    // 1. Current text ends with sentence punctuation (. ? !) AND has at least 2 words (or silence gap >= 0.8s)
    // 2. OR silence gap between spoken lines is noticeable (> 1.2s)
    // 3. OR current text is already long (>= 15 words)
    const shouldClose =
      (endsWithPunct && (words >= 2 || silenceGap >= 0.8)) ||
      silenceGap > 1.2 ||
      words >= 15;

    if (shouldClose) {
      results.push({
        id: results.length + 1,
        startTime: Math.round(curStart * 1000) / 1000,
        endTime: Math.round(curEnd * 1000) / 1000,
        text: curText,
      });
      curStart = nextCue.startTime;
      curEnd = nextCue.endTime;
      curText = nextCue.text;
    } else {
      curText += " " + nextCue.text;
      curEnd = Math.max(curEnd, nextCue.endTime);
    }
  }

  if (curText) {
    results.push({
      id: results.length + 1,
      startTime: Math.round(curStart * 1000) / 1000,
      endTime: Math.round(curEnd * 1000) / 1000,
      text: curText,
    });
  }

  return results;
}

/**
 * Intelligent subtitle parser:
 * - Detects JSON project formats, WebVTT, and SRT.
 * - By default, automatically collapses word-by-word karaoke highlights (e.g. <font color="...">)
 *   and groups speech fragments into natural sentences.
 * - Supports rawMode: true for 1-to-1 uncollapsed preservation if explicitly desired.
 */
export function parseToSentenceCues(
  content: string,
  options?: { rawMode?: boolean }
): SentenceCue[] {
  // 1. Check if content is JSON project
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

  // 2. Parse VTT / SRT lines into raw cues
  const rawCues = parseSubtitleFile(content);

  // 3. If rawMode requested, preserve 100% of raw cues
  if (options?.rawMode) {
    return rawCues.map((c, idx) => ({
      id: idx + 1,
      startTime: Math.round(c.startTime * 1000) / 1000,
      endTime: Math.round(c.endTime * 1000) / 1000,
      text: c.text,
    }));
  }

  // 4. Default: Run intelligent karaoke collapse & sentence recognition engine
  return groupIntoSentences(rawCues);
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
