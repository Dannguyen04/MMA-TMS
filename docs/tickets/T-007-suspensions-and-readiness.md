# T-007 · Đình chỉ, Cổng 2, xử lý lịch xung đột, bảng sẵn sàng (backend, phần A)

| | |
| --- | --- |
| **Trạng thái** | IN REVIEW (backend, 25/10). `agy` làm các lượt A đến G, Claude review; xem [handover](./T-007-HANDOVER.md). Phần B (Hoàng Anh) và C (Fon) chưa có ticket |
| **Phần** | A: Backend (`nestjs-api`). Phần B (tab Đình chỉ, tab Sẵn sàng, xử lý lịch: Hoàng Anh) và C (võ sĩ xem trạng thái đình chỉ: Fon) có ticket riêng, dùng contract của ticket này |
| **Người nhận** | Ken |
| **Nhánh** | `feat/T-007-suspensions` từ `fight-camp` mới nhất (đã có T-003, T-006, T-010, T-029 merge 26/10) |
| **Hạn** | Trễ hạn 25/10. Hạn mới: mục 1–6 merge trước 28/10 để kịp tổng duyệt 30/10; mục 7 ngay sau |
| **Tài liệu dẫn chiếu** | [Tech spec §2.5, §4, §6, §7, §8](../FIGHT-CAMP-TECH-SPEC.md), [Luồng nghiệp vụ nghiệp vụ 11–13, 15, F6, F7, R4, R27, R28, R32, S3, H3–H7](../FIGHT-CAMP-BUSINESS-FLOWS.md), [T-006](./T-006-weigh-in-and-result.md) mục "Dữ liệu để lại cho T-007, T-010", tách module chi tiết ở [nestjs-api/docs/modules/](../../nestjs-api/docs/modules/README.md) (01, 02, 03, 05, 10) |
| **Migration** | **025** (`025_suspensions.sql`). Preflight: ledger có 024, chưa có 025. Không yêu cầu 026, 027 (027 đã áp trên Supabase) |

## Bối cảnh

T-003 và T-006 xong phần trận: tạo, cân, kết quả. Chưa có gì về đình chỉ: không có bảng `suspensions`, `recordResult` (`src/bouts/bouts.service.ts:945` trên `fight-camp`) chỉ chuyển trận sang `COMPLETED` và để `lossOfConsciousness`, `stoppedByHeadStrike`, `injuryNote` trên `history`. Training chưa có Cổng 2. Ticket này làm:

1. Bảng `suspensions`, trạng thái theo ngày, tạo thủ công, cho tập lại.
2. Cổng 2 trong training (409 `TRAINING_SUSPENSION_ACTIVE`).
3. Đề xuất xử lý buổi tập xung đột với đình chỉ (R28).
4. Bảng sẵn sàng nhận trận toàn CLB (R32).
5. Cảnh báo R4 khi tạo trận.
6. Tự tạo đình chỉ khi ghi kết quả trận (R27), cùng giao dịch.

## Quyết định đã chốt (chủ dự án trả lời Ken, 24/10)

