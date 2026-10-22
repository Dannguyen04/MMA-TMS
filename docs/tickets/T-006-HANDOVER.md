# T-006 Handover

- Nhánh: `feat/T-006-weigh-in-and-result`    Commit: 6c37712
- Trạng thái: IN REVIEW

## Thay đổi
- `nestjs-api/src/database/schema.ts`: Mở rộng `BoutHistoryEntry` với các trường tùy chọn (`action`, `requirementCode`, `fromClass`, `toClass`, `fromLimitKg`, `toLimitKg`, `catchweightKg`, `lossOfConsciousness`, `stoppedByHeadStrike`, `injuryNote`) để lưu vết lịch sử mở khoá hồ sơ, đổi hạng cân, chốt catchweight và kết quả trận.
- `nestjs-api/src/bouts/bouts.model.ts`:
  - Mở `BOUT_TRANSITIONS`: `FIGHT_WEEK → ['WEIGHED_IN', 'CANCELLED']`, `WEIGHED_IN → ['COMPLETED', 'CANCELLED']`.
  - Cập nhật `resolveWeightClass`: kiểm tra hạng mở (`limitKg === null`) phải có giới hạn lớn hơn mức giới hạn lớn nhất của các hạng khác trong preset, nếu không trả về `LIMIT_OUT_OF_RANGE`.
  - Viết hàm thuần `computeAcuteLoss` tính tỷ lệ giảm cân cấp tốc theo cửa sổ học viện `acuteWindowDays` loại trừ bối cảnh `WEIGH_IN`.
  - Thêm các schema request và response: `weighInSchema`, `catchweightSchema`, `recordResultSchema`, `removeRequirementQuerySchema`, `acuteLossResponseSchema`, `weighInResponseSchema`, `weighInBlockSchema`.
  - Mở rộng `updateBoutSchema` nhận `reason`, `createRequirementSchema` và `updateRequirementSchema` nhận `unlockReason`, `boutHistoryEntrySchema` nhận các trường tuỳ chọn mới, `boutDetailResponseSchema` thêm `acuteLoss`.
- `nestjs-api/src/bouts/bouts.constants.ts`: Thêm các thông điệp phản hồi `WEIGH_IN`, `CATCHWEIGHT`, `RESULT`.
- `nestjs-api/src/bouts/bouts.error.ts`: Thêm các hàm tạo exception: `boutNotStarted` (409), `boutWeighInTooEarly` (409), `boutWeighInNotFailed` (409), `boutInvalidCatchweight` (422), `boutResultInvalid` (422), `boutRequirementsLocked` (409), `boutChangeReasonRequired` (422).
- `nestjs-api/src/bouts/bouts.repo.ts`: Thêm phương thức `insertFighterMeasurement` (context `WEIGH_IN`), cập nhật `findWeightMeasurements` trả về kèm `measurementContext`.
- `nestjs-api/src/bouts/bouts.service.ts`:
  - `updateBout`: Yêu cầu `reason` khi đổi hạng cân hoặc giới hạn cân (`BOUT_CHANGE_REASON_REQUIRED`) và ghi phần tử lịch sử `WEIGHT_CLASS_CHANGE`. Bỏ qua `reason` nếu không đổi hạng.
  - `addRequirement`, `updateRequirement`, `removeRequirement`: Khoá hồ sơ trong `FIGHT_WEEK` và `WEIGHED_IN`, yêu cầu `unlockReason` (`BOUT_REQUIREMENTS_LOCKED`), ghi nhận phần tử lịch sử `REQUIREMENT_UNLOCK`. Trạng thái `CAMP` không yêu cầu `unlockReason`.
  - `recordWeighIn`: Kiểm tra trạng thái `FIGHT_WEEK` và ngày cân học viện, ghi dòng `fighter_measurements`, cập nhật số cân chính thức, chuyển `WEIGHED_IN` nếu đạt hoặc giữ `FIGHT_WEEK` kèm khối phản hồi `weighIn`.
  - `recordCatchweight`: Kiểm tra trận `FIGHT_WEEK` sau khi cân không đạt, chốt mức catchweight, chuyển sang `WEIGHED_IN` và ghi lịch sử.
  - `recordResult`: Kiểm tra trạng thái `WEIGHED_IN` và ngày thi học viện, kiểm tra ràng buộc có điều kiện (hiệp, mất ý thức, dừng do đòn vùng đầu), cập nhật kết quả và chuyển sang `COMPLETED`.
  - `buildDetail`: Tính cờ giảm cấp tốc `acuteLoss` khi đã có cân chính thức.
