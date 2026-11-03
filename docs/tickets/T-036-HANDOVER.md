# T-036 Handover (Phần A — Backend)

- Nhánh: `feat/T-036-suspension-plan-link`    Commit: chưa commit (base `99d0dfd`)
- Trạng thái: IN REVIEW

## Thay đổi

- `nestjs-api/migrations/032_session_status_pending.sql`: Thêm migration `032` bổ sung giá trị `'PENDING'` vào enum `public.session_status` (có preflight ledger 024, advisory lock `(20260916, 32)`, ghi `mma_private.migration_history` version `32`).
- `nestjs-api/migrations/manifest.json`: Thêm SHA-256 checksum (LF) của `032_session_status_pending.sql`.
- `nestjs-api/scripts/migration-files.mjs`: Đăng ký `032_session_status_pending.sql` vào `migrationFiles` và `migration032`.
- `nestjs-api/run_sql.mjs`: Thêm cờ `--apply-032` vào `singleMigrationByFlag`.
- `nestjs-api/package.json`: Thêm script `db:migrate:032`.
- `nestjs-api/migrations/README.md`: Bổ sung mô tả migration `032_session_status_pending.sql` và lệnh `db:migrate:032`.
- `nestjs-api/scripts/test-migrations.mjs`: Thêm ca kiểm thử migration `032` áp trên DB đã có `024` (không cần `025`–`031`), kiểm tra `'PENDING'` trong `pg_enum` của `session_status`, ghi `migration_history` version `32`, từ chối chạy lại và từ chối DB thiếu `024`.
- `nestjs-api/src/database/schema.ts`: Thêm `'PENDING'` vào `sessionStatusEnum`.
- `nestjs-api/src/training/training.model.ts`: Thêm `'PENDING'` vào `SessionStatus`.
- `nestjs-api/src/training/training.constants.ts`: Thêm `PENDING: ['SCHEDULED', 'CANCELLED']` vào `ALLOWED_SESSION_TRANSITIONS`; giữ nguyên `TERMINAL_SESSION_STATUSES`.
- `nestjs-api/src/suspensions/suspensions.constants.ts`: Bổ sung hằng số và hàm lịch (`LOSS_OF_CONSCIOUSNESS_VALUES`, `TRAINING_PLAN_PHASES`, `REHAB_TRIGGER_SUSPENSION_REASONS`, `ACADEMY_UTC_OFFSET_MS`, `academyDateOf`, `addDaysToDate`, `daysBetweenDates`) làm nguồn duy nhất để `src/suspensions/` không import bất kỳ gì từ `src/training/` hay `src/bouts/`, và `src/bouts/bouts.model.ts` import từ đây.
- `nestjs-api/src/suspensions/suspension.effects.ts`: Tạo provider `SuspensionEffects` (`register` một lần duy nhất, `runOnCreated(suspensions, tx)` trả `{ affectedSessions, affectedPlans, afterCommit }`, trong đó `afterCommit` là no-op khi chưa có handler hoặc danh sách rỗng).
- `nestjs-api/src/suspensions/suspensions.module.ts`: Đăng ký `SuspensionEffects` trong `providers` và `exports`, giữ nguyên không import `TrainingModule` hay `BoutsModule`.
- `nestjs-api/src/suspensions/suspensions.model.ts`: Rút gọn `CONFLICT_ACTIONS = ['PENDING', 'CANCEL']`, cập nhật `ConflictProposal`, `planConflicts` (chỉ đề xuất `'CANCEL'` khi có lệnh cấm `requiresClearance = true`, ngược lại `'PENDING'`), thêm `affectedSessionSchema`, `affectedPlanSchema`, mở rộng `suspensionResponseSchema` và thêm `createSuspensionResponseSchema`.
- `nestjs-api/src/suspensions/suspensions.dto.ts`: Cập nhật `ConflictProposalResponseDto`, thêm `AffectedSessionDto`, `AffectedPlanDto`, `CreateSuspensionResponseDto`.
- `nestjs-api/src/suspensions/suspensions.controller.ts`: Cập nhật Swagger response model của `POST /suspensions` sang `CreateSuspensionResponseDto`.
- `nestjs-api/src/suspensions/suspensions.service.ts`: Inject `SuspensionEffects`, gọi `this.suspensionEffects.runOnCreated([row], tx)` trong cùng transaction `createSuspension`, gọi `await effects.afterCommit()` sau khi transaction resolve, và trả kèm `affectedSessions`, `affectedPlans` (không đưa `afterCommit` vào response JSON).
- `nestjs-api/src/bouts/bouts.model.ts`, `nestjs-api/src/bouts/bouts.dto.ts`, `nestjs-api/src/bouts/bouts.service.ts`: Mở rộng `recordResultSuspensionSchema` với `affectedSessions` và `affectedPlans`, thêm `RecordResultSuspensionDto`, inject `SuspensionEffects` vào `BoutsService`, gọi `runOnCreated` một lần cho tất cả lệnh cấm vừa tạo trong transaction `recordResult`, và gọi `await afterCommit()` sau khi transaction resolve.
- `nestjs-api/src/training/training.repo.ts`: Thêm `lockActiveCampPlansByFighterId(fighterId, transaction)` có `.for('update')` theo thứ tự `id` tăng dần; cho phép cập nhật `status` trong `updateSession`.
- `nestjs-api/src/training/sessions/training-session.service.ts`: Thêm `applySessionPendingInTransaction`; cập nhật `applySessionUpdateInTransaction` để khi buổi `PENDING` có `scheduledAt` mới thì kiểm tra Cổng 2 (`assertNotSuspended`) và chuyển `status: 'SCHEDULED'` trong cùng `UPDATE`; chặn `PATCH /training-sessions/:id/status` chuyển trực tiếp `PENDING -> SCHEDULED` với `400 INVALID_SESSION_STATUS_TRANSITION`.
- `nestjs-api/src/training/training-suspension-conflicts.service.ts`: Implement `OnModuleInit` đăng ký `handleSuspensionsCreated` vào `SuspensionEffects`; cập nhật `applyConflicts` cho `PENDING` và `CANCEL`; tự động lọc theo các đình chỉ vừa tạo (`filterProposalsForSuspension`), khoá và bỏ qua buổi không còn `SCHEDULED` (`skipIfNotScheduled`), áp `CANCEL`/`PENDING` cho các buổi trùng lịch, chuyển các kế hoạch `ACTIVE` có `phase IN ('fight_camp', 'taper')` sang `'rehab'` khi có lệnh cấm `KO`/`TKO`/`MEDICAL`, và trả hàm `afterCommit` chỉ gửi `TRAINING_SESSION_CANCELLED` cho các buổi bị `CANCEL` sau khi transaction đã commit.
- `nestjs-api/src/training/training-suspension-conflicts.controller.ts`: Cập nhật mô tả Swagger của `GET /suspensions/:id/conflicts` và `POST /suspensions/:id/conflicts/apply` theo hành vi `PENDING`/`CANCEL` và thông báo huỷ sau commit.
- Các file unit test: `src/suspensions/suspensions.dto.spec.ts`, `src/suspensions/suspensions.model.spec.ts`, `src/suspensions/suspensions.service.spec.ts`, `src/training/training.model.spec.ts`, `src/training/training-suspension-conflicts.service.spec.ts`, `src/training/sessions/training-session.service.spec.ts`, `src/bouts/bouts.service.spec.ts`.

