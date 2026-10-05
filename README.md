# Bun Player - Kid Player & Sentence Engine Desktop (Tauri v2)

Ứng dụng Desktop độc quyền chuyên dụng cho bé luyện nghe tiếng Anh ngắt câu theo phương pháp Little Fox, kết hợp khay tinh chỉnh mốc thời gian trực quan cho phụ huynh và cơ chế **Tự động lưu Cache an toàn (`~/.config/bun-player/cache.json`)**.

---

## 🌟 Tính Năng Nổi Bật

### 1. Kid Mode (Trải nghiệm học cho bé - Không sao nhãng)
- **Hình ảnh & Video trung tâm:** Tỉ lệ vàng 16:9 sắc nét, nền tối bảo vệ mắt.
- **Ẩn chữ mặc định:** Giúp bé tập trung vào âm thanh ngữ điệu và hành động của nhân vật, không bị ỷ lại vào việc đọc chữ (có thể bấm bật chữ bất cứ lúc nào qua phím tắt `S`).
- **Phân trang số câu phong cách Little Fox:** Các nút tròn `[1] [2] [3]...` to rõ. Câu đang nói sẽ sáng đèn rực rỡ.
- **Tự động ngắt cuối câu (Auto-pause):** Phát xong 1 câu sẽ tự dừng để bé nhại lại (Shadowing).
- **Nút Replay to rõ:** Bấm phím tắt `R` hoặc click nút tròn để nghe lại câu bao nhiêu lần tùy thích.

### 2. Tự Động Lưu Cache & Bảo Vệ Dữ Liệu (`~/.config/bun-player/cache.json`)
- **Realtime Auto-Save:** Mọi thao tác chỉnh mốc, sửa chữ, tách, gộp câu đều được **tự động lưu ngay lập tức vào `~/.config/bun-player/cache.json`** (kèm bản sao dự phòng trong `localStorage`).
- **Khôi phục phiên làm việc:** Khi mở lại app, toàn bộ 20+ câu và video đang học sẽ tự động được phục hồi nguyên vẹn 100%, không lo mất dữ liệu khi vô tình tắt app hoặc làm mới trang.
- **Bảo toàn 100% số câu:** Bộ giải mã mới bảo toàn chính xác 1-to-1 từng câu trong file phụ đề, tuyệt đối không tự ý gộp hay làm mất câu của bạn.

### 3. Parent Editor Drawer (Khay tinh chỉnh bí mật cho phụ huynh)
- **Bật tắt tức thì:** Nhấn phím `E` để trượt khay biên tập từ bên phải màn hình.
- **Nối câu liên tục theo câu trước (Snap to Previous):** Nút **"Nối"** (icon nam châm 🧲) giúp câu hiện tại tự động hít sát vào điểm kết thúc của câu trước, dịch chuyển cả câu để giữ nguyên độ dài câu. Cực kỳ tiện lợi khi vừa kéo dài câu trước mà không phải tự căn lại câu sau.
- **Bỏ gán câu (Loại bỏ đoạn nhạc/khoảng trống trôi nổi):** Nút **Thùng rác** trên từng câu để hủy gán đoạn đó thành câu học. Video vẫn phát bình thường qua đoạn nhạc/intro/outro nhưng **không bị ngắt dừng vô lý** và **không chiếm số câu của bé**.
- **Thêm câu tự do:** Nút **"+ Thêm câu tại vị trí nghe"** để đánh dấu một mốc câu học mới tại bất kỳ vị trí nào phụ huynh muốn.
- **Tách câu linh hoạt (Split Sentence):** Nút **"Tách"** (icon kéo) trên từng câu để bẻ đôi câu quá dài thành 2 câu tự nhiên (chia theo vị trí video đang nghe hoặc chia đều).
- **Gộp câu thủ công (Manual Merge):** Nút **"Gộp"** trên từng câu để gộp câu bị ngắt ngắn với câu kế tiếp.
- **Công cụ tự động hàng loạt:**
  - **Tự lọc nhạc/hiệu ứng:** Tự động phát hiện và bỏ qua các mốc âm thanh như `[Music]`, `[Theme Song]`, `♫`, `(applause)`,... khi import phụ đề.
  - **"Gộp câu ngắn":** Tự động rà soát và gộp các câu thoại dưới 3 từ bị cắt vụn.
  - **"Tách câu dài":** Tự động phát hiện các câu trên 14 từ và tách tại dấu phẩy `,` hoặc liên từ (`and`, `but`, `because`,...).
- **Chỉnh sửa trực tiếp chữ:** Nhấp trực tiếp vào câu chữ để sửa lại chính tả hoặc điều chỉnh từ ngữ sau khi tách/gộp.
- **Thanh trượt Slider & Nudge `[-0.1s]` `[+0.1s]`:** Dễ dàng căn chỉnh thời điểm bắt đầu và kết thúc của từng câu.
- **Nghe thử câu (Play snippet):** Kiểm tra độ chuẩn xác của câu trước khi lưu.
- **Lưu file trực tiếp & Lưu thành... (Save As):** Xuất lại file `.vtt` chuẩn chỉ bằng 1 click hoặc tự chọn thư mục lưu.
- **Xuất Video tích hợp Phụ đề (1 file MP4 duy nhất):** Nút **"🎬 Xuất MP4 kèm Sub"** trong khay biên tập đóng gói cả video và toàn bộ câu thoại đã chỉnh sửa vào **đúng 1 file MP4 duy nhất** (chuẩn `mov_text`), mang sang iPad/TV/điện thoại nào mở cũng có sẵn phụ đề và bật/tắt được.
- **Tự động nhận diện Phụ đề nhúng:** Khi mở một video đã có sẵn phụ đề nhúng bên trong, Bun Player sẽ **tự động bóc tách ra danh sách câu để học ngay lập tức** mà không cần phải mở file phụ đề riêng lẻ.

### 4. Phím Tắt Tiện Dụng
- `Space`: Phát / Tạm dừng
- `R`: Nghe lại câu hiện tại
- `Mũi tên Phải` / `Trái`: Chuyển sang câu tiếp theo / Lùi lại câu trước
- `S`: Bật / Tắt chữ phụ đề
- `E`: Bật / Tắt khay biên tập phụ huynh
- `Esc`: Đóng khay biên tập

---

## 🚀 Hướng Dẫn Chạy Ứng Dụng

### A. Chạy chế độ Web Browser (Nhanh nhất để test ngay)
```bash
cd bun-player
pnpm run dev
```
Mở trình duyệt tại: `http://localhost:1420`

### B. Chạy chế độ Native Desktop App (Tauri v2)
```bash
cd bun-player
pnpm tauri dev
```

### C. Đóng gói file cài đặt (.deb, AppImage, .exe, .dmg)
```bash
cd bun-player
pnpm tauri build
```
File cài đặt sẽ được sinh ra trong thư mục `src-tauri/target/release/bundle/`.
