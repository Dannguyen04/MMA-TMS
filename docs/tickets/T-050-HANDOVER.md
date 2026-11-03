# T-050 Handover: phần A backend (nguồn đình chỉ, kết thúc sớm có căn cứ, migration 033)

- Nhánh: `User_Feature`    Commit: chưa commit (trên `6ade825`)
- Trạng thái: IN REVIEW
- Người làm: Claude subagent thay `agy` (agy không chạy được). Chỉ phần A; phần B (frontend) chưa làm.

## Thay đổi

| File | Thay đổi |
| --- | --- |
| `nestjs-api/migrations/033_suspension_early_end.sql` (mới) | Khung như 032: `BEGIN`, `SET LOCAL`, `pg_advisory_xact_lock(20260916, 33)`, preflight (ledger table; chưa có 33; có 25; có 11; có `public.suspensions` và `uq_medical_examination_fighter`), enum `suspension_issuer`, 4 cột, `ck_suspensions_issuer`, `ck_suspensions_early_end`, `fk_suspensions_early_end_examination (early_end_examination_id, fighter_id) → medical_examinations (id, fighter_id)`, ghi ledger 33. Không thêm quyền, trigger, bảng, loại thông báo. |
| `nestjs-api/migrations/manifest.json`, `scripts/migration-files.mjs`, `run_sql.mjs`, `package.json`, `migrations/README.md` | Đăng ký 033: checksum (sha256 của nội dung LF, cùng thuật toán `readVerifiedMigrations`), tên file, `--apply-033` và dòng usage, thông báo `001-033 checksums OK`, `db:migrate:033`, mục "Áp dụng migration 033" và tiêu đề "003–033". |
| `nestjs-api/scripts/test-migrations.mjs` | Ca `M1-M6` (DB riêng `mma_033_on_025`, áp 003–025 rồi 033). |
| `nestjs-api/src/database/schema.ts` | `suspensionIssuerEnum`, 4 cột, 2 check, FK ghép. |
| `src/suspensions/suspensions.constants.ts` | `SUSPENSION_ISSUERS`, `SuspensionIssuer`, thông báo `END_EARLY`. |
| `src/suspensions/suspensions.model.ts` | `createSuspensionSchema` nhận `issuedBy?`, `issuerReference?` (trim 3–200) và kiểm quy tắc 1 trong `superRefine`. `endSuspensionEarlySchema` (`note` 3–500, `examinationId?` uuid, `liftReference?` 3–200, đúng một trong hai). Phản hồi thêm 4 trường. `gradedReturnFor`: thêm `MEDICAL`; `R` = ngày học viện của `clearedAt` khi có, bất kể `requiresClearance`; sửa JSDoc. |
| `src/suspensions/suspensions.error.ts` | `suspensionEarlyEndNotEligible(reason, status)` 409 `SUSPENSION_EARLY_END_NOT_ELIGIBLE`; `suspensionEarlyEndExamInvalid(cause)` 409 `SUSPENSION_EARLY_END_EXAM_INVALID`, `cause` gồm đúng 7 giá trị của ticket. |
| `src/suspensions/suspensions.repo.ts` | `findEarlyEndExamination(id, tx)`: dòng thô (fighterId, doctorUserId qua `sports_doctors.user_id`, scope, decision, examinedAt, validUntil, `superseded` = có phiếu khác `supersedes_id` = phiếu này). Service tự kết luận `cause`. `clearSuspension` nhận thêm `earlyEndExaminationId?`, `liftReference?` (dùng chung lệnh UPDATE, không thêm hàm ghi mới). |
| `src/suspensions/suspensions.service.ts` | Constructor nhận `AcademySettingsRepository`. `createSuspension` ghi `issuedBy` (mặc định `CLUB`), `issuerReference`. Thêm `endSuspensionEarly`, thứ tự kiểm theo ticket bước 1–6. `toSuspensionResponse` thêm 4 trường. |
| `src/suspensions/suspensions.controller.ts`, `suspensions.dto.ts` | `POST /suspensions/:id/end-early`, quyền `suspension:clear`, `EndSuspensionEarlyDto`, Swagger envelope. |
| `src/suspensions/suspensions.module.ts` | Import `AcademySettingsModule` (chỉ phụ thuộc `DatabaseModule`, không tạo vòng). |
| `src/suspensions/*.spec.ts` | Ca kiểm thử (bảng dưới). |

