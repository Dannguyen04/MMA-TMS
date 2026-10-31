# T-011 · Đồng bộ `fight-camp` với `main`

| | |
| --- | --- |
| **Trạng thái** | READY (26/10) |
| **Người nhận** | Hoàng Anh |
| **Hạn** | 27/10, trước khi làm tiếp T-006 B, T-026 |
| **Phụ thuộc** | Không. Làm trên `fight-camp` mới nhất (`d7ec5de` trở về sau) |

## Bối cảnh

`main` có 23 commit chưa có trong `fight-camp` (đo 26/10 bằng `git cherry fight-camp origin/main`):

- PR #22 `feat/ux-demo-flow` của Hoàng Anh (stepped forms, quick-pick chips, hand-off queues), PR #23 CI, PR #21 `feat/mobile-platform`.
- PR #26 (`User_Feature` của Ken, merge 26/10 00:06): T-029 và T-007 **bản trước review**. Bản đã review và ghép với T-010 lượt 2 nằm trên `fight-camp` (merge `01c9e21`, `8c31414`).

Bản sửa storage `39c00f1` đã có trên `main`, không cần PR riêng nữa (phần cũ của T-011).

## Phạm vi

1. Từ `fight-camp`, tạo `chore/T-011-sync-main`, chạy `git merge origin/main` (không rebase).
2. Giải 14 file xung đột (đo bằng `git merge-tree` 26/10):
   - **Bouts, lấy bản `fight-camp`** (bản đã review): `nestjs-api/src/bouts/bouts.service.ts`, `nestjs-api/src/bouts/bouts.controller.spec.ts`, `docs/tickets/README.md`. Dùng `git checkout --ours <file>`; không sửa tay.
   - **Frontend, giữ cả hai:** `coach/fighters/[fighterId]/page.tsx`, `coach/sessions/[sessionId]/page.tsx`, `coach/sessions/new/page.tsx`, `fighter/health/history/page.tsx`, `fighter/health/page.tsx` (trong `nextjs-frontend/src/app/(app)/`), `components/dashboard/care-team-card.tsx`, `components/dashboard/examination-summary-card.tsx`, `components/medical/examination-presets.ts`, `components/training/session-form.tsx`, `lib/actions/training.ts`, `lib/services/training-errors.ts`. Giữ hành vi của PR #22 (form theo bước, chip chọn nhanh) **và** bản dịch của T-015, T-016: chữ mới của PR #22 phải đi qua từ điển (`training.*.ts`, `health.*.ts`), không viết cứng tiếng Anh.
3. Commit merge, chạy lệnh kiểm tra, push nhánh, báo Claude review.
4. Sau khi APPROVED: chủ dự án merge vào `fight-camp`, rồi mở PR `fight-camp` → `main`.

## Ngoài phạm vi

Thêm tính năng. Sửa logic bouts hay suspensions (giữ nguyên bản `fight-camp`). Force push, rebase.

## Tiêu chí nghiệm thu

1. `git diff fight-camp...chore/T-011-sync-main -- nestjs-api/src/bouts nestjs-api/src/suspensions` rỗng (bouts giữ nguyên bản đã review).
2. Các tính năng của PR #22 còn chạy: form buổi tập theo bước, chip chọn nhanh ở khám bệnh (kiểm tay ở demo mode, ghi vào handover).
3. Với `mma_locale=vi`, các file frontend ở mục 2 không có chữ Anh viết cứng mới.
4. Không thêm lỗi so với baseline.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nestjs-api build
pnpm --filter nestjs-api test
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```

Chạy `typecheck` ở nơi không có `.env.local` đặt `APP_DATA_MODE=demo` (lệnh `next typegen` từ chối chế độ demo khi build), hoặc tạm đặt biến môi trường `APP_DATA_MODE=api` cho lệnh đó.
