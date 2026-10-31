# Backend: hướng dẫn cho người thực hiện

Phân vai và quy trình nằm ở [quy trình team](../docs/TEAM-WORKFLOW.md) (hiệu lực từ 2026-10-13): Gemini viết code và test, Claude lập kế hoạch và review. Các quy định phân vai cũ (Codex, Antigravity, Claude) và tham chiếu tới `.agents/` đã bị thay thế; thư mục `.agents/` không tồn tại trong repo.

## Quy ước backend phải theo

- **Cấu trúc module:** `*.controller.ts`, `*.service.ts`, `*.repo.ts`, `*.model.ts` (Zod schema, hàm thuần), `*.dto.ts`, `*.error.ts`, `*.constants.ts`, `*.module.ts`. Module mẫu: `src/goals/` (trên nhánh `wip/goals`, chưa merge) hoặc `src/fighters/`.
- **Controller:** `@UseGuards(AccessTokenGuard, AuthorizationGuard)`, `@RequirePermissions`, `@UsePipes(appZodValidationPipe)`, envelope `ApiSuccessEnvelope` và các decorator lỗi trong `src/shared/decorators/api-envelope.decorator.ts`.
- **Phạm vi theo bản ghi:** quyền (permission) chưa đủ; service phải kiểm tra phạm vi (coach chỉ võ sĩ đang được phân công, fighter chỉ dữ liệu của mình), như `goals.service.ts` (nhánh `wip/goals`) hoặc `fighters.service.ts`.
- **Ghi dữ liệu:** trong transaction, đặt audit context bằng `setAuditContext` (`src/shared/utils/audit-context.util.ts`).
- **Thông báo:** qua `NOTIFICATION_PUBLISHER` (`src/shared/contracts/notification.contract.ts`), gửi sau khi transaction commit, không làm hỏng thao tác chính khi gửi lỗi.
- **Hàm thuần** (luật nghiệp vụ, tính trạng thái) đặt trong `*.model.ts` và có `*.model.spec.ts`.
- **Migration:** theo [migrations/README.md](migrations/README.md) và mẫu `migrations/020_movement_evidence_reviews.sql` (quyền, RLS, ledger), `migrations/011_medical_clinical_records.sql` (trigger audit). Mỗi migration mới cần: tên trong `scripts/migration-files.mjs`, checksum trong `migrations/manifest.json`, mục `--apply-0xx` trong `run_sql.mjs`, script `db:migrate:0xx` trong `package.json`, ca kiểm thử trong `scripts/test-migrations.mjs`, mục mô tả trong `migrations/README.md`.
- **Đổi contract API:** tìm mọi nơi đọc và ghi (kể cả `nextjs-frontend/src/lib/services/*`) và ghi tác động vào handover.

## Tự review trước khi bàn giao

Đọc lại diff và kiểm tra:

- Điều kiện, chuyển trạng thái, nhánh chưa xử lý, đồng thời (lock), audit.
- Validation, contract response, phân quyền, bảo mật.
- Mọi đường tạo và cập nhật dữ liệu bị ảnh hưởng, mọi nơi dùng contract đã đổi.
- Migration nhất quán với schema Drizzle (`src/database/schema.ts`); truy vấn N+1.
