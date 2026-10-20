# T-023 · Template plan: backend

| | |
| --- | --- |
| **Trạng thái** | READY (chủ dự án mở lại phạm vi 20/10, [quyết định 21](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi)) |
| **Phần** | Backend (`nestjs-api`), module `src/training/` |
| **Nhánh** | `feat/T-023-plan-templates-backend` từ `fight-camp` mới nhất |
| **Người nhận** | BE2 (đề xuất) |
| **Migration** | Không. Template là hằng số trong code |
| **Mục tiêu hoàn thành** | Merge trước 24/10 để T-024 nối API thật |

## Bối cảnh

HLV tạo plan ở `POST /training-plans` rồi tạo từng buổi ở `POST /training-sessions`: không có cách chọn mẫu. Chủ dự án đã mở lại hạng mục "tạo plan từ template" (trước đó nằm trong danh sách cắt). Ticket này thêm phần backend: danh sách template và một endpoint tạo plan kèm toàn bộ buổi tập trong **một giao dịch**.

Chưa nối vào trận: `POST /bouts/:id/camp` của T-003 sẽ gọi lại hàm dựng buổi ở đây sau, không làm trong ticket này.

## Phạm vi

1. Hằng số template và hàm thuần dựng buổi tập.
2. `GET /training-plans/templates`: trả danh sách template (kèm toàn bộ khe buổi tập để frontend xem trước).
3. `POST /training-plans/from-template`: tạo plan `DRAFT` và các buổi `SCHEDULED` trong một giao dịch.
4. Mã lỗi mới, test.

## Ngoài phạm vi

Migration và bảng mới; lưu plan đã sửa thành template; tự dịch lịch khi đổi ngày thi; thông báo từng buổi (xem "Thiết kế" mục thông báo); gắn vào trận; sửa `training.repo.ts` ngoài việc nhận `database` có sẵn; module goals; cài thư viện.

## File cần sửa (đã kiểm tra là có thật)

| File | Việc |
| --- | --- |
| `nestjs-api/src/training/plans/training-plan.controller.ts` | Thêm hai route. `@Get('templates')` **phải khai báo trước** `@Get(':id')` (dòng 118), nếu không `templates` bị hiểu là `:id` |
| `nestjs-api/src/training/plans/training-plan.service.ts` | Thêm `listTemplates`, `createPlanFromTemplate` (cạnh `createPlan`, dòng 88) |
| `nestjs-api/src/training/training.model.ts` | Zod schema cho request và response (cạnh `createTrainingPlanSchema`, dòng 212) |
| `nestjs-api/src/training/training.dto.ts` | DTO bằng `createZodDto`, theo khuôn các DTO có sẵn |
| `nestjs-api/src/training/training.error.ts` | Hai hàm lỗi, theo khuôn `invalidPlanDateRange` (dòng 131) |
| `nestjs-api/src/training/training.repo.ts` | **Không sửa nếu được.** `createPlan(data, database?)` (dòng 389) và `createSession(data, database?)` (dòng 525) đã nhận `DatabaseExecutor`; `transaction(work)` có ở dòng 176 |
| File mới `nestjs-api/src/training/plans/plan-templates.ts` | Hằng số template và hàm thuần |
| File mới `nestjs-api/src/training/plans/plan-templates.spec.ts` | Test hàm thuần |
| `nestjs-api/src/training/plans/training-plan.service.spec.ts` | Thêm ca cho `createPlanFromTemplate` |

Module mẫu để theo khuôn: chính `src/training/` (controller, service, DTO, `@RequirePermissions`, envelope `ApiSuccessEnvelope`, `requireActor`).

## Thiết kế

### Mô hình template

```ts
type PlanTemplateSlot = {
  weekFromEnd: number;      // 1 = tuần cuối trước ngày thi, 6 = tuần đầu
  dayOffset: number;        // 1..7 trong tuần; 1 = ngày sớm nhất của tuần đó
  sessionType: SessionType; // enum backend: SHADOW_BOXING, PAD_WORK, HEAVY_BAG, SPARRING, GRAPPLING, STRENGTH_CONDITIONING, RECOVERY, PHYSICAL_THERAPY
  title: string;
  plannedDurationMin: number;
  roundCount: number;
  hour: number; minute: number; // giờ địa phương học viện
};
type PlanTemplate = { id: string; name: string; sport: 'MMA' | 'BOXING'; weeks: 6; phase: 'fight_camp'; description: string; slots: PlanTemplateSlot[] };
```

Quy đổi ngày: `daysBeforeEnd = 7 * weekFromEnd - dayOffset + 1`; ngày buổi = `endDate - daysBeforeEnd`. Vậy tuần 6, `dayOffset` 1 rơi vào `endDate - 42`, nên **`startDate = endDate - 42 ngày`** và `endDate` là ngày thi (không có buổi vào ngày thi). Tuần 1 `dayOffset` 7 là ngày liền trước ngày thi.

