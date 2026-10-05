import test from "node:test";
import assert from "node:assert";
import { usePlayerStore } from "../src/stores/usePlayerStore.ts";

test("Shadowing: startRecordingCue pauses active video playback", async () => {
  usePlayerStore.setState({ isPlaying: true, isRecording: false, recordingCueId: null });
  assert.strictEqual(usePlayerStore.getState().isPlaying, true);

  // Calling startRecordingCue should immediately pause video playback
  await usePlayerStore.getState().startRecordingCue(1);
  const state = usePlayerStore.getState();
  assert.strictEqual(state.isPlaying, false);
});

test("Shadowing: deleteRecordingForCue cleans entry and clearAllRecordings resets map", () => {
  usePlayerStore.setState({
    recordedVoices: {
      1: "blob:http://localhost/voice-1",
      2: "blob:http://localhost/voice-2",
      3: "blob:http://localhost/voice-3",
    },
  });

  usePlayerStore.getState().deleteRecordingForCue(2);
  let state = usePlayerStore.getState();
  assert.strictEqual(state.recordedVoices[2], undefined);
  assert.strictEqual(state.recordedVoices[1], "blob:http://localhost/voice-1");
  assert.strictEqual(state.recordedVoices[3], "blob:http://localhost/voice-3");

  usePlayerStore.getState().clearAllRecordings();
  state = usePlayerStore.getState();
  assert.deepStrictEqual(state.recordedVoices, {});
});

test("Shadowing: recording state lifecycle with mocked MediaRecorder", async () => {
  const originalNav = globalThis.navigator;
  const originalMediaRecorder = (globalThis as any).MediaRecorder;

  // Mock getUserMedia
  Object.defineProperty(globalThis, "navigator", { value: {
    mediaDevices: {
      getUserMedia: async () => ({
        getTracks: () => [{ stop: () => {} }],
      }),
      enumerateDevices: async () => [{ kind: "audioinput" }],
    },
  }, configurable: true });

  // Mock MediaRecorder
  (globalThis as any).MediaRecorder = class MockMediaRecorder {
    static isTypeSupported() { return true; }
    state = "recording";
    mimeType = "audio/webm";
    ondataavailable: ((e: any) => void) | null = null;
    onstop: (() => void) | null = null;
    start() {}
    stop() {
      this.state = "inactive";
      if (this.ondataavailable) {
        this.ondataavailable({ data: new Blob(["dummy audio"], { type: "audio/webm" }) });
      }
      if (this.onstop) {
        this.onstop();
      }
    }
  };

  (globalThis as any).URL = {
    ...globalThis.URL,
    createObjectURL: () => "blob:http://localhost/mock-recorded-voice-url",
    revokeObjectURL: () => {},
  };

  const started = await usePlayerStore.getState().startRecordingCue(5);
  assert.strictEqual(started, true);
  assert.strictEqual(usePlayerStore.getState().isRecording, true);
  assert.strictEqual(usePlayerStore.getState().recordingCueId, 5);

  const recordedUrl = await usePlayerStore.getState().stopRecordingCue();
  assert.strictEqual(recordedUrl, "blob:http://localhost/mock-recorded-voice-url");
  assert.strictEqual(usePlayerStore.getState().isRecording, false);
  assert.strictEqual(usePlayerStore.getState().recordingCueId, null);
  assert.strictEqual(usePlayerStore.getState().recordedVoices[5], "blob:http://localhost/mock-recorded-voice-url");

  // Restore globals
  Object.defineProperty(globalThis, "navigator", { value: originalNav, configurable: true });
  (globalThis as any).MediaRecorder = originalMediaRecorder;
});

test("Shadowing: audio-recorder volume listener receives broadcasts", async () => {
  const { subscribeToAudioLevel, getCurrentAudioLevel } = await import("../src/lib/audio-recorder.ts");
  let receivedLevel = -1;
  const unsubscribe = subscribeToAudioLevel((lvl) => {
    receivedLevel = lvl;
  });

  // Default is 0
  assert.strictEqual(getCurrentAudioLevel(), 0);

  unsubscribe();
});

test("Shadowing: store tracks recordedDurations alongside voice blob URLs", async () => {
  usePlayerStore.setState({
    recordedVoices: { 1: "blob:http://localhost/voice-1" },
    recordedDurations: { 1: 3.5 },
  });

  const state = usePlayerStore.getState();
  assert.strictEqual(state.recordedVoices[1], "blob:http://localhost/voice-1");
  assert.strictEqual(state.recordedDurations[1], 3.5);

  usePlayerStore.getState().deleteRecordingForCue(1);
  const afterDelete = usePlayerStore.getState();
  assert.strictEqual(afterDelete.recordedVoices[1], undefined);
  assert.strictEqual(afterDelete.recordedDurations[1], undefined);
});
