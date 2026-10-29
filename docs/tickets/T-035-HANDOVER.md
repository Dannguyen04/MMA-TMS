# T-035 Handover

- Nhánh: fix/T-035-suspension-gate    Commit: e811562 (Phần B) và chưa commit (Phần A)
- Trạng thái: IN REVIEW

## Thay đổi

### Phần B (commit `e811562`):
- `nestjs-api/src/coaching/coaching.module.ts`: Import `SuspensionsModule` từ `../suspensions/suspensions.module.js` để cung cấp `SuspensionGate` cho `CoachingService`. `SuspensionsModule` chỉ phụ thuộc `DatabaseModule` nên không tạo vòng phụ thuộc.
- `nestjs-api/src/coaching/coaching.service.ts`: Inject `SuspensionGate` vào `CoachingService`. Trong `createAssignment`, đưa tính toán `scheduledAt` và `sessionType` lên trước khi tạo plan; gọi `suspensionGate.blockingSuspensions(dto.fighterId, sessionType, scheduledAt, tx)` trong cùng transaction `tx`. Nếu có đình chỉ chặn thì ném lỗi 409 qua hàm có sẵn `trainingSuspensionActive(suspensions)` từ `../training/training.error.js`, ngăn việc insert vào `training_plans` và `training_sessions`.
- `nestjs-api/src/coaching/coaching.service.spec.ts`: Bổ sung mock `SuspensionGate` trả về mảng rỗng `[]` mặc định cho các test hiện có; thêm 3 ca kiểm thử mới:
  1. Võ sĩ có đình chỉ hiệu lực chặn đúng `sessionType`: ném `ConflictException` với code `TRAINING_SUSPENSION_ACTIVE`, chi tiết suspensions khớp, và `mockTx.insert` không được gọi.
  2. Võ sĩ có `sessionType` không bị chặn: gọi gate và tạo assignment thành công.
  3. Võ sĩ có `scheduledAt` sau ngày kết thúc đình chỉ: gọi gate với ngày đó (gate trả `[]`) và tạo assignment thành công.

### Phần A (chưa commit):
- `nestjs-api/src/suspensions/suspensions.model.ts`: Sửa `DEFAULT_MANUAL_BLOCKED_SESSION_TYPES` ở dòng 45 lấy từ `SESSION_TYPES` lọc bỏ `'RECOVERY'` và `'PHYSICAL_THERAPY'` bằng `.filter()`, không chép tay, giữ kiểu `readonly SessionType[]`. Kết quả gồm đúng 6 loại: `SHADOW_BOXING`, `PAD_WORK`, `HEAVY_BAG`, `SPARRING`, `GRAPPLING`, `STRENGTH_CONDITIONING`. Giữ nguyên cách dùng hằng ở `suspensions.service.ts:99-101` và `suspensions.model.ts:643-698`.
- `nestjs-api/src/suspensions/suspensions.service.spec.ts`:
  1. Cập nhật test tạo đình chỉ thủ công khi không gửi `blockedSessionTypes` -> lưu đủ 6 loại session types mặc định nêu trên.
  2. Bổ sung test gửi `blockedSessionTypes: ['SPARRING']` -> chỉ lưu đúng `['SPARRING']`.
- `nestjs-api/src/training/sessions/training-session.service.spec.ts`:
  - Bổ sung unit test kiểm tra Gate 2 với đình chỉ chặn 6 loại mặc định: `createSession` với `PAD_WORK` trong khoảng đình chỉ bị ném 409 `TRAINING_SUSPENSION_ACTIVE`; với `RECOVERY` và `PHYSICAL_THERAPY` tạo thành công.

