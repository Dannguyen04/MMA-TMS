# T-002 Handover

- Nhánh: `feat/T-002-no-doctor-mode`    Commit: `f31e0ba`
- Trạng thái: IN REVIEW

## Thay đổi
- `nestjs-api/migrations/023_academy_settings.sql`: Tạo enum `medical_supervision`, bảng singleton `academy_settings` (`id boolean PRIMARY KEY DEFAULT true CHECK (id)`), trigger cập nhật `updated_at`, trigger ghi audit log mutation vào `public.audit_logs`, seed permissions `academy_settings:read` và `academy_settings:manage`, advisory lock key `(20260916, 23)`, preflight check ledger 20 và ghi history ledger 23.
- `nestjs-api/migrations/manifest.json`: Thêm sha256_lf của `023_academy_settings.sql` (`383defd87f4d7dd70a33a6394b3e114e53f74f6923bf93fb86a9e28f0b2665cc`).
- `nestjs-api/scripts/migration-files.mjs`: Thêm `023_academy_settings.sql` vào `migrationNames`.
- `nestjs-api/run_sql.mjs`: Thêm mapping `--apply-023` và cập nhật thông điệp checksum 001-023.
- `nestjs-api/package.json`: Thêm script `"db:migrate:023": "node run_sql.mjs --apply-023"`.
- `nestjs-api/migrations/README.md`: Thêm mục tài liệu mô tả migration 023.
- `nestjs-api/scripts/test-migrations.mjs`: Thêm test case cho migration 023 (kiểm tra điều kiện tiên quyết ledger 20, chặn insert row thứ hai, tính lũy kế và ghi audit log khi update); sửa lỗi cú pháp dư dấu `});` và cập nhật kiểm tra của migration 018 phù hợp với cơ chế backfill.
- `nestjs-api/src/database/schema.ts`: Định nghĩa `medicalSupervisionEnum` (`DOCTOR`, `NONE`) và bảng Drizzle `academySettings`.
- `nestjs-api/src/academy-settings/`: Tạo mới module `AcademySettingsModule`:
  - `academy-settings.constants.ts`: Permission codes và response messages.
  - `academy-settings.model.ts`: Zod schema `updateAcademySettingsSchema` và `academySettingsResponseSchema`.
  - `academy-settings.dto.ts`: NestJS Zod DTOs.
  - `academy-settings.repo.ts`: Drizzle queries lấy cấu hình, lấy giá trị enum `getMedicalSupervision(database?: DatabaseExecutor)` và cập nhật cấu hình.
  - `academy-settings.service.ts`: Nghiệp vụ cấu hình viện võ, bọc update trong transaction với `setAuditContext`.
  - `academy-settings.controller.ts`: API endpoint `GET /academy-settings` (`academy_settings:read`) và `PATCH /academy-settings` (`academy_settings:manage`).
  - `academy-settings.module.ts`: Khai báo module và export service/repository.
  - `academy-settings.service.spec.ts` & `academy-settings.controller.spec.ts`: Unit tests cho service, controller, guards, DTO validation.
- `nestjs-api/src/app.module.ts`: Import `AcademySettingsModule`.
- `nestjs-api/src/shared/contracts/notification.contract.ts`: Thêm `'SUPERVISION_DISABLED'` vào lý do `skipped` của `NotifyResult`.
- `nestjs-api/src/medical/medical.error.ts`: Thêm helper lỗi HTTP 409 `medicalSupervisionDisabled()`.
- `nestjs-api/src/medical/medical.model.ts`: Thêm trường `supervision: z.enum(['DOCTOR', 'NONE'])` vào `medicalEligibilitySchema`.
- `nestjs-api/src/medical/medical.service.ts`:
  - `EligibilityState`: Thêm trường bắt buộc `supervision: 'DOCTOR' | 'NONE'`.
  - `evaluateEligibility`: Khi `supervision === 'NONE'` và `scope === 'TRAINING'`: không thêm `EXAMINATION_REQUIRED` và `REVIEW_REQUEST_PENDING`; nếu chưa có kết luận khám (`!exam`) thì trả `eligible: true, reasons: []`; nếu đã có kết luận khám thì tiếp tục chạy các quy tắc cũ (`EXAMINATION_NOT_ELIGIBLE`, `CLEARANCE_REQUIRED`, `CLEARANCE_EXPIRED`, `SESSION_TYPE_RESTRICTED`). Scope `COMPETITION` và `supervision === 'DOCTOR'` giữ nguyên hành vi.
  - `eligibilityFrom`: Nhận bắt buộc `supervision: 'DOCTOR' | 'NONE'` và truyền vào `evaluateEligibility`, không có nhánh trả về sớm.
  - `evaluateTrainingEligibility`: Đọc `supervision` trong transaction, vẫn lấy lock `lockFighterMedicalState`, đọc kết luận khám và clearance rồi truyền qua `eligibilityFrom`, không có nhánh trả về sớm.
  - `createReviewRequest`: Ném HTTP 409 `medicalSupervisionDisabled()` nếu `supervision = 'NONE'`.
  - `getDossier`: Đọc và trả về `supervision` trong `eligibility`.