## Lượt sửa 1 (theo phản hồi review)

1. **CHẶN 1 — Gửi thông báo huỷ buổi SAU khi transaction commit (`afterCommit`):**
   - `nestjs-api/src/suspensions/suspension.effects.ts:9-13,20,30-45`: Thêm `afterCommit: () => Promise<void>` vào `SuspensionEffectResult`; `runOnCreated` trả `afterCommit` no-op khi chưa có handler hoặc `suspensions` rỗng.
   - `nestjs-api/src/training/training-suspension-conflicts.service.ts:88-98,198-209`: `handleSuspensionsCreated` không gọi `notifySessionCancelled` trực tiếp trong transaction mà đóng gói vào `afterCommit` của `SuspensionEffectResult`.
   - `nestjs-api/src/suspensions/suspensions.service.ts:109-141`: `createSuspension` gọi `await effects.afterCommit()` sau khi `this.repo.transaction(...)` resolve, và chỉ trả `affectedSessions`, `affectedPlans` trong response JSON.
   - `nestjs-api/src/bouts/bouts.service.ts:1502-1573,1579-1677`: `applyResultSuspensions` trả `{ suspensions, afterCommit }`, và `recordResult` gọi `await afterCommit()` sau khi `this.repo.transaction(...)` resolve, không đưa `afterCommit` vào `suspensions` trong response JSON.
   - **Test tương ứng:**
     - `nestjs-api/src/training/training-suspension-conflicts.service.spec.ts:975-1136` (`afterCommit notification hook: (a) does not call notifySessionCancelled if transaction throws after runOnCreated; (b) calls notifySessionCancelled once per CANCEL session after transaction commit; (c) sends no notification for PENDING sessions`).
     - `nestjs-api/src/suspensions/suspensions.service.spec.ts:466-543` (`invokes SuspensionEffects.runOnCreated inside the create transaction, calls afterCommit only after transaction resolves, and omits afterCommit from response JSON (Criterion 3)`).
     - `nestjs-api/src/bouts/bouts.service.spec.ts:3841-4138` (`runs SuspensionEffects.runOnCreated once with both KO and MANDATORY_REST suspensions via real TrainingSuspensionConflictsService, cancels conflicting session, transitions fight_camp plan to rehab, sends notification only after commit, and leaves committed state & notifications untouched when transaction fails after runOnCreated (Criterion 4)`).
2. **NÊN SỬA 2 — Bỏ `@Optional()` và giá trị mặc định `= new SuspensionEffects()` ở constructor:**
   - Đã bỏ ở `SuspensionsService` (`nestjs-api/src/suspensions/suspensions.service.ts:39-42`), `BoutsService` (`nestjs-api/src/bouts/bouts.service.ts:122-126`), và `TrainingSuspensionConflictsService` (`nestjs-api/src/training/training-suspension-conflicts.service.ts:74-80`).
   - Cập nhật khởi tạo trong `nestjs-api/src/suspensions/suspensions.service.spec.ts:131`, `nestjs-api/src/bouts/bouts.service.spec.ts:266,3372`, và dùng chung một instance `SuspensionEffects` trong `nestjs-api/src/training/training-suspension-conflicts.service.spec.ts:225,238,704,775,864,1032`.
3. **NÊN SỬA 3 — Bỏ optional call `this.repo.lockActiveCampPlansByFighterId?.(` thành gọi thẳng:**
   - `nestjs-api/src/training/training-suspension-conflicts.service.ts:180-183`: Gọi thẳng `await this.repo.lockActiveCampPlansByFighterId(fighterId, transaction)`.
   - Mock `lockActiveCampPlansByFighterId` có sẵn trong `repositoryMock()` tại `nestjs-api/src/training/training-suspension-conflicts.service.spec.ts:159`.

## Lượt sửa 2 (theo phản hồi review độc lập)

1. **NÊN SỬA 1 — Giới hạn đề xuất tự động áp trong `handleSuspensionsCreated` vào các đình chỉ vừa tạo (hành động `PENDING`/`CANCEL` vẫn tính trên mọi đình chỉ có hiệu lực):**
   - `nestjs-api/src/training/training-suspension-conflicts.service.ts:125-138`: Sau khi tính `allProposals = planConflicts(sessions, allSuspensions)`, lọc lại qua `filterProposalsForSuspension(allProposals, createdSusp, sessions)` cho từng `createdSusp` trong `fighterCreated` và gộp theo `sessionId` trước khi áp.
   - **Test:** `nestjs-api/src/training/training-suspension-conflicts.service.spec.ts:735-848` (`only applies proposals for sessions blocked by the newly created suspension(s), leaving a SCHEDULED session under an older non-overlapping OTHER suspension untouched`).