## Ca kiểm thử → test

Service test: `vi.setSystemTime('2026-11-05T03:00:00Z')`; repo mock và `AcademySettingsRepository` mock; `lockSuspensionById` trả đúng dòng của ca; `repo.transaction` chỉ gọi `work(tx)` (không tự đổi dữ liệu); `findEarlyEndExamination` trả dòng phiếu thô. Mock `clearSuspension` trả dòng khoá cộng với các giá trị đã ghi (giống UPDATE). Tên test có tiền tố describe `T-050 issuer and early end` để không trùng C1–C7 của T-049.

| Ca | Test (file:dòng) |
| --- | --- |
| C1 | `src/suspensions/suspensions.service.spec.ts:1003` |
| C2 | `suspensions.service.spec.ts:1020`; DTO: `suspensions.controller.spec.ts:137` |
| C3 | `suspensions.service.spec.ts:1033`; DTO: `suspensions.controller.spec.ts:137` |
| C4 | `suspensions.service.spec.ts:1052` |
| C5 | `suspensions.service.spec.ts:1064`; DTO: `suspensions.controller.spec.ts:137` |
| E1 | `suspensions.service.spec.ts:1079` |
| E2 | `suspensions.service.spec.ts:1095` |
| E3 | `suspensions.service.spec.ts:1106` |
| E4 | `suspensions.service.spec.ts:1117` |
| E5 | `suspensions.service.spec.ts:1128` |
| E6 | `suspensions.service.spec.ts:1146` |
| E7 | `suspensions.service.spec.ts:1159` |
| E8 | `suspensions.service.spec.ts:1164` |
| E9 | `suspensions.service.spec.ts:1169` |
| E10 | `suspensions.service.spec.ts:1179`; DTO: `suspensions.controller.spec.ts:137` |
| E11 | `suspensions.service.spec.ts:1193` |
| E12 | `suspensions.service.spec.ts:1198` |
| E13 | `suspensions.service.spec.ts:1212` |
| E14 | `suspensions.service.spec.ts:1226` |
| E15 | `suspensions.service.spec.ts:1244`; DTO: `suspensions.controller.spec.ts:137` |
| X2–X11 | `suspensions.service.spec.ts:1273, 1280, 1285, 1290, 1295, 1300, 1305, 1310, 1318, 1324` |
| O1–O5 | `suspensions.service.spec.ts:1332, 1347, 1353, 1360, 1375` (O4 DTO: `suspensions.controller.spec.ts:137`) |
| G1–G4 | `src/suspensions/suspensions.model.spec.ts:1168, 1181, 1193, 1200` |
| G5 | Test T-045 có sẵn `suspensions.model.spec.ts:1099` và `training-session.service.spec.ts:1067`, không sửa, qua |
| G6 | `src/suspensions/suspension.gate.spec.ts:333` (gate thật + `trainingSuspensionActive`, cùng cách nối của `TrainingSessionService.assertNotSuspended`) |
| M1–M6 | `nestjs-api/scripts/test-migrations.mjs:1099` |

Kiểm thêm (đã hoàn tác): tắt tạm kiểm `SUPERSEDED` và `EXPIRED` trong service thì X8, X9 lỗi; bật lại thì qua. Mock không làm test qua bất kể code.

### G1 trên code cũ (trước khi sửa `gradedReturnFor`)

```
 ❯ src/suspensions/suspensions.model.spec.ts (48 tests | 1 failed | 46 skipped) 6ms
     × G1: SC ended early at 2026-11-05T03:00:00Z -> ceiling 3 on 11-05, ceiling 4 on 11-06, null on 11-07 5ms

 FAIL  src/suspensions/suspensions.model.spec.ts > T-050 graded return for MEDICAL > G1: SC ended early at 2026-11-05T03:00:00Z -> ceiling 3 on 11-05, ceiling 4 on 11-06, null on 11-07
AssertionError: expected null to deeply equal { ceiling: 3, …(1) }

- Expected:
{
  "ceiling": 3,
  "fullReturnOn": "2026-11-07",
}

+ Received:
null

 Test Files  1 failed (1)
      Tests  1 failed | 1 passed | 46 skipped (48)
```