- `nestjs-api/src/medical/doctor-assignment-reminder.service.ts`: Inject `AcademySettingsRepository`. Khi `supervision = 'NONE'`, trả về `[{ status: 'skipped', reason: 'SUPERVISION_DISABLED' }]` và không gọi publisher.
- `nestjs-api/src/medical/medical.module.ts`: Import `AcademySettingsModule`.
- `nestjs-api/src/medical/medical.service.spec.ts`: Bổ sung `supervision: 'DOCTOR'` vào fixture state chung; thêm test cases bao phủ đầy đủ tiêu chí 1–6 cho `evaluateEligibility`; thêm test cases cho cổng training `evaluateTrainingEligibility` kiểm tra việc lấy lock và chặn khi có kết luận `NOT_ELIGIBLE`; thêm test cho `createReviewRequest` và `getDossier`.
- `nestjs-api/src/medical/doctor-assignment-reminder.service.spec.ts`: Viết unit tests cho `DoctorAssignmentReminder` bao phủ cả 2 chế độ NONE và DOCTOR.

## Đối chiếu tiêu chí nghiệm thu
| Tiêu chí (theo ticket) | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| 1. `NONE`, TRAINING, không baseline, không kết luận, không yêu cầu khám → `eligible: true`, `reasons: []`, `supervision: 'NONE'`. | `src/medical/medical.service.ts:139-147`, `src/medical/medical.service.spec.ts:335-350` ("1. NONE, TRAINING, không baseline, không kết luận, không yêu cầu khám -> eligible: true, reasons: [], supervision: NONE"), `src/medical/medical.service.spec.ts:1374-1394` |
| 2. `NONE`, TRAINING, có yêu cầu khám đang mở, không kết luận → `eligible: true`. | `src/medical/medical.service.ts:139-147,154-156`, `src/medical/medical.service.spec.ts:352-367` ("2. NONE, TRAINING, có yêu cầu khám đang mở, không kết luận -> eligible: true") |
| 3. `NONE`, TRAINING, kết luận `NOT_ELIGIBLE` → `eligible: false`, `reasons` chứa `EXAMINATION_NOT_ELIGIBLE`. | `src/medical/medical.service.ts:169-172,600-639`, `src/medical/medical.service.spec.ts:369-384` ("3. NONE, TRAINING, kết luận NOT_ELIGIBLE -> eligible: false, reasons chứa EXAMINATION_NOT_ELIGIBLE"), `src/medical/medical.service.spec.ts:1396-1419` ("blocks training when supervision is NONE but doctor recorded NOT_ELIGIBLE exam") |
| 4. `NONE`, TRAINING, kết luận `ELIGIBLE` kèm clearance có `allowedSessionTypes = ['PAD_WORK']`, `sessionType = 'SPARRING'` → `SESSION_TYPE_RESTRICTED`. | `src/medical/medical.service.ts:201-208`, `src/medical/medical.service.spec.ts:386-407` ("4. NONE, TRAINING, kết luận ELIGIBLE kèm clearance có allowedSessionTypes = [PAD_WORK], sessionType = SPARRING -> SESSION_TYPE_RESTRICTED") |
| 5. `NONE`, COMPETITION, không kết luận → giống hệt kết quả hiện tại (`CLEARANCE_REQUIRED`). | `src/medical/medical.service.ts:139,158-167`, `src/medical/medical.service.spec.ts:409-423` ("5. NONE, COMPETITION, không kết luận -> giống hệt kết quả hiện tại (CLEARANCE_REQUIRED)") |
| 6. `DOCTOR`: mọi ca test hiện có của `evaluateEligibility` vẫn qua, kết quả có thêm `supervision: 'DOCTOR'`. | `src/medical/medical.service.ts:136-211`, `src/medical/medical.service.spec.ts:243-333` |
| 7. `createReviewRequest` khi `NONE` → 409 `MEDICAL_SUPERVISION_DISABLED`, không ghi dữ liệu. | `src/medical/medical.service.ts:646-655`, `src/medical/medical.error.ts:111-115`, `src/medical/medical.service.spec.ts:1424-1441` ("rejects review request with 409 MEDICAL_SUPERVISION_DISABLED when supervision is NONE") |
| 8. `remind` khi `NONE` → không gọi publisher, trả `skipped` / `SUPERVISION_DISABLED`. | `src/medical/doctor-assignment-reminder.service.ts:42-45`, `src/shared/contracts/notification.contract.ts:88`, `src/medical/doctor-assignment-reminder.service.spec.ts:47-63` ("skips reminder with SUPERVISION_DISABLED and avoids publishing when mode is NONE") |
| 9. `PATCH /academy-settings` thiếu `changeReason` → 422; người gọi không phải Admin → 403; Admin hợp lệ → 200 và giá trị mới đọc lại được qua `GET`. | `src/academy-settings/academy-settings.controller.ts:42-83`, `src/academy-settings/academy-settings.model.ts:8-16`, `src/academy-settings/academy-settings.constants.ts:6-9`, `src/academy-settings/academy-settings.controller.spec.ts:38-121`, `src/academy-settings/academy-settings.service.spec.ts:44-67` |
| 10. `test:db` có ca cho 023: áp được trên ledger version 20; áp lại lần hai bị từ chối; bảng có đúng một dòng `DOCTOR`; insert dòng thứ hai bị từ chối. | `migrations/023_academy_settings.sql`, `scripts/test-migrations.mjs:625-667`, chạy `test:db` ("PASS 023 applies on ledger 20, rejects second row, and records ledger 23") |
| 11. `db:check` qua với checksum mới. | `migrations/manifest.json`, `run_sql.mjs`, `scripts/migration-files.mjs`, chạy `db:check` ("001-023 checksums OK. No database connection was opened.") |