| # | Nội dung | Quyết định |
| --- | --- | --- |
| 1 | Màu cân từ `WEIGHED_IN` | Không tính màu cân từ `WEIGHED_IN` trở đi (gồm `COMPLETED`, `CANCELLED`); biểu đồ vẫn hiện điểm. Không nhắc nhập cân ngày thi (app không theo dõi bù nước); nhắc cân chỉ áp trong `FIGHT_WEEK`. **Thuộc T-029, không thuộc ticket này** |
| 2 | Đình chỉ thủ công | Loại buổi bị chặn lấy từ request, bỏ trống thì `{SPARRING}`. `requires_clearance` suy từ lý do: `KO`, `TKO` luôn cần, không cho tắt; `MEDICAL` mặc định cần; `DQ`, `MANDATORY_REST` không cần; `OTHER` theo request, mặc định không cần |
| 3 | Tên enum và trường | Truất quyền: `method = 'DQ'` (`bout_method`), lý do đình chỉ `DQ` (`suspension_reason`). Dừng vì đòn vào đầu: `stoppedByHeadStrike` (boolean). Mất ý thức: `lossOfConsciousness` (`NONE`, `UNDER_1_MIN`, `OVER_1_MIN`, `UNKNOWN`). Hai trường này **không phải cột của `bouts`**; chỉ nằm trên `history` của lần chuyển sang `COMPLETED`. Riêng mất ý thức ghi thành cột `loss_of_consciousness` trên `suspensions` |
| 4 | Siết ngưỡng cân theo WBC | Không đổi, không thuộc T-007. Muốn đề xuất thì gửi văn bản gốc để đối chiếu; nếu dùng thì làm tham số của bộ luật |
| 5 | XÁM 2 ngày trong 7 ngày cuối | Không đổi `WEIGHT_STALE_DAYS = 3` (R7). Nhắc "hôm nay chưa ghi cân" là quy tắc riêng, không thuộc T-007 |
| 6 | Cổng 2 và transaction | `createSession` không bọc transaction, ghi lý do vào handover. Khi bắt đầu buổi, đặt Cổng 2 trong transaction có sẵn, cạnh medical gate (lớp chặn thứ hai). `updateSession` (đã có transaction) cũng phải qua Cổng 2 khi đổi loại buổi hoặc đổi ngày |

## Phạm vi

### 1. Migration 025 và trạng thái đình chỉ

Migration `025_suspensions.sql` theo khuôn [024_bouts.sql](../../nestjs-api/migrations/024_bouts.sql) và [027](../../nestjs-api/migrations/027_opponent_analysis_and_rounds.sql): advisory lock `pg_advisory_xact_lock(20260916, 25)`, preflight, `migration_history`, checksum trong `manifest.json`, tên trong `scripts/migration-files.mjs`, mục `--apply-025` trong `run_sql.mjs`, script `db:migrate:025`, mô tả trong `migrations/README.md`, ca trong `scripts/test-migrations.mjs`. Nội dung:

- **Enum `suspension_reason`** (`KO`, `TKO`, `DQ`, `MANDATORY_REST`, `MEDICAL`, `OTHER`). Đã kiểm tra: 024 chỉ tạo năm enum (`bout_status`, `bout_sport`, `bout_result`, `bout_method`, `bout_requirement_status`), **chưa có** `suspension_reason`, nên 025 phải tạo.
- **Bảng `suspensions`** đúng Tech spec §2.5, kèm chỉ mục `idx_suspensions_fighter_active`, trigger `updated_at` và audit (`mma_private.audit_domain_mutation()`), RLS bật và revoke như 024.
- **Quyền** `suspension:read`, `suspension:create`, `suspension:clear` theo bảng Tech spec §7. ADMIN **không** có `suspension:clear`.
- **Giá trị `notification_type`** mới (§7): `BOUT_CREATED`, `BOUT_WEIGHT_AT_RISK`, `BOUT_REQUIREMENT_REJECTED`, `BOUT_REQUIREMENT_DUE`, `BOUT_WEIGHT_MISSING`, `SUSPENSION_CREATED`, `SUSPENSION_AWAITING_CLEARANCE`; thêm cả vào `NOTIFICATION_TYPE` trong `src/shared/contracts/notification.contract.ts` (hiện chưa có giá trị nào trong nhóm này). Cách thêm giá trị enum: theo `017_doctor_assignment_notification.sql`. Chỉ thêm giá trị, **không gửi thông báo** (đã cắt, Luồng nghiệp vụ §5).
- Hàm thuần `suspensionStatusOn(suspension, d)` (đặt trong module mới `src/suspensions/suspensions.model.ts`, có `.spec.ts`). Còn hiệu lực vào ngày học viện `d`: `cleared_at IS NULL AND starts_on <= d AND (d <= ends_on OR requires_clearance)` (dạng Tech spec §2.5 cộng điều kiện chưa kết thúc sớm, xem mục 2). Trạng thái trả về: `UPCOMING` (`d < starts_on`, chưa xác nhận), `ACTIVE` (`starts_on <= d <= ends_on`, chưa xác nhận), `AWAITING_CLEARANCE` (`d > ends_on`, cần xác nhận, chưa xác nhận), `ENDED` (đã xác nhận, hoặc qua `ends_on` mà không cần xác nhận). "Chờ xác nhận" xuất hiện từ `ends_on + 1`. Dùng lại `academyDateOf`, `addDaysToDate`, `daysBetweenDates` của `bouts.model.ts`.

