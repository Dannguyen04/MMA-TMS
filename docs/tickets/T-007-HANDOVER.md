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

---

## Round C

- Nhánh: `User_Feature` (để nguyên các thay đổi uncommitted trên working tree theo chỉ định).
- Phạm vi Round C: Xử lý xung đột lịch tập với đình chỉ theo quy tắc R28 — hàm thuần `planConflicts(sessions, suspensions)` trong `src/suspensions/suspensions.model.ts`, cùng controller và service mới trong `src/training/` (`GET /suspensions/:id/conflicts` và `POST /suspensions/:id/conflicts/apply`), đăng ký trong `training.module.ts`, và bộ unit test đầy đủ.

### Thay đổi

- `nestjs-api/src/suspensions/suspensions.model.ts` & `nestjs-api/src/suspensions/suspensions.dto.ts`:
  - Khai báo `CONFLICT_ACTIONS` (`CHANGE_TYPE`, `RESCHEDULE`, `CANCEL`), `ConflictAction`, `ConflictProposal` (`{ sessionId, action, toType?, toScheduledAt? }`), `ConflictSessionInput`, `ConflictSuspensionInput`, cùng schema `applySuspensionConflictsSchema` (`{ sessionIds: uuid[] }` không trùng lặp), `conflictProposalResponseSchema` và các DTO `ApplySuspensionConflictsDto`, `ConflictProposalResponseDto`.
  - Cài đặt hàm thuần `planConflicts(sessions, suspensions)` theo đúng quy tắc R28:
    - Bỏ qua các đình chỉ đã xoá mềm (`deletedAt !== null`) và các buổi tập không ở trạng thái `SCHEDULED` hoặc đã xoá mềm.
    - Xét ngày học viện (`academyDateOf`) của buổi tập; tìm mọi đình chỉ đang có hiệu lực (`isInForceOn(s, sessionDate)`) chặn loại buổi tập đó.
    - (1) Nếu `RECOVERY` không bị bất kỳ đình chỉ đang có hiệu lực nào chặn trong ngày đó → đề xuất `{ sessionId, action: 'CHANGE_TYPE', toType: 'RECOVERY' }`.
    - (2) Ngược lại, nếu mọi đình chỉ đang chặn buổi tập đều có ngày kết thúc cố định (`requiresClearance = false`) → dời sang ngày đầu tiên sau `ends_on` muộn nhất (`latestEndsOn + 1`, đồng thời vượt qua các đình chỉ cố định kế tiếp nếu có để luôn qua Cổng 2; nếu đụng đình chỉ `requiresClearance = true` thì chuyển sang `CANCEL`), giữ nguyên giờ trong ngày theo múi giờ học viện (`action: 'RESCHEDULE', toScheduledAt: Date`).
    - (3) Ngược lại (có ít nhất một đình chỉ chặn buổi tập cần xác nhận y tế `requiresClearance = true`) → đề xuất `{ sessionId, action: 'CANCEL' }`.
- `nestjs-api/src/training/`:
  - `training.constants.ts`: thêm hằng số `SUSPENSION_CONFLICT_CANCELLATION_REASON = 'Suspension in force'`.
  - `training.model.ts` & `training.dto.ts`: re-export schema và DTO xung đột lịch tập để dùng thống nhất trong `training`.
  - `training.repo.ts`: thêm phương thức bổ trợ `findScheduledSessionsByFighterId(fighterId, database?)` lấy toàn bộ buổi tập `SCHEDULED` chưa xoá mềm của võ sĩ (sắp xếp theo `scheduledAt asc, id asc`).
  - `sessions/training-session.service.ts`: thêm các phương thức bổ trợ `applySessionUpdateInTransaction`, `applySessionCancelInTransaction`, `notifySessionRescheduled`, `notifySessionCancelled` dùng chung logic khoá dòng, kiểm tra Cổng 2 (`SuspensionGate` — không bao giờ bỏ qua cổng), cập nhật DB trong transaction và gửi thông báo `TRAINING_SESSION_RESCHEDULED` / `TRAINING_SESSION_CANCELLED` sau khi transaction commit; `CHANGE_TYPE` chỉ cập nhật `sessionType` sang `RECOVERY` (không bắn thông báo, đúng hành vi `updateSession` hiện tại).
  - `training-suspension-conflicts.service.ts`:
    - `getConflicts(actor, suspensionId)`: kiểm tra đình chỉ tồn tại (404 `SUSPENSION_NOT_FOUND` nếu không có hoặc đã xoá mềm), kiểm tra quyền truy cập võ sĩ (`assertFighterAccess`), tính toán đề xuất khi đọc (không lưu DB) qua `planConflicts`.
    - `applyConflicts(actor, suspensionId, input)`: kiểm tra `assertTrainingWriteAllowed` + `assertFighterAccess`, mở **một transaction duy nhất** tính lại đề xuất hiện hành, từ chối 422 nếu bất kỳ `sessionId` nào không nằm trong đề xuất hiện tại (không áp dụng bất kỳ thay đổi nào), chỉ áp dụng các `sessionIds` được liệt kê bằng đường cập nhật/huỷ buổi tập chuẩn (đi qua Cổng 2 `SuspensionGate`), và chỉ gửi thông báo `TRAINING_SESSION_RESCHEDULED` / `TRAINING_SESSION_CANCELLED` sau khi transaction commit thành công.
  - `training-suspension-conflicts.controller.ts` & `training.module.ts`:
    - `GET /suspensions/:id/conflicts` yêu cầu quyền `suspension:read`.
    - `POST /suspensions/:id/conflicts/apply` yêu cầu quyền `TRAINING_PERMISSIONS.SESSION_UPDATE` (`training.session:update`).
    - Đăng ký `TrainingSuspensionConflictsController` và `TrainingSuspensionConflictsService` trong `TrainingModule`.
- Unit test mới:
  - `nestjs-api/src/suspensions/suspensions.model.spec.ts`: thêm 6 test cho `planConflicts` (tổng 23 test trong file).
  - `nestjs-api/src/training/training-suspension-conflicts.service.spec.ts`: 8 test kiểm tra `getConflicts`, áp dụng một phần danh sách (`sessionIds` để lại không bị đụng), tính nguyên tử khi lỗi ở buổi thứ hai (rollback toàn bộ và không gửi thông báo), từ chối 422 khi gửi `sessionId` ngoài đề xuất, chỉ gửi thông báo sau khi commit, chặn 403 khi HLV không được phân công võ sĩ hoặc bác sĩ gọi `apply`, và trả 404 `SUSPENSION_NOT_FOUND`.
  - `nestjs-api/src/training/training-suspension-conflicts.controller.spec.ts`: 5 test kiểm tra route metadata, permission metadata (`suspension:read`, `training.session:update`), Zod DTO validation và uỷ quyền xuống service.

### Đối chiếu tiêu chí nghiệm thu (phạm vi Round C)

