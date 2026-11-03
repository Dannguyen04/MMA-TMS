# T-049 Handover: chỉ xác nhận được tập lại khi đình chỉ đang chờ xác nhận

- Nhánh: `User_Feature` (không commit, không push, không tạo nhánh)
- Ngày: 31/10/2026
- Kết quả: hiện thực xong phạm vi 1–5. Hai test cũ mâu thuẫn với ticket đã được lead quyết (31/10), xem mục "Quyết định của lead (31/10)"; mọi lệnh kiểm tra qua.

## File đã sửa

| File | Thay đổi |
| --- | --- |
| `nestjs-api/src/suspensions/suspensions.error.ts` | Thêm `suspensionNotAwaitingClearance(status)`: 409, `code: 'SUSPENSION_NOT_AWAITING_CLEARANCE'`, `message`, `details: { status }` (theo mẫu `suspensionAlreadyCleared`). |
| `nestjs-api/src/suspensions/suspensions.service.ts` | Trong giao dịch của `clearSuspension`, sau khoá dòng và kiểm `clearedAt`: tính `suspensionStatusOn(locked, academyDateOf(new Date()))`, khác `AWAITING_CLEARANCE` thì ném lỗi mới. Thứ tự: 422, 403 (vai trò), 404, 403 (phân công), 404 (khoá), `SUSPENSION_ALREADY_CLEARED`, lỗi mới. |
| `nestjs-api/src/suspensions/suspensions.controller.ts` | `@ApiConflictEnvelope` của `POST /suspensions/:id/clear` ghi thêm mã mới trong description (theo cách các controller khác ghi nhiều mã 409 trong một envelope, ví dụ `medical-assignment.controller.ts:122`). Sửa `summary`/`description` của endpoint: bỏ câu "Allowed at any time before or after `endsOn`" (đã sai). |
| `nestjs-api/src/suspensions/suspensions.service.spec.ts` | Thêm `describe('clearSuspension only while AWAITING_CLEARANCE (T-049)')` với C1–C7. Theo quyết định của lead: xoá test xác nhận sớm, chuyển kiểm audit context vào C3, bỏ nửa `MANDATORY_REST` của test `allows clearing when in AWAITING_CLEARANCE`. |
| `nextjs-frontend/src/lib/services/suspensions.demo.ts` | `clearSuspension` demo ném `ApiError` 409 `SUSPENSION_NOT_AWAITING_CLEARANCE`, `details: { status }`, sau kiểm `clearedAt` (cùng thứ tự backend). |
| `nextjs-frontend/src/lib/actions/suspensions.ts` | `mapSuspensionActionError` map mã mới sang `suspensions.action.notAwaitingClearance`. |
| `nextjs-frontend/src/lib/i18n/messages/coach-bouts.vi.ts`, `coach-bouts.en.ts` | Khoá `suspensions.action.notAwaitingClearance`. vi: "Chỉ xác nhận được khi đình chỉ đã hết hạn và đang chờ xác nhận." en: "A suspension can only be cleared after it has ended and is awaiting clearance." |
| `nextjs-frontend/src/lib/services/suspensions.test.ts` | Thêm C9, C10; đổi dữ liệu đầu vào của B2-27 (xem dưới). |
| `nestjs-api/docs/modules/01-suspensions-core.md` | Ghi mã lỗi mới ở đoạn "Xác nhận cho tập lại" và ở tiêu chí nghiệm thu. |
| `docs/FIGHT-CAMP-BUSINESS-FLOWS.md` | Dòng "Kết thúc đình chỉ cần xác nhận" thêm "API từ chối 409 (`SUSPENSION_NOT_AWAITING_CLEARANCE`) nếu chưa tới `endsOn + 1` (T-049)." |

Không migration, không đổi bảng, không sửa `reactnative-mobile`.

## Ca kiểm thử → test

"Hôm nay" cố định bằng `vi.setSystemTime(new Date('<ngày>T03:00:00.000Z'))` (10:00 giờ Việt Nam), cùng cách `beforeEach` của spec đang làm. Không mock `suspensionStatusOn`. Repo mock theo khuôn có sẵn của spec (`findSuspensionById`, `lockSuspensionById` trả dòng của ca).

