# T-027 · Giảm độ trễ mỗi request có xác thực ở backend

| | |
| --- | --- |
| **Trạng thái** | READY (20/10) |
| **Phần** | Backend (`nestjs-api`) |
| **Nhánh** | `perf/T-027-request-latency` từ `fight-camp` mới nhất |
| **Người nhận** | Gemini (hoặc BE1) |
| **Migration** | Không |
| **Liên quan** | [T-028](./T-028-frontend-navigation-latency.md) (frontend); hai ticket độc lập, làm song song được |

## Bối cảnh

Chủ dự án báo chuyển tab và chuyển trang rất chậm. Phân tích code (20/10) cho thấy mỗi request có xác thực ở backend trả ba khoản tuần tự, trước khi handler chạy:

1. `AuthService.authenticate` gọi `this.supabase.auth.getUser(accessToken)` ([auth.service.ts:444](../../nestjs-api/src/auth/auth.service.ts)): một lượt HTTPS tới Supabase Auth.
2. Cùng hàm đó gọi tiếp `findActiveUserBySubject` ([auth.repo.ts:26](../../nestjs-api/src/auth/auth.repo.ts)): một truy vấn `users`.
3. `AuthorizationGuard` → `hasPermissions` → `resolvePermissions` ([auth.repo.ts:49](../../nestjs-api/src/auth/auth.repo.ts)): truy vấn join 3 bảng, chạy sau bước 2.

Database ở Supabase pooler `ap-northeast-1`, còn app chạy ở Việt Nam, nên mỗi lượt cỡ trăm ms. Frontend gọi `/users/me` và nhiều endpoint khác ở mỗi lần chuyển trang, nên khoản này nhân lên.

Ngoài ra:

- `GET /users/me` tra lại `users` dù guard đã có user, rồi tra profile ở truy vấn tiếp theo ([users.repo.ts:168-190](../../nestjs-api/src/users/users.repo.ts), `findProfile` ở dòng ~337).
- `Pool` không cấu hình gì ([database.module.ts:25](../../nestjs-api/src/database/database.module.ts)): không `max`, `keepAlive`, `idleTimeoutMillis`, `connectionTimeoutMillis`.
- Roster của coach và doctor chạy một truy vấn tra id trước khi lấy danh sách ([coaches.service.ts:33-46](../../nestjs-api/src/coaches/coaches.service.ts), [medical.service.ts:405-419](../../nestjs-api/src/medical/medical.service.ts), [fighters.service.ts:101-116](../../nestjs-api/src/fighters/fighters.service.ts)).

## Phạm vi

**A. Đo trước (bắt buộc, làm đầu tiên).** Thêm log thời gian tạm thời hoặc dùng script đo để ghi số liệu trước/sau cho `GET /users/me`, `GET /notifications/unread-count`, `GET /fighters` (một coach), với 20 lần gọi liên tiếp: p50 và p95. Chạy bằng `node dist/main` (không dùng `nest start --watch`) và gọi qua `127.0.0.1`. Dùng tài khoản và dữ liệu giả; không chạy `db:migrate:*`. Bỏ log tạm trước khi commit (hoặc để sau cờ env, mặc định tắt). Ghi bảng số liệu vào handover.

**B. Bỏ lượt gọi Supabase Auth ở mỗi request.** Xác thực JWT cục bộ (chữ ký, `exp`, `sub`) và chỉ gọi Supabase khi thật cần. Cách làm (JWKS có cache hay secret) do người làm chọn dựa trên cấu hình Supabase hiện có của dự án; nếu cần thêm thư viện thì **hỏi trong handover, không tự cài**. Hành vi 401 với token sai, hết hạn hay thiếu phải giữ nguyên.

**C. Cache TTL ngắn trong bộ nhớ** (30–60 giây, cấu hình bằng hằng số) cho:
- user theo `authSubject` (kết quả `findActiveUserBySubject`);
- tập quyền hiệu lực theo `(userId, role)` (kết quả `resolvePermissions`).