| Tiêu chí (theo ticket, phạm vi Round C) | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| 12a — `planConflicts`: buổi `SPARRING` ngày thứ 5 của đình chỉ → `CHANGE_TYPE` sang `RECOVERY` (khi `RECOVERY` không bị chặn) | Đạt: `nestjs-api/src/suspensions/suspensions.model.ts:200`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:281`. |
| 12b — `planConflicts`: `RECOVERY` cũng bị chặn và các đình chỉ đều có ngày kết thúc cố định → `RESCHEDULE` sang `ends_on + 1` (giữ nguyên giờ); hai đình chỉ chồng nhau lấy `ends_on` muộn nhất; đúng ngày `ends_on` vẫn nằm trong khoảng đình chỉ | Đạt: `nestjs-api/src/suspensions/suspensions.model.ts:259`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:304`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:346`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:431`. |
| 12c — `planConflicts`: `RECOVERY` bị chặn và có đình chỉ cần xác nhận (`requiresClearance = true`) → `CANCEL`; buổi không bị chặn / ngoài khoảng / không phải `SCHEDULED` / đã xoá mềm không sinh đề xuất | Đạt: `nestjs-api/src/suspensions/suspensions.model.ts:251`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:327`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:386`. |
| 12d — `GET /suspensions/:id/conflicts` và `POST /suspensions/:id/conflicts/apply`: tính đề xuất khi đọc; `apply` chỉ xử lý các `sessionIds` được chọn trong 1 transaction nguyên tử, đi qua Cổng 2, từ chối 422 nếu `sessionId` ngoài đề xuất, gửi thông báo sau commit, kiểm tra phân quyền theo võ sĩ | Đạt: `nestjs-api/src/training/training-suspension-conflicts.controller.ts:53`, `nestjs-api/src/training/training-suspension-conflicts.controller.ts:79`, `nestjs-api/src/training/training-suspension-conflicts.service.ts:38`, `nestjs-api/src/training/training-suspension-conflicts.service.ts:70`, `nestjs-api/src/training/training-suspension-conflicts.service.spec.ts:132`, `nestjs-api/src/training/training-suspension-conflicts.controller.spec.ts:18`. |

### Lệnh đã chạy

#### `pnpm --filter nestjs-api lint`

Exit 0. Không có cảnh báo hay lỗi ở bất kỳ file nào thuộc Round A, Round B và Round C; cuối output nguyên văn:

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

Exit 1 (đúng baseline: 6 file lỗi gồm 4 file spec rỗng trong `src/notifications/` và 2 file integration `test/coaching-loop-persistence.spec.ts`, `test/dataset-export-trust-boundary.spec.ts` cần `SUPABASE_URL`/Redis; toàn bộ 58 file unit test khác đều PASS với 950/950 test PASS, tăng thêm 2 file và 19 test mới so với Round B). Cuối output nguyên văn:

```text
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/31]⎯


 Test Files  6 failed | 58 passed (64)
      Tests  26 failed | 950 passed (976)
   Start at  17:49:03
   Duration  693.37s (transform 6.85s, setup 0ms, import 72.65s, tests 769.67s, environment 7ms)

[ELIFECYCLE] Test failed. See above for more details.
Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL

  × "pnpm recursive run" failed in D:\MMA-TMS\nestjs-api
```

Kiểm tra riêng `src/suspensions` và `src/training` (`pnpm --filter nestjs-api exec vitest run src/suspensions src/training`):

```text
 RUN  v4.1.11 D:/MMA-TMS/nestjs-api


 Test Files  11 passed (11)
      Tests  224 passed (224)
   Start at  17:46:42
   Duration  1.34s (transform 682ms, setup 0ms, import 5.95s, tests 478ms, environment 2ms)
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
Migration checks passed: 45. PostgreSQL stopped after tests. Scratch: C:\Users\PC\AppData\Local\Temp\mma-migrations-56MWz2
```

#### `pnpm --filter nestjs-api db:check`

Exit 0. Nguyên văn output:

```text
$ node run_sql.mjs --check
001-027 checksums OK. No database connection was opened.
```

### Lệch so với ticket

- Không lệch so với ticket và chỉ định của Round C. Đề xuất xung đột R28 được tính trực tiếp khi đọc (`GET /suspensions/:id/conflicts`), không lưu bảng phụ; `POST /suspensions/:id/conflicts/apply` chạy trong một transaction duy nhất, đi qua Cổng 2 (`SuspensionGate`) đối với mọi buổi tập được đổi loại hoặc dời lịch, dùng lý do huỷ cố định `'Suspension in force'` (`SUSPENSION_CONFLICT_CANCELLATION_REASON`), và chỉ gửi thông báo `TRAINING_SESSION_RESCHEDULED` / `TRAINING_SESSION_CANCELLED` sau khi transaction commit.

### Câu hỏi / việc còn mở

- Không có câu hỏi tồn đọng cho Round C. Sẵn sàng chuyển sang Round D.

---

## Round D

- Nhánh: `User_Feature` (để nguyên các thay đổi uncommitted trên working tree theo chỉ định).
- Phạm vi Round D:
  - **D1.** Bảng sẵn sàng nhận trận `GET /readiness` (R32, S3) trong `src/bouts/` kèm hàm phân loại thuần `classifyReadiness` và truy vấn theo lô (không N+1).
  - **D2.** Cảnh báo khi tạo trận trong `createBout` (R4): bổ sung `FIGHTER_ACTIVE_BOUT` và `FIGHTER_SUSPENDED_PAST_BOUT_DATE` vào `BOUT_WARNING_CODES`, không chặn lưu trận mới.
  - **D3.** Hai nguồn việc cần làm mới trong `src/bouts/bouts-todo.*`: `SUSPENSION_AWAITING_CLEARANCE` (R28/S3) và `TRAINING_CONFLICTS_WITH_SUSPENSION` (R28), truy vấn theo lô.
  - **Module wiring:** `BoutsModule` import `SuspensionsModule` (không import `TrainingModule`).

### Thay đổi

- `nestjs-api/src/suspensions/suspensions.constants.ts` & `nestjs-api/src/suspensions/suspensions.model.ts`:
  - Chuyển hằng số `SESSION_TYPES` sang `suspensions.constants.ts` (và re-export từ `suspensions.model.ts`) để tránh vòng phụ thuộc khởi tạo mức module với `bouts.model.ts`.
- `nestjs-api/src/suspensions/suspensions.repo.ts`:
  - Thêm `findSuspensionsByFighterIds(fighterIds)` và `findUnresolvedSuspensionsInScope(scope)` để phục vụ truy vấn theo lô cho bảng sẵn sàng (`GET /readiness`) và thẻ việc cần làm (`GET /bouts/todo`).
- `nestjs-api/src/bouts/bouts.constants.ts`:
  - Thêm thông điệp `READINESS: 'Get fighter readiness successfully'` trong `BOUT_RESPONSE_MESSAGES` và hằng số `LOSS_OF_CONSCIOUSNESS_VALUES`.
