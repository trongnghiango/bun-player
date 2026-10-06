import test from "node:test";
import assert from "node:assert";
import { usePlayerStore } from "../src/stores/usePlayerStore.ts";

test("Live Marker: first tap drops start marker at current time", () => {
  usePlayerStore.setState({
    currentTime: 4.25,
    pendingMarkerStart: null,
    cues: [],
    duration: 60,
  });

  const res = usePlayerStore.getState().toggleMarkerAtCurrentTime();
  assert.strictEqual(res.type, "start");
  assert.strictEqual(res.time, 4.25);
  assert.strictEqual(usePlayerStore.getState().pendingMarkerStart, 4.25);
  assert.notStrictEqual(usePlayerStore.getState().lastMarkerNotification, null);
});

test("Live Marker: second tap creates a new SentenceCue and resets pending marker", () => {
  usePlayerStore.setState({
    currentTime: 7.8,
    pendingMarkerStart: 4.25,
    cues: [],
    duration: 60,
  });

  const res = usePlayerStore.getState().toggleMarkerAtCurrentTime();
  assert.strictEqual(res.type, "end");
  assert.strictEqual(usePlayerStore.getState().pendingMarkerStart, null);

  const state = usePlayerStore.getState();
  assert.strictEqual(state.cues.length, 1);
  assert.strictEqual(state.cues[0].id, 1);
  assert.strictEqual(state.cues[0].startTime, 4.25);
  assert.strictEqual(state.cues[0].endTime, 7.8);
  assert.strictEqual(state.cues[0].text, "Câu 1");
  assert.strictEqual(state.cues[0].isAdjusted, true);
});

test("Live Marker: handles backwards scrub gracefully by swapping start and end", () => {
  usePlayerStore.setState({
    currentTime: 2.0,
    pendingMarkerStart: 5.0, // Start was at 5.0, user scrubbed back to 2.0
    cues: [],
    duration: 60,
  });

  const res = usePlayerStore.getState().toggleMarkerAtCurrentTime();
  assert.strictEqual(res.type, "end");

  const cues = usePlayerStore.getState().cues;
  assert.strictEqual(cues.length, 1);
  assert.strictEqual(cues[0].startTime, 2.0);
  assert.strictEqual(cues[0].endTime, 5.0);
});

test("Live Marker: ignores accidental double-tap under 0.15s", () => {
  usePlayerStore.setState({
    currentTime: 5.05,
    pendingMarkerStart: 5.0, // Difference only 0.05s
    cues: [],
  });

  const res = usePlayerStore.getState().toggleMarkerAtCurrentTime();
  assert.strictEqual(res.type, "ignored");
  assert.strictEqual(usePlayerStore.getState().pendingMarkerStart, 5.0); // Kept intact
});

test("Live Marker: inserts and re-indexes sequentially when marking between existing cues", () => {
  usePlayerStore.setState({
    cues: [
      { id: 1, startTime: 1.0, endTime: 3.0, text: "Sentence 1" },
      { id: 2, startTime: 10.0, endTime: 12.0, text: "Sentence 3" },
    ],
    pendingMarkerStart: 5.0,
    currentTime: 7.5,
    duration: 60,
  });

  const res = usePlayerStore.getState().toggleMarkerAtCurrentTime();
  assert.strictEqual(res.type, "end");

  const cues = usePlayerStore.getState().cues;
  assert.strictEqual(cues.length, 3);
  assert.strictEqual(cues[0].id, 1);
  assert.strictEqual(cues[0].startTime, 1.0);
  assert.strictEqual(cues[1].id, 2);
  assert.strictEqual(cues[1].startTime, 5.0);
  assert.strictEqual(cues[1].endTime, 7.5);
  assert.strictEqual(cues[2].id, 3);
  assert.strictEqual(cues[2].startTime, 10.0);
});

test("Live Marker: cancelPendingMarker clears start marker", () => {
  usePlayerStore.setState({ pendingMarkerStart: 8.5 });
  usePlayerStore.getState().cancelPendingMarker();
  assert.strictEqual(usePlayerStore.getState().pendingMarkerStart, null);
});

test("Live Marker: marking cues while playing leaves targetStopSeconds null so playback never freezes", () => {
  usePlayerStore.setState({
    isPlaying: true,
    autoPause: true,
    targetStopSeconds: null,
    pendingMarkerStart: 10.0,
    currentTime: 15.0,
    cues: [],
    duration: 100,
  });

  // Finish marking cue [10 -> 15]
  usePlayerStore.getState().toggleMarkerAtCurrentTime();
  const state = usePlayerStore.getState();

  assert.strictEqual(state.cues.length, 1);
  assert.strictEqual(state.targetStopSeconds, null, "targetStopSeconds must be null to allow continuous streaming!");

  // Video advances to 15.01s (just past newly created cue end): it must NOT pause!
  usePlayerStore.getState().setCurrentTime(15.01);
  assert.strictEqual(usePlayerStore.getState().isPlaying, true, "Video must continue playing smoothly across newly created cue boundary!");
});