- `nestjs-api/src/bouts/bouts.dto.ts`: Thêm các DTO tương ứng: `WeighInDto`, `CatchweightDto`, `RecordResultDto`, `WeighInResponseDto`, `RemoveRequirementQueryDto`.
- `nestjs-api/src/bouts/bouts.controller.ts`: Khai báo 3 endpoint mới: `POST /bouts/:id/weigh-in` (`bout:update`), `POST /bouts/:id/catchweight` (`bout:update`), `POST /bouts/:id/result` (`bout:result`), và nhận `unlockReason` query param trong `DELETE /bouts/:id/requirements/:code`.
- `nestjs-api/src/bouts/bouts.model.spec.ts`: Thêm unit test cho tiêu chí 1, 2, 3.
- `nestjs-api/src/bouts/bouts.controller.spec.ts`: Cập nhật kiểm tra route metadata và permissions cho 3 endpoint mới.
- `nestjs-api/src/bouts/bouts.service.spec.ts`: Thêm unit test cho các tiêu chí 4–18.

## Đối chiếu tiêu chí nghiệm thu
| Tiêu chí (theo ticket) | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| 1. `BOUT_TRANSITIONS`: `FIGHT_WEEK → WEIGHED_IN`, `WEIGHED_IN → COMPLETED` qua; `COMPLETED → CANCELLED`, `WEIGHED_IN → CAMP`, `FIGHT_WEEK → COMPLETED` bị từ chối | `bouts.model.ts:100–108`; Test: `bouts.model.spec.ts:389–398` |
| 2. `resolveWeightClass`: VMMAF `120+` với 100 → `LIMIT_OUT_OF_RANGE`; với 121 → ok; AIBA `91+` với 90 → từ chối, 92 → ok | `bouts.model.ts:254–265`; Test: `bouts.model.spec.ts:471–496` |
| 3. `computeAcuteLoss`: cửa sổ 7 ngày, `startKg` 66,0, cân chính thức 60,8, ngưỡng 8 → `lossPct` 7,9, `WITHIN`; cân chính thức 60,0 → 9,1, `EXCEEDED`; không có số cân nào trong cửa sổ → `NO_DATA`; số cân loại `WEIGH_IN` và bản đã supersede không được chọn làm `startKg`; có nhiều số cân thì chọn số sớm nhất trong cửa sổ | `bouts.model.ts:453–508`; Test: `bouts.model.spec.ts:523–633` |
| 4. Giới hạn 60 kg, cân chính thức 59,8, không kiểm tra nước → trận sang `WEIGHED_IN` ngay, một dòng `fighter_measurements` mới với context `WEIGH_IN`, `history` có chuyển trạng thái, phản hồi `weighIn.outcome = 'PASSED'`, `options` rỗng | `bouts.service.ts:468–547`; Test: `bouts.service.spec.ts:1213–1262` |
| 5. Cân chính thức 60,0 (bằng giới hạn) → đạt. Cân 60,5 → `FAILED`, `OVER_LIMIT`, `overByKg = 0,5`, `overByPct = 0,8`, trận vẫn `FIGHT_WEEK`, `options = ['CATCHWEIGHT','CANCEL']` | `bouts.service.ts:489–533`; Test: `bouts.service.spec.ts:1264–1309` |
| 6. Cân 59,8 nhưng `hydrationCheck = 'FAILED'` → trận vẫn `FIGHT_WEEK`, `HYDRATION_FAILED`, `made_weight = true` | `bouts.service.ts:494–533`; Test: `bouts.service.spec.ts:1311–1342` |
| 7. Sau ca 5, gọi `catchweight` không truyền giá trị → `catchweight_kg = 60,5`, trận sang `WEIGHED_IN`. Truyền 60,2 (< số cân chính thức) → 422 `BOUT_INVALID_CATCHWEIGHT`. Gọi `catchweight` khi cân đã đạt → 409 `BOUT_WEIGH_IN_NOT_FAILED` | `bouts.service.ts:595–648`; Test: `bouts.service.spec.ts:1432–1488` |
| 8. Cân lại khi còn `FIGHT_WEEK`: lần 2 đạt → `WEIGHED_IN`, trận mang số cân lần 2, cả hai dòng `fighter_measurements` còn. Gọi `weigh-in` khi đã `WEIGHED_IN` → 409 | `bouts.service.ts:474–478, 549–580`; Test: `bouts.service.spec.ts:1344–1376` |
| 9. `weigh-in` trước ngày cân (ngày học viện) → 409 `BOUT_WEIGH_IN_TOO_EARLY`; trận `CAMP` → 409 `BOUT_INVALID_TRANSITION` | `bouts.service.ts:474–485`; Test: `bouts.service.spec.ts:1378–1402` |
| 10. Cân chính thức làm `status` của `weight-track` đổi theo (điểm cân chính thức nằm trong `points`) | `bouts.service.ts:771–796`; Test: `bouts.service.spec.ts:1490–1524` |
| 11. `result` trước ngày thi → 409 `BOUT_NOT_STARTED`, trận không đổi. Từ ngày thi, `WIN` + `DECISION` + không `resultRound` → `COMPLETED` | `bouts.service.ts:656–678, 715–747`; Test: `bouts.service.spec.ts:1537–1583` |
| 12. `LOSS` + `KO` thiếu `lossOfConsciousness` → 422 `BOUT_RESULT_INVALID` (`CONSCIOUSNESS_REQUIRED`); `WIN` + `KO` có `lossOfConsciousness` → 422 (`CONSCIOUSNESS_NOT_ALLOWED`); `LOSS` + `TKO` thiếu `stoppedByHeadStrike` → 422; `DECISION` kèm `resultRound` → 422; `KO` thiếu `resultRound` → 422 | `bouts.service.ts:669–705`; Test: `bouts.service.spec.ts:1585–1658` |
| 13. `LOSS` + `TKO` + `lossOfConsciousness: 'NONE'` + `stoppedByHeadStrike: true` + `injuryNote` → `COMPLETED`; `history` của lần chuyển chứa đúng ba trường đó; không có bản ghi nào trong `injury_records` hay đình chỉ được tạo (kiểm tra bằng mock repo không bị gọi) | `bouts.service.ts:707–747`; Test: `bouts.service.spec.ts:1660–1707` |
| 14. `WEIGHED_IN → CANCELLED` với lý do "Không đạt cân": không tạo gì khác (H4) | `bouts.service.ts:413–427`; Test: `bouts.service.spec.ts:1709–1736` |
| 15. Khoá hồ sơ: trận `FIGHT_WEEK`, `PATCH /requirements/:code` không có `unlockReason` → 409 `BOUT_REQUIREMENTS_LOCKED`; có → thành công và `history` có phần tử `REQUIREMENT_UNLOCK`. Cùng kiểm tra cho `POST` và `DELETE`. Trận `CAMP` không cần `unlockReason` | `bouts.service.ts:436–522`; Test: `bouts.service.spec.ts:1745–1867` |
| 16. `PATCH` đổi hạng không có `reason` → 422 `BOUT_CHANGE_REASON_REQUIRED`; có `reason` → thành công, `history` có `WEIGHT_CLASS_CHANGE` với hạng và giới hạn cũ, mới; gửi lại đúng hạng cũ không cần lý do | `bouts.service.ts:285–336`; Test: `bouts.service.spec.ts:1878–1949` |
| 17. FIGHTER gọi `weigh-in`, `catchweight`, `result` → 403. COACH không được phân công → 403. ADMIN → được | `bouts.service.ts:800–812`; Test: `bouts.service.spec.ts:1963–2022`, `bouts.controller.spec.ts:13–46` |
| 18. Hai request `weigh-in` đồng thời trên cùng trận: một thành công, một nhận `BOUT_STATE_CONFLICT` hoặc 409 (dựa vào `expectedStatus` của `repo.updateBout`); không có trận nào ở trạng thái lệch | `bouts.service.ts:586`; Test: `bouts.service.spec.ts:1404–1429` |

