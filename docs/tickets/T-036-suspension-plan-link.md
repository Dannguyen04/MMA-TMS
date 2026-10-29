# T-036 · Đình chỉ tác động tới kế hoạch tập: buổi đã xếp chờ xếp lại hoặc huỷ ngay, camp chuyển sang hồi phục

| | |
| --- | --- |
| **Trạng thái** | Phần A: READY (29/10). Phần B: DRAFT |
| **Phần** | A: backend (`nestjs-api`), có migration 032. B: frontend |
| **Người nhận** | A: Ken (làm qua `agy`). B: Hoàng Anh |
| **Nhánh** | A: `feat/T-036-suspension-plan-link`, tạo từ `fix/T-035-suspension-gate` (cần mặc định chặn mới của T-035) |
| **Nguồn** | [Nhận xét review 27/10](../REVIEW-27-10-FEEDBACK.md) mục 1; bản nháp ở [T-036A mục 5](./T-036A-suspension-training-plan-link.md#5-phần-2-draft-chưa-code-gắn-đình-chỉ-vào-giáo-án) (L2, L3) |
| **Quyết định của chủ dự án (29/10)** | (1) Đình chỉ có buổi tập trong khoảng thời gian đó thì buổi chuyển sang **chờ** hoặc **huỷ**. (2) Chuyện khôi phục pha: Claude tự quyết. (3) Cường độ và tập lại theo bậc: Claude nghiên cứu và tự quyết, tách sang [T-045](./T-045-intensity-tiers-graded-return.md) vì lớn. (4) Phần nhỏ gộp, phần lớn tách: L2 (nhỏ) và L3 (vừa) gộp vào ticket này |
| **Lệnh kiểm tra** | `pnpm --filter nestjs-api lint`, `build`, `test`, `test:db`, `db:check` (không thêm lỗi so với [BASELINE](./BASELINE.md)) |

## 1. Bối cảnh

Hiện tại (sau T-007, T-035), tạo đình chỉ chỉ **chặn buổi mới**. Buổi đã xếp từ trước vẫn nằm `SCHEDULED` trên lịch; HLV phải tự mở `GET /suspensions/:id/conflicts` rồi `POST /suspensions/:id/conflicts/apply` (R28, `src/training/training-suspension-conflicts.controller.ts:53`, `:79`), và đề xuất của R28 (`planConflicts`, `src/suspensions/suspensions.model.ts:188`) là đổi sang `RECOVERY`, dời ngày, hoặc huỷ. Kế hoạch tập (`training_plans.phase`) không đổi: võ sĩ bị KO giữa camp vẫn mang giáo án `fight_camp`.

Cả hai đường tạo đình chỉ đều đi qua `SuspensionsRepository.insertSuspension` (`src/suspensions/suspensions.repo.ts:418`) trong một transaction:
- Đình chỉ thủ công: `SuspensionsService.createSuspension` (`src/suspensions/suspensions.service.ts:69`, transaction ở dòng 104).
- Đình chỉ từ kết quả trận: `BoutsService.applyResultSuspensions` (`src/bouts/bouts.service.ts:1573`, insert ở dòng 1627), chạy trong transaction ghi kết quả.

`SuspensionsModule` cố ý chỉ import `DatabaseModule` (`src/suspensions/suspensions.module.ts:9-13`) vì `BoutsModule` và `TrainingModule` đều import nó. Code ở `src/suspensions/` **không được** import gì từ `src/training/` hay `src/bouts/`.

## 2. Thiết kế (Claude quyết, theo quyết định 29/10)

### 2.1 Trạng thái buổi mới `PENDING` (chờ xếp lại)

- Migration **032** thêm giá trị `PENDING` vào enum `public.session_status` (hiện: `SCHEDULED`, `IN_PROGRESS`, `COMPLETED`, `SKIPPED`, `CANCELLED`, `ABANDONED`; `src/database/schema.ts:145`). Cập nhật `sessionStatusEnum` trong `schema.ts`.
- Chuyển trạng thái (`ALLOWED_SESSION_TRANSITIONS`, `src/training/training.constants.ts:20`): thêm `PENDING: ['SCHEDULED', 'CANCELLED']`. `PENDING` không phải trạng thái kết thúc (không thêm vào `TERMINAL_SESSION_STATUSES`).
- `PENDING → SCHEDULED` chỉ xảy ra khi HLV **xếp lại**: `PATCH` buổi với `scheduledAt` mới (`applySessionUpdateInTransaction`, `src/training/sessions/training-session.service.ts:162`). Buổi đang `PENDING` mà nhận `scheduledAt` mới thì qua Cổng 2 tại ngày mới như hiện có, qua được thì chuyển về `SCHEDULED` trong cùng câu `UPDATE`. Đổi trạng thái `PENDING → SCHEDULED` qua endpoint đổi trạng thái mà không đổi ngày thì trả lỗi chuyển trạng thái có sẵn (`invalidSessionStatusTransition`). `PENDING → CANCELLED` qua endpoint đổi trạng thái như `SCHEDULED → CANCELLED` (bắt buộc lý do).
- Buổi `PENDING` không bắt đầu được (`IN_PROGRESS` không nằm trong danh sách của `PENDING`).

### 2.2 Xử lý ngay buổi đã xếp khi tạo đình chỉ (L2)

Quy tắc mới của `planConflicts`, thay cho đổi loại, dời ngày, huỷ:

| Buổi `SCHEDULED` có ngày nằm trong khoảng đình chỉ và loại bị chặn | Hành động |
| --- | --- |
| Có ít nhất một đình chỉ chặn buổi đó mà `requiresClearance = true` (ngày tập lại chưa chắc) | `CANCEL`, lý do `SUSPENSION_CONFLICT_CANCELLATION_REASON` (`'Suspension in force'`, `training.constants.ts:54`) |
| Còn lại (đình chỉ có ngày hết cố định) | `PENDING`: giữ nguyên ngày cũ để HLV thấy buổi gốc, chờ HLV xếp lại sau ngày hết đình chỉ |

- `CONFLICT_ACTIONS` (`suspensions.model.ts:67`) thành `['PENDING', 'CANCEL']`. Bỏ `CHANGE_TYPE`, `RESCHEDULE` và trường `toType`, `toDate` liên quan. Endpoint `GET .../conflicts` và `POST .../conflicts/apply` giữ nguyên đường dẫn và quyền, chỉ đổi tập hành động.
- **Tự áp dụng trong cùng transaction tạo đình chỉ**, ở cả hai đường (thủ công và từ kết quả trận). Không cần HLV bấm. Endpoint `apply` vẫn giữ để áp lại cho buổi xếp sau (ví dụ buổi tạo trước khi T-035 đóng đường vòng).
- Cách nối không phá hướng phụ thuộc: trong `src/suspensions/` thêm provider `SuspensionEffects` (file `suspension.effects.ts`, export từ `SuspensionsModule`) với hai phương thức:
  - `register(handler: (suspensions: SuspensionRow[], tx: Transaction) => Promise<SuspensionEffectResult>)`: chỉ cho đăng ký **một** handler; đăng ký lần hai thì ném lỗi lập trình.
  - `runOnCreated(suspensions, tx)`: gọi handler nếu có, không có thì trả kết quả rỗng.
  - `TrainingSuspensionConflictsService` (`src/training/training-suspension-conflicts.service.ts`) đăng ký handler trong `onModuleInit`. Handler: tải buổi của võ sĩ và các đình chỉ có hiệu lực (dùng `tx`), chạy `planConflicts`, áp từng hành động qua `TrainingSessionService` trong `tx` (huỷ: `applySessionCancelInTransaction` có sẵn; chờ: một phương thức mới cùng kiểu, khoá dòng trước khi đổi), rồi đổi pha giáo án (mục 2.3).
  - `SuspensionsService.createSuspension` và `BoutsService.applyResultSuspensions` gọi `suspensionEffects.runOnCreated([...các đình chỉ vừa tạo], tx)` ngay sau khi insert.
- Response (thêm trường, không bỏ trường nào):
  - `POST /suspensions`: thêm `affectedSessions: { sessionId, action: 'PENDING' | 'CANCEL' }[]` và `affectedPlans: { planId, fromPhase, toPhase }[]`.
  - Ghi kết quả trận: mỗi đình chỉ trong response mang hai trường như trên.
  - Cập nhật DTO Swagger tương ứng (lưu ý T-032: không dùng `Date` trong JSON Schema).
- Thông báo: **không thêm loại thông báo mới**. Buổi bị huỷ gửi thông báo huỷ có sẵn (`TRAINING_SESSION_CANCELLED`) sau khi commit, giống `applyConflicts` đang làm. Buổi chuyển `PENDING` không gửi thông báo riêng; thông báo `SUSPENSION_CREATED` có sẵn đã báo cho võ sĩ.

### 2.3 Camp chuyển sang hồi phục (L3)

- Khi đình chỉ có `reason` thuộc `KO`, `TKO`, `MEDICAL` được tạo, mọi `training_plans` của võ sĩ có `status = 'ACTIVE'`, `deleted_at IS NULL` và `phase` thuộc `fight_camp`, `taper` chuyển `phase` sang `rehab` (enum `training_plan_phase`, `schema.ts:137`), cùng transaction.
- `MANDATORY_REST`, `DQ`, `OTHER` không đổi pha: nghỉ bắt buộc sau trận hay bị truất quyền không phải chấn thương.
- **Không tự khôi phục pha** khi hết đình chỉ (Claude quyết 29/10). Lý do: khi hết đình chỉ, camp cũ thường đã qua ngày thi hoặc trận đã huỷ, nên quay về `fight_camp` một cách máy móc dễ sai hơn là để HLV chọn; khôi phục còn cần thêm cột lưu pha cũ. Pha cũ trả về trong `affectedPlans.fromPhase` của response để frontend hiện cho HLV. `training_plans` hiện không có trigger audit (đã kiểm migration 003, 005, 018), nên ticket này không hứa lưu pha cũ ở nơi khác.

## 3. Ngoài phạm vi

- Chặn theo cường độ, tập lại theo bậc: [T-045](./T-045-intensity-tiers-graded-return.md).
- Thẻ "Việc cần làm" cho buổi `PENDING` (nguồn R28 của T-029): ghi vào handover nếu thấy nguồn R28 hiện tại đếm sai sau thay đổi, không sửa.
- Frontend: Phần B.
- Sửa đình chỉ hay buổi đã có trên Supabase.

## 4. File cần sửa (Phần A)

| File | Thay đổi |
| --- | --- |
| `nestjs-api/migrations/032_session_status_pending.sql` (mới) | `ALTER TYPE public.session_status ADD VALUE IF NOT EXISTS 'PENDING'`, theo quy ước [migrations/README.md](../../nestjs-api/migrations/README.md): preflight ledger (đã có 024, chưa có 032), advisory lock `(20260916, 32)`, ghi `migration_history` version 32. Không yêu cầu 025–031 |
| `nestjs-api/migrations/manifest.json`, `nestjs-api/scripts/migration-files.mjs`, `nestjs-api/package.json` (`db:migrate:032`), `nestjs-api/run_sql.mjs` (`--apply-032`, theo mẫu dòng 27), `nestjs-api/migrations/README.md` (mục mô tả) | Đăng ký migration như các bản trước |
| `nestjs-api/scripts/test-migrations.mjs` | Ca cho 032: chạy được trên ledger có 024; enum có `PENDING`; chạy lại bị preflight chặn |
| `nestjs-api/src/database/schema.ts` | `sessionStatusEnum` thêm `PENDING` |
| `nestjs-api/src/training/training.constants.ts` | `ALLOWED_SESSION_TRANSITIONS` thêm `PENDING` |
| `nestjs-api/src/training/sessions/training-session.service.ts` | Phương thức chuyển `PENDING` trong transaction; `PENDING` + `scheduledAt` mới → `SCHEDULED` |
| `nestjs-api/src/suspensions/suspensions.model.ts` | `CONFLICT_ACTIONS`, `planConflicts`, schema Zod của `apply` |
| `nestjs-api/src/suspensions/suspension.effects.ts` (mới), `suspensions.module.ts` | Provider `SuspensionEffects` |
| `nestjs-api/src/suspensions/suspensions.service.ts`, `src/bouts/bouts.service.ts` | Gọi `runOnCreated` sau insert; trả `affectedSessions`, `affectedPlans` |
| `nestjs-api/src/training/training-suspension-conflicts.service.ts` | Đăng ký handler; áp `PENDING`/`CANCEL`; đổi pha giáo án |
| `nestjs-api/src/training/training.repo.ts` | Hàm đổi `phase` của plan `ACTIVE` theo võ sĩ trong `tx` (dùng `trainingPlans`, `training.repo.ts:20`) |
| DTO Swagger của suspensions và bouts | Thêm `affectedSessions`, `affectedPlans` |
| Các file `*.spec.ts` tương ứng | Test (mục 5) |

## 5. Tiêu chí nghiệm thu (Phần A)

1. Đình chỉ thủ công `reason: 'OTHER'`, 7 ngày, `requiresClearance = false`: buổi `SPARRING` đã xếp vào ngày thứ 3 chuyển `PENDING`, giữ nguyên `scheduledAt`; response có `affectedSessions` chứa buổi đó với `action: 'PENDING'`.
2. Đình chỉ `KO` (`requiresClearance = true`): buổi bị chặn trong khoảng chuyển `CANCELLED` với lý do `'Suspension in force'`; có thông báo huỷ sau commit.
3. Buổi loại không bị chặn (`RECOVERY`, `PHYSICAL_THERAPY` với mặc định T-035), buổi ngoài khoảng đình chỉ, buổi đã `COMPLETED`/`IN_PROGRESS`: không đổi.
4. Ghi kết quả trận thua KO tạo đình chỉ: buổi bị chặn được xử lý trong **cùng** transaction; transaction ghi kết quả lỗi thì buổi không đổi (test rollback bằng mock ném lỗi sau `runOnCreated`).
5. Buổi `PENDING`: `PATCH` với `scheduledAt` sau ngày hết đình chỉ → `SCHEDULED`; `scheduledAt` vẫn trong khoảng đình chỉ → 409 `TRAINING_SUSPENSION_ACTIVE`, giữ `PENDING`; đổi trạng thái sang `IN_PROGRESS` → lỗi chuyển trạng thái; sang `CANCELLED` có lý do → được.
6. Đình chỉ `KO`, `TKO`, `MEDICAL`: plan `ACTIVE` pha `fight_camp`/`taper` thành `rehab`, có trong `affectedPlans`. Plan pha `base`, `build`, `maintenance`, plan không `ACTIVE`, và đình chỉ `MANDATORY_REST`/`DQ`/`OTHER`: không đổi.
7. `planConflicts` chỉ trả `PENDING` hoặc `CANCEL`; `POST .../conflicts/apply` với `action: 'CHANGE_TYPE'` trả lỗi validation có sẵn.
8. `SuspensionEffects.register` gọi hai lần thì ném lỗi; `runOnCreated` khi chưa có handler trả rỗng. `src/suspensions/` không import từ `src/training/` hay `src/bouts/` (kiểm bằng `grep`).
9. Migration 032 qua `test:db` và `db:check`; không lệnh nào thêm lỗi so với baseline.

## 6. Phần B (frontend, DRAFT)

Hoàng Anh, sau khi Phần A merge. Gồm: hiện trạng thái "Chờ xếp lại" cho buổi `PENDING` trên lịch HLV và võ sĩ (từ điển i18n vi/en), nút "Xếp lại" mở form đổi ngày; màn xử lý lịch xung đột của [T-030](./T-030-frontend-suspensions-sync.md) phần B chỉ còn hai hành động; sau khi tạo đình chỉ, hiện tóm tắt `affectedSessions`, `affectedPlans`. Viết chi tiết khi Phần A có contract thật.
