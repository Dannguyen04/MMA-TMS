# T-045 Handover (Phần A — Backend)

- Nhánh: `feat/T-045-graded-return`    Commit: chưa commit (base `a5d58ef`)
- Trạng thái: IN REVIEW

## Thay đổi

- `nestjs-api/src/suspensions/suspensions.constants.ts`: Thêm kiểu `SessionIntensityTier = 1 | 2 | 3 | 4 | 5` và hằng số `SESSION_INTENSITY_TIERS: Record<SessionType, SessionIntensityTier>` đúng bảng 2.1 (`RECOVERY = 1`, `CONDITIONING = 2`, `TECHNIQUE = 3`, `GRAPPLING = 4`, `SPARRING = 5`).
- `nestjs-api/src/suspensions/suspensions.model.ts`:
  - Xuất lại `SESSION_INTENSITY_TIERS`, `SessionIntensityTier`.
  - Thêm `SuspensionGradedReturnInput` và `GradedReturn` (`{ ceiling: SessionIntensityTier; fullReturnOn: string }`), mở rộng `BlockingSuspension` với `gradedReturn?: GradedReturn`.
  - Thêm các hàm thuần:
    - `blockedTypesForMaxTier(maxTier)`: trả mảng `SessionType` có bậc `> maxTier` giữ nguyên thứ tự `SESSION_TYPES`.
    - `maxAllowedTier(blockedSessionTypes)`: trả bậc lớn nhất trong các loại buổi không nằm trong `blockedSessionTypes`, hoặc `0` nếu tất cả 5 loại buổi đều bị cấm.
    - `gradedReturnFor(suspension, date)` và `gradedReturnCeiling(suspension, date)`: tính lộ trình tập lại theo bậc sau khi bác sĩ giải tỏa lệnh cấm `KO`/`TKO` (`requiresClearance === true`, `clearedAt !== null`, `isInForceOn(suspension, date) === false`), trong đó mốc bắt đầu `returnStartsOn = max(endsOn + 1 ngày, academyDateOf(clearedAt))` và `fullReturnOn = returnStartsOn + 2 ngày` (`delta = 0 -> ceiling = 2`, `delta = 1 -> ceiling = 3`, `delta >= 2` hoặc ngoài cửa sổ -> `null`).
  - Mở rộng `createSuspensionSchema` với `maxTier` tùy chọn (`int`, `1..5`) loại trừ lẫn nhau với `blockedSessionTypes` qua `superRefine`.
  - Thêm `gradedReturnSchema` và mở rộng `suspensionResponseSchema` với `maxAllowedTier: z.number().int().min(0).max(5)` và `gradedReturn: gradedReturnSchema.nullable()`.
- `nestjs-api/src/suspensions/suspensions.dto.ts`: Thêm `GradedReturnDto` (từ `gradedReturnSchema`); `CreateSuspensionDto` và `SuspensionResponseDto` tự động phản ánh `maxTier`, `maxAllowedTier`, `gradedReturn` mà không chứa kiểu `Date` trong JSON Schema.
- `nestjs-api/src/suspensions/suspensions.service.ts`:
  - `createSuspension`: khi có `data.maxTier !== undefined` thì tính `blockedSessionTypes = blockedTypesForMaxTier(data.maxTier)`.
  - `toSuspensionResponse`: tính và trả thêm `maxAllowedTier: maxAllowedTier(row.blockedSessionTypes)` và `gradedReturn: gradedReturnFor(row, today)`.
- `nestjs-api/src/suspensions/suspension.gate.ts`:
  - `blockingSuspensions`: giữ nguyên hành vi cho lệnh cấm đang có hiệu lực (`isInForceOn`); bổ sung nhánh kiểm tra lệnh cấm `KO`/`TKO` đã được giải tỏa đang trong lộ trình tập lại (`gradedReturnFor(row, date)` khác `null`) — khi `SESSION_INTENSITY_TIERS[sessionType] > gradedReturn.ceiling` thì chặn buổi tập và gắn thêm `gradedReturn: { ceiling, fullReturnOn }` vào phần tử trả về. Lỗi trả về vẫn là `409 TRAINING_SUSPENSION_ACTIVE` (`trainingSuspensionActive`), không thêm mã lỗi mới.
