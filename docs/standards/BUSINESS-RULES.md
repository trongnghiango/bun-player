# BUSINESS RULES — BUN PLAYER PEDAGOGICAL MODEL

## 1. Core Target & Personas
* **Child Learner (Ages 4–10)**: Needs zero visual clutter, big touch/click targets, immediate audio-visual feedback, and structured repetition without cognitive overload.
* **Parent / Teacher Guide**: Needs full temporal control over subtitle segmentation, timing nudges, and export capability without disturbing the child's learning environment.

## 2. Pedagogical Playback Rules (Little Fox Engine)
1. **Pacing Isolation**: When `autoPause` is active, playback halts precisely at `targetStopSeconds` (cue `endTime`). The playhead freezes at the boundary and the current sentence button remains highlighted.
2. **Smart Sentence Looping (Listen & Repeat)**:
   * Target loop options: `1x` (play once and pause), `2x` (repeat once, then pause), `3x` (repeat twice, then pause), and `∞` (infinite loop).
   * Visual badge indicates current repetition iteration (e.g., `1/2`, `2/2`).
3. **Spacebar Progression**:
   * If paused at the end of sentence $K$, pressing `Space` or `Play` immediately advances to sentence $K+1$ and begins playback.
   * If paused midway through sentence $K$, pressing `Space` resumes playback to complete sentence $K$.
4. **Kid Voice Shadowing**:
   * A child can record their voice for the current sentence ($cueId$).
   * Recording stops automatically after maximum cue duration $+ 3$ seconds or upon user click.
   * Recorded audio is cached in-memory and mapped to the cue.
   * A comparison control allows alternating between original native audio and child's voice.
5. **Live Sentence Marking ("Làm dấu câu" khi nghe liên tục)**:
   * **Mục tiêu nghiệp vụ**: Phụ huynh hoặc giáo viên mở video nghe liên tục (Continuous playback) để tự phân đoạn câu nhanh bằng trực giác tai nghe mà không cần dừng video hay kéo chuột.
   * **Cơ chế 1 phím bấm duy nhất (`M`)**:
     * **Lần bấm 1 (Đầu câu)**: Đặt mốc Start Marker ($t_{start} = currentTime$). Hiển thị dải màu kéo dài trực quan theo đầu đọc video trên thanh Timeline Scrubber và thông báo nổi `📍 Bắt đầu câu lúc mm:ss`.
     * **Lần bấm 2 (Cuối câu)**: Đặt mốc End Marker ($t_{end} = currentTime$). Ngay lập tức đóng gói thành một `SentenceCue` mới, tự động chèn vào danh sách câu theo thứ tự thời gian (`startTime`) và đánh số thứ tự tuần tự (`Câu 1, Câu 2...`).
   * **Bảo vệ biên thời gian (Defensive Guardrails)**:
     * Chống bấm nhầm (Bounce rejection): Khoảng cách thời gian giữa 2 lần bấm $< 0.15$ giây sẽ bị bỏ qua để tránh double-tap vô ý.
     * Tua ngược thời gian: Nếu người dùng tua giật lùi trước mốc bắt đầu, hệ thống tự động chuẩn hóa $start = \min(t_1, t_2)$ và $end = \max(t_1, t_2)$.
     * Hủy mốc: Phím `Escape` hoặc nút `Hủy` trên thông báo nổi lập tức hủy mốc bắt đầu mà không làm gián đoạn phát video.
