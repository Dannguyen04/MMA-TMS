# T-037 Handover

- Nhánh: feat/T-037-between-round-plan    Commit: 2aa67b8
- Trạng thái: IN REVIEW

## Thay đổi

- `nestjs-api/migrations/030_between_round_plan.sql`: thêm jsonb object NOT NULL, mặc định {}, preflight ledger 27/30, kiểm collision, advisory lock và ledger.
- `nestjs-api/scripts/migration-files.mjs`, `nestjs-api/migrations/manifest.json`, `nestjs-api/package.json`, `nestjs-api/run_sql.mjs`, `nestjs-api/migrations/README.md`: đăng ký migration 030, checksum LF, lệnh áp và tài liệu. Không chạy db:migrate:*.
- `nestjs-api/src/database/schema.ts:4595`: cột nextRoundPlan kiểu NextRoundPlan và CHECK tương ứng.
- `nestjs-api/src/bouts/bout-analysis.model.ts:97`: schema kế hoạch/lời dặn, superRefine, trường response; hợp nhất chiến thuật thêm, ưu tiên HLV, suggested theo R21–R24 và giới hạn 5. Giữ nguyên ngưỡng và buildCornerCard.
- `nestjs-api/src/bouts/bouts.service.ts:422`, `nestjs-api/src/bouts/bouts.error.ts`: kiểm tham chiếu, trùng ID, hiệp cuối trong transaction; chấm chiến thuật từ hiệp trước; chuẩn hóa response ở dòng 2052.
- `nestjs-api/src/bouts/bouts.repo.ts:417`: đã kiểm tra; không cần sửa vì upsert dùng values và chỉ cập nhật trường được gửi. Cột mới tự được ghi qua schema, trường thiếu không bị ghi đè. Có test SQL chứng minh cả hai.
- `nestjs-api/src/bouts/bouts.dto.ts`: DTO kế hoạch và advice; RoundInput/Response/Rounds DTO tự nhận schema mở rộng.
- Các spec tương ứng và `nestjs-api/scripts/test-migrations.mjs:905`: thêm 25 test Vitest và 1 check migration.

## Đối chiếu tiêu chí nghiệm thu

| Tiêu chí (theo ticket) | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| 1. 030 sau 027, mặc định dòng cũ, chặn array, chạy lại | migrations/030_between_round_plan.sql:1; scripts/test-migrations.mjs:905, check “030 applies directly after 027…”; test:db 46/46 |
| 2. Lưu và trả plan, focus đứng đầu dù điểm thấp | bouts.service.ts:422,2052; bout-analysis.model.ts:269,297,315; service spec:2717 và model spec:408, “prioritizes coach order…” |
| 3. Thêm ở hiệp 1, chấm ở hiệp 2, addedRound/trained | service spec:2717; model spec “merges added tactics from every round…” |
| 4. ID lạ/trùng không ghi | bouts.service.ts:422–454; service spec:2744,2759 |
| 5. Nội dung plan ở hiệp cuối bị 422 | bouts.service.ts:429; service spec:2751 |
| 6. CUSTOM thiếu text / USE_TACTIC thiếu tacticId | bout-analysis.model.ts:101; bouts.dto.spec.ts:20 kiểm pipe trả 422 cho cả CUSTOM, USE_TACTIC, STOP_TACTIC, RECHECK_OPPONENT |
| 7. Mỗi quy tắc suggested, thứ tự kết hợp, tối đa 5 | bout-analysis.model.ts:352; model spec “suggests safety…”, “rechecks changed evidence…”, “caps suggestions…” |
| 8. Gửi lại thiếu plan vẫn giữ | service spec:2717; repo spec:43,79; SQL migration check:905 |
| 9. Test cũ vẫn qua | 5 file targeted: 204 pass; không sửa kỳ vọng test cũ. Chỉ thêm default nextRoundPlan rỗng cho fixture round và assertion SQL không cập nhật trường thiếu. Dời kiểm cascade từ cuối case 027 sang cuối case 030 để dùng dòng cũ kiểm backfill; giữ nguyên assertion cascade |
| 10. Các lệnh bắt buộc | Output nguyên văn bên dưới; chạy mỗi lệnh cuối đúng một lần |

