# Baseline kiểm thử của nhánh `fight-camp`

**Đo ngày**: 2026-10-13, trên commit `4dfc37a`, worktree sạch, chưa có thay đổi của ticket nào. Không chạy Redis; không có file `.env`.

Ticket chỉ bị coi là gây lỗi khi làm **tăng** số lỗi so với bảng này. Lỗi có sẵn không chặn ticket, trừ khi ticket yêu cầu sửa.

| Lệnh | Kết quả | Ghi chú |
| --- | --- | --- |
| `pnpm --filter nestjs-api lint` | Qua | |
| `pnpm --filter nestjs-api build` | Qua | |
| `pnpm --filter nestjs-api test` | **26 lỗi**, 611 qua (637) | Xem B1, B2 |
| `pnpm --filter nestjs-api test:db` | **Không chạy được** | Xem B3 |
| `pnpm --filter nestjs-api db:check` | Qua | Chỉ kiểm tra checksum, không kết nối database |
| `pnpm --filter nextjs-frontend lint` | Qua | |
| `pnpm --filter nextjs-frontend typecheck` | Qua | |
| `pnpm --filter nextjs-frontend test` | Qua: 578 test, 1 bị skip | |

## Lỗi có sẵn

- **B1.** `test/coaching-loop-persistence.spec.ts` (5 test) và `test/dataset-export-trust-boundary.spec.ts` (21 test) lỗi vì cần Redis ở `localhost:6379` và cấu hình Supabase. Cả hai thuộc khu vực đóng băng (coaching, dataset). Không sửa trong đợt đồ án.
- **B2.** Năm file spec bị commit **rỗng (0 byte)** trong commit `5b07e62` "Add unit tests for notification services". Vitest báo "No test suite found" cho từng file:
  - `src/medical/doctor-assignment-reminder.service.spec.ts`
  - `src/notifications/notification-producer.service.spec.ts`
  - `src/notifications/notification-stream.service.spec.ts`
  - `src/notifications/notifications.config.spec.ts`
  - `src/notifications/notifications.service.spec.ts`

  Ticket nào sửa code tương ứng thì viết lại test cho phần mình sửa trong file đó.
- **B3.** `scripts/test-migrations.mjs` thừa một `});` ở dòng 623 (lỗi cú pháp "Missing catch or finally after try"), có từ commit merge `0a0ade0`. Ticket đầu tiên cần `test:db` (T-002) phải sửa lỗi này, và chỉ sửa đúng chỗ đó.
