# T-010B Review (đợt 1 và mục 5 của đợt 2)

- Ngày review: 29/10/2026, Claude.
- Phạm vi: các commit T-010B do Gemini làm ngày 26/10 (`f16a391`, `6c6dce8`, `bd96d63`, `28e1393`, `fef4008`, `28c167f`). Đã nằm trong nhánh demo `sync/T-004-fight-camp` (dùng cho buổi demo 27/10) và trong `feat/T-033-opponent-analysis-ui`. Chưa có trên `fight-camp`; merge cùng nhánh demo ở T-040.
- **Kết luận: APPROVED**, sau khi Claude sửa lỗi "nên sửa" bên dưới (`88f44e8` trên `feat/T-033-opponent-analysis-ui`). Tiêu chí 1 (API mode) chưa kiểm được vì máy review không có `.env`.

## Đã kiểm

| Việc | Kết quả |
| --- | --- |
| `round-advice.ts` (bản frontend của `buildCornerCard`, `buildRoundAdvice` cho demo mode) so với backend `bout-analysis.model.ts` trước T-037 | Logic giống nhau: điểm R21, bỏ sau 2 hiệp không hiệu quả, R22 đổi cách đánh, R23 thế trận, R24 an toàn. `round-advice.test.ts` 6/6 qua |
| Service gọi API (`bout-analysis.ts`) | Đúng đường dẫn và schema của backend; trạng thái được ghi hiệp khớp `assertCornerStatus` (`WEIGHED_IN`, `COMPLETED`) |
| 390 px, demo mode (`bout-weighed-in`) | Ghi hiệp và thẻ góc đài đều không cuộn ngang (tiêu chí 2) |
| In thẻ góc đài | Xuất PDF A4 được đúng **1 trang**, đủ hồ sơ trận và 4 chiến thuật (tiêu chí 1, phần in) |
| Frontend trên `feat/T-033` sau khi sửa | lint sạch; typecheck 0 lỗi (khi chạy không có `.env.local` demo của buổi 27/10); test 958 qua |

## Vấn đề

| Mức | Chỗ | Mô tả | Xử lý |
| --- | --- | --- | --- |
| Nên sửa | `lib/services/bout-analysis.ts`, `upsertBoutRound` và `saveOpponentAnalysis` | Đọc mã lỗi ở `err.responseBody?.code`, nhưng `ApiError` của `lib/api/client.ts` giữ mã ở `err.code`. Vì vậy ở API mode, mọi 422 (`BOUT_ROUND_MARK_UNKNOWN`, `BOUT_ROUNDS_NOT_SET`, `OPPONENT_TACTIC_UNKNOWN`…) đều thành "Lưu thất bại", và câu tiếng Việt có sẵn trong action không bao giờ hiện | **Claude đã sửa** (`88f44e8`): thêm hàm `backendCode()`, cùng `bout-analysis.test.ts` (3 ca; bỏ bản sửa thì 2 ca lỗi) |
| Gợi ý | `rounds-view.tsx:54` | `nextRoundNo = rounds.length + 1` sai nếu ghi các hiệp không liền nhau (ví dụ hiệp 1 và 3). Backend T-037 đã trả `advice.nextRound.roundNo` | Làm ở T-037 B |
| Gợi ý | `rounds-view.tsx` | Cả các hiệp mở cùng lúc, mỗi hiệp khoảng 20 nút cao khoảng 30 px (80 nút dưới 44 px ở 390 px). Đúng phạm vi đợt 1 (ghi **sau** trận), nhưng chưa dùng được giữa hiệp theo luồng nghiệp vụ "mặc định 4 chạm" | Đưa vào T-037 B (chế độ ghi giữa hiệp) |
| Gợi ý | `actions/bout-analysis.ts` | Kiểm quyền bằng `training:write`, còn backend dùng `bout:update`. Backend vẫn chặn đúng; chỉ là hai bên lệch nhau | Để sau |
| Gợi ý | `actions/bout-analysis.ts` | Lỗi không lường trước trả nguyên `error.message` (tiếng Anh) cho người dùng | Để sau |
| Gợi ý | `corner-card-view.tsx` | Bản in còn thanh đầu trang của app (logo, chuông, tên HLV) | Để sau |

## Còn mở

- Tiêu chí 1 ở API mode: ghi đủ một trận 3 hiệp, đọc lại đúng. Cần dev có `.env` chạy thử (Fon, khi làm T-037 B).
