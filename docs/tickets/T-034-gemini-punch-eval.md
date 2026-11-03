# T-034 · Đo Gemini nhận diện cú đấm trên video của hệ thống (để sau)

| | |
| --- | --- |
| **Trạng thái** | BACKLOG (27/10). Chủ dự án: "tạm thời ghi nhận để làm sau" |
| **Người nhận** | Chưa giao |
| **Phụ thuộc** | Ngoại lệ phạm vi cho [quyết định 16 và 20](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi) (đóng băng phát triển AI); key Gemini trong `python-worker/.env` |
| **Nguồn** | [T-012](./T-012-ai-demo.md), [review T-022](./T-022-REVIEW.md), [T-033](./T-033-opponent-analysis-ui.md) (gợi ý quan sát từ video bằng Gemini) |

## Bối cảnh

Ở T-033, Gemini đọc video YouTube đối thủ và đề xuất quan sát có mốc thời gian khá đúng. Chủ dự án hỏi có nên dùng Gemini cho phân tích video của hệ thống (đếm cú đấm, thay hoặc bổ sung detector `legacy_fsm_v1` trong `python-worker`) không. Ngày 27/10, Claude chạy thử trên đúng các video đã chấm detector hiện tại, rồi dừng theo yêu cầu của chủ dự án.

## Kết quả đo thử 27/10 (một lượt, chưa lặp lại)

Model `gemini-3.8-flash`, 10 khung/giây, `MEDIA_RESOLUTION_LOW`, structured output (mỗi cú: thời điểm, tay, loại đòn). Ghép một-một với nhãn tay: dự đoán khớp nếu rơi trong khoảng nhãn ± 3 khung (24 fps); kết quả với ± 0,5 giây giống hệt.

| Video | Nhãn | Gemini dự đoán | Gemini khớp | Gemini dư | Detector hiện tại | Thời gian |
| --- | --- | --- | --- | --- | --- | --- |
| `vid_01` bao cát, 1 người | 5 | 5 | 5 (100%) | 0 | 5/5, 0 dư (T-012) | 37 s |
| Adam đánh bóng, 1 người | 18 | 18 | 12 (67%) | 6 | 8/18, 3 dư (T-012) | 235 s |
| BoxingVI V6, trận thật, 63 s, 2 võ sĩ | 85 | — | — | — | 0/85 (T-022) | chưa đo được |

Nhận xét:

- Đếm cú: Gemini bằng detector trên bao cát, cao hơn trên Adam (12 so với 8) nhưng dư gấp đôi (6 so với 3).
- **Tay sai:** ở `vid_01`, Gemini ghi 3/5 cú là tay trái, nhãn là tay phải cả 5. Không dùng được thông tin tay nếu chưa kiểm thêm.
- **V6 chưa đo được**, mà đây là ca quan trọng nhất (detector ra 0): lượt 1 câu trả lời bị cắt ở giới hạn 8.192 token đầu ra; lượt 2 và 3 gặp 503 rồi mất kết nối (`fetch` của Node ngắt sau 300 s chờ header). Đã chuyển sang `curl` với hạn 600 s nhưng dừng trước khi có kết quả.
- Gói miễn phí trả 503 thường xuyên (5 trên khoảng 8 lượt gọi); mỗi video vài phút. Chưa phù hợp để chạy trong worker theo từng job.
- Một lượt đo, không lặp lại: chưa biết độ dao động giữa các lượt.

## Việc cần làm khi mở lại

1. Đo V6 (TEST-1) và V10 (TEST-2) của T-022, cùng các video âm tính `vid_02`, `vid_03`, `vid_05`, `vid_06` (phải ra 0 cú). Video trên 20 MB cần Files API thay vì gửi inline.
2. Chạy mỗi video 3 lần để đo độ ổn định (T-012 yêu cầu `punches` giống hệt giữa các lần).
3. So ở cùng tiêu chí ghép của `evaluate_punch_recall.py` (T-022), ghi recall, precision, số dư trên video âm tính, thời gian và lượng token.
4. Chỉ khi V6/V10 tốt hơn rõ rệt: đề xuất cách tích hợp (bước phụ trong worker cho video thi đấu, hoặc chỉ dùng ở màn phân tích đối thủ), kèm ngoại lệ phạm vi và lưu ý gói miễn phí (Google có thể dùng nội dung gửi lên).

## Tư liệu

`docs/archive/ai/gemini-punch-eval-20261027/`: script đo `gemini-punch-eval.mjs` (đọc video và nhãn trong `python-worker`, không sửa gì, key lấy từ biến môi trường), kết quả `result-adam.json`, `result-vid01.json` (từng cú Gemini trả về).