2. **NÊN SỬA 2 — Bỏ qua buổi không còn `SCHEDULED` sau khi khoá hàng trong `handleSuspensionsCreated`:**
   - `nestjs-api/src/training/training-suspension-conflicts.service.ts:41-47,141-174`: Truyền `skipIfNotScheduled` vào tham số `onLocked` của `applySessionCancelInTransaction` và `applySessionPendingInTransaction`; nếu buổi sau khi khoá có `status !== 'SCHEDULED'` (ví dụ đã chuyển sang `IN_PROGRESS` hoặc `CANCELLED` bởi thao tác đồng thời) thì bỏ qua (không cập nhật, không ném lỗi, không thêm vào `affectedSessions`, không gửi thông báo).
   - **Test:** `nestjs-api/src/training/training-suspension-conflicts.service.spec.ts:850-973` (`skips sessions that are no longer SCHEDULED after row locking without modifying them, throwing, or adding them to affectedSessions: (a) coach starts session to IN_PROGRESS concurrently during CANCEL; (b) concurrent suspension already moved session to CANCELLED before PENDING`).
3. **NÊN SỬA 3 — Viết lại test Tiêu chí 4 trong `bouts.service.spec.ts` dùng `TrainingSuspensionConflictsService` và `TrainingSessionService` thật kèm kiểm tra transaction `tx` nghiêm ngặt:**
   - `nestjs-api/src/bouts/bouts.service.spec.ts:3841-4138`: Dùng `TrainingSuspensionConflictsService` + `TrainingSessionService` thật đăng ký vào `SuspensionEffects`, và dùng `WeakMap<Transaction, ...>` cho `trainingRepoMock` bắt buộc mọi thao tác đọc/khoá/ghi (`findScheduledSessionsByFighterId`, `lockSessionById`, `updateSessionStatus`, `lockActiveCampPlansByFighterId`, `updatePlan`) phải truyền đúng đối tượng `activeTx` (thiếu hoặc sai `tx` sẽ ném lỗi ngay), chỉ commit buffer vào `committedSession`/`committedPlan` khi `repo.transaction` hoàn tất không lỗi, và kiểm tra `callOrder` chứng minh thông báo huỷ chỉ gửi sau `tx:commit` và không gửi khi `tx:rollback`.
   - **Test:** `nestjs-api/src/bouts/bouts.service.spec.ts:3841-4138` (`runs SuspensionEffects.runOnCreated once with both KO and MANDATORY_REST suspensions via real TrainingSuspensionConflictsService, cancels conflicting session, transitions fight_camp plan to rehab, sends notification only after commit, and leaves committed state & notifications untouched when transaction fails after runOnCreated (Criterion 4)`).
4. **NÊN SỬA 4 — Khôi phục định nghĩa `DEFAULT_MANUAL_BLOCKED_SESSION_TYPES` theo T-035:**
   - `nestjs-api/src/suspensions/suspensions.model.ts:52-53`: Đổi lại thành `SESSION_TYPES.filter((t) => t !== 'RECOVERY' && t !== 'PHYSICAL_THERAPY')`.
5. **NÊN SỬA 5 — Cập nhật mô tả Swagger trong `TrainingSuspensionConflictsController`:**
   - `nestjs-api/src/training/training-suspension-conflicts.controller.ts:55-60,82-87`: Cập nhật `description` của `GET /suspensions/:id/conflicts` và `POST /suspensions/:id/conflicts/apply` sang `PENDING`/`CANCEL` và thông báo huỷ sau commit.
6. **GỢI Ý 6 — Thêm test `POST /suspensions/:id/conflicts/apply` với `action: 'CHANGE_TYPE'` bị lỗi validation:**
   - **Test:** `nestjs-api/src/training/training-suspension-conflicts.service.spec.ts:505-524` (`rejects POST apply payload containing legacy action CHANGE_TYPE with 422 VALIDATION_ERROR`).
7. **GỢI Ý 7 — Giữ một nguồn duy nhất cho `academyDateOf`, `addDaysToDate`, `daysBetweenDates`, `ACADEMY_UTC_OFFSET_MS`, `LOSS_OF_CONSCIOUSNESS_VALUES` ở `suspensions.constants.ts`:**
   - `nestjs-api/src/suspensions/suspensions.constants.ts:35-41,59-81`: Export `ACADEMY_UTC_OFFSET_MS`, `academyDateOf`, `addDaysToDate`, `daysBetweenDates`, `LOSS_OF_CONSCIOUSNESS_VALUES`, `type LossOfConsciousness`.
   - `nestjs-api/src/bouts/bouts.model.ts:12-22,113-118,918`: Import từ `../suspensions/suspensions.constants.js` và re-export để không nhân đôi mã nguồn.

## Đối chiếu tiêu chí nghiệm thu

