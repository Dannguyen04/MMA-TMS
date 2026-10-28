# T-039 · Đo AI có xem được video trận đang diễn ra không (chỉ đo)

| | |
| --- | --- |
| **Trạng thái** | READY (28/10). Kết luận trước 3/11 |
| **Người nhận** | Viết script: Gemini (`gemini-3.8-flash-high`, worktree `D:/test/ai-worktrees/T-039`). Chạy đo bằng key thật: Claude. Duyệt kết luận: Dan |
| **Nhánh** | `feat/T-039-live-video-eval` từ `fight-camp` mới nhất |
| **Nguồn** | [Nhận xét 27/10, mục 3](../REVIEW-27-10-FEEDBACK.md#3-ai-gợi-ý-chiến-thuật-cả-trước-và-trong-trận); [T-034](./T-034-gemini-punch-eval.md) (đo thử 27/10: 37 s cho clip bao cát, 235 s cho clip Adam, 503 ở 5 trên khoảng 8 lần gọi, V6 chưa đo được) |
| **Migration** | Không. Không sửa code app |

## 1. Câu hỏi cần trả lời

Trong lúc trận đang diễn ra, nếu quay video từng hiệp rồi gửi cho Gemini, thì AI có trả nhận xét về hiệp vừa xong **trước khi hiệp sau bắt đầu** không? Thời gian nghỉ giữa hiệp là 60 s, và HLV cần khoảng 20 s cuối để dặn võ sĩ. Vậy toàn bộ chuỗi gửi video, phân tích và trả kết quả phải xong trong khoảng **40 s** sau khi hiệp kết thúc.

Ticket này chỉ đo. Không làm tính năng. Kết quả được phép là "không làm được trong 2 tuần" ([nhận xét 27/10, lưu ý](../REVIEW-27-10-FEEDBACK.md#7-chia-việc)).

## 2. Thiết lập đo

Script mới `python-worker/scripts/eval/live_round_feasibility.mjs` (Node, không thêm thư viện). Lấy khuôn từ `docs/archive/ai/gemini-punch-eval-20261027/gemini-punch-eval.mjs`: cách đọc nhãn BoxingVI (`csvTruth`), gọi `generateContent` với structured output, cắt đoạn YouTube bằng `videoMetadata.startOffset/endOffset`. Key đọc từ biến môi trường `GEMINI_API_KEY`; không đọc file `.env`, không in key. Kết quả ghi vào thư mục truyền qua tham số (`<outDir>`), không ghi vào repo.

**Video và nhãn.** Ngày 28/10, dữ liệu BoxingVI trong `python-worker/test_results/external/` (thư mục bị `.gitignore`) không còn trên máy, trong khi T-034 đã dùng nó ngày 27/10. Script lấy nhãn theo thứ tự sau: (1) dùng file cục bộ nếu có, đường dẫn như `python-worker/evaluate_punch_recall.py` dòng 538–565; (2) nếu không có, tải từ `https://raw.githubusercontent.com/leonardosm14/boxe.ml/96f3a7d0716040682381fb63f80afac96f74cfa6/dataset/clean_annotation_data/V6.csv` (và `V10.csv`) vào `<outDir>/labels/`. Commit được ghim cố định, không dùng nhánh `main`.

| Ca | Video | Đoạn (theo `evaluate_punch_recall.py`) | Số nhãn |
| --- | --- | --- | --- |
| V6 | `https://www.youtube.com/watch?v=cQW-h8yGbRc`, 23,976 khung/giây | khung 36500–38000 | 85 |
| V10 | `https://www.youtube.com/watch?v=OfZFdwW322E`, 25 khung/giây | khung 4000–5500 | 39 |

**Cấu hình**, mỗi cấu hình chạy 3 lần trên mỗi ca:

| Mã | Cách gửi | Độ dài | Khung/giây | Độ phân giải |
| --- | --- | --- | --- | --- |
| L1 | URL YouTube, cắt bằng offset | 30 s đầu của đoạn | 1 | LOW |
| L2 | URL YouTube, cắt bằng offset | cả đoạn (khoảng 63 s) | 1 | LOW |
| L3 | URL YouTube, cắt bằng offset | cả đoạn | 5 | LOW |
| L4 | **File cục bộ**, tải lên Files API rồi gọi (giống điện thoại quay rồi gửi) | cả đoạn | 1 | LOW |

L4 cần file mp4 cục bộ: `python-worker/test_results/external/boxingvi_original_20261006/rgb/cQW-h8yGbRc.mp4` hoặc `OfZFdwW322E.mp4`. Máy không có `ffmpeg` hay `yt-dlp`, nên script không cắt và không tải video. Không có file thì L4 được đánh dấu `SKIPPED_NO_LOCAL_FILE` trong kế hoạch và báo cáo. Có file thì tải cả file lên Files API, cắt đoạn bằng `videoMetadata` như L2.

**Prompt** (tiếng Việt, structured output): đóng vai trợ lý góc đài, xem đoạn video của **một hiệp**, trả về (a) số cú đấm ước lượng của từng võ sĩ (`red`, `blue`, hoặc `left`, `right` theo vị trí đầu đoạn), (b) tối đa 3 nhận xét về đối thủ, (c) tối đa 3 lời dặn cho hiệp sau, mỗi lời dặn một hành động, tối đa 120 ký tự. `maxOutputTokens` 2048.

**Đo cho mỗi lần gọi:**

- `upload_ms` (chỉ L4: từ lúc bắt đầu tải lên đến khi file sang trạng thái `ACTIVE`), `generate_ms`, `total_ms`.
- HTTP status, số lần thử lại (thử lại một lần khi 5xx, như T-033), lỗi cuối nếu có.
- `usageMetadata`: token đầu vào và đầu ra.
- Số cú dự đoán (tổng hai võ sĩ) so với số nhãn trong đoạn: sai số tương đối `|dự đoán − nhãn| / nhãn`. Không ghép theo thời điểm; T-034 đã cho thấy ghép từng cú chưa đáng tin.
- Lưu nguyên văn nhận xét và lời dặn để Dan đọc và chấm tay.

## 3. Báo cáo

Script in một bảng tổng hợp và ghi `summary.json`. Người thực hiện **không** chạy với key thật (worktree không có key). Họ chỉ chạy:

```bash
node python-worker/scripts/eval/live_round_feasibility.mjs --dry-run <outDir>
```

`--dry-run` không gọi mạng: in kế hoạch các lần gọi (ca, cấu hình, offset, đường dẫn file) và số nhãn trong từng đoạn, rồi thoát với mã 0.

Claude chạy thật với key, rồi viết `docs/tickets/T-039-RESULT.md` gồm bảng p50, p90 của `total_ms` theo cấu hình, tỉ lệ lỗi, token, sai số số cú, nguyên văn lời dặn của một lần chạy mỗi cấu hình, và kết luận theo mục 4.

## 4. Tiêu chí để kết luận "làm được" (đề xuất, Dan duyệt)

Một cấu hình được coi là **làm được** nếu đạt cả ba:

1. p90 của `total_ms` ≤ 40 000 ms. Với L4, tính cả `upload_ms`.
2. Lỗi sau khi thử lại ≤ 1 trên 6 lần gọi (2 ca × 3 lần).
3. Sai số số cú trung vị ≤ 30 %, và Dan chấm lời dặn "dùng được" ở ít nhất 2 trên 3 lần.

Không cấu hình nào đạt thì kết luận "không làm được trong 2 tuần", kèm số liệu. Nhóm báo thầy như vậy, không hứa tính năng.

## 5. Tiêu chí nghiệm thu (phần script)

1. `--dry-run` chạy được trên máy không có key, liệt kê đủ 4 cấu hình × 2 ca × 3 lần (L4 có thể là `SKIPPED_NO_LOCAL_FILE`), và in đúng số nhãn: V6 trong `[36500, 38000)` là **85**, V10 trong `[4000, 5500)` là **39** (khớp T-022). `--dry-run` được phép tải nhãn từ GitHub (chỉ nhãn, không tải video).
2. Thiếu `GEMINI_API_KEY` mà không có `--dry-run` thì thoát với mã khác 0 và câu báo rõ ràng, không gọi mạng.
3. Script không ghi gì vào repo ngoài chính nó, không đọc `.env`, không in key.
4. Không thêm dependency vào bất kỳ `package.json` nào.

## 6. Ngoài phạm vi

Mọi code app (backend, frontend, worker pipeline); quay video thật bằng điện thoại; streaming (Live API).
