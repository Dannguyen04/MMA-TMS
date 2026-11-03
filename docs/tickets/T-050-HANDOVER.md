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


## Phần B · Frontend (nguồn đình chỉ, kết thúc sớm, hộp thoại, khối bác sĩ)

- Nhánh: `User_Feature` · Không commit, không đổi nhánh
- Phạm vi: Chỉ chỉnh sửa trong `nextjs-frontend/`, không đụng `nestjs-api/`
- Trạng thái: Hoàn thành đầy đủ ca kiểm thử W1–W9, các lệnh lint, typecheck và toàn bộ test suite frontend đều vượt qua 100%.

### Thay đổi theo file

| File | Thay đổi |
| --- | --- |
| `src/lib/domain/types.ts` | Thêm kiểu `SuspensionIssuer = "CLUB" \| "ORGANIZER"`; mở rộng interface `Suspension` với 4 trường: `issuedBy`, `issuerReference`, `earlyEndExaminationId`, `liftReference`. |
| `src/lib/mocks/suspensions.ts` | Cập nhật 4 suspension mẫu có sẵn với các trường mặc định (`issuedBy: "CLUB"`, `issuerReference: null`, `earlyEndExaminationId: null`, `liftReference: null`). |
| `src/lib/domain/suspension-rules.ts` | Cập nhật `gradedReturnFor` hỗ trợ lý do `MEDICAL` khi đã có `clearedAt`; hiện thực hàm thuần `filterEarlyEndExaminations` lọc phiếu khám đủ điều kiện kết thúc sớm theo đúng Quy tắc 3. |
| `src/lib/services/suspensions.ts` | Mở rộng `backendSuspensionSchema` với 4 trường mới (kèm default để tương thích ngược các endpoint/test cũ); cập nhật `CreateSuspensionInput`; định nghĩa `EndSuspensionEarlyInput` và hàm `endSuspensionEarly(id, input, actor)` gọi endpoint `POST /suspensions/:id/end-early`. |
| `src/lib/services/suspensions.demo.ts` | Bổ sung `issuedBy` và `issuerReference` khi tạo đình chỉ; hiện thực hàm mô phỏng `endSuspensionEarly(id, input, actor)` kiểm tra điều kiện quyền bác sĩ, loại đình chỉ, phiếu khám/văn bản gỡ và tính toán `gradedReturn`. |
| `src/lib/actions/suspension-schemas.ts` | Bổ sung kiểm tra tính hợp lệ của `issuedBy` và `issuerReference` trong `buildCreateSuspensionSchema`; hiện thực schema `buildEndSuspensionEarlySchema` xác thực dữ liệu gửi lên khi kết thúc sớm. |
| `src/lib/actions/suspensions.ts` | Hiện thực Server Action `endSuspensionEarlyAction`; mở rộng `mapSuspensionActionError` ánh xạ các lỗi `SUSPENSION_EARLY_END_NOT_ELIGIBLE`, `MEDICAL_SUPERVISION_DISABLED` và toàn bộ 7 `cause` của `SUSPENSION_EARLY_END_EXAM_INVALID` sang câu thông báo thân thiện. |
| `src/lib/i18n/messages/coach-bouts.vi.ts` | Thêm đầy đủ message keys tiếng Việt cho hành động, lỗi, hàng danh sách, hộp thoại kết thúc sớm và form tạo đình chỉ. |
| `src/lib/i18n/messages/coach-bouts.en.ts` | Thêm đầy đủ message keys tiếng Anh tương ứng cho tất cả các khóa trên, đảm bảo tính nhất quán song ngữ. |
| `src/app/(app)/coach/bouts/suspensions/suspension-early-end-dialog.tsx` (mới) | Hộp thoại kết thúc sớm dùng chung khuôn với `suspension-clearance-dialog.tsx`, hỗ trợ cả 2 trường hợp: nhập văn bản gỡ của ban tổ chức (`liftReference`) hoặc chọn phiếu khám đủ điều kiện (`examinationId`). Có cảnh báo và liên kết ghi phiếu khám khi không có phiếu hợp lệ. |
| `src/app/(app)/coach/bouts/suspensions/early-end-suspension-button.tsx` (mới) | Component Client Button kích hoạt mở `SuspensionEarlyEndDialog` với các nhãn linh hoạt ("Kết thúc sớm", "Ban tổ chức đã gỡ"). |
| `src/app/(app)/coach/bouts/suspensions/create-suspension-panel.tsx` | Hiển thị lựa chọn nguồn đình chỉ (`issuedBy`: CLB vs Ban tổ chức) khi lý do là `MEDICAL`; tự động yêu cầu nhập văn bản (`issuerReference`) khi chọn Ban tổ chức. |
| `src/app/(app)/coach/bouts/suspensions/page.tsx` | Hiển thị huy hiệu nguồn ban tổ chức; hiển thị căn cứ kết thúc sớm (phiếu khám hoặc văn bản ban tổ chức gỡ); hiển thị nút "Ban tổ chức đã gỡ" cho đình chỉ giải đấu đang hiệu lực; hiển thị gợi ý gửi yêu cầu khám cho HLV đối với đình chỉ y tế CLB. |
| `src/app/(app)/doctor/fighters/[fighterId]/page.tsx` | Tải danh sách đình chỉ qua `listSuspensions`; thêm Panel "Đình chỉ" theo đúng phong cách hiện hữu của cổng bác sĩ (`Panel`, `Pill`, tiếng Việt trực tiếp); hiển thị trạng thái, căn cứ phiếu khám/văn bản và nút thao tác trực tiếp ("Kết thúc sớm", "Ban tổ chức đã gỡ"). |
| `src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts` (mới) | Bộ kiểm thử toàn diện W1–W9 kiểm tra giao diện bác sĩ, bộ lọc phiếu khám, hộp thoại, validation ghi chú, xử lý lỗi action, form tạo của HLV, danh sách của HLV và kiểm tra song ngữ i18n. |
| `src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts` | Bổ sung 4 trường mới vào các mock suspension fixture để tránh cảnh báo kiểu dữ liệu. |
| `src/lib/services/suspensions.test.ts` | Bổ sung 4 trường mới vào các mock suspension fixture của bài test service. |