### 2. API đình chỉ

| Method | Path | Quyền | Ghi chú |
| --- | --- | --- | --- |
| GET | `/suspensions` | `suspension:read` | Lọc `fighterId`, `active`; cursor như `GET /goals`. Mỗi dòng kèm `status` tính khi đọc |
| POST | `/suspensions` | `suspension:create` | Tạo thủ công, `bout_id` NULL được (H5, H6). Đình chỉ tạo từ kết quả trận đi qua mục 7, không qua endpoint này |
| POST | `/suspensions/:id/clear` | `suspension:clear` | Bắt buộc `clearanceNote`; chỉ sau `ends_on`; ghi `cleared_at`, `cleared_by_id` |

Quy tắc tạo thủ công (quyết định 2): `blockedSessionTypes` lấy từ request, vắng thì `{SPARRING}`; `requiresClearance` suy từ lý do như bảng quyết định. Request gửi `requiresClearance = false` cho `KO`/`TKO` thì bị từ chối (422 do Zod, không cần mã lỗi mới). `suggested_days` là NULL cho đình chỉ thủ công (không có bộ luật), nên `override_reason` không bắt buộc; `SUSPENSION_OVERRIDE_REASON_REQUIRED` chỉ dùng ở mục 7. Đình chỉ `KO`/`TKO` tạo thủ công vẫn được tính vào `priorCount` (mục 7).

Phạm vi theo bản ghi trong service, theo khuôn `goals.service.ts`, `bouts.service.ts`: võ sĩ chỉ thấy của mình; HLV chỉ thấy võ sĩ được phân công; bác sĩ qua `doctor_fighters`; Admin thấy tất cả.

Xác nhận cho tập lại / kết thúc sớm: chỉ khi chưa xác nhận (`cleared_at IS NULL`); không bắt buộc đã qua `ends_on` (xem "Kết thúc sớm" bên dưới). Đã xác nhận rồi thì 409 `SUSPENSION_ALREADY_CLEARED`.

Thời hạn tạo thủ công (chốt 24/10): body nhận `days` (≥ 1) và `startsOn` tùy chọn. `startsOn` mặc định hôm nay (ngày học viện), **không được trước hôm nay** (422); được là ngày tương lai. `ends_on = starts_on + days − 1`. Đình chỉ có `starts_on` ở tương lai có trạng thái `UPCOMING` (thêm vào `suspensionStatusOn`), chưa chặn buổi tập nào cho tới ngày bắt đầu; công thức "còn hiệu lực" của Tech spec §2.5 đã đúng vì có điều kiện `starts_on <= d`.

**Kết thúc sớm (mới 24/10, Q5, đã chốt).** Để không phải đổi bảng: dùng lại `cleared_at`, `cleared_by_id`, `clearance_note` (đã có), cho `POST /suspensions/:id/clear` chạy cả **trước** `ends_on`, và đổi công thức còn hiệu lực thành `cleared_at IS NULL AND starts_on <= d AND (d <= ends_on OR requires_clearance)`. Với đình chỉ chưa xác nhận, công thức mới cho kết quả giống công thức cũ; với đình chỉ đã xác nhận thì kết thúc ngay từ lúc xác nhận. `ends_on` giữ nguyên giá trị ban đầu (thấy được ngày dự kiến ban đầu, lịch sử còn trong audit). Vẫn cùng quyền `suspension:clear` (HLV, bác sĩ; ADMIN không), vẫn bắt buộc `clearanceNote`. Mọi lý do đều được kết thúc sớm (kể cả `KO`, `TKO`, `MEDICAL`), HLV hoặc bác sĩ đều làm được. Đình chỉ `UPCOMING` (chưa tới `starts_on`) cũng kết thúc/huỷ được bằng cùng đường này. Thay thế quy tắc F7 cũ "chỉ sau ngày kết thúc": mã lỗi `SUSPENSION_CLEARANCE_TOO_EARLY` ở Q3 **bỏ**, không cần nữa.

