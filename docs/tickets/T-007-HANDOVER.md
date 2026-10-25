# T-007 Handover

## Round A

- Nhánh: `User_Feature` (để nguyên các thay đổi uncommitted trên working tree theo chỉ định).
- Phạm vi Round A: Migration `025_suspensions.sql` và đăng ký đầy đủ, Drizzle schema (`schema.ts`) + `NOTIFICATION_TYPE` (`notification.contract.ts`), module mới `nestjs-api/src/suspensions/` (`GET /suspensions`, `POST /suspensions`, `POST /suspensions/:id/clear`) đăng ký trong `app.module.ts`, cùng bộ unit test và migration test. Chưa chạm `bouts`, `training`, `nextjs-frontend`, `reactnative-mobile` (thuộc các round tiếp theo).

### Thay đổi

- `nestjs-api/migrations/025_suspensions.sql`:
  - Advisory lock `pg_advisory_xact_lock(20260916, 25)`; preflight yêu cầu ledger `version = 24`, từ chối nếu đã có `version = 25`, kiểm tra sự tồn tại của `public.fighters`, `public.bouts`, `public.users`, `public.session_type`, `public.notification_type`, `public.update_updated_at()`, `mma_private.audit_domain_mutation()`, và kiểm tra collision trên `public.suspension_reason`, `public.suspensions` cũng như 3 quyền `suspension:*`.
  - Tạo enum `public.suspension_reason` (`KO`, `TKO`, `DQ`, `MANDATORY_REST`, `MEDICAL`, `OTHER`).
  - Tạo bảng `public.suspensions` theo đúng Tech spec §2.5 cùng 3 ràng buộc `ck_suspensions_loss_of_consciousness`, `ck_suspensions_dates` (`ends_on >= starts_on`), `ck_suspensions_cleared` (`(cleared_at IS NULL) = (cleared_by_id IS NULL)`) và chỉ mục `idx_suspensions_fighter_active (fighter_id, ends_on) WHERE deleted_at IS NULL`.
  - Tạo trigger `trg_suspensions_updated_at` (`public.update_updated_at()`) và `trg_suspensions_audit` (`mma_private.audit_domain_mutation()`). Bật RLS và `REVOKE ALL ON public.suspensions FROM PUBLIC, anon, authenticated`.
  - Seed quyền: `suspension:read` (`FIGHTER`, `COACH`, `DOCTOR`, `ADMIN`), `suspension:create` (`COACH`, `DOCTOR`, `ADMIN`), `suspension:clear` (`COACH`, `DOCTOR`; `ADMIN` không được cấp quyền này).
  - Thêm 7 giá trị vào `public.notification_type` (`BOUT_CREATED`, `BOUT_WEIGHT_AT_RISK`, `BOUT_REQUIREMENT_REJECTED`, `BOUT_REQUIREMENT_DUE`, `BOUT_WEIGHT_MISSING`, `SUSPENSION_CREATED`, `SUSPENSION_AWAITING_CLEARANCE`), chỉ thêm chứ không dùng làm literal trong cùng transaction.
- Đăng ký migration 025:
  - `nestjs-api/scripts/migration-files.mjs`: thêm `'025_suspensions.sql'`.
  - `nestjs-api/migrations/manifest.json`: thêm SHA-256 LF cho `025_suspensions.sql`.
  - `nestjs-api/run_sql.mjs`: thêm `--apply-025`.
  - `nestjs-api/package.json`: thêm script `"db:migrate:025": "node run_sql.mjs --apply-025"`.
  - `nestjs-api/migrations/README.md`: bổ sung mục mô tả migration 025.
  - `nestjs-api/scripts/test-migrations.mjs`: thêm 2 ca kiểm tra cho 025 (áp dụng trên ledger 24, kiểm enum/bảng/ràng buộc/quyền/notification_type/triggers/RLS/reapply và kiểm thiếu ledger 24 + collision).
- `nestjs-api/src/database/schema.ts` & `nestjs-api/src/shared/contracts/notification.contract.ts`:
  - Thêm 7 giá trị mới vào `notificationTypeEnum` và `NOTIFICATION_TYPE` (không làm gãy exhaustive check/switch nào ở backend, frontend hay mobile).
  - Thêm `suspensionReasonEnum`, bảng `suspensions`, `SuspensionRow`, `InsertSuspension` khớp với `025_suspensions.sql`.
