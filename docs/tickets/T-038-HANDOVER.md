# T-038 Handover

- Nhánh: `feat/T-038-ai-tactics`. Commit implementation: `d0b45d1`.
- Trạng thái: IN REVIEW (phần A, backend).

## Thay đổi

- `nestjs-api/migrations/031_bout_ai_suggestions.sql`: bảng lưu cả kết quả AI thành công/thất bại, quyết định HLV, CHECK, FK cascade, index, audit và RLS/revoke giống `bout_rounds`; preflight ledger 027/030 và lock 31. Đã nối manifest, migration-files, package script, run_sql và README migrations.
- `nestjs-api/src/database/schema.ts:4619`: ánh xạ Drizzle `boutAiSuggestions` và các ràng buộc/index.
- `nestjs-api/src/bouts/bout-ai.client.ts`: ConfigService, Node fetch, structured JSON, retry tối đa một lần cho 5xx trong cùng deadline; 60/12/240 giây; lỗi không có key, quota, timeout, upstream và output rỗng/hỏng. Không thêm thư viện.
- `nestjs-api/src/bouts/bouts.service.ts:133`: ba thao tác gợi ý; chỉ gửi dữ liệu chuyên môn với tham chiếu cục bộ oN/tN, loại tên người tham gia và UUID trong ghi chú; lưu kết quả bằng audit context. Cache chỉ dùng dòng OK, recheck cache dưới khóa trận trước khi insert.
- `nestjs-api/src/bouts/bouts.service.ts:240`: lịch sử tối đa 20 dòng mới nhất; quyết định HLV kiểm item ID, khóa dòng và điều kiện chưa quyết định để ghi một lần.
- `nestjs-api/src/bouts/bouts.controller.ts`, `bouts.dto.ts`, `bout-analysis.model.ts`, `bouts.error.ts`, `bouts.module.ts`: năm endpoint, DTO/Swagger, quyền và hai mã lỗi mới; thêm cấu hình rỗng vào `.env.example` hiện có. Không tạo `.env`.
- Output dùng các mảng `tactics`, `instructions`, `observations`; mỗi item có ID cục bộ ổn định `ai1`… để gửi lại qua `acceptedItemIds`. Observation/tactic references từ Gemini được ánh xạ về ID thật tại backend. Khi R24 đỏ, `output.safety = 'RED'` cả lúc AI thất bại.
- Không sửa thuật toán, schema lời dặn hay kỳ vọng test của T-037. Không tự ghi vào opponent analysis hoặc nextRoundPlan.

## Đối chiếu tiêu chí nghiệm thu

| Tiêu chí (theo ticket §4) | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| 1. Migration 031, CHECK, cascade, audit, RLS | `nestjs-api/migrations/031_bout_ai_suggestions.sql:1`; `nestjs-api/scripts/test-migrations.mjs:930`, ca `031 requires both 027 and 030; applies after 030 with CHECKs, audit, cascade and RLS`. Test 030 cố ý xóa ledger 30; ca mới kiểm thiếu cả 27/30 rồi khôi phục ledger fixture trước khi áp 031. |
| 2. Client success/retry/upstream/quota/timeout/JSON/key | `nestjs-api/src/bouts/bout-ai.client.spec.ts:1`, nhóm `BoutAiClient (mock fetch only)`, gồm cả timeout khi đọc response body. |
| 3. Không gửi tên, opponentName, UUID | `nestjs-api/src/bouts/bout-ai.client.ts:108`; `nestjs-api/src/bouts/bout-ai.service.spec.ts:1`, ca kiểm actual fetch body trước trận và ghi chú giữa hiệp. Bỏ session IDs, metadata người ghi và tên khỏi projection; ID phân tích dùng alias cục bộ. |
| 4. Lọc observationIds, ghi OK/hash và cache | `nestjs-api/src/bouts/bouts.service.ts:147`; service tests `filters invalid evidence, saves exactly one OK row and reuses the cache`, `stores EMPTY if every tactic has invalid evidence or round`, `changes the input hash when the professional context changes`. |
| 5. Hiệp sắp tới, trạng thái, RED, timeout 12s có lưu | `nestjs-api/src/bouts/bout-ai.service.spec.ts:1`, các ca upcoming round, corner status, RED success và RED timeout; `bouts.controller.spec.ts` kiểm ba POST HTTP 200. Gọi lại `getRounds` sau timeout vẫn có `SAFETY_CHECK` của T-037. |
| 6. Quyết định một lần và item IDs | `nestjs-api/src/bouts/bouts.service.ts:250`; `bouts.repo.ts:450`; service tests quyết định/lần hai/ID sai/khác trận; repo test kiểm row lock và predicate decision IS NULL. |
| 7. Không có GEMINI_API_KEY | Client không đọc key bằng getOrThrow hay ném lúc khởi tạo; ba service tests `returns a persisted NOT_CONFIGURED result` không gọi fetch. ConfigModule/BoutAiClient được đăng ký trong BoutsModule; build và DTO JSON Schema checks qua. |
| 8. FIGHTER bị 403 trên cả năm endpoint | `nestjs-api/src/bouts/bout-ai.service.spec.ts:1`, nhóm `forbids FIGHTER ... even with endpoint permissions`; controller route metadata kiểm bout:update/read. |
| 9. Không thêm lỗi baseline | Kết quả bắt buộc bên dưới. Các test cũ của T-037 chạy nguyên kỳ vọng. |

