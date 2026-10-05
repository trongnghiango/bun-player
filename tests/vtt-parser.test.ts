import test from "node:test";
import assert from "node:assert";
import {
  parseTimestamp,
  cleanSubtitleText,
  isPureSoundOrMusic,
  parseSubtitleFile,
  groupIntoSentences,
  parseToSentenceCues,
  autoMergeShortCues,
  autoSplitLongCues,
} from "../src/lib/vtt-parser.ts";

test("parseTimestamp parses various formats correctly", () => {
  assert.strictEqual(parseTimestamp("00:01:23.456"), 83.456);
  assert.strictEqual(parseTimestamp("01:23.456"), 83.456);
  assert.strictEqual(parseTimestamp("01:23,456"), 83.456);
  assert.strictEqual(parseTimestamp("12.5"), 12.5);
  assert.strictEqual(parseTimestamp("invalid"), 0);
});

test("cleanSubtitleText removes HTML tags and Little Fox markup", () => {
  assert.strictEqual(cleanSubtitleText("<i>Hello</i> <b>world</b>"), "Hello world");
  assert.strictEqual(cleanSubtitleText("[@Peter@] went to the [i@farm@i]."), "Peter went to the farm.");
  assert.strictEqual(cleanSubtitleText("Line 1\r\nLine 2"), "Line 1 Line 2");
});

test("isPureSoundOrMusic detects music and sound effects", () => {
  assert.strictEqual(isPureSoundOrMusic("[Music]"), true);
  assert.strictEqual(isPureSoundOrMusic("(instrumental music)"), true);
  assert.strictEqual(isPureSoundOrMusic("♪ ♪"), true);
  assert.strictEqual(isPureSoundOrMusic("Hello Peter!"), false);
  assert.strictEqual(isPureSoundOrMusic(""), true);
});

test("parseToSentenceCues preserves 1-to-1 fidelity for standard VTT", () => {
  const sampleVtt = `WEBVTT

1
00:00:01.000 --> 00:00:03.500
Once upon a time.

2
00:00:04.000 --> 00:00:06.200
There was a little rabbit.
`;

  const cues = parseToSentenceCues(sampleVtt);
  assert.strictEqual(cues.length, 2);
  assert.strictEqual(cues[0].id, 1);
  assert.strictEqual(cues[0].startTime, 1);
  assert.strictEqual(cues[0].endTime, 3.5);
  assert.strictEqual(cues[0].text, "Once upon a time.");

  assert.strictEqual(cues[1].id, 2);
  assert.strictEqual(cues[1].startTime, 4);
  assert.strictEqual(cues[1].endTime, 6.2);
  assert.strictEqual(cues[1].text, "There was a little rabbit.");
});

test("autoMergeShortCues merges sentences with fewer words than minWords", () => {
  const cues = [
    { id: 1, startTime: 0, endTime: 1, text: "Look." },
    { id: 2, startTime: 1.2, endTime: 3, text: "Here comes the train!" },
  ];

  const merged = autoMergeShortCues(cues, 3);
  assert.strictEqual(merged.length, 1);
  assert.strictEqual(merged[0].id, 1);
  assert.strictEqual(merged[0].startTime, 0);
  assert.strictEqual(merged[0].endTime, 3);
  assert.strictEqual(merged[0].text, "Look. Here comes the train!");
  assert.strictEqual(merged[0].isAdjusted, true);
});

test("autoSplitLongCues splits lengthy sentences near punctuation or conjunctions", () => {
  const cues = [
    {
      id: 1,
      startTime: 0,
      endTime: 10,
      text: "Peter Rabbit ran as fast as he could, and he finally escaped from the angry farmer.",
    },
  ];

  const split = autoSplitLongCues(cues, 10);
  assert.strictEqual(split.length, 2);
  assert.strictEqual(split[0].id, 1);
  assert.strictEqual(split[1].id, 2);
  assert.strictEqual(split[0].startTime, 0);
  assert.strictEqual(split[1].endTime, 10);
  assert.strictEqual(split[0].endTime, split[1].startTime);
  assert.strictEqual(split[0].isAdjusted, true);
  assert.strictEqual(split[1].isAdjusted, true);
});
