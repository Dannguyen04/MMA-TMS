# T-029 Handover

- Nhánh: feat/T-029-coach-todo    Commit: b9638eb (code), trước đó 1e7a1d1, a71db11, e73421c, 5d1f1aa
- Trạng thái: IN REVIEW
- **Người thực hiện: Claude, theo chỉ định trực tiếp của chủ dự án (24/10).** Vì vậy review T-029 không còn độc lập với người viết code. Chủ dự án quyết ai review (một dev khác, hoặc chính chủ dự án).

## Thay đổi

Slice 1 (5d1f1aa): đổi tên trạng thái cân theo ý nghĩa, thêm `NEUTRAL` (Q1, chủ dự án chốt 24/10).
- `nestjs-api/src/bouts/bouts.model.ts`: `WEIGHT_TRACK_STATUSES` = `ON_TRACK`, `ABOVE_TARGET`, `OVER_LIMIT`, `NOT_WEIGHED`, `NEUTRAL`; `computeWeightTrack` nhận `boutStatus` (tùy chọn); từ `WEIGHED_IN`, `COMPLETED`, `CANCELLED` trả `NEUTRAL`, vẫn trả `points`.
- `bouts.service.ts`, `bouts.controller.ts`, specs: theo tên mới; test T-006 "criterion 10" đổi kỳ vọng từ `ON_TRACK` sang `NEUTRAL` vì mâu thuẫn quyết định mới (ghi ở "Lệch so với ticket").
- Frontend: `types.ts`, `services/bouts.ts`, `domain/bout-rules.ts` (bản demo của `calculateWeightWarning` nhận `boutStatus`), `domain/labels.ts`, `status-badges.tsx` (ánh xạ trạng thái sang tông màu), `weight-summary.tsx`, `weigh-in.ts`, `weight-alerts-card.tsx` (xóa, xem slice 3), i18n vi/en (`weightStatus.*`, `weightNote.*`).
- `docs/FIGHT-CAMP-TECH-SPEC.md` §5: tên mới, `NEUTRAL`, câu "status là ý nghĩa, không phải màu".

Slice 2a (e73421c): khả thi về cân (R31) và nhắc cân (T0).
- `bouts.model.ts`: `computeWeightFeasibility` (hàm mới, không dùng lại `computeWeightTrack`), `weightFeasibilityWarnings`, `computeWeighInReminder`, `computeBoutWeightTrack` và `campStartOf` (một nơi duy nhất dựng đầu vào `computeWeightTrack` cho trang chi tiết và thẻ việc), schema `weightReminder`, `createBoutResponseSchema`, `feasibilityQuerySchema`, `feasibilityResponseSchema`.
- `bouts.service.ts`: `getFeasibility` (xem trước, chỉ đọc); `createBout` trả thêm `warnings`; `buildDetail` thêm `weightReminder`; `loadWeightTrack` dùng `computeBoutWeightTrack`.
- `bouts.controller.ts`, `bouts.dto.ts`, `bouts.constants.ts`: `GET /bouts/feasibility` (đặt trước `bouts/:id`, quyền `bout:create`).

Slice 2b (a71db11): thẻ Việc cần làm, backend.
- `bouts-todo.model.ts` (mới): 7 provider độc lập cho 10 mã nguồn, `collectTodoItems`, schema phản hồi.
- `bouts-todo.service.ts`, `bouts-todo.controller.ts` (mới): `GET /coach/todo`; COACH thấy võ sĩ được phân công, ADMIN cả CLB, vai trò khác 403; đọc theo lô (không truy vấn theo từng trận).
- `bouts.repo.ts`: `findPlansByIds`, `listRequirementsForBouts`, `findWeightMeasurementsForFighters`.
- `bouts.module.ts`: đăng ký controller và service; `bouts.service.ts`: export `toRequirementState`.

Slice 3 (1e7a1d1, b9638eb): frontend.
- `coach/dashboard/coach-todo-card.tsx` (mới) thay `weight-alerts-card.tsx`; `dashboard/page.tsx` gọi `getCoachTodo`.
- `coach/bouts/new/bout-form.tsx` + `lib/actions/bouts.ts` (`previewFeasibilityAction`): kiểm tra cân hiện trước khi lưu, chỉ cảnh báo.
- `fighter/bout/page.tsx`: nhắc cân trong tuần thi đấu (lấy `weightReminder` từ `getBout`, vì danh sách trận ở API mode không có trường tính toán).
- `lib/services/bouts.ts`, `bouts.demo.ts`, `domain/bout-rules.ts`, `domain/coach-todo.ts` (mới): hàm gọi API và bản demo mô phỏng cùng quy tắc.
- `lib/domain/weigh-in.ts`: bỏ `weightAlerts` (không còn dùng).
- i18n vi/en: `coachTodo.*`, `feasibility.*`, `weightReminder.*`.

## Đối chiếu tiêu chí nghiệm thu