## Lệnh đã chạy

Trong lúc làm chỉ chạy Vitest theo file liên quan. Lượt mục tiêu cuối: `Test Files 7 passed (7)`; `Tests 269 passed (269)`.
Từng có một test mới lỗi vì fixture thiếu createdAt/updatedAt khi kiểm getRounds; đã sửa fixture, không sửa production T-037.

Năm lệnh bắt buộc chạy một lần mỗi lệnh ở cuối. Output tail nguyên văn:

So với baseline do người giao cung cấp: lint chỉ warning; build OK; test giữ 26 failed và 6 failed files, tăng 1048 → 1113 passed (+65), tổng 1074 → 1139. test:db tăng 46 → 47 checks. db:check mở rộng 001–030 → 001–031, không kết nối database.

### `pnpm --filter nestjs-api lint` (exit 0)

```text
src/main.ts:7:10: warning eslint(no-unused-vars): Identifier 'createOpenApiDocument' is imported but never used. help: Consider removing this import.
src/dataset-export/dto/promotion-request.dto.ts:8:3: warning eslint(no-unused-vars): Identifier 'Matches' is imported but never used. help: Consider removing this import.
src/dataset-export/services/governance-verifier.service.ts:45:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/dataset-export/services/governance-verifier.service.ts:46:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/notifications/notification-stream.service.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/dataset-export/services/authoritative-governance.service.ts:6:3: warning eslint(no-unused-vars): Identifier 'ConflictException' is imported but never used. help: Consider removing this import.
src/dataset-export/services/authoritative-governance.service.ts:10:81: warning eslint(no-unused-vars): Identifier 'coaches' is imported but never used. help: Consider removing this import.
src/dataset-export/services/authoritative-governance.service.ts:11:14: warning eslint(no-unused-vars): Identifier 'and' is imported but never used. help: Consider removing this import.
src/dataset-export/services/authoritative-governance.service.ts:86:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/dataset-export/services/authoritative-governance.service.ts:87:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/coaching/result-receipt.spec.ts:22:5: warning unicorn(no-thenable): Do not add `then` to a class. help: If an object is defined as 'thenable', once it's accidentally used in an await expression, it may cause problems
src/notifications/notification-producer.service.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/medical/scat6.model.spec.ts:5:3: warning eslint(no-unused-vars): Identifier 'scat6ScoresSchema' is imported but never used. help: Consider removing this import.
src/coaching/coaching.service.ts:12:13: warning eslint(no-unused-vars): Identifier 'crypto' is imported but never used. help: Consider removing this import.
src/coaching/coaching.service.ts:13:24: warning eslint(no-unused-vars): Type 'DrizzleDB' is imported but never used. help: Consider removing this import.
src/coaching/coaching.service.ts:177:16: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/coaching/coaching.service.ts:504:27: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/coaching/coaching.service.ts:534:27: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/coaching/coaching.service.ts:534:54: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/notifications/notification-distribution.service.spec.ts:7:3: warning eslint(no-unused-vars): Identifier 'NOTIFICATION_DISTRIBUTION_EVENT' is imported but never used. help: Consider removing this import.
src/notifications/notification-distribution.service.spec.ts:74:9: warning eslint(no-unused-vars): Variable 'subscribedEmitted' is declared but never used. Unused variables should start with a '_'. help: Consider removing this declaration.
src/coaching/movement-review.service.spec.ts:32:5: warning unicorn(no-thenable): Do not add `then` to a class. help: If an object is defined as 'thenable', once it's accidentally used in an await expression, it may cause problems
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
src/notifications/notifications.config.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/dataset-export/dto/candidate-export.dto.ts:15:29: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/notifications/notification-stream.service.ts:91:33: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:318:24: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:319:33: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:333:31: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/app.module.ts:18:10: warning eslint(no-unused-vars): Identifier 'NotificationsModule' is imported but never used. help: Consider removing this import.
```