### G1 sau khi sửa

```
 Test Files  1 passed (1)
      Tests  2 passed | 46 skipped (48)
```
(`-t "G1"` khớp 2 test; cả file: `Tests  48 passed (48)`.)

## Đối chiếu tiêu chí nghiệm thu

| Tiêu chí | Đáp ứng |
| --- | --- |
| 1. Mọi ca có test đúng tên, đầu vào, kết quả; G1 lỗi trên code cũ, qua trên code mới | Bảng trên; output G1 ở trên |
| 2. `test:db` qua M1–M6; `db:check` báo `001-033 checksums OK` | `PASS M1-M6 …`; `001-033 checksums OK` |
| 3. `/clear` không đổi (E12, test T-049 qua) | E12 qua; describe T-049 qua không sửa |
| 4. Phản hồi có 4 trường mới; client không gửi `issuedBy` vẫn tạo được (C4) | `toSuspensionResponse`, `suspensionResponseSchema`; C4 |
| 5. Không thêm lỗi so với baseline | Xem "Lệnh đã chạy" |

## Lệnh đã chạy

`pnpm --filter nestjs-api lint`: exit 0, 38 cảnh báo, không cảnh báo nào ở `src/suspensions` hay `schema.ts` (đều là cảnh báo có sẵn ở coaching, dataset-export, app.module). Dòng cuối:
```
src/app.module.ts:18:10: warning eslint(no-unused-vars): Identifier 'NotificationsModule' is imported but never used. help: Consider removing this import.
```

`pnpm --filter nestjs-api build`: exit 0
```
$ nest build
```

`pnpm --filter nestjs-api test`: exit 1
```
 Test Files  6 failed | 62 passed (68)
      Tests  26 failed | 1205 passed (1231)
```
6 file lỗi đều trong baseline: B1 `test/coaching-loop-persistence.spec.ts` (5) và `test/dataset-export-trust-boundary.spec.ts` (21), cần Redis/Supabase; B2 bốn file spec rỗng `src/notifications/{notification-producer.service,notification-stream.service,notifications.config,notifications.service}.spec.ts`. Không có lỗi mới.

`pnpm --filter nestjs-api test:db`: exit 0
```
PASS M1-M6: 033 applies on ledger 11 and 25 without 026-032; issuer and early-end constraints; composite FK to the examination of the same fighter
...
PASS 012 rejects reapplication without changing the applied ledger
Migration checks passed: 50. PostgreSQL stopped after tests.
```

`pnpm --filter nestjs-api db:check`:
```
$ node run_sql.mjs --check
001-033 checksums OK. No database connection was opened.
```

## Lệch so với ticket

- Sửa 3 chỗ trong test có sẵn, chỉ vì trường mới, không đổi hành vi được kiểm:
  - `suspensions.service.spec.ts` test "creates a manual suspension with defaults…": giá trị ghi mong đợi thêm `issuedBy: 'CLUB', issuerReference: null`.
  - Mock `clearSuspension` của spec đó trả mọi cột đã ghi (trước chỉ chép 3 cột), giống UPDATE thật; cần để E1/O1 thấy `earlyEndExaminationId`/`liftReference` trong phản hồi.
  - `suspensions.controller.spec.ts`: danh sách route thêm `end-early` (test "exposes exactly …" liệt kê đủ endpoint).
- `makeSuspension` ở `suspensions.service.spec.ts` và `suspension.gate.spec.ts` thêm 4 trường mặc định.
- `src/training/training-suspension-conflicts.service.spec.ts` (5 chỗ) vẫn gọi `new SuspensionsService(repo, effects)` hai tham số. Các test đó chỉ gọi `createSuspension` nên vẫn chạy qua; spec không nằm trong `tsconfig.build`. Không sửa vì file ngoài danh sách của ticket.
- C2/C3/C5/E10/E15/O4 có cả ca service và ca DTO (pipe Zod) trong một test controller.