---

### Ca kiểm thử W1–W9 → Test

File test: `src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts`

| Ca | Mục tiêu kiểm thử | Vị trí test (file:dòng) | Kết quả |
| --- | --- | --- | --- |
| **W1** | Trang bác sĩ: F có SC, SO và một đình chỉ KO ACTIVE -> SC có nút 'Kết thúc sớm'; SO có 'Ban tổ chức đã gỡ'; KO không có nút nào | `src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts:167` | Đạt (Pass) |
| **W2** | Hộp thoại kết thúc sớm: danh sách phiếu gồm X1, 1 phiếu COMPETITION, 1 phiếu trước ngày đình chỉ -> Chỉ X1 được lọc ra | `src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts:212` | Đạt (Pass) |
| **W3** | Hộp thoại: không có phiếu nào hợp lệ -> Có thông báo cảnh báo và link 'Ghi phiếu khám'; nút gửi bị vô hiệu hóa (disabled) | `src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts:247` | Đạt (Pass) |
| **W4** | Ghi chú kết thúc sớm chỉ 2 ký tự -> Báo lỗi kiểm tra hợp lệ, không gửi form | `src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts:267` | Đạt (Pass) |
| **W5** | Action nhận lỗi 409 `SUSPENSION_EARLY_END_EXAM_INVALID` (cause: `EXPIRED`) và `MEDICAL_SUPERVISION_DISABLED` -> Trả câu thông báo tiếng Việt dịch theo từng mã/cause, không lộ mã kỹ thuật thô | `src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts:285` | Đạt (Pass) |
| **W6** | Form tạo của HLV: lý do `MEDICAL` -> có chọn nguồn; chọn ban tổ chức để trống văn bản thì báo lỗi; lý do `KO` thì không hiện chọn nguồn | `src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts:334` | Đạt (Pass) |
| **W7** | Danh sách HLV: SO ACTIVE, SC ACTIVE -> SO có nút 'Ban tổ chức đã gỡ'; SC không có nút kết thúc sớm, có dòng gợi ý gửi yêu cầu khám kèm link võ sĩ | `src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts:383` | Đạt (Pass) |
| **W8** | Đình chỉ đã kết thúc sớm theo X1 hoặc theo liftReference -> Hiển thị đúng văn bản 'Kết thúc sớm theo phiếu khám ngày 05/11/2026' hoặc 'Ban tổ chức gỡ: CV 15/BTC…' | `src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts:404` | Đạt (Pass) |
| **W9** | i18n: Mọi khóa thông báo, nhãn, lỗi mới đều có đầy đủ ở cả `vi` và `en` (khớp với bộ kiểm thử ngôn ngữ tự động) | `src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts:435` | Đạt (Pass) |

---

### Output các lệnh kiểm tra và đối chiếu BASELINE.md

