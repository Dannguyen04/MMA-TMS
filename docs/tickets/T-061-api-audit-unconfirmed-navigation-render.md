# T-061 Xác minh điều hướng và render chưa kết luận trong ma trận API mode

- Trạng thái: DRAFT. Ngày: 08/11/2026. Người nhận: chưa giao.
- Phạm vi: kiểm chứng các quan sát chưa tái hiện độc lập. Chưa kết luận là lỗi sản phẩm.

## Bằng chứng

- `/admin/fighters/[fighterId]` trả HTTP 200 trong ma trận production, bộ đo không thấy tiêu đề và ghi lỗi console. Chưa xác minh nội dung thực tế bằng lượt độc lập.
- `/fighter` và `/doctor` ghi lỗi điều hướng trong runner sau HTTP 200. Source của hai trang gọi redirect về dashboard tương ứng.
- `/lab` chỉ dành cho dev theo source, loại khỏi tiêu chí giao diện production.

## Tái hiện và kỳ vọng

1. Với Quản trị, đi từ liên kết hồ sơ võ sĩ hợp lệ và kiểm tra nội dung, tiêu đề và console.
2. Với Võ sĩ và Bác sĩ, mở tuyến gốc và đợi URL ổn định. Kỳ vọng chuyển tới dashboard đúng role.
3. Thử lại mỗi trường hợp ngoài runner hàng loạt, ở phiên mới.

## Tiêu chí nghiệm thu

- Ghi rõ quan sát nào là lỗi sản phẩm, quan sát nào do runner hoặc do màn hình nằm ngoài production.
- Nếu tái hiện lỗi sản phẩm, đính kèm status, URL đã che và lỗi console đã lọc. Không ghi thông tin người dùng hoặc token.

## Điều tra 9/11

Kết luận: ba quan sát là hành vi đúng của redirect sau khi đã stream, không phải lỗi sản phẩm. Chưa chạy lại trong API mode. Đã kiểm tra bằng Playwright headless trên server demo (cổng 3000), ở phiên mới cho từng role.

**`/fighter` và `/doctor`**

- `src/app/(app)/fighter/page.tsx` và `src/app/(app)/doctor/page.tsx` chỉ gọi `redirect(routes.fighter.dashboard)` và `redirect(routes.doctor.dashboard)`, không đọc dữ liệu nào.
- Vì `src/app/(app)/loading.tsx` làm trang stream trước khi redirect chạy, Next.js đã chốt HTTP 200 và redirect diễn ra ở trình duyệt (`node_modules/next/dist/docs/01-app/02-guides/streaming.md`, mục Status codes). Runner thấy 200 rồi một lần điều hướng, nên ghi "lỗi điều hướng". Đây là lỗi của runner, không phải của sản phẩm.
- Kiểm tra demo: `/fighter` trả 200 rồi về `/fighter/dashboard` có h1; `/doctor` trả 200 rồi về `/doctor/dashboard` có h1; 0 lỗi console.

**`/admin/fighters/[fighterId]`**

- Đây không phải trang nội dung. Trang đổi hồ sơ võ sĩ sang tài khoản rồi redirect tới `/admin/users/:userId#care-team`, nên tài liệu ban đầu không có tiêu đề là đúng thiết kế. Trang đích hiển thị `PageHeader` (h1).
- Kiểm tra demo: `/admin/fighters/f-minh-tran` trả 200, chuyển tới `/admin/users/u-minh-tran`, có h1, 0 lỗi console.
- Trong API mode, trang gọi `getFighter`, tức `/fighters/:id` cùng số đo, HLV và bác sĩ. Trước đây lỗi 5xx ở ba GET phụ làm trang hiện khung lỗi. Nay chỉ `/fighters/:id` là bắt buộc (sửa trong `src/lib/services/people.ts`, xem T-058).

**`/lab`**: chỉ dùng cho dev, không thay đổi.

**File đã sửa cho ticket này**: không có, ngoài `people.ts` đã nêu ở T-058.

**Cần kiểm tra trong API mode với tài khoản thật**

1. Ở phiên mới ngoài runner, mở `/fighter` (Võ sĩ) và `/doctor` (Bác sĩ), đợi URL ổn định ở dashboard.
2. Với Quản trị, mở hồ sơ võ sĩ từ liên kết trong thông báo. URL phải dừng ở `/admin/users/:userId` có tiêu đề. Ghi lỗi console sau khi URL đã ổn định.
3. Nếu muốn runner nhận HTTP 307 thật, có thể thêm redirect cố định `/fighter` → `/fighter/dashboard` và `/doctor` → `/doctor/dashboard` trong `next.config.ts`. Hai redirect này không phụ thuộc role. Chưa làm vì ngoài phạm vi.