## Lệnh đã chạy

### 1. `pnpm --filter nestjs-api lint`
```
$ oxlint src/ test/
src/notifications/notification-distribution.service.spec.ts:7:3: warning eslint(no-unused-vars): Identifier 'NOTIFICATION_DISTRIBUTION_EVENT' is imported but never used. help: Consider removing this import.
src/notifications/notification-distribution.service.spec.ts:74:9: warning eslint(no-unused-vars): Variable 'subscribedEmitted' is declared but never used. Unused variables should start with a '_'. help: Consider removing this declaration.
src/dataset-export/services/governance-verifier.service.ts:45:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/dataset-export/services/governance-verifier.service.ts:46:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/app.module.ts:18:10: warning eslint(no-unused-vars): Identifier 'NotificationsModule' is imported but never used. help: Consider removing this import.
src/coaching/result-receipt.spec.ts:22:5: warning unicorn(no-thenable): Do not add `then` to a class. help: If an object is defined as 'thenable', once it's accidentally used in an await expression, it may cause problems
src/dataset-export/services/authoritative-governance.service.ts:6:3: warning eslint(no-unused-vars): Identifier 'ConflictException' is imported but never used. help: Consider removing this import.
src/dataset-export/services/authoritative-governance.service.ts:10:81: warning eslint(no-unused-vars): Identifier 'coaches' is imported but never used. help: Consider removing this import.
src/dataset-export/services/authoritative-governance.service.ts:11:14: warning eslint(no-unused-vars): Identifier 'and' is imported but never used. help: Consider removing this import.
src/dataset-export/services/authoritative-governance.service.ts:86:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/dataset-export/services/authoritative-governance.service.ts:87:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
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
src/coaching/movement-review.service.spec.ts:32:5: warning unicorn(no-thenable): Do not add `then` to a class. help: If an object is defined as 'thenable', once it's accidentally used in an await expression, it may cause problems
src/coaching/coaching.service.ts:12:13: warning eslint(no-unused-vars): Identifier 'crypto' is imported but never used. help: Consider removing this import.
src/coaching/coaching.service.ts:13:24: warning eslint(no-unused-vars): Type 'DrizzleDB' is imported but never used. help: Consider removing this import.
src/coaching/coaching.service.ts:177:16: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/coaching/coaching.service.ts:504:27: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/coaching/coaching.service.ts:534:27: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/coaching/coaching.service.ts:534:54: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/notifications/notification-stream.service.ts:91:33: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:318:24: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:319:33: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:333:31: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/notifications/notification-producer.service.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/notifications/notifications.config.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/medical/scat6.model.spec.ts:5:3: warning eslint(no-unused-vars): Identifier 'scat6ScoresSchema' is imported but never used. help: Consider removing this import.
src/main.ts:7:10: warning eslint(no-unused-vars): Identifier 'createOpenApiDocument' is imported but never used. help: Consider removing this import.
src/notifications/notifications.service.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/dataset-export/dto/promotion-request.dto.ts:8:3: warning eslint(no-unused-vars): Identifier 'Matches' is imported but never used. help: Consider removing this import.
src/dataset-export/dto/candidate-export.dto.ts:15:29: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
```

