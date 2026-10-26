# T-030 · Frontend: đồng bộ với backend T-007 và T-029, giao diện đình chỉ

| | |
| --- | --- |
| **Trạng thái** | READY (25/10) |
| **Phần** | Frontend (`nextjs-frontend`). Phần A sửa lỗi lệch contract (làm trước, nhỏ). Phần B giao diện đình chỉ (T-007 phần B và C, trước đây chưa có ticket) |
| **Người nhận** | Gemini (`agy`, `gemini-4-argon-high`), chủ dự án chốt 26/10 |
| **Nhánh** | `feat/T-030-frontend-suspensions-sync`, tạo từ `User_Feature` ngày 25/10 (đã có backend T-007 và T-029) |
| **Tài liệu dẫn chiếu** | [T-007](./T-007-suspensions-and-readiness.md), [T-007-HANDOVER](./T-007-HANDOVER.md), [T-029](./T-029-coach-todo-and-weight-feasibility.md), [Luồng nghiệp vụ F7, S3, R4, R27, R28, R32](../FIGHT-CAMP-BUSINESS-FLOWS.md), [Tech spec §6, §9](../FIGHT-CAMP-TECH-SPEC.md), [quy định làm việc](../WORKING-RULES-CLAUDE-AGY.md) |
| **Migration** | Không (frontend). Migration 025 phải đã được áp lên Supabase thì chế độ API mới chạy được |

## Bối cảnh

Backend của T-007 (đình chỉ, Cổng 2, xử lý lịch xung đột, bảng sẵn sàng, cảnh báo R4, tự đình chỉ khi ghi kết quả) và T-029 (thẻ Việc cần làm, kiểm tra khả thi cân, nhắc cân) đã xong. Ngày 25/10 chủ dự án nhờ Claude đối chiếu frontend với backend và thấy **hai chỗ lệch thật** (phần A), cộng các màn của T-007 chưa có (phần B). T-029 phía frontend đã khớp: đổi tên trạng thái cân (`ON_TRACK`, `ABOVE_TARGET`, `OVER_LIMIT`, `NOT_WEIGHED`, `NEUTRAL`), `weightReminder`, kiểm tra cân trên form tạo trận, thẻ Việc cần làm.

## Phần A. Sửa hai chỗ lệch (bắt buộc)

### A1. Thẻ Việc cần làm biến mất khi backend trả mã nguồn mới

Backend (`nestjs-api/src/bouts/bouts-todo.model.ts`, `TODO_SOURCES`) có **12** mã. Frontend chỉ có 10. Hai mã còn thiếu: `SUSPENSION_AWAITING_CLEARANCE` (pha `AFTER`) và `TRAINING_CONFLICTS_WITH_SUSPENSION` (pha `AFTER`, `count` = số đề xuất xử lý lịch). Ở chế độ API, chỉ cần một item mang mã mới là Zod từ chối cả phản hồi; `dashboard/page.tsx` dùng `nullIfServiceFails` nên thẻ **biến mất không báo lỗi**.

Sửa:
- `nextjs-frontend/src/lib/services/bouts.ts`: thêm hai mã vào `z.enum` của `coachTodoSchema` (khoảng dòng 135).
- `nextjs-frontend/src/lib/domain/types.ts`: thêm vào kiểu `CoachTodoSource`.
- `nextjs-frontend/src/app/(app)/coach/dashboard/coach-todo-card.tsx`: thêm hai mã vào bảng `TEXT` (kiểu `Record<CoachTodoSource, MessageKey>` sẽ báo lỗi biên dịch nếu thiếu); `SUSPENSION_AWAITING_CLEARANCE` và `TRAINING_CONFLICTS_WITH_SUSPENSION` đều là việc cần chú ý (cho vào tập `URGENT` nếu muốn tô màu cảnh báo).
- `nextjs-frontend/src/lib/i18n/messages/en.ts` và `vi.ts`: khoá `coachTodo.SUSPENSION_AWAITING_CLEARANCE` ("Đình chỉ chờ xác nhận được tập lại") và `coachTodo.TRAINING_CONFLICTS_WITH_SUSPENSION` ("{count} buổi tập xung đột với đình chỉ", dùng tham số `count`).
- Test: thêm vào `lib/domain/coach-todo.test.ts` hoặc test của service một ca parse phản hồi có cả hai mã mới.

### A2. Lỗi 409 mới của Cổng 2 hiện thành thông báo chung

