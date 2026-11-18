# T-075: thêm "2 hiệp" vào form tạo trận

- Trạng thái: **READY** 18/11/2026 (chủ dự án duyệt hôm nay, cần xong và lên bản deploy trước buổi demo 19/11)
- Phạm vi: frontend `nextjs-frontend`. Không backend, không migration, không mobile.
- Người làm: đề xuất Gemini `gemini-3.8-flash-high` (việc theo khuôn, một file chính). Claude review.
- Phụ thuộc: không.

## Bối cảnh

Kịch bản demo 19/11 (file `DEMO-KICH-BAN-4-NGUOI (1).md`, cập nhật 18/11/2026, nằm trên máy Dan, chưa vào repo) dùng **một trận 2 hiệp**. Form tạo trận trên bản deploy chỉ cho chọn 3 hoặc 5 hiệp, nên bước A1 của Dan không làm được.

Đã kiểm tra trên `origin/release/final-review` (nhánh đang deploy lên `mma-tms-demo.vercel.app`). Số dòng dưới đây theo nhánh này; trên `origin/fight-camp` cùng mã nhưng có thể lệch vài dòng (ví dụ test "creates a scheduled bout and opens it" ở dòng 99 trên release, dòng 96 trên `fight-camp`).

- `nextjs-frontend/src/lib/domain/bout.ts:128`: `export const SCHEDULED_ROUND_CHOICES = [3, 5] as const;`, kèm comment dòng 127 ("Three rounds for a regular MMA bout, five for a main event or title fight"). Cùng dòng trên `origin/fight-camp`.
- `nextjs-frontend/src/app/(app)/coach/bouts/new/bout-form.tsx:125-131`: ô **Số hiệp dự kiến** duyệt `SCHEDULED_ROUND_CHOICES`, nhãn lấy từ khoá `coachBouts.form.roundsOption`. Dòng 125 đặt mặc định bằng `String(SCHEDULED_ROUND_CHOICES[0])`, tức phần tử **đầu tiên**.
- `nextjs-frontend/src/lib/actions/bouts.ts:241`: `scheduledRounds: SCHEDULED_ROUND_CHOICES.find((n) => String(n) === text(formData, "scheduledRounds")) ?? null`. Giá trị ngoài danh sách bị lưu thành `null`.
- Khoá i18n `coachBouts.form.roundsOption` đã có trong `src/lib/i18n/messages/coach-bouts.vi.ts` ("{n} hiệp") và `coach-bouts.en.ts` ("{n} rounds"). Dùng được cho n = 2, không cần khoá mới.
- Backend nhận `scheduledRounds` từ 1 đến 12: `nestjs-api/src/bouts/bouts.model.ts:913` (`z.number().int().min(1).max(12)`) và ràng buộc DB `ck_bouts_scheduled_rounds` (`nestjs-api/migrations/027_opponent_analysis_and_rounds.sql:35`). Không cần sửa backend.

`origin/release/final-review` hơn `origin/fight-camp` 104 commit (`fight-camp` là tổ tiên của nó), và Vercel chỉ build nhánh release. Vì vậy ticket này tạo nhánh từ **`origin/release/final-review`** để bản sửa lên được trang demo. Đưa thay đổi sang `fight-camp` là việc của chủ dự án khi merge.

## Phạm vi

1. `src/lib/domain/bout.ts`: đổi thành `[2, 3, 5] as const` (thứ tự tăng dần). Thêm `export const DEFAULT_SCHEDULED_ROUNDS = 3 as const;` ngay dưới. Cập nhật comment dòng 127 cho đủ ba lựa chọn (hai hiệp cho trận ngắn, ví dụ trận demo; ba hiệp là trận thường; năm hiệp cho trận chính hoặc tranh đai).
2. `bout-form.tsx:125`: `defaultValue` dùng `String(DEFAULT_SCHEDULED_ROUNDS)` thay cho `String(SCHEDULED_ROUND_CHOICES[0])`. Mặc định vẫn là 3 hiệp, không đổi hành vi cho người dùng hiện có.
3. Thêm test (xem bảng dưới).

