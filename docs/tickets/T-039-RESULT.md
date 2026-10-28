# T-039 Kết quả đo: AI xem video hiệp đấu trong lúc nghỉ giữa hiệp

- Ngày đo: 28/10/2026, Claude chạy `python-worker/scripts/eval/live_round_feasibility.mjs` (`37b59b4`) bằng key Gemini gói miễn phí, model `gemini-3.8-flash`.
- Dữ liệu thô: `D:/test/ai-worktrees/logs/T-039-run-1/summary.json`, log `T-039-run-1.log` (không nằm trong repo).
- **Kết luận đề xuất (Dan duyệt): không làm được trong 2 tuần.** Không cấu hình nào đạt tiêu chí 40 s. Lần nhanh nhất trả kết quả sau **140 s**, trong khi ngân sách là 40 s.

## Bảng tổng hợp

| Cấu hình | Lần gọi | Thành công | Lỗi | p50 tổng (s) | p90 tổng (s) | Sai số số cú (trung vị) |
| --- | --- | --- | --- | --- | --- | --- |
| L1: YouTube, 30 s, 1 khung/giây | 6 | 0 | 6 | — | — | — |
| L2: YouTube, đoạn 63 s, 1 khung/giây | 6 | 3 | 3 | 275 | 485 | 34 % |
| L3: YouTube, đoạn 63 s, 5 khung/giây | 6 | 2 | 4 | 157 | 171 | 13 % |
| L4: tải file lên Files API | 6 | — | — | — | — | — |

L4 bị bỏ qua (`SKIPPED_NO_LOCAL_FILE`): máy không còn file mp4 của BoxingVI, và không có `ffmpeg` hay `yt-dlp` để tạo lại.

## Từng lần gọi thành công (đều là V6, 85 nhãn trong đoạn)

| Cấu hình | Lần | Tổng (s) | Thử lại | Dự đoán / nhãn | Token vào / ra |
| --- | --- | --- | --- | --- | --- |
| L2 | 1 | 537 | 1 | 65 / 85 | 5 877 / 205 |
| L2 | 2 | 142 | 0 | 52 / 85 | 5 877 / 158 |
| L2 | 3 | 275 | 1 | 56 / 85 | 5 877 / 206 |
| L3 | 1 | 174 | 1 | 72 / 85 | 22 377 / 222 |
| L3 | 3 | 140 | 0 | 75 / 85 | 22 377 / 209 |

Lỗi: 2 lần 503 "high demand", 2 lần 503 rồi mất kết nối, 9 lần 429 hết hạn mức. Toàn bộ V10 gặp 429, nên **V10 chưa đo được**.

## Đối chiếu tiêu chí (ticket mục 4)

1. **p90 ≤ 40 s: không đạt ở mọi cấu hình.** Ngay cả hai lần chạy không phải thử lại (142 s và 140 s) cũng gấp 3,5 lần ngân sách. Kết luận này không phụ thuộc vào việc model đang quá tải: thời gian chính là lúc model xử lý video, không phải thời gian chờ thử lại.
2. **Lỗi ≤ 1/6: không đạt.** 13 trên 18 lần gọi lỗi (503 khi quá tải, 429 khi hết hạn mức gói miễn phí).
3. **Sai số số cú ≤ 30 %:** đạt ở L3 (13 %), không đạt ở L2 (34 %). Đọc nhiều khung hơn thì đếm sát hơn nhưng tốn gấp 3,8 lần token đầu vào.

Chỉ cần một tiêu chí không đạt là cấu hình đó không đạt. Ở đây cả L2 và L3 đều trượt tiêu chí 1 và 2.

## Lời dặn AI viết (để Dan chấm tay)

Ví dụ ở L3, lần 3:

1. "Khai thác sơ hở khi đối thủ đánh uppercut bằng các cú móc ngang chính xác vào cằm."
2. "Giữ cự ly tầm trung ngoài tầm với và liên tục di chuyển cắt góc."
3. "Chủ động tung combo 1-2 thẳng mặt để chặn đứng nhịp tấn công của đối thủ."

Ba lời dặn đều là một hành động cụ thể và bám vào thứ thấy trong video (đối thủ hay đánh uppercut, hay dồn đòn). Lời dặn của các lần khác có cùng chủ đề. Nội dung có vẻ dùng được, nhưng đến **sau 2–9 phút**, tức là không kịp cho hiệp kế tiếp.

## Đề xuất cho nhóm

- Báo thầy: AI xem video trực tiếp giữa hiệp chưa làm được với Gemini gói miễn phí. Lý do là đo được 140–537 s mỗi hiệp, trong khi chỉ có 60 s nghỉ, và 13/18 lần gọi lỗi. Kèm bảng trên.
- Giữ cách đang làm: lời dặn giữa hiệp dựa trên dữ liệu HLV chạm ghi (T-037), cộng AI viết lời dặn từ chính dữ liệu đó (T-038, chỉ gửi chữ, hạn 12 s).
- AI xem video vẫn dùng được **sau trận**, vì chất lượng nhận xét khá và không bị giới hạn 60 s: phân tích lại từng hiệp cho báo cáo trận (T-041) hoặc cho phân tích đối thủ lần sau. Nếu nhóm muốn, đó nên là một ticket riêng.
- Việc còn mở, chỉ làm nếu Dan muốn số liệu đầy đủ hơn: đo lại V10 vào ngày khác khi hạn mức đã hồi. Kết luận chính không đổi, vì lần nhanh nhất đã gấp 3,5 lần ngân sách.