- `nestjs-api/src/bouts/bouts.model.ts` & `nestjs-api/src/bouts/bouts.dto.ts`:
  - Thêm `'FIGHTER_ACTIVE_BOUT'` và `'FIGHTER_SUSPENDED_PAST_BOUT_DATE'` vào `BOUT_WARNING_CODES`.
  - Khai báo `ACTIVE_BOUT_STATUSES` (`CAMP`, `FIGHT_WEEK`, `WEIGHED_IN`), `READINESS_STATUSES` (`SUSPENDED`, `AWAITING_CLEARANCE`, `IN_BOUT`, `READY`), `NOT_READY_REASONS` (`SUSPENDED_PAST_BOUT_DATE`, `ACTIVE_BOUT`), `readinessQuerySchema` (bắt buộc `rulesetId` khi truyền `weightLimitKg` hoặc `boutOn` -> 422), `readinessRowSchema`, cùng `ReadinessQueryDto` và `ReadinessRowDto`.
  - Cài đặt hàm thuần `classifyReadiness(...)`:
    - Thứ tự ưu tiên `status`: `SUSPENDED` (có đình chỉ đang `ACTIVE` hôm nay) > `AWAITING_CLEARANCE` (có đình chỉ đang `AWAITING_CLEARANCE` hôm nay) > `IN_BOUT` (có trận ở `CAMP` / `FIGHT_WEEK` / `WEIGHED_IN`; trận `SCHEDULED` không làm võ sĩ mất sẵn sàng) > `READY`.
    - `suspension`: lấy đình chỉ còn hiệu lực có `ends_on` muộn nhất, trả `{ startsOn, endsOn, blockedSessionTypes, allowedSessionTypes, expectedResumeOn }` (`allowedSessionTypes` = 8 loại buổi tập trừ đi các loại bị chặn; `expectedResumeOn = ends_on + 1` hoặc `null` nếu `requiresClearance = true`).
    - Khi có `boutOn`: đánh dấu `ready = false` và điền `notReadyReasons` (`SUSPENDED_PAST_BOUT_DATE`, `ACTIVE_BOUT`) nếu có đình chỉ còn hiệu lực vào ngày `boutOn` hoặc đang có trận hoạt động.
    - Khi có đủ `weightLimitKg`, `rulesetId` và `boutOn`: tính thêm `feasibility` bằng `computeWeightFeasibility` và `acuteLossLimitPctFor` (dùng ngưỡng dài hạn của bộ luật, cân gần nhất trong 7 ngày qua); `feasibility` chỉ mang tính thông tin và không làm đổi `ready`.
- `nestjs-api/src/bouts/bouts.repo.ts`:
  - Thêm các truy vấn theo lô: `listActiveFightersInScope`, `findActiveBoutsForFighters`, `findLatestWeightsForFighters`, `findScheduledSessionsForFighters`, `findLatestBoutsForFighters`.
- `nestjs-api/src/bouts/bouts.service.ts`, `nestjs-api/src/bouts/bouts.controller.ts` & `nestjs-api/src/bouts/bouts.module.ts`:
  - `BoutsModule` import `SuspensionsModule`.
  - Thêm `GET /readiness` (`@RequirePermissions({ allOf: [BOUT_PERMISSIONS.GET_ALL] })`); trong `BoutsService.getReadiness`, chỉ cho phép `COACH` (võ sĩ được phân công) và `ADMIN` (toàn CLB), trả 403 cho `FIGHTER` và `DOCTOR`.
  - Trong `BoutsService.createBout` (chỉnh sửa tối thiểu, không đụng `updateBout`, `resolveWeightClass`, `computeWeightTrack`): kiểm tra `repo.findActiveBoutIdForFighter` để thêm cảnh báo `FIGHTER_ACTIVE_BOUT`, và kiểm tra đình chỉ còn hiệu lực vào ngày học viện của `boutAt` để thêm cảnh báo `FIGHTER_SUSPENDED_PAST_BOUT_DATE` cạnh các cảnh báo cân nặng; không bao giờ chặn lưu trận.
- `nestjs-api/src/bouts/bouts-todo.model.ts` & `nestjs-api/src/bouts/bouts-todo.service.ts`:
  - Thêm `'SUSPENSION_AWAITING_CLEARANCE'` và `'TRAINING_CONFLICTS_WITH_SUSPENSION'` vào `TODO_SOURCES`.
  - Thêm `suspensionAwaitingClearanceProvider` (phase `AFTER`, xuất hiện từ ngày `ends_on + 1` khi `suspensionStatusOn(s, today) === 'AWAITING_CLEARANCE'`, tối đa 1 mục trên mỗi võ sĩ gắn với trận đang chạy hoặc trận gần nhất của võ sĩ; bỏ qua nếu võ sĩ chưa từng có trận) và `trainingConflictsProvider` (phase `AFTER`, `count` = số đề xuất xung đột R28 tính bằng `planConflicts` trên các buổi `SCHEDULED` từ hôm nay trở đi và các đình chỉ của võ sĩ).
  - Cập nhật `BoutsTodoService.getTodo` để nạp theo lô đình chỉ chưa kết thúc, buổi tập `SCHEDULED` từ hôm nay và trận gần nhất cho các võ sĩ không có trận đang chạy.
- Unit test mới / cập nhật:
  - `nestjs-api/src/bouts/bouts.model.spec.ts`: kiểm tra `classifyReadiness` (ranh giới S3 `ends_on` vs `ends_on + 1`, `requiresClearance`, trận `SCHEDULED` vs `CAMP`, bộ lọc `boutOn` / `weightLimitKg` / `rulesetId`, validation 422 của `readinessQuerySchema`).
  - `nestjs-api/src/bouts/bouts.service.spec.ts`: kiểm tra phân quyền và phạm vi của `getReadiness` (`COACH` chỉ thấy võ sĩ được phân công, `ADMIN` thấy tất cả, `FIGHTER` / `DOCTOR` bị 403, `rulesetId` không tồn tại trả 404) và cảnh báo R4 trong `createBout` (`FIGHTER_ACTIVE_BOUT`, `FIGHTER_SUSPENDED_PAST_BOUT_DATE`, vẫn lưu thành công trận `SCHEDULED` khi đang có trận `CAMP`).
  - `nestjs-api/src/bouts/bouts.controller.spec.ts`: kiểm tra route `GET /readiness`, permission `bout:get_all` và uỷ quyền xuống `BoutsService.getReadiness`.
  - `nestjs-api/src/bouts/bouts-todo.model.spec.ts` & `nestjs-api/src/bouts/bouts-todo.service.spec.ts`: kiểm tra 2 provider mới (`SUSPENSION_AWAITING_CLEARANCE` không hiện ở `ends_on` mà hiện ở `ends_on + 1`, `TRAINING_CONFLICTS_WITH_SUSPENSION` đếm đúng số đề xuất R28, gộp tối đa 1 mục mỗi võ sĩ theo trận đang chạy hoặc trận gần nhất, bỏ qua nếu võ sĩ chưa có trận).

### Lệnh đã chạy

#### `pnpm --filter nestjs-api lint`

Exit 0. Không có cảnh báo hay lỗi ở bất kỳ file nào thuộc `src/bouts/` hay `src/suspensions/`; cuối output nguyên văn:

```text
src/coaching/coaching.service.ts:13:24: warning eslint(no-unused-vars): Type 'DrizzleDB' is imported but never used. help: Consider removing this import.
src/coaching/coaching.service.ts:177:16: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/coaching/coaching.service.ts:504:27: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/coaching/coaching.service.ts:534:27: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/coaching/coaching.service.ts:534:54: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/main.ts:7:10: warning eslint(no-unused-vars): Identifier 'createOpenApiDocument' is imported but never used. help: Consider removing this import.
src/coaching/movement-review.service.spec.ts:32:5: warning unicorn(no-thenable): Do not add `then` to a class. help: If an object is defined as 'thenable', once it's accidentally used in an await expression, it may cause problems
src/app.module.ts:18:10: warning eslint(no-unused-vars): Identifier 'NotificationsModule' is imported but never used. help: Consider removing this import.
```

#### `pnpm --filter nestjs-api build`