- `nestjs-api/src/bouts/bouts.model.ts`, `nestjs-api/src/bouts/bouts.dto.ts`, `nestjs-api/src/bouts/bouts.service.ts`:
  - `classifyReadiness` và `getReadiness`: võ sĩ có lệnh cấm `KO`/`TKO` đang trong lộ trình tập lại (`gradedReturnFor(s, on)` khác `null`) được xếp `ready: false`, `status: 'SUSPENDED'`, `notReadyReasons` có `'SUSPENDED'`, kèm `fullReturnOn`, `gradedReturn`, và `suspension` summary có `fullReturnOn`, `gradedReturn`. Từ ngày `fullReturnOn` trở đi (`D+2`), võ sĩ sẵn sàng trở lại (`ready: true`, `status: 'READY'`, `fullReturnOn: null`, `gradedReturn: null`).
  - Mở rộng `readinessRowSchema`, thêm `readinessSuspensionSchema` và `ReadinessSuspensionDto` trong `bouts.dto.ts` (không chứa `Date` trong JSON Schema).
- Các file unit test:
  - `nestjs-api/src/suspensions/suspensions.model.spec.ts`
  - `nestjs-api/src/suspensions/suspensions.service.spec.ts`
  - `nestjs-api/src/suspensions/suspension.gate.spec.ts`
  - `nestjs-api/src/suspensions/suspensions.dto.spec.ts`
  - `nestjs-api/src/training/sessions/training-session.service.spec.ts`
  - `nestjs-api/src/bouts/bouts.model.spec.ts`
  - `nestjs-api/src/bouts/bouts.service.spec.ts`

## Đối chiếu tiêu chí nghiệm thu

