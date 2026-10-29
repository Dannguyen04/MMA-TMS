# T-037 B · Khối "Hiệp sau" trên màn ghi hiệp (điện thoại)

| | |
| --- | --- |
| **Trạng thái** | READY (29/10) |
| **Người nhận** | Fon |
| **Nhánh** | `feat/T-037B-between-round-plan-ui`, tạo từ **`feat/T-033-opponent-analysis-ui`** (không phải `fight-camp`, xem "Phụ thuộc"). Nhánh T-033 đã chứa T-010B, nên T-038 B làm tiếp trên cùng chuỗi được |
| **Nguồn** | [T-037](./T-037-between-round-plan.md) (phần A: contract backend, đã merge 29/10), [nhận xét 27/10, mục 2](../REVIEW-27-10-FEEDBACK.md#2-trong-trận-diễn-biến-giữa-các-hiệp-phải-thực-tế-hơn) |
| **Phụ thuộc** | Màn ghi hiệp và thẻ góc đài hiện chỉ có trên nhánh `feat/T-010B-corner-card-rounds`, đã gộp vào `feat/T-033-opponent-analysis-ui` (T-033 IN REVIEW 27/10) (Gemini làm 26/10, handover IN REVIEW, chưa review). Nhánh đó dựng trên nhánh demo `sync/T-004-fight-camp`, cũng chưa merge vào `fight-camp` (việc của T-040). Ở API mode cần migration 030 đã áp lên Supabase |

## 1. Bối cảnh

Từ 29/10, backend đã có (T-037 A):

- `PUT /bouts/:id/rounds/:roundNo` nhận thêm `nextRoundPlan`: `focusTacticIds` (tối đa 2), `addedTactics` (tối đa 2, mỗi cái `{ id, text ≤140, observationIds }`) và `instructions` (tối đa 3, mỗi cái `{ code, tacticId?, text? }`).
- `GET /bouts/:id/rounds` trả thêm `advice.nextRound` = `{ roundNo, suggested, plan }`. Mỗi chiến thuật trong `advice.tactics` có thêm `focus` và `addedRound`; chiến thuật trọng tâm đứng đầu danh sách.
- Mã lời dặn: `SAFETY_CHECK`, `STOP_TACTIC`, `USE_TACTIC`, `RECHECK_OPPONENT`, `MUST_WIN_ROUND`, `HARD_TO_WIN_ON_POINTS`, `CUSTOM`. Backend chỉ trả mã, frontend dịch thành câu.
- Lỗi mới: 422 `BOUT_NEXT_ROUND_PLAN_LAST_ROUND`. Id lạ hoặc trùng thì 422 `BOUT_ROUND_MARK_UNKNOWN`.

Chi tiết quy tắc sinh `suggested` ở T-037 mục A2.

## 2. Phạm vi

Các file đều đã có trên nhánh T-033 (từ T-010B):

| File | Việc |
| --- | --- |
| `nextjs-frontend/src/lib/domain/round-advice.ts` | Thêm `nextRoundPlanSchema`, `instructionCodeSchema`; thêm `nextRoundPlan` vào `roundInputSchema` và `roundResponseSchema`; thêm `nextRound`, `focus`, `addedRound` vào `roundAdviceSchema`. Sửa `buildRoundAdvice` cho **giống hệt backend** (`nestjs-api/src/bouts/bout-analysis.model.ts` trên `fight-camp`): demo mode dùng hàm này nên hai bản phải ra cùng kết quả |
| `nextjs-frontend/src/lib/domain/round-advice.test.ts` | Chép các ca của `bout-analysis.model.spec.ts` (phần T-037) sang, để chứng minh hai bản giống nhau |
| `nextjs-frontend/src/lib/services/bout-analysis.ts`, `bout-analysis.demo.ts` | `upsertBoutRound` gửi và lưu `nextRoundPlan`. Bản demo lưu vào store trong bộ nhớ như các trường khác |
| `nextjs-frontend/src/lib/actions/bout-analysis.ts` | `recordBoutRoundAction` đọc kế hoạch hiệp sau từ form; map hai mã lỗi 422 mới sang câu tiếng Việt |
| `nextjs-frontend/src/app/(app)/coach/bouts/[boutId]/rounds/rounds-view.tsx` | Khối **"Hiệp {n}: làm gì"**, đặt ngay dưới cảnh báo an toàn của lời dặn hiện có (dòng 73 trở đi) |
| `nextjs-frontend/src/app/(app)/coach/bouts/[boutId]/corner-card/corner-card-view.tsx` | Chiến thuật `focus` có nhãn "Trọng tâm"; chiến thuật thêm giữa trận có nhãn "Thêm ở hiệp {n}" |
| `nextjs-frontend/src/lib/i18n/messages/bout-analysis.vi.ts`, `bout-analysis.en.ts` | Câu cho 7 mã lời dặn và các nhãn mới, ví dụ `USE_TACTIC`: "Dùng: {tactic}", `STOP_TACTIC`: "Bỏ: {tactic}", `SAFETY_CHECK`: "Kiểm tra võ sĩ trước khi cho đánh tiếp" |

### Khối "Hiệp sau"

1. **Đề xuất của app** (`advice.nextRound.suggested`): mỗi mục một nút chạm để chọn hoặc bỏ chọn, chọn tối đa 3. `SAFETY_CHECK`, nếu có, luôn đứng đầu, nền đỏ, và được chọn sẵn.
2. **Trọng tâm**: danh sách chiến thuật lấy từ `advice.tactics`, chạm để chọn tối đa 2. Chiến thuật bị "Bỏ" vẫn chọn được, nhưng hiện cảnh báo nhỏ.
3. **Thêm chiến thuật** (mở khi bấm thêm): một ô chữ (≤140 ký tự) và chọn quan sát làm căn cứ (tuỳ chọn). Id sinh ở client, theo `analysisIdSchema` (`^[a-z0-9_-]{1,20}$`), ví dụ `r2-a1`.
4. **Lời dặn tự do** (tuỳ chọn): một ô chữ ≤140 ký tự, gửi lên thành mục `CUSTOM`.
5. Nút lưu dùng chung với form ghi hiệp hiện có: một lần gửi `PUT …/rounds/:roundNo` gồm bản ghi hiệp và `nextRoundPlan`. **Không** hiện khối này ở hiệp cuối.
6. Mở lại một hiệp đã ghi thì hiện đúng kế hoạch đã lưu (`advice.nextRound.plan`, hoặc `rounds[i].nextRoundPlan`).

Giới hạn sử dụng: chọn bằng chạm, không bắt buộc gõ chữ. Ở 390 px không cuộn ngang, nút chạm cao ít nhất 44 px.

## 3. Ngoài phạm vi

- Lời dặn do AI viết (T-038 B).
- Đổi backend. Nếu contract khác ticket này thì ghi vào handover, không sửa backend.
- Review hay sửa phần T-010B đã có, trừ chỗ bắt buộc phải sửa để thêm khối mới.

## 4. Tiêu chí nghiệm thu

1. `round-advice.test.ts`: các ca chép từ backend đều qua, gồm thứ tự trọng tâm, `addedRound` và bảng `suggested` (an toàn, bỏ, dùng, xem lại, cần thắng).
2. Demo mode: trận `bout-weighed-in`, ghi hiệp 1 kèm kế hoạch (1 trọng tâm, 1 chiến thuật mới, 1 lời dặn tự do) rồi mở lại màn: kế hoạch hiện đúng; thẻ góc đài có nhãn "Trọng tâm" và "Thêm ở hiệp 1"; ở hiệp 2 chấm được chiến thuật mới.
3. Ở hiệp cuối không có khối "Hiệp sau".
4. API mode (dev có `.env`, migration 030 đã áp): làm lại tiêu chí 2 với một trận giả; ghi trong handover response của `GET /bouts/:id/rounds`, bỏ phần không liên quan.
5. 390 px: ảnh chụp màn hình ghi hiệp có khối "Hiệp sau", không cuộn ngang.
6. `lint`, `typecheck`, `test` của `nextjs-frontend` không thêm lỗi so với nhánh gốc `feat/T-033-opponent-analysis-ui`; handover ghi số trước và sau.

## 5. Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```
