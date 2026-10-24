# T-027 Handover

- Nhánh: perf/T-027-request-latency
- Trạng thái: IN REVIEW. Người làm: Claude (theo chỉ dẫn trực tiếp của chủ dự án 20/10, vì Gemini hết quota)

## Thay đổi
- `auth/auth-cache.ts` (mới): `TtlCache` (TTL 15 giây, tối đa 2000 mục), `invalidateAuthCache()`, `jwtExpiryMs`.
- `auth/auth.service.ts`: `authenticate` cache theo sha256 của token (bỏ cả lượt `supabase.auth.getUser` lẫn truy vấn `users` khi trúng cache; không vượt quá `exp` của token); `hasPermissions` cache tập quyền theo `(userId, role, mã quyền)`. Lỗi xác thực không được cache.
- Xoá cache ngay khi ghi: `users.repo.ts` (`softDelete`, `promoteGuestToFighter`), `authorization.repo.ts` (đặt/xoá quyền riêng của user, đặt/xoá quyền của role). Chỗ khác thay đổi trạng thái user mà không gọi xoá cache sẽ thấy hiệu lực trong tối đa 15 giây.
- `users.repo.ts` `findActiveById` nhận `roleHint`; `GET /users/me` đọc profile song song với dòng `users` (trước là tuần tự). Hint sai thì đọc lại tuần tự.
- `database.module.ts`: pool `max: 10`, `keepAlive`, `idleTimeoutMillis 30s`, `connectionTimeoutMillis 10s`.

## Chưa làm
- Mục A (đo p50/p95): chưa đo, không có `.env`/DB trong worktree. Việc này cần làm trước khi APPROVED.
- JWT verify cục bộ không làm: cần JWKS/secret và có thể cần thư viện (cần chủ dự án duyệt). Cache 15 giây đã bỏ phần lớn lượt gọi Supabase Auth.
- `videos.service.ts:207` đặt `isActive: false` cho video, không phải user: không liên quan cache.

## Lệnh đã chạy
- `nestjs-api build`: qua. `lint`: qua (chỉ cảnh báo). `test`: 26 lỗi, 645 qua (671): trùng baseline (26 lỗi B1, B2). 5 test mới ở `auth-cache.spec.ts`, 4 test mới ở `auth.service.spec.ts` qua.

## Lệch so với ticket
Không đo; không xác thực JWT cục bộ (xem trên).

## Câu hỏi / việc còn mở
- Có muốn xác thực JWT cục bộ (JWKS) không? Cần quyết định về thư viện.
- User bị vô hiệu hoá qua đường khác (ví dụ trực tiếp trong Supabase) vẫn truy cập được tối đa 15 giây.
