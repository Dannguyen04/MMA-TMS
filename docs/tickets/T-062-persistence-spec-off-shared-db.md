# T-062: test `coaching-loop-persistence.spec.ts` không được ghi vào Supabase của team

- **Loại:** fix (test backend). **Mức:** chặn. Mọi người chạy `pnpm --filter nestjs-api test` theo Definition of Done, và mỗi lần chạy lại tạo dữ liệu rác trên database thật.
- **Người nhận:** Dan (tác giả spec, commit `ddfabe7` ngày 5/10).
- **Trạng thái:** READY.

## Bối cảnh

Ngày 9/11, dashboard admin ở API mode sập vì `/users` quá thời gian chờ. Supabase có 1006 tài khoản, trong đó 984 tài khoản là rác test với email `@test.invalid`, theo 3 dạng:

- `coach_<số>@test.invalid`
- `unauth_coach_<số>@test.invalid`
- `fighter_<số>@test.invalid`

Các tài khoản này kéo theo 316 video, 315 job AI, 125 giáo án, 1019 dòng audit, v.v.

Nguồn: `nestjs-api/test/coaching-loop-persistence.spec.ts`.

- File khớp `include: ['**/*.spec.ts']` trong `nestjs-api/vitest.config.ts`, nên nó chạy trong `pnpm --filter nestjs-api test`.
- `beforeEach` dựng cả `AppModule`, và `DatabaseModule` đọc `DATABASE_URL` từ `.env` (`src/database/database.module.ts:18`). Kết quả là spec ghi thẳng vào Supabase của team.
- Mỗi ca test tạo 3 tài khoản cùng dữ liệu đi kèm. `afterEach` chỉ gọi `app.close()`, không xoá gì.

Ngày 9/11, chủ dự án đồng ý cho xoá. Claude xoá toàn bộ trong một transaction: 984 `users`, 986 `auth.users` và mọi dòng tham chiếu tới chúng. Bản sao lưu nằm ở `C:\Users\LENOVO\Documents\MMA-TMS-backups\` trên máy chủ dự án.

## Phạm vi

1. Spec không được kết nối database nào lấy từ `.env`. Chọn một trong hai cách:
   - Chuyển spec sang chạy trên PostgreSQL tạm, giống `scripts/test-migrations.mjs` (file này không đọc `.env`, xem dòng 11 và 20).
   - Hoặc cho spec bỏ qua (`describe.skip` có điều kiện) khi không có biến riêng, ví dụ `PERSISTENCE_TEST_DATABASE_URL`, trỏ vào database tạm.
2. Nếu spec còn tạo dữ liệu, `afterEach` phải xoá hết những gì nó đã tạo.
3. Ghi vào `nestjs-api/AGENTS.md` (mục test) quy tắc: test trong `pnpm test` không được dùng `DATABASE_URL` của `.env`.

## Ngoài phạm vi

- Logic của `CoachingService` và các ca test 1–5. Giữ nguyên ý nghĩa của từng ca.

## Tiêu chí nghiệm thu

1. Đếm `select count(*) from users where email like '%@test.invalid'` trên Supabase trước và sau khi chạy `pnpm --filter nestjs-api test` với `.env` của team: hai số bằng nhau.
2. `pnpm --filter nestjs-api test` không thêm lỗi so với baseline.
3. Nếu chọn database tạm: 5 ca của spec chạy và qua trên database đó. Handover ghi lệnh chạy.

## Lệnh kiểm tra

- `pnpm --filter nestjs-api lint`, `build`, `test`
- Đếm như ở tiêu chí 1. Người review chạy câu đếm này, chỉ đọc.

## Tạm thời, cho tới khi ticket xong

Không chạy `pnpm --filter nestjs-api test` trong thư mục có `nestjs-api/.env`. Nếu bắt buộc phải chạy, dùng worktree không có `.env`.