## Câu hỏi / việc còn mở

- Không có câu hỏi chặn. Không thêm mã lỗi, quyền, endpoint hay cột ngoài ticket.
- Có file lạ `.claudesettings.local.json` (0 byte, chưa track) ở gốc repo, xuất hiện trong phiên; không phải file của ticket, không đụng tới.
- Phần B (frontend) chưa làm.

## Lượt sửa 1 (03/11/2026)

### Thay đổi (không đổi hành vi)

1. `suspensions.constants.ts`: xoá `type SuspensionIssuer` (không ai dùng; giữ hằng `SUSPENSION_ISSUERS`).
2. `suspensions.model.ts` `gradedReturnFor`: ba phép `!==` trên `reason` thành một dòng
   `if (!['KO', 'TKO', 'MEDICAL'].includes(suspension.reason ?? '')) return null;`
   Lệch nhỏ so với prompt: thêm `?? ''` vì `SuspensionGradedReturnInput.reason` là `SuspensionReason | undefined`; bản không có `?? ''` lỗi build `TS2345` (`suspensions.model.ts:193:42`). `undefined` vẫn trả `null` như trước.
3. `suspensions.service.ts` `endSuspensionEarly`, nhánh `issuedBy === 'CLUB'`: đoạn tự gọi `isDoctorAssignedToFighter` + `forbidden()` thay bằng `await this.assertClearAccess(actor, current.fighterId);`. Thứ tự kiểm giữ nguyên: 422 thiếu `examinationId` -> 403 vai trò (`actor.role !== USER.DOCTOR`) -> 409 NONE -> 403 chưa được phân.

### Ca kiểm thử mới (`suspensions.service.spec.ts`, ngay sau E15)

- **E15b**: SC, D gửi `{ note: 'Khám ổn, hết đau đầu', liftReference: 'CV 15/BTC ngày 04/11 gỡ đình chỉ' }` (không có `examinationId`) -> 422 `VALIDATION_ERROR`; `repo.transaction` và `repo.clearSuspension` không được gọi.
- **E8b**: SC, chế độ NONE, HLV C gửi `examinationId` X1 -> 403 (không phải 409 `MEDICAL_SUPERVISION_DISABLED`); `repo.transaction` và `repo.clearSuspension` không được gọi.

### Chứng minh lỗi trước / qua sau

E15b, tạm xoá khối `if (examinationId === undefined) { throw ... }` (lời gọi chạy qua và ghi, không ném lỗi):
```
 FAIL  src/suspensions/suspensions.service.spec.ts > SuspensionsService > T-050 issuer and early end > E15b: SC, D with note and liftReference but no examinationId -> 422 VALIDATION_ERROR, no transaction, no write
AssertionError: expected AssertionError: expected "Expected HTTP 4… { …(3) } to be an instance of HttpException
 ❯ expectHttp src/suspensions/suspensions.service.spec.ts:87:19
 Test Files  1 failed | 4 skipped (5)
      Tests  1 failed | 122 skipped (123)
```
Khôi phục:
```
 Test Files  1 passed | 4 skipped (5)
      Tests  1 passed | 122 skipped (123)
```

E8b, tạm xoá dòng `if (actor.role !== USER.DOCTOR) throw forbidden();`:
```
 FAIL  src/suspensions/suspensions.service.spec.ts > SuspensionsService > T-050 issuer and early end > E8b: SC in NONE mode, coach C with examinationId X1 -> 403 (not 409 MEDICAL_SUPERVISION_DISABLED), no write
AssertionError: expected 409 to be 403 // Object.is equality
 ❯ src/suspensions/suspensions.service.spec.ts:1271:33
 Test Files  1 failed | 4 skipped (5)
      Tests  1 failed | 122 skipped (123)
```
Khôi phục:
```
 Test Files  1 passed | 4 skipped (5)
      Tests  1 passed | 122 skipped (123)
```
Sau mỗi lần thử, file service được chép lại từ bản sao lưu và so `cmp` khớp.