Baseline do người giao cung cấp: lint warnings only; build OK; test 26 failed / 1023 passed / 1049, 6 failed files; test:db 45; db:check 001–027.
Sau thay đổi: lint exit 0 với warnings; build exit 0; test 26 failed / 1048 passed / 1074, 6 failed files (thêm 25 pass, không tăng số test/file fail); test:db 46; db:check 001–030.
Full test còn báo 2 unhandled teardown errors từ test/coaching-loop-persistence.spec.ts; baseline được cung cấp không ghi số unhandled errors, nên chưa xác nhận được chênh lệch chỉ số này.

## Lệnh đã chạy

Các lệnh kiểm tra chạy foreground; output được lấy bằng `2>&1 | Select-Object -Last 40`. Với năm lệnh cuối, truyền tiếp exit code bằng `exit $LASTEXITCODE`. Dưới đây là nguyên văn phần cuối output, không phải output dựng lại.

### Targeted lần 1

`pnpm --filter nestjs-api exec vitest run src/bouts/bout-analysis.model.spec.ts src/bouts/bouts.service.spec.ts src/bouts/bouts.repo.spec.ts src/bouts/bouts.dto.spec.ts src/bouts/bouts.controller.spec.ts`

```text
The plugin "vite-tsconfig-paths" is detected. Vite now supports tsconfig paths resolution natively via the resolve.tsconfigPaths option. You can remove the plugin and set resolve.tsconfigPaths: true in your Vite config instead.

 RUN  v4.1.11 D:/test/ai-worktrees/T-037/nestjs-api


 Test Files  5 passed (5)
      Tests  203 passed (203)
   Start at  14:06:38
   Duration  3.09s (transform 1.07s, setup 0ms, import 9.08s, tests 372ms, environment 1ms)

```

### Targeted lần 2

`pnpm --filter nestjs-api exec vitest run src/bouts/bout-analysis.model.spec.ts src/bouts/bouts.service.spec.ts src/bouts/bouts.repo.spec.ts src/bouts/bouts.dto.spec.ts src/bouts/bouts.controller.spec.ts`

```text
The plugin "vite-tsconfig-paths" is detected. Vite now supports tsconfig paths resolution natively via the resolve.tsconfigPaths option. You can remove the plugin and set resolve.tsconfigPaths: true in your Vite config instead.

 RUN  v4.1.11 D:/test/ai-worktrees/T-037/nestjs-api


 Test Files  5 passed (5)
      Tests  204 passed (204)
   Start at  14:07:04
   Duration  2.79s (transform 1.01s, setup 0ms, import 7.93s, tests 324ms, environment 1ms)

```

### lint

`pnpm --filter nestjs-api lint` — exit 0

```text
src/notifications/notifications.config.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/notifications/notification-stream.service.ts:91:33: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:318:24: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:319:33: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:333:31: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/coaching/result-receipt.spec.ts:22:5: warning unicorn(no-thenable): Do not add `then` to a class. help: If an object is defined as 'thenable', once it's accidentally used in an await expression, it may cause problems
src/notifications/notification-stream.service.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/app.module.ts:18:10: warning eslint(no-unused-vars): Identifier 'NotificationsModule' is imported but never used. help: Consider removing this import.
src/coaching/movement-review.service.spec.ts:32:5: warning unicorn(no-thenable): Do not add `then` to a class. help: If an object is defined as 'thenable', once it's accidentally used in an await expression, it may cause problems
src/main.ts:7:10: warning eslint(no-unused-vars): Identifier 'createOpenApiDocument' is imported but never used. help: Consider removing this import.
src/notifications/notification-distribution.service.spec.ts:7:3: warning eslint(no-unused-vars): Identifier 'NOTIFICATION_DISTRIBUTION_EVENT' is imported but never used. help: Consider removing this import.
src/notifications/notification-distribution.service.spec.ts:74:9: warning eslint(no-unused-vars): Variable 'subscribedEmitted' is declared but never used. Unused variables should start with a '_'. help: Consider removing this declaration.
src/notifications/notification-producer.service.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/medical/scat6.model.spec.ts:5:3: warning eslint(no-unused-vars): Identifier 'scat6ScoresSchema' is imported but never used. help: Consider removing this import.
src/coaching/coaching.service.ts:12:13: warning eslint(no-unused-vars): Identifier 'crypto' is imported but never used. help: Consider removing this import.
src/coaching/coaching.service.ts:13:24: warning eslint(no-unused-vars): Type 'DrizzleDB' is imported but never used. help: Consider removing this import.
src/coaching/coaching.service.ts:177:16: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/coaching/coaching.service.ts:504:27: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/coaching/coaching.service.ts:534:27: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/coaching/coaching.service.ts:534:54: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/dataset-export/services/authoritative-governance.service.ts:6:3: warning eslint(no-unused-vars): Identifier 'ConflictException' is imported but never used. help: Consider removing this import.
src/dataset-export/services/authoritative-governance.service.ts:10:81: warning eslint(no-unused-vars): Identifier 'coaches' is imported but never used. help: Consider removing this import.
src/dataset-export/services/authoritative-governance.service.ts:11:14: warning eslint(no-unused-vars): Identifier 'and' is imported but never used. help: Consider removing this import.
src/dataset-export/services/authoritative-governance.service.ts:86:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/dataset-export/services/authoritative-governance.service.ts:87:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/notifications/notifications.service.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/dataset-export/dto/promotion-request.dto.ts:8:3: warning eslint(no-unused-vars): Identifier 'Matches' is imported but never used. help: Consider removing this import.
src/dataset-export/dto/candidate-export.dto.ts:15:29: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
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
src/dataset-export/services/governance-verifier.service.ts:45:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/dataset-export/services/governance-verifier.service.ts:46:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
```