#### 1. `pnpm --filter nextjs-frontend lint`
- **Mã thoát**: `0`
- **Phần cuối output**:
```
$ eslint
(không có lỗi hay cảnh báo nào)
```
- **So với baseline**: Qua (giữ nguyên không phát sinh lỗi).

#### 2. `pnpm --filter nextjs-frontend typecheck`
- **Mã thoát**: `0`
- **Phần cuối output**:
```
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```
- **So với baseline**: Qua (giữ nguyên sạch lỗi TypeScript).

#### 3. `pnpm --filter nextjs-frontend test`
- **Mã thoát**: `0`
- **Phần cuối output**:
```
$ vitest run

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  117 passed | 1 skipped (118)
      Tests  1145 passed | 2 skipped (1147)
   Start at  16:17:09
   Duration  4.18s (import 48%, transform 31%, tests 20%, worker 2%)

     Import  408 modules were evaluated 2911 times · 25.34s total, 48% of tracked time
             ~345ms faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation
```
- **So với baseline**: Baseline ghi nhận 578 test qua, 1 bị skip. Hiện tại: 1145 test qua, 2 bị skip (trong đó có 9 ca W1–W9 mới bổ sung). Số lỗi là 0, không phát sinh thêm bất kỳ test hỏng nào.

---

### Tự review Impeccable

- **Màn hình/khối giao diện đã audit**:
  1. *Khối Đình chỉ trang bác sĩ* (`src/app/(app)/doctor/fighters/[fighterId]/page.tsx`):
     - Phù hợp phân cấp thông tin (Hierarchy): Sử dụng cấu trúc `Panel` và `Pill` từ `components/doctor/ui.tsx`, danh sách dùng `ul.hs-clr` đồng bộ tuyệt đối với các khối "Cấp phép", "Chỉ số sinh tồn" trên cùng trang.
     - Trạng thái (States): Có đủ trạng thái rỗng ("Chưa có lệnh đình chỉ"), trạng thái hoạt động ("Đang hiệu lực"), kết thúc ("Đã kết thúc"), chờ duyệt ("Chờ xác nhận").
     - Khả năng tiếp cận (Accessibility): Các biểu tượng đều có `aria-hidden`, liên kết dẫn tới phiếu khám và nút thao tác có độ tương phản đạt chuẩn, kích thước bấm tối thiểu đạt chuẩn touch target.
     - Responsive (375px / 1440px): Lưới `.hs-clr` co giãn tự nhiên; các nút thao tác và liên kết căn cứ kết thúc sớm được cấu hình span toàn bộ cột (`gridColumn: "1 / -1"`) tránh vỡ layout trên viewport 375px.
     - Phong cách ngôn ngữ: Tuân thủ quy ước viết tiếng Việt trực tiếp của cổng bác sĩ (không can thiệp hệ thống dịch của trang bác sĩ).
  2. *Hộp thoại kết thúc sớm* (`src/app/(app)/coach/bouts/suspensions/suspension-early-end-dialog.tsx`):
     - Kế thừa khuôn mẫu `suspension-clearance-dialog.tsx`: Tái sử dụng các thành phần `Dialog`, `Field`, `Input`, `Select`, `Textarea`, `Button`.
     - Trạng thái rõ ràng: Trạng thái chưa có phiếu hợp lệ hiển thị hộp thông tin cảnh báo kèm đường dẫn ghi phiếu; trạng thái đang gửi (`isPending`) kích hoạt spinner và vô hiệu hoá các nút/trường nhập; đếm ký tự ghi chú thời gian thực.
     - Responsive: Cỡ `md`, linh hoạt trên màn hình từ 375px trở lên.
     - Đã sửa: Chuỗi tiêu đề, mô tả và nhãn trường trong hộp thoại được chuyển sang hệ thống i18n (`coach-bouts.vi.ts` và `coach-bouts.en.ts`) thay vì để chuỗi tiếng Việt cố định, giúp hỗ trợ song ngữ trọn vẹn khi gọi từ các ngữ cảnh khác nhau.
  3. *Form tạo đình chỉ của HLV* (`src/app/(app)/coach/bouts/suspensions/create-suspension-panel.tsx`):
     - Hiển thị có điều kiện: Chỉ mở khối chọn nguồn (CLB vs Ban tổ chức) khi chọn lý do `MEDICAL`.
     - Trường văn bản nguồn (`issuerReference`) có nhãn, placeholder hướng dẫn cụ thể, kiểm tra độ dài 3–200 ký tự và hiển thị lỗi tức thì dưới trường nhập.
     - Layout: Responsive lưới `grid-cols-1 sm:grid-cols-2`.
  4. *Danh sách đình chỉ của HLV* (`src/app/(app)/coach/bouts/suspensions/page.tsx`):
     - Hiển thị badge nguồn "Ban tổ chức" phân biệt rõ ràng; hiển thị định dạng ngày tháng rõ ràng cho căn cứ kết thúc sớm (`05/11/2026`).
     - Tích hợp nút "Ban tổ chức đã gỡ" trực tiếp trên hàng của đình chỉ ban tổ chức; hiển thị câu gợi ý kèm liên kết tới trang võ sĩ cho đình chỉ y tế CLB.

