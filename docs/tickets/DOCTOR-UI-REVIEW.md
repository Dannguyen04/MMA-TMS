# Review: đồng nhất UI khu bác sĩ (9/11)

- **Yêu cầu:** chủ dự án yêu cầu ngày 9/11 rằng các màn bác sĩ phải có UI đồng nhất với phần còn lại của app. Một agent làm, Claude review.
- **Nhánh:** `release/final-review`.
- **Kết luận: APPROVED.**

## Thay đổi

- Các màn bác sĩ bỏ bộ giao diện riêng và dùng component chung của app: PageHeader, Card, Badge (tone + icon + chữ), Callout, EmptyState/ErrorState, bảng chung, TabNav.
- Dashboard dùng khung `workspace-editorial` giống dashboard HLV. Ba làn Đỏ/Vàng/Xanh giữ nguyên thứ tự, giờ hiện bằng tone của app.
- Không còn viền màu đậm một bên ở đâu cả.
- `doctor.css` giảm từ 671 xuống 60 dòng. Phần còn lại chỉ là bản đồ cơ thể 3D và biểu đồ 5 tuần, đọc token chung.
- Thông tin, link, thao tác, quyền và luồng dữ liệu giữ nguyên. Không thêm câu chữ mới.

## Lệnh Claude chạy lại

| Lệnh | Kết quả |
| --- | --- |
| `pnpm lint` | 0 lỗi |
| `APP_DATA_MODE=api pnpm typecheck` | 0 lỗi |
| `vitest run` (toàn bộ) | 1354 qua, 2 skip |
| `ui:smoke --roles doctor --axe` (`vi`, 1440 và 390 px) | 96 trang, 0 lỗi; axe 0 lỗi nghiêm trọng |
| `ui:smoke --theme dark` (agent chạy) | 48 trang, 0 lỗi |

## Vấn đề tìm được khi review (đã sửa)

- `coach/bouts/suspensions/t050-early-end.test.ts` W1, W11 fail khi chạy đủ bộ: trang võ sĩ của bác sĩ giờ dùng `TabNav`, cần `usePathname`, mà mock `next/navigation` trong test thiếu hàm này. Đã thêm vào mock; lỗi không nằm ở app.

## Test đã sửa theo giao diện mới

Bốn file test cũ kiểm theo CSS cũ (viền 4 px, nền `.td-field`, `.yt-table`): `t054-dashboard.test.ts`, `t055-row-link.test.ts`, `status-cards.test.ts`, `t057`. Các test này giờ kiểm điều ngược lại: không có viền một bên, và hàng bảng dùng class link chung.

## Còn mở

- Bản đồ cơ thể 3D trên ảnh chụp headless bị trống. Chưa kiểm xem trước thay đổi này nó có trống không.