- `nestjs-api/src/suspensions/` & `nestjs-api/src/app.module.ts`:
  - `suspensions.model.ts`: dùng lại `academyDateOf`, `addDaysToDate`, `daysBetweenDates`, `LOSS_OF_CONSCIOUSNESS_VALUES` từ `src/bouts/bouts.model.ts`; cài đặt các hàm thuần `suspensionStatusOn`, `isInForceOn`, `endsOnFor`, `deriveRequiresClearance`, mã hoá/giải mã cursor và các Zod schema.
  - `suspensions.constants.ts`, `suspensions.error.ts` (chỉ thêm `SUSPENSION_NOT_FOUND` 404 và `SUSPENSION_ALREADY_CLEARED` 409), `suspensions.dto.ts`, `suspensions.repo.ts`, `suspensions.service.ts`, `suspensions.controller.ts`, `suspensions.module.ts` (chỉ import `DatabaseModule`, export `SuspensionsRepository` và `SuspensionsService`).
  - Bộ unit test: `suspensions.model.spec.ts`, `suspensions.service.spec.ts`, `suspensions.controller.spec.ts`.

### Đối chiếu tiêu chí nghiệm thu

| Tiêu chí (theo ticket, phạm vi Round A) | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| 1 — Đình chỉ cần xác nhận kết thúc ngày D: ngày D là `ACTIVE`; D+1 là `AWAITING_CLEARANCE`; sau khi xác nhận là `ENDED` | Đạt: `nestjs-api/src/suspensions/suspensions.model.ts:69`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:35`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:51`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:65`. |
| 2 — `MANDATORY_REST` qua ngày kết thúc: tự `ENDED` | Đạt: `nestjs-api/src/suspensions/suspensions.model.ts:69`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:59`. |
| 6 — `requires_clearance` suy từ lý do đúng bảng quyết định 2; `KO`/`TKO` gửi `false` bị từ chối; `DQ`/`MANDATORY_REST` gửi `true` bị từ chối | Đạt: `nestjs-api/src/suspensions/suspensions.model.ts:106`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:90`, `nestjs-api/src/suspensions/suspensions.service.spec.ts:313`. |
| 7a — Tạo thủ công: `startsOn` hôm qua → 422; `startsOn` hôm nay, `days = 30` → `endsOn = startsOn + 29`; `startsOn` tương lai → `UPCOMING` | Đạt: `nestjs-api/src/suspensions/suspensions.model.ts:192`, `nestjs-api/src/suspensions/suspensions.service.ts:65`, `nestjs-api/src/suspensions/suspensions.service.spec.ts:242`, `nestjs-api/src/suspensions/suspensions.service.spec.ts:278`. (Phần Cổng 2 chặn buổi tập sẽ nối ở Round B/C). |
| 7b & 7 — Kết thúc sớm / `/clear`: xác nhận trước hoặc sau `ends_on` thành công với `clearanceNote` (không đổi `ends_on`), chuyển `ENDED`; thiếu `clearanceNote` → 422; xác nhận lần hai → 409 `SUSPENSION_ALREADY_CLEARED`; không tồn tại → 404 `SUSPENSION_NOT_FOUND`; `ADMIN` hoặc `FIGHTER` hoặc `COACH`/`DOCTOR` ngoài phân công → 403 | Đạt: `nestjs-api/src/suspensions/suspensions.service.ts:127`, `nestjs-api/src/suspensions/suspensions.service.spec.ts:415`, `nestjs-api/src/suspensions/suspensions.service.spec.ts:452`, `nestjs-api/src/suspensions/suspensions.service.spec.ts:491`, `nestjs-api/src/suspensions/suspensions.service.spec.ts:523`, `nestjs-api/src/suspensions/suspensions.controller.spec.ts:62`. |
| 8 — Võ sĩ chỉ đọc đình chỉ của mình; HLV chỉ thấy võ sĩ được phân công; bác sĩ qua `doctor_fighters`; Admin thấy tất cả | Đạt: `nestjs-api/src/suspensions/suspensions.service.ts:175`, `nestjs-api/src/suspensions/suspensions.repo.ts:154`, `nestjs-api/src/suspensions/suspensions.service.spec.ts:144`. |
| 16 — Ca migration mới trong `scripts/test-migrations.mjs` cho 025 | Đạt: `nestjs-api/migrations/025_suspensions.sql:1`, `nestjs-api/scripts/test-migrations.mjs:906`, `nestjs-api/scripts/test-migrations.mjs:974`. |
| 3, 4, 5, 9, 10, 11, 12, 13, 14, 15 | Chưa làm trong Round A (thuộc các round tiếp theo theo chỉ định). |

### Lệnh đã chạy

#### `pnpm --filter nestjs-api lint`

Exit 0. Không có cảnh báo hay lỗi nào ở các file của Round A; cuối output nguyên văn:

```text
test/coaching-loop-persistence.spec.ts:19:3: warning eslint(no-unused-vars): Identifier 'fighterBaselines' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:20:3: warning eslint(no-unused-vars): Identifier 'auditLogs' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:21:3: warning eslint(no-unused-vars): Identifier 'actionAssessments' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:22:3: warning eslint(no-unused-vars): Identifier 'actionFindingReviews' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:23:3: warning eslint(no-unused-vars): Identifier 'techniqueReferences' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:25:14: warning eslint(no-unused-vars): Identifier 'and' is imported but never used. help: Consider removing this import.
src/coaching/movement-review.service.spec.ts:32:5: warning unicorn(no-thenable): Do not add `then` to a class. help: If an object is defined as 'thenable', once it's accidentally used in an await expression, it may cause problems
```

#### `pnpm --filter nestjs-api build`

Exit 0. Nguyên văn output:

```text
$ nest build
```

#### `pnpm --filter nestjs-api test`

Exit 1 (đúng baseline: 6 file lỗi gồm 4 file spec rỗng trong `src/notifications/` và 2 file integration `test/coaching-loop-persistence.spec.ts`, `test/dataset-export-trust-boundary.spec.ts` cần `SUPABASE_URL`/Redis; toàn bộ 33/33 test mới trong `src/suspensions/` và các file unit test khác đều PASS, tổng cộng 55 file PASS / 918 test PASS). Cuối output nguyên văn:

```text
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/31]⎯


 Test Files  6 failed | 55 passed (61)
      Tests  26 failed | 918 passed (944)
   Start at  12:26:49
   Duration  706.26s (transform 5.58s, setup 0ms, import 124.83s, tests 782.41s, environment 7ms)

