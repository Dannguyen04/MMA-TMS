# Ticket Fight Camp

Quy trình, quyền hạn và mẫu handover: [TEAM-WORKFLOW.md](../TEAM-WORKFLOW.md). Kế hoạch sprint: [Phạm vi – Kế hoạch](../SCOPE-FIGHT-CAMP.md#kế-hoạch-triển-khai).

Trạng thái: **DRAFT** (Claude đang viết) → **READY** (Gemini được nhận) → **IN REVIEW** (đã có handover) → **CHANGES REQUESTED** / **APPROVED** → **DONE** (đã merge vào `fight-camp`).

## Trước khi bắt đầu (chủ dự án làm một lần)

1. Không còn bắt buộc: Claude giao việc cho Gemini trong git worktree riêng (mục "Cách giao việc" trong [TEAM-WORKFLOW.md](../TEAM-WORKFLOW.md)), nên phần code goals đang dở trong thư mục chính không bị ảnh hưởng.
2. Nhánh tích hợp `fight-camp` đã được tạo sẵn (từ `docs/fight-camp-scope`). Gemini tạo nhánh ticket từ đây.
3. Kiểm tra máy có PostgreSQL 18 tại `C:/Program Files/PostgreSQL/18/bin` để chạy `test:db` (đường dẫn mặc định trong `nestjs-api/scripts/test-migrations.mjs`).

## Người nhận

Từ 14/10, mỗi ticket giao cho một dev hoặc cho Gemini ([Phạm vi, quyết định 18](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi)); ticket có nhiều phần thì mỗi phần một người. Team (chủ dự án chốt 22/10): **Dan** (chủ dự án, backend; ký hiệu cũ BE1), **Ken** (backend; BE2), **Hoàng Anh** (frontend, màn HLV trên máy tính; FE), **Fon** (mobile, làm web cho điện thoại: màn võ sĩ và góc đài; MW). Dan còn merge, push và áp migration, nên khối lượng của Dan không vượt Ken.

Dev cần nhánh `fight-camp` trên remote để tạo nhánh ticket (xem [TEAM-WORKFLOW §3a](../TEAM-WORKFLOW.md#3a-cách-giao-việc)).

## Sprint 1 (14/10 – 19/10), demo ở review 2 ngày 20/10

| Ticket | Nội dung | Phần | Người nhận | Phụ thuộc | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| [T-001](./T-001-hide-frozen-navigation.md) | Ẩn các khu vực đóng băng khỏi menu | Frontend | Gemini | — | DONE (13/10, [review](./T-001-REVIEW.md)) |
| [T-002](./T-002-no-doctor-mode.md) | Chế độ không có bác sĩ (migration 023) | Backend | Gemini | — | DONE (14/10, [review](./T-002-REVIEW.md)). Chờ chủ dự án áp migration 023 lên Supabase |
| [T-003](./T-003-bouts-core.md) | Bộ luật giải, trận, checklist hồ sơ, Cổng 1, theo dõi cân; cấp quyền ghi cân cho võ sĩ (migration 024) | Backend | Dan | T-002 đã merge; code và merge được ngay | DONE (merge 21/10, [review](./T-003-REVIEW.md)). Migration 024 đã áp lên Supabase 22/10. T-026 phải merge `fight-camp` mới vào nhánh của mình trước khi merge |
| [T-004](./T-004-coach-bouts-ui.md) | Màn trận cho HLV: danh sách, tạo, chi tiết, checklist | Frontend | Gemini | Contract của T-003 | DONE (merge cùng T-005, T-013; [review](./T-004-REVIEW.md)) |
| [T-005](./T-005-weigh-in-and-weight-chart.md) | Màn ghi cân và trang trận của võ sĩ trên điện thoại (phần A); biểu đồ cân, cảnh báo trên chi tiết trận và dashboard HLV (phần B) | Frontend | A: Fon. B: Hoàng Anh | Bắt đầu ngay; tích hợp sau khi T-004 merge | DONE ([review](./T-005-REVIEW.md)) |
| [T-008a](./T-008a-review2-demo-data.md) | Script dữ liệu demo cho review 2 qua API (phần A); chạy T-004, T-005 ở API mode với backend thật (phần B) | Backend + Frontend | A: Ken. B: Hoàng Anh | Viết ngay; chạy thật sau khi T-002, T-003 merge và chủ dự án áp migration 023, 024 | READY. Chạy xong trước tối 19/10 |

Demo ở review 2 chạy với **backend thật** trên Supabase hiện có ([quyết định 14](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi)). Nếu T-003 chưa merge trước hết ngày 17/10, chủ dự án quyết định có dùng phương án dự phòng (demo mode) hay không.

## Sprint 2 (21/10 – 30/10), demo cuối ngày 31/10

| Ticket | Nội dung | Phần | Người nhận | Phụ thuộc | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| T-011 | Đồng bộ `fight-camp` với `main`: merge `main` vào `fight-camp`, giải xung đột `navigation.ts` (T-001 với PR #22); đưa bản sửa storage `39c00f1` lên `main` qua PR | Frontend + hạ tầng | Hoàng Anh | Sau review 2 | DRAFT. Làm 22/10 |
| [T-006](./T-006-weigh-in-and-result.md) | Tuần thi đấu, cân chính thức, ghi kết quả (nghiệp vụ 7, 8, 10; R17–R19, R26; gồm H2–H6 và vấn đề 1, 2 của [review T-003](./T-003-REVIEW.md)). Phần A không có migration; điền sẵn từ hiệp (R25) chuyển sang T-010 | Backend + Frontend + điện thoại | A (backend): Dan. B (màn HLV: tuần thi đấu, form kết quả): Hoàng Anh. C (màn cân chính thức trên điện thoại): Fon | T-003 | Phần A: DONE (merge 22/10, [review](./T-006-REVIEW.md)). Phần B, C chưa có ticket |
| T-007 | Đình chỉ tự áp dụng, Cổng 2 trong training, xử lý lịch xung đột, cho tập lại, trạng thái võ sĩ, bảng sẵn sàng R32, cảnh báo khi tạo trận R4 (migration 025; nghiệp vụ 11–13, 15) | Backend + Frontend + điện thoại | A: Ken. B (tab Đình chỉ, tab Sẵn sàng, xử lý lịch): Hoàng Anh. C (võ sĩ xem trạng thái đình chỉ): Fon | T-003. Đình chỉ thủ công và Cổng 2 làm ngay; nối vào kết quả trận sau khi T-006 A merge | DRAFT, Claude viết 22/10. Backend merge trước 25/10 |
| T-009 | Kế hoạch ăn theo giai đoạn, một chạm "ăn theo kế hoạch?", chấm màu trên biểu đồ (migration 026; [E1](../FIGHT-CAMP-BUSINESS-FLOWS.md#e1-ăn-uống-đi-cùng-kiểm-soát-cân), [Tech spec §2.7](../FIGHT-CAMP-TECH-SPEC.md#27-kế-hoạch-ăn-và-câu-trả-lời-ăn-uống-migration-026)) | Backend + điện thoại | A: Ken. B: Fon | T-003, T-005 | DRAFT. Backend 26/10 |
| [T-010](./T-010-opponent-analysis-and-rounds.md) | Phân tích đối thủ, thẻ góc đài (xem và in), ghi theo hiệp, báo cáo trận (migration 027, gồm `scheduled_rounds` và bảng ghi theo hiệp; nghiệp vụ 6, 9, 14; [E2](../FIGHT-CAMP-BUSINESS-FLOWS.md#e2-giáo-án-phân-tích-đối-thủ), [Tech spec §2.8](../FIGHT-CAMP-TECH-SPEC.md#28-phân-tích-đối-thủ-migration-027)) | Backend + điện thoại | A: Dan. B (tab Đối thủ, thẻ góc đài, màn ghi hiệp, báo cáo): Fon | T-003, T-004 | Phần A giai đoạn 1 (mục 1–5): Codex xong, [APPROVED](./T-010-REVIEW.md), đã merge 22/10; migration 027 đã áp lên Supabase 22/10. Mục 6–7 (lượt 2, Codex): [APPROVED](./T-010-REVIEW.md#lượt-2-mục-67) 24/10, chờ chủ dự án merge, không có migration mới. Phần B chưa có ticket |
| T-029 | Thẻ Việc cần làm của HLV; kiểm tra khả thi về cân khi tạo trận (R31) | Backend + Frontend | A: Ken. B: Hoàng Anh | T-006, T-007 | Chưa viết. Làm 27–28/10 |
| T-012 | Demo AI ngắn: chạy worker hiện có trên một video có sẵn, kịch bản trình bày ([quyết định 16](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi)) | Worker | Dan | Sau T-006 | DRAFT. Làm 28–29/10 |
| T-008 | Dữ liệu demo theo giai đoạn: 5 võ sĩ giả, mỗi người đứng ở một giai đoạn (bổ sung T-008a); chủ dự án áp migration 025–027 | Backend | Ken | T-007, T-009, T-010 | DRAFT. Làm 28–29/10 |
| [T-022](./T-022-punch-detector-recall.md) | Tăng recall của detector đấm trong worker; đo trên dữ liệu công khai BoxingVI, giữ riêng tập test ([quyết định 20](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi)) | Worker | Gemini | — (nên xong trước 26/10 để T-012 biết dùng detector nào) | READY (20/10) |
| [T-026](./T-026-session-templates.md) | Mẫu giáo án (buổi tập) trong form tạo buổi tập `/coach/sessions/new` ([quyết định 21](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi)); chủ dự án thêm phần backend (migration 028, 029, đã áp lên Supabase 20/10) | Backend + Frontend | Hoàng Anh | Phối hợp với T-015 (cùng sửa `session-form.tsx`) | Đã có handover trên `feat/T-026-session-templates-ui`. Chờ merge `fight-camp` mới vào nhánh (xung đột với T-003 ở 7 file), rồi review |
| [T-027](./T-027-backend-request-latency.md) | Giảm độ trễ mỗi request có xác thực ở backend: bỏ gọi Supabase Auth mỗi request, cache user và quyền, gọn `/users/me`, cấu hình pool; không migration | Backend | Gemini | — | DONE (merge 20/10; chưa đo trước/sau) |
| [T-028](./T-028-frontend-navigation-latency.md) | Giảm độ trễ chuyển tab và chuyển trang: bỏ gate `getFighter`, gộp lệnh trùng, cache ngắn, `staleTimes`, streaming, làm mới thông báo gọn | Frontend | Gemini | — (độc lập với T-027) | DONE (merge 20/10; chưa đo trước/sau; còn mục D, F, G) |

Số migration 025, 026, 027 cố định; mỗi migration chỉ yêu cầu ledger đã có 024 ([Tech spec §8](../FIGHT-CAMP-TECH-SPEC.md#8-migration)), nên ticket nào xong trước cũng merge được mà giữ đúng số của mình. Tổng duyệt demo ngày 30/10.

Nếu đến 27/10 chưa xong, đề xuất cắt theo thứ tự (chờ chủ dự án duyệt): (1) các ý "nếu còn thời gian" ở [Luồng nghiệp vụ, Bổ sung 21/10](../FIGHT-CAMP-BUSINESS-FLOWS.md#bổ-sung-2110-chờ-duyệt), giao Gemini nếu có thời gian; (2) gợi ý từ trận trước (R4b, R30); (3) ghi hiệp trực tiếp, chỉ giữ thẻ góc đài và ghi lại sau trận; (4) chấm màu ăn uống trên biểu đồ. Luôn giữ: hai cổng, cân chính thức, kết quả, đình chỉ, thẻ góc đài.

## Giao diện tiếng Việt ([T-013](./T-013-i18n-vi.md))

Quyết định của chủ dự án 19/10: dịch toàn bộ app, làm dần, mặc định tiếng Việt. T-013 phần 1 và 2 đã merge vào `fight-camp` (20/10). Phần 3 chia thành các ticket dưới đây; chạy song song được vì mỗi ticket có cặp file từ điển riêng. Route đóng băng không dịch. Chủ dự án chốt 20/10: dịch toàn bộ, kể cả route đóng băng (T-022 đến T-024). Landing page ở T-020; `src/app/concept/` đã là tiếng Việt.

| Ticket | Nội dung | Phụ thuộc | Trạng thái |
| --- | --- | --- | --- |
| [T-014](./T-014-i18n-auth-account.md) | Đăng nhập, đăng ký, applicant, tài khoản, thông báo; rà soát Today của võ sĩ | — | DONE (merge 20/10) |
| [T-015](./T-015-i18n-training.md) | Training của võ sĩ và HLV; đổi `clearance-rules.ts` sang trả mã | — | READY |
| [T-016](./T-016-i18n-health-clearance.md) | Health và Medical Clearance của võ sĩ, HLV | Dùng chung `clearance-rules.ts` với T-015 | READY |
| [T-017](./T-017-i18n-doctor.md) | Khu vực bác sĩ | T-016 | READY |
| [T-018](./T-018-i18n-film-video.md) | Film và phân tích video AI | — | READY |
| [T-019](./T-019-i18n-admin.md) | Admin (các mục còn trong menu) | — | READY, ưu tiên thấp nhất |
| [T-020](./T-020-i18n-landing.md) | Landing page (`/`). `src/app/concept/` đã là tiếng Việt, không cần dịch | — | DONE (merge 20/10; slogan chờ chủ dự án duyệt) |
| [T-021](./T-021-i18n-e2e.md) | E2E: đặt cookie `mma_locale=en` cho spec hiện có, thêm spec đổi ngôn ngữ | Nên làm trước hoặc cùng T-014 | READY |
| [T-022](./T-022-i18n-performance-goals.md) | Performance và Goals (đóng băng, dịch theo quyết định "toàn bộ" 20/10) | — | READY, ưu tiên thấp |
| [T-023](./T-023-i18n-frozen-clinical.md) | Hồ sơ y tế, khám, hồi phục, cảnh báo AI của bác sĩ (đóng băng) | T-017 | READY, ưu tiên thấp |
| [T-024](./T-024-i18n-frozen-admissions-models.md) | Admissions (HLV, admin) và AI models (đóng băng) | T-014, T-019 | READY, ưu tiên thấp |
| [T-025](./T-025-i18n-final-sweep.md) | Rà soát cuối, bắt buộc `locale`, test chống chữ Anh quay lại, cập nhật tài liệu quy ước | Mọi ticket T-014 đến T-024 | READY, làm cuối |

Thứ tự ưu tiên: T-021 và T-014, T-015, T-016, T-020, T-018, T-017, T-019, rồi T-022 đến T-024, T-025 cuối cùng.
