import test from "node:test";
import assert from "node:assert";
import { usePlayerStore } from "../src/stores/usePlayerStore.ts";

test("Bug Reproduction: hitting play at the end of the last cue causes instant re-pause deadlock", () => {
  const cues = [
    { id: 1, startTime: 0.0, endTime: 3.0, text: "Sentence 1" },
    { id: 2, startTime: 5.0, endTime: 8.0, text: "Sentence 2 (Last cue)" },
  ];

  usePlayerStore.getState().setCues(cues);
  usePlayerStore.getState().jumpToCue(1); // Jump to Cue 2

  // Simulate Cue 2 finishing at 8.0s
  usePlayerStore.getState().setCurrentTime(8.0);
  assert.strictEqual(usePlayerStore.getState().isPlaying, false);
  assert.strictEqual(usePlayerStore.getState().currentTime, 8.0);
  assert.strictEqual(usePlayerStore.getState().targetStopSeconds, null);

  // Now user presses Space (setIsPlaying(true))
  usePlayerStore.getState().setIsPlaying(true);

  const state = usePlayerStore.getState();
  // If targetStopSeconds is set to 8.0 while currentTime is 8.0, it will immediately pause on next tick!
  // In a healthy system, targetStopSeconds must NOT be <= currentTime when starting playback!
  if (state.targetStopSeconds !== null) {
    assert.strictEqual(
      state.targetStopSeconds > state.currentTime,
      true,
      `DEADLOCK DETECTED: targetStopSeconds (${state.targetStopSeconds}) <= currentTime (${state.currentTime})`
    );
  }
});

test("Bug Reproduction: seeking while paused desynchronizes activeCueIndex and leaves obsolete targetStopSeconds", () => {
  const cues = [
    { id: 1, startTime: 0.0, endTime: 3.0, text: "Sentence 1" },
    { id: 2, startTime: 10.0, endTime: 15.0, text: "Sentence 2" },
  ];

  usePlayerStore.getState().setCues(cues);
  usePlayerStore.getState().jumpToCue(0); // Cue 1
  usePlayerStore.getState().pauseAtSentenceEnd(3.0); // Paused at 3.0s

  assert.strictEqual(usePlayerStore.getState().isPlaying, false);
  assert.strictEqual(usePlayerStore.getState().activeCueIndex, 0);

  // User seeks to 12.0s (inside Cue 2) while paused!
  usePlayerStore.getState().setCurrentTime(12.0);

  const state = usePlayerStore.getState();
  // BUG: activeCueIndex remained 0 instead of 1!
  assert.strictEqual(
    state.activeCueIndex,
    1,
    `DESYNC DETECTED: activeCueIndex is ${state.activeCueIndex}, expected 1 for time 12.0s`
  );
});