### 3. Cổng 2 trong training

Sửa `src/training/sessions/training-session.service.ts` (dòng theo `fight-camp` ngày 24/10):

| Hàm | Dòng | Việc thêm |
| --- | --- | --- |
| `createSession` | 82 | Gọi Cổng 2 với `data.fighterId`, `data.sessionType`, `data.scheduledAt` trước khi insert. Không bọc transaction (quyết định 6); ghi lý do vào handover |
| `updateSession` | 120 (transaction ở 134) | Khi đổi `scheduledAt` hoặc `sessionType`, tính loại và thời điểm hiệu lực (`data.x ?? locked.x`) rồi gọi Cổng 2. Medical gate hiện chỉ chạy khi đổi loại của buổi `IN_PROGRESS` (dòng 140–150), giữ nguyên |
| `updateSessionStatus` | 180 (transaction ở 227) | Gọi Cổng 2 ngay sau `assertMedicallyEligible` (dòng 237), cùng transaction |

Huỷ, dừng, bỏ buổi tập không bị chặn (nhánh `newStatus !== 'IN_PROGRESS'` giữ nguyên).

- `SuspensionGate.blockingSuspensions(fighterId, sessionType, at)` trả các đình chỉ còn hiệu lực vào ngày học viện của `at` mà chặn `sessionType`. Đình chỉ chờ xác nhận vẫn chặn.
- Lỗi: 409 `TRAINING_SUSPENSION_ACTIVE` đặt trong `training.error.ts` theo khuôn `trainingMedicalEligibilityRequired`, kèm `{ suspensionId, reason, endsOn, requiresClearance }`. Hai cổng chạy độc lập, medical gate trước, response **gộp lý do của cả hai**.
- **Quyết định đã chốt 25/10 (thay phần ticket ghi cổng nằm ở `BoutsModule`):** tạo `SuspensionsModule` riêng (`src/suspensions/`), chỉ phụ thuộc `DatabaseModule`, export `SuspensionGate` và `SuspensionsRepository`. `TrainingModule` và `BoutsModule` đều import nó; không module nào import ngược `TrainingModule` hay `BoutsModule`. R28 nằm ở `TrainingModule` (cần buổi tập), R32 và R27 ở `BoutsModule`. Ghi vào "Lệch so với ticket" của handover.
- **Lỗi khi cả hai cổng chặn (chốt 25/10):** chỉ medical chặn: giữ nguyên `TRAINING_MEDICAL_ELIGIBILITY_REQUIRED`; chỉ đình chỉ chặn: `TRAINING_SUSPENSION_ACTIVE` kèm `details.suspensions`; cả hai chặn: giữ mã `TRAINING_MEDICAL_ELIGIBILITY_REQUIRED` và thêm `details.suspensions` để client cũ không vỡ.
- Cấu trúc module (ràng buộc có sẵn): `BoutsModule` có chú thích rõ rằng T-007 sẽ làm training import bouts (`src/bouts/bouts.module.ts`). Thêm provider cổng vào `BoutsModule` và export; thêm `BoutsModule` vào `imports` của `TrainingModule` (hiện `DatabaseModule, MedicalModule, NotificationsModule`); **không** cho `BoutsModule` import ngược `TrainingModule`. Module `suspensions` (mục 2) nằm ở đâu, import ai, Ken chốt khi lập plan sao cho không có vòng phụ thuộc.

### 4. Xử lý lịch xung đột (R28)

Quy tắc R28 (nguyên văn Luồng nghiệp vụ): với mỗi buổi `SCHEDULED` của võ sĩ nằm trong khoảng đình chỉ và có loại bị chặn: (1) đổi sang `RECOVERY` nếu loại này không bị chặn; (2) không đổi được và đình chỉ không cần xác nhận: dời sang ngày đầu tiên sau ngày kết thúc muộn nhất của các đình chỉ còn hiệu lực; (3) còn lại: huỷ. Đình chỉ cần xác nhận mà chưa xác nhận có ngày kết thúc mở nên rơi vào nhánh huỷ.