## Đối chiếu tiêu chí nghiệm thu
| Tiêu chí (theo ticket) | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| 1. Tạo đình chỉ thủ công không gửi `blockedSessionTypes` thì đình chỉ lưu đủ 6 loại: `SHADOW_BOXING`, `PAD_WORK`, `HEAVY_BAG`, `SPARRING`, `GRAPPLING`, `STRENGTH_CONDITIONING`. Có unit test ở `suspensions.service.spec.ts`. | `nestjs-api/src/suspensions/suspensions.model.ts:45-48`; test `creates a manual suspension with defaults (startsOn = today, default 6 blockedSessionTypes, boutId = null) and sets audit context` tại `nestjs-api/src/suspensions/suspensions.service.spec.ts:251-293`. |
| 2. Với đình chỉ ở tiêu chí 1, xếp `PAD_WORK` trong khoảng đình chỉ thì bị 409 `TRAINING_SUSPENSION_ACTIVE`, còn xếp `RECOVERY` và `PHYSICAL_THERAPY` thì được. Có unit test ở `training-session.service.spec.ts`. | `nestjs-api/src/training/sessions/training-session.service.spec.ts:878-950` (test `rejects scheduling PAD_WORK when suspension blocks 6 default manual session types with 409 TRAINING_SUSPENSION_ACTIVE, while RECOVERY and PHYSICAL_THERAPY pass`). |
| 3. Gửi `blockedSessionTypes: ["SPARRING"]` thì chỉ chặn `SPARRING`, như trước. | `nestjs-api/src/suspensions/suspensions.service.spec.ts:295-318` (test `creates a manual suspension with explicit blockedSessionTypes = [SPARRING] and stores only SPARRING`). |
| 4. Gợi ý đình chỉ từ kết quả trận **có** ruleset vẫn dùng loại buổi của ruleset. Các test hiện có của `suggestSuspensions` không phải sửa kỳ vọng, trừ ca không có ruleset; ca nào sửa thì ghi vào handover. | `nestjs-api/src/suspensions/suspensions.model.ts:643-645, 656-658, 695-698`; các test hiện có của `suggestSuspensions` có ruleset giữ nguyên kỳ vọng (`aibaRuleset` giữ `['SPARRING']`, `vmmafRuleset` giữ `['SPARRING', 'GRAPPLING']`). Không có test cũ nào của `suggestSuspensions` cần sửa kỳ vọng vì các ca không có ruleset trước đó dùng `expect.objectContaining` không assert trường `blockedSessionTypes`. |
| 5. `POST /coaching/assignments` cho võ sĩ đang đình chỉ, loại buổi bị chặn: 409 `TRAINING_SUSPENSION_ACTIVE`, không tạo thêm dòng `training_plans` hay `training_sessions`. Loại không bị chặn thì tạo như cũ. Có unit test ở `coaching.service.spec.ts`. | Đáp ứng ở Phần B (commit `e811562`): `nestjs-api/src/coaching/coaching.service.ts:205-217`; test `throws ConflictException with code TRAINING_SUSPENSION_ACTIVE and does not insert plan/session when active suspension blocks sessionType` và test `creates assignment successfully when sessionType is not blocked by suspension` tại `nestjs-api/src/coaching/coaching.service.spec.ts:130-204`. |
| 5b. Cùng võ sĩ và loại buổi bị chặn, nhưng `scheduledAt` sau ngày kết thúc đình chỉ thì `POST /coaching/assignments` tạo được như cũ. Có unit test ở `coaching.service.spec.ts` (lấy từ T-036A phần 1, gộp 28/10). | Đáp ứng ở Phần B (commit `e811562`): `nestjs-api/src/coaching/coaching.service.ts:205-217`; test `creates assignment successfully when scheduledAt is after suspension ends` tại `nestjs-api/src/coaching/coaching.service.spec.ts:206-234`. |
| 6. Phần C có kết quả ghi trong handover. Nếu là lỗi thật thì có test tái hiện, test đó lỗi trước khi sửa và qua sau khi sửa. | Chưa làm, cần dev có .env (phần C được phân công để dev có .env thực hiện ở API mode theo TEAM-WORKFLOW §3a). |
| 7. Không lệnh nào thêm lỗi so với BASELINE.md. | `lint`: 0 error; `build`: exit code 0; `test`: 1028 passed / 26 failed trên 1054 tests (tăng 2 test passed, đúng 26 lỗi có sẵn theo BASELINE.md B1, không thêm lỗi mới). |

## Lệnh đã chạy

### 1. `pnpm --filter nestjs-api lint`
```text
$ oxlint src/ test/
src/coaching/coaching.service.ts:182:16: warning eslint(no-unused-vars): Catch parameter 'err' is caught but never used. help: Consider handling this error.
src/coaching/coaching.service.ts:520:27: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/coaching/coaching.service.ts:550:27: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/coaching/coaching.service.ts:550:54: warning unicorn(no-useless-fallback-in-spread): Empty fallbacks in spreads are unnecessary help: Spreading falsy values in object literals won't add any unexpected properties, so it's unnecessary to add an empty object as fallback.
src/main.ts:7:10: warning eslint(no-unused-vars): Identifier 'createOpenApiDocument' is imported but never used. help: Consider removing this import.
src/dataset-export/services/governance-verifier.service.ts:45:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/dataset-export/services/governance-verifier.service.ts:46:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/notifications/notifications.config.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/dataset-export/services/authoritative-governance.service.ts:6:3: warning eslint(no-unused-vars): Identifier 'ConflictException' is imported but never used. help: Consider removing this import.
src/dataset-export/services/authoritative-governance.service.ts:10:81: warning eslint(no-unused-vars): Identifier 'coaches' is imported but never used. help: Consider removing this import.
src/dataset-export/services/authoritative-governance.service.ts:11:14: warning eslint(no-unused-vars): Identifier 'and' is imported but never used. help: Consider removing this import.
src/dataset-export/services/authoritative-governance.service.ts:86:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/dataset-export/services/authoritative-governance.service.ts:87:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/notifications/notification-stream.service.ts:91:33: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:318:24: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:319:33: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
src/notifications/notification-stream.service.ts:333:31: warning unicorn(no-useless-spread): Using a spread operator here creates a new array unnecessarily. help: `for…of` can iterate over iterable, it's unnecessary to convert to an array.
```
*(Kết quả: Thoát mã 0, không có lỗi linter)*