### build

`pnpm --filter nestjs-api build` — exit 0

```text
$ nest build
```

### test

`pnpm --filter nestjs-api test` — exit 1

```text
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

⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯

Vitest caught 2 unhandled errors during the test run.
This might cause false positive tests. Resolve unhandled errors to make sure your tests are not affected.

⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯
EnvironmentTeardownError: [vitest-worker]: Closing rpc while "onUserConsoleLog" was pending
This error originated in "test/coaching-loop-persistence.spec.ts" test file. It doesn't mean the error was thrown inside the file itself, but while it was running.

⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯
EnvironmentTeardownError: [vitest-worker]: Closing rpc while "onUserConsoleLog" was pending
This error originated in "test/coaching-loop-persistence.spec.ts" test file. It doesn't mean the error was thrown inside the file itself, but while it was running.
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯


 Test Files  6 failed | 60 passed (66)
      Tests  26 failed | 1048 passed (1074)
     Errors  2 errors
   Start at  14:07:39
   Duration  21.75s (transform 9.37s, setup 0ms, import 166.98s, tests 8.54s, environment 17ms)

[ELIFECYCLE] Test failed. See above for more details.
Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL

  × "pnpm recursive run" failed in D:\test\ai-worktrees\T-037\nestjs-api

```

### test:db

`pnpm --filter nestjs-api test:db` — exit 0

```text
PASS 018 adds the required plan phase enum and records ledger 18
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
Migration checks passed: 46. PostgreSQL stopped after tests. Scratch: C:\Users\DAN\AppData\Local\Temp\mma-migrations-7IsPyv
```

### db:check

`pnpm --filter nestjs-api db:check` — exit 0

```text
$ node run_sql.mjs --check
001-030 checksums OK. No database connection was opened.
```

## Lệch so với ticket

Không có thay đổi contract hay phạm vi. Repository giữ nguyên vì cơ chế hiện có đã đáp ứng yêu cầu ghi/preserve; test SQL xác nhận. Không đổi frontend, buildCornerCard hay các hằng ngưỡng. Không cài thư viện, không kết nối Supabase, không push/merge.

## Câu hỏi / việc còn mở

- Full test có 2 EnvironmentTeardownError từ coaching-loop-persistence. Số test fail và file fail bằng baseline; baseline không có số unhandled errors để đối chiếu. Chưa sửa phần này vì ngoài phạm vi ticket.
- Chủ dự án tự áp migration 030. Chưa có bằng chứng áp migration lên hosted/Supabase.
- Build và kiểm chuyển JSON Schema của toàn bộ DTO thay đổi đều qua. Không khởi chạy app với dịch vụ thật vì không có .env; không tuyên bố đã kiểm kết nối runtime tới dịch vụ ngoài.

