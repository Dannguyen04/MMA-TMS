# Bootstrap tương thích Supabase chỉ dành cho local

`000_local_only_supabase_compat.sql` chỉ tạo các thành phần tối thiểu để PostgreSQL
cục bộ chạy được migration và kiểm tra RLS:

- role `anon` và `authenticated` không có quyền đăng nhập;
- schema `auth`;
- bảng `auth.users` chỉ có khóa chính `id`;
- hàm `auth.uid()` đọc subject từ `request.jwt.claim.sub`.

File này không chứa user, mật khẩu hoặc seed credential. Docker Compose mount file trực
tiếp vào `docker-entrypoint-initdb.d` trước migration `001`–`021`. PostgreSQL chỉ chạy
init scripts khi volume dữ liệu còn trống; volume đã tồn tại sẽ không tự chạy lại.

File không thuộc manifest migration production và không được chạy trên Supabase. Chốt
an toàn trong SQL chỉ chấp nhận hai database cố định của Compose:
`martial_arts_tracker` và `martial_arts_tracker_e2e`.