- Hàm thuần nhận danh sách buổi và đình chỉ, trả `{ sessionId, action: 'CHANGE_TYPE' | 'RESCHEDULE' | 'CANCEL', ... }`.
- Đọc (tính khi đọc, không lưu) và áp dụng (một transaction, đi qua các đường sửa buổi tập hiện có để vẫn gửi `TRAINING_SESSION_RESCHEDULED`/`CANCELLED`; một buổi lỗi thì không buổi nào đổi). Tên endpoint: xem Q4.

### 5. Bảng sẵn sàng (R32)

Bảng chỉ đọc, tính khi đọc, mỗi võ sĩ trong phạm vi người xem một dòng: trạng thái S3 (đang đình chỉ ngày x/y, loại buổi bị chặn, loại được tập, ngày dự kiến tập lại → chờ xác nhận → được tập → sẵn sàng), cân gần nhất, trận đang chạy.

- Sẵn sàng = không có trận ở `CAMP`, `FIGHT_WEEK`, `WEIGHED_IN` (khớp chỉ mục `uq_bouts_active_per_fighter`; `SCHEDULED` **không** loại) và không có đình chỉ còn hiệu lực.
- Lọc theo hạng cân (kg) và ngày thi dự kiến: "Chưa sẵn sàng" nếu đình chỉ còn hiệu lực đến sau ngày đó hoặc đang có trận ở ba trạng thái trên. **Phần lọc khả thi về cân (R31) thuộc T-029**: ticket này trả sẵn dữ liệu cân gần nhất và chừa chỗ, không tự viết hàm khả thi.
- HLV chỉ thấy võ sĩ được phân công; Admin thấy toàn CLB. Gom dữ liệu theo lô (đình chỉ, trận đang chạy, cân gần nhất), tránh N+1. Tên endpoint và quyền: xem Q4.

### 6. Cảnh báo R4 khi tạo trận

`createBout` (`src/bouts/bouts.service.ts:522`, trên `fight-camp` 26/10) vẫn lưu được, trả thêm `warnings` khi võ sĩ còn đình chỉ kéo dài quá ngày thi (định nghĩa còn hiệu lực ở mục 1, tại ngày thi) hoặc đang có trận khác ở `CAMP`/`FIGHT_WEEK`/`WEIGHED_IN`. **Không đụng `updateBout` và `resolveWeightClass`.** Báo Dan trước khi sửa `bouts.service.ts`. R31 (cân) thuộc T-029, không làm ở đây. Mã cảnh báo và hình dạng `warnings`: xem Q4.

### 7. Tự tạo đình chỉ khi ghi kết quả (R27)

Trong `recordResult` (`bouts.service.ts:945`), trong **cùng transaction** với lần chuyển `COMPLETED` (`repo.transaction` ở dòng 1024), sau `updateBout`, tạo đình chỉ. Hàm thuần `suggestSuspension` đặt trong `src/suspensions/` và có spec; service thêm một lời gọi, không viết lại luồng của Dan.

- Dùng thẳng `input` đã validate của request (`method`, `result`, `lossOfConsciousness`, `stoppedByHeadStrike`). `history` chỉ là nơi lưu lại cho việc tái dựng sau này.
- Chọn quy tắc **nặng nhất** (số ngày lớn nhất) khớp trong `suspension_rules` của bộ luật gắn trận, theo lý do, `priorCount` trong `withinDays` (đếm đình chỉ `KO`/`TKO` trước đó của võ sĩ, kể cả tạo thủ công, trừ trận này) và `loc`. Luôn tạo thêm một đình chỉ `MANDATORY_REST` theo `rest_days_after_bout` nếu > 0, không cần xác nhận. Đình chỉ có hiệu lực ngay, kèm câu giải thích (ví dụ "KO lần 2 trong 90 ngày, preset AIBA: 90 ngày").
- Theo F7/H3/H4/H6:
  - Thua `KO`, hoặc thua `TKO` với `stoppedByHeadStrike = true`: quy tắc nặng nhất, cần xác nhận (`requires_clearance = true`). `loss_of_consciousness` ghi vào cột.
  - Thua `TKO` với `stoppedByHeadStrike = false`: không có đình chỉ lý do `TKO` (kể cả quy tắc `loc`); chỉ nghỉ bắt buộc.
  - `method = 'DQ'`: đình chỉ lý do `DQ` chỉ khi bộ luật có quy tắc cho `DQ`; không cần xác nhận.
  - Bộ luật không có quy tắc (VMMAF, "Tự nhập") mà thua `KO`, hoặc thua `TKO` do đòn vào đầu: HLV nhập số ngày trong form kết quả. Thiếu thì lỗi (mã/trường: Q4).
  - Sửa số ngày khác `suggested_days` phải có `overrideReason`, thiếu thì `SUSPENSION_OVERRIDE_REASON_REQUIRED`.
  - Huỷ trận (kể cả ở `WEIGHED_IN`) không tạo gì (H4). Thắng nhưng bị đánh ngã không tự tạo (H6).
