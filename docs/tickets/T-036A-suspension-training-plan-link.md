# T-036A · Đình chỉ phải chặn được việc tập: đóng lỗ "đình chỉ nhưng vẫn tập được", rồi gắn đình chỉ vào giáo án

| | |
| --- | --- |
| **Trạng thái** | Phần 1: READY (27/10). Phần 2: DRAFT, **chờ chủ dự án chốt** các quyết định ở mục "Câu hỏi cho chủ dự án", chưa code |
| **Phần** | Backend. Phần 1 không migration. Phần 2 có thể cần migration (xem mục 5) |
| **Người nhận** | Ken (chia việc 27/10: T-036A). Làm qua `agy`, theo [TEAM-WORKFLOW §0](../TEAM-WORKFLOW.md) |
| **Nguồn yêu cầu** | Nhận xét review 27/10, ý 1: "Đình chỉ phải tác động tới cả kế hoạch tập: các buổi đã xếp bị xử lý ngay, camp tự chuyển sang hồi phục, chặn theo cường độ, tập lại theo bậc" (do Dan ghi lại theo trí nhớ, chờ nhóm xác nhận trước 29/10) |
| **Phụ thuộc** | [T-007](./T-007-suspensions-and-readiness.md) (đã merge), [T-032](./T-032-backend-json-schema-dto-fixes.md) (đã merge) |
| **Lệnh kiểm tra** | `pnpm --filter nestjs-api lint`, `pnpm --filter nestjs-api build`, `pnpm --filter nestjs-api test` (không thêm lỗi so với [BASELINE](./BASELINE.md)) |

## 1. Bối cảnh

Cổng 2 của đình chỉ ([Luồng nghiệp vụ F7](../FIGHT-CAMP-BUSINESS-FLOWS.md)) hứa: võ sĩ còn đình chỉ có hiệu lực thì **không xếp lịch và không bắt đầu được** loại buổi bị chặn (409 `TRAINING_SUSPENSION_ACTIVE`). Kiểm tra code 27/10 cho thấy lời hứa này **thủng ở một đường vào**, và còn bốn chỗ hệ thống chưa làm gì khi có đình chỉ.

### Cổng 2 hiện nối ở đâu (đã kiểm tra)

`TrainingSessionService` (`nestjs-api/src/training/sessions/training-session.service.ts`) gọi `SuspensionGate.blockingSuspensions` ở ba chỗ, qua `assertNotSuspended` (dòng 402) và `assertEligibleAndNotSuspended` (dòng 419):

| Đường vào | Chặn? |
| --- | --- |
| `createSession` (xếp buổi mới, dòng 85) | Có, theo `scheduledAt` của buổi |
| `applySessionUpdateInTransaction` (đổi loại hoặc giờ, dòng 162) | Có |
| `updateSessionStatus` sang `IN_PROGRESS` (bắt đầu buổi, dòng 260) | Có, theo thời điểm bấm |
| **`POST /coaching/assignments`** (`CoachingService.createAssignment`, `nestjs-api/src/coaching/coaching.service.ts:219`) | **Không.** Chèn thẳng vào `trainingSessions` trạng thái `SCHEDULED`, không qua `TrainingSessionService` |

### Các lỗ hổng