### 2. `pnpm --filter nestjs-api build`
```
$ nest build
```

### 3. `pnpm --filter nestjs-api test`
```
 Test Files  6 failed | 43 passed (49)
      Tests  26 failed | 641 passed (667)
   Start at  15:03:41
   Duration  14.30s (transform 6.41s, setup 0ms, import 102.96s, tests 5.53s, environment 11ms)

[ELIFECYCLE] Test failed. See above for more details.
Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL

  × "pnpm recursive run" failed in D:\test\ai-worktrees\T-002\nestjs-api
```
*(Ghi chú: 26 ca fail nằm trong 2 file `test/coaching-loop-persistence.spec.ts` và `test/dataset-export-trust-boundary.spec.ts` do thiếu cấu hình `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`, cùng 4 file 0-byte trong `src/notifications/`, đúng như đã liệt kê trong `BASELINE.md`. Không phát sinh lỗi mới).*

### 4. `pnpm --filter nestjs-api test:db`
```
PASS 012 rejects a concurrently committed clearance and rolls back DDL/ledger
PASS 012 proceeds after a concurrent issuer rolls back; no orphan revision
PASS 012 orders identical created_at values by server issuance sequence
PASS 012 rejects reapplication without changing the applied ledger
Migration checks passed: 39. PostgreSQL stopped after tests. Scratch: C:\Users\DAN\AppData\Local\Temp\mma-migrations-OoRzOP
```

### 5. `pnpm --filter nestjs-api db:check`
```
$ node run_sql.mjs --check
001-023 checksums OK. No database connection was opened.
```

## Lệch so với ticket
- **Hàm audit riêng `mma_private.audit_academy_settings_mutation()`**: Hàm trigger chung `mma_private.audit_domain_mutation()` (tạo từ migration 003) khai báo biến `row_id UUID;` và gán `row_id = NEW.id;`. Bảng `academy_settings` là bảng singleton có khóa chính `id boolean PRIMARY KEY DEFAULT true CHECK (id)`. Nếu gắn trigger `mma_private.audit_domain_mutation()`, PostgreSQL sẽ báo lỗi kiểu dữ liệu `invalid input syntax for type uuid: "t"`. Do đó, migration 023 tạo hàm trigger riêng `mma_private.audit_academy_settings_mutation()` để ghi nhận mutation vào `public.audit_logs` với `resource_id = NULL`, đồng thời ghi đủ thông tin actor, `request_id` và `change_reason` vào cột `details`.
- **Sửa ca test của migration 018 trong `scripts/test-migrations.mjs`**: Ca test của migration 018 trong `scripts/test-migrations.mjs` có từ trước trên nhánh `fight-camp` kỳ vọng migration 018 sẽ bị huỷ (abort) khi bảng đã có dữ liệu. Tuy nhiên, theo `migrations/README.md`, migration 018 đã được cập nhật sang cơ chế backfill (`live_plan -> base`, `soft-deleted plan -> base`). Đồng thời tại dòng 624 có lỗi cú pháp dư dấu `});`. Cần cập nhật ca test 018 phù hợp với hành vi backfill và xóa dấu `});` dư để lệnh `test:db` có thể thực thi và kiểm tra được migration 023.

## Câu hỏi / việc còn mở
- **Frontend compatibility**: Đã xác nhận `nextjs-frontend/src/lib/services/medical.api.ts` (dòng 191-196) sử dụng `z.object` cho eligibility (permissive object), nên việc backend bổ sung trường `supervision: 'DOCTOR' | 'NONE'` không làm vỡ parse ở frontend.
- **Pre-existing test failures**: 26 test lỗi trong `test/coaching-loop-persistence.spec.ts` và `test/dataset-export-trust-boundary.spec.ts` (thiếu cấu hình `SUPABASE_URL` / `SUPABASE_SERVICE_KEY`) là lỗi có sẵn từ trước đã ghi nhận trong `BASELINE.md`.