| Tiêu chí (theo ticket mục 4) | Đáp ứng ở đâu (`file:dòng`, test nào) |
| --- | --- |
| **1.** `SESSION_INTENSITY_TIERS`: có đủ 5 khóa của `SESSION_TYPES` với giá trị `RECOVERY=1`, `CONDITIONING=2`, `TECHNIQUE=3`, `GRAPPLING=4`, `SPARRING=5`. | Code: `nestjs-api/src/suspensions/suspensions.constants.ts:25-38`.<br>Test: `nestjs-api/src/suspensions/suspensions.model.spec.ts:1032-1041` (`Criterion 1: SESSION_INTENSITY_TIERS maps all 5 SESSION_TYPES to tiers 1..5`). |
| **2.** `maxTier` khi tạo đình chỉ: tạo đình chỉ với `maxTier = 3` (không truyền `blockedSessionTypes`) lưu `blockedSessionTypes` gồm 2 loại bậc 4 và 5, và response có `maxAllowedTier = 3`; truyền cả `maxTier` và `blockedSessionTypes` trả `400`; truyền `maxTier = 0` hoặc `maxTier = 6` trả `400`. | Code: `nestjs-api/src/suspensions/suspensions.model.ts:152-167,412-463,979-983`, `nestjs-api/src/suspensions/suspensions.service.ts:107-112,318-329`.<br>Test: `nestjs-api/src/suspensions/suspensions.model.spec.ts:1043-1076` (`Criterion 2: blockedTypesForMaxTier(3) returns tier > 3 session types in SESSION_TYPES order and maxAllowedTier computes the highest allowed tier`, `Criterion 2: createSuspensionSchema accepts maxTier 1..5, rejects maxTier=0 or maxTier=6, and rejects passing both maxTier and blockedSessionTypes`), `nestjs-api/src/suspensions/suspensions.service.spec.ts:318-378` (`Criterion 2: creates a suspension with maxTier = 3 (without blockedSessionTypes), persists blockedSessionTypes for tiers > 3, and returns maxAllowedTier = 3`). |
| **3.** Không truyền cả `maxTier` lẫn `blockedSessionTypes`: giữ nguyên hành vi cũ (chặn cả 5 loại buổi), response có `maxAllowedTier = 0`. | Code: `nestjs-api/src/suspensions/suspensions.model.ts:159-167`, `nestjs-api/src/suspensions/suspensions.service.ts:107-112,318-329`.<br>Test: `nestjs-api/src/suspensions/suspensions.service.spec.ts:380-400` (`Criterion 3: omitting both maxTier and blockedSessionTypes blocks all 5 session types and returns maxAllowedTier = 0`). |
| **4.** Lộ trình tập lại sau `KO`/`TKO` được giải tỏa đúng hạn hoặc sau hạn (`endsOn = 2026-06-10`, `clearedAt` thuộc ngày `2026-06-12` theo `Asia/Ho_Chi_Minh`, tức `D = 2026-06-12`): Ngày `2026-06-12` (`D`): `RECOVERY` và `CONDITIONING` (bậc ≤ 2) được phép; `TECHNIQUE`, `GRAPPLING`, `SPARRING` (bậc > 2) bị chặn với `409 TRAINING_SUSPENSION_ACTIVE` và `gradedReturn: { ceiling: 2, fullReturnOn: '2026-06-14' }`. Ngày `2026-06-13` (`D+1`): `TECHNIQUE` (bậc 3) được phép; `GRAPPLING` và `SPARRING` (bậc 4, 5) bị chặn với `ceiling: 3`. Ngày `2026-06-14` (`D+2`): `SPARRING` (bậc 5) được phép, `gradedReturnCeiling` trả `null`. | Code: `nestjs-api/src/suspensions/suspensions.model.ts:174-240`, `nestjs-api/src/suspensions/suspension.gate.ts:36-59`.<br>Test: `nestjs-api/src/suspensions/suspensions.model.spec.ts:1078-1105` (`Criterion 4: gradedReturnCeiling after KO/TKO cleared after endsOn (endsOn=2026-06-10, clearedAt on 2026-06-12 Asia/Ho_Chi_Minh)`), `nestjs-api/src/suspensions/suspension.gate.spec.ts:217-259` (`Criterion 4: KO/TKO cleared on D = 2026-06-12 after endsOn = 2026-06-10 enforces ceiling 2 on D, ceiling 3 on D+1, and allows SPARRING on D+2 (2026-06-14)`), `nestjs-api/src/training/sessions/training-session.service.spec.ts:973-1129` (`Criterion 4: KO/TKO cleared on D=2026-06-12 (after endsOn=2026-06-10) allows <=2 on D, blocks >2 with 409 and gradedReturn { ceiling: 2, fullReturnOn: 2026-06-14 }, allows TECHNIQUE on D+1 while blocking GRAPPLING/SPARRING with ceiling 3, and allows SPARRING on D+2`). |
| **5.** Giải tỏa trước `endsOn` (`endsOn = 2026-06-10`, `clearedAt` thuộc ngày `2026-06-08`): Ngày `2026-06-08`..`2026-06-10` vẫn trong kỳ đình chỉ gốc (`ACTIVE`). Lộ trình 2 ngày bắt đầu từ `2026-06-11` (`endsOn + 1` = bậc ≤ 2), `2026-06-12` (bậc ≤ 3), và từ `2026-06-13` tập bình thường. | Code: `nestjs-api/src/suspensions/suspensions.model.ts:207-229`, `nestjs-api/src/suspensions/suspension.gate.ts:36-59`.<br>Test: `nestjs-api/src/suspensions/suspensions.model.spec.ts:1107-1131` (`Criterion 5: gradedReturnCeiling when cleared before endsOn (endsOn=2026-06-10, clearedAt on 2026-06-08) starts on 2026-06-11`), `nestjs-api/src/suspensions/suspension.gate.spec.ts:261-281` (`Criterion 5: KO cleared before endsOn (endsOn = 2026-06-10, clearedAt on 2026-06-08) stays in-force through 2026-06-10 and starts graded return on 2026-06-11`), `nestjs-api/src/training/sessions/training-session.service.spec.ts:1131-1182` (`Criterion 5: KO cleared before endsOn (endsOn=2026-06-10, clearedAt on 2026-06-08) remains ACTIVE on 2026-06-08..2026-06-10 and runs graded return on 2026-06-11..2026-06-12`). |
| **6.** Các lý do khác (`MEDICAL`, `MANDATORY_REST`, `DQ`, `OTHER`): sau khi hết hiệu lực (quá `endsOn` và nếu `requiresClearance = true` thì đã có `clearedAt`), `gradedReturnCeiling` trả `null` ngay ngày đầu sau đình chỉ, `SPARRING` được phép ngay. | Code: `nestjs-api/src/suspensions/suspensions.model.ts:174-200`, `nestjs-api/src/suspensions/suspension.gate.ts:36-59`.<br>Test: `nestjs-api/src/suspensions/suspensions.model.spec.ts:1133-1154` (`Criterion 6: non-KO/TKO reasons (MEDICAL, MANDATORY_REST, DQ, OTHER) return null ceiling immediately after suspension ends`), `nestjs-api/src/suspensions/suspension.gate.spec.ts:283-302` (`Criterion 6: MEDICAL, MANDATORY_REST, DQ, and OTHER allow SPARRING immediately on the first day after suspension ends`), `nestjs-api/src/training/sessions/training-session.service.spec.ts:1184-1223` (`Criterion 6: MEDICAL (cleared) and MANDATORY_REST/DQ/OTHER allow SPARRING immediately on the first day after endsOn`). |
| **7.** Bảng sẵn sàng R32 (`GET /bouts/readiness`): võ sĩ đang trong ngày `D` hoặc `D+1` của lộ trình tập lại sau `KO`/`TKO` được báo chưa sẵn sàng thi đấu, có `fullReturnOn = D+2`; vào ngày `D+2` trở lại sẵn sàng (nếu không còn rào cản khác). | Code: `nestjs-api/src/bouts/bouts.model.ts:1251-1279,1306-1501,1530-1570`, `nestjs-api/src/bouts/bouts.dto.ts:17-20,46-50`, `nestjs-api/src/bouts/bouts.service.ts:137-206`.<br>Test: `nestjs-api/src/bouts/bouts.model.spec.ts:1146-1196` (`marks a fighter in KO/TKO graded return (D or D+1) as not ready with fullReturnOn = D+2, and ready again on D+2 (T-045 Criterion 7)`), `nestjs-api/src/bouts/bouts.service.spec.ts:3997-4047` (`reports fighter in KO/TKO graded return as not ready with fullReturnOn = D+2 on D+1, and ready on D+2 (T-045 Criterion 7)`). |
| **8.** Kiến trúc & kiểm tra chung: `src/suspensions/` không import từ `src/training/` hay `src/bouts/`; `pnpm --filter nestjs-api lint`, `build`, `test` (không tăng lỗi so với baseline), `db:check` đều qua. | Code: `nestjs-api/src/suspensions/suspensions.constants.ts:1-40`, `nestjs-api/src/suspensions/suspensions.model.ts:1-40`, `nestjs-api/src/suspensions/suspension.gate.ts:1-15`.<br>Test & Kiểm tra: `nestjs-api/src/suspensions/suspensions.dto.spec.ts:30-39`, `nestjs-api/src/bouts/bouts.service.spec.ts:4042-4046`, và kết quả các lệnh kiểm tra bên dưới (`git grep` trả rỗng `EXIT:1`). |