### `pnpm --filter nestjs-api build` (exit 0)

```text
$ nest build
```

### `pnpm --filter nestjs-api test` (exit 1)

```text
 FAIL  test/dataset-export-trust-boundary.spec.ts > Task 14 — Product Backend Security & Governance Remediation Gate > 2. Authoritative Governance & Digest Binding > 2.7 rejects reviewer with unauthorized RBAC role (e.g. fighter)
 FAIL  test/dataset-export-trust-boundary.spec.ts > Task 14 — Product Backend Security & Governance Remediation Gate > 2. Authoritative Governance & Digest Binding > 2.8 flags sampleCount mismatch between DB truth and request claims, recording audit event
 FAIL  test/dataset-export-trust-boundary.spec.ts > Task 14 — Product Backend Security & Governance Remediation Gate > 2. Authoritative Governance & Digest Binding > 2.9 rejects duplicate reviewer IDs in database
 FAIL  test/dataset-export-trust-boundary.spec.ts > Task 14 — Product Backend Security & Governance Remediation Gate > 3. Candidate Conflict & Superseding Lifecycle > 3.1 rejects same exportId submitted with different candidate hash (409 Conflict)
 FAIL  test/dataset-export-trust-boundary.spec.ts > Task 14 — Product Backend Security & Governance Remediation Gate > 3. Candidate Conflict & Superseding Lifecycle > 3.2 supersedes previous active attestations when issuing a new promotion
 FAIL  test/dataset-export-trust-boundary.spec.ts > Task 14 — Product Backend Security & Governance Remediation Gate > 4. Idempotency & Nonce Replay > 4.1 requires mandatory Idempotency-Key header for mutations
 FAIL  test/dataset-export-trust-boundary.spec.ts > Task 14 — Product Backend Security & Governance Remediation Gate > 4. Idempotency & Nonce Replay > 4.2 returns exact stored response for duplicate Idempotency-Key and payload
 FAIL  test/dataset-export-trust-boundary.spec.ts > Task 14 — Product Backend Security & Governance Remediation Gate > 4. Idempotency & Nonce Replay > 4.3 rejects duplicate nonces with 409 Conflict
 FAIL  test/dataset-export-trust-boundary.spec.ts > Task 14 — Product Backend Security & Governance Remediation Gate > 5. Cryptographic Verification & Malformed Input Safety > 5.1 returns false safely on malformed signature verification without throwing
 FAIL  test/dataset-export-trust-boundary.spec.ts > Task 14 — Product Backend Security & Governance Remediation Gate > 5. Cryptographic Verification & Malformed Input Safety > 5.2 verifies cross-language RFC 8785 canonical JSON fixture byte parity
 FAIL  test/dataset-export-trust-boundary.spec.ts > Task 14 — Product Backend Security & Governance Remediation Gate > 5. Cryptographic Verification & Malformed Input Safety > 5.3 does not expose sensitive secret values in API responses or logs
TypeError: Configuration key "SUPABASE_URL" does not exist
 ❯ ConfigService.getOrThrow ../node_modules/.pnpm/@nestjs+config@12.0.1_@nest_83e21231fd1e51b78a39b85522cb4a89/node_modules/@nestjs/config/dist/config.service.js:94:19
 ❯ InstanceWrapper.useFactory [as metatype] src/common/supabase/supabase.module.ts:34:18
     32|       useFactory: (config: ConfigService) =>
     33|         createClient(
     34|           config.getOrThrow<string>('SUPABASE_URL'),
       |                  ^
     35|           config.getOrThrow<string>('SUPABASE_ANON_KEY'),
     36|           serverAuthOptions,
 ❯ TestingInjector.instantiateClass ../node_modules/.pnpm/@nestjs+core@12.1.0_@nestjs_b4cbd863ea2658345935822d2a51a1a7/node_modules/@nestjs/core/injector/injector.js:477:55
 ❯ callback ../node_modules/.pnpm/@nestjs+core@12.1.0_@nestjs_b4cbd863ea2658345935822d2a51a1a7/node_modules/@nestjs/core/injector/injector.js:70:45
 ❯ TestingInjector.resolveConstructorParams ../node_modules/.pnpm/@nestjs+core@12.1.0_@nestjs_b4cbd863ea2658345935822d2a51a1a7/node_modules/@nestjs/core/injector/injector.js:183:24
 ❯ TestingInjector.loadInstance ../node_modules/.pnpm/@nestjs+core@12.1.0_@nestjs_b4cbd863ea2658345935822d2a51a1a7/node_modules/@nestjs/core/injector/injector.js:76:13
 ❯ TestingInjector.loadProvider ../node_modules/.pnpm/@nestjs+core@12.1.0_@nestjs_b4cbd863ea2658345935822d2a51a1a7/node_modules/@nestjs/core/injector/injector.js:110:9
 ❯ ../node_modules/.pnpm/@nestjs+core@12.1.0_@nestjs_b4cbd863ea2658345935822d2a51a1a7/node_modules/@nestjs/core/injector/instance-loader.js:58:13

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/30]⎯


 Test Files  6 failed | 62 passed (68)
      Tests  26 failed | 1113 passed (1139)
   Start at  14:26:12
   Duration  22.17s (transform 8.46s, setup 0ms, import 173.79s, tests 10.95s, environment 19ms)

[ELIFECYCLE] Test failed. See above for more details.
Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL

  × "pnpm recursive run" failed in D:\test\ai-worktrees\T-038\nestjs-api

```

