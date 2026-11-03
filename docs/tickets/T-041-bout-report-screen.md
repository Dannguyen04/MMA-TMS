# T-041 · Màn báo cáo sau trận (nghiệp vụ 14)

| | |
| --- | --- |
| **Trạng thái** | READY (30/10), bắt đầu khi [T-040](./T-040-real-backend-demo.md) phần A đã merge |
| **Người nhận** | Fon |
| **Nhánh** | `feat/T-041-bout-report`, tạo từ `fight-camp` sau T-040 A. Không tạo từ nhánh T-033 nữa |
| **Nguồn** | [Luồng nghiệp vụ, nghiệp vụ 14](../FIGHT-CAMP-BUSINESS-FLOWS.md) (R29, R30), [nhận xét 27/10 mục 4](../REVIEW-27-10-FEEDBACK.md#4-backend-thật-và-độ-ổn-định) ("báo cáo sau trận: backend đã có, chưa có màn") |
| **Phụ thuộc** | T-040 A: màn ghi hiệp, thẻ góc đài và `lib/services/bout-analysis.ts` hiện chỉ có trên chuỗi nhánh demo. Backend `GET /bouts/:id/report` đã có từ T-010 A (merge 25/10) |

## 1. Bối cảnh

Sau trận, HLV cần xem chiến thuật nào hiệu quả, quan sát về đối thủ nào không đúng, và điểm cần luyện cho camp sau.

Backend đã có đủ (kiểm trong code `fight-camp` ngày 30/10):

- `GET /bouts/:id/report` (`nestjs-api/src/bouts/bouts.controller.ts:454`). Trận chưa `COMPLETED` thì 409 `BOUT_INVALID_TRANSITION` (`bouts.service.ts`, `getReport`). Response (`BoutReportResponseDto`, `bouts.dto.ts:143`):
  - `result`: `{ result, method, resultRound, knockedDown }`.
  - `tactics[]`: `{ id, text, effectiveRounds, ineffectiveRounds, outcome: 'EFFECTIVE'|'INEFFECTIVE'|'NOT_USED'|null, review: { outcome, note?, auto? }|null }`. `outcome` do app tính theo R29; `review` là bản HLV đã sửa (`auto: true` nghĩa là app điền sẵn).
  - `observations[]`: `{ id, text, notSeenInBout }`.
  - `acuteLoss`: `{ status: 'EXCEEDED'|'WITHIN'|'NO_DATA', startKg, startOn, lossPct, limitPct }` hoặc `null`.
  - `improvementPoints[]` (`bout-analysis.model.ts:475`), một trong ba dạng: `{ code: 'TACTIC_INEFFECTIVE', tacticId, text }`, `{ code: 'ACUTE_LOSS_EXCEEDED' }`, `{ code: 'FATIGUE_FROM_ROUND_n', fromRound }`.
  - `roundsRecorded`.
- `PUT /bouts/:id/opponent-analysis/review` (`bouts.controller.ts:270`), body `{ reviews: [{ tacticId, outcome, note? }] }`, tối đa 5 phần tử (`opponentReviewInputSchema`, `bout-analysis.model.ts:108`).

Frontend chưa có màn nào. Trên chuỗi nhánh demo, `lib/services/bout-analysis.ts` có `getBoutAnalysisDetail`, `getCornerCard`, `getBoutRounds`, `upsertBoutRound`, `saveOpponentAnalysis`, nhưng không có hàm đọc report hay lưu review.

## 2. Phạm vi

| File | Việc |
| --- | --- |
| `nextjs-frontend/src/lib/services/bout-analysis.ts` và `bout-analysis.demo.ts` | Thêm `getBoutReport(boutId)` và `saveTacticReviews(boutId, reviews)`, schema Zod theo đúng contract ở mục 1. Bản demo tính từ store |
| `nextjs-frontend/src/lib/domain/round-advice.ts` | Chép `evaluateTactics` và `buildImprovementPoints` từ `nestjs-api/src/bouts/bout-analysis.model.ts` (dòng 436, 489) để bản demo ra cùng kết quả với backend. Frontend chưa có hai hàm này, chỉ có `tacticOutcomeSchema` |
| `nextjs-frontend/src/lib/actions/bout-analysis.ts` | Action lưu review, đọc form, map lỗi 409 và 422 sang câu `vi` |
| `nextjs-frontend/src/app/(app)/coach/bouts/[boutId]/report/page.tsx` (mới) | Màn báo cáo (mục 2.1). Link từ trang chi tiết trận và từ màn ghi hiệp khi trận `COMPLETED` |
| `nextjs-frontend/src/lib/routes.ts` | Thêm route |
| Từ điển `bout-analysis.vi.ts`, `bout-analysis.en.ts` | Nhãn mới, câu cho 3 mã `improvementPoints` |
| Test cùng thư mục | Ca ở mục 4 |

### 2.1 Bố cục, theo thứ tự việc của HLV trên điện thoại

1. **Kết quả**: thắng/thua/hoà, cách thắng, hiệp, có bị đánh ngã không.
2. **Điểm cần luyện cho camp sau** (`improvementPoints`), đặt lên đầu vì là việc cần làm tiếp. Mỗi dòng một câu, ví dụ "Đuối sức từ hiệp 2", "Giảm cân cấp tốc vượt ngưỡng".
3. **Chiến thuật**: mỗi chiến thuật hiện số hiệp hiệu quả và không hiệu quả, nhãn kết quả. Nếu `review.auto` là `true` hoặc chưa có `review`, ghi "App điền sẵn". HLV đổi được kết quả và ghi chú (≤ 300 ký tự); một nút "Lưu đánh giá" gửi cả danh sách.
4. **Quan sát về đối thủ**: quan sát `notSeenInBout` có nhãn "Không thấy lại ở trận ngày {ngày trận}".
5. **Giảm cân cấp tốc**: chỉ hiện khi `acuteLoss.status = 'EXCEEDED'`.

`roundsRecorded = 0` thì hiện một câu giải thích kèm link sang màn ghi hiệp, không hiện bảng rỗng.

## 3. Ngoài phạm vi

- Thành tích 12 tháng (thắng–thua–hoà, số lần KO): backend chưa trả trong report.
- Chép phân tích sang trận mới gặp cùng đối thủ (R4b) và hiện điểm cần luyện khi tạo trận mới (R30).
- Phân tích video sau trận bằng AI ([T-047](./T-047-post-bout-video-analysis.md)). T-047 sẽ thêm khối vào màn này sau.
- Sửa backend.

## 4. Tiêu chí nghiệm thu và ca kiểm thử

| Ca | Đầu vào | Kết quả mong đợi |
| --- | --- | --- |
| R1 | Response mẫu đúng contract, có đủ 3 dạng `improvementPoints` | Parse được; ba câu `vi` đúng, không hiện mã thô (`FATIGUE_FROM_ROUND_2` thành "Đuối sức từ hiệp 2") |
| R2 | `improvementPoints` có mã lạ | Không ném lỗi trang; bỏ qua mục đó |
| R3 | Trận chưa `COMPLETED` (API trả 409) | Màn hiện "Báo cáo có sau khi ghi kết quả trận", không hiện trang lỗi |
| R4 | Chiến thuật `review: null`, `outcome: 'EFFECTIVE'` | Hiện "Hiệu quả", nhãn "App điền sẵn" |
| R5 | HLV đổi một chiến thuật sang "Không hiệu quả", ghi chú, rồi lưu | Gửi `reviews` đủ các chiến thuật; tải lại thì thấy kết quả mới, không còn "App điền sẵn" ở chiến thuật đó |
| R6 | Ghi chú 301 ký tự | Báo lỗi ở form, không gửi |
| R7 | `roundsRecorded = 0` | Câu giải thích, có link sang `/coach/bouts/{id}/rounds` |
| R8 | Demo mode: trận demo đã `COMPLETED` có ghi hiệp | Bản demo cho cùng `tactics[].outcome` như backend với cùng dữ liệu hiệp: chép ít nhất 3 ca của `bout-analysis.model.spec.ts` (phần R29) sang test frontend |
| R9 | 390 px, `vi` | Không cuộn ngang; khối "Điểm cần luyện" nằm trong màn hình đầu |

## 5. Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```

Không thêm lỗi so với `fight-camp` lúc tạo nhánh. Chụp màn ở 390 px và 1440 px, `vi` và `en`, đưa vào handover.
