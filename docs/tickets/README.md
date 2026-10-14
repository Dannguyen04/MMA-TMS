# Ticket Fight Camp

Quy trình, quyền hạn và mẫu handover: [TEAM-WORKFLOW.md](../TEAM-WORKFLOW.md). Kế hoạch sprint: [Phạm vi – Kế hoạch](../SCOPE-FIGHT-CAMP.md#kế-hoạch-triển-khai).

Trạng thái: **DRAFT** (Claude đang viết) → **READY** (Gemini được nhận) → **IN REVIEW** (đã có handover) → **CHANGES REQUESTED** / **APPROVED** → **DONE** (đã merge vào `fight-camp`).

## Trước khi bắt đầu (chủ dự án làm một lần)

1. Không còn bắt buộc: Claude giao việc cho Gemini trong git worktree riêng (mục "Cách giao việc" trong [TEAM-WORKFLOW.md](../TEAM-WORKFLOW.md)), nên phần code goals đang dở trong thư mục chính không bị ảnh hưởng.
2. Nhánh tích hợp `fight-camp` đã được tạo sẵn (từ `docs/fight-camp-scope`). Gemini tạo nhánh ticket từ đây.
3. Kiểm tra máy có PostgreSQL 18 tại `C:/Program Files/PostgreSQL/18/bin` để chạy `test:db` (đường dẫn mặc định trong `nestjs-api/scripts/test-migrations.mjs`).

## Người nhận

Từ 14/10, mỗi ticket giao cho một dev hoặc cho Gemini ([Phạm vi, quyết định 18](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi)). Cột "Người nhận" dưới đây là **đề xuất**; chủ dự án thay bằng tên người thật. BE1, BE2: hai dev backend; FE: dev frontend; MW: dev mobile, chuyển sang làm web cho điện thoại.

Dev cần nhánh `fight-camp` trên remote để tạo nhánh ticket (xem [TEAM-WORKFLOW §3a](../TEAM-WORKFLOW.md#3a-cách-giao-việc)).

## Sprint 1 (14/10 – 19/10), demo ở review 2 ngày 20/10

| Ticket | Nội dung | Phần | Người nhận | Phụ thuộc | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| [T-001](./T-001-hide-frozen-navigation.md) | Ẩn các khu vực đóng băng khỏi menu | Frontend | Gemini | — | DONE (13/10, [review](./T-001-REVIEW.md)) |
| [T-002](./T-002-no-doctor-mode.md) | Chế độ không có bác sĩ (migration 023) | Backend | Gemini | — | CHANGES REQUESTED (lượt 1) |
| [T-003](./T-003-bouts-core.md) | Bộ luật giải, trận, checklist hồ sơ, Cổng 1, theo dõi cân; cấp quyền ghi cân cho võ sĩ (migration 024) | Backend | BE1 | Code được ngay; merge sau T-002 | READY (bổ sung 14/10: quyền ghi cân, `points` và `limitKg` trong `weight-track`, ngày bắt đầu camp). **Phải merge trước hết ngày 17/10** |
| [T-004](./T-004-coach-bouts-ui.md) | Màn trận cho HLV: danh sách, tạo, chi tiết, checklist | Frontend | Gemini (đang làm) | Contract của T-003 | IN PROGRESS |
| [T-005](./T-005-weigh-in-and-weight-chart.md) | Màn ghi cân và trang trận của võ sĩ trên điện thoại (phần A); biểu đồ cân, cảnh báo trên chi tiết trận và dashboard HLV (phần B) | Frontend | A: MW. B: FE | Bắt đầu ngay; tích hợp sau khi T-004 merge | READY. Merge trước hết ngày 18/10 |
| [T-008a](./T-008a-review2-demo-data.md) | Script dữ liệu demo cho review 2 qua API (phần A); chạy T-004, T-005 ở API mode với backend thật (phần B) | Backend + Frontend | A: BE2. B: FE | Viết ngay; chạy thật sau khi T-002, T-003 merge và chủ dự án áp migration 023, 024 | READY. Chạy xong trước tối 19/10 |

Demo ở review 2 chạy với **backend thật** trên Supabase hiện có ([quyết định 14](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi)). Nếu T-003 chưa merge trước hết ngày 18/10, chủ dự án quyết định có dùng phương án dự phòng (demo mode) hay không.

## Sprint 2 (21/10 – 30/10), demo cuối ngày 31/10

| Ticket | Nội dung | Phần | Người nhận | Phụ thuộc | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| T-011 | Đồng bộ `fight-camp` với `main`: merge `main` vào `fight-camp`, giải xung đột `navigation.ts` (T-001 với PR #22); đưa bản sửa storage `39c00f1` lên `main` qua PR | Frontend + hạ tầng | FE | Sau review 2 | DRAFT. Làm ngày 21/10 |
| T-006 | Tuần thi đấu, cân chính thức, kết quả trận (gồm H2–H6) | Backend + Frontend | BE1, FE | T-003, T-004 | DRAFT |
| T-007 | Đình chỉ và Cổng 2 trong training (migration 025) | Backend + Frontend | BE2, FE | T-006 (tạo đình chỉ từ kết quả); đình chỉ thủ công và Cổng 2 làm song song được | DRAFT |
| T-009 | Kế hoạch ăn theo giai đoạn, một chạm "ăn theo kế hoạch?", chấm màu trên biểu đồ (migration 026; [E1](../FIGHT-CAMP-BUSINESS-FLOWS.md#e1-ăn-uống-đi-cùng-kiểm-soát-cân), [Tech spec §2.7](../FIGHT-CAMP-TECH-SPEC.md#27-kế-hoạch-ăn-và-câu-trả-lời-ăn-uống-migration-026)) | Backend + Frontend | Gemini (backend), MW (frontend) | T-003, T-005 | DRAFT |
| T-010 | Phân tích đối thủ: tab "Đối thủ", nối chiến thuật với buổi tập, đánh giá sau trận (migration 027; [E2](../FIGHT-CAMP-BUSINESS-FLOWS.md#e2-giáo-án-phân-tích-đối-thủ), [Tech spec §2.8](../FIGHT-CAMP-TECH-SPEC.md#28-phân-tích-đối-thủ-migration-027)) | Backend + Frontend | Gemini | T-003, T-004 | DRAFT |
| T-012 | Demo AI ngắn: chạy worker hiện có trên một video có sẵn, kịch bản trình bày ([quyết định 16](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi)) | Worker | BE1 | Sau T-006 | DRAFT. Làm 27–29/10 |
| T-008 | Dữ liệu demo cho kịch bản 3, 4 (bổ sung T-008a); chủ dự án áp migration 025–027 | Backend | BE2 | T-007, T-009, T-010 | DRAFT |

Số migration 025, 026, 027 cố định; mỗi migration chỉ yêu cầu ledger đã có 024 ([Tech spec §8](../FIGHT-CAMP-TECH-SPEC.md#8-migration)), nên ticket nào xong trước cũng merge được mà giữ đúng số của mình. Nếu đến 27/10 chưa xong thì cắt theo thứ tự ở [Luồng nghiệp vụ §8](../FIGHT-CAMP-BUSINESS-FLOWS.md#lịch-làm-và-thứ-tự-cắt-khi-trễ). Tổng duyệt demo ngày 30/10.
