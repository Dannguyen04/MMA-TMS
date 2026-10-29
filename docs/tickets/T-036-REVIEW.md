# T-036 Review (phần A)

- Nhánh: `feat/T-036-suspension-plan-link` (tạo từ `User_Feature` sau khi merge T-035).
- Người thực hiện: `agy`, `gemini-4-argon-high`, phiên `962bf6ae-18af-4d24-93dc-8d256de66b13`, 2 lượt (lượt đầu khoảng 46 phút, lượt sửa khoảng 60 phút).
- Ngày: 29/10/2026.

## Kết luận

**APPROVED** sau lượt sửa 1. Migration 032 **chưa áp lên Supabase**: chủ dự án áp bằng `pnpm db:migrate:032` sau khi merge (chỉ cần ledger có 024).

## Lệnh Claude chạy lại (sau lượt sửa 1)

| Lệnh | Kết quả |
| --- | --- |
| `pnpm --filter nestjs-api lint` | Thoát 0 |
| `pnpm --filter nestjs-api build` | Thoát 0 |
| `pnpm --filter nestjs-api db:check` | `001-032 checksums OK. No database connection was opened.` |
| `pnpm --filter nestjs-api test:db` | `Migration checks passed: 46.` Có ca 032: áp trên ledger 24 không cần 025–031, thêm `PENDING`, chặn áp lại và chặn khi thiếu 024 |
| `npx vitest run src/suspensions src/training src/coaching src/bouts` | `Test Files 24 passed (24)`, `Tests 589 passed (589)` |
| `pnpm --filter nestjs-api test` | `Test Files 6 failed | 59 passed (65)`, `Tests 26 failed | 1034 passed (1060)`: 26 lỗi đúng [baseline](./BASELINE.md) B1, B2; tăng 6 test so với sau T-035 (1028) |
| `grep "from '../(training|bouts)" src/suspensions/` (không tính spec) | 0 dòng: hướng phụ thuộc giữ đúng |

## Vấn đề đã sửa ở lượt 1

| # | Mức | Vấn đề | Cách sửa |
| --- | --- | --- | --- |
| 1 | Chặn | `handleSuspensionsCreated` gửi thông báo huỷ **bên trong** transaction tạo đình chỉ hoặc ghi kết quả trận. Rollback thì võ sĩ vẫn nhận thông báo về buổi không bị huỷ | Kết quả có `afterCommit`; `SuspensionsService.createSuspension` (`suspensions.service.ts:136`) và `BoutsService` ghi kết quả (`bouts.service.ts:1567`) gọi sau khi transaction resolve. `afterCommit` không nằm trong response |
| 2 | Nên sửa | `@Optional()` cùng `= new SuspensionEffects()` ở 3 constructor: DI lỗi thì mỗi nơi một instance, cơ chế tự áp dụng tắt mà không báo | Đã bỏ |
| 3 | Nên sửa | `lockActiveCampPlansByFighterId?.(…)` che việc thiếu hàm | Gọi thẳng |

## Đối chiếu tiêu chí

| # | Kết quả |
| --- | --- |
| 1. Đình chỉ cố định → `PENDING`, giữ `scheduledAt`, có trong `affectedSessions` | Đạt |
| 2. Đình chỉ cần xác nhận → `CANCELLED` lý do `'Suspension in force'`, thông báo sau commit | Đạt (sau lượt 1) |
| 3. Loại không bị chặn, ngoài khoảng, đã `COMPLETED`/`IN_PROGRESS`: không đổi | Đạt |
| 4. Cùng transaction với ghi kết quả; rollback thì buổi không đổi | Đạt |
| 5. `PENDING` + `scheduledAt` sau đình chỉ → `SCHEDULED`; còn trong khoảng → 409; `IN_PROGRESS` → lỗi chuyển trạng thái; `CANCELLED` có lý do → được | Đạt (`applySessionUpdateInTransaction`, `updateSessionStatus` chặn `PENDING → SCHEDULED` không đổi ngày) |
| 6. KO, TKO, MEDICAL: plan `ACTIVE` `fight_camp`/`taper` → `rehab`; các trường hợp khác không đổi | Đạt (khoá plan trước khi đổi) |
| 7. `planConflicts` chỉ `PENDING`/`CANCEL`; `apply` với `CHANGE_TYPE` lỗi validation | Đạt |
| 8. `register` hai lần ném lỗi; `runOnCreated` không handler trả rỗng; không import ngược | Đạt |
| 9. Migration 032 qua `test:db`, `db:check`; không thêm lỗi so với baseline | Đạt |

## Gợi ý (không chặn)

- Ghi kết quả trận tạo nhiều đình chỉ cùng lúc (ví dụ KO cộng nghỉ bắt buộc): `affectedSessions`, `affectedPlans` là kết quả **chung** của cả lượt nhưng được gắn lặp lại vào từng đình chỉ trong response (`bouts.service.ts:1677-1678`). Frontend (phần B) nên đọc từ đình chỉ đầu tiên, hoặc chuyển lên cấp response khi làm phần B.
- Breaking change cho frontend: `CONFLICT_ACTIONS` không còn `CHANGE_TYPE`, `RESCHEDULE`. T-030 phần B (Hoàng Anh) phải theo hai hành động mới.