[ELIFECYCLE] Test failed. See above for more details.
Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL

  × "pnpm recursive run" failed in D:\MMA-TMS\nestjs-api
```

Kiểm tra riêng module `suspensions` (`pnpm --filter nestjs-api exec vitest run src/suspensions`):

```text
 RUN  v4.1.11 D:/MMA-TMS/nestjs-api


 Test Files  3 passed (3)
      Tests  33 passed (33)
   Start at  12:38:59
   Duration  980ms (transform 211ms, setup 0ms, import 1.63s, tests 36ms, environment 0ms)
```

#### `pnpm --filter nestjs-api test:db`

Exit 0 (45/45 nhóm kiểm tra PASS, bao gồm 2 nhóm mới của 025). Cuối output nguyên văn:

```text
PASS 024 applies on ledger 23, seeds three presets and wires bouts, requirements and permissions
PASS 024 requires ledger 23 and leaves nothing behind on a collision
PASS 027 applies directly after 024: defaults, constraints, upsert, audit, cascade and RLS
PASS 025 applies on ledger 24: enum, table, constraints, permissions, notifications, triggers and RLS
PASS 025 rejects missing ledger 24 and collisions atomically
PASS 027 rejects missing ledger 24 and collisions atomically
PASS 005 rejects a pre-existing milestones column without writing history
PASS 006 rejects a database without migration 005 history
PASS 006 rejects a permission collision without partial inserts
PASS 003 preserves nonempty legacy data without coercion
PASS old insert/update contract still works
PASS reapplying 003 fails safely
PASS baseline drift aborts before domain DDL
PASS partial domain collision rolls back all new objects
PASS domain integrity and RLS role matrix
PASS fresh clinical schema through 011
PASS 012 rejects a concurrently committed clearance and rolls back DDL/ledger
PASS 012 proceeds after a concurrent issuer rolls back; no orphan revision
PASS 012 orders identical created_at values by server issuance sequence
PASS 012 rejects reapplication without changing the applied ledger
Migration checks passed: 45. PostgreSQL stopped after tests. Scratch: C:\Users\PC\AppData\Local\Temp\mma-migrations-Mcstne
```

#### `pnpm --filter nestjs-api db:check`

Exit 0. Nguyên văn output:

```text
$ node run_sql.mjs --check
001-027 checksums OK. No database connection was opened.
```

### Lệch so với ticket

- Chỉ thực hiện phạm vi **Round A** (migration 025, Drizzle schema + notification enum, module `SuspensionsModule` với `GET /suspensions`, `POST /suspensions`, `POST /suspensions/:id/clear` và các hàm thuần cơ sở). Các phần Cổng 2 (`training`), xung đột buổi tập R28, bảng sẵn sàng R32, cảnh báo R4 khi tạo trận và tự tạo đình chỉ khi ghi kết quả R27 thuộc các round B–D tiếp theo.
- Các quyết định đã chốt ở Q1, Q2, Q3, Q5 được áp dụng:
  - `POST /suspensions` nhận `days` (1..365) và `startsOn?` (mặc định hôm nay theo lịch học viện, không được trước hôm nay, có thể ở tương lai), tính `endsOn = startsOn + days - 1`.
  - `POST /suspensions/:id/clear` cho phép `COACH` hoặc `DOCTOR` được phân công kết thúc sớm hoặc xác nhận sau khi hết hạn đối với mọi lý do (kể cả `KO`/`TKO`/`MEDICAL` và cả khi `requires_clearance = false`), miễn `cleared_at IS NULL`, bắt buộc `clearanceNote` (3–500 ký tự sau trim), giữ nguyên `ends_on`. `ADMIN` không có quyền `suspension:clear` và bị chặn 403 ở cả tầng service.
  - Mã lỗi mới trong Round A chỉ gồm `SUSPENSION_NOT_FOUND` (404) và `SUSPENSION_ALREADY_CLEARED` (409).

### Câu hỏi / việc còn mở

- Không có câu hỏi tồn đọng cho Round A. Sẵn sàng chuyển sang Round B.

---

## Round B

- Nhánh: `User_Feature` (để nguyên các thay đổi uncommitted trên working tree theo chỉ định).
- Phạm vi Round B: Cổng 2 trong training (`SuspensionGate` trong `src/suspensions/`, mã lỗi `TRAINING_SUSPENSION_ACTIVE` và mở rộng `trainingMedicalEligibilityRequired` trong `src/training/training.error.ts`, tích hợp Cổng 2 vào `createSession`, `updateSession`, `updateSessionStatus` trong `src/training/sessions/training-session.service.ts`, import `SuspensionsModule` vào `TrainingModule`, cùng bộ unit test đầy đủ cho `SuspensionGate` và `TrainingSessionService`).

### Thay đổi

- `nestjs-api/src/suspensions/suspensions.model.ts`:
  - Khai báo `BlockingSuspension` (`{ suspensionId, reason, endsOn, requiresClearance }`).
- `nestjs-api/src/suspensions/suspensions.repo.ts`:
  - Thêm `findSuspensionsByFighterId(fighterId, database?)`: truy vấn một câu lấy các bản ghi `suspensions` chưa xoá mềm (`deleted_at IS NULL`) của võ sĩ, nhận `DatabaseExecutor` để gọi được bên trong transaction của `TrainingSessionService`.
- `nestjs-api/src/suspensions/suspension.gate.ts` & `nestjs-api/src/suspensions/suspensions.module.ts`:
  - Thêm provider `SuspensionGate` và export từ `SuspensionsModule` (module này chỉ import `DatabaseModule`, không tạo phụ thuộc vòng với `TrainingModule` hay `BoutsModule`).
  - `blockingSuspensions(fighterId, sessionType, at, database?)` tính ngày học viện qua `academyDateOf(at)`, dùng `isInForceOn(row, date)` từ Round A (đình chỉ đang ở trạng thái `AWAITING_CLEARANCE` vẫn chặn; đình chỉ đã `cleared_at IS NOT NULL` không bao giờ chặn; đình chỉ `UPCOMING` chưa tới `starts_on` chưa chặn) và kiểm tra `row.blockedSessionTypes.includes(sessionType)`.
- `nestjs-api/src/training/training.error.ts`:
  - Thêm `trainingSuspensionActive(suspensions)` trả 409 `TRAINING_SUSPENSION_ACTIVE` kèm `details: { suspensions }`.
  - Mở rộng `trainingMedicalEligibilityRequired(reasons, suspensions?)`: khi chỉ medical gate chặn thì giữ nguyên `details: { reasons }`; khi cả medical gate và suspension gate cùng chặn thì giữ mã `TRAINING_MEDICAL_ELIGIBILITY_REQUIRED` và trả `details: { reasons, suspensions }`.
- `nestjs-api/src/training/sessions/training-session.service.ts` & `nestjs-api/src/training/training.module.ts`:
  - Import `SuspensionsModule` vào `TrainingModule`.
  - `createSession`: gọi Cổng 2 (`assertNotSuspended`) với `(data.fighterId, data.sessionType, new Date(data.scheduledAt))` trước khi insert. Không bọc thêm transaction ở `createSession`; cổng khi bắt đầu buổi tập (`updateSessionStatus` sang `IN_PROGRESS`, chạy trong transaction kèm khoá dòng) là lớp chặn thứ hai, nên nếu có đình chỉ phát sinh xen giữa lúc kiểm tra và lúc insert khi tạo buổi thì buổi tập vẫn bị chặn khi bắt đầu.
  - `updateSession`: trong transaction sẵn có (sau khi `lockSessionById`), khi `sessionType` hoặc `scheduledAt` thay đổi, tính giá trị hiệu lực (`data.x ?? locked.x`) và gọi `assertNotSuspended(..., transaction)`. Giữ nguyên kiểm tra medical cho buổi đang `IN_PROGRESS` đổi `sessionType`.
  - `updateSessionStatus`: khi chuyển sang `IN_PROGRESS` (trong transaction sẵn có), gọi phương thức `assertEligibleAndNotSuspended(locked.fighterId, locked.sessionType, new Date(locked.scheduledAt), transaction)` để chạy độc lập cả hai cổng và trả đúng lỗi (chỉ medical -> `TRAINING_MEDICAL_ELIGIBILITY_REQUIRED`, chỉ đình chỉ -> `TRAINING_SUSPENSION_ACTIVE`, cả hai -> `TRAINING_MEDICAL_ELIGIBILITY_REQUIRED` kèm cả `reasons` và `suspensions`). Các chuyển trạng thái khác (`CANCELLED`, `COMPLETED`, `ABANDONED`, `SKIPPED`) không bị chặn.
- Unit test mới:
  - `nestjs-api/src/suspensions/suspension.gate.spec.ts`: 6 test kiểm tra ranh giới ngày thứ 10, đúng ngày `ends_on`, trước `starts_on` (`UPCOMING`), loại buổi không bị chặn (`PAD_WORK`), qua `ends_on` nhưng chưa xác nhận (`AWAITING_CLEARANCE`), đã xác nhận (sau `ends_on` và kết thúc sớm trước `ends_on`), `MANDATORY_REST` tự hết sau `ends_on`, bỏ qua dòng xoá mềm, truyền transaction executor, múi giờ `Asia/Ho_Chi_Minh`, và SQL boundary của `findSuspensionsByFighterId`.
  - `nestjs-api/src/training/sessions/training-session.service.spec.ts`: giữ nguyên 53 test cũ và thêm 7 test cho Cổng 2 (tiêu chí 7a, 7b, 9, 10, 11).

### Đối chiếu tiêu chí nghiệm thu (phạm vi Round B)

| Tiêu chí (theo ticket) | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| 7a (phần Cổng 2) — Đình chỉ `startsOn` tương lai (`UPCOMING`) không chặn `SPARRING` trước ngày bắt đầu, chặn từ `startsOn` | Đạt: `nestjs-api/src/suspensions/suspension.gate.ts:21`, `nestjs-api/src/suspensions/suspension.gate.spec.ts:82`, `nestjs-api/src/training/sessions/training-session.service.spec.ts:921`. |
| 7b (phần Cổng 2) — Sau khi kết thúc sớm trước `ends_on`, Cổng 2 không còn chặn | Đạt: `nestjs-api/src/suspensions/suspension.gate.spec.ts:127`, `nestjs-api/src/training/sessions/training-session.service.spec.ts:960`. |
| 9 — Thua KO, đình chỉ 45 ngày: xếp `SPARRING` ngày thứ 10 bị 409 `TRAINING_SUSPENSION_ACTIVE`, xếp `PAD_WORK` được; qua `ends_on` chưa xác nhận vẫn không xếp được `SPARRING`; sau khi xác nhận xếp được | Đạt: `nestjs-api/src/training/sessions/training-session.service.ts:112`, `nestjs-api/src/suspensions/suspension.gate.spec.ts:39`, `nestjs-api/src/suspensions/suspension.gate.spec.ts:89`, `nestjs-api/src/training/sessions/training-session.service.spec.ts:817`, `nestjs-api/src/training/sessions/training-session.service.spec.ts:871`. |
| 10 — Cổng 2 ở `updateSession` (đổi `sessionType` sang `SPARRING` hoặc đổi `scheduledAt` vào khoảng đình chỉ → 409) và `updateSessionStatus` sang `IN_PROGRESS` (→ 409 cùng mã); huỷ/dừng/bỏ buổi không bị chặn | Đạt: `nestjs-api/src/training/sessions/training-session.service.ts:164`, `nestjs-api/src/training/sessions/training-session.service.ts:267`, `nestjs-api/src/training/sessions/training-session.service.spec.ts:987`, `nestjs-api/src/training/sessions/training-session.service.spec.ts:1072`, `nestjs-api/src/training/sessions/training-session.service.spec.ts:1104`. |
| 11 — Võ sĩ vừa chưa đủ điều kiện y tế vừa bị đình chỉ: trả 409 `TRAINING_MEDICAL_ELIGIBILITY_REQUIRED` kèm cả `details.reasons` và `details.suspensions` | Đạt: `nestjs-api/src/training/training.error.ts:147`, `nestjs-api/src/training/sessions/training-session.service.ts:369`, `nestjs-api/src/training/sessions/training-session.service.spec.ts:1021`. |

### Lệnh đã chạy

#### `pnpm --filter nestjs-api lint`

Exit 0. Không có cảnh báo hay lỗi ở bất kỳ file nào thuộc Round A và Round B; cuối output nguyên văn:

```text
test/coaching-loop-persistence.spec.ts:19:3: warning eslint(no-unused-vars): Identifier 'fighterBaselines' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:20:3: warning eslint(no-unused-vars): Identifier 'auditLogs' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:21:3: warning eslint(no-unused-vars): Identifier 'actionAssessments' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:22:3: warning eslint(no-unused-vars): Identifier 'actionFindingReviews' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:23:3: warning eslint(no-unused-vars): Identifier 'techniqueReferences' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:25:14: warning eslint(no-unused-vars): Identifier 'and' is imported but never used. help: Consider removing this import.
src/medical/scat6.model.spec.ts:5:3: warning eslint(no-unused-vars): Identifier 'scat6ScoresSchema' is imported but never used. help: Consider removing this import.
```

#### `pnpm --filter nestjs-api build`

Exit 0. Nguyên văn output:

```text
$ nest build
```

#### `pnpm --filter nestjs-api test`

Exit 1 (đúng baseline: 6 file lỗi gồm 4 file spec rỗng trong `src/notifications/` và 2 file integration `test/coaching-loop-persistence.spec.ts`, `test/dataset-export-trust-boundary.spec.ts` cần `SUPABASE_URL`/Redis; toàn bộ 56 file unit test khác đều PASS với 931/931 test PASS, tăng thêm 1 file và 13 test mới so với Round A). Cuối output nguyên văn:

```text
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/31]⎯


 Test Files  6 failed | 56 passed (62)
      Tests  26 failed | 931 passed (957)
   Start at  17:03:34
   Duration  692.61s (transform 4.87s, setup 0ms, import 56.27s, tests 770.11s, environment 6ms)

