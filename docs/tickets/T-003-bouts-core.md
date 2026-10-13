# T-003 · Bộ luật giải, trận, checklist hồ sơ, Cổng 1, theo dõi cân (migration 024)

| | |
| --- | --- |
| **Trạng thái** | READY khi T-002 đã merge (migration 024 phụ thuộc 023) |
| **Phần** | Backend (`nestjs-api`) |
| **Nhánh** | `feat/T-003-bouts-core` từ `fight-camp` (sau khi T-002 đã merge) |
| **Ước lượng** | 2–2,5 ngày |
| **Tài liệu dẫn chiếu** | [Luồng nghiệp vụ §1–4 (F1, F2, F3, F4, F8)](../FIGHT-CAMP-BUSINESS-FLOWS.md), [Tech spec §2, §3, §4, §5, §7](../FIGHT-CAMP-TECH-SPEC.md) |

## Bối cảnh

Đây là lõi của Fight Camp: HLV tạo một **trận** cho võ sĩ, chọn bộ luật (preset) hoặc tự nhập; app theo dõi cân và checklist hồ sơ; **Cổng 1** chặn trận vào tuần thi đấu khi hồ sơ chưa đủ. Kết quả trận và đình chỉ thuộc T-006 và T-007, không làm ở đây.

## Phạm vi

### 1. Migration `024_bouts.sql`