- **L1 (lỗi, sửa ở Phần 1).** HLV giao bài qua `POST /coaching/assignments` cho võ sĩ đang đình chỉ vẫn tạo được kế hoạch và buổi tập thuộc loại bị chặn, không có 409. Buổi này nằm trong lịch của võ sĩ như một buổi hợp lệ. `CoachingModule` (`coaching.module.ts`) hiện chỉ import `DatabaseModule` và `VideosModule`, không có `SuspensionGate`.
- **L2 (Phần 2).** Buổi đã xếp **trước** khi có đình chỉ chỉ hiện cảnh báo; HLV phải tự mở `GET /suspensions/:id/conflicts` rồi `POST /suspensions/:id/conflicts/apply` (R28, `training-suspension-conflicts.controller.ts`). Nhận xét review: phải "xử lý ngay".
- **L3 (Phần 2).** Kế hoạch tập (`training_plans.phase`, enum `training_plan_phase` có `rehab`, `schema.ts:137`) không đổi khi võ sĩ bị đình chỉ. Nhận xét review: "camp tự chuyển sang hồi phục".
- **L4 (Phần 2).** Cổng 2 chỉ chặn **theo loại buổi** (`blocked_session_types`). Ruleset mặc định chỉ chặn `SPARRING` (`competition_rulesets.default_blocked_session_types`, `schema.ts:4444`; hằng `DEFAULT_MANUAL_BLOCKED_SESSION_TYPES` trong `suspensions.model.ts`), nên võ sĩ KO vẫn xếp và bắt đầu được `HEAVY_BAG`, `GRAPPLING`, `STRENGTH_CONDITIONING`. Không có khái niệm cường độ trong schema (`grep intensity` ở `schema.ts` không có kết quả). Nhận xét review: "chặn theo cường độ".
- **L5 (Phần 2).** Cho tập lại hiện là một bước duy nhất (`POST /suspensions/:id/clear`), không có bậc. Nhận xét review: "tập lại theo bậc".

## 2. Phạm vi

### Phần 1 (làm ngay): đóng L1

Trong phạm vi:
- Nối Cổng 2 vào `CoachingService.createAssignment`: nếu võ sĩ có đình chỉ có hiệu lực vào `scheduledAt` (mặc định là bây giờ) và chặn `sessionType` (mặc định `SHADOW_BOXING`), trả 409 `TRAINING_SUSPENSION_ACTIVE`, **không tạo plan, không tạo buổi**.
- Dùng lại mã lỗi và hàm có sẵn: `trainingSuspensionActive` (`nestjs-api/src/training/training.error.ts:164`) và `SuspensionGate`. **Không tạo mã lỗi mới.**
- Test cho đường vào này.

Ngoài phạm vi Phần 1:
- Mọi thay đổi ở L2 đến L5.
- Cổng y tế (`MedicalService.evaluateTrainingEligibility`) cũng không được gọi ở `createAssignment`. Đây là lỗ riêng, **chỉ ghi vào handover mục "Việc còn mở"**, không sửa, vì có thể đổi hành vi giao bài đang chạy.
- Frontend, mobile, migration.

## 3. File cần sửa (Phần 1)

| File | Thay đổi |
| --- | --- |
| `nestjs-api/src/coaching/coaching.module.ts` | Import module cung cấp `SuspensionGate` (`SuspensionsModule`, export tại `suspensions.module.ts`). `SuspensionsModule` chỉ import `DatabaseModule` (có chú thích trong file), nên không tạo vòng phụ thuộc; người thực hiện kiểm tra lại khi chạy `build` |
| `nestjs-api/src/coaching/coaching.service.ts` | Inject `SuspensionGate`. Trong `createAssignment`, **trong cùng transaction `tx`, trước khi chèn plan**, gọi `blockingSuspensions(dto.fighterId, sessionType, scheduledAt, tx)`; có kết quả thì `throw trainingSuspensionActive(...)`. `scheduledAt` và `sessionType` đang được tính ở dòng 215 và 216, cần đưa lên trước bước 2 |
| `nestjs-api/src/coaching/coaching.service.spec.ts` | Thêm ca kiểm thử (mục 4) |

Người thực hiện đọc trước: `training-session.service.ts` dòng 85 đến 130 và 402 đến 417 (mẫu gọi cổng), `suspension.gate.ts` (chữ ký, tham số `database` nhận được `tx`).

## 4. Tiêu chí nghiệm thu (Phần 1)