- Lỗi khi tạo đình chỉ thì kết quả trận cũng không được lưu.
- Cần mở rộng `recordResultSchema` (`bouts.model.ts:710`) để nhận số ngày và `overrideReason` (đổi contract `POST /bouts/:id/result`; báo Hoàng Anh, ghi tác động vào handover).

## Ngoài phạm vi

- Gửi thông báo `SUSPENSION_*` (chỉ thêm giá trị enum).
- Màu cân từ `WEIGHED_IN`, nhắc cân, thẻ Việc cần làm, hàm khả thi cân R31 (T-029).
- Ngưỡng cân theo WBC, `WEIGHT_STALE_DAYS` (không đổi).
- `updateBout`, `resolveWeightClass`, `computeWeightTrack` (của Dan, đã merge ở T-003, T-006).
- Frontend và điện thoại (phần B, C).
- Nút "Đã trao đổi" trên thẻ việc cần làm.

## Chờ chủ dự án xác nhận (stop-and-ask, trước khi chuyển READY)

Ken **không code** phần phụ thuộc cho tới khi có câu trả lời. Ken đề xuất cụ thể trong plan; các tên dưới đây là gợi ý của Claude, chưa có trong Tech spec.

| # | Câu hỏi | Gợi ý |
| --- | --- | --- |
| Q1 | ~~Ngày bắt đầu và kết thúc của đình chỉ tạo từ kết quả trận~~ | **Đã chốt 24/10:** đề xuất ở dưới được chấp nhận phần `days`; `startsOn` do người tạo chọn. Đình chỉ tự tạo từ kết quả (mục 7) dùng `starts_on` = ngày học viện ghi kết quả, `ends_on = starts_on + days − 1` (chủ dự án đã xác nhận 25/10) |
| Q2 | ~~Đình chỉ thủ công nhận `days` hay `endsOn`~~ | **Đã chốt 24/10:** nhận `days` (≥ 1) và `startsOn` tùy chọn (mặc định hôm nay), **không được ở quá khứ**; có thể là ngày tương lai. Response trả `endsOn = startsOn + days − 1` |
| Q5 | ~~Kết thúc đình chỉ sớm khi võ sĩ đã ổn~~ | **Đã chốt 24/10:** HLV hoặc bác sĩ (quyền `suspension:clear`, ADMIN không), mọi lý do kể cả `KO`/`TKO`/`MEDICAL`, bắt buộc `clearanceNote`. Làm theo mục 2 "Kết thúc sớm". Đây là thay đổi so với F7 ("chỉ sau ngày kết thúc"): Claude cập nhật Luồng nghiệp vụ F7 và Tech spec §2.5 khi review |
| Q3 | Mã lỗi mới ngoài hai mã đã có trong Tech spec §4 (`TRAINING_SUSPENSION_ACTIVE`, `SUSPENSION_OVERRIDE_REASON_REQUIRED`) | **Đã duyệt 24/10:** `SUSPENSION_NOT_FOUND` (404), `SUSPENSION_ALREADY_CLEARED` (409), `SUSPENSION_DAYS_REQUIRED` (422, khi bộ luật không có quy tắc). Hai mã `SUSPENSION_CLEARANCE_NOT_REQUIRED` và `SUSPENSION_CLEARANCE_TOO_EARLY` **bỏ** vì Q5 cho kết thúc sớm mọi đình chỉ |
| Q4 | Endpoint và mã chưa có trong Tech spec §4 | R28: `GET /suspensions/:id/conflicts`, `POST /suspensions/:id/conflicts/apply`. R32: `GET /readiness` (quyền `bout:get_all`, không thêm quyền mới). R4: `warnings: [{ code }]` trong response `createBout` với mã `FIGHTER_ACTIVE_BOUT`, `FIGHTER_SUSPENDED_PAST_BOUT_DATE`. Cờ `blockedBySuspension` trên lịch tuần (Tech spec §6): đã tìm trong `training-session.controller.ts`, **không thấy endpoint lịch tuần**; đề xuất bỏ cờ riêng, dùng danh sách xung đột ở R28 thay thế |