### Hai template bản đầu

Ghi đúng bảng dưới đây thành hằng số. Đây là **mẫu cấu trúc do Claude đề xuất**, chưa được HLV chuyên môn thẩm định; ticket T-024 hiển thị dòng "Mẫu minh họa, HLV chỉnh theo võ sĩ", và chủ dự án cần cho HLV duyệt số liệu trước demo (xem "Câu hỏi mở"). Giờ: `STRENGTH_CONDITIONING` 07:00, các loại khác 16:00. Cột là `dayOffset` 1→7; "—" là ngày nghỉ.

**MMA 6 tuần (`id: 'mma-camp-6w'`)**

| Khối | Tuần (`weekFromEnd`) | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Nền tảng | 6, 5 | STRENGTH_CONDITIONING 60′ | PAD_WORK 60′ · 5 hiệp | GRAPPLING 60′ · 5 hiệp | STRENGTH_CONDITIONING 60′ | HEAVY_BAG 45′ · 6 hiệp | SPARRING 60′ · 5 hiệp | RECOVERY 30′ |
| Cường độ | 4, 3, 2 | STRENGTH_CONDITIONING 60′ | PAD_WORK 60′ · 6 hiệp | GRAPPLING 75′ · 6 hiệp | RECOVERY 30′ | SPARRING 75′ · 6 hiệp | HEAVY_BAG 45′ · 6 hiệp | RECOVERY 30′ |
| Giảm tải | 1 | PAD_WORK 45′ · 4 hiệp | GRAPPLING 45′ · 4 hiệp | SHADOW_BOXING 30′ · 3 hiệp | RECOVERY 30′ | SHADOW_BOXING 30′ · 3 hiệp | SHADOW_BOXING 20′ · 2 hiệp | — |

**Boxing 6 tuần (`id: 'boxing-camp-6w'`)**: như MMA, thay mọi `GRAPPLING` bằng `SHADOW_BOXING` (cùng thời lượng và số hiệp, ở khối Giảm tải giữ nguyên).

Tiêu đề buổi (tiếng Việt, vì giao diện mặc định tiếng Việt): `"<Tên loại> · Tuần <6..1>"` với tên loại lấy từ bảng cố định trong file template (Tập thể lực, Đánh bia, Grappling, Đấm bao, Đối kháng, Hồi phục, Đánh bóng). Ghi chú: tiêu đề là dữ liệu lưu trong database, không đổi khi người dùng đổi ngôn ngữ giao diện.

### `GET /training-plans/templates`

Quyền `training.plan:create` (`TRAINING_PERMISSIONS.PLAN_CREATE`, `training.model.ts:369`). Trả mảng `PlanTemplate` đầy đủ `slots`. Không phân trang.

### `POST /training-plans/from-template`

Quyền: `allOf: [PLAN_CREATE, SESSION_CREATE]` (`training.model.ts:369`, `:378`). Body (`strict`):

| Trường | Kiểu | Ghi chú |
| --- | --- | --- |
| `templateId` | string | Phải có trong danh sách, không thì `PLAN_TEMPLATE_NOT_FOUND` (404) |
| `fighterId` | uuid | |
| `coachId` | uuid | Như `createPlan`: nếu actor là COACH thì phải sở hữu hồ sơ coach đó (`isCoachProfileOwnedByUser`) |
| `title` | text ≤ 255, tuỳ chọn | Mặc định là tên template (service không có sẵn tên võ sĩ) |
| `endDate` | dateOnly | Ngày thi. Phải lớn hơn ngày hôm nay theo giờ học viện, không thì `PLAN_TEMPLATE_END_DATE_PAST` (400) |

Hành vi:

1. Gọi `assertTrainingWriteAllowed(actor)` và `assertFighterAccess(actor, fighterId)` như `createPlan`.
2. Dựng danh sách buổi bằng hàm thuần `buildTemplateSessions(template, endDate, now)`; **bỏ các buổi đã qua** (`scheduledAt <= now`) và trả số buổi bị bỏ.
3. Trong một `this.repo.transaction`: `createPlan` (phase `fight_camp`, `startDate = endDate - 42`, `endDate`, `goals` null), rồi `createSession` cho từng buổi với `planId`, `fighterId`, `coachId`, `title`, `scheduledAt`, `sessionType`, `plannedDurationSec = min * 60`, `roundCount`. Một lỗi thì rollback tất cả; bọc bằng `mapTrainingPersistenceError` như `createPlan`.
4. Plan luôn `DRAFT` (service luôn tạo draft, frontend kích hoạt sau như `createPlan` ở `services/training.ts`).
5. Trả `{ plan, sessions, skippedPast }` (plan theo `trainingPlanResponseSchema`, session theo `trainingSessionBaseSchema`). HTTP 201.