### `pnpm --filter nestjs-api test:db` (exit 0)

```text
PASS reapplying 018 fails without duplicating migration history
PASS 018 backfills live plan to base
PASS 018 backfills soft-deleted plan to base
PASS 018 rejects a database without migration 005 history
PASS 018 rejects mma_018_enum_collision without writing history
PASS 018 rejects mma_018_column_collision without writing history
PASS 013 applies with migration history and coach identity foreign keys
PASS reapplying 013 fails without duplicating migration history
PASS 014 adds video training context and diagonal camera support
PASS reapplying 014 fails without duplicating migration history
PASS 015 adds notification dedupe and records ledger version 15
PASS reapplying 015 fails without duplicating migration history
PASS 016 adds examination details, snapshot exemptions, and ledger 16
PASS 017 adds doctor assignment notification type and ledger 17
PASS 018 applies on the upgraded 013-017 chain and records ledger 18
PASS 019 and 020 add immutable movement review history with scoped grants
PASS 023 applies on ledger 20, rejects second row, and records ledger 23
PASS 024 applies on ledger 23, seeds three presets and wires bouts, requirements and permissions
PASS 024 requires ledger 23 and leaves nothing behind on a collision
PASS 027 applies directly after 024: defaults, constraints, upsert, audit, cascade and RLS
PASS 030 applies directly after 027: old-row default, object constraint, upsert preservation and preflight
PASS 031 requires both 027 and 030; applies after 030 with CHECKs, audit, cascade and RLS
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
Migration checks passed: 47. PostgreSQL stopped after tests. Scratch: C:\Users\DAN\AppData\Local\Temp\mma-migrations-9lXBmX
```

### `pnpm --filter nestjs-api db:check` (exit 0)

```text
$ node run_sql.mjs --check
001-031 checksums OK. No database connection was opened.
```

## Lệch so với ticket

Không có. Contract T-037 hiện có biểu diễn an toàn đỏ bằng `advice.safety.level === 'RED'`; T-038 đọc trường đó và trả `output.safety = 'RED'`, không đổi contract T-037.

## Câu hỏi / việc còn mở

Không có câu hỏi chặn triển khai. Chưa gọi Gemini thật; không có bằng chứng đánh giá nội dung/độ trễ từ upstream thật. Không chạy db:migrate, không kết nối Supabase, không push hoặc merge. Migration thật và review bằng key thật thuộc lượt review/chủ dự án.
