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
| [T-003](./T-003-bouts-core.md) | Bộ luật giải, trận, checklist hồ sơ, Cổng 1, theo dõi cân (migration 024) | Backend | T-002 | Chờ T-002 merge |
| [T-004](./T-004-coach-bouts-ui.md) | Màn trận cho HLV: danh sách, tạo, chi tiết, checklist (demo trước) | Frontend | Contract của T-003 | IN PROGRESS |
| T-005 | Màn ghi cân cho võ sĩ, biểu đồ, cảnh báo | Frontend | T-004 (dùng chung kiểu và mocks) | DRAFT |
| T-008a | Dữ liệu demo cho review 1 (kịch bản 1, 2) dựng qua API; chuyển chế độ `NONE` bằng `PATCH /academy-settings`; đối chiếu adapter API của T-004, T-005 với backend | Backend + Frontend | T-002, T-003, T-004, T-005 | DRAFT |

T-001 và T-002 làm song song được. Demo ở cả hai buổi review chạy với **backend thật**, không dùng demo mode ([Phạm vi, quyết định 14](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi)), nên T-003 phải merge và T-004, T-005 phải chạy được ở API mode trước khoảng 22/10.

## Sprint 2 (24/10 – 29/10), demo ở review 2

| Ticket | Nội dung | Phần | Phụ thuộc | Trạng thái |
| --- | --- | --- | --- | --- |
| T-006 | Tuần thi đấu, cân chính thức, kết quả trận | Backend + Frontend | T-003, T-004 | DRAFT |
| T-007 | Đình chỉ và Cổng 2 trong training (migration 025) | Backend + Frontend | T-006 | DRAFT |
| T-008 | Dữ liệu demo cho kịch bản 3, 4 (bổ sung T-008a) | Backend | T-007 | DRAFT |
| T-009 | Kế hoạch ăn theo giai đoạn, một chạm "ăn theo kế hoạch?" trên màn ghi cân, chấm màu trên biểu đồ (migration 026; [Luồng nghiệp vụ E1](../FIGHT-CAMP-BUSINESS-FLOWS.md#e1-ăn-uống-đi-cùng-kiểm-soát-cân), [Tech spec §2.7](../FIGHT-CAMP-TECH-SPEC.md#27-kế-hoạch-ăn-và-câu-trả-lời-ăn-uống-migration-026)) | Backend + Frontend | T-003, T-005; migration sau 025 | DRAFT |
| T-010 | Phân tích đối thủ: tab "Đối thủ", nối chiến thuật với buổi tập, đánh giá sau trận (migration 027; [Luồng nghiệp vụ E2](../FIGHT-CAMP-BUSINESS-FLOWS.md#e2-giáo-án-phân-tích-đối-thủ), [Tech spec §2.8](../FIGHT-CAMP-TECH-SPEC.md#28-phân-tích-đối-thủ-migration-027)) | Backend + Frontend | T-003, T-004; migration sau 026 | DRAFT |

T-009 và T-010 làm song song với T-006, T-007 trong worktree riêng. Số migration 025, 026, 027 cố định theo thứ tự trên; ticket nào xong trước vẫn giữ đúng số của mình. Nếu đến 27/10 chưa xong thì cắt theo thứ tự ở [Luồng nghiệp vụ §8](../FIGHT-CAMP-BUSINESS-FLOWS.md#lịch-làm-và-thứ-tự-cắt-khi-trễ).