Xếp buổi tập, sửa loại hoặc ngày, bắt đầu buổi tập khi võ sĩ đang bị đình chỉ giờ trả:
- Chỉ đình chỉ chặn: 409 `TRAINING_SUSPENSION_ACTIVE`, `details: { suspensions: [{ suspensionId, reason, endsOn, requiresClearance }] }`.
- Cả y tế lẫn đình chỉ chặn: 409 **`TRAINING_MEDICAL_ELIGIBILITY_REQUIRED`** (mã cũ giữ nguyên), `details: { reasons, suspensions }`.
- Chỉ y tế chặn: như hiện nay.

Frontend: `lib/services/training-errors.ts` có bảng `TRAINING_ERRORS` chưa có `TRAINING_SUSPENSION_ACTIVE` nên hiện câu lỗi chung; `trainingEligibilityReasons` trả `null` cho mã mới và bỏ qua `details.suspensions` ở ca gộp. Nơi dùng: `lib/actions/training.ts` (dòng 146, 308, 518, 738-739, 806).

Sửa:
- Thêm câu lỗi cho `TRAINING_SUSPENSION_ACTIVE` ("Võ sĩ đang bị đình chỉ, buổi tập loại này bị chặn đến ngày {endsOn}", có nhánh "đang chờ xác nhận được tập lại" khi `requiresClearance` và đã qua `endsOn`).
- Thêm hàm đọc `details.suspensions` (kiểu an toàn, bỏ qua phần tử sai hình dạng), dùng cho cả hai mã lỗi, rồi hiện trong chỗ đang hiện lý do y tế (`data: { reasons }` ở `lib/actions/training.ts:739`).
- Test trong `training-errors.test.ts`: cả ba ca (chỉ đình chỉ, chỉ y tế, cả hai), và `details` sai hình dạng.

## Phần B. Giao diện đình chỉ

Làm sau phần A. Theo [Tech spec §9](../FIGHT-CAMP-TECH-SPEC.md) và [Luồng nghiệp vụ](../FIGHT-CAMP-BUSINESS-FLOWS.md): hub "Trận" của HLV có thêm tab Đình chỉ và tab Sẵn sàng (route hiện có: `routes.coach.bouts = /coach/bouts`). Theo khuôn dịch vụ có sẵn: `lib/services/<x>.ts` (gọi API) + `<x>.demo.ts` (demo mode) + `lib/actions/<x>.ts` (server action), như `bouts`. Mọi chuỗi có vi và en.

### B1. Tab Đình chỉ (HLV, bác sĩ xem; HLV, bác sĩ tạo và kết thúc sớm)
- Danh sách `GET /suspensions` (lọc `fighterId`, `active`), mỗi dòng hiện lý do, khoảng ngày, trạng thái (`UPCOMING`, `ACTIVE`, `AWAITING_CLEARANCE`, `ENDED`), loại buổi tập bị chặn. Sắp theo `startsOn` tăng dần (cũ trước); đảo lại nếu thấy cần.
- Form tạo `POST /suspensions` (bác sĩ và HLV; ADMIN cũng tạo được).
- Nút "Kết thúc sớm" / "Cho tập lại" `POST /suspensions/:id/clear` (chỉ HLV và bác sĩ; ADMIN không thấy nút), bắt buộc ghi căn cứ (`clearanceNote` 3 đến 500 ký tự).
- "Chờ xác nhận" xuất hiện từ `endsOn + 1`, không phải ngày `endsOn`.

### B2. Tab Sẵn sàng (HLV và ADMIN)
- Bảng `GET /readiness`: mỗi võ sĩ một dòng, trạng thái, cân gần nhất, trận đang chạy, tóm tắt đình chỉ (loại buổi bị chặn, loại được tập, ngày dự kiến tập lại; `null` nghĩa là còn chờ xác nhận).
- Bộ lọc hạng cân (kg), ngày thi dự kiến, bộ luật; khi có đủ thì mỗi dòng có `feasibility` và `notReadyReasons`. API trả 422 nếu có `weightLimitKg` hoặc `boutOn` mà thiếu `rulesetId`.
- FIGHTER và DOCTOR nhận 403: ẩn tab với hai vai trò này.

