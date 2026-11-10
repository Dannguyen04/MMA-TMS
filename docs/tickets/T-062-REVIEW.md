# T-062 Review

- Ngày: 10/11/2026.
- Người review: Claude (lead) tự kiểm. Ngay trước commit có thêm một lượt review độc lập do subagent không mang ngữ cảnh thực hiện.
- Ticket: [T-062](./T-062-coach-dashboard-fight-camp.md). Handover: [T-062-HANDOVER.md](./T-062-HANDOVER.md).
- Nhánh: `User_Feature`.
- Code: `agy` `gemini-4-argon-high`, 1 lượt. Lượt này hết quota đúng lúc đang chạy kiểm tra cuối, nên Claude chạy lại các lệnh.
- Lịch sử: bản T-062 đầu tiên làm trên `feat/website-platform` theo style "Bản tin buổi tập" của commit `40ec9fb`. Chủ dự án bỏ bản đó vì không theo design cũ. Bản này làm lại trên `User_Feature` và giữ đúng style cũ.

## Kết luận

**APPROVED.** Review độc lập không tìm thấy lỗi chặn hay lỗi nên sửa về hành vi.

## Lệnh đã chạy lại

| Lệnh | Kết quả |
| --- | --- |
| `pnpm --filter nextjs-frontend lint` / `typecheck` | exit 0 / exit 0 |
| `pnpm --filter nextjs-frontend test` | 1251 test qua, 2 bỏ qua (sau T-064: 1258 qua) |
| `git diff -- nextjs-frontend/src/app/globals.css` | Rỗng |
| `impeccable detect` trên dashboard và `today-schedule.tsx` | `[]` |

## Review độc lập

Reviewer kiểm từng tiêu chí nghiệm thu và từng ca S1–S10, R1–R11, T1, P1, K1 trên code. Ca nào cũng có đủ, đúng đầu vào và kết quả mong đợi, không có ca nào bị mock tới mức qua bất kể code.

Các gợi ý reviewer đưa ra, chưa xử lý:

- Khi API có trên 500 đình chỉ, `listSuspensions` ném `PAGINATION_LIMIT_EXCEEDED`. Lỗi này bị `nullIfServiceFails` nuốt, nên các dòng đình chỉ biến mất mà không có thông báo. Sửa sau nếu cần: lọc `active` ở backend.
- `listWeightAlerts` và các key `coachBouts.dashboard.weightAlerts*`, `coachToday.newPlan` không còn nơi nào dùng. Để dành cho một ticket dọn dẹp.
- Tiêu chí 2 ghi "không còn gọi `listCampBouts`". T-064 gọi lại hàm này, có bọc `nullIfServiceFails`, cho hero. Điều này thay thế tiêu chí 2, không phải lỗi.

## Kiểm bằng trình duyệt

Chưa kiểm, theo quy định không mở trình duyệt từ 04/11. Hành vi được kiểm bằng render tĩnh và seed demo.
