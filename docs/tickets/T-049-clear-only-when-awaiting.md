# T-049: chỉ xác nhận được tập lại khi đình chỉ đang chờ xác nhận

- Trạng thái: **IN PROGRESS** (Ken 31/10: sửa xong, review độc lập rồi mới merge vào `fight-camp`)
- Phạm vi: backend `nestjs-api` + frontend `nextjs-frontend` (câu báo lỗi, demo mode)
- Người làm: Ken (Claude lead, `agy` code)
- Phụ thuộc: T-007, T-030 B (đã merge `fight-camp` 31/10)

## Ghi chú 31/10 (trạng thái hiện tại)

- Code viết theo ticket này từng được cất tạm (chưa commit): `git stash` trên máy Ken (`stash@{0}`, "T-049 WIP (chờ review tới, không merge)") và bản patch `D:/test/ai-worktrees/logs/T-049-wip.patch`, handover nháp `D:/test/ai-worktrees/logs/T-049-HANDOVER-wip.md`. Chỉ có trên máy Ken.
- Kết quả lần chạy thử: C1, C2, C4, C5, C6 lỗi trên code cũ và qua sau khi sửa; C3 là ca đối chứng (qua cả trước và sau, ticket ghi nhầm là phải lỗi); C8 bỏ vì `test:db` chỉ kiểm migration bằng SQL, không có ca chạy service thật; C9, C10 qua. Frontend 954 passed | 2 skipped.
- Hai test cũ trong `suspensions.service.spec.ts` khẳng định đúng hành vi bị coi là lỗi, cần đổi khi làm thật (lead quyết, ghi lại để review):
  - `allows early clear before ends_on without changing ends_on, and sets audit context`: xoá; chuyển kiểm audit context sang C3 nếu đây là test duy nhất kiểm nó.
  - `allows clearing when in AWAITING_CLEARANCE and when requires_clearance = false`: bỏ nửa `MANDATORY_REST` và bỏ "and when requires_clearance = false" khỏi tên.
- Liên quan [T-050](./T-050-early-end-by-doctor-exam.md): kết thúc sớm do bác sĩ khám đi đường riêng, không qua `POST /suspensions/:id/clear`, nên T-049 vẫn đúng khi có T-050.

## Bối cảnh

Nghiệp vụ đã chốt ([FIGHT-CAMP-BUSINESS-FLOWS.md](../FIGHT-CAMP-BUSINESS-FLOWS.md), mục "Kết thúc đình chỉ cần xác nhận"): **sau ngày kết thúc**, HLV hoặc bác sĩ bấm "Xác nhận được tập lại". Trạng thái tính theo ngày ở `suspensionStatusOn` (`nestjs-api/src/suspensions/suspensions.model.ts`): `UPCOMING`, `ACTIVE`, `AWAITING_CLEARANCE` (từ `endsOn + 1`, chỉ khi `requiresClearance`), `ENDED`.

Lỗi: `SuspensionsService.clearSuspension` (`nestjs-api/src/suspensions/suspensions.service.ts`) chỉ kiểm `clearedAt !== null`. Vì vậy gọi `POST /suspensions/:id/clear` sẽ:

- kết thúc sớm một đình chỉ KO đang `ACTIVE` (ví dụ ngày thứ 2 của 30 ngày), và lộ trình tập lại theo bậc bắt đầu luôn từ hôm đó;
- "xác nhận" được cả đình chỉ `UPCOMING`, và đình chỉ không cần xác nhận (`MANDATORY_REST`, `DQ`), để kết thúc chúng trước hạn.

Frontend chỉ hiện nút khi `status === "AWAITING_CLEARANCE"` (`nextjs-frontend/src/app/(app)/coach/bouts/suspensions/page.tsx`), nên lỗi chỉ lộ khi gọi API trực tiếp. Demo mode (`nextjs-frontend/src/lib/services/suspensions.demo.ts`, `clearSuspension`) có cùng lỗi.

Chủ dự án quyết 31/10: đây là lỗi; thêm mã lỗi mới `SUSPENSION_NOT_AWAITING_CLEARANCE`, HTTP 409.

## Phạm vi

1. Backend: trong giao dịch của `clearSuspension`, sau khi khoá dòng và kiểm `clearedAt`, tính `suspensionStatusOn(locked, academyDateOf(now))`. Khác `AWAITING_CLEARANCE` thì ném lỗi mới. Thứ tự kiểm giữ như cũ: 404, 403, rồi `SUSPENSION_ALREADY_CLEARED`, rồi lỗi mới.
2. Backend: hàm lỗi `suspensionNotAwaitingClearance(status)` trong `suspensions.error.ts`, theo mẫu `suspensionAlreadyCleared`. Body có `code: 'SUSPENSION_NOT_AWAITING_CLEARANCE'`, `message`, và `details: { status }` (trạng thái hiện tại). Thêm `@ApiConflictEnvelope` cho mã này ở `suspensions.controller.ts`.
3. Frontend demo: `clearSuspension` trong `suspensions.demo.ts` ném cùng mã, cùng thứ tự kiểm.
4. Frontend action: `lib/actions/suspensions.ts` map mã mới sang câu riêng, khoá i18n `suspensions.action.notAwaitingClearance` ở cả `vi` và `en`. Câu vi: "Chỉ xác nhận được khi đình chỉ đã hết hạn và đang chờ xác nhận."
5. Tài liệu: `nestjs-api/docs/modules/01-suspensions-core.md` thêm mã lỗi; dòng "Kết thúc đình chỉ cần xác nhận" trong FIGHT-CAMP-BUSINESS-FLOWS ghi "API từ chối 409 nếu chưa tới `endsOn + 1`".