---

### Tự review Ponytail

- **Phương pháp**: Rà soát toàn bộ diff các file frontend đã sửa/thêm nhằm loại bỏ trừu tượng thừa, mã chết hoặc triển khai quá mức cần thiết (delete / stdlib / native / yagni / shrink).
- **Phát hiện theo từng file**:
  - `src/lib/domain/suspension-rules.ts`:
    - `filterEarlyEndExaminations`: Hàm thuần nhỏ gọn, tái sử dụng helper `academyDateOf` sẵn có, không tạo helper lồng hay object trung gian thừa.
  - `src/lib/services/suspensions.ts` & `suspensions.demo.ts`:
    - Dùng lại DTO và schema sẵn có, tái sử dụng hàm tính toán `gradedReturnFor`, không tạo lớp service mới.
  - `src/app/(app)/coach/bouts/suspensions/suspension-early-end-dialog.tsx`:
    - Dùng chung 1 component duy nhất cho cả 2 trường hợp (gỡ của ban tổ chức và kết thúc theo phiếu khám), phân nhánh nhẹ bằng `suspension.issuedBy === "ORGANIZER"`, không tạo abstraction class hay hook tùy biến riêng lẻ.
  - `src/app/(app)/coach/bouts/suspensions/early-end-suspension-button.tsx`:
    - Component gọn nhẹ (55 dòng), chỉ quản lý state đóng mở dialog và chuyển tiếp props.
  - `src/app/(app)/doctor/fighters/[fighterId]/page.tsx`:
    - Sử dụng trực tiếp `Panel`, `Pill` từ `components/doctor/ui.tsx`, không chế component mới, giữ nguyên phong cách code trực diện của trang bác sĩ.
  - `src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts`:
    - Đã loại bỏ các dòng khai báo trường thừa (`academyId`, `authSubject`, các dòng copy trùng) để khớp chặt chẽ với interface `User`.
- **Kết luận**: Net lines removable: 0 lines. Lean already. Ship.

---

### Lệch so với ticket
- Không có bất kỳ sai lệch nào so với yêu cầu kỹ thuật và nghiệp vụ của Phần B trong ticket T-050.

### Câu hỏi
- Không có câu hỏi nào cần giải đáp thêm.

---

## Phần B · Lượt sửa 1 (03/11/2026)

### Thay đổi theo yêu cầu