| Ca | File | Tên test |
| --- | --- | --- |
| C1 | `nestjs-api/src/suspensions/suspensions.service.spec.ts` | `C1: KO day 2 of 30 (today 2026-11-02) -> 409 SUSPENSION_NOT_AWAITING_CLEARANCE, status ACTIVE, clearedAt stays null` (kiểm thêm `repo.clearSuspension` không được gọi) |
| C2 | như trên | `C2: KO on its endsOn (today 2026-11-30) -> 409, status ACTIVE` |
| C3 | như trên | `C3: KO on endsOn + 1 (today 2026-12-01) -> 200, clearedAt set, status ENDED, gradedReturn.ceiling 3` |
| C4 | như trên | `C4: MEDICAL starting 2026-11-05 for 3 days (today 2026-11-02) -> 409, status UPCOMING` |
| C5 | như trên | `C5: MANDATORY_REST 2026-11-01 for 7 days (today 2026-11-03) -> 409, status ACTIVE` |
| C6 | như trên | `C6: MANDATORY_REST already over (today 2026-11-10) -> 409, status ENDED` |
| C7 | như trên | `C7: already cleared KO -> 409 SUSPENSION_ALREADY_CLEARED (not the new code)` |
| C8 | — | **Bỏ.** `pnpm --filter nestjs-api test:db` (`scripts/test-migrations.mjs`) chỉ chạy SQL qua `psql` trên PostgreSQL tạm để kiểm migration; không có ca nào khởi tạo `SuspensionsService`/`SuspensionsRepository` thật. Thêm C8 cần dựng Drizzle + Nest service chạy trên PostgreSQL tạm, không phải mở rộng rẻ. |
| C9 | `nextjs-frontend/src/lib/services/suspensions.test.ts` | `C9 (T-049): demo clearSuspension đình chỉ KO đang chạy của Marcus Hale → ApiError 409 SUSPENSION_NOT_AWAITING_CLEARANCE; Diego Alvarez (chờ xác nhận) vẫn xác nhận được` |
| C10 | như trên | `C10 (T-049): clearSuspensionAction nhận ApiError 409 SUSPENSION_NOT_AWAITING_CLEARANCE → câu vi riêng; tiếng Anh có câu tương ứng` |

## Output C1–C6 trước và sau khi sửa

Lệnh: `pnpm --filter nestjs-api exec vitest run src/suspensions/suspensions.service.spec.ts -t "T-049" --reporter=verbose` (tiền tố `src/suspensions/suspensions.service.spec.ts > SuspensionsService > clearSuspension only while AWAITING_CLEARANCE (T-049) >` đã lược).

Trước khi sửa (code cũ, chỉ có test):

```
 × C1: KO day 2 of 30 (today 2026-11-02) -> 409 SUSPENSION_NOT_AWAITING_CLEARANCE, status ACTIVE, clearedAt stays null 9ms
 × C2: KO on its endsOn (today 2026-11-30) -> 409, status ACTIVE 1ms
 ✓ C3: KO on endsOn + 1 (today 2026-12-01) -> 200, clearedAt set, status ENDED, gradedReturn.ceiling 3 1ms
 × C4: MEDICAL starting 2026-11-05 for 3 days (today 2026-11-02) -> 409, status UPCOMING 1ms
 × C5: MANDATORY_REST 2026-11-01 for 7 days (today 2026-11-03) -> 409, status ACTIVE 1ms
 × C6: MANDATORY_REST already over (today 2026-11-10) -> 409, status ENDED 1ms
 ✓ C7: already cleared KO -> 409 SUSPENSION_ALREADY_CLEARED (not the new code) 2ms
AssertionError: expected { …(20) } to be an instance of HttpException   (C1, C2, C4, C5, C6: code cũ trả 200)
      Tests  5 failed | 2 passed | 14 skipped (21)
```

C3 qua cả trên code cũ: ca này mong đợi 200, đúng là việc code cũ làm, nên không thể "lỗi trên code cũ" như dòng đầu mục "Ca kiểm thử" của ticket ghi; C3 là ca đối chứng (lead xác nhận 31/10).

Sau khi sửa:

```
 ✓ C1: KO day 2 of 30 (today 2026-11-02) -> 409 SUSPENSION_NOT_AWAITING_CLEARANCE, status ACTIVE, clearedAt stays null 7ms
 ✓ C2: KO on its endsOn (today 2026-11-30) -> 409, status ACTIVE 1ms
 ✓ C3: KO on endsOn + 1 (today 2026-12-01) -> 200, clearedAt set, status ENDED, gradedReturn.ceiling 3 1ms
 ✓ C4: MEDICAL starting 2026-11-05 for 3 days (today 2026-11-02) -> 409, status UPCOMING 1ms
 ✓ C5: MANDATORY_REST 2026-11-01 for 7 days (today 2026-11-03) -> 409, status ACTIVE 1ms
 ✓ C6: MANDATORY_REST already over (today 2026-11-10) -> 409, status ENDED 1ms
 ✓ C7: already cleared KO -> 409 SUSPENSION_ALREADY_CLEARED (not the new code) 1ms
      Tests  7 passed | 14 skipped (21)
```