| Tiêu chí (theo ticket) | Đáp ứng ở đâu (`file:dòng`, test nào) |
| --- | --- |
| **1.** Migration `032_session_status_pending.sql`: áp thành công trên DB đã có `024` (không cần `025`–`031`), thêm `'PENDING'` vào `session_status`, ghi `migration_history` version `32`, từ chối chạy lại và từ chối DB thiếu `024`; `pnpm --filter nestjs-api db:check` và `pnpm --filter nestjs-api test:db` qua. | Code: `nestjs-api/migrations/032_session_status_pending.sql:1-60`, `nestjs-api/migrations/manifest.json:33`, `nestjs-api/scripts/migration-files.mjs:33,44`, `nestjs-api/run_sql.mjs:59`, `nestjs-api/package.json:45`.<br>Test: `nestjs-api/scripts/test-migrations.mjs:990-1020` (`032 applies on ledger 24 without 025-031, adds PENDING to session_status, and rejects re-application or missing 024`). |
| **2.** `planConflicts`: trả `{ sessionId, action: 'PENDING' }` khi lệnh cấm chặn buổi có `requiresClearance = false` (kể cả khi `RECOVERY` nằm hay không nằm trong `blockedSessionTypes`); trả `{ sessionId, action: 'CANCEL' }` khi có ít nhất một lệnh cấm chặn buổi có `requiresClearance = true` (cả trong kỳ `ACTIVE` và khi quá `endsOn` nhưng `clearedAt IS NULL`); không bao giờ trả `RESCHEDULE` hay `DOWNGRADE_TO_RECOVERY`; bỏ qua buổi có `status = 'PENDING'`. | Code: `nestjs-api/src/suspensions/suspensions.model.ts:69-70,181-232`.<br>Test: `nestjs-api/src/suspensions/suspensions.model.spec.ts:303-459` (`proposes PENDING when blocking suspension does not require clearance (whether RECOVERY is blocked or not)`, `proposes CANCEL when a blocking suspension requires clearance (both during ACTIVE and when AWAITING_CLEARANCE)`, `proposes CANCEL when two blocking suspensions overlap on the same session and one has requiresClearance = true while the other is false`, `produces nothing for an unblocked session type, a session outside the period, or a non-SCHEDULED session (including PENDING), and ignores soft-deleted or cleared records`). |
| **3.** `POST /suspensions` tạo lệnh cấm `DQ` (`requiresClearance = false`, 10 ngày): buổi `SPARRING` `SCHEDULED` trong kỳ tự động chuyển sang `PENDING` trong cùng transaction, response có `affectedSessions: [{ sessionId, action: 'PENDING' }]` và `affectedPlans: []`, không gửi thông báo huỷ buổi. | Code: `nestjs-api/src/suspensions/suspensions.service.ts:109-141`, `nestjs-api/src/training/training-suspension-conflicts.service.ts:41-47,88-209`, `nestjs-api/src/training/sessions/training-session.service.ts:214-231`.<br>Test: `nestjs-api/src/training/training-suspension-conflicts.service.spec.ts:675-733,735-848,850-973,975-1136` (`Criterion 3: POST /suspensions creating a DQ suspension...`, `only applies proposals for sessions blocked by the newly created suspension(s)...`, `skips sessions that are no longer SCHEDULED after row locking...`, `afterCommit notification hook: (a)... (b)... (c)...`), `nestjs-api/src/suspensions/suspensions.service.spec.ts:466-543` (`invokes SuspensionEffects.runOnCreated inside the create transaction, calls afterCommit only after transaction resolves, and omits afterCommit from response JSON (Criterion 3)`). |
| **4.** `POST /bouts/:id/result` tạo cả lệnh cấm `KO` (`requiresClearance = true`) và `MANDATORY_REST`: `SuspensionEffects.runOnCreated` được gọi một lần với cả hai lệnh cấm, buổi trùng lịch bị `CANCEL`, kế hoạch `fight_camp` chuyển sang `rehab`, và khi cố tình ném lỗi trong transaction sau `runOnCreated`, buổi vẫn giữ trạng thái cũ. | Code: `nestjs-api/src/bouts/bouts.service.ts:1554-1573,1630-1677`, `nestjs-api/src/training/training-suspension-conflicts.service.ts:88-209`.<br>Test: `nestjs-api/src/bouts/bouts.service.spec.ts:3841-4138` (`runs SuspensionEffects.runOnCreated once with both KO and MANDATORY_REST suspensions via real TrainingSuspensionConflictsService, cancels conflicting session, transitions fight_camp plan to rehab, sends notification only after commit, and leaves committed state & notifications untouched when transaction fails after runOnCreated (Criterion 4)`). |
| **5.** Buổi `PENDING`: `PATCH` đổi `scheduledAt` sang ngày sau `endsOn` chuyển `status` sang `'SCHEDULED'` trong cùng `UPDATE`; `PATCH` đổi `scheduledAt` vào ngày vẫn trong kỳ cấm trả `409 TRAINING_SUSPENSION_ACTIVE` và giữ `'PENDING'`; `PATCH /:id/status` sang `'IN_PROGRESS'` hoặc `'SCHEDULED'` trả `400 INVALID_SESSION_STATUS_TRANSITION`; sang `'CANCELLED'` kèm `cancellationReason` thành công và gửi `TRAINING_SESSION_CANCELLED`. | Code: `nestjs-api/src/training/training.constants.ts:25`, `nestjs-api/src/training/sessions/training-session.service.ts:192-211,299-325`, `nestjs-api/src/training/training.repo.ts:610-629`.<br>Test: `nestjs-api/src/training/sessions/training-session.service.spec.ts:1242-1350` (`reschedules a PENDING session past endsOn to SCHEDULED in the same UPDATE, rejects rescheduling into suspension with 409 keeping PENDING, rejects status transition to IN_PROGRESS or SCHEDULED with 400, and allows CANCELLED with notification (Criterion 5)`). |
| **6.** Tự động đổi phase kế hoạch: lệnh cấm `KO`, `TKO`, `MEDICAL` chuyển kế hoạch `ACTIVE` có `phase` là `fight_camp` hoặc `taper` sang `rehab`; giữ nguyên kế hoạch có `phase` là `base`, `build`, `rehab`, `maintenance`, hoặc `status` khác `ACTIVE`, hoặc đã xoá mềm; lệnh cấm `DQ`, `MANDATORY_REST`, `OTHER` không đổi phase kế hoạch nào. | Code: `nestjs-api/src/suspensions/suspensions.constants.ts:53-57`, `nestjs-api/src/training/training.repo.ts:473-495`, `nestjs-api/src/training/training-suspension-conflicts.service.ts:176-205`.<br>Test: `nestjs-api/src/training/training-suspension-conflicts.service.spec.ts:1138-1266` (`Criterion 6: KO, TKO, and MEDICAL suspensions transition ACTIVE fight_camp and taper plans to rehab, while ignoring base/build/rehab/maintenance/non-ACTIVE/soft-deleted plans and ignoring DQ/MANDATORY_REST/OTHER reasons`). |
| **7.** `SuspensionEffects`: khi không có handler đăng ký, `runOnCreated` trả `{ affectedSessions: [], affectedPlans: [] }` (kèm `afterCommit` no-op); gọi `register` lần hai ném lỗi. | Code: `nestjs-api/src/suspensions/suspension.effects.ts:20-46`.<br>Test: `nestjs-api/src/suspensions/suspensions.service.spec.ts:546-570` (`returns empty affectedSessions, affectedPlans, and no-op afterCommit when no handler is registered, and throws when register is called a second time`), `nestjs-api/src/training/training-suspension-conflicts.service.spec.ts:505-524` (`rejects POST apply payload containing legacy action CHANGE_TYPE with 422 VALIDATION_ERROR`). |
| **8.** `src/suspensions/` không có bất kỳ dòng import nào từ `src/training/` hay `src/bouts/` (`git grep -n "from.*\(training\|bouts\)" nestjs-api/src/suspensions/` trả rỗng). | Code: `nestjs-api/src/suspensions/suspensions.constants.ts:1-81`, `nestjs-api/src/suspensions/suspensions.model.ts:1-35`, `nestjs-api/src/suspensions/suspension.effects.ts:1-8`, `nestjs-api/src/suspensions/suspensions.module.ts:1-24`.<br>Kiểm tra: `git grep -n "from.*\(training\|bouts\)" -- "nestjs-api/src/suspensions/"` trả rỗng (`EXIT:1`). |
| **9.** Các DTO response mới hoặc mở rộng (`CreateSuspensionResponseDto`, `RecordResultResponseDto` hoặc DTO con của `suspensions` trong đó) có test kiểm tra schema không chứa kiểu `Date` không thể chuyển sang JSON Schema. | Code: `nestjs-api/src/suspensions/suspensions.dto.ts:24-40`, `nestjs-api/src/bouts/bouts.dto.ts:80-86`.<br>Test: `nestjs-api/src/suspensions/suspensions.dto.spec.ts:14-34` (`converts ConflictProposalResponseDto, AffectedSessionDto, AffectedPlanDto, CreateSuspensionResponseDto, and SuspensionResponseDto to JSON Schema without errors`), `nestjs-api/src/bouts/bouts.service.spec.ts:4140-4144` (`serializes RecordResultSuspensionDto and RecordResultResponseDto to JSON Schema without Date errors (Criterion 9)`). |