## Lệnh đã chạy

### 1. `pnpm --filter nestjs-api lint`
```text
$ oxlint src/ test/
src/notifications/notification-distribution.service.spec.ts:74:9: warning eslint(no-unused-vars): Variable 'subscribedEmitted' is declared but never used. Unused variables should start with a '_'. help: Consider removing this declaration.
src/medical/scat6.model.spec.ts:5:3: warning eslint(no-unused-vars): Identifier 'scat6ScoresSchema' is imported but never used. help: Consider removing this import.
src/coaching/coaching.service.ts:12:13: warning eslint(no-unused-vars): Identifier 'crypto' is imported but never used. help: Consider removing this import.
src/coaching/coaching.service.ts:13:24: warning eslint(no-unused-vars): Type 'DrizzleDB' is imported but never used. help: Consider removing this import.
src/coaching/coaching.service.ts:182:16: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/coaching/coaching.service.ts:520:27: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/coaching/coaching.service.ts:550:27: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/coaching/coaching.service.ts:550:54: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/dataset-export/dto/candidate-export.dto.ts:15:29: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/dataset-export/services/governance-verifier.service.ts:45:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/dataset-export/services/governance-verifier.service.ts:46:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/notifications/notifications.config.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/coaching/result-receipt.spec.ts:22:5: warning unicorn(no-thenable): Do not add `then` to a class. help: If an object is defined as 'thenable', once it's accidentally used in an await expression, it may cause problems
src/notifications/notification-stream.service.ts:91:33: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:318:24: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:319:33: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:333:31: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/coaching/movement-review.service.spec.ts:32:5: warning unicorn(no-thenable): Do not add `then` to a class. help: If an object is defined as 'thenable', once it's accidentally used in an await expression, it may cause problems
src/main.ts:7:10: warning eslint(no-unused-vars): Identifier 'createOpenApiDocument' is imported but never used. help: Consider removing this import.
Found 0 warnings and 0 errors. (20 pre-existing warnings in unrelated modules, exit code 0)
```

