import test from "node:test";
import assert from "node:assert";
import { usePlayerStore } from "../src/stores/usePlayerStore.ts";

test("Smart Looping: target 3x repeats exactly 3 times before pausing", () => {
  const cues = [
    { id: 1, startTime: 0.0, endTime: 2.5, text: "Sentence 1" },
    { id: 2, startTime: 3.0, endTime: 5.5, text: "Sentence 2" },
  ];

  usePlayerStore.getState().setCues(cues);
  usePlayerStore.getState().setSentenceLoopTarget(3);
  usePlayerStore.getState().jumpToCue(0);

  let state = usePlayerStore.getState();
  assert.strictEqual(state.currentSentenceLoopCount, 0);
  assert.strictEqual(state.isPlaying, true);

  // 1st iteration finishes at 2.5s
  usePlayerStore.getState().setCurrentTime(2.5);
  state = usePlayerStore.getState();
  assert.strictEqual(state.currentSentenceLoopCount, 1);
  assert.strictEqual(state.currentTime, 0.0);
  assert.strictEqual(state.isPlaying, true);

  // 2nd iteration finishes at 2.5s
  usePlayerStore.getState().setCurrentTime(2.5);
  state = usePlayerStore.getState();
  assert.strictEqual(state.currentSentenceLoopCount, 2);
  assert.strictEqual(state.currentTime, 0.0);
  assert.strictEqual(state.isPlaying, true);

  // 3rd iteration finishes at 2.5s -> Should now pause at sentence boundary!
  usePlayerStore.getState().setCurrentTime(2.5);
  state = usePlayerStore.getState();
  assert.strictEqual(state.currentSentenceLoopCount, 0);
  assert.strictEqual(state.isPlaying, false);
  assert.strictEqual(state.currentTime, 2.5);
  assert.strictEqual(state.activeCueIndex, 0);
});

test("Smart Looping: target Infinity loops continuously without boundary pause", () => {
  const cues = [
    { id: 1, startTime: 0.0, endTime: 2.0, text: "Infinite loop test" },
  ];

  usePlayerStore.getState().setCues(cues);
  usePlayerStore.getState().setSentenceLoopTarget(Infinity);
  usePlayerStore.getState().jumpToCue(0);

  // Run through 10 iterations
  for (let i = 0; i < 10; i++) {
    usePlayerStore.getState().setCurrentTime(2.0);
    const state = usePlayerStore.getState();
    assert.strictEqual(state.isPlaying, true);
    assert.strictEqual(state.currentTime, 0.0);
    assert.strictEqual(state.currentSentenceLoopCount, i + 1);
  }
});