## Lệnh đã chạy

### 1. `pnpm --filter nestjs-api lint`
```text
$ oxlint src/ test/
src/notifications/notifications.service.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
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
src/notifications/notification-stream.service.ts:91:33: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:318:24: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:319:33: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:333:31: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/notifications/notification-producer.service.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/coaching/result-receipt.spec.ts:22:5: warning unicorn(no-thenable): Do not add `then` to a class. help: If an object is defined as 'thenable', once it's accidentally used in an await expression, it may cause problems
src/dataset-export/services/governance-verifier.service.ts:45:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/dataset-export/services/governance-verifier.service.ts:46:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/coaching/movement-review.service.spec.ts:32:5: warning unicorn(no-thenable): Do not add `then` to a class. help: If an object is defined as 'thenable', once it's accidentally used in an await expression, it may cause problems
src/notifications/notification-distribution.service.spec.ts:7:3: warning eslint(no-unused-vars): Identifier 'NOTIFICATION_DISTRIBUTION_EVENT' is imported but never used. help: Consider removing this import.
src/notifications/notification-distribution.service.spec.ts:74:9: warning eslint(no-unused-vars): Variable 'subscribedEmitted' is declared but never used. Unused variables should start with a '_'. help: Consider removing this declaration.
src/notifications/notifications.config.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/dataset-export/dto/promotion-request.dto.ts:8:3: warning eslint(no-unused-vars): Identifier 'Matches' is imported but never used. help: Consider removing this import.
src/dataset-export/dto/candidate-export.dto.ts:15:29: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/dataset-export/services/authoritative-governance.service.ts:6:3: warning eslint(no-unused-vars): Identifier 'ConflictException' is imported but never used. help: Consider removing this import.
src/dataset-export/services/authoritative-governance.service.ts:10:81: warning eslint(no-unused-vars): Identifier 'coaches' is imported but never used. help: Consider removing this import.
src/dataset-export/services/authoritative-governance.service.ts:11:14: warning eslint(no-unused-vars): Identifier 'and' is imported but never used. help: Consider removing this import.
src/dataset-export/services/authoritative-governance.service.ts:86:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/dataset-export/services/authoritative-governance.service.ts:87:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/app.module.ts:18:10: warning eslint(no-unused-vars): Identifier 'NotificationsModule' is imported but never used. help: Consider removing this import.
src/medical/scat6.model.spec.ts:5:3: warning eslint(no-unused-vars): Identifier 'scat6ScoresSchema' is imported but never used. help: Consider removing this import.
src/main.ts:7:10: warning eslint(no-unused-vars): Identifier 'createOpenApiDocument' is imported but never used. help: Consider removing this import.
src/coaching/coaching.service.ts:12:13: warning eslint(no-unused-vars): Identifier 'crypto' is imported but never used. help: Consider removing this import.
src/coaching/coaching.service.ts:13:24: warning eslint(no-unused-vars): Type 'DrizzleDB' is imported but never used. help: Consider removing this import.
src/coaching/coaching.service.ts:182:16: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/coaching/coaching.service.ts:520:27: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/coaching/coaching.service.ts:550:27: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/coaching/coaching.service.ts:550:54: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
```
*(Kết quả: exit code 0, 0 error)*

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
      Tests  1037 passed (1037)
   Start at  14:22:27
   Duration  4.65s (transform 4.22s, setup 0ms, import 54.15s, tests 3.22s, environment 6ms)
