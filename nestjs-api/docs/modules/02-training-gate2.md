# 02. Cổng 2 trong training

- Ticket: T-007A. Người làm: Ken. Phụ thuộc: 01. Hạn merge: trước 25/10.
- Trạng thái: chưa lập plan.
- Tài liệu: [Tech spec §6](../../../docs/FIGHT-CAMP-TECH-SPEC.md), [Luồng nghiệp vụ F7 (Cổng 2), §6 Cổng 2](../../../docs/FIGHT-CAMP-BUSINESS-FLOWS.md).

## Mục tiêu

Trong lúc đình chỉ còn hiệu lực, không cho xếp lịch hoặc bắt đầu buổi tập thuộc loại bị chặn. Cổng 2 chạy độc lập với medical gate hiện có; buổi tập phải qua cả hai.

## Điểm chèn (đã đọc [training-session.service.ts](../../src/training/sessions/training-session.service.ts))

| Hàm | Dòng (22/10) | Hiện trạng | Việc thêm |
| --- | --- | --- | --- |
| `createSession` | 82 | Không có medical gate, không dùng transaction (`repo.createSession` ở dòng 105) | Gọi Cổng 2 với `data.fighterId`, `data.sessionType`, `data.scheduledAt` trước khi insert |
| `updateSession` | 120 | Medical gate chỉ chạy khi đổi loại của buổi đang `IN_PROGRESS` (dòng 140–150). Có transaction và khóa dòng | Khi đổi `scheduledAt` hoặc `sessionType`, tính loại và thời điểm hiệu lực (`data.x ?? locked.x`) rồi gọi Cổng 2 |
| `updateSessionStatus` | 180 | Nhánh `IN_PROGRESS` gọi `assertMedicallyEligible` trong transaction (dòng 237) | Gọi Cổng 2 ngay sau medical gate, cùng transaction |

Huỷ, dừng, bỏ buổi tập không bị chặn (nhánh `newStatus !== 'IN_PROGRESS'` ở dòng 202 giữ nguyên).

## Thiết kế

- `SuspensionGate.blockingSuspensions(fighterId, sessionType, at)` trả các đình chỉ còn hiệu lực vào ngày học viện của `at` mà chặn `sessionType` (Tech spec §6). Ngày học viện tính bằng `academyDateOf`.
- Lỗi: 409 `TRAINING_SUSPENSION_ACTIVE`, đặt trong `training.error.ts` theo khuôn `trainingMedicalEligibilityRequired`, kèm `{ suspensionId, reason, endsOn, requiresClearance }`. Response gộp lý do của cả hai cổng.
- Đình chỉ chờ xác nhận vẫn chặn (qua `ends_on` mà chưa xác nhận thì vẫn không xếp được `SPARRING`).
- Cờ `blockedBySuspension` cho từng session trên lịch tuần. Chưa kiểm tra endpoint lịch tuần nằm ở đâu; xác định khi lập plan.

### Cấu trúc module (ràng buộc có sẵn trong code)

`BoutsModule` hiện không import `TrainingModule`, có chú thích rõ rằng T-007 sẽ làm training import bouts ([bouts.module.ts](../../src/bouts/bouts.module.ts)). Vì vậy:
- Thêm provider cổng vào `BoutsModule` và export.
- Thêm `BoutsModule` vào `imports` của `TrainingModule` (hiện là `DatabaseModule, MedicalModule, NotificationsModule`).
- Không cho `BoutsModule` import ngược `TrainingModule` (tránh vòng phụ thuộc).

## Điểm cần quyết khi lập plan

- `createSession` không có transaction: giữa lúc kiểm tra và insert có thể có đình chỉ mới được tạo. Chấp nhận (đình chỉ tính theo ngày, rủi ro thấp) hay bọc transaction cho đồng bộ với `updateSession`? Ghi quyết định vào handover.

## Tiêu chí nghiệm thu (Tech spec §6, Luồng nghiệp vụ §6)

- Thua KO, đình chỉ 45 ngày đã xác nhận: xếp `SPARRING` vào ngày thứ 10 bị 409; xếp `PAD_WORK` được.
- Qua ngày kết thúc mà chưa xác nhận: vẫn không xếp được `SPARRING`.
- Sau khi xác nhận được tập lại: xếp được `SPARRING`.
- Bắt đầu buổi `SPARRING` khi đình chỉ còn hiệu lực: 409, cùng mã lỗi.
- Võ sĩ vừa chưa đủ điều kiện y tế vừa bị đình chỉ: lỗi liệt kê lý do của cả hai.
- Huỷ buổi bị đình chỉ không bị chặn.
- Thêm ca vào `training-session.service.spec.ts`: lên lịch, bắt đầu, loại không bị chặn, chờ xác nhận, hai cổng cùng chặn.

## Lệnh bắt buộc

`lint`, `build`, `test` (đặc biệt `training-session.service.spec.ts`), `test:db`, `db:check`.
