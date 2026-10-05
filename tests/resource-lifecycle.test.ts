import test from "node:test";
import assert from "node:assert";
import { usePlayerStore } from "../src/stores/usePlayerStore.ts";
import { revokeAudioUrlSafely } from "../src/lib/audio-recorder.ts";

test("revokeAudioUrlSafely calls URL.revokeObjectURL when blob URL is passed", () => {
  let revokedUrl: string | null = null;
  // Mock URL.revokeObjectURL
  const originalRevoke = typeof URL !== "undefined" ? URL.revokeObjectURL : undefined;
  (globalThis as any).URL = {
    ...globalThis.URL,
    revokeObjectURL: (url: string) => {
      revokedUrl = url;
    },
  };

  revokeAudioUrlSafely("blob:http://localhost:1420/test-uuid");
  assert.strictEqual(revokedUrl, "blob:http://localhost:1420/test-uuid");

  // Non-blob URL should NOT trigger revoke
  revokedUrl = null;
  revokeAudioUrlSafely("http://localhost:1420/media-stream?path=test");
  assert.strictEqual(revokedUrl, null);

  if (originalRevoke) {
    (globalThis as any).URL.revokeObjectURL = originalRevoke;
  }
});

test("setMedia revokes previous blob URL when new media is loaded", () => {
  const revokedUrls: string[] = [];
  (globalThis as any).URL = {
    ...globalThis.URL,
    revokeObjectURL: (url: string) => {
      revokedUrls.push(url);
    },
  };

  const store = usePlayerStore.getState();
  store.setMedia("blob:http://localhost/first-video", "first.mp4");
  assert.strictEqual(usePlayerStore.getState().videoSrc, "blob:http://localhost/first-video");

  // Load second video
  store.setMedia("blob:http://localhost/second-video", "second.mp4");
  assert.strictEqual(usePlayerStore.getState().videoSrc, "blob:http://localhost/second-video");
  assert.strictEqual(revokedUrls.includes("blob:http://localhost/first-video"), true);
});

test("clearProject revokes videoSrc and all voice recordings", async () => {
  const revokedUrls: string[] = [];
  (globalThis as any).URL = {
    ...globalThis.URL,
    revokeObjectURL: (url: string) => {
      revokedUrls.push(url);
    },
  };

  usePlayerStore.setState({
    videoSrc: "blob:http://localhost/video-to-clear",
    recordedVoices: {
      1: "blob:http://localhost/kid-voice-1",
      2: "blob:http://localhost/kid-voice-2",
    },
  });

  await usePlayerStore.getState().clearProject();

  const state = usePlayerStore.getState();
  assert.strictEqual(state.videoSrc, null);
  assert.deepStrictEqual(state.recordedVoices, {});
  assert.strictEqual(revokedUrls.includes("blob:http://localhost/video-to-clear"), true);
  assert.strictEqual(revokedUrls.includes("blob:http://localhost/kid-voice-1"), true);
  assert.strictEqual(revokedUrls.includes("blob:http://localhost/kid-voice-2"), true);
});