Exit 0. Nguyên văn output:

```text
$ nest build
```

#### `pnpm --filter nestjs-api test`

Exit 1 (đúng baseline: 6 file lỗi gồm 4 file spec rỗng trong `src/notifications/` và 2 file integration `test/coaching-loop-persistence.spec.ts`, `test/dataset-export-trust-boundary.spec.ts` cần `SUPABASE_URL`/Redis; toàn bộ 58 file unit test khác đều PASS với 966/966 test PASS, tăng thêm 16 test mới trong `src/bouts/` so với Round C). Cuối output nguyên văn:

```text
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/31]⎯


 Test Files  6 failed | 58 passed (64)
      Tests  26 failed | 966 passed (992)
   Start at  18:49:00
   Duration  698.92s (transform 5.15s, setup 0ms, import 56.79s, tests 777.98s, environment 6ms)

[ELIFECYCLE] Test failed. See above for more details.
Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL

  × "pnpm recursive run" failed in D:\MMA-TMS\nestjs-api
```

Kiểm tra riêng `src/bouts`, `src/suspensions` và `src/training` (`pnpm --filter nestjs-api exec vitest run src/bouts src/suspensions src/training`):

```text
 RUN  v4.1.11 D:/MMA-TMS/nestjs-api


 Test Files  19 passed (19)
      Tests  476 passed (476)
   Start at  18:47:09
   Duration  1.77s (transform 1.97s, setup 0ms, import 17.40s, tests 912ms, environment 2ms)
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
Migration checks passed: 45. PostgreSQL stopped after tests. Scratch: C:\Users\PC\AppData\Local\Temp\mma-migrations-dXxg9e
```

#### `pnpm --filter nestjs-api db:check`

Exit 0. Nguyên văn output:

```text
$ node run_sql.mjs --check
001-027 checksums OK. No database connection was opened.
```

### Lệch so với ticket

- Không lệch so với ticket và chỉ định của Round D.

### Câu hỏi

- Không có câu hỏi tồn đọng cho Round D. Sẵn sàng chuyển sang Round E.

---

## Round E

- Nhánh: `User_Feature` (để nguyên các thay đổi uncommitted trên working tree theo chỉ định).
- Phạm vi Round E: Tự động tạo đình chỉ khi ghi kết quả trận theo quy tắc R27 trong cùng transaction chuyển trận sang `COMPLETED` (`recordResult` trong `src/bouts/bouts.service.ts`), hàm thuần `suggestSuspensions` trong `src/suspensions/suspensions.model.ts`, mở rộng schema và response của `recordResult`, hai mã lỗi 422 mới, truy vấn đình chỉ KO/TKO trước đó trong `SuspensionsRepository`, và bộ unit test đầy đủ.

### Thay đổi

- `nestjs-api/src/suspensions/suspensions.constants.ts` & `nestjs-api/src/suspensions/suspensions.model.ts`:
  - Di chuyển `SUSPENSION_REASONS` và `type SuspensionReason` sang `suspensions.constants.ts` (và re-export từ `suspensions.model.ts`) để tránh vòng phụ thuộc khởi tạo Zod enum khi `bouts.model.ts` import vào.
- `nestjs-api/src/suspensions/suspensions.error.ts`:
  - Thêm hai helper lỗi 422: `suspensionDaysRequired` (mã `SUSPENSION_DAYS_REQUIRED`) và `suspensionOverrideReasonRequired` (mã `SUSPENSION_OVERRIDE_REASON_REQUIRED`).
- `nestjs-api/src/suspensions/suspensions.model.ts`:
  - Khai báo schema quy tắc đình chỉ `suspensionRuleSchema` (`reason`, `minDays`, `priorCount`, `withinDays`, `loc`), các kiểu `SuggestSuspensionEvent`, `SuggestSuspensionRuleset`, `SuggestSuspensionCoachInput`, `SuggestSuspensionsParams`, `SuggestedSuspension`, `SuggestSuspensionsResult`.
  - Cài đặt hàm thuần `suggestSuspensions(...)` (hỗ trợ cả dạng object params và dạng tham số vị trí theo đặc tả):
    - Kiểm tra thua KO hoặc thua TKO có đòn vào đầu (`result = 'LOSS'` và `method = 'KO'` hoặc (`method = 'TKO'` và `stoppedByHeadStrike = true`)).
    - Nếu không thuộc diện đình chỉ KO/TKO: từ chối 422 (`SUSPENSION_DAYS_NOT_ALLOWED` / `SUSPENSION_OVERRIDE_NOT_ALLOWED`) nếu gửi `suspensionDays` hoặc `suspensionOverrideReason`.
    - Chọn quy tắc nặng nhất (`minDays` lớn nhất) khớp theo lý do (`reason`), số lần KO/TKO trước đó trong `withinDays` (`priorCount`), và mức mất ý thức (`loc`).
    - Gợi ý số ngày `suggested_days`: nếu có quy tắc khớp thì lấy `minDays` đó; nếu bộ luật rỗng (VMMAF) thì `suggested_days = null`, bắt buộc HLV nhập `suspensionDays` (thiếu -> 422 `SUSPENSION_DAYS_REQUIRED`).
    - Khi có quy tắc gợi ý: nếu gửi `suspensionDays` khác `suggested_days`, bắt buộc có `suspensionOverrideReason` (thiếu -> 422 `SUSPENSION_OVERRIDE_REASON_REQUIRED`), lưu vào `override_reason`.
    - `method = 'DQ'`: chỉ tạo đình chỉ lý do `DQ` khi bộ luật có quy tắc liệt kê `DQ` trong `reason`; `requires_clearance = false`. Không có quy tắc -> không tạo đình chỉ `DQ`.
    - Ngày nghỉ bắt buộc: nếu `restDaysAfterBout > 0`, luôn tạo thêm 1 đình chỉ lý do `MANDATORY_REST` với `days = restDaysAfterBout`, `requires_clearance = false`, `blocked_session_types` lấy từ `default_blocked_session_types` của bộ luật.
    - Sinh câu giải thích tự nhiên bằng tiếng Anh theo khuôn mẫu quy định (ví dụ: `"KO, second in 90 days, AIBA preset: 90 days"`).
- `nestjs-api/src/suspensions/suspensions.repo.ts`:
  - Thêm phương thức `countPriorKoTkoSuspensions(fighterId, sinceDate, excludeBoutId?, database?)` và `findPriorKoTkoSuspensions(fighterId, sinceDate?, excludeBoutId?, database?)` lấy các đình chỉ KO/TKO của võ sĩ chưa xoá mềm, loại trừ trận hiện tại, nhận `DatabaseExecutor` để chạy trong transaction.
- `nestjs-api/src/bouts/bouts.model.ts` & `nestjs-api/src/bouts/bouts.dto.ts`:
  - Mở rộng `recordResultSchema` nhận thêm hai trường tùy chọn: `suspensionDays` (int 1..365) và `suspensionOverrideReason` (trimmedText 3..500).
  - Khai báo schema `recordResultSuspensionSchema` (`id`, `reason`, `startsOn`, `endsOn`, `requiresClearance`, `suggestedDays`, `explanation`), `recordResultResponseSchema` (kế thừa `boutDetailResponseSchema` mở rộng thêm mảng `suspensions`), cùng DTO `RecordResultResponseDto`.