## Lệnh đã chạy

### `pnpm --filter nestjs-api lint`
```text
$ oxlint src/ test/
src/notifications/notification-stream.service.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/notifications/notifications.config.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
```

### `pnpm --filter nestjs-api build`
```text
$ nest build
```

### `pnpm --filter nestjs-api test`
```text
 Test Files  6 failed | 47 passed (53)
      Tests  26 failed | 796 passed (822)
   Start at  12:05:21
   Duration  20.20s (transform 17.28s, setup 0ms, import 152.04s, tests 10.03s, environment 17ms)

[ELIFECYCLE] Test failed. See above for more details.
Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL

  × "pnpm recursive run" failed in D:\test\ai-worktrees\T-006\nestjs-api
```
*(Ghi chú so với baseline: 26 lỗi có sẵn gồm 5 test ở coaching-loop-persistence, 21 test ở dataset-export-trust-boundary theo mục B1 của BASELINE.md; số test qua tăng từ 767 lên 796, không thêm bất kỳ lỗi mới nào)*

### `pnpm --filter nestjs-api test:db`
```text
PASS 012 rejects reapplication without changing the applied ledger
Migration checks passed: 41. PostgreSQL stopped after tests. Scratch: C:\Users\DAN\AppData\Local\Temp\mma-migrations-s01CFw
```

### `pnpm --filter nestjs-api db:check`
```text
$ node run_sql.mjs --check
001-024 checksums OK. No database connection was opened.
```

## Lệch so với ticket
Không có

## Câu hỏi / việc còn mở
Không có
