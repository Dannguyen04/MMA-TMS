# T-009 B1, B3 Handover

- Nhánh: `feat/T-009-nutrition-ui`    Commit: `38ad59e`
- Người làm: Hoàng Anh, cùng Claude trên máy Hoàng Anh
- Trạng thái: IN REVIEW. **Chỉ merge sau phần A (Ken)**, đúng thứ tự trong ticket.
- Tên file có hậu tố `-B` để không đụng `T-009-HANDOVER.md` của phần A.

## Bối cảnh khác ticket

Ticket viết như thể phần B làm từ đầu trên `fight-camp`. Thực tế, khối "Kế hoạch ăn", câu hỏi sau khi ghi cân, chấm màu trên biểu đồ cân và dòng cảnh báo đã có sẵn trên nhánh demo (`sync/T-004-fight-camp`). Ở API mode, các dữ liệu này được lưu trong bộ nhớ server (`bouts.nutrition-mock.ts`, có từ T-032). `fight-camp` chưa có các file đó, nên nhánh này tạo từ `fix/T-032-demo-fixes` thay vì `fight-camp`. Nó sẽ vào `fight-camp` sau T-032, theo T-040.

Phần B1 và B3 ở đây gồm: làm cho phần đã có khớp với ticket, nối vào hợp đồng API ở §A2, và thêm dữ liệu mẫu.

## Thay đổi

- `components/domain/nutrition-plan-form.tsx`, `coach/bouts/[boutId]/page.tsx`: prop mới `currentPhase` (lấy từ `nutritionPhaseFor(bout.phase)`). Ô của giai đoạn hiện tại có nền và viền màu primary, kèm nhãn "Đang áp dụng". Ô "Người viết" cho tối đa 100 ký tự.
- `lib/domain/nutrition.ts`:
  - Thêm `nextNutritionPlan()`: ô bỏ trống thì xoá, ô không đổi thì giữ người soạn và ngày sửa, ô đã sửa thì ghi người và giờ mới. Trước đây logic này nằm trong mock.
  - `AUTHOR_MAX` đổi từ 80 thành 100 theo §A2.
- `lib/domain/bouts-contract.ts`:
  - `apiNutritionPlanSchema`. Trường `nutritionPlan` không bắt buộc trong `apiBoutSchema`.
  - `toNutritionPlan()` đổi `author` thành `authorName`.
  - `nutritionPlanBody()` tạo body cho `PUT`: bỏ ô trống, không gửi dấu thời gian.
  - `toCampBout()` nhận thêm tham số `nutritionFallback`.
- `lib/services/bouts.api.ts`:
  - Khi bout chưa có kế hoạch từ server, dùng bản trong bộ nhớ.
  - Thêm `saveApiNutritionPlan()` gọi `PUT /bouts/:id/nutrition-plan`. Nếu server trả 404 (route chưa có trước migration 026) thì lưu vào bộ nhớ như trước, để kịch bản demo API mode vẫn chạy.
- `lib/services/bouts.ts`:
  - Đọc `nutrition: [{ date, adherence }]` từ `/weight-track`. Mỗi câu trả lời là về ngày hôm trước và được gửi kèm số cân sáng hôm sau, nên chấm màu đặt ở `date + 1` (cùng cách làm với demo mode).
  - `wayOffForBout` cũng đếm từ nguồn này.
  - Server chưa trả `nutrition` thì dùng câu trả lời trong bộ nhớ.
- `lib/services/bouts.nutrition-mock.ts`: `saveMockNutritionPlan` được thay bằng `setMockNutritionPlan` (logic chuyển sang `nextNutritionPlan`).
- `lib/services/bouts.demo.ts`: thêm câu trả lời mẫu. Kenji (CAMP) đúng kế hoạch gần hết tuần rồi 2 ngày lệch nhiều, nên có dòng cảnh báo. Linh (FIGHT_WEEK) đúng kế hoạch, có một ngày lệch một chút.
- Từ điển:
  - Nhãn giai đoạn theo ticket: "Trong camp", "Tuần thi đấu", "Từ lúc cân đến giờ thi" (en: "During camp", "Fight week", "Weigh-in to fight time").
  - Mô tả khối kế hoạch.
  - Dòng cảnh báo vi: "3 ngày gần nhất: {n} ngày lệch nhiều."
  - `boutFighter.plan.currentPhase`.
- Test: `bouts-contract.test.ts` thêm 3 ca (đọc kế hoạch, dùng bản dự phòng, body của `PUT`). `nutrition.test.ts` thêm 1 ca (`nextNutritionPlan`).

