# T-063 đến T-069, T-072: Tăng tốc API mode (backend)

- **Trạng thái:** DONE trên `release/final-review` (12/11/2026). Chủ dự án yêu cầu làm ngay, không qua giao ticket.
- **Đặc tả gốc, số đo trước và sau:** [PERFORMANCE-PLAN.md](../PERFORMANCE-PLAN.md) §4 (từng ticket, tiêu chí nghiệm thu) và §8 (kết quả).
- **Commit:** `e80b1c1` (T-063 đến T-069), frontend dùng các endpoint mới ở `9965139`, `df73a9b`. T-072 ghi ở commit sau.
- **Số dành riêng:** T-070, T-071 để Ken đánh số lại hai ticket dashboard HLV trên nhánh `User_Feature` (trùng T-062 của Dan, xem [REVIEW-KEN-COACH-DASHBOARD.md](./REVIEW-KEN-COACH-DASHBOARD.md)).

| Ticket | Nội dung | Endpoint, cấu hình |
| --- | --- | --- |
| T-063 | Danh sách buổi tập và giáo án nhận nhiều võ sĩ, nhiều trạng thái | `GET /training-sessions`, `GET /training-plans`: `fighterIds` (1–100, lặp tham số hoặc phân cách dấu phẩy), `status` nhiều giá trị. DOCTOR kiểm phân công một truy vấn |
| T-064 | Hồ sơ y tế theo lô | `GET /medical/dossiers?fighterIds=…` (bỏ trống: cả phạm vi người gọi, tối đa 100), 11 truy vấn bất kể số võ sĩ, một INSERT audit nhiều dòng |
| T-065 | Gộp xác thực đang chạy, TTL danh tính 60 s | `TtlCache.getOrLoad` trong `auth/auth-cache.ts` |
| T-066 | `/users/me` trả phạm vi phân công | `assignmentScope: { fighterIds }` cho COACH, DOCTOR |
| T-067 | Cache phạm vi HLV, gộp kiểm phân công vào truy vấn danh sách | `TtlCache` 60 s, xoá cùng `invalidateAuthCache()` |
| T-068 | Cache kết quả job đã xong | LRU 50 mục, 50 MB, 10 phút, sau kiểm quyền |
| T-069 | Pool cấu hình được, đo thời gian request | `DATABASE_POOL_MAX` (mặc định 20), `DATABASE_POOL_WAIT_LOG=1`, `API_TIMING_LOG=1` |
| T-072 | Lịch sử y tế theo lô | `GET /medical/history?fighterIds=…&recordType=…` |

## Kiểm tra

- `pnpm --filter nestjs-api lint`, `build`: sạch. `pnpm --filter nestjs-api test`: chỉ còn 26 lỗi baseline B1/B2 ([BASELINE.md](./BASELINE.md)).
- SQL mới đã chạy đúng trên Supabase thật qua app (mọi lệnh 200). `test:db` chưa chạy được vì máy không có PostgreSQL 18; người merge vào `fight-camp` nên chạy lại `pnpm --filter nestjs-api test:db` (không có migration mới).

## Lưu ý khi deploy

- Đặt `DATABASE_POOL_MAX` theo giới hạn kết nối của gói Supabase (pooler cổng 6543).
- `GET /medical/dossiers` không truyền `fighterIds` mà phạm vi trên 100 võ sĩ trả 400 `MEDICAL_DOSSIER_SCOPE_TOO_LARGE`; frontend luôn truyền danh sách, chia theo 100.