- `nestjs-api/src/bouts/bouts.service.ts`:
  - Trong `recordResult`: bổ sung kiểm tra hợp lệ sớm khi không thuộc diện đình chỉ KO/TKO (nếu gửi `suspensionDays` hoặc `suspensionOverrideReason` -> 422 `BOUT_RESULT_INVALID`), tải `ruleset`, và trong cùng transaction với `updateBout`, gọi phương thức hỗ trợ `applyResultSuspensions(actor, bout, ruleset, input, today, tx)` sau khi `updateBout` hoàn thành.
  - `applyResultSuspensions`: đọc danh sách đình chỉ KO/TKO trước đó của võ sĩ trong `tx`, chạy `suggestSuspensions`, ném lỗi 422 tương ứng nếu thiếu ngày hoặc thiếu lý do ghi đè, và chèn các bản ghi đình chỉ qua `suspensionsRepo.insertSuspension(..., tx)` trong cùng transaction. Nếu chèn đình chỉ gặp lỗi, toàn bộ transaction bị rollback và trận đấu giữ nguyên trạng thái `WEIGHED_IN`.
  - Trả về response `RecordResultResponse` với trường `suspensions` chứa danh sách các đình chỉ vừa được tạo (hoặc mảng rỗng nếu không có).
- Unit test mới:
  - `nestjs-api/src/suspensions/suspensions.model.spec.ts`: bổ sung 17 test cho hàm thuần `suggestSuspensions` (preset AIBA lần đầu 30 ngày, 40 ngày trước có đình chỉ KO thủ công -> 90 ngày, lần 3 trong 365 ngày -> 365 ngày, ranh giới 90 ngày, TKO có/không có đòn vào đầu, LOC `UNDER_1_MIN` và `OVER_1_MIN`, VMMAF thiếu/có `suspensionDays`, ghi đè ngày thiếu/có lý do, truất quyền có/không có quy tắc, ngày nghỉ bắt buộc, thắng có đánh ngã không tạo đình chỉ, từ chối số ngày khi không thuộc diện, gọi bằng tham số vị trí).
  - `nestjs-api/src/bouts/bouts.service.spec.ts`: bổ sung 12 test toàn diện cho `recordResult` tự tạo đình chỉ (AIBA lần đầu 30 ngày, có đình chỉ thủ công 40 ngày trước -> 90 ngày, TKO có/không có đòn vào đầu, LOC rules, VMMAF 422 / tạo thành công với `suspensionDays`, ghi đè ngày 422 / lưu `overrideReason`, DQ có/không có quy tắc, 2 dòng đình chỉ khi có cả KO và `MANDATORY_REST`, thắng có đánh ngã không tạo gì, gửi `suspensionDays` khi thắng/thua điểm -> 422, `cancelBout` không tạo đình chỉ, lỗi khi chèn đình chỉ rollback toàn bộ transaction và giữ nguyên trạng thái `WEIGHED_IN`).

### Đối chiếu tiêu chí nghiệm thu (phạm vi Round E)

| Tiêu chí (theo ticket & prompt Round E) | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| 1 — Preset AIBA: Thua KO lần đầu → 30 ngày, `requires_clearance = true`, câu giải thích "KO, AIBA preset: 30 days" | Đạt: `nestjs-api/src/suspensions/suspensions.model.ts:577`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:522`, `nestjs-api/src/bouts/bouts.service.spec.ts:2691`. |
| 2 — Preset AIBA: Có đình chỉ KO thủ công 40 ngày trước, nay thua KO → 90 ngày ("KO, second in 90 days, AIBA preset: 90 days") | Đạt: `nestjs-api/src/suspensions/suspensions.model.ts:555`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:550`, `nestjs-api/src/bouts/bouts.service.spec.ts:2730`. |
| 3 — Thua TKO: `stoppedByHeadStrike = true` → 30 ngày; `stoppedByHeadStrike = false` → không có đình chỉ TKO | Đạt: `nestjs-api/src/suspensions/suspensions.model.ts:520`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:606`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:632`, `nestjs-api/src/bouts/bouts.service.spec.ts:2774`. |
| 4 — Quy tắc mất ý thức (`loc`): `UNDER_1_MIN` → 90 ngày; `OVER_1_MIN` → 180 ngày | Đạt: `nestjs-api/src/suspensions/suspensions.model.ts:566`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:650`, `nestjs-api/src/bouts/bouts.service.spec.ts:2803`. |
| 5 — VMMAF (quy tắc rỗng): thua KO không có `suspensionDays` → 422 `SUSPENSION_DAYS_REQUIRED`; có gửi `suspensionDays` → tạo thành công, `suggested_days = null`, không cần `override_reason` | Đạt: `nestjs-api/src/suspensions/suspensions.model.ts:602`, `nestjs-api/src/bouts/bouts.service.ts:1314`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:696`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:717`, `nestjs-api/src/bouts/bouts.service.spec.ts:2840`. |
| 6 — Sửa số ngày: khác gợi ý mà không có lý do → 422 `SUSPENSION_OVERRIDE_REASON_REQUIRED`; có lý do → lưu vào `override_reason` | Đạt: `nestjs-api/src/suspensions/suspensions.model.ts:588`, `nestjs-api/src/bouts/bouts.service.ts:1317`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:753`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:768`, `nestjs-api/src/bouts/bouts.service.spec.ts:2890`. |
| 7 — Truất quyền (`DQ`): `method = 'DQ'` chỉ tạo đình chỉ lý do `DQ` khi bộ luật có quy tắc liệt kê `DQ` (`requires_clearance = false`); không có quy tắc → không tạo đình chỉ `DQ` | Đạt: `nestjs-api/src/suspensions/suspensions.model.ts:634`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:810`, `nestjs-api/src/bouts/bouts.service.spec.ts:2939`. |
| 8 — Nghỉ bắt buộc: `restDaysAfterBout > 0` → luôn tạo thêm 1 đình chỉ `MANDATORY_REST` (`requires_clearance = false`, `blockedSessionTypes` theo ruleset); khi thua KO tạo đủ cả 2 dòng | Đạt: `nestjs-api/src/suspensions/suspensions.model.ts:672`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:846`, `nestjs-api/src/bouts/bouts.service.spec.ts:2974`. |
| 9 — Thắng có bị đánh ngã (`knockedDown = true`) → không tự tạo đình chỉ KO/TKO | Đạt: `nestjs-api/src/suspensions/suspensions.model.ts:524`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:881`, `nestjs-api/src/bouts/bouts.service.spec.ts:3010`. |
| 10 — Gửi `suspensionDays` hoặc `suspensionOverrideReason` khi không thuộc diện đình chỉ KO/TKO → 422 `BOUT_RESULT_INVALID` | Đạt: `nestjs-api/src/bouts/bouts.service.ts:1189`, `nestjs-api/src/suspensions/suspensions.model.spec.ts:899`, `nestjs-api/src/bouts/bouts.service.spec.ts:3030`. |
| 11 — `cancelBout`: huỷ trận ở mọi trạng thái (kể cả `WEIGHED_IN`) giữ nguyên không đổi và không tạo đình chỉ nào | Đạt: `nestjs-api/src/bouts/bouts.service.ts:1240`, `nestjs-api/src/bouts/bouts.service.spec.ts:3061`. |
| 12 — Tính nguyên tử: lỗi khi chèn đình chỉ làm rollback toàn bộ transaction và trận giữ nguyên `WEIGHED_IN` | Đạt: `nestjs-api/src/bouts/bouts.service.ts:1222`, `nestjs-api/src/bouts/bouts.service.spec.ts:3071`. |

