# T-045 · AI xem video từng hiệp sau trận, đưa vào báo cáo trận

| | |
| --- | --- |
| **Trạng thái** | DRAFT (29/10). Viết chi tiết sau khi thử được AI của T-038 với Gemini thật và có contract báo cáo trận của T-041 |
| **Người nhận** | Đề xuất: backend Dan (giao Codex), màn báo cáo Fon (cùng T-041) |
| **Nguồn** | [Kết quả T-039](./T-039-RESULT.md): AI xem video không kịp trong 60 s nghỉ giữa hiệp (nhanh nhất 140 s), nhưng nhận xét và lời dặn bám sát video; chủ dự án chọn hướng "phân tích sau trận" ngày 29/10. [Nhận xét 27/10](../REVIEW-27-10-FEEDBACK.md) mục 3 và 4 |
| **Phụ thuộc** | T-038 A (đã merge 29/10: bảng `bout_ai_suggestions`, `BoutAiClient`, endpoint `video-observations`); T-041 (màn báo cáo sau trận) |

## Ý tưởng

Sau trận, HLV dán link video trận (YouTube) và mốc bắt đầu, kết thúc của từng hiệp. Backend gọi Gemini cho từng hiệp, giống cấu hình L3 của T-039 (cắt đoạn bằng `video_metadata`, 5 khung/giây, độ phân giải thấp). Mỗi hiệp trả về:

- số cú đấm ước lượng của hai bên (T-039: sai số 12–15 % ở 5 khung/giây);
- tối đa 3 nhận xét về đối thủ, có mốc thời gian;
- chiến thuật đã ghi trong trận (`tacticMarks`) có thấy trong video không.

Kết quả lưu vào `bout_ai_suggestions`. Báo cáo trận (T-041) hiện kết quả này cạnh bản ghi hiệp của HLV. HLV chọn nhận xét nào thì nhận xét đó được đưa vào phân tích đối thủ cho lần gặp lại (R4b, R30).

## Việc phải làm trước

Đo lại trên **video trận đấu thật**. Các video "BoxingVI" dùng ở T-022, T-034, T-039 đều là video tập thể dục (xem đính chính trong [T-039-RESULT](./T-039-RESULT.md)), và Gemini đã bịa ra đối thủ khi xem chúng.

## Câu hỏi cần chốt trước khi viết chi tiết

1. Thêm `kind` mới (ví dụ `POST_BOUT_ROUND_VIDEO`) vào CHECK của `bout_ai_suggestions`, tức migration 032, hay dùng lại `VIDEO_OBSERVATIONS` kèm `round_no`? Phương án sau phải sửa ràng buộc `ck_bout_ai_round`, nên cũng là migration.
2. Mỗi lần gọi mất 2–9 phút. Chạy thẳng trong request (như T-038) sẽ quá hạn của trình duyệt và proxy. Có cần hàng đợi hay worker không? Phương án đơn giản: chạy nền trong tiến trình backend, màn hình hỏi lại trạng thái theo chu kỳ.
3. Gói miễn phí hết hạn mức sau khoảng 10 lần gọi video trong một ngày (T-039: 9 lần 429). Phân tích 1 trận 3 hiệp tốn 3 lần gọi, nên một ngày chỉ được khoảng 3 trận. Có dùng key trả phí không?
