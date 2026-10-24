# T-028 Handover

- Nhánh: perf/T-028-navigation-latency    Commit: xem `git log`
- Trạng thái: IN REVIEW. Người làm: Claude (theo chỉ dẫn trực tiếp của chủ dự án 20/10, vì Gemini hết quota)

## Thay đổi
- `lib/auth/access.ts`: thêm `requireFighterId` (chỉ kiểm tra phạm vi, không đọc hồ sơ). Test mới trong `access.test.ts`.
- Trang võ sĩ `training`, `goals`, `schedule`, `bout`, `performance`: dùng `requireFighterId`; không còn chờ 4 lệnh gọi của `getFighter` trước dữ liệu của trang. `performance` lấy tên từ `user.name` (cùng công thức `firstName lastName` như `Fighter.name`).
- `fighter/health`, `fighter/dashboard`: `requireFighterAccess` chạy trong cùng `Promise.all` với các lệnh khác; dashboard cũng đưa `boutsRead` vào batch, bỏ `await` đứng sau.
- `lib/services/shell.ts`: `getNavBadgeCounts` bọc `cache()` nên `coach/dashboard` dùng chung kết quả của layout.
- `next.config.ts`: `experimental.staleTimes.dynamic = 30`.

## Chưa làm
- Mục A (đo): chưa đo, worktree không có `.env`. Cần đo trên bản production build.
- Mục D (cache dữ liệu ít đổi), F (Suspense), G (làm mới chuông gọn hơn): chưa làm để giữ thay đổi nhỏ, an toàn. `router.refresh()` của chuông còn nguyên.

## Lệnh đã chạy
- `nextjs-frontend typecheck`: qua. `lint`: qua, không lỗi. `test`: 657 qua, 2 skip (baseline 578 qua, 1 skip; nay có thêm test từ các ticket đã merge). `build`: qua.

## Lệch so với ticket
Mục D, F, G và A chưa làm (xem trên). Phần còn lại đúng ticket.

## Câu hỏi / việc còn mở
- `staleTimes` giữ trang tối đa 30 giây sau khi điều hướng; server action có `revalidatePath` thì làm mới. Cần kiểm tra tay: ghi cân nặng rồi quay lại trang bout.
- Trang `health` và `dashboard` khi `requireFighterAccess` gọi `notFound()` còn các lệnh khác đang chạy: chúng tự kết thúc, không ảnh hưởng.