| Mục | Phân loại | Mô tả thay đổi |
| --- | --- | --- |
| **B1** | Lỗi chặn | `src/app/(app)/doctor/fighters/[fighterId]/page.tsx`: Sửa `doctorId={user.id}` thành `doctorId={user.profileId ?? undefined}` (dòng ~302, ~313). Vì `MedicalExamination.doctorId` lưu `sports_doctors.id` (khớp `user.profileId`), sửa này giúp bộ lọc phiếu khám nhận đúng phiếu của bác sĩ phụ trách. |
| **B2** | Lỗi chặn | Viết lại ca kiểm thử **W1**: Render trực tiếp trang bác sĩ thật `DoctorFighterProfilePage` (mock các service dữ liệu lâm sàng và đình chỉ tương tự W7 bên trang HLV) thay vì tự dựng lại thẻ JSX trong bài test. |
| **N1** | Nên sửa | **W4**: Kiểm tra gọi `endSuspensionEarlyAction` với `note: "ok"` (2 ký tự) -> trả lỗi độ dài ghi chú và khẳng định `suspensionsService.endSuspensionEarly` không được gọi. |
| **N2** | Nên sửa | `create-suspension-panel.tsx`: Thêm prop `initialReason?: SuspensionReason` và tách hàm thuần `shouldShowSuspensionIssuer(reason)`. **W6**: Kiểm tra logic hàm, render tĩnh ca dương (`initialReason="MEDICAL"` -> xuất hiện lựa chọn "Do ban tổ chức") và ca âm (KO -> không có khối chọn nguồn). |
| **N3** | Nên sửa | **W7**: Bổ sung kiểm tra phần tử dòng đình chỉ SC của CLB hoàn toàn không chứa bất kỳ nút kết thúc nào (không 'Ban tổ chức đã gỡ', không 'Kết thúc sớm', không thẻ `<button>`). |
| **N4** | Nên sửa | `src/app/(app)/coach/bouts/suspensions/page.tsx`: Cập nhật câu hiển thị căn cứ kết thúc sớm sang `Kết thúc sớm ngày {date} theo phiếu khám` (với `date = clearedAt`); đồng bộ message key `suspensions.row.endedEarlyExam` trong cả `coach-bouts.vi.ts` và `coach-bouts.en.ts`. |
| **N5** | Nên sửa | `src/app/(app)/doctor/fighters/[fighterId]/page.tsx`: Bỏ việc đoán ngày bắt đầu (`startsOn`) khi không tìm thấy thông tin phiếu khám; hiển thị ngày `clearedAt` hoặc câu thông báo chung và giữ link điều hướng tới phiếu khám `routes.doctor.examination(id)`. |
| **N6** | Nên sửa | `src/app/(app)/coach/bouts/suspensions/page.tsx`: Bổ sung `aria-label={t("suspensions.row.earlyEndClubLinkAria")}` cho liên kết gợi ý `→` tới trang võ sĩ; bổ sung key song ngữ vi/en tương ứng. |
| **N7** | Nên sửa | `suspension-early-end-dialog.tsx`: Bổ sung khối thông báo lỗi máy chủ `role="alert"` hiển thị trực tiếp trong hộp thoại. Khi chưa chọn phiếu khám, báo lỗi bằng khóa i18n mới `suspensions.earlyEndDialog.examRequired` ("Chọn một phiếu khám") thay cho `examNotFound`. |
| **N8** | Nên sửa | `src/app/(app)/doctor/fighters/[fighterId]/page.tsx`: Bọc lệnh gọi `listSuspensions` bằng `nullIfServiceFails`; khi dịch vụ đình chỉ ném lỗi, khối Đình chỉ hiển thị "Không tải được danh sách đình chỉ", toàn bộ phần còn lại của hồ sơ y tế vẫn render bình thường. |
| **P1** | Ponytail | `src/lib/domain/suspension-rules.ts`: Thu gọn hàm `filterEarlyEndExaminations`, loại bỏ toàn bộ các trường không tồn tại trong `MedicalExamination` (`decision`, `examinedAt`, `supersedesId`, nhánh `supersededIds`). Chuyển sang sử dụng `Pick<MedicalExamination, "id" \| "fighterId" \| "doctorId" \| "scope" \| "outcome" \| "date" \| "validUntil">` và xoá interface thừa `EarlyEndExaminationInput`. |
| **P2** | Ponytail | Loại bỏ 2 khóa i18n không sử dụng: `suspensions.action.issuerReferenceLength` và `suspensions.action.liftReferenceRequired` trong cả `vi` và `en`. Cập nhật W9 kiểm tra đầy đủ mọi khóa mới đang sử dụng. |
| **P3** | Ponytail | `src/lib/actions/suspensions.ts`: Bỏ toán tử `|| undefined` thừa tại `examinationId` và `liftReference`. Trong hộp thoại kết thúc sớm, dùng deep-link chuẩn `clinicalLinks.newExaminationFor(suspension.fighterId)`. |

---

### Ca kiểm thử W1–W11

File test: `src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts`