### Lệnh (chạy lại sau khi sửa)

`pnpm --filter nestjs-api exec vitest run src/suspensions`: exit 0
```
 Test Files  5 passed (5)
      Tests  123 passed (123)
```

`pnpm --filter nestjs-api lint`: exit 0, 38 warning, không warning nào trong `src/suspensions/`. Cuối output:
```
src/dataset-export/services/authoritative-governance.service.ts:87:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/main.ts:7:10: warning eslint(no-unused-vars): Identifier 'createOpenApiDocument' is imported but never used. help: Consider removing this import.
```

`pnpm --filter nestjs-api build`: exit 0
```
$ nest build
```

`pnpm --filter nestjs-api exec vitest run src/suspensions src/bouts src/training src/medical`: exit 0
```
 Test Files  28 passed (28)
      Tests  840 passed (840)
```

Không chạy `pnpm test` toàn bộ (theo prompt), `test:db`, `db:check` (lượt này không đụng migration).

## Lượt sửa 2 (03/11/2026 - chỉ test)

### Thay đổi
1. `nestjs-api/src/training/training-suspension-conflicts.service.spec.ts`:
   - Khắc phục lỗi `TS2719` bằng cách bổ sung 4 cột mới vào `makeSuspensionRow` theo khuôn `src/suspensions/suspensions.service.spec.ts`: `issuedBy: 'CLUB'`, `issuerReference: null`, `earlyEndExaminationId: null`, `liftReference: null`.
   - Khắc phục lỗi `TS2554` (thiếu tham số thứ 3 `AcademySettingsRepository` khi khởi tạo `SuspensionsService`):
     - Import `type { AcademySettingsRepository } from '../academy-settings/academy-settings.repo.js'`.
     - Khai báo mock `settings: { getMedicalSupervision: ReturnType<typeof vi.fn> }` trong `describe` và gán giá trị mặc định `settings = { getMedicalSupervision: vi.fn().mockResolvedValue('DOCTOR') }` trong `beforeEach`.
     - Cập nhật 5 vị trí khởi tạo `new SuspensionsService(suspensionsRepo, suspensionEffects, settings as unknown as AcademySettingsRepository)`.
   - Không thay đổi kết quả mong đợi của bất kỳ test nào; giữ diff ngắn nhất.

### Số lỗi tsc trước và sau
- Trước: 85 dòng `error TS` (gồm 6 lỗi từ `training-suspension-conflicts.service.spec.ts`: 1 lỗi `TS2719` tại dòng 75 và 5 lỗi `TS2554` tại các dòng 709, 780, 869, 1037, 1465).
- Sau: 79 dòng `error TS` (giảm đúng 6 lỗi; lọc `training-suspension-conflicts` hoàn toàn sạch lỗi).

### Output các lệnh
- `cd nestjs-api; npx tsc --noEmit -p tsconfig.json | Select-String "training-suspension-conflicts"`:
  ```
  (Không có lỗi nào, lọc trả về rỗng)
  ```
- `cd nestjs-api; npx tsc --noEmit -p tsconfig.json | Select-String "error TS" | Measure-Object -Line`:
  ```
  Lines Words Characters Property
  ----- ----- ---------- --------
     79                          
  ```
- `pnpm --filter nestjs-api exec vitest run src/training src/suspensions`: exit 0
  ```
   Test Files  12 passed (12)
        Tests  323 passed (323)
     Start at  15:33:49
     Duration  3.56s (transform 1.33s, setup 0ms, import 17.33s, tests 5.87s, environment 1ms)
  ```
- `pnpm --filter nestjs-api lint`: exit 0 (38 cảnh báo có sẵn ở baseline, không cảnh báo nào trong `src/training` hay `src/suspensions`). Dòng cuối:
  ```
  src/notifications/notification-stream.service.ts:333:31: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
  src/app.module.ts:18:10: warning eslint(no-unused-vars): Identifier 'NotificationsModule' is imported but never used. help: Consider removing this import.
  ```
- `pnpm --filter nestjs-api build`: exit 0
  ```
  $ nest build
  ```