## Tiêu chí nghiệm thu

Hàm thuần (`suspensions.model.spec.ts`, `bouts.model.spec.ts` nếu chạm):

1. Đình chỉ cần xác nhận kết thúc ngày D: ngày D là `ACTIVE`; D+1 là `AWAITING_CLEARANCE`; sau khi xác nhận là `ENDED`.
2. `MANDATORY_REST` qua ngày kết thúc: tự `ENDED`.
3. R28: `SPARRING` ở ngày thứ 5 của đình chỉ → đề xuất `CHANGE_TYPE` sang `RECOVERY`; `RECOVERY` bị bộ luật chặn mọi loại → `RESCHEDULE` (đình chỉ không cần xác nhận) hoặc `CANCEL` (cần xác nhận, ngày kết thúc mở); nhiều đình chỉ chồng nhau dùng ngày kết thúc muộn nhất của các đình chỉ chặn loại đó.
4. S3 theo ngày: ranh giới `ends_on` và `ends_on + 1`.
5. `suggestSuspension` (preset AIBA): KO lần đầu 30 ngày; có đình chỉ KO thủ công 40 ngày trước, nay thua KO → 90 ngày; TKO `stoppedByHeadStrike = true` → 30 ngày; TKO `false` → không có đình chỉ `TKO`; VMMAF thua KO không có `days` → lỗi; `DQ` không có quy tắc → không đình chỉ; huỷ → không gì cả.
6. `requires_clearance` suy từ lý do đúng bảng quyết định 2; `KO`/`TKO` gửi `false` bị từ chối.

Service, API (`suspensions.service.spec.ts`, `training-session.service.spec.ts`, `bouts.service.spec.ts`, controller spec):

