# T-055 Review

- Ngày: 04/11/2026. Người review: Claude (lead), cùng một subagent review độc lập không mang ngữ cảnh (1 lượt, gộp với T-054).
- Ticket: [T-055](./T-055-doctor-table-row-link.md). Handover: [T-055-HANDOVER.md](./T-055-HANDOVER.md). Nhánh `User_Feature`, chưa commit.
- Code: `agy` `gemini-3.8-flash-high`, 1 lượt.

## Kết luận

**APPROVED.** Không có vấn đề chặn hay nên sửa.

## Lệnh đã chạy lại (Claude)

| Lệnh | Kết quả |
| --- | --- |
| `eslint src` / `tsc --noEmit` | sạch / sạch |
| `vitest run` | `Tests 1182 passed, 2 skipped`; có L1–L4 |

## Review độc lập

Kết luận: APPROVED.

- **Cách làm "stretched link"** (`doctor.css` khoảng dòng 307–318):
  - hàng có `position: relative` và `cursor: pointer`;
  - `a.yt-rowlink::after` dùng `inset: 0`;
  - viền focus của cả hàng qua `tr:has(a.yt-rowlink:focus-visible)`;
  - `.yt-sublink`, `.yt-btn` và `button` trong bảng nổi lên trên lớp phủ.
- **Đúng một link chính mỗi hàng**, ở cả 5 trang có bảng:
  - fighters, examinations, injuries, review-requests: link chính là `yt-rowlink`;
  - history: link chính là link sự kiện.
  - Ở examinations, injuries và history, link tới võ sĩ chuyển sang `yt-sublink`.
  - Ở review-requests, nút "Khám" vẫn bấm được.
- **Không thấy hồi quy.** Chỉ cổng bác sĩ dùng `.yt-table`.
- **Ticket ghi sai trang `medical-clearance`:** trang này không có `.yt-table`, chỉ có danh sách thẻ. Đã sửa ticket ngày 04/11.

## Kiểm bằng trình duyệt

Ảnh hover và focus của hàng ở `D:/test/ai-worktrees/logs/t055-shots/` (do `agy` chụp). Claude chưa tự bấm thử trên trình duyệt; chủ dự án quyết định không chạy server nữa (04/11).

## Gợi ý chưa làm

1. Trình duyệt không có `:has()` (Firefox trước 121) sẽ không thấy viền focus của hàng, vì viền focus của link đã bị bỏ. Có thể thêm `@supports selector(:has(*))`.
2. Ở `history`, hàng có `e.href` rỗng vẫn hiện con trỏ bàn tay dù không có link.