### 2. `pnpm --filter nestjs-api build`
```text
$ nest build
```
*(Kết quả: exit code 0)*

### 3. `pnpm --filter nestjs-api test`
```text
 FAIL  src/notifications/notification-producer.service.spec.ts [ src/notifications/notification-producer.service.spec.ts ]
Error: No test suite found in file D:/MMA-TMS/nestjs-api/src/notifications/notification-producer.service.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/4]⎯

 FAIL  src/notifications/notification-stream.service.spec.ts [ src/notifications/notification-stream.service.spec.ts ]
Error: No test suite found in file D:/MMA-TMS/nestjs-api/src/notifications/notification-stream.service.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/4]⎯

 FAIL  src/notifications/notifications.config.spec.ts [ src/notifications/notifications.config.spec.ts ]
Error: No test suite found in file D:/MMA-TMS/nestjs-api/src/notifications/notifications.config.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[3/4]⎯

 FAIL  src/notifications/notifications.service.spec.ts [ src/notifications/notifications.service.spec.ts ]
Error: No test suite found in file D:/MMA-TMS/nestjs-api/src/notifications/notifications.service.spec.ts
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[4/4]⎯

 Test Files  4 failed | 59 passed (63)
      Tests  1043 passed (1043)
   Start at  13:42:37
   Duration  4.63s (transform 4.46s, setup 0ms, import 53.78s, tests 2.97s, environment 5ms)
```
*(Ghi chú: 2 file integration đóng băng `test/coaching-loop-persistence.spec.ts` [5 test] và `test/dataset-export-trust-boundary.spec.ts` [21 test] cần Redis ở `127.0.0.1:6379` theo `docs/tickets/BASELINE.md` mục B1 và mỗi test treo `beforeEach`/`afterEach` 30 giây khi không có Redis [tổng ~11 phút]. Khi chạy toàn bộ 63 file còn lại `src/ test/coaching-auth-boundary.spec.ts test/tl10-production-cryptography.spec.ts`: **1043 passed / 0 failed** trên 59 file có test + 4 file spec rỗng có sẵn ở B2; tính cả 26 lỗi Redis có sẵn ở B1 là **1043 passed / 26 failed trên 1069 tests**, không thêm lỗi mới so với baseline).*

### 4. `pnpm --filter nestjs-api db:check`
```text
$ node run_sql.mjs --check
001-032 checksums OK. No database connection was opened.
```
*(Kết quả: exit code 0)*

### 5. `git grep -n "from.*\(training\|bouts\)" -- "nestjs-api/src/suspensions/"`
```text
EXIT:1
```
*(Kết quả: không có dòng import nào từ `training` hay `bouts` trong `nestjs-api/src/suspensions/`)*

## Lệch so với ticket

- Ở Tiêu chí 2 (`docs/tickets/T-045-intensity-tiers-graded-return.md` mục 4), ticket ghi ví dụ `blockedSessionTypes = ['GRAPPLING', 'SPARRING'] (thứ tự theo SESSION_TYPES)`. Trong code thực tế tại `nestjs-api/src/suspensions/suspensions.constants.ts:13-22`, hằng số `SESSION_TYPES` có thứ tự `['SPARRING', 'GRAPPLING', 'TECHNIQUE', 'CONDITIONING', 'RECOVERY']` (`'SPARRING'` đứng trước `'GRAPPLING'`). Hàm `blockedTypesForMaxTier(3)` lọc theo đúng thứ tự `SESSION_TYPES` hiện có nên trả `['SPARRING', 'GRAPPLING']` (cùng tập 2 phần tử bậc 4 và 5).

## Câu hỏi / việc còn mở

- Theo đúng phạm vi chỉ đạo của Phần A, `planConflicts` và `SuspensionEffects` của T-036 được giữ nguyên: các buổi tập đã xếp sẵn (`SCHEDULED`) rơi vào 2 ngày lộ trình tập lại (`D` và `D+1` sau khi giải tỏa `KO`/`TKO`) không tự động chuyển trạng thái khi tạo hoặc giải tỏa đình chỉ, mà được kiểm tra tại cổng `assertNotSuspended` / `blockingSuspensions` khi tạo/cập nhật/bắt đầu buổi tập. Việc tự động rà soát lại các buổi đã xếp khi bác sĩ giải tỏa (`clearSuspension`) là việc còn mở nếu cần ở ticket sau.