## Ngoài phạm vi

- Không migration, không đổi bảng.
- Không thêm chức năng kết thúc đình chỉ sớm hay sửa số ngày.
- Không sửa dữ liệu cũ đã bị xác nhận sớm (nếu có). Chủ dự án tự kiểm Supabase.
- Điện thoại (`reactnative-mobile`) không gọi API xác nhận, không sửa.

## Ca kiểm thử

Ngày giờ theo học viện (UTC+7). Mỗi ca 1–6 phải **lỗi trên code cũ** (code cũ trả 200).

| Ca | Đầu vào | Hành động | Kết quả mong đợi | Lớp |
| --- | --- | --- | --- | --- |
| C1 | KO, `startsOn` 2026-11-01, 30 ngày (`endsOn` 2026-11-30), chưa xác nhận; hôm nay 2026-11-02 | HLV được phân gọi clear | 409 `SUSPENSION_NOT_AWAITING_CLEARANCE`, `details.status = 'ACTIVE'`; `clearedAt` vẫn `null` | service có mock repo |
| C2 | KO như C1; hôm nay 2026-11-30 (đúng ngày `endsOn`) | clear | 409, `details.status = 'ACTIVE'` | service |
| C3 | KO như C1; hôm nay 2026-12-01 (`endsOn + 1`) | clear | 200, `clearedAt` có giá trị, `status` trả về `ENDED`, `gradedReturn.ceiling = 3` | service |
| C4 | `MEDICAL`, `startsOn` 2026-11-05, 3 ngày; hôm nay 2026-11-02 | clear | 409, `details.status = 'UPCOMING'` | service |
| C5 | `MANDATORY_REST` (không cần xác nhận), `startsOn` 2026-11-01, 7 ngày; hôm nay 2026-11-03 | clear | 409, `details.status = 'ACTIVE'` | service |
| C6 | `MANDATORY_REST` như C5; hôm nay 2026-11-10 (đã hết) | clear | 409, `details.status = 'ENDED'` | service |
| C7 | KO đã xác nhận (`clearedAt` có giá trị) | clear | 409 `SUSPENSION_ALREADY_CLEARED` (giữ như cũ, không đổi sang mã mới) | service |
| C8 | C1 và C3 chạy trên PostgreSQL tạm | clear qua service với repo thật | C1: dòng không đổi; C3: `cleared_at` được ghi | `test:db` nếu bộ `test:db` hiện có ca suspensions, không thì bỏ và ghi lý do trong handover |
| C9 | Demo mode: đình chỉ của Marcus Hale (KO, đang chạy) | `clearSuspension` demo | `ApiError` 409, `code = 'SUSPENSION_NOT_AWAITING_CLEARANCE'`; Diego Alvarez (chờ xác nhận) vẫn xác nhận được | vitest frontend |
| C10 | Action nhận `ApiError` 409 mã mới | `clearSuspensionAction` | Trả câu vi "Chỉ xác nhận được khi đình chỉ đã hết hạn và đang chờ xác nhận."; tiếng Anh có câu tương ứng | vitest frontend |

Ca 1–7 không được mock `suspensionStatusOn`. Ngày "hôm nay" cố định bằng fake timer hoặc tham số `now`, theo cách các spec suspensions đang làm.

## Tiêu chí nghiệm thu

1. Ca C1–C10 có test, đúng tên ca, đúng đầu vào và kết quả mong đợi. Handover dán output cho thấy C1–C6 lỗi trước khi sửa và qua sau khi sửa.
2. `POST /suspensions/:id/clear` chỉ thành công khi trạng thái là `AWAITING_CLEARANCE` vào ngày gọi.
3. Swagger của endpoint có mã 409 mới.
4. Không test hiện có nào bị đổi kết quả mong đợi. Test nào đang xác nhận một đình chỉ chưa tới `endsOn + 1` thì sửa **dữ liệu đầu vào** (ngày) và ghi tên test vào handover.

## Lệnh kiểm tra bắt buộc

```
pnpm --filter nestjs-api lint
pnpm --filter nestjs-api build
pnpm --filter nestjs-api exec vitest run src/suspensions src/bouts
pnpm --filter nestjs-api test:db
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```
