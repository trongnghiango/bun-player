import test from "node:test";
import assert from "node:assert";
import { usePlayerStore } from "../src/stores/usePlayerStore.ts";

test("usePlayerStore initializes with default state", () => {
  const state = usePlayerStore.getState();
  assert.strictEqual(state.isPlaying, false);
  assert.strictEqual(state.currentTime, 0);
  assert.strictEqual(state.autoPause, true);
  assert.strictEqual(state.sentenceLoopTarget, 1);
  assert.strictEqual(state.currentSentenceLoopCount, 0);
  assert.deepStrictEqual(state.cues, []);
  assert.deepStrictEqual(state.recordedVoices, {});
});

test("setCues loads cues and points activeCueIndex to 0", () => {
  const sampleCues = [
    { id: 1, startTime: 1.0, endTime: 3.0, text: "First sentence." },
    { id: 2, startTime: 3.5, endTime: 6.0, text: "Second sentence." },
  ];

  usePlayerStore.getState().setCues(sampleCues, "sample.vtt");
  const state = usePlayerStore.getState();
  assert.strictEqual(state.cues.length, 2);
  assert.strictEqual(state.activeCueIndex, 0);
  assert.strictEqual(state.subtitlePath, "sample.vtt");
});

test("jumpToCue moves currentTime and resets loop count", () => {
  usePlayerStore.getState().jumpToCue(1);
  const state = usePlayerStore.getState();
  assert.strictEqual(state.activeCueIndex, 1);
  assert.strictEqual(state.currentTime, 3.5);
  assert.strictEqual(state.isPlaying, true);
  assert.strictEqual(state.targetStopSeconds, 6.0);
  assert.strictEqual(state.currentSentenceLoopCount, 0);
});

test("cycleSentenceLoopTarget cycles through 1 -> 2 -> 3 -> Infinity -> 1", () => {
  const store = usePlayerStore.getState();
  store.setSentenceLoopTarget(1);
  assert.strictEqual(usePlayerStore.getState().sentenceLoopTarget, 1);

  store.cycleSentenceLoopTarget();
  assert.strictEqual(usePlayerStore.getState().sentenceLoopTarget, 2);

  store.cycleSentenceLoopTarget();
  assert.strictEqual(usePlayerStore.getState().sentenceLoopTarget, 3);

  store.cycleSentenceLoopTarget();
  assert.strictEqual(usePlayerStore.getState().sentenceLoopTarget, Infinity);

  store.cycleSentenceLoopTarget();
  assert.strictEqual(usePlayerStore.getState().sentenceLoopTarget, 1);
});

test("setCurrentTime respects auto-pause and sentence loop counting", () => {
  const sampleCues = [
    { id: 1, startTime: 1.0, endTime: 3.0, text: "First sentence." },
  ];
  usePlayerStore.getState().setCues(sampleCues);
  usePlayerStore.getState().setSentenceLoopTarget(2); // Loop 2x
  usePlayerStore.getState().jumpToCue(0); // Cue 1, loopCount 0

  // Simulate video playing to 3.0 (end of cue)
  usePlayerStore.getState().setCurrentTime(3.0);

  // Since loopTarget = 2 and current count was 0, it should repeat and loopCount becomes 1!
  let state = usePlayerStore.getState();
  assert.strictEqual(state.currentSentenceLoopCount, 1);
  assert.strictEqual(state.currentTime, 1.0); // Rewound to cue start
  assert.strictEqual(state.isPlaying, true);

  // Play to 3.0 again (2nd time)
  usePlayerStore.getState().setCurrentTime(3.0);

  // Now loopTarget (2) is satisfied: it should pause at sentence end!
  state = usePlayerStore.getState();
  assert.strictEqual(state.isPlaying, false);
  assert.strictEqual(state.currentSentenceLoopCount, 0);
  assert.strictEqual(state.currentTime, 3.0);
  assert.strictEqual(state.activeCueIndex, 0); // Still active on sentence 1
});

test("updateCueTiming validates and clamps bounds safely", () => {
  usePlayerStore.getState().updateCueTiming(1, 0.5, 4.0);
  const state = usePlayerStore.getState();
  assert.strictEqual(state.cues[0].startTime, 0.5);
  assert.strictEqual(state.cues[0].endTime, 4.0);
  assert.strictEqual(state.cues[0].isAdjusted, true);
});

test("deleteRecordingForCue removes recording from registry", () => {
  usePlayerStore.setState({
    recordedVoices: {
      1: "blob:http://localhost/fake-audio-1",
      2: "blob:http://localhost/fake-audio-2",
    },
  });

  usePlayerStore.getState().deleteRecordingForCue(1);
  const state = usePlayerStore.getState();
  assert.strictEqual(state.recordedVoices[1], undefined);
  assert.strictEqual(state.recordedVoices[2], "blob:http://localhost/fake-audio-2");
});
test("autoGroupSentences collapses fragmented or repeating karaoke cues in store", () => {
  usePlayerStore.setState({
    cues: [
      { id: 1, startTime: 10.0, endTime: 11.5, text: "Mrs. Rabbit had four little bunnies." },
      { id: 2, startTime: 11.5, endTime: 12.5, text: "Mrs. Rabbit had four little bunnies." },
      { id: 3, startTime: 12.5, endTime: 14.5, text: "Mrs. Rabbit had four little bunnies." },
      { id: 4, startTime: 15.0, endTime: 18.0, text: "They lived in a hole." },
    ],
  });

  usePlayerStore.getState().autoGroupSentences();
  const state = usePlayerStore.getState();

  assert.strictEqual(state.cues.length, 2);
  assert.strictEqual(state.cues[0].id, 1);
  assert.strictEqual(state.cues[0].startTime, 10.0);
  assert.strictEqual(state.cues[0].endTime, 14.5);
  assert.strictEqual(state.cues[0].text, "Mrs. Rabbit had four little bunnies.");

  assert.strictEqual(state.cues[1].id, 2);
  assert.strictEqual(state.cues[1].startTime, 15.0);
  assert.strictEqual(state.cues[1].endTime, 18.0);
  assert.strictEqual(state.cues[1].text, "They lived in a hole.");
});
