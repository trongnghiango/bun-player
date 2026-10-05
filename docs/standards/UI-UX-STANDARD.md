# UI/UX STANDARD — BUN PLAYER

## 1. Visual Hierarchy & Kid-First Principles
* **Distraction-Free Video Stage**: No intrusive subtitles by default (`showSubtitle: false`) to foster visual immersion and auditory decoding.
* **Numbered Circle Buttons**: Large, high-contrast circular buttons with bold typography and active glow states for easy navigation.
* **Non-blocking Parent Drawer**: Slides out from the right on `E` or button click, preserving video visibility for live timing adjustments.

## 2. State & Feedback Signals
* **Active Sentence Glow**: Vibrant amber gradient (`from-amber-500 to-amber-300`) with ring highlight.
* **Repeat Loop Badge**: Clear numeric indicator on loop toggle (`1x`, `2x`, `3x`, `🔁`).
* **Microphone State**:
  * Idle: Slate button with clean mic icon.
  * Recording: Pulsing red ring with live recording indicator.
  * Recorded: Green star / audio wave badge allowing instant one-click playback of child's voice.
* **Error Recovery**: Actionable reconnect banners for disconnected local media with direct file dialog trigger.
* **Live Marking & Timeline Feedback**:
  * **Interactive Scrubber**: Hiển thị toàn bộ các đoạn câu hiện hữu bằng khối màu ngọc bích / hổ phách (`emerald / amber`), cho phép click/kéo tua tức thì.
  * **In-Flight Marking Strip**: Khi bắt đầu làm dấu câu, dải màu gradient (`emerald -> amber -> rose`) nhấp nháy kéo dài theo đầu đọc video thời gian thực.
  * **Floating Marking Banner**: Thông báo nổi phía trên video hiển thị rõ ràng hướng dẫn bấm phím `M` để chốt câu hoặc `Esc` để hủy.
