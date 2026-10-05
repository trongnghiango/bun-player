# TESTING STANDARD — BUN PLAYER

## 1. Testing Pyramid & Infrastructure
Bun Player adopts Node 26's native test runner (`node:test` + `node:assert`) with `--experimental-strip-types` for zero-overhead, ultra-fast test execution.

## 2. Automated Test Coverage Requirements
* **Unit Tests**:
  * `vtt-parser.ts`: Timestamp parsing, markup stripping, pure music detection, 1-to-1 preservation, auto-merge, auto-split.
  * `vtt-serializer.ts`: WebVTT timestamp formatting, cue header format.
  * `usePlayerStore.ts`: Playback state transitions, boundary auto-pause, sentence loop cycle, cue navigation, cache persistence.
  * `resource-lifecycle`: Object URL allocation and revocation verification.
* **Verification Gates**:
  1. `pnpm test`: Must pass 100% with 0 failures.
  2. `pnpm run build`: TypeScript compilation (`tsc -b`) and Vite production packaging must pass with 0 errors.
  3. `cargo check` (in `src-tauri`): Rust compilation check must pass with 0 warnings/errors.