1. `POST /coaching/assignments` với võ sĩ có đình chỉ **đang có hiệu lực**, `sessionType` nằm trong `blockedSessionTypes` của đình chỉ đó: trả **409** với `code: 'TRAINING_SUSPENSION_ACTIVE'`, `details.suspensions` liệt kê đình chỉ chặn. Sau lời gọi, bảng `training_plans` và `training_sessions` **không có dòng mới** (test chứng minh bằng việc `insert` không được gọi).
2. Cùng võ sĩ, `sessionType` **không** nằm trong `blockedSessionTypes`: tạo thành công như cũ.
3. Cùng võ sĩ và `sessionType` bị chặn, nhưng `scheduledAt` **sau** ngày kết thúc đình chỉ (đình chỉ không còn hiệu lực vào ngày đó): tạo thành công.
4. Võ sĩ không có đình chỉ: hành vi không đổi; các test hiện có của `createAssignment` vẫn qua.
5. Không đổi `training-session.service.ts`, không migration, không mã lỗi mới, không thêm thư viện.
6. `lint`, `build`, `test` không thêm lỗi so với [BASELINE](./BASELINE.md); handover ghi số test trước và sau.

## 5. Phần 2 (DRAFT, chưa code): gắn đình chỉ vào giáo án

Mỗi mục dưới đây đổi hành vi hoặc cần dữ liệu mới, nên theo quy định "hỏi trước khi thêm mã lỗi, migration hay hợp đồng mới" thì **chưa viết prompt, chưa code** cho tới khi chủ dự án trả lời. Gợi ý của Claude (ghi để quyết định nhanh, không phải quyết định):

| Mục | Gợi ý | Chạm tới |
| --- | --- | --- |
| L2: xử lý ngay buổi đã xếp | Khi tạo đình chỉ (thủ công hoặc từ kết quả trận), chạy luôn bước "Áp dụng tất cả" của R28 trong cùng giao dịch, ghi rõ lý do trên từng buổi và gửi một thông báo tổng hợp; giữ endpoint `conflicts/apply` cho trường hợp cần chỉnh tay | Đổi R28 từ "đề xuất rồi chờ bấm" sang tự áp dụng; không migration |
| L3: camp tự chuyển sang hồi phục | Khi đình chỉ có hiệu lực, plan `ACTIVE` của võ sĩ có `phase = fight_camp` hoặc `taper` chuyển sang `rehab`, và khôi phục khi đình chỉ hết | Cần chỗ lưu pha trước đó để khôi phục (cột mới, tức là migration) hoặc chấp nhận không khôi phục |
| L4: chặn theo cường độ | Thêm mức cường độ cho loại buổi (ví dụ nhẹ, vừa, nặng) và cho đình chỉ một "mức cho phép tối đa", thay vì liệt kê loại buổi bị chặn | Migration và đổi hợp đồng API đình chỉ |
| L5: tập lại theo bậc | Cho phép nới dần mức cho phép tối đa theo các mốc ngày, thay vì hết đình chỉ là tập được mọi thứ | Phụ thuộc L4; migration |

### Câu hỏi cho chủ dự án

1. L2: tự áp dụng ngay khi tạo đình chỉ, hay vẫn giữ nút bấm của HLV?
2. L3: có cần tự khôi phục pha cũ khi hết đình chỉ không (nếu có thì cần cột mới, tức migration)?
3. L4 và L5: mức cường độ gồm những bậc nào, và loại buổi nào thuộc bậc nào? Tài liệu nghiệp vụ hiện chưa có bảng này, nên Claude không tự đặt.
4. Phần 2 làm trong T-036A hay tách thành T-036B? (Ước lượng sơ bộ: L2 nhỏ, L3 vừa, L4 và L5 lớn.)

Theo nhắc của Dan: các mã T-036 đến T-043 sẽ có ticket chi tiết dần theo đợt; nếu Dan đã đặt mã khác cho phần này thì đổi tên file và dòng tiêu đề, không đổi nội dung.

## 6. Handover

Theo mẫu ở [TEAM-WORKFLOW §6](../TEAM-WORKFLOW.md), file `docs/tickets/T-036A-HANDOVER.md`. Bắt buộc ghi: số test trước và sau, kết quả `lint`, `build`, `test` nguyên văn, và mục "Việc còn mở" nêu lỗ cổng y tế ở `createAssignment`.
