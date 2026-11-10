# T-064 Review

- Ngày: 10/11/2026.
- Người review: Claude (lead) tự kiểm. Ngay trước commit có thêm một lượt review độc lập do subagent không mang ngữ cảnh thực hiện.
- Ticket: [T-064](./T-064-coach-dashboard-fighter-visual.md). Handover: [T-064-HANDOVER.md](./T-064-HANDOVER.md).
- Nhánh: `User_Feature`.
- Code: subagent Claude, 1 lượt. `agy` hết quota (429), nên áp dụng quy định khẩn 31/10.

## Kết luận

**APPROVED.** Review độc lập không tìm thấy lỗi chặn hay lỗi nên sửa.

## Lệnh đã chạy lại

| Lệnh | Kết quả |
| --- | --- |
| `pnpm --filter nextjs-frontend lint` / `typecheck` | exit 0 / exit 0 |
| `pnpm --filter nextjs-frontend test` | 1258 test qua, 2 bỏ qua (trước ticket: 1251) |
| `git diff -- nextjs-frontend/src/app/globals.css` | Rỗng |
| `impeccable detect --json "src/app/(app)/coach/dashboard"` | `[]` |

## Tự kiểm và review độc lập

- Đủ các ca H1–H7 và K1. Ở lần chạy trước khi code, các ca lỗi vì module `coach-hero` chưa tồn tại, không phải lỗi riêng ở từng assertion.
- Hero dùng lại `bg-hero-bg`, `cage-hatch`, `chamfer-*`, `CornerTag`, `ReadinessCell` và `ReadinessNumber`. Không có màu thô, mã hex hay CSS mới.

Các gợi ý reviewer đưa ra, chưa xử lý (đề xuất làm ở một lượt sau):

1. Võ sĩ lỡ buổi cân, ví dụ `FIGHT_WEEK`, ngày cân là hôm qua, trận diễn ra hôm nay. Hero vẫn hiện "0 · hôm nay cân", trong khi đúng ra phải báo là chưa ghi cân chính thức (`coach-hero.tsx:36,62-64`).
2. Khi dịch vụ trận hoặc đình chỉ lỗi, hero hiện "Chưa có trận nào" và các số bằng 0, trông giống trạng thái trống. Ticket chủ đích làm vậy, nhưng nên hiện câu báo không tải được.

## Kiểm bằng trình duyệt

Chưa kiểm. Bố cục ở 375px được suy từ class: hero một cột, các số xếp thành lưới 2×2.