## Đối chiếu tiêu chí

| Tiêu chí | Đáp ứng ở đâu |
| --- | --- |
| B1: khối "Kế hoạch ăn" có 3 ô trên trang chi tiết trận | `coach/bouts/[boutId]/page.tsx`, `nutrition-plan-form.tsx`. Chỉ hiện khi trận đang chạy (`isRunningPhase`) |
| B1: mỗi ô có người soạn và ngày sửa | Gợi ý dưới mỗi ô "Sửa lần cuối: {tên}, {ngày}" |
| B1: ô của giai đoạn hiện tại được làm nổi | `currentPhase`. Ảnh `b-linh-saigon` (FIGHT_WEEK): ô "Tuần thi đấu". Ảnh `b-kenji-pacific` (CAMP): ô "Trong camp" |
| B1: trận COMPLETED hoặc CANCELLED không sửa được (409) | Form ẩn khi trận kết thúc. Service từ chối trước khi gọi API. Mã 409 `BOUT_INVALID_TRANSITION` được dịch sẵn trong `boutRefusal` |
| B3: mỗi điểm cân có chấm màu theo `adherence` | `weight-chart.tsx` (có sẵn). API mode đọc từ `/weight-track`. Ảnh Linh có chấm xanh và cam, ảnh Kenji có chấm đỏ |
| B3: thẻ cảnh báo vàng hoặc đỏ có dòng "3 ngày gần nhất: {n} ngày lệch nhiều" | `camp-weight-card.tsx` (có sẵn). Ảnh Kenji (đỏ): "3 ngày gần nhất: 2 ngày lệch nhiều." |
| B3: màu không phải cách duy nhất | Có chú thích màu, bảng số liệu ghi câu trả lời bằng chữ, và `aria-label` của biểu đồ |
| Demo: dữ liệu mẫu cho trận CAMP và FIGHT_WEEK | `bouts.demo.ts`: kế hoạch cho Kenji và Linh (có sẵn), câu trả lời mới cho Kenji và Linh |
| Tiêu chí 3: không có calo, nước, xông hơi | Không thêm ô nào như vậy |
| Tiêu chí 5: 390 px không cuộn ngang, đủ `vi`/`en` | Ảnh 390 px của Linh, Kenji và `/fighter/bout`: không cuộn ngang. Khoá mới có ở cả hai ngôn ngữ |

## Lệnh đã chạy

Trên `38ad59e`:

```text
$ pnpm --filter nextjs-frontend lint
$ eslint

$ APP_DATA_MODE=api pnpm --filter nextjs-frontend typecheck
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully

$ pnpm --filter nextjs-frontend test
 Test Files  102 passed | 1 skipped (103)
      Tests  938 passed | 2 skipped (940)
```

So với `fix/T-032-demo-fixes` (934 qua): thêm 4 test, không thêm lỗi. Kiểm bằng mắt (Playwright, demo mode, `vi`): `/coach/bouts/b-linh-saigon` và `/coach/bouts/b-kenji-pacific` ở 1440 và 390 px, `/fighter/bout` ở 390 px. Không lỗi console, không cuộn ngang.

## Lệch so với ticket

- Nhánh tạo từ `fix/T-032-demo-fixes`, không phải `fight-camp` (lý do ở mục Bối cảnh).
- Làm trước khi A merge. Đọc và ghi theo đúng §A2. Khi route chưa có thì app lùi về bộ nhớ server, nên không cần cờ bật tắt.
- Câu cảnh báo tiếng Anh giữ nguyên "Last 3 days: {n} way off." vì test có sẵn kiểm đúng câu này.

## Câu hỏi / việc còn mở

- **Ken (A):** frontend giả định `GET /bouts/:id` trả `nutritionPlan.{camp,fightWeek,postWeighIn} = { text, author, updatedAt, updatedById }`, mỗi khoá có thể vắng hoặc `null`, và `/weight-track` trả `nutrition: [{ date, adherence }]` với `date` là ngày được hỏi. Khác thì báo để sửa `bouts-contract.ts`.
- **Fon (B2):** việc ghi câu trả lời ở API mode (`recordNutritionCheckin` trong `lib/services/bouts.ts`) vẫn lưu vào bộ nhớ. B2 đổi sang `PUT /bouts/:id/nutrition-checkins/:date`. Phần đọc ở nhánh này đã sẵn sàng. Đổi nhãn giai đoạn cũng làm đổi tiêu đề ô kế hoạch trên `/fighter/bout`.
- Chưa thử API mode với backend thật, vì phần A chưa có trên remote.