**Thông báo:** không gửi `SESSION_SCHEDULED` cho từng buổi (30 thông báo một lần là spam). Kích hoạt plan vẫn gửi `PLAN_ACTIVATED` qua `PATCH /training-plans/:id/status` có sẵn. Không gọi `notifySessionEvent`.

**Múi giờ:** `scheduledAt` tính từ giờ địa phương học viện ở UTC+7 (Việt Nam, không đổi giờ mùa hè). Đặt hằng số `ACADEMY_UTC_OFFSET_MINUTES = 420` trong `plan-templates.ts`, không thêm cột cấu hình. "Hôm nay theo giờ học viện" tính cùng hằng số. Nếu `academy-settings` đã có múi giờ khi làm ticket (hiện chưa có: module `src/academy-settings/` không có trường múi giờ) thì dùng giá trị đó và ghi vào handover.

**Cổng y tế:** việc tạo buổi không kiểm tra điều kiện y tế (như `createSession` hiện tại); `assertMedicallyEligible` chạy khi bắt đầu buổi (`updateSessionStatus`). Giữ nguyên.

### Mã lỗi mới (`training.error.ts`, theo khuôn `invalidPlanDateRange`)

`PLAN_TEMPLATE_NOT_FOUND` (404), `PLAN_TEMPLATE_END_DATE_PAST` (400). Thêm vào `@ApiErrorEnvelope` của route.

## Tiêu chí nghiệm thu

1. `GET /training-plans/templates` trả đúng hai template (`mma-camp-6w`, `boxing-camp-6w`), mỗi template có `weeks = 6` và đúng 41 khe theo bảng (Nền tảng 2 tuần × 7 = 14, Cường độ 3 tuần × 7 = 21, Giảm tải 6). Test đếm số khe, kiểm tra không khe nào trùng `(weekFromEnd, dayOffset)`, và `GRAPPLING` không xuất hiện trong template Boxing.
2. Route `GET /training-plans/templates` không bị `GET /training-plans/:id` bắt (test controller hoặc test route; id `templates` không phải uuid).
3. `buildTemplateSessions` với `endDate = 2026-12-12` (thứ Bảy), `now` trước `startDate`: ngày buổi đầu là `2026-10-31`, buổi cuối là `2026-12-11`; không có buổi nào vào `2026-12-12`; tổng số buổi bằng số khe. Test cụ thể ngày của vài khe (ví dụ `weekFromEnd 1, dayOffset 7` → `2026-12-11`; `weekFromEnd 6, dayOffset 1` → `2026-10-31`).
4. `scheduledAt` đúng giờ UTC+7: khe 16:00 ngày `2026-11-02` lưu `2026-11-02T09:00:00.000Z`; khe 07:00 lưu `00:00:00.000Z`.
5. `now` nằm giữa kế hoạch: các buổi có `scheduledAt <= now` không được tạo, `skippedPast` bằng số buổi bị bỏ.
6. `endDate` là hôm nay hoặc quá khứ (theo giờ học viện) → 400 `PLAN_TEMPLATE_END_DATE_PAST`, không ghi gì.
7. `templateId` lạ → 404 `PLAN_TEMPLATE_NOT_FOUND`.
8. Giao dịch: nếu `createSession` thứ n lỗi thì không còn plan hay buổi nào (test service với repo giả ném lỗi ở buổi thứ hai; kiểm tra lỗi truyền qua `mapTrainingPersistenceError`).
9. DOCTOR bị `forbidden`; COACH không sở hữu `coachId` bị `forbidden`; COACH không phụ trách `fighterId` bị từ chối như `createPlan` (dùng `assertFighterAccess`).
10. Plan tạo ra có `status = DRAFT`, `phase = fight_camp`, `startDate = endDate - 42`; mọi buổi `SCHEDULED`, có `planId` và `fighterId` đúng.
11. Không có lời gọi `notifications`/`notifyResolved` nào trong `createPlanFromTemplate` (test).
12. Lint, build, test qua; không thêm lỗi so với [BASELINE](./BASELINE.md).

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nestjs-api lint
pnpm --filter nestjs-api build
pnpm --filter nestjs-api test
pnpm --filter nestjs-api db:check
```

Không có migration nên không cần `test:db`; vẫn chạy `db:check` để xác nhận schema không đổi. Không chạy `db:migrate:*`.

## Câu hỏi mở (ghi vào handover nếu người làm gặp, không tự đoán)

- Nội dung hai template (loại buổi, thời lượng, số hiệp, giờ) do Claude đề xuất để có cấu trúc; **cần HLV chuyên môn thẩm định trước demo 31/10**. Đổi số liệu chỉ là đổi hằng số, không đổi logic.
- Nếu cột `title` hay ràng buộc nào trong `training_sessions` từ chối dữ liệu dựng ra, ghi lại, không tự sửa schema.
