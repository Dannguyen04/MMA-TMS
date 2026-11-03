# 01. Đình chỉ: bảng, trạng thái theo ngày, tạo thủ công, cho tập lại

- Ticket: T-007A. Người làm: Ken. Phụ thuộc: T-003 (đã merge). Hạn merge: trước 25/10.
- Trạng thái: chưa lập plan.
- Tài liệu: [Tech spec §2.5, §4, §7, §8](../../../docs/FIGHT-CAMP-TECH-SPEC.md), [Luồng nghiệp vụ F7, R27, S3](../../../docs/FIGHT-CAMP-BUSINESS-FLOWS.md).

## Mục tiêu

Lưu đình chỉ của võ sĩ, tính trạng thái theo ngày khi đọc, cho HLV hoặc bác sĩ tạo thủ công và xác nhận cho tập lại. Phần tự tạo đình chỉ từ kết quả trận để sang [10](./10-result-wiring-r27.md).

## Trong phạm vi

1. Migration 025: bảng `suspensions` (Tech spec §2.5), enum `suspension_reason`, quyền `suspension:*`, các giá trị `notification_type` mới. Preflight yêu cầu ledger đã có 024 và chưa có 025.
2. Hàm thuần tính trạng thái đình chỉ vào ngày học viện `d`.
3. API: `GET /suspensions`, `POST /suspensions`, `POST /suspensions/:id/clear`.
4. Phạm vi theo bản ghi trong service (võ sĩ thấy của mình, HLV thấy võ sĩ được phân công, bác sĩ qua `doctor_fighters`), theo khuôn `goals.service.ts` và `bouts.service.ts`.

## Ngoài phạm vi

- Tự tạo đình chỉ khi ghi kết quả (10).
- Cổng 2 trong training (02), xử lý lịch xung đột (03).
- Thông báo `SUSPENSION_*` chỉ thêm giá trị enum vào DB và `NOTIFICATION_TYPE`; gửi thông báo đã cắt khỏi đợt đồ án (Luồng nghiệp vụ §5).

## Thiết kế

Còn hiệu lực vào ngày `d` (Tech spec §2.5): `starts_on <= d AND (d <= ends_on OR (requires_clearance AND cleared_at IS NULL))`.

Trạng thái đề xuất khi đọc: `ACTIVE` (trong khoảng), `AWAITING_CLEARANCE` (đã qua `ends_on`, cần xác nhận, chưa xác nhận), `ENDED` (hết hạn hoặc đã xác nhận). Việc "Chờ xác nhận" xuất hiện vào ngày `ends_on + 1`, không phải ngày `ends_on` (Luồng nghiệp vụ, tiêu chí nghiệm thu).

Dùng lại hàm ngày học viện trong `bouts.model.ts`: `academyDateOf`, `addDaysToDate`, `daysBetweenDates`.

Quyền (Tech spec §7):

| Quyền | FIGHTER | COACH | DOCTOR | ADMIN |
| --- | --- | --- | --- | --- |
| `suspension:read` | của mình | có | có | có |
| `suspension:create` | | có | có | có |
| `suspension:clear` | | có | có | |

Chú ý: ADMIN không có `suspension:clear`.

Xác nhận cho tập lại: bắt buộc `clearanceNote`; chỉ cho khi trạng thái ngày gọi là `AWAITING_CLEARANCE` (từ `ends_on + 1`, chỉ đình chỉ `requires_clearance`), khác thì 409 `SUSPENSION_NOT_AWAITING_CLEARANCE` với `details: { status }` (T-049); đã xác nhận rồi thì 409 `SUSPENSION_ALREADY_CLEARED` (kiểm trước); ghi `cleared_at`, `cleared_by_id` (ràng buộc `(cleared_at IS NULL) = (cleared_by_id IS NULL)`).

Tạo thủ công: `bout_id` có thể NULL (H5, H6). Đình chỉ lý do KO tạo thủ công vẫn được đếm vào `priorCount` khi gợi ý cho lần sau (dùng ở 10).

`override_reason` bắt buộc khi số ngày khác `suggested_days` (mã lỗi `SUSPENSION_OVERRIDE_REASON_REQUIRED` trong `bouts.error.ts`).

Giá trị enum `notification_type`: tham khảo cách thêm giá trị ở `migrations/017_doctor_assignment_notification.sql`; thêm cả vào `NOTIFICATION_TYPE` trong `src/shared/contracts/notification.contract.ts`. Danh sách: `BOUT_CREATED`, `BOUT_WEIGHT_AT_RISK`, `BOUT_REQUIREMENT_REJECTED`, `BOUT_REQUIREMENT_DUE`, `BOUT_WEIGHT_MISSING`, `SUSPENSION_CREATED`, `SUSPENSION_AWAITING_CLEARANCE`.

Loại buổi tập hiện có (migration 003): `SHADOW_BOXING`, `PAD_WORK`, `HEAVY_BAG`, `SPARRING`, `GRAPPLING`, `STRENGTH_CONDITIONING`, `RECOVERY`, `PHYSICAL_THERAPY`.

## Điểm mơ hồ phải hỏi (ghi vào mục "Câu hỏi" của handover)

1. Đình chỉ thủ công không có trận nên không có ruleset: `blocked_session_types` mặc định lấy ở đâu? Tech spec chỉ nói "mặc định lấy từ ruleset". Gợi ý: nhận từ request, nếu vắng thì dùng `{SPARRING}` (mặc định cột `default_blocked_session_types` của ruleset) hoặc ruleset của trận gần nhất.
2. `requires_clearance` của đình chỉ thủ công: suy ra từ lý do (KO, TKO, MEDICAL cần xác nhận; nghỉ bắt buộc không cần) hay do người tạo chọn?
3. Tên lý do cho "bị truất quyền" chưa có trong spec. Đã thấy trong tài liệu: `KO`, `TKO`, `MEDICAL`, `MANDATORY_REST`.

## Tiêu chí nghiệm thu

- Đình chỉ kết thúc ngày D mà cần xác nhận: ngày D vẫn `ACTIVE`; ngày D+1 là `AWAITING_CLEARANCE`; sau khi xác nhận là `ENDED`.
- Đình chỉ `MANDATORY_REST` qua ngày kết thúc: tự `ENDED`, không ai phải bấm.
- Xác nhận khi chưa qua `ends_on`, khi `UPCOMING`, hoặc đình chỉ không cần xác nhận (`MANDATORY_REST`, `DQ`): 409 `SUSPENSION_NOT_AWAITING_CLEARANCE`. Thiếu `clearanceNote`: 422.
- ADMIN gọi `/clear`: 403.
- Võ sĩ chỉ đọc được đình chỉ của mình; HLV chỉ thấy võ sĩ được phân công.
- Số ngày khác gợi ý mà không có `overrideReason`: lỗi `SUSPENSION_OVERRIDE_REASON_REQUIRED`.
- Ca migration mới trong `scripts/test-migrations.mjs` (ledger thiếu 024 thì dừng; chạy hai lần không lỗi theo khuôn hiện có).

## Lệnh bắt buộc

`lint`, `build`, `test`, `test:db`, `db:check` (xem [README](./README.md)).