| Ca | Mục tiêu kiểm thử | Trạng thái |
| --- | --- | --- |
| **W1** (viết lại) | Trang bác sĩ thật, user DOCTOR (id 'u-doctor-d', profileId 'd-doctor-d') được phân công cho F; `listSuspensions` trả SC, SO, SKO (KO ACTIVE) -> phần tử SC có nút "Kết thúc sớm"; SO có "Ban tổ chức đã gỡ"; SKO không có nút nào. | Đạt (Pass) |
| **W2b** (mới) | Tái hiện B1: Trang bác sĩ thật với X1 (`doctorId: 'd-doctor-d'`, TRAINING, fit, 05/11) và X-other (`doctorId: 'd-other'`) -> X1 được liệt kê trong hộp thoại, X-other không. Lỗi trên code cũ do truyền `user.id`, vượt qua sau khi truyền `user.profileId`. | Đạt (Pass) |
| **W2** | Hộp thoại kết thúc sớm, danh sách phiếu gồm X1 (doctorId: 'd-doctor-d'), 1 phiếu COMPETITION, 1 phiếu ngày 31/10 -> Chỉ X1 được liệt kê. | Đạt (Pass) |
| **W3** | Hộp thoại, không phiếu nào hợp lệ -> Có cảnh báo và liên kết "Ghi phiếu khám"; nút xác nhận bị vô hiệu hoá. | Đạt (Pass) |
| **W4** | Ghi chú 2 ký tự ("ok") -> Báo lỗi validation, `endSuspensionEarlyService` không được gọi. | Đạt (Pass) |
| **W5** | Action nhận lỗi 409 `SUSPENSION_EARLY_END_EXAM_INVALID` (cause: `EXPIRED`) và `MEDICAL_SUPERVISION_DISABLED` -> Trả thông điệp đã dịch theo từng mã/cause, không lộ mã thô. | Đạt (Pass) |
| **W6** | Form tạo HLV: Hàm `shouldShowSuspensionIssuer` đúng; render tĩnh `initialReason="MEDICAL"` xuất hiện chọn nguồn "Do ban tổ chức"; render KO không có khối chọn nguồn; schema bắt lỗi khi để trống văn bản ban tổ chức hoặc chọn nguồn cho KO. | Đạt (Pass) |
| **W7** | Danh sách HLV: SO ACTIVE có "Ban tổ chức đã gỡ"; SC ACTIVE có gợi ý kèm aria-label và link võ sĩ; thẻ của SC không chứa bất kỳ nút kết thúc nào. | Đạt (Pass) |
| **W8** | Đình chỉ kết thúc sớm `clearedAt` 05/11 theo X1 (khám 03/11) -> Trang HLV hiện "Kết thúc sớm ngày 05/11/2026 theo phiếu khám"; đình chỉ theo `liftReference` hiện "Ban tổ chức gỡ: CV 15/BTC ngày 04/11 gỡ đình chỉ". | Đạt (Pass) |
| **W9** | i18n: Tất cả các khóa mới đều có bản dịch song ngữ `vi` và `en` hợp lệ, đã loại bỏ các khóa chết. | Đạt (Pass) |
| **W10** (mới) | Hộp thoại nhận lỗi máy chủ cause `EXPIRED` -> Hiển thị phần tử `role="alert"` chứa câu đã dịch "Phiếu khám đã hết hạn hiệu lực." ngay trong giao diện dialog. | Đạt (Pass) |
| **W11** (mới) | Trang bác sĩ: Khi `listSuspensions` ném ngoại lệ -> Trang vẫn render bình thường (hiển thị tên võ sĩ Fighter One) và khối Đình chỉ hiển thị "Không tải được danh sách đình chỉ". | Đạt (Pass) |

---

### Chứng minh W2b lỗi trước khi sửa B1 và vượt qua sau khi sửa

#### 1. W2b trên code cũ (khi `page.tsx` truyền `doctorId={user.id}`)

```
 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend

 ❯ src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts (10 tests | 1 failed) 47ms
   ❯ T-050 Phần B: Ca kiểm thử W1-W9 (10)
     × W2b: Tái hiện B1: Trang bác sĩ thật với X1 (doctorId: 'd-doctor-d') và X-other (doctorId: 'd-other') -> X1 được liệt kê, X-other không 7ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts > T-050 Phần B: Ca kiểm thử W1-W9 > W2b: Tái hiện B1: Trang bác sĩ thật với X1 (doctorId: 'd-doctor-d') và X-other (doctorId: 'd-other') -> X1 được liệt kê, X-other không
AssertionError: expected '<dialog data-side="center" aria-label…' to contain 'value="exam-x1"'

Expected: "value=\"exam-x1\""
Received: "<dialog data-side=\"center\" ...><p class=\"font-medium text-fg\">Chưa có phiếu khám tập luyện đủ điều kiện để kết thúc sớm.</p>...</dialog>"

 ❯ src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts:314:28
    312|         );
    313|
    314|         expect(dialogHtml).toContain('value="exam-x1"');
       |                            ^
    315|         expect(dialogHtml).not.toContain('value="exam-other"');

 Test Files  1 failed (1)
      Tests  1 failed | 9 passed (10)
```

#### 2. W2b sau khi sửa `doctorId={user.profileId ?? undefined}`

```
 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend

 Test Files  1 passed (1)
      Tests  10 passed (10)
   Start at  16:38:18
   Duration  1.01s (transform 60%, import 35%, tests 5%)
```

---

### Tự review Ponytail (Lượt sửa 1)

