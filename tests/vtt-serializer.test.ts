import test from "node:test";
import assert from "node:assert";
import { formatVttTimestamp, serializeToVtt } from "../src/lib/vtt-serializer.ts";

test("formatVttTimestamp formats seconds into HH:MM:SS.mmm", () => {
  assert.strictEqual(formatVttTimestamp(0), "00:00:00.000");
  assert.strictEqual(formatVttTimestamp(1.5), "00:00:01.500");
  assert.strictEqual(formatVttTimestamp(65.123), "00:01:05.123");
  assert.strictEqual(formatVttTimestamp(3665.045), "01:01:05.045");
});

test("serializeToVtt generates valid WebVTT string from cues", () => {
  const cues = [
    { id: 1, startTime: 1.0, endTime: 3.5, text: "Sentence one." },
    { id: 2, startTime: 4.2, endTime: 6.8, text: "Sentence two." },
  ];

  const vtt = serializeToVtt(cues);
  assert.match(vtt, /^WEBVTT/);
  assert.match(vtt, /00:00:01.000 --> 00:00:03.500/);
  assert.match(vtt, /Sentence one./);
  assert.match(vtt, /00:00:04.200 --> 00:00:06.800/);
  assert.match(vtt, /Sentence two./);
});