### B3. Xử lý lịch xung đột (R28)
- Trên một đình chỉ: `GET /suspensions/:id/conflicts` trả đề xuất cho từng buổi (đổi sang `RECOVERY`, dời sang ngày sau đình chỉ, hoặc huỷ). Cho chọn bỏ từng buổi, rồi "Áp dụng" gọi `POST /suspensions/:id/conflicts/apply` với `{ sessionIds }`.
- Áp dụng là một giao dịch: lỗi thì không buổi nào đổi (422 nếu có id không nằm trong đề xuất hiện tại).

### B4. Cảnh báo R4 khi tạo trận
- Phản hồi `POST /bouts` có `warnings`; hiện 2 mã mới `FIGHTER_ACTIVE_BOUT` và `FIGHTER_SUSPENDED_PAST_BOUT_DATE` (cùng `WEIGHT_AT_RISK`, `WEIGHT_INSUFFICIENT_DATA` đã có). Cảnh báo không chặn lưu. Mở rộng kiểu `BoutWarningCode`.

### B5. Form ghi kết quả (chỉ làm nếu form đã tồn tại, T-006 phần B)
- Frontend hiện chưa có form ghi kết quả hay cân chính thức. Khi làm: `POST /bouts/:id/result` nhận thêm `suspensionDays` (1 đến 365) và `suspensionOverrideReason` (3 đến 500); phản hồi có `suspensions[]`.
- Lỗi 422: `SUSPENSION_DAYS_REQUIRED` (thua KO hoặc TKO do đòn vào đầu mà bộ luật không có quy tắc: HLV phải nhập số ngày), `SUSPENSION_OVERRIDE_REASON_REQUIRED` (số ngày khác gợi ý mà thiếu lý do), `BOUT_RESULT_INVALID` với `SUSPENSION_DAYS_NOT_ALLOWED` hoặc `SUSPENSION_OVERRIDE_NOT_ALLOWED` (gửi số ngày khi không có đình chỉ nào).

### B6. Võ sĩ xem trạng thái đình chỉ (điện thoại)
- Võ sĩ gọi `GET /suspensions` (chỉ thấy của mình). Hiện trạng thái, loại được tập, ngày dự kiến tập lại; không có nút nào sửa.

## Contract chính xác (đã kiểm trong code backend ngày 25/10)

**Đình chỉ** (`nestjs-api/src/suspensions/suspensions.model.ts`):
- `reason`: `KO | TKO | DQ | MANDATORY_REST | MEDICAL | OTHER`; `status`: `UPCOMING | ACTIVE | AWAITING_CLEARANCE | ENDED`.
- Một đình chỉ: `id`, `fighterId`, `boutId|null`, `reason`, `startsOn`, `endsOn` (`YYYY-MM-DD`), `lossOfConsciousness|null`, `suggestedDays|null`, `overrideReason|null`, `blockedSessionTypes[]` (trong 8 loại buổi tập), `requiresClearance`, `clearedAt|null`, `clearedById|null`, `clearanceNote|null`, `createdById`, `createdAt`, `updatedAt`, `status`.
- `GET /suspensions?fighterId&active&cursor&limit` (limit 1 đến 100, mặc định 20) trả `{ data, hasNextPage, nextCursor }`.
- `POST /suspensions` body: `fighterId`, `reason`, `days` (1 đến 365), `startsOn?` (không trước hôm nay), `blockedSessionTypes?` (mặc định `["SPARRING"]`), `requiresClearance?` (KO và TKO: không được `false`; DQ và MANDATORY_REST: không được `true`; MEDICAL mặc định `true`; OTHER mặc định `false`), `lossOfConsciousness?`. `endsOn = startsOn + days - 1`.
- `POST /suspensions/:id/clear` body `{ clearanceNote }`. Lỗi: 404 `SUSPENSION_NOT_FOUND`, 409 `SUSPENSION_ALREADY_CLEARED`. Quyền `suspension:clear` chỉ HLV, bác sĩ.

**Xử lý lịch xung đột** (`suspensions.model.ts`): mỗi đề xuất `{ sessionId, action: "CHANGE_TYPE" | "RESCHEDULE" | "CANCEL", toType?: "RECOVERY", toScheduledAt? }`.

