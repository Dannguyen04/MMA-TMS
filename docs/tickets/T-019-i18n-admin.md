# T-019 · Tiếng Việt: Admin

| | |
| --- | --- |
| **Trạng thái** | DRAFT (Claude viết 20/10) |
| **Phần** | Frontend (`nextjs-frontend`) |
| **Nhánh** | `feat/T-019-i18n-admin` từ `fight-camp` mới nhất |
| **Thuộc** | Phần 3 của [T-013](./T-013-i18n-vi.md). Mục "Thiết kế" và "Quy ước khi dịch" của T-013 áp dụng nguyên văn |

## Bối cảnh

Khu vực Admin (30 file route, 27 file component) hoàn toàn chưa dịch. Ưu tiên thấp nhất vì không nằm trong kịch bản demo Fight Camp.

## Phạm vi

Tiền tố key: `admin.`. Cặp file mới: `messages/admin.en.ts` / `admin.vi.ts`.

- **Route đang hiện trong menu:** `src/app/(app)/admin/{dashboard,users,roles,ai-jobs,audit-logs,settings,videos,notifications}/**`, `admin/layout.tsx`, `admin/page.tsx`.
- **Component:** `src/components/admin/**`, trừ `model-card.tsx`, `model-thresholds-form.tsx`, `promote-model-button.tsx`, `threshold-bands.tsx` (thuộc `ai-models`, đóng băng).
- **Server:** `src/lib/actions/admin.ts`; câu mô tả bản ghi audit sinh ở phía hiển thị (`src/lib/services/audit.ts` và `audit-log-rows.tsx`), không đổi dữ liệu log đã lưu.
- **Nhãn enum** trong `labels.ts`: `ROLE_LABELS`, `USER_STATUS_LABELS`, `NOTIFICATION_CATEGORY_LABELS`, `BROADCAST_STATUS_LABELS`, `BROADCAST_CHANNEL_LABELS`.
- Mã quyền (permission code) là mã kỹ thuật, giữ nguyên.

## Ngoài phạm vi

- Route đóng băng `admin/{admissions,ai-models}`.
- Không đổi logic phân quyền, route, schema; không cài thư viện; không dịch tên riêng và dữ liệu người dùng nhập.

## Tiêu chí nghiệm thu

1. Với `mma_locale=vi` (hoặc không có cookie), các màn trong phạm vi không còn chữ Anh viết cứng, kể cả `aria-label`, `title`, placeholder, toast, `loading.tsx` và lỗi từ action. Chữ giữ nguyên được liệt kê trong handover.
2. Với `mma_locale=en`, nội dung giống trước ticket.
3. Ngày giờ truyền `locale`; mọi chỗ định dạng ngày trong `src/components/admin/**` đi qua `src/lib/format.ts`, không tạo `Intl.DateTimeFormat` cố định tiếng Anh.
4. `translate.test.ts` qua.
5. Không cuộn ngang ở 390 px, nhất là bảng người dùng, ma trận quyền, audit log (kiểm tra tay, ghi vào handover).
6. Test hiện có vẫn qua (gồm `admin.test.ts`, `audit.test.ts`); test nào đổi vì câu chữ thì ghi lý do.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```