### Lệnh đã chạy

#### `pnpm --filter nestjs-api lint`

Exit 0. Không có cảnh báo hay lỗi ở bất kỳ file nào thuộc Round E; cuối output nguyên văn:

```text
src/notifications/notification-stream.service.ts:91:33: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:318:24: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:319:33: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:333:31: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/notifications/notification-producer.service.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
```

#### `pnpm --filter nestjs-api build`

Exit 0. Nguyên văn output:

```text
$ nest build
```

#### `pnpm --filter nestjs-api test`

Exit 1 (đúng baseline: 6 file lỗi gồm 4 file spec rỗng trong `src/notifications/` và 2 file integration `test/coaching-loop-persistence.spec.ts`, `test/dataset-export-trust-boundary.spec.ts` cần `SUPABASE_URL`/Redis; toàn bộ 58 file unit test khác đều PASS với 989/989 test PASS, tăng thêm 23 test mới so với Round D). Cuối output nguyên văn:

```text
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/31]⎯


 Test Files  6 failed | 58 passed (64)
      Tests  26 failed | 989 passed (1015)
   Start at  19:50:00
   Duration  692.58s (transform 6.29s, setup 0ms, import 67.17s, tests 772.58s, environment 12ms)

[ELIFECYCLE] Test failed. See above for more details.
Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL

  × "pnpm recursive run" failed in D:\MMA-TMS\nestjs-api
```

Kiểm tra riêng `src/bouts` và `src/suspensions` (`pnpm --filter nestjs-api exec vitest run src/bouts src/suspensions`):

```text
 RUN  v4.1.11 D:/MMA-TMS/nestjs-api


 Test Files  12 passed (12)
      Tests  320 passed (320)
   Start at  20:03:25
   Duration  1.46s (transform 1.22s, setup 0ms, import 8.99s, tests 266ms, environment 1ms)
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
Migration checks passed: 45. PostgreSQL stopped after tests. Scratch: C:\Users\PC\AppData\Local\Temp\mma-migrations-c10Pii
```

#### `pnpm --filter nestjs-api db:check`

Exit 0. Nguyên văn output:

```text
$ node run_sql.mjs --check
001-027 checksums OK. No database connection was opened.
```

### Lệch so với ticket

- **Xử lý vòng phụ thuộc khởi tạo Zod enum:** `SUSPENSION_REASONS` được chuyển sang `src/suspensions/suspensions.constants.ts` (và re-export từ `suspensions.model.ts`) để tránh vòng phụ thuộc khởi tạo module giữa `bouts.model.ts` và `suspensions.model.ts`, hoàn toàn tương tự giải pháp di chuyển `SESSION_TYPES` ở Round D.
- **Nơi khai báo hai error helper mới:** `suspensionDaysRequired` (422 `SUSPENSION_DAYS_REQUIRED`) và `suspensionOverrideReasonRequired` (422 `SUSPENSION_OVERRIDE_REASON_REQUIRED`) được định nghĩa trong `src/suspensions/suspensions.error.ts` và được import trực tiếp vào `src/bouts/bouts.service.ts` nhằm tuân thủ scope lock không chỉnh sửa `bouts.error.ts`.
- **Hợp đồng `recordResult`:** schema đầu vào `recordResultSchema` nhận thêm hai trường tùy chọn `suspensionDays` và `suspensionOverrideReason`, và response trả thêm mảng `suspensions: [{ id, reason, startsOn, endsOn, requiresClearance, suggestedDays, explanation }]` đúng như yêu cầu của Round E.

### Câu hỏi

- Không có câu hỏi tồn đọng cho Round E. Ticket T-007 đã hoàn thành đầy đủ cả 5 round A, B, C, D, E.


## Round F

- Nhánh: `User_Feature` (để nguyên các thay đổi uncommitted trên working tree theo chỉ định).
- Phạm vi Round F: Khắc phục chính xác 6 điểm phát hiện từ đợt rà soát độc lập (F1–F6) theo đúng nguyên tắc TDD (mỗi lỗi đều có test chứng minh FAIL trên code cũ và PASS trên code mới).

### Danh mục sửa lỗi (1 dòng cho mỗi fix)

- **F1:** Cổng bắt đầu buổi tập (`updateSessionStatus` sang `IN_PROGRESS` trong `training-session.service.ts`) đánh giá ngày học viện tại thời điểm hiện tại `new Date()` thay vì `locked.scheduledAt`; chứng minh bằng 2 unit test trong `training-session.service.spec.ts` (chặn bắt đầu buổi có `scheduledAt` quá khứ khi hôm nay đang bị đình chỉ; cho phép bắt đầu hôm nay khi không bị đình chỉ dù `scheduledAt` rơi vào đợt đình chỉ).
- **F2:** `classifyReadiness` trong `bouts.model.ts` xếp đình chỉ cần xác nhận y tế kết thúc sau cùng, tính `expectedResumeOn = null` nếu có bất kỳ đình chỉ nào đang mở/chưa xác nhận y tế (ngược lại là `max(endsOn) + 1`), hợp nhất `blockedSessionTypes` (union), bù `allowedSessionTypes`, và lấy ranh giới `startsOn` sớm nhất / `endsOn` muộn nhất; chứng minh bằng 2 unit test trong `bouts.model.spec.ts` (trường hợp KO chưa xác nhận + MANDATORY_REST và trường hợp 2 đình chỉ ngày cố định).
- **F3:** Giao dịch `applyConflicts` kiểm tra lại trạng thái buổi tập sau khi khoá dòng (`onLocked` callback kiểm tra `locked.status === 'SCHEDULED'`); nếu trạng thái đã đổi thì ném 422 cùng thông điệp lỗi và rollback toàn bộ transaction; chứng minh bằng unit test trong `training-suspension-conflicts.service.spec.ts` (buổi tập chuyển sang `IN_PROGRESS` giữa lúc đề xuất và lúc áp dụng).
- **F4:** `GET /suspensions/:id/conflicts` và `POST /suspensions/:id/conflicts/apply` lập kế hoạch với mọi đình chỉ có hiệu lực nhưng chỉ trả về và áp dụng các đề xuất thuộc phạm vi thời gian và loại buổi bị chặn của riêng đình chỉ `:id` (trả về rỗng nếu `:id` đã xác nhận hoặc chưa có hiệu lực hôm nay); chứng minh bằng 2 unit test trong `training-suspension-conflicts.service.spec.ts`.
- **F5:** Xoá `@Optional()` và loại bỏ toán tử optional chaining `?.` trên `SuspensionsRepository` trong `bouts.service.ts` và `bouts-todo.service.ts` để trở thành dependency bắt buộc; xoá nhánh fallback chết `typeof this.repo.findScheduledSessionsByFighterId === 'function'` và tải toàn bộ buổi tập không bị giới hạn 100 dòng; chứng minh bằng unit test với 105 buổi tập trong `training-suspension-conflicts.service.spec.ts` và cập nhật mock ở `bouts.service.spec.ts`.
- **F6:** Hợp nhất một định nghĩa duy nhất cho `LOSS_OF_CONSCIOUSNESS_VALUES` trong `bouts.model.ts`, xoá bỏ định nghĩa trùng lặp tại `bouts.constants.ts` và import trực tiếp vào `suspensions.model.ts`; chứng minh qua TypeScript build sạch và test suite `bouts.model.spec.ts`.

