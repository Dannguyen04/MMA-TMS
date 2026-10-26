# T-002 · Chế độ không có bác sĩ (migration 023)

| | |
| --- | --- |
| **Trạng thái** | READY |
| **Phần** | Backend (`nestjs-api`) |
| **Nhánh** | `feat/T-002-no-doctor-mode` từ `fight-camp` |
| **Ước lượng** | 1–1,5 ngày |
| **Tài liệu dẫn chiếu** | [Luồng nghiệp vụ §7](../FIGHT-CAMP-BUSINESS-FLOWS.md#7-chế-độ-không-có-bác-sĩ), [Tech spec §6a](../FIGHT-CAMP-TECH-SPEC.md#6a-chế-độ-không-có-bác-sĩ) |

## Bối cảnh

Hiện tại một buổi tập chỉ chuyển sang `IN_PROGRESS` khi võ sĩ đủ điều kiện y tế TRAINING (`evaluateEligibility` trong `src/medical/medical.service.ts`, dòng 133). Điều kiện này đòi hỏi bác sĩ: khám BASELINE, kết luận khám TRAINING và clearance; ngoài ra một yêu cầu khám đang mở cũng chặn tập. Chỉ buổi `IN_PROGRESS` mới thành `COMPLETED` được (`src/training/training.constants.ts`, dòng 23–24). Vì vậy CLB không có bác sĩ không ghi được buổi tập nào.

Chủ dự án đã quyết định (11/10): thêm chế độ **không có bác sĩ** cho toàn học viện, tắt các yêu cầu cần bác sĩ. Kết luận mà bác sĩ đã ghi từ trước vẫn được áp dụng.

## Phạm vi

### 1. Migration `023_academy_settings.sql`

- `CREATE TYPE public.medical_supervision AS ENUM ('DOCTOR', 'NONE')`.
- Bảng một dòng `public.academy_settings`: `id boolean PRIMARY KEY DEFAULT true CHECK (id)`, `medical_supervision public.medical_supervision NOT NULL DEFAULT 'DOCTOR'`, `change_reason text`, `updated_by_id uuid REFERENCES public.users(id)`, `updated_at timestamptz NOT NULL DEFAULT now()`. Insert sẵn một dòng mặc định.
- Trigger: `public.update_updated_at()` (có từ migration 001) và `mma_private.audit_domain_mutation()` (có từ migration 011). Xem cách migration 011 gắn trigger audit.
- `ENABLE ROW LEVEL SECURITY` và `REVOKE ALL … FROM anon, authenticated`, như các bảng khác.
- Quyền: `academy_settings:read` cho FIGHTER, COACH, DOCTOR, ADMIN; `academy_settings:manage` cho ADMIN. Seed vào `public.permissions` và `public.role_permissions` theo cách migration 020 làm. Preflight, advisory lock, RLS và ghi ledger cũng theo 020.
- **Ledger:** trên nhánh `fight-camp`, 021 và 022 không có (module goals để sau đợt đồ án). Preflight của 023 yêu cầu ledger **đã có version 20** và **chưa có version 23**; không yêu cầu 21, 22. Ghi `migration_history` version 23.
- Thêm 023 vào: `scripts/migration-files.mjs`, `migrations/manifest.json` (checksum), `run_sql.mjs` (`--apply-023`), script `db:migrate:023` trong `package.json`, ca kiểm thử trong `scripts/test-migrations.mjs`, mục mô tả trong `migrations/README.md`.
- Thêm bảng và enum vào `src/database/schema.ts` (Drizzle), khớp với migration.

### 2. Module `academy-settings`

Tạo `src/academy-settings/` theo quy ước trong [nestjs-api/AGENTS.md](../../nestjs-api/AGENTS.md). Module mẫu `src/goals/` không có trên `fight-camp`; xem bằng `git show wip/goals:nestjs-api/src/goals/goals.controller.ts` (sau khi chủ dự án tạo nhánh `wip/goals`), hoặc dùng `src/fighters/` làm mẫu:

| Endpoint | Quyền | Mô tả |
| --- | --- | --- |
| `GET /academy-settings` | `academy_settings:read` | Trả `{ medicalSupervision, changeReason, updatedAt }` |
| `PATCH /academy-settings` | `academy_settings:manage` | Body `{ medicalSupervision: 'DOCTOR' \| 'NONE', changeReason: string }`, `changeReason` bắt buộc, 3–500 ký tự. Ghi `updated_by_id` là người gọi; set audit context |

- Repository export một hàm đọc dùng được trong transaction của nơi khác, ví dụ `getMedicalSupervision(database?: DatabaseExecutor): Promise<'DOCTOR' | 'NONE'>`. Không có dòng nào thì trả `'DOCTOR'`.
- Module export service hoặc repo để `MedicalModule` dùng được.

### 3. Sửa `src/medical/`

1. `EligibilityState` (dòng 90): thêm `supervision: 'DOCTOR' | 'NONE'`.
2. `evaluateEligibility` (dòng 133). Khi `supervision === 'NONE'` **và** `scope === 'TRAINING'`:
    - Không thêm lý do `EXAMINATION_REQUIRED` hay `REVIEW_REQUEST_PENDING`.
    - Không có kết luận khám (`!exam`): trả `eligible: true`, `reasons: []`.
    - Có kết luận khám: chạy các quy tắc hiện có (`EXAMINATION_NOT_ELIGIBLE`, `CLEARANCE_REQUIRED`, `CLEARANCE_EXPIRED`, `SESSION_TYPE_RESTRICTED`) như cũ.
    - Scope `COMPETITION` và `supervision === 'DOCTOR'`: **không đổi hành vi**.
3. Kết quả `MedicalEligibility` thêm trường `supervision`; cập nhật `medicalEligibilitySchema` (đang là `z.strictObject`, `src/medical/medical.model.ts` dòng 583).
4. `eligibilityFrom` (dòng 531) nhận thêm `supervision`. `getDossier` và `evaluateTrainingEligibility` đọc setting và truyền vào; `evaluateTrainingEligibility` đọc **trong transaction** đang có.
5. `createReviewRequest` (dòng 596): khi `NONE` trả 409, mã `MEDICAL_SUPERVISION_DISABLED`. Thêm hàm lỗi vào `src/medical/medical.error.ts`, mục `// --- 409 ---`, theo kiểu các hàm `conflict(...)` có sẵn.
6. `DoctorAssignmentReminder.remind` (`src/medical/doctor-assignment-reminder.service.ts`): khi `NONE` không gửi và trả `{ status: 'skipped', reason: 'SUPERVISION_DISABLED' }`. Thêm `'SUPERVISION_DISABLED'` vào union lý do `skipped` của `NotifyResult` (`src/shared/contracts/notification.contract.ts`, dòng 91), rồi kiểm tra mọi nơi `switch` hay so sánh trên lý do này.

## Ngoài phạm vi

- Frontend: không sửa. `nextjs-frontend/src/lib/services/medical.api.ts` dùng `z.object` cho eligibility nên trường mới không làm vỡ parse; ghi xác nhận này vào handover.
- Không làm endpoint đánh giá tác động khi đổi chế độ, không làm màn Admin (đã cắt khỏi đợt đồ án).
- Không sửa luồng training ngoài những gì đi qua `evaluateTrainingEligibility`.
- Không chạy `db:migrate:023` lên database thật.

## Tiêu chí nghiệm thu

Unit test cho `evaluateEligibility` (hàm thuần):

1. `NONE`, TRAINING, không baseline, không kết luận, không yêu cầu khám → `eligible: true`, `reasons: []`, `supervision: 'NONE'`.
2. `NONE`, TRAINING, có yêu cầu khám đang mở, không kết luận → `eligible: true`.
3. `NONE`, TRAINING, kết luận `NOT_ELIGIBLE` → `eligible: false`, `reasons` chứa `EXAMINATION_NOT_ELIGIBLE`.
4. `NONE`, TRAINING, kết luận `ELIGIBLE` kèm clearance có `allowedSessionTypes = ['PAD_WORK']`, `sessionType = 'SPARRING'` → `SESSION_TYPE_RESTRICTED`.
5. `NONE`, COMPETITION, không kết luận → giống hệt kết quả hiện tại (`CLEARANCE_REQUIRED`).
6. `DOCTOR`: mọi ca test hiện có của `evaluateEligibility` vẫn qua, kết quả có thêm `supervision: 'DOCTOR'`.

Service và API:

7. `createReviewRequest` khi `NONE` → 409 `MEDICAL_SUPERVISION_DISABLED`, không ghi dữ liệu.
8. `remind` khi `NONE` → không gọi publisher, trả `skipped` / `SUPERVISION_DISABLED`.
9. `PATCH /academy-settings` thiếu `changeReason` → 422; người gọi không phải Admin → 403; Admin hợp lệ → 200 và giá trị mới đọc lại được qua `GET`.

Migration:

10. `test:db` có ca cho 023: áp được trên ledger version 20; áp lại lần hai bị từ chối; bảng có đúng một dòng `DOCTOR`; insert dòng thứ hai bị từ chối.
11. `db:check` qua với checksum mới.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nestjs-api lint
pnpm --filter nestjs-api build
pnpm --filter nestjs-api test
pnpm --filter nestjs-api test:db
pnpm --filter nestjs-api db:check
```

## Câu hỏi đã biết trước

Nếu `test-migrations.mjs` giả định danh sách migration liên tục (không bỏ trống 021–022), ghi vào handover cách đã xử lý, hoặc dừng và hỏi trước khi sửa logic chung của script.
