# T-029 Review

- Ngày review: 26/10/2026, Claude.
- Phạm vi: 5 commit code của Ken trên `origin/User_Feature` (`5d1f1aa`, `e73421c`, `a71db11`, `1e7a1d1`, `b9638eb`), nền `fight-camp` cũ `593490e`; handover ở `9038a8c`. Theo handover, code do một phiên Claude trên máy Ken viết theo chỉ định của chủ dự án.
- **Kết luận: APPROVED.** Không có vấn đề mức "chặn". Việc còn chờ T-007 ghi ở dưới.

## Nhánh

`User_Feature` đã merge cả `main` (24 commit chưa có trong `fight-camp`), nên Claude **không** merge nhánh đó. Claude tạo `feat/T-029-coach-todo` = `b9638eb` + merge `fight-camp` mới (`bab3a2c`). Ba xung đột đều máy móc:

- `bouts.controller.ts`, `bouts.controller.spec.ts`: giữ cả `getFeasibility` (T-029) lẫn `getReport`, `getResultPrefill` (T-010 lượt 2).
- `bouts.service.ts` (`loadWeightTrack`): giữ bản T-029 (`computeBoutWeightTrack`); phần quanh đó đã là bản T-029.

## Lệnh đã chạy lại

Trên `b9638eb` (nền cũ):

```text
nestjs-api lint  : không có lỗi (chỉ cảnh báo có sẵn)
nestjs-api build : $ nest build — qua
nestjs-api test  : Test Files  6 failed | 52 passed (58)
                        Tests  26 failed | 885 passed (911)   (26 = baseline B1)
src/bouts        : 236 passed (236)
nextjs-frontend typecheck : ✓ Types generated successfully
nextjs-frontend test      : Tests  667 passed | 2 skipped (669)
eslint src       : không có lỗi
```

Sau khi merge `fight-camp` (`bab3a2c`): build qua; `src/bouts` 258/258; typecheck qua; frontend 669 qua.

## Đối chiếu tiêu chí

| Tiêu chí | Kết quả | Ghi chú |
| --- | --- | --- |
| 1–3 (hàm thuần) | Đạt (theo test) | `bouts.model.spec.ts`, `bouts-todo.model.spec.ts` qua |
| 4–5 | Đạt | `weightReminder` trong `GET /bouts/:id`; `GET /bouts/feasibility` chỉ đọc, `createBout` trả `warnings` mà vẫn lưu |
| 6 | Đạt một phần | Nguồn từ T-007 (R28, S3) chưa có vì T-007 chưa làm; thẻ vẫn trả kết quả, không lỗi, đúng tiêu chí |
| 7 | Đạt | `WEIGH_IN_TODAY`, `RESULT_OVERDUE` |

## Vấn đề

| # | Mức | Vị trí | Vấn đề | Xử lý |
| --- | --- | --- | --- | --- |
| 1 | Nên sửa | Contract `weight.status` | Đổi tên 4 giá trị (`GREEN/YELLOW/RED/GREY` → `ON_TRACK/ABOVE_TARGET/OVER_LIMIT/NOT_WEIGHED`) và thêm `NEUTRAL`. Mọi chỗ đọc trên `fight-camp` đã được sửa trong nhánh (Claude dò lại sau merge), nhưng là thay đổi contract đã merge | Báo Hoàng Anh, Fon trước khi họ làm T-006 B/C, T-010 B |
| 2 | Nên sửa | Quy trình | Làm trên `User_Feature` kèm merge `main`, không theo nhánh ticket | Từ nay Ken làm trên `feat/T-xxx-…` tạo từ `fight-camp` |
| 3 | Gợi ý | Thẻ việc, R27 | Trả rỗng vì lúc đó chưa có R24; T-010 lượt 2 đã có `safety` | Nối khi làm T-007 |
| 4 | Gợi ý | Chưa thử API mode | Handover chưa chạy với Supabase thật | Thử khi tổng duyệt |

## Việc tiếp theo

- Merge `feat/T-029-coach-todo` vào `fight-camp` (`--no-ff`). Không có migration.
- T-007: nối nguồn R28, S3 vào thẻ việc và R31 vào `GET /readiness`.