### Thay đổi

- `nestjs-api/src/bouts/bouts.constants.ts`: Xoá `LOSS_OF_CONSCIOUSNESS_VALUES` và kiểu `LossOfConsciousness`.
- `nestjs-api/src/bouts/bouts.model.ts`:
  - Giữ lại định nghĩa chuẩn `LOSS_OF_CONSCIOUSNESS_VALUES` và `LossOfConsciousness`.
  - Khai báo kiểu `SuspensionStateInput` và hàm thuần tuý `isInForceOn`, `suspensionStatusOn` ngay tại model để phá vỡ vòng phụ thuộc ESM TDZ với `suspensions.model.ts`.
  - Cập nhật `classifyReadiness` theo quy tắc F2: tập hợp tất cả đình chỉ có hiệu lực hôm nay, tính `expectedResumeOn` (`null` nếu có open-ended; ngược lại `max(endsOn) + 1`), `blockedSessionTypes` là union các loại bị chặn, `allowedSessionTypes` là các loại không nằm trong union, `startsOn` sớm nhất và `endsOn` muộn nhất.
- `nestjs-api/src/suspensions/suspensions.model.ts`: Import `LOSS_OF_CONSCIOUSNESS_VALUES` từ `bouts.model.js`.
- `nestjs-api/src/training/sessions/training-session.service.ts`:
  - Trong `updateSessionStatus` sang `IN_PROGRESS`, truyền `new Date()` vào Cổng 2 (suspension check) để đánh giá đúng ngày hiện tại bắt đầu buổi tập; giữ nguyên kiểm tra medical theo ngày dự kiến.
  - Thêm tuỳ chọn `onLocked` hook vào `applySessionUpdateInTransaction` và `applySessionCancelInTransaction` để cho phép kiểm tra lại trạng thái sau khi lấy khoá `FOR UPDATE`.
- `nestjs-api/src/training/training-suspension-conflicts.service.ts`:
  - `applyConflicts`: truyền `ensureScheduled` hook vào `trainingSessionService` để đảm bảo buổi tập sau khi khoá vẫn giữ nguyên trạng thái `SCHEDULED`; nếu không, ném 422 `suspensionValidationError('Session ... is not in the current conflict proposal')`.
  - `getConflicts` và `applyConflicts`: sau khi lập kế hoạch với toàn bộ đình chỉ có hiệu lực của võ sĩ, lọc danh sách đề xuất chỉ giữ lại các buổi nằm trong khoảng `starts_on <= scheduled_on <= ends_on` (hoặc sau `starts_on` nếu là open-ended) và có `sessionType` bị chặn bởi chính đình chỉ `:id`. Trả về mảng rỗng nếu `:id` đã được clear hoặc không có hiệu lực hôm nay.
  - Xoá kiểm tra `typeof this.repo.findScheduledSessionsByFighterId === 'function'` và gọi trực tiếp repo method.
- `nestjs-api/src/bouts/bouts.service.ts` & `nestjs-api/src/bouts/bouts-todo.service.ts`:
  - Biến `suspensionsRepo: SuspensionsRepository` thành required dependency (bỏ `@Optional()`).
  - Xoá các toán tử `?.` và fallback mặc định khi gọi các phương thức repository để lỗi cấu hình/truy vấn báo lỗi ngay lập tức.
- Unit tests:
  - `training-session.service.spec.ts`: Thêm 2 test cho F1.
  - `bouts.model.spec.ts`: Thêm 2 test cho F2.
  - `training-suspension-conflicts.service.spec.ts`: Thêm các test cho F3, F4, F5 (test với 105 buổi tập).
  - `bouts.service.spec.ts`: Cập nhật mock `SuspensionsRepository` cho `BoutsService`.

### Lệnh đã chạy

#### `pnpm --filter nestjs-api lint`

Exit 0. Không có lỗi hay cảnh báo ở bất kỳ file nào được chỉnh sửa ở Round F. Các dòng cuối nguyên văn:

```text
test/coaching-loop-persistence.spec.ts:18:3: warning eslint(no-unused-vars): Identifier 'coachReviews' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:19:3: warning eslint(no-unused-vars): Identifier 'fighterBaselines' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:20:3: warning eslint(no-unused-vars): Identifier 'auditLogs' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:21:3: warning eslint(no-unused-vars): Identifier 'actionAssessments' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:22:3: warning eslint(no-unused-vars): Identifier 'actionFindingReviews' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:23:3: warning eslint(no-unused-vars): Identifier 'techniqueReferences' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:25:14: warning eslint(no-unused-vars): Identifier 'and' is imported but never used. help: Consider removing this import.
```

#### `pnpm --filter nestjs-api build`

Exit 0. Nguyên văn output:

```text
$ nest build
```

#### `pnpm --filter nestjs-api test`

Chạy toàn bộ test suite. 996 test PASS; 26 test thất bại thuộc 2 file baseline đã biết (`test/coaching-loop-persistence.spec.ts` và `test/dataset-export-trust-boundary.spec.ts` cần Redis/Supabase) và 4 file rỗng `src/notifications/*.spec.ts` báo 0 test. Tất cả các test của `bouts`, `training`, `suspensions` đều PASS. Cuối output nguyên văn:

```text
 Test Files  6 failed | 58 passed (64)
      Tests  26 failed | 996 passed (1022)
   Start at  20:51:47
   Duration  689.79s (transform 8.85s, setup 0ms, import 83.82s, tests 767.27s, environment 20ms)

[ELIFECYCLE] Test failed. See above for more details.
Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL

  × "pnpm recursive run" failed in D:\MMA-TMS\nestjs-api
```

#### `pnpm --filter nestjs-api test:db`

Exit 0 (45/45 nhóm kiểm tra migration PASS trên PostgreSQL tạm thời). Cuối output nguyên văn:

```text
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
Migration checks passed: 45. PostgreSQL stopped after tests. Scratch: C:\Users\PC\AppData\Local\Temp\mma-migrations-vAgYar
```

#### `pnpm --filter nestjs-api db:check`

Exit 0. Nguyên văn output:

```text
$ node run_sql.mjs --check
001-027 checksums OK. No database connection was opened.
```

### Lệch so với ticket

- Hoàn toàn tuân thủ các phát hiện review F1–F6 và yêu cầu kỹ thuật của ticket T-007. Không thêm mã lỗi mới, không tạo endpoint mới, không thêm field hay enum mới. Không động tới `recordResult` hay Round E, `updateBout`, `resolveWeightClass`, `cancelBout`.

### Câu hỏi

- Không có câu hỏi nào. Toàn bộ 6 điểm review F1-F6 đã được xử lý triệt để và kiểm chứng hoàn chỉnh.

---

## Round G

- Nhánh: `User_Feature` (để nguyên các thay đổi uncommitted trên working tree theo chỉ định).
- Phạm vi Round G: Khắc phục chính xác 2 khiếm khuyết trong code Round E (R27) do Lead phát hiện: G1 (võ sĩ thắng do đối thủ bị truất quyền không bị đình chỉ DQ) và G2 (loại bỏ các nhánh silent skips trong `applyResultSuspensions`, biến `SuspensionsRepository` thành required dependency và kiểm thử việc reject). Mỗi lỗi đều có unit test chứng minh FAIL trên code cũ và PASS trên code mới.

