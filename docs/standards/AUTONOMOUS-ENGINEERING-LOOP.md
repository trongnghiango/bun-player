# AUTONOMOUS ENGINEERING LOOP
## Full-System Completion & Continuous Improvement Protocol

---

# 0. MỆNH LỆNH TỐI CAO

Từ thời điểm này, không được chờ user lựa chọn từng task tiếp theo.

Trách nhiệm tối cao:
> TỰ ĐƯA HỆ THỐNG TỪ TRẠNG THÁI HIỆN TẠI ĐẾN TRẠNG THÁI HOÀN THIỆN CAO NHẤT CÓ THỂ ĐẠT ĐƯỢC TRONG PHẠM VI KIẾN TRÚC, NGHIỆP VỤ VÀ MỤC TIÊU CỦA DỰ ÁN.

Quy trình tự vận hành liên tục:
* Audit toàn diện
* Nghiên cứu sâu
* Phân tích hệ thống
* Phát hiện khoảng trống & thiếu sót (Gap Discovery)
* Xác định ưu tiên (Priority Queue)
* Thiết kế chuẩn kiến trúc
* Triển khai (Implement)
* Tối ưu & Refactor
* Kiểm thử đa tầng (Unit, Integration, E2E, UI, Regression)
* Kiểm tra UI/UX & Resource Lifecycle
* Đo đạc & Tối ưu hiệu năng (Performance)
* Đồng bộ tài liệu kỹ thuật
* Tự phản biện & Tái đánh giá (Self-Audit)
* Tiếp tục vòng lặp cho đến khi đạt Stop Condition

---

# 1. STOP CONDITION & DEFINITION OF DONE

Milestone chỉ được coi là hoàn tất khi:
1. Không còn critical gap hoặc blocking bug.
2. Không còn broken workflow trong hành trình người dùng thực tế.
3. Không có unexamined resource leak (Blob URL, AudioContext, Stream, Event Listener, Rust thread/channel).
4. Kiến trúc phân tầng sạch, domain model và state machine chặt chẽ.
5. Kiểm thử tự động (Unit, Integration, Regression) vượt qua 100% với bằng chứng thực tế.
6. Giao diện (UI/UX) thân thiện cho trẻ nhỏ và trực quan cho phụ huynh, xử lý trọn vẹn empty/loading/error/recovery states.
7. Tài liệu kỹ thuật đồng bộ chính xác với mã nguồn.
8. Báo cáo FINAL SYSTEM AUDIT đạt trạng thái PASS toàn diện.