- L177-188 (`src/lib/domain/suspension-rules.ts`): delete `EarlyEndExaminationInput`. Thay bằng `Pick<MedicalExamination, ...>` trực tiếp từ domain model.
- L207-209, L237-239 (`src/lib/domain/suspension-rules.ts`): delete `supersededIds` logic và các trường `decision`, `examinedAt`, `supersedesId`. Frontend không đoán mò trạng thái thay thế, để backend trả 409 `SUPERSEDED`.
- L334, L336 (`src/lib/i18n/messages/coach-bouts.vi.ts`): delete 2 khóa i18n không sử dụng `issuerReferenceLength` và `liftReferenceRequired`.
- L335, L337 (`src/lib/i18n/messages/coach-bouts.en.ts`): delete 2 khóa i18n không sử dụng tương ứng.
- L245-246 (`src/lib/actions/suspensions.ts`): shrink `examinationId: examinationId || undefined` -> `examinationId`.
- L278-288 (`src/app/(app)/doctor/fighters/[fighterId]/page.tsx`): shrink/delete IIFE đoán ngày `startsOn` khi thiếu phiếu khám, thay bằng 1 thẻ `<Link>` trực tiếp.
- **Kết luận**: Net lines removable: 46 lines removed. Lean and strictly typed. Ship.

---

### Tự review Impeccable (Lượt sửa 1)

1. *Hộp thoại kết thúc sớm (`suspension-early-end-dialog.tsx`)*:
   - Thông báo lỗi server: Sử dụng thẻ `<div role="alert">` với bộ token cảnh báo lỗi chuẩn `bg-danger-soft`, `text-danger-fg`, `ring-danger-border`, hiển thị rõ ràng ngay đầu form khi có lỗi từ action (vd: `EXPIRED`, `SUPERSEDED`, `MEDICAL_SUPERVISION_DISABLED`).
   - Tự động xóa lỗi: Khi người dùng tương tác lại với các ô nhập liệu (`note`, `liftReference`, `examinationId`), cả lỗi client và server đều được xóa sạch tức thì.
   - Trạng thái chưa chọn phiếu: Thông báo rõ ràng "Chọn một phiếu khám" (`examRequired`) thay vì nhầm lẫn với lỗi không tìm thấy phiếu (`examNotFound`).
   - Deep-link lâm sàng: Tái sử dụng `clinicalLinks.newExaminationFor(fighterId)` đồng bộ với toàn hệ thống y tế.
2. *Khối Đình chỉ trang bác sĩ (`doctor/fighters/[fighterId]/page.tsx`)*:
   - Khả năng chịu lỗi (Resilience): Bọc qua `nullIfServiceFails`. Khi microservice/bảng đình chỉ lỗi, hiển thị dòng text muted "Không tải được danh sách đình chỉ", không làm sập toàn bộ hồ sơ y tế của võ sĩ.
   - Nhãn căn cứ chính xác: Sử dụng "Kết thúc sớm ngày {clearedAt} theo phiếu khám" với đường dẫn trực tiếp tới phiếu khám, không đoán mò ngày `startsOn`.
   - Quyền hạn bác sĩ: Truyền đúng `user.profileId` giúp liên kết chính xác với hồ sơ `sports_doctors` của bác sĩ đang đăng nhập.

---

### Kết quả chạy kiểm tra cuối cùng

Lệnh:
```bash
pnpm --filter nextjs-frontend lint ; pnpm --filter nextjs-frontend typecheck ; pnpm --filter nextjs-frontend test
```

Phần cuối output:
```
$ eslint
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
$ vitest run

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  117 passed | 1 skipped (118)
      Tests  1148 passed | 2 skipped (1150)
   Start at  16:48:38
   Duration  3.99s (import 45%, transform 34%, tests 20%, worker 1%)

     Import  423 modules were evaluated 3032 times · 24.14s total, 45% of tracked time
             ~346ms faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation
```

---

## Phần B · Lượt sửa 2 (03/11/2026)

### 1. Thay đổi theo yêu cầu

| Mục | Mô tả thay đổi |
| --- | --- |
| **W10 & Dialog** | Xoá prop `initialError` khỏi `SuspensionEarlyEndDialog` và `SuspensionEarlyEndDialogProps`. Tách hàm `handleEarlyEndActionResult` và subcomponent `SuspensionEarlyEndAlert` trong production. Viết lại W10 đi qua luồng thật: mock `endSuspensionEarlyAction` trả `{ status: 'error', message: 'Phiếu khám đã hết hạn hiệu lực.' }`, kích hoạt qua submit action và hàm xử lý kết quả production, kiểm tra `setServerError` được kích hoạt và component hiển thị `role="alert"` chứa câu đã dịch của EXPIRED. |
| **W2c & Rules** | `src/lib/domain/suspension-rules.ts` (`filterEarlyEndExaminations`): Chuyển từ so sánh chuỗi `exam.validUntil <= nowIso` sang so sánh thời điểm `new Date(exam.validUntil) <= now` với `now = options.now ? new Date(options.now) : new Date()`. Bổ sung ca kiểm thử **W2c**. |