```
*(Ghi chú: 2 file integration đóng băng `test/coaching-loop-persistence.spec.ts` [5 test] và `test/dataset-export-trust-boundary.spec.ts` [21 test] cần Redis ở `127.0.0.1:6379` theo `docs/tickets/BASELINE.md` mục B1 và mỗi test treo `beforeEach`/`afterEach` 30 giây khi không có Redis [tổng ~11 phút, vượt ngưỡng chạy đồng bộ 10 giây khi không chạy nền]. Khi chạy toàn bộ 63 file còn lại `src/ test/coaching-auth-boundary.spec.ts test/tl10-production-cryptography.spec.ts`: **1037 passed / 0 failed** trên 59 file có test + 4 file spec rỗng có sẵn ở B2; tính cả 26 lỗi Redis có sẵn ở B1 là **1037 passed / 26 failed trên 1063 tests**, không thêm lỗi mới so với baseline).*

### 4. `pnpm --filter nestjs-api test:db`
```text
PASS 023 applies on ledger 20, rejects second row, and records ledger 23
PASS 024 applies on ledger 23, seeds three presets and wires bouts, requirements and permissions
PASS 024 requires ledger 23 and leaves nothing behind on a collision
PASS 027 applies directly after 024: defaults, constraints, upsert, audit, cascade and RLS
PASS 025 applies on ledger 24: enum, table, constraints, permissions, notifications, triggers and RLS
PASS 025 rejects missing ledger 24 and collisions atomically
PASS 027 rejects missing ledger 24 and collisions atomically
PASS 032 applies on ledger 24 without 025-031, adds PENDING to session_status, and rejects re-application or missing 024
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
Migration checks passed: 46. PostgreSQL stopped after tests. Scratch: C:\Users\PC\AppData\Local\Temp\mma-migrations-Vzx3Uw
```
*(Kết quả: exit code 0, 46 checks passed)*

### 5. `pnpm --filter nestjs-api db:check`
```text
$ node run_sql.mjs --check
001-032 checksums OK. No database connection was opened.
```
*(Kết quả: exit code 0)*

### 6. `git grep -n "from.*\(training\|bouts\)" -- "nestjs-api/src/suspensions/"`
```text
GREP_EXIT:1
```
*(Kết quả: không có dòng import nào từ `training` hay `bouts` trong `nestjs-api/src/suspensions/`)*

## Lệch so với ticket

Không có

## Câu hỏi / việc còn mở

Không có


---

# Phần A2: Buổi "Chờ xếp lại" khi có thêm đình chỉ cần xác nhận

## Thay đổi

- `nestjs-api/src/training/training.repo.ts`:
  - Thêm phương thức `findPendingSessionsByFighterId(fighterId: string, database: DatabaseExecutor = this.db): Promise<TrainingSessionEntity[]>` đọc các buổi tập có `status = 'PENDING'`, `deleted_at IS NULL` của võ sĩ, sắp xếp theo `scheduled_at ASC, id ASC`.
- `nestjs-api/src/training/training-suspension-conflicts.service.ts`:
  - Thêm lỗi nội bộ `SessionNoLongerPendingError` và hàm `skipIfNotPending(locked: TrainingSessionEntity): void`.
  - Tách hàm `isSessionBlockedBySuspension(session, suspension)` dùng chung việc kiểm tra ngày và loại buổi tập bị đình chỉ chặn (xét `startsOn <= sessionDate` cho đình chỉ cần xác nhận chưa xác nhận, hoặc `startsOn <= sessionDate <= endsOn`).
  - Thêm hàm `loadFighterPendingSessions(fighterId, database)`.
  - Cập nhật `handleSuspensionsCreated`: trong cùng transaction tạo đình chỉ, với mỗi đình chỉ vừa tạo có `requiresClearance = true`, lọc các buổi `PENDING` có ngày nằm trong khoảng hiệu lực và loại nằm trong `blockedSessionTypes`; gộp các thao tác (`SCHEDULED` proposal và `PENDING` cancel) vào `mutationsBySessionId` theo `sessionId` (tránh lặp buổi/thông báo); sắp xếp theo `sessionId` tăng dần để khoá hàng theo thứ tự xác định; huỷ buổi `PENDING` bằng `applySessionCancelInTransaction` với lý do `SUSPENSION_CONFLICT_CANCELLATION_REASON` và `skipIfNotPending` (bỏ qua nếu sau khi khoá buổi không còn `PENDING`); bổ sung vào `affectedSessions` (`action: 'CANCEL'`) và `cancelledToNotify` (gửi thông báo huỷ sau commit qua `afterCommit`).
- `nestjs-api/src/training/training-suspension-conflicts.service.spec.ts`:
  - Bổ sung mock `findPendingSessionsByFighterId` vào `repositoryMock`.
  - Thêm bộ test P1–P7 trong describe block `Part A2: PENDING sessions when creating new suspensions (P1–P7)` sử dụng transactional harness với `WeakMap<Transaction, ...>` kiểm tra `tx` nghiêm ngặt và xác thực thứ tự thông báo sau commit.
- `nestjs-api/src/bouts/bouts.service.spec.ts`:
  - **(N1)**: Khắc phục lỗi type mismatch (TS2322) của `notifyResolved` trong `notificationsMock` bằng cách định kiểu tường minh theo `NotificationPublisher['notifyResolved']` và `NotificationPublisher['notify']`.
  - **(N2)**: Bổ sung kiểm tra `tx` nghiêm ngặt cho `suspensionsRepo.insertSuspension` và `suspensionsRepo.findSuspensionsByFighterId` thông qua `requireTxBuffer`, đồng thời lưu trữ `suspensions` trong `txBuffers` (chỉ commit sang `committedSuspensions` khi transaction thành công).
  - Thêm ca kiểm thử P6 tương ứng cho đường ghi kết quả trận KO: buổi `S1` `PENDING` được xử lý trong transaction của `recordResult`, nhưng khi transaction ném lỗi sau `runOnCreated` thì rollback hoàn toàn, `S1` giữ nguyên trạng thái `PENDING` và không gửi thông báo nào.

## Đối chiếu tiêu chí nghiệm thu P1–P7 (Mục 5b)

| Ca | Dữ liệu trước | Hành động | Kết quả mong đợi | Đáp ứng ở đâu (`file:dòng`) |
| --- | --- | --- | --- | --- |
| **P1** | Buổi `S1` `SPARRING` 2026-11-05 trạng thái `PENDING` (do đình chỉ `OTHER` 2026-11-01..07 không cần xác nhận) | Tạo đình chỉ `KO` từ 2026-11-04, cần xác nhận | `S1` thành `CANCELLED`, lý do `'Suspension in force'`; `affectedSessions` có `{S1, CANCEL}`; thông báo huỷ gửi đúng 1 lần, **sau** commit | `nestjs-api/src/training/training-suspension-conflicts.service.spec.ts:1486-1526` (`P1: cancels a PENDING SPARRING session (S1 on 2026-11-05 from prior OTHER 2026-11-01..07) when a KO suspension starting 2026-11-04 (requiresClearance = true) is created, sets reason "Suspension in force", returns {S1, CANCEL} in affectedSessions, and sends cancel notification once strictly after commit`) |
| **P2** | Như P1 | Tạo đình chỉ `MANDATORY_REST` 2026-11-04..06 (không cần xác nhận) | `S1` vẫn `PENDING`; `affectedSessions` rỗng; không thông báo | `nestjs-api/src/training/training-suspension-conflicts.service.spec.ts:1528-1558` (`P2: keeps S1 in PENDING with empty affectedSessions and no notification when a MANDATORY_REST suspension (2026-11-04..06, requiresClearance = false) is created`) |
| **P3** | `S2` `RECOVERY` `PENDING` 2026-11-05 | Tạo `KO` mặc định (không chặn `RECOVERY`) | `S2` không đổi | `nestjs-api/src/training/training-suspension-conflicts.service.spec.ts:1560-1590` (`P3: leaves PENDING RECOVERY session S2 on 2026-11-05 untouched when creating a default KO suspension (RECOVERY not blocked)`) |
| **P4** | `S3` `SPARRING` `PENDING` 2026-10-20 (trước `startsOn` của KO 2026-11-04) | Tạo `KO` từ 2026-11-04 | `S3` không đổi | `nestjs-api/src/training/training-suspension-conflicts.service.spec.ts:1592-1622` (`P4: leaves PENDING SPARRING session S3 on 2026-10-20 (before KO startsOn 2026-11-04) untouched when creating a KO suspension from 2026-11-04`) |
| **P5** | `S1` `PENDING` lúc đọc; lúc khoá đã `CANCELLED` (HLV vừa huỷ) | Tạo `KO` | Không ném lỗi; `S1` không đổi; không có trong `affectedSessions` | `nestjs-api/src/training/training-suspension-conflicts.service.spec.ts:1624-1656` (`P5: does not throw, does not modify S1, and omits S1 from affectedSessions when S1 is PENDING on read but already CANCELLED when locked`) |
| **P6** | Như P1 nhưng transaction ném lỗi sau `runOnCreated` | Ghi kết quả trận thua KO | `S1` vẫn `PENDING` (không promote); không thông báo | `nestjs-api/src/bouts/bouts.service.spec.ts:4228-4471` (`P6: keeps PENDING SPARRING session S1 (on 2026-11-05 from prior OTHER 2026-11-01..07) in PENDING without promoting staged CANCEL or sending notification when recordResult (KO loss on 2026-11-04) transaction fails after runOnCreated`) & `nestjs-api/src/training/training-suspension-conflicts.service.spec.ts:1658-1695` (`P6: keeps S1 in PENDING (does not promote staged CANCEL) and sends no notification when transaction throws after runOnCreated`) |
| **P7** | Ca cũ của lượt sửa 2 (C1–C9) | — | Vẫn qua, không sửa kết quả mong đợi | `nestjs-api/src/training/training-suspension-conflicts.service.spec.ts:1697-1703` (`P7: DEFAULT_MANUAL_BLOCKED_SESSION_TYPES is SESSION_TYPES minus RECOVERY and PHYSICAL_THERAPY (C7); C1–C9 tests above run unchanged`), kết hợp cùng các test C1–C5, C8 ở `training-suspension-conflicts.service.spec.ts:505,735,850`, C6 ở `bouts.service.spec.ts:3896`, C7 ở `suspensions.model.spec.ts`. |

## Output lỗi của P1 trước khi sửa code

```text
 FAIL  src/training/training-suspension-conflicts.service.spec.ts > TrainingSuspensionConflictsService (R28 / T-036) > Part A2: PENDING sessions when creating new suspensions (P1–P7) > P1: cancels a PENDING SPARRING session (S1 on 2026-11-05 from prior OTHER 2026-11-01..07) when a KO suspension starting 2026-11-04 (requiresClearance = true) is created, sets reason "Suspension in force", returns {S1, CANCEL} in affectedSessions, and sends cancel notification once strictly after commit