### 2. `pnpm --filter nestjs-api build`
```text
$ nest build
```
*(Kết quả: Thoát mã 0, build thành công)*

### 3. `pnpm --filter nestjs-api test`
```text
 FAIL  test/dataset-export-trust-boundary.spec.ts > Task 14 — Product Backend Security & Governance Remediation Gate > 3. Candidate Conflict & Superseding Lifecycle > 3.2 supersedes previous active attestations when issuing a new promotion
 FAIL  test/dataset-export-trust-boundary.spec.ts > Task 14 — Product Backend Security & Governance Remediation Gate > 4. Idempotency & Nonce Replay > 4.1 requires mandatory Idempotency-Key header for mutations
 FAIL  test/dataset-export-trust-boundary.spec.ts > Task 14 — Product Backend Security & Governance Remediation Gate > 4. Idempotency & Nonce Replay > 4.2 returns exact stored response for duplicate Idempotency-Key and payload
 FAIL  test/dataset-export-trust-boundary.spec.ts > Task 14 — Product Backend Security & Governance Remediation Gate > 4. Idempotency & Nonce Replay > 4.3 rejects duplicate nonces with 409 Conflict
 FAIL  test/dataset-export-trust-boundary.spec.ts > Task 14 — Product Backend Security & Governance Remediation Gate > 5. Cryptographic Verification & Malformed Input Safety > 5.1 returns false safely on malformed signature verification without throwing
 FAIL  test/dataset-export-trust-boundary.spec.ts > Task 14 — Product Backend Security & Governance Remediation Gate > 5. Cryptographic Verification & Malformed Input Safety > 5.2 verifies cross-language RFC 8785 canonical JSON fixture byte parity
 FAIL  test/dataset-export-trust-boundary.spec.ts > Task 14 — Product Backend Security & Governance Remediation Gate > 5. Cryptographic Verification & Malformed Input Safety > 5.3 does not expose sensitive secret values in API responses or logs
Error: Hook timed out in 30000ms.
If this is a long-running hook, pass a timeout value as the last argument or configure it globally with "hookTimeout".
 ❯ test/dataset-export-trust-boundary.spec.ts:172:3
    170|   }, 30000);
    171|
    172|   afterEach(async () => {
       |   ^
    173|     if (app) {
    174|       await app.close();

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[7/31]⎯


 Test Files  6 failed | 59 passed (65)
      Tests  26 failed | 1028 passed (1054)
   Start at  11:23:59
   Duration  694.26s (transform 4.23s, setup 0ms, import 73.05s, tests 768.72s, environment 6ms)

[ELIFECYCLE] Test failed. See above for more details.
Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL

  × "pnpm recursive run" failed in D:\MMA-TMS\nestjs-api
```
*(Số test trước Phần A: 1026 passed / 26 failed trên 1052 tests. Số test sau Phần A: 1028 passed / 26 failed trên 1054 tests. Đúng 26 lỗi có sẵn theo BASELINE.md B1, tăng 2 test pass, 0 lỗi mới).*

## Lệch so với ticket
Không có.

## Câu hỏi / việc còn mở
- **Cổng y tế ở `createAssignment`**: Endpoint `POST /coaching/assignments` hiện tại mới kết nối Cổng 2 (`SuspensionGate`) theo Phần B; cổng y tế (Cổng 1) cho endpoint này nằm ngoài phạm vi ticket T-035 (theo mục "Ngoài phạm vi" §51) và được mở lại để xem xét trong tương lai nếu cần.
- **Phần C (Tái hiện "sparring vẫn xếp được")**: Chưa làm, cần dev có file `.env` chạy backend ở API mode để thực hiện kiểm thử trên môi trường chạy thực tế theo hướng dẫn mục C của ticket.