| Tiêu chí (theo ticket) | Đáp ứng ở đâu |
| --- | --- |
| 1. Mục 1: `WEIGHED_IN` 66 kg không ĐỎ (nay `NEUTRAL`), `FIGHT_WEEK` vẫn `OVER_LIMIT`, `COMPLETED`/`CANCELLED` không màu, `points` còn | `bouts.model.spec.ts` "is NEUTRAL from WEIGHED_IN on…", "…even with no weight at all"; `bouts.service.spec.ts` criterion 10 |
| 2. Mục 2: 60 kg, L = 8, 2 ngày, 66 kg → 9,1% đỏ; 64,5 kg → 7,0% xanh; dưới hạng → 0% xanh; không cân trong 7 ngày (8 ngày trước cũng là không) → `NOT_WEIGHED`; ranh giới `D = A`. `D > A` theo Q2 (phương án B: không màu) | `bouts.model.spec.ts` "weight feasibility (R31, T-029)" (5 test) |
| 3. Mục 4: `ASK_TODAY`, `YESTERDAY_MISSING`, nhập cân hôm nay thì thôi, chưa có cân nào, chỉ `FIGHT_WEEK`, ranh giới nửa đêm `Asia/Ho_Chi_Minh`, `WEIGHT_STALE_DAYS` vẫn 3 | `bouts.model.spec.ts` "weigh-in reminder (T0, T-029)" (6 test); `WEIGHT_STALE_DAYS` không đổi |
| 4. `GET /bouts/:id` có `weightReminder`; `weight-track` ở `WEIGHED_IN` không đỏ | `bouts.service.spec.ts` "the bout detail carries weightReminder only in FIGHT_WEEK" |
| 5. Mục 3: preview ĐỎ và 9,1% trước khi lưu, `createBout` vẫn lưu và có cảnh báo; không có cân → cảnh báo thiếu dữ liệu; `updateBout`, `resolveWeightClass` không đổi | `bouts.service.spec.ts` "weight feasibility and reminder (T-029)" (5 test); `git diff` không chạm hai hàm đó |
| 6. Mục 5: "Đủ điều kiện vào tuần thi đấu"; thiếu nguồn T-007 vẫn trả kết quả; HLV không thấy võ sĩ không phân công, Admin thấy tất cả; mỗi nguồn có test riêng | `bouts-todo.model.spec.ts` (provider và `collectTodoItems`), `bouts-todo.service.spec.ts` (phạm vi 403/COACH/ALL, đọc theo lô, cắt ở 100 trận) |
| 7. Hôm nay cân chính thức (R17), quá ngày thi chưa có kết quả (R26), trận `COMPLETED`/`CANCELLED` không có dòng nào | `bouts-todo.model.spec.ts` "weighInTodayProvider", "resultOverdueProvider"; service chỉ đọc trận đang chạy |
| Không có migration | Không thêm file migration; `test:db` và `db:check` vẫn qua |
| Kiểm tra bằng mắt (demo mode, `next dev`) | Thẻ Việc cần làm trên `/coach/dashboard`; form `/coach/bouts/new` chọn Minh Trần + 60 kg + cân 26/10: "Có rủi ro: 66.0 kg cao hơn giới hạn 60.0 kg tới 9.1%…", đổi sang 20/11: "Buổi cân còn xa hơn 7 ngày nên chưa đánh giá…" |

## Lệnh đã chạy

Chạy trong worktree `D:/test/ai-worktrees/T-029`, trên commit b9638eb. Dưới đây là phần cuối output nguyên văn.

### pnpm --filter nestjs-api lint (exit 0, chỉ có cảnh báo có sẵn)

```text
src/notifications/notification-stream.service.ts:91:33: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:318:24: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:319:33: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:333:31: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
exit 0
```

### pnpm --filter nestjs-api build

```text
$ nest build
exit 0
```

### pnpm --filter nestjs-api test (exit 1, toàn bộ lỗi là baseline B1 và B2)

```text
      Tests  26 failed | 885 passed (911)
     Errors  7 errors
   Start at  15:04:38
   Duration  5.11s (transform 5.34s, setup 0ms, import 59.84s, tests 3.18s, environment 6ms)
[ELIFECYCLE] Test failed. See above for more details.
Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL
  × "pnpm recursive run" failed in D:\test\ai-worktrees\T-029\nestjs-api
exit 1
```

Các file lỗi: src/notifications/notification-producer.service.spec.ts, src/notifications/notification-stream.service.spec.ts, src/notifications/notifications.config.spec.ts, src/notifications/notifications.service.spec.ts, test/coaching-loop-persistence.spec.ts, test/dataset-export-trust-boundary.spec.ts. 26 test lỗi nằm ở `test/coaching-loop-persistence.spec.ts` (5) và `test/dataset-export-trust-boundary.spec.ts` (21), cần Redis và Supabase (baseline B1); 4 file `src/notifications/*.spec.ts` báo "0 test" (baseline B2). Dòng "7 errors" là `ECONNREFUSED` tới Redis (127.0.0.1:6379) và lỗi đóng worker của vitest, cùng nguồn với B1. Không file nào thuộc `src/bouts`.

### pnpm --filter nestjs-api test:db