Theo [Tech spec §2.1–2.4](../FIGHT-CAMP-TECH-SPEC.md#2-mô-hình-dữ-liệu), với các điểm chốt sau:

- **Enum:** `bout_status`, `bout_sport`, `bout_result`, `bout_method`, `bout_requirement_status`. Tạo cả `bout_result`, `bout_method` ngay bây giờ vì bảng `bouts` có cột kết quả; T-006 chỉ dùng, không thêm migration.
- **`competition_rulesets`:** đúng các cột ở §2.2, gồm `suspension_rules jsonb` và `default_blocked_session_types` (T-007 dùng). Seed **ba preset** như §2.2: "MMA – VMMAF 2021" (`verified = true`, hạng cân là cận trên 44, 48, 52, 56, 60, 65, 70, 77, 84, 93, 120 kg cộng hạng "trên 120"; `requirement_templates` rỗng; `suspension_rules` rỗng; chặn `SPARRING`, `GRAPPLING`), "Boxing nghiệp dư – AIBA (tham khảo)" (`verified = false`, hạng 48, 51, 54, 57, 60, 63.5, 67, 71, 75, 81, 91 và trên 91; quy tắc đình chỉ như §2.2; chặn mọi loại trừ `RECOVERY`, `PHYSICAL_THERAPY`), "Tự nhập" (mọi danh sách rỗng, `verified = false`). `source_note` ghi nguồn như [Nghiên cứu §2, §5](../FIGHT-CAMP-DOMAIN-RESEARCH.md).
- **`bouts`:** đúng §2.3, gồm `requirements_due_days` (snapshot, HLV sửa được) và các cột kết quả (để NULL). Ràng buộc: `weigh_in_at < bout_at`; `cancel_reason` khác NULL khi và chỉ khi `CANCELLED`; `result`, `method` khác NULL khi và chỉ khi `COMPLETED`; unique index một trận đang chạy mỗi võ sĩ (`CAMP`, `FIGHT_WEEK`, `WEIGHED_IN`). Trigger `update_updated_at`, audit, và `fighter_id` bất biến (`mma_private.reject_context_change('fighter_id')`, có từ migration 011).
- **`bout_requirements`:** đúng §2.4 (cột `source` thay cho file đính kèm). Trigger audit.
- **Quyền:** `ruleset:read` (COACH, DOCTOR, ADMIN); `bout:get_all`, `bout:read` (FIGHTER, COACH, DOCTOR, ADMIN); `bout:create`, `bout:update`, `bout:result`, `bout:requirement` (COACH, ADMIN). Quyền `ruleset:manage` và `bout:requirement_confirm` **không làm** trong đợt này.
- RLS, revoke, preflight (ledger đã có 23, chưa có 24), advisory lock, ledger version 24; đủ các file đi kèm như T-002 (migration-files, manifest, run_sql, package.json, test-migrations, README migrations). Drizzle schema khớp migration.

### 2. Module `bouts` (`src/bouts/`)

Endpoint (khuôn như [Tech spec §4](../FIGHT-CAMP-TECH-SPEC.md#4-api)), chỉ những dòng sau:

| Method | Path | Quyền | Việc |
| --- | --- | --- | --- |
| GET | `/competition-rulesets` | `ruleset:read` | Danh sách ruleset chưa xoá |
| GET | `/bouts` | `bout:get_all` | Lọc `fighterId`, `status` (lặp được); sắp theo `weighInAt` tăng dần; phân trang cursor |
| POST | `/bouts` | `bout:create` | Tạo trận (F1); sinh checklist từ `requirement_templates` của ruleset (`source = PRESET`) |
| GET | `/bouts/:id` | `bout:read` | Trận + requirements + các giá trị tính ở §3 (`daysToWeighIn`, `requirementsDueOn`, `gate1`, `canEnterFightWeek`, `weight`) |
| PATCH | `/bouts/:id` | `bout:update` | Sửa tên giải, địa điểm, đối thủ, ghi chú; đổi `weighInAt`, `boutAt`, hạng cân, `requirementsDueDays` khi trạng thái là `SCHEDULED`, `CAMP` hoặc `FIGHT_WEEK` (F8) |
| POST | `/bouts/:id/camp` | `bout:update` | Body `{ trainingPlanId }`: gắn plan có sẵn và chuyển `SCHEDULED → CAMP`. Plan phải của cùng võ sĩ, chưa xoá, phase `fight_camp` |
| POST | `/bouts/:id/fight-week` | `bout:update` | `CAMP → FIGHT_WEEK` khi `canEnterFightWeek`; nếu không, 409 `BOUT_REQUIREMENTS_INCOMPLETE` kèm danh sách mục thiếu hoặc hết hạn, hoặc 409 `BOUT_FIGHT_WEEK_TOO_EARLY` |
| POST | `/bouts/:id/cancel` | `bout:update` | Body `{ reason }`; mọi trạng thái trừ `COMPLETED`, `CANCELLED` |
| POST | `/bouts/:id/requirements` | `bout:requirement` | HLV thêm mục (`source = COACH`): `code`, `label`, `required`, `validityDays?` |
| PATCH | `/bouts/:id/requirements/:code` | `bout:requirement` | Đổi `status` (`MISSING`, `PROVIDED`, `REJECTED`), `issuedOn`, `validUntil`, `label`, `required`, `statusReason`. `PROVIDED` bắt buộc có `validUntil`; `REJECTED` bắt buộc có `statusReason` |
| DELETE | `/bouts/:id/requirements/:code` | `bout:requirement` | Bỏ mục (xoá thật; audit ghi lại) |
| GET | `/bouts/:id/weight-track` | `bout:read` | Số cân trong camp + đường tham chiếu + trạng thái (§3 dưới đây) |

Quy tắc:

- **Phạm vi:** COACH chỉ võ sĩ đang được phân công; FIGHTER chỉ đọc trận của mình; DOCTOR đọc võ sĩ được phân công; ADMIN tất cả. Dùng logic giống `TrainingAccessService.assertFighterAccess` (`src/training/training-access.service.ts`) nhưng **không import `TrainingModule`**, vì T-007 sẽ cho training import bouts. Viết truy vấn tương đương trong `bouts.repo.ts`.
- **Tạo trận:** `coach_id` lấy từ hồ sơ coach của người tạo; ADMIN tạo thì phải truyền `coachId`. Hạng cân: với preset có danh sách thì chọn `weightClassCode` có trong danh sách; với "Tự nhập" thì truyền `weightLimitKg` (30–200). `weight_limit_kg`, `requirements_due_days`, `acute_loss_limit_pct` là **snapshot** lúc tạo; `acute_loss_limit_pct` = `acute_loss_limit_pct_long` nếu `boutAt − weighInAt ≥ 12 giờ`, ngược lại `acute_loss_limit_pct_short`. Đổi ngày ở PATCH thì tính lại.
- **Chuyển trạng thái:** chỉ theo bảng ở [Luồng nghiệp vụ §3](../FIGHT-CAMP-BUSINESS-FLOWS.md#3-trạng-thái-trận) cho các bước trong ticket này; sai trạng thái trả 409 `BOUT_INVALID_TRANSITION`. Mỗi lần chuyển ghi một phần tử vào `history` (`{ at, by, from, to, reason? }`).
- **Ngày học viện:** múi giờ `Asia/Ho_Chi_Minh` (UTC+7, không đổi giờ mùa hè). Viết hàm thuần trong `bouts.model.ts`; không thêm thư viện.
- **Cổng 1** (F4): đạt khi mọi mục `required` ở `PROVIDED` hoặc `CONFIRMED` và `validUntil ≥` ngày học viện của `boutAt`. `canEnterFightWeek` = trạng thái `CAMP` + hôm nay ≥ ngày cân − `fight_week_days` + Cổng 1 đạt.

### 3. Theo dõi cân

- **Nguồn dữ liệu:** `fighter_measurements` của võ sĩ, từ ngày bắt đầu camp (thời điểm chuyển sang `CAMP`; trận còn `SCHEDULED` thì từ ngày tạo trận) đến hiện tại. Bỏ các bản đã bị supersede. Nhiều bản trong một ngày học viện thì lấy bản mới nhất. **Không** thêm endpoint ghi cân: võ sĩ dùng `POST /fighters/:id/measurements` có sẵn (context `SELF_REPORTED`).
- **Thuật toán:** đúng [Tech spec §5](../FIGHT-CAMP-TECH-SPEC.md#5-cảnh-báo-cân-nặng), hàm thuần trong `bouts.model.ts`, `tolKg = 1.0`, `A = acute_window_days` của ruleset. Trả `{ latestKg, latestOn, remainingPct, status: 'GREEN' | 'YELLOW' | 'RED' | 'GREY', referencePath: [{ date, kg }] }`. Chưa có số cân nào: `status = 'GREY'`, các trường số là `null`.
- Thông báo khi chuyển đỏ **không làm** (đã cắt).

## Ngoài phạm vi

Frontend; cân chính thức, kết quả, đình chỉ (T-006, T-007); tự sinh camp từ template; thông báo; quyền xác nhận của bác sĩ; sửa module training hay fighters.

## Tiêu chí nghiệm thu

Hàm thuần (`bouts.model.spec.ts`):

1. Cảnh báo cân: giới hạn 60 kg, L = 8, A = 7, còn 2 ngày, W = 66 → `RED`; W = 64,5 → `GREEN`; không có số cân trong 3 ngày → `GREY`; còn 20 ngày, W cao hơn đường tham chiếu 1,5 kg → `YELLOW`.
2. Snapshot ngưỡng: cân trước thi đấu 24 giờ → 8; 6 giờ → 5; đúng 12 giờ → 8.
3. Ngày học viện: 2026-10-20T17:30:00Z là ngày 2026-10-21 tại Việt Nam.
4. Cổng 1: thiếu một mục `required` → không đạt, liệt kê đúng mục đó; mục `PROVIDED` có `validUntil` trước ngày thi → không đạt; mục không `required` còn `MISSING` → vẫn đạt.
5. Bảng chuyển trạng thái: mọi cặp hợp lệ trong ticket này qua; `COMPLETED → CANCELLED` và `CANCELLED → CAMP` bị từ chối.

Service và API (`bouts.service.spec.ts`):

6. Tạo trận với `weighInAt ≥ boutAt` → 422.
7. Coach tạo trận cho võ sĩ không được phân công → 403.
8. Tạo trận với preset có 0 mục hồ sơ → checklist rỗng; HLV thêm 3 mục → `source = COACH`.
9. Võ sĩ đã có một trận ở `CAMP`, chuyển trận thứ hai sang `CAMP` → 409 `BOUT_ACTIVE_EXISTS`.
10. `fight-week` khi còn mục thiếu → 409 `BOUT_REQUIREMENTS_INCOMPLETE`, trạng thái không đổi.
11. Gắn plan của võ sĩ khác, hoặc plan phase khác `fight_camp` → 422.
12. FIGHTER đọc trận của võ sĩ khác → 403.

Migration:

13. `test:db`: 024 áp được sau 023; có đúng 3 preset; vi phạm `weigh_in_at < bout_at` bị từ chối; trận thứ hai đang chạy của cùng võ sĩ bị từ chối; áp lại 024 bị từ chối.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nestjs-api lint
pnpm --filter nestjs-api build
pnpm --filter nestjs-api test
pnpm --filter nestjs-api test:db
pnpm --filter nestjs-api db:check
```
