# Ticket Fight Camp

Quy trình, quyền hạn và mẫu handover: [TEAM-WORKFLOW.md](../TEAM-WORKFLOW.md). Kế hoạch sprint: [Phạm vi – Kế hoạch](../SCOPE-FIGHT-CAMP.md#kế-hoạch-triển-khai).

Trạng thái: **DRAFT** (Claude đang viết) → **READY** (Gemini được nhận) → **IN REVIEW** (đã có handover) → **CHANGES REQUESTED** / **APPROVED** → **DONE** (đã merge vào `fight-camp`).

## Trước khi bắt đầu (chủ dự án làm một lần)

1. Không còn bắt buộc: Claude giao việc cho Gemini trong git worktree riêng (mục "Cách giao việc" trong [TEAM-WORKFLOW.md](../TEAM-WORKFLOW.md)), nên phần code goals đang dở trong thư mục chính không bị ảnh hưởng.
2. Nhánh tích hợp `fight-camp` đã được tạo sẵn (từ `docs/fight-camp-scope`). Gemini tạo nhánh ticket từ đây.
3. Kiểm tra máy có PostgreSQL 18 tại `C:/Program Files/PostgreSQL/18/bin` để chạy `test:db` (đường dẫn mặc định trong `nestjs-api/scripts/test-migrations.mjs`).

## Sprint 1 (14/10 – 22/10), demo ở review 1

| Ticket | Nội dung | Phần | Phụ thuộc | Trạng thái |
| --- | --- | --- | --- | --- |
| [T-001](./T-001-hide-frozen-navigation.md) | Ẩn các khu vực đóng băng khỏi menu | Frontend | — | DONE (13/10, [review](./T-001-REVIEW.md)) |
| [T-002](./T-002-no-doctor-mode.md) | Chế độ không có bác sĩ (migration 023) | Backend | — | IN PROGRESS |
| T-003 | Bộ luật giải, trận, checklist hồ sơ, Cổng 1, theo dõi cân (migration 024) | Backend | T-002 | DRAFT, READY dự kiến 15/10 |
| T-004 | Màn trận cho HLV: danh sách, tạo, chi tiết, checklist | Frontend | T-003 | DRAFT |
| T-005 | Màn ghi cân cho võ sĩ, biểu đồ, cảnh báo | Frontend | T-003 | DRAFT |

T-001 và T-002 làm song song được.

## Sprint 2 (24/10 – 29/10), demo ở review 2

| Ticket | Nội dung | Phần | Phụ thuộc | Trạng thái |
| --- | --- | --- | --- | --- |
| T-006 | Tuần thi đấu, cân chính thức, kết quả trận | Backend + Frontend | T-003, T-004 | DRAFT |
| T-007 | Đình chỉ và Cổng 2 trong training (migration 025) | Backend + Frontend | T-006 | DRAFT |
| T-008 | Dữ liệu demo cho 4 kịch bản | Backend | T-007 | DRAFT |