C9, C10 trước khi sửa frontend cũng lỗi: C9 `promise resolved "{ id: 'susp-active-ko', …(19) }" instead of rejecting`; C10 `expected 'Thao tác không thành công.' to be 'Chỉ xác nhận được khi đình chỉ đã hết…'`. Sau sửa: qua.

## Test cũ đã đổi dữ liệu đầu vào

- `nextjs-frontend/src/lib/services/suspensions.test.ts`, test `B2-27: demo applyConflicts ... đối chứng đình chỉ thuộc A → thành công (cả clear và applyConflicts)`: đình chỉ A (`susp-b2-27-a`, `OTHER`) đổi `startsOn` `today` → `today - 6`, `endsOn` `today + 5` → `today - 1`, `requiresClearance` `false` → `true`, trường `status` lưu sẵn `ACTIVE` → `AWAITING_CLEARANCE` (demo tự tính lại, trường này chỉ để dữ liệu nhất quán). Tên test và kết quả mong đợi (A thành công, B bị từ chối) giữ nguyên. Ghi chú: phải đổi cả `requiresClearance` vì `OTHER` không cần xác nhận thì không bao giờ `AWAITING_CLEARANCE`; đổi ngày thôi không đủ.

## Lệnh kiểm tra (chạy từ `D:\MMA-TMS`, mỗi lệnh một lần)

| Lệnh | Kết quả |
| --- | --- |
| `pnpm --filter nestjs-api lint` | exit 0; chỉ cảnh báo có sẵn ở module khác, không cảnh báo nào ở `src/suspensions`. |
| `pnpm --filter nestjs-api build` | exit 0 (`nest build`). |
| `pnpm --filter nestjs-api exec vitest run src/suspensions src/bouts` | `Test Files 16 passed (16)`, `Tests 470 passed (470)` (471 trước đây trừ test xác nhận sớm đã xoá). |
| `pnpm --filter nestjs-api test:db` | exit 0; `Migration checks passed: 49. PostgreSQL stopped after tests.` |
| `pnpm --filter nextjs-frontend lint` | exit 0 (`eslint`). |
| `pnpm --filter nextjs-frontend typecheck` | exit 0 (`next typegen && tsc --noEmit`). |
| `pnpm --filter nextjs-frontend test` | `Test Files 99 passed \| 1 skipped (100)`, `Tests 954 passed \| 2 skipped (956)` (mốc 952 + C9, C10). |

## Quyết định của lead (31/10)

1. **Xoá test `allows early clear before ends_on without changing ends_on, and sets audit context`.** Chủ dự án đã xác định xác nhận sớm (trước `endsOn + 1`) là lỗi, nên test này kiểm đúng hành vi T-049 cấm. Đây là test duy nhất kiểm audit context khi xác nhận; phần kiểm đó chuyển vào C3. Test cũ chỉ kiểm `txExecute` có được gọi; C3 kiểm chặt hơn: `tx.execute` gọi đúng 1 lần, tham số SQL là `JSON.stringify({ sub: coachActor.authSubject })` và `REQUEST_ID`, và chạy trong giao dịch trước `lockSuspensionById`. Tên C3 và các kết quả mong đợi khác giữ nguyên. Đã kiểm: tạm comment dòng `await setAuditContext(...)` trong `clearSuspension` thì C3 lỗi (`expected "vi.fn()" to be called 1 times, but got 0 times`), khôi phục thì qua; `git diff` của `suspensions.service.ts` giống hệt trước và sau.
2. **Test `allows clearing when in AWAITING_CLEARANCE and when requires_clearance = false`** bỏ nửa sau (`MANDATORY_REST`, `requiresClearance: false`, mong đợi 200), vì C5, C6 đã phủ (luôn 409), và bỏ đuôi tên; tên mới `allows clearing when in AWAITING_CLEARANCE`.
3. **C3 là ca đối chứng**, không phải ca tái hiện lỗi. Các ca tái hiện là C1, C2, C4, C5, C6 (đều lỗi trên code cũ, xem output trên).

## Câu hỏi

1. ~~`allows early clear before ends_on ...`~~: **Đã giải quyết**, lead quyết xoá test, kiểm audit context chuyển vào C3 (quyết định 1).
2. ~~`allows clearing when in AWAITING_CLEARANCE and when requires_clearance = false`~~: **Đã giải quyết**, bỏ nửa `MANDATORY_REST` và đuôi tên (quyết định 2).

Không còn câu hỏi mở.

Ghi chú khác: `npx prettier --check src/suspensions/*.ts` báo mọi file trong thư mục (kể cả file không sửa) vì file dùng CRLF; không thuộc lệnh bắt buộc, không định dạng lại.