## Ngoài phạm vi

- Không sửa `bouts.ts:241` (logic `find ... ?? null` vẫn đúng).
- Không sửa backend, migration, API contract, i18n.
- Không sửa `reactnative-mobile`: màn `round-entry-screen.tsx` có chọn 3 hoặc 5 cộng ô nhập 1–12, tự nhập 2 được.
- Không sửa `components/landing/pose-skeleton.ts:89` (mảng `[3, 5]` ở đó là việc khác, không liên quan số hiệp).
- Không đổi màn Sửa trận. Nếu màn Sửa có chọn số hiệp riêng, **ghi vào handover**, không tự sửa.

## Ca kiểm thử

| Ca | Đầu vào | Kết quả mong đợi |
| --- | --- | --- |
| C1 | `SCHEDULED_ROUND_CHOICES` | Bằng `[2, 3, 5]` |
| C2 | `DEFAULT_SCHEDULED_ROUNDS` | Bằng 3 và thuộc `SCHEDULED_ROUND_CHOICES` |
| C3 | Action tạo trận ở demo mode, `scheduledRounds = "2"` | Trận tạo ra có `scheduledRounds = 2`. Theo khuôn test "creates a scheduled bout and opens it" trong `src/lib/actions/bouts.test.ts` |
| C4 | Cùng action, `scheduledRounds = "3"` và `"5"` | Giữ 3 và 5 như trước |
| C5 | Cùng action, `scheduledRounds = "4"` | Lưu `null` như hiện nay |

C3 phải **lỗi trên code cũ** (code cũ lưu `null`) và qua sau khi sửa. Dán output hai lần chạy vào handover.

## Tiêu chí nghiệm thu

1. C1 đến C5 có test, đúng tên ca. C3 lỗi trước khi sửa, qua sau khi sửa.
2. Mở `/coach/bouts/new`: ô **Số hiệp dự kiến** có ba lựa chọn **2 hiệp**, **3 hiệp**, **5 hiệp**, mặc định chọn **3 hiệp**.
3. Không test hiện có nào bị đổi kết quả mong đợi.
4. Không có thay đổi nào ngoài `bout.ts`, `bout-form.tsx` và file test.

## Lệnh kiểm tra bắt buộc

```text
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend exec vitest run src/lib/actions/bouts.test.ts src/lib/domain
pnpm --filter nextjs-frontend test
```

So sánh với [BASELINE](./BASELINE.md): không thêm lỗi.

## Nhánh và lên bản deploy

- Worktree riêng, nhánh `feat/T-075-two-round-choice` tạo từ `origin/release/final-review` mới nhất.
- Người thực hiện không merge và không push lên `release/final-review`. Chủ dự án (Dan) merge `--no-ff` vào `release/final-review` và push sau khi Claude APPROVED.
- Vercel tự build khi có push lên `release/final-review`; Render cũng tự deploy theo mỗi commit nên backend khởi động lại một lượt (xem `docs/DEPLOY-DEMO.md` trên nhánh `release/final-review`, file này chưa có trên `fight-camp`). Nên push sớm, ít nhất vài giờ trước giờ chiếu, rồi mở `https://mma-tms-api.onrender.com/health` và kiểm tra ô số hiệp trên `https://mma-tms-demo.vercel.app/coach/bouts/new`.

## Phương án dự phòng nếu không kịp deploy

Tạo trận với 3 hiệp trên web, rồi đổi sang 2 hiệp bằng một lệnh `PATCH /bouts/:id` với body `{"scheduledRounds": 2}` (API nhận 1–12; app điện thoại gọi đúng endpoint này ở `reactnative-mobile/src/api/fight-camp.ts:110`). Lệnh phải dùng token HLV Rafael và chạy trước phần Fon. Cần thử ở demo mode trước khi dựa vào.