AssertionError: expected 'PENDING' to be 'CANCELLED' // Object.is equality

Expected: "CANCELLED"
Received: "PENDING"

 ❯ src/training/training-suspension-conflicts.service.spec.ts:1512:35
    1510|
    1511|       const [committedS1] = getCommittedSessions();
    1512|       expect(committedS1?.status).toBe('CANCELLED');
       |                                   ^
    1513|       expect(committedS1?.cancellationReason).toBe(
    1514|         SUSPENSION_CONFLICT_CANCELLATION_REASON,

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 21 skipped (22)
   Start at  16:05:45
   Duration  1.24s (transform 224ms, setup 0ms, import 1.02s, tests 108ms, environment 0ms)
```

## Lệnh đã chạy (Phần A2)

### 1. `pnpm --filter nestjs-api lint`
```text
$ oxlint src/ test/
src/notifications/notifications.config.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/notifications/notification-stream.service.ts:91:33: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:318:24: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:319:33: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:333:31: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/notifications/notification-producer.service.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
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
src/coaching/coaching.service.ts:12:13: warning eslint(no-unused-vars): Identifier 'crypto' is imported but never used. help: Consider removing this import.
src/coaching/coaching.service.ts:13:24: warning eslint(no-unused-vars): Type 'DrizzleDB' is imported but never used. help: Consider removing this import.
src/coaching/coaching.service.ts:182:16: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/coaching/coaching.service.ts:520:27: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/coaching/coaching.service.ts:550:27: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/coaching/coaching.service.ts:550:54: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/notifications/notification-distribution.service.spec.ts:7:3: warning eslint(no-unused-vars): Identifier 'NOTIFICATION_DISTRIBUTION_EVENT' is imported but never used. help: Consider removing this import.
src/notifications/notification-distribution.service.spec.ts:74:9: warning eslint(no-unused-vars): Variable 'subscribedEmitted' is declared but never used. Unused variables should start with a '_'. help: Consider removing this declaration.
src/medical/scat6.model.spec.ts:5:3: warning eslint(no-unused-vars): Identifier 'scat6ScoresSchema' is imported but never used. help: Consider removing this import.
src/dataset-export/services/authoritative-governance.service.ts:6:3: warning eslint(no-unused-vars): Identifier 'ConflictException' is imported but never used. help: Consider removing this import.
src/dataset-export/services/authoritative-governance.service.ts:10:81: warning eslint(no-unused-vars): Identifier 'coaches' is imported but never used. help: Consider removing this import.
src/dataset-export/services/authoritative-governance.service.ts:11:14: warning eslint(no-unused-vars): Identifier 'and' is imported but never used. help: Consider removing this import.
src/dataset-export/services/authoritative-governance.service.ts:86:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/dataset-export/services/authoritative-governance.service.ts:87:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/dataset-export/dto/candidate-export.dto.ts:15:29: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/main.ts:7:10: warning eslint(no-unused-vars): Identifier 'createOpenApiDocument' is imported but never used. help: Consider removing this import.
src/dataset-export/dto/promotion-request.dto.ts:8:3: warning eslint(no-unused-vars): Identifier 'Matches' is imported but never used. help: Consider removing this import.
src/app.module.ts:18:10: warning eslint(no-unused-vars): Identifier 'NotificationsModule' is imported but never used. help: Consider removing this import.
src/notifications/notifications.service.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/coaching/result-receipt.spec.ts:22:5: warning unicorn(no-thenable): Do not add `then` to a class. help: If an object is defined as 'thenable', once it's accidentally used in an await expression, it may cause problems
src/coaching/movement-review.service.spec.ts:32:5: warning unicorn(no-thenable): Do not add `then` to a class. help: If an object is defined as 'thenable', once it's accidentally used in an await expression, it may cause problems
```
*(Kết quả: exit code 0, 0 error)*

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


 Test Files  4 failed | 62 passed (66)
      Tests  1144 passed (1144)
   Start at  16:11:28
   Duration  5.00s (transform 4.66s, setup 0ms, import 58.87s, tests 3.39s, environment 6ms)
```
*(Ghi chú: 2 file integration test `test/coaching-loop-persistence.spec.ts` [5 test] và `test/dataset-export-trust-boundary.spec.ts` [21 test] cần Redis tại `127.0.0.1:6379` theo `docs/tickets/BASELINE.md` mục B1 và mỗi test chờ timeout 30s khi không có Redis. Khi chạy toàn bộ 66 file `src/` và 2 file test cô lập: **1144 passed / 0 failed** trên 62 file có test + 4 file spec rỗng có sẵn ở B2; tính cả 26 lỗi Redis có sẵn ở B1 là **1144 passed / 26 failed trên 1170 tests**, không thêm bất kỳ lỗi mới nào so với baseline).*

### 4. `pnpm --filter nestjs-api test:db`
```text
PASS 023 applies on ledger 20, rejects second row, and records ledger 23
PASS 024 applies on ledger 23, seeds three presets and wires bouts, requirements and permissions
PASS 024 requires ledger 23 and leaves nothing behind on a collision
PASS 027 applies directly after 024: defaults, constraints, upsert, audit, cascade and RLS
PASS 030 applies directly after 027: old-row default, object constraint, upsert preservation and preflight
PASS 031 requires both 027 and 030; applies after 030 with CHECKs, audit, cascade and RLS
PASS 025 applies on ledger 24: enum, table, constraints, permissions, notifications, triggers and RLS
PASS 025 rejects missing ledger 24 and collisions atomically
PASS 027 rejects missing ledger 24 and collisions atomically
PASS 032 applies on ledger 24 without 025-031, adds PENDING to session_status, and rejects re-application or missing 024
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
Migration checks passed: 48. PostgreSQL stopped after tests. Scratch: C:\Users\PC\AppData\Local\Temp\mma-migrations-9Bzemh
```
*(Kết quả: exit code 0, 48 checks passed)*

### 5. `pnpm --filter nestjs-api db:check`
```text
$ node run_sql.mjs --check
001-032 checksums OK. No database connection was opened.
```
*(Kết quả: exit code 0)*

## Lệch so với ticket

Không có

## Câu hỏi / việc còn mở

Không có