### Danh mục sửa lỗi (1 dòng cho mỗi fix)

- **G1:** Trong `suggestSuspensions` (`suspensions.model.ts`), nhánh DQ kiểm tra `event.method === 'DQ' && event.result === 'LOSS'` để chỉ đình chỉ võ sĩ bị truất quyền (thua), không đình chỉ võ sĩ thắng (`WIN`), hoà (`DRAW`) hoặc không có kết quả (`NO_CONTEST`) do DQ, trong khi ngày nghỉ bắt buộc vẫn áp dụng bình thường; chứng minh bằng unit test model `DQ: WIN + DQ with a DQ rule creates NO DQ suspension (only mandatory rest if restDays > 0)` trong `suspensions.model.spec.ts` và unit test service `DQ: winner by DQ does not get a DQ suspension, only mandatory rest (G1)` trong `bouts.service.spec.ts`.
- **G2:** Trong `applyResultSuspensions` (`bouts.service.ts`), loại bỏ toàn bộ các dòng silent skip (`if (!this.suspensionsRepo) { return []; }`, kiểm tra `typeof findPriorKoTkoSuspensions === 'function'`, và kiểm tra `typeof insertSuspension === 'function'`), gọi trực tiếp các phương thức của `SuspensionsRepository`, và bảo đảm mock của `SuspensionsRepository` cung cấp đầy đủ các phương thức; chứng minh bằng unit test `a failure while querying prior suspensions rejects recordResult and leaves bout uncompleted (G2)` và unit test rollback `a failure while inserting the suspension rolls back the bout completion` trong `bouts.service.spec.ts`.

### Thay đổi

- `nestjs-api/src/suspensions/suspensions.model.ts`:
  - Trong `suggestSuspensions`, đổi điều kiện `if (event.method === 'DQ')` thành `if (event.method === 'DQ' && event.result === 'LOSS')`.
- `nestjs-api/src/bouts/bouts.service.ts`:
  - Trong `applyResultSuspensions`: xoá bỏ `if (!this.suspensionsRepo) { return []; }`; gọi trực tiếp `await this.suspensionsRepo.findPriorKoTkoSuspensions(bout.fighterId, undefined, bout.id, tx)`; xoá bỏ `if (typeof this.suspensionsRepo.insertSuspension !== 'function') { continue; }` và gọi trực tiếp `await this.suspensionsRepo.insertSuspension(...)`.
- Unit tests:
  - `nestjs-api/src/suspensions/suspensions.model.spec.ts`: thêm test cho G1 chứng minh `WIN + DQ` chỉ sinh `MANDATORY_REST` (nếu có restDays), không sinh đình chỉ `DQ`, và `DRAW`/`NO_CONTEST` cũng không sinh `DQ`.
  - `nestjs-api/src/bouts/bouts.service.spec.ts`:
    - Thêm test cho G1 ở tầng service: `recordResult` với `WIN + DQ` trên ruleset có luật DQ chỉ tạo đình chỉ `MANDATORY_REST` và chỉ gọi `insertSuspension` 1 lần cho `MANDATORY_REST`.
    - Thêm test cho G2: khi `findPriorKoTkoSuspensions` bị reject thì `recordResult` bị reject và trận đấu giữ nguyên `WEIGHED_IN` (không thành công âm thầm); giữ nguyên và kiểm chứng test khi `insertSuspension` bị reject thì rollback trận đấu về `WEIGHED_IN`.
    - Cập nhật mock `insertSuspension` trong khối describe ngoài cùng trả về đối tượng đầy đủ.

### Lệnh đã chạy

#### `pnpm --filter nestjs-api lint`

Exit 0. Không có cảnh báo hay lỗi ở bất kỳ file nào thuộc Round G; cuối output nguyên văn:

```text
src/coaching/coaching.service.ts:504:27: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/coaching/coaching.service.ts:534:27: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/coaching/coaching.service.ts:534:54: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
test/coaching-loop-persistence.spec.ts:13:3: warning eslint(no-unused-vars): Identifier 'trainingPlans' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:14:3: warning eslint(no-unused-vars): Identifier 'trainingSessions' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:15:3: warning eslint(no-unused-vars): Identifier 'videos' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:18:3: warning eslint(no-unused-vars): Identifier 'coachReviews' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:19:3: warning eslint(no-unused-vars): Identifier 'fighterBaselines' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:20:3: warning eslint(no-unused-vars): Identifier 'auditLogs' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:21:3: warning eslint(no-unused-vars): Identifier 'actionAssessments' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:22:3: warning eslint(no-unused-vars): Identifier 'actionFindingReviews' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:23:3: warning eslint(no-unused-vars): Identifier 'techniqueReferences' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:25:14: warning eslint(no-unused-vars): Identifier 'and' is imported but never used. help: Consider removing this import.
```

#### `pnpm --filter nestjs-api build`

Exit 0. Nguyên văn output:

```text
$ nest build
```

#### `pnpm --filter nestjs-api test`

Exit 1 (đúng baseline: 6 file lỗi gồm 4 file spec rỗng trong `src/notifications/` và 2 file integration `test/coaching-loop-persistence.spec.ts`, `test/dataset-export-trust-boundary.spec.ts` cần Redis/Supabase; toàn bộ 58 file unit test khác đều PASS với 999/999 test PASS, tăng thêm 3 test mới so với Round F: 996 -> 999). Cuối output nguyên văn:

```text
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/31]⎯


 Test Files  6 failed | 58 passed (64)
      Tests  26 failed | 999 passed (1025)
   Start at  21:49:20
   Duration  695.79s (transform 6.72s, setup 0ms, import 94.86s, tests 773.98s, environment 8ms)

[ELIFECYCLE] Test failed. See above for more details.
Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL

  × "pnpm recursive run" failed in D:\MMA-TMS\nestjs-api
```

Kiểm tra riêng `src/bouts` và `src/suspensions` (`pnpm --filter nestjs-api exec vitest run src/bouts src/suspensions`):

```text
 Test Files  12 passed (12)
      Tests  324 passed (324)
   Start at  21:48:31
   Duration  2.12s (transform 1.34s, setup 0ms, import 12.98s, tests 331ms, environment 1ms)
```

#### `pnpm --filter nestjs-api test:db`

Exit 0 (45/45 nhóm kiểm tra migration PASS trên PostgreSQL tạm thời). Cuối output nguyên văn:

```text
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
Migration checks passed: 45. PostgreSQL stopped after tests. Scratch: C:\Users\PC\AppData\Local\Temp\mma-migrations-43u3x8
```

#### `pnpm --filter nestjs-api db:check`

Exit 0. Nguyên văn output:

```text
$ node run_sql.mjs --check
001-027 checksums OK. No database connection was opened.
```

### Lệch so với ticket

- Hoàn toàn tuân thủ các chỉ định của Lead cho Round G. Không thêm mã lỗi mới, endpoint mới, field hay enum mới. Không động tới `updateBout`, `resolveWeightClass`, `cancelBout`, hay bất kỳ hàm nào khác.

### Câu hỏi

- Không có câu hỏi nào. Cả hai khiếm khuyết G1 và G2 đã được sửa triệt để và được chứng minh đầy đủ qua test.