Phải xoá hoặc làm mất hiệu lực cache khi user bị vô hiệu hoá, đổi role, hoặc đổi quyền của user. Tìm mọi chỗ ghi vào `users.isActive`, `users.role`, `user_permissions`, `role_permissions` bằng grep và gắn xoá cache vào đó. Nếu có chỗ không gắn được thì ghi rõ trong handover cùng TTL tối đa của độ trễ.

**D. `GET /users/me`**: dùng user guard đã nạp thay vì tra lại `users`; lấy profile bằng một truy vấn (LEFT JOIN) hoặc chạy song song. Response không đổi.

**E. Pool**: đặt `max`, `keepAlive: true`, `idleTimeoutMillis`, `connectionTimeoutMillis` bằng hằng số có chú thích; đọc `migrations/README.md` và cấu hình pooler hiện dùng (cổng 5432) trước khi chọn `max`. **Không** đổi chuỗi kết nối, không đổi `ssl.rejectUnauthorized` (ghi nhận trong handover như việc riêng).

## Ngoài phạm vi

Đổi sang cổng pooler 6543; bật `compression`; sửa roster (mục 7 của phân tích, để ticket sau nếu số đo còn cao); khu vực đóng băng; migration; thay đổi hợp đồng API; cài thư viện khi chưa được duyệt.

## File cần sửa (đã kiểm tra là có thật)

`nestjs-api/src/auth/auth.service.ts`, `auth.repo.ts`, `src/shared/guards/auth.guard.ts`, `src/users/users.repo.ts` (+ service/controller của `users` nếu cần), `src/database/database.module.ts`. Test: spec cạnh các file đó (xem B2 trong [BASELINE](./BASELINE.md): vài spec rỗng; chỉ viết lại spec của phần mình sửa). Module mẫu theo quy ước: `src/fighters/`.

## Tiêu chí nghiệm thu

1. Handover có bảng p50/p95 trước và sau cho 3 endpoint ở mục A, đo cùng điều kiện. Mục tiêu: p50 của `GET /users/me` giảm ít nhất 50% so với trước. Nếu không đạt, ghi nguyên nhân (đo, không đoán).
2. Token sai, token hết hạn, thiếu token, user bị vô hiệu hoá: vẫn trả 401/403 như cũ. Có unit test cho từng ca.
3. Sau khi vô hiệu hoá user, đổi role, hoặc đổi quyền của user: request kế tiếp thấy kết quả mới trong vòng ≤ TTL, hoặc ngay lập tức nếu đã gắn xoá cache. Có test.
4. Cache hit không phát sinh truy vấn DB thêm (test đếm số lần gọi repo).
5. `GET /users/me` thực hiện tối đa 1 truy vấn (hoặc 2 chạy song song) sau guard; response giống hệt trước (test so sánh).
6. Cấu hình pool nằm ở một chỗ, có chú thích lý do từng giá trị.
7. Không đổi hợp đồng API, không migration, không thêm thư viện nếu chưa có duyệt trong handover.
8. Không lệnh nào thêm lỗi so với [BASELINE](./BASELINE.md) (backend test hiện có 26 lỗi có sẵn).

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nestjs-api lint
pnpm --filter nestjs-api build
pnpm --filter nestjs-api test
```

Không cần `test:db` và `db:check` vì không có migration.

## Câu hỏi mở (ghi vào handover, không tự đoán)

- Xác thực JWT cục bộ cần JWKS hay secret? Có cần thư viện mới không?
- Có chỗ nào ghi `users`/quyền mà không gắn được xoá cache?
- `/health` mất ~210ms trên máy chủ dự án dù không chạm DB: đo bằng `node dist/main` và `127.0.0.1`, ghi kết quả (có thể do `nest start --watch` hoặc phân giải `localhost` sang IPv6).