7a. Tạo thủ công: `startsOn` hôm qua → 422; `startsOn` hôm nay, `days = 14` → `endsOn` = hôm nay + 13; `startsOn` ngày mai → trạng thái `UPCOMING`, không chặn buổi `SPARRING` hôm nay, chặn từ ngày mai.
7b. Kết thúc sớm: xác nhận trước `ends_on` thành công với `clearanceNote`, sau đó đình chỉ là `ENDED` và Cổng 2 không còn chặn; thiếu `clearanceNote`: 422; ADMIN: 403.
7. Thiếu `clearanceNote`: 422; đình chỉ đã xác nhận rồi: 409 `SUSPENSION_ALREADY_CLEARED`; ADMIN gọi `/clear`: 403; HLV hoặc bác sĩ có phạm vi: được.
8. Võ sĩ chỉ đọc đình chỉ của mình; HLV chỉ thấy võ sĩ được phân công; bác sĩ qua `doctor_fighters`.
9. Cổng 2: thua KO, đình chỉ 45 ngày đã xác nhận: xếp `SPARRING` vào ngày thứ 10 bị 409, xếp `PAD_WORK` được; qua ngày kết thúc mà chưa xác nhận vẫn không xếp được `SPARRING`; sau khi xác nhận xếp được.
10. Cổng 2 ở `updateSession`: đổi `sessionType` sang `SPARRING` hoặc đổi `scheduledAt` vào khoảng đình chỉ bị 409; ở `updateSessionStatus` sang `IN_PROGRESS` bị 409 cùng mã; huỷ buổi không bị chặn.
11. Võ sĩ vừa chưa đủ điều kiện y tế vừa bị đình chỉ: lỗi liệt kê lý do của cả hai.
12. R28 áp dụng: bỏ chọn một buổi thì buổi đó không bị đụng; một buổi lỗi giữa chừng thì không buổi nào đổi; buổi đổi vẫn phát thông báo như thường.
13. R32: lọc 60 kg, ngày thi sau 30 ngày: võ sĩ có đình chỉ kết thúc sau ngày đó "Chưa sẵn sàng" kèm ngày dự kiến tập lại; võ sĩ có trận `CAMP` không nằm trong nhóm sẵn sàng; trận `SCHEDULED` nhưng không đình chỉ vẫn sẵn sàng; HLV chỉ thấy võ sĩ của mình, Admin thấy tất cả.
14. R4: đình chỉ còn hiệu lực đến sau ngày thi → cảnh báo, vẫn lưu được; đang có trận `CAMP` → cảnh báo, vẫn tạo được trận `SCHEDULED`. `updateBout`, `resolveWeightClass` không đổi.
15. R27 trong `recordResult`: lỗi khi tạo đình chỉ thì trận không sang `COMPLETED` (cùng transaction).
16. Ca migration mới trong `scripts/test-migrations.mjs`: ledger thiếu 024 thì dừng; chạy lần hai báo đã áp; có `suspension_reason`, bảng, ràng buộc `ends_on >= starts_on` và `(cleared_at IS NULL) = (cleared_by_id IS NULL)`, quyền theo đúng vai (ADMIN không có `suspension:clear`), các giá trị `notification_type`.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nestjs-api lint
pnpm --filter nestjs-api build
pnpm --filter nestjs-api test
pnpm --filter nestjs-api test:db
pnpm --filter nestjs-api db:check
```

Không lệnh nào được thêm lỗi so với [baseline](./BASELINE.md). **Không** chạy `db:migrate:*` hay SQL lên Supabase (Dan áp migration 025). Dán nguyên văn phần cuối output vào `docs/tickets/T-007-HANDOVER.md` theo mẫu ở mục 6 của [TEAM-WORKFLOW](../TEAM-WORKFLOW.md).

## Ghi chú cho người thực hiện

- Module mẫu: `src/bouts/` (đọc `recordResult`, `createBout`, `assertWriteAccess`, `setAuditContext`) và `src/goals/` trên nhánh `wip/goals`. Ngày luôn là ngày học viện (`academyDateOf`), không dùng `toISOString().slice(0, 10)`.
- "Lệch so với ticket" trong handover phải ghi: lý do `createSession` không bọc transaction; mọi tên endpoint, mã lỗi, field đã chốt ở Q1–Q4; việc `recordResultSchema` đổi contract.
- Thông báo Dan trước khi sửa `bouts.service.ts`; thông báo Hoàng Anh và Fon khi contract đổi (`createBout` có `warnings`, `recordResult` nhận số ngày, các endpoint mới).
- Thấy lệch giữa ticket và code thì ghi vào mục "Câu hỏi" của handover, không đoán.

## Bổ sung 26/10 (Claude, sau khi T-029 merge)

- **Nối vào T-029:** thêm hai nguồn còn thiếu vào thẻ Việc cần làm (`src/bouts/bouts-todo.service.ts`): R28 (buổi tập xung đột với đình chỉ) và S3 (đình chỉ chờ xác nhận). R27 "cân nhắc đình chỉ thủ công" lấy từ `safety` của T-010 (`buildRoundAdvice`, mã `KNOCKDOWNS`, `STUNNED_STREAK`). Bộ lọc `GET /readiness` dùng `computeWeightFeasibility` (R31) của T-029. Mỗi nguồn có test riêng, theo khuôn `bouts-todo.service.spec.ts`.
- **Trạng thái cân** đã đổi tên ở T-029: `ON_TRACK`, `ABOVE_TARGET`, `OVER_LIMIT`, `NOT_WEIGHED`, `NEUTRAL`. Không dùng tên cũ.