[ELIFECYCLE] Test failed. See above for more details.
Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL

  × "pnpm recursive run" failed in D:\MMA-TMS\nestjs-api
```

Kiểm tra riêng `src/suspensions` và `src/training` (`pnpm --filter nestjs-api exec vitest run src/suspensions src/training`):

```text
 RUN  v4.1.11 D:/MMA-TMS/nestjs-api


 Test Files  9 passed (9)
      Tests  205 passed (205)
   Start at  17:03:08
   Duration  1.28s (transform 682ms, setup 0ms, import 5.68s, tests 488ms, environment 1ms)
```

#### `pnpm --filter nestjs-api test:db`

Exit 0 (45/45 nhóm kiểm tra PASS). Cuối output nguyên văn:

```text
PASS 024 applies on ledger 23, seeds three presets and wires bouts, requirements and permissions
PASS 024 requires ledger 23 and leaves nothing behind on a collision
PASS 027 applies directly after 024: defaults, constraints, upsert, audit, cascade and RLS
PASS 025 applies on ledger 24: enum, table, constraints, permissions, notifications, triggers and RLS
PASS 025 rejects missing ledger 24 and collisions atomically
PASS 027 rejects missing ledger 24 and collisions atomically
PASS 005 rejects a pre-existing milestones column without writing history
PASS 006 rejects a database without migration 005 history
PASS 006 rejects a permission collision without partial inserts
PASS 003 preserves nonempty legacy data without coercion
PASS old insert/update contract still works
PASS reapplying 003 fails safely
PASS baseline drift aborts before domain DDL
PASS partial domain collision rolls back all new objects
PASS domain integrity and RLS role matrix
PASS fresh clinical schema through 011
PASS 012 rejects a concurrently committed clearance and rolls back DDL/ledger
PASS 012 proceeds after a concurrent issuer rolls back; no orphan revision
PASS 012 orders identical created_at values by server issuance sequence
PASS 012 rejects reapplication without changing the applied ledger
Migration checks passed: 45. PostgreSQL stopped after tests. Scratch: C:\Users\PC\AppData\Local\Temp\mma-migrations-IT4ijb
```

#### `pnpm --filter nestjs-api db:check`

Exit 0. Nguyên văn output:

```text
$ node run_sql.mjs --check
001-027 checksums OK. No database connection was opened.
```

### Lệch so với ticket

- **Lý do `createSession` không bọc transaction (Quyết định 6 trong ticket):** `createSession` kiểm tra `assertNotSuspended` trước khi insert mà không mở transaction bọc quanh; cổng bắt đầu buổi tập (`updateSessionStatus` chuyển sang `IN_PROGRESS`) nằm bên trong transaction kèm khoá dòng là lớp chặn thứ hai, nên nếu một đình chỉ được tạo xen giữa lúc kiểm tra và lúc insert ở `createSession` thì buổi tập vẫn bị chặn khi bắt đầu.
- **Cấu trúc module (Quyết định chốt 25/10 trong mục 3 của ticket):** thay vì đặt `SuspensionGate` trong `BoutsModule` và cho `TrainingModule` import `BoutsModule` như ghi chú cũ, `SuspensionGate` được đặt tại `SuspensionsModule` (chỉ phụ thuộc `DatabaseModule`). `TrainingModule` import `SuspensionsModule`; `SuspensionsModule` không import `TrainingModule` hay `BoutsModule`, và `TrainingModule` không import `BoutsModule`.
- **Mã lỗi khi cả hai cổng cùng chặn (Quyết định chốt 25/10 trong mục 3 của ticket):** khi chỉ medical gate chặn thì trả `TRAINING_MEDICAL_ELIGIBILITY_REQUIRED` với `details: { reasons }`; khi chỉ suspension gate chặn thì trả `TRAINING_SUSPENSION_ACTIVE` với `details: { suspensions }`; khi cả hai cùng chặn thì giữ mã `TRAINING_MEDICAL_ELIGIBILITY_REQUIRED` và gộp `details: { reasons, suspensions }` để tương thích ngược với client hiện có.

### Câu hỏi / việc còn mở

- Không có câu hỏi tồn đọng cho Round B. Sẵn sàng chuyển sang Round C.