**Sẵn sàng** (`nestjs-api/src/bouts/bouts.model.ts`): `GET /readiness?weightLimitKg&rulesetId&boutOn`. Mỗi dòng: `fighterId`, `fighterName`, `ready`, `status` (`SUSPENDED | AWAITING_CLEARANCE | IN_BOUT | READY`), `latestWeightKg|null`, `latestWeightOn|null`, `activeBout` (`{ id, eventName, status, boutAt }|null`), `suspension` (`{ startsOn, endsOn, blockedSessionTypes, allowedSessionTypes, expectedResumeOn|null }|null`), `notReadyReasons?` (`SUSPENDED_PAST_BOUT_DATE | ACTIVE_BOUT`), `feasibility?` (`{ status, remainingPct, latestKg, latestOn, daysToWeighIn }`).

**Việc cần làm** (`bouts-todo.model.ts`): item `{ source, phase, fighterId, boutId, eventName, dueOn|null, count|null }`; `truncated` ở cấp phản hồi.

**Kết quả trận** (`bouts.model.ts`): xem B5.

## Ngoài phạm vi
- Thông báo `SUSPENSION_*` (backend chưa gửi; không cần mapping).
- `reactnative-mobile` (chưa đối chiếu).
- Màn ghi cân chính thức và kết quả (T-006 phần B và C), trừ ô nhập số ngày khi form đã có.

## Tiêu chí nghiệm thu
1. A1: phản hồi `GET /coach/todo` có cả hai mã mới vẫn hiện thẻ, với dòng "Đình chỉ chờ xác nhận được tập lại" và "N buổi tập xung đột với đình chỉ"; test parse có hai mã.
2. A2: xếp buổi `SPARRING` cho võ sĩ đang đình chỉ hiện đúng câu lỗi kèm ngày kết thúc; ca cả hai cổng chặn hiện lý do y tế lẫn đình chỉ; ca `details` sai hình dạng không làm trang lỗi.
3. B1: tạo đình chỉ 14 ngày từ ngày mai ra trạng thái `UPCOMING`; `startsOn` trong quá khứ báo lỗi ngay ở form; kết thúc sớm không có căn cứ bị chặn; ADMIN không thấy nút kết thúc.
4. B2: HLV chỉ thấy võ sĩ của mình; võ sĩ có trận `SCHEDULED` nhưng không đình chỉ vẫn "sẵn sàng"; ngày `endsOn` là `SUSPENDED`, `endsOn + 1` là `AWAITING_CLEARANCE` (hoặc `READY` nếu không cần xác nhận).
5. B3: bỏ chọn một buổi thì buổi đó không bị đổi; áp dụng lỗi thì không buổi nào đổi.
6. B4: tạo trận cho võ sĩ đang có trận ở `CAMP` hiện cảnh báo nhưng vẫn lưu được.
7. Demo mode có đủ các màn (dữ liệu mẫu đủ để xem mọi trạng thái), vi và en đủ khoá.

## Lệnh kiểm tra bắt buộc
```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
pnpm --filter nextjs-frontend build
```
**Baseline trên `User_Feature` ngày 25/10:** typecheck có **52 lỗi có sẵn** (admin dashboard `greetingTitle`, form clinical, `training-plans/[planId]/edit`, `account-profile-fields`...) và **19 test lỗi ở 4 file**: `lib/actions/medical-contract.test.ts` (10), `components/layout/navigation.test.ts` (5, test mong đợi tên hub `Today`/`People`, code đang là `Dashboard`/`Users`), `components/dashboard/coach-attention.test.ts` (2) và `dashboard-utils.test.ts` (2, thiếu `greetingTitle`). Nguồn gốc: test và code thuộc hai dòng làm việc khác nhau sau lần merge `fight-camp` ngày 22/10 (commit `d60b9d0` của Hoàng Anh ngày 13/10 và `1fe50de`), không do T-007 hay T-029. Ticket này không được thêm lỗi nào; sửa các lỗi có sẵn là việc riêng. Kiểm tra bằng mắt: chạy `next dev` ở demo mode, xem từng màn ở 390 px và 1440 px, cả hai ngôn ngữ.

## Ghi chú cho người thực hiện
- Đọc `lib/services/bouts.ts`, `bouts.demo.ts`, `lib/actions/bouts.ts` và `app/(app)/coach/dashboard/coach-todo-card.tsx` trước: chúng là khuôn mẫu cho dịch vụ, demo mode, server action và thẻ.
- Chế độ API cần `APP_DATA_MODE=api` và migration 025 đã áp. Tên trường và mã lỗi ở trên là các tên đã duyệt; không thêm tên mới. Thiếu thông tin thì ghi vào mục "Câu hỏi" của handover, không đoán.