---

### 2. Chứng minh W10 lỗi khi tạm xoá `setServerError` và vượt qua khi khôi phục

#### Khi tạm comment `callbacks.setServerError(errMsg)` trong nhánh lỗi:

```
$ vitest run "src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts" "-t" "W10"

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend

 ❯ src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts (13 tests | 1 failed | 12 skipped) 6ms
   ❯ T-050 Phần B: Ca kiểm thử W1-W9 (13)
     × W10: Hộp thoại nhận lỗi server cause EXPIRED -> có phần tử role='alert' chứa câu đã dịch của EXPIRED trong hộp thoại 5ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts > T-050 Phần B: Ca kiểm thử W1-W9 > W10: Hộp thoại nhận lỗi server cause EXPIRED -> có phần tử role='alert' chứa câu đã dịch của EXPIRED trong hộp thoại
AssertionError: expected null to be 'Phiếu khám đã hết hạn hiệu lực.' // Object.is equality

- Expected:
"Phiếu khám đã hết hạn hiệu lực."

+ Received:
null

 ❯ src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts:698:35
    696|
    697|         // Khẳng định setServerError được gọi với câu đã dịch của EXPI…
    698|         expect(dialogServerError).toBe(expiredMsg);
       |                                   ^
    699|
    700|         // 3. Khẳng định hộp thoại ban đầu chưa có lỗi role='alert'

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 12 skipped (13)
   Start at  17:04:34
   Duration  978ms (transform 63%, import 37%, tests 1%)
```

#### Sau khi khôi phục `callbacks.setServerError(errMsg)`:

```
$ vitest run "src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts" "-t" "W10"

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  1 passed (1)
      Tests  1 passed | 12 skipped (13)
   Start at  17:04:50
   Duration  982ms (transform 63%, import 36%, tests 1%)
```

---

### 3. Chứng minh W2c lỗi trên code cũ (so chuỗi) và vượt qua trên code mới (so thời điểm)

#### W2c trên code cũ (`exam.validUntil <= nowIso` so chuỗi):

```
$ vitest run "src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts"

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend

 ❯ src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts (13 tests | 1 failed) 56ms
   ❯ T-050 Phần B: Ca kiểm thử W1-W9 (13)
     × W2c: Phiếu X1 validUntil '2026-11-05T10:00:00+07:00' (= 03:00Z), now 2026-11-05T04:00:00Z -> X1 KHÔNG được liệt kê (đã hết hạn); validUntil '2026-11-05T12:00:00+07:00', cùng now -> X1 được liệt kê 4ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts > T-050 Phần B: Ca kiểm thử W1-W9 > W2c: Phiếu X1 validUntil '2026-11-05T10:00:00+07:00' (= 03:00Z), now 2026-11-05T04:00:00Z -> X1 KHÔNG được liệt kê (đã hết hạn); validUntil '2026-11-05T12:00:00+07:00', cùng now -> X1 được liệt kê
AssertionError: expected [ { id: 'exam-x1', …(12) } ] to have a length of +0 but got 1

- Expected
+ Received

- 0
+ 1 

 ❯ src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts:370:33
    368|             now,
    369|         });
    370|         expect(filteredExpired).toHaveLength(0);
       |                                 ^
    371|
    372|         // 2. validUntil 12:00+07:00 (= 05:00Z) > 04:00Z -> Chưa hết h…

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 12 passed (13)
   Start at  17:02:13
   Duration  1.01s (transform 59%, import 35%, tests 6%)
```

#### W2c sau khi sửa sang `new Date(exam.validUntil) <= now`:

```
$ vitest run "src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts" "-t" "W2c"

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  1 passed (1)
      Tests  1 passed | 12 skipped (13)
   Start at  17:02:39
   Duration  956ms (transform 63%, import 37%)
```

---

### 4. Kết quả chạy kiểm tra cuối cùng (Lượt sửa 2)

Lệnh:
```bash
pnpm --filter nextjs-frontend lint ; pnpm --filter nextjs-frontend typecheck ; pnpm --filter nextjs-frontend test
```

Phần cuối output:
```
$ eslint
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
$ vitest run

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  117 passed | 1 skipped (118)
      Tests  1149 passed | 2 skipped (1151)
   Start at  17:05:50
   Duration  4.12s (import 46%, transform 34%, tests 20%, worker 1%)

     Import  423 modules were evaluated 2945 times · 23.99s total, 46% of tracked time
             ~346ms faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation
```