```text
PASS 012 orders identical created_at values by server issuance sequence
PASS 012 rejects reapplication without changing the applied ledger
Migration checks passed: 43. PostgreSQL stopped after tests. Scratch: C:\Users\PC\AppData\Local\Temp\mma-migrations-WTxJ0m
exit 0
```

### pnpm --filter nestjs-api db:check

```text
$ node run_sql.mjs --check
001-027 checksums OK. No database connection was opened.
exit 0
```

### pnpm --filter nextjs-frontend lint

```text
$ eslint
exit 0
```

### pnpm --filter nextjs-frontend typecheck

```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
exit 0
```

### pnpm --filter nextjs-frontend test

```text
      Tests  667 passed | 2 skipped (669)
   Start at  15:07:07
   Duration  3.23s (transform 41%, import 38%, tests 19%, worker 1%)
  Transform  transforming modules took 11.63s · 41% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns
exit 0
```

`pnpm --filter nextjs-frontend build` chạy lại trên b9638eb: exit 0 (danh sách route in đủ, không lỗi).

So với [baseline](./BASELINE.md): backend test 26 lỗi như cũ (số test qua tăng từ 611 lên 885 do code mới và code merge sau khi lập baseline); frontend test qua 667 (baseline 578). Không lệnh nào thêm lỗi.

## Lệch so với ticket

- **R31 (T-029):** thêm hàm thuần mới `computeWeightFeasibility` trong `nestjs-api/src/bouts/bouts.model.ts`, cạnh `computeWeightTrack`, thay vì chỉ gọi lại `computeWeightTrack` như chỉ dẫn giao việc. Lý do: `computeWeightTrack` dựng đường tham chiếu từ cân đầu camp. Lúc tạo trận chưa có camp, đường này bắt đầu tại cân gần nhất nên nhánh VÀNG không bao giờ chạy và trận còn xa luôn ra XANH. Ngoài ra XÁM sau 3 ngày mâu thuẫn với cửa sổ 7 ngày của R31. Người quyết định: Ken, ngày 22/10/2026. Hàm mới không thay đổi `computeWeightTrack` ngoài việc nhận thêm `boutStatus` (mục 1).
- **Trạng thái của hàm R31 dùng lại từ vựng của theo dõi cân:** `NOT_WEIGHED` = không có cân trong 7 ngày (thiếu dữ liệu), `NEUTRAL` = buổi cân còn xa hơn cửa sổ cấp tính (chưa đánh giá), không thêm mã mới (Q2, phương án B).
- **Test T-006 "criterion 10"** đổi kỳ vọng `ON_TRACK` thành `NEUTRAL`: theo quyết định 24/10, từ `WEIGHED_IN` không tính màu.
- **Cửa sổ nhắc cân** là `FIGHT_WEEK`, không phải "`CAMP` tới hết ngày thi" của module 07 (quyết định của chủ dự án 24/10). Mức `STALE` và "XÁM 2 ngày" không có.
- **Mã nguồn việc của thẻ Việc cần làm** (Q3 chỉ nói "mã nguồn việc"): `REQUIREMENTS_DUE`, `REQUIREMENTS_OVERDUE`, `WEIGHT_OVER_LIMIT`, `WEIGHT_ABOVE_TARGET`, `WEIGHT_NOT_WEIGHED`, `TACTICS_WITHOUT_SESSIONS`, `CAN_ENTER_FIGHT_WEEK`, `WEIGH_IN_TODAY`, `RESULT_OVERDUE`, `WEIGHT_NOT_LOGGED`; pha `BEFORE`/`DURING`/`AFTER`; thêm trường `truncated` (cắt ở 100 trận). Chủ dự án duyệt các tên này khi xem lại handover.
- **`messageCode` của nhắc cân:** `WEIGHT_REMINDER_ASK_TODAY`, `WEIGHT_REMINDER_YESTERDAY_MISSING`.
- **Đổi tên 4 giá trị `weight.status` cũ** (làm theo yêu cầu trực tiếp của chủ dự án, ngoài ticket gốc): đây là thay đổi contract đã merge ở T-003; mọi nơi đọc đã đổi trong cùng nhánh.
- **Chưa làm (chờ T-007):** hai nguồn R28 (buổi tập xung đột đình chỉ) và S3 (đình chỉ chờ xác nhận) của thẻ việc; nối R31 vào bộ lọc `GET /readiness`. R27 "cân nhắc đình chỉ thủ công" trả rỗng vì chưa có cảnh báo R24 (T-010 giai đoạn sau).

## Câu hỏi / việc còn mở

- Ai review T-029, vì người viết code là Claude.
- Thông báo Dan trước khi merge: nhánh sửa `bouts.service.ts` và `bouts.model.ts`. Thông báo Hoàng Anh và Fon: `weight.status` đổi tên, thêm `NEUTRAL`, `weightReminder`, `warnings` của `createBout`, `GET /bouts/feasibility`, `GET /coach/todo`.
- Backend ở API mode chưa được thử với Supabase thật (worktree không có `.env`); các endpoint mới chỉ được kiểm bằng unit test và demo mode ở frontend.
- Nhánh chưa push (theo quy định: chủ dự án push).
