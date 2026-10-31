# T-030 · Frontend: đồng bộ với backend T-007 và T-029, giao diện đình chỉ

| | |
| --- | --- |
| **Trạng thái** | READY (25/10). Phần B viết lại 29/10, Ken nhận, làm qua `agy` trên `feat/T-030-suspension-ui` |
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

### A3. Cổng 2 ở demo mode (thêm 27/10; **không áp dụng** từ 29/10, xem phần B)

Ngày 27/10 kiểm lại: Cổng 2 ở demo mode **đã có** trên nhánh demo `sync/T-004-fight-camp`. Hàm `suspensionGate` trong `lib/services/training.demo.ts` (dòng 671) đọc `demoBlockingSuspensions` của `bouts.demo.ts` và được gọi ở `createSession`, `updateSession` và `startSession` (dòng 470, 544, 698). Nhánh đó cũng đã có trang `/coach/bouts/suspensions`. Trên `fight-camp` chưa có vì nhánh demo chưa merge (36 commit, đếm ngày 27/10).

Việc của A3:

- Làm T-030 trên nền có nhánh demo, hoặc sau khi chủ dự án merge `sync/T-004-fight-camp` vào `fight-camp`. **Không** viết lại cổng demo.
- Đối chiếu phần B với các màn đã có trên nhánh demo (trang Đình chỉ, `suspension-dialogs.tsx`). Màn nào đã có thì chỉ bổ sung phần còn thiếu.
- Đình chỉ tạo tay ở demo mà không chọn loại buổi thì mặc định chặn mọi loại trừ `recovery_mobility`, theo [quyết định 22](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi).

## Phần B (viết lại 29/10): giao diện đình chỉ theo T-036 và T-045

**Quyết định 29/10 của Ken (người nhận T-030 phần B từ 29/10):** làm trên nhánh `feat/T-030-suspension-ui` tạo từ `User_Feature` (= `fight-camp` sau khi merge T-035, T-036, T-045), **không** dựa trên nhánh demo `sync/T-004-fight-camp`. Mục A3 ở trên (dùng cổng demo của nhánh demo) không áp dụng cho phần B này: demo mode viết trên nền `fight-camp`. Khi làm T-040 (gộp nhánh demo) phải chọn một bản cho trang Đình chỉ và cổng demo; báo Dan và Hoàng Anh.

**Thiết kế:** [T-030B-design-brief.md](../design/T-030B-design-brief.md) (Impeccable, chế độ Operate, chủ dự án duyệt 29/10). Ticket này là nguồn cho phạm vi, contract và ca kiểm thử; bản thiết kế là nguồn cho bố cục, trạng thái, chuyển động.

**Code do `agy` viết** (`gemini-3.8-flash-high`; argon hết quota tới khoảng 5/11). Mỗi phần một lượt, một commit, push nhánh; review của Claude và review độc lập (subagent) trước khi sang phần sau. `agy` hiện thực đúng các ca kiểm thử dưới đây, giữ mã ca (B1-1, …) trong tên test, **không sửa kết quả mong đợi**.

### Contract backend dùng cho phần B (đã kiểm trong code 29/10)

- `GET /suspensions?fighterId&active&cursor&limit` → `{ data, hasNextPage, nextCursor }`. Mỗi đình chỉ: các trường ở mục "Contract chính xác" phía dưới, **thêm** `maxAllowedTier` (0–5), `gradedReturn` (`{ ceiling: 3|4, fullReturnOn }` hoặc `null`).
- `POST /suspensions` body: `fighterId`, `reason`, `days`, `startsOn?`, **một trong hai** `blockedSessionTypes?` hoặc `maxTier?` (1–5), `requiresClearance?`, `lossOfConsciousness?`. Mặc định khi không gửi cả hai: chặn mọi loại trừ `RECOVERY`, `PHYSICAL_THERAPY` (quyết định 22). Response thêm `affectedSessions: { sessionId, action: 'PENDING' | 'CANCEL' }[]`, `affectedPlans: { planId, fromPhase, toPhase }[]`.
- `GET /suspensions/:id/conflicts` → đề xuất `{ sessionId, action: 'PENDING' | 'CANCEL' }` (**không còn** `CHANGE_TYPE`, `RESCHEDULE`, `toType`, `toScheduledAt`). `POST .../apply` body `{ sessionIds }`.
- Buổi tập có trạng thái mới **`PENDING`** (Chờ xếp lại). `PENDING → SCHEDULED` chỉ bằng cách đổi `scheduledAt` (PATCH buổi), qua Cổng 2; `PENDING → CANCELLED` bằng endpoint đổi trạng thái có lý do; không bắt đầu được.
- Lỗi 409 `TRAINING_SUSPENSION_ACTIVE`: `details.suspensions[]` mỗi phần tử `{ suspensionId, reason, endsOn, requiresClearance, gradedReturn? }`.
- `GET /readiness?weightLimitKg&rulesetId&boutOn`: mỗi dòng như mục "Contract chính xác", **thêm** `fullReturnOn` và `gradedReturn` (võ sĩ đang tập lại theo bậc có `status = 'SUSPENDED'`, `ready = false`, `gradedReturn` khác `null`).
- Bậc cường độ (backend `SESSION_INTENSITY_TIERS`): 1 `RECOVERY`, `PHYSICAL_THERAPY`; 2 `STRENGTH_CONDITIONING`; 3 `SHADOW_BOXING`, `HEAVY_BAG`, `PAD_WORK`; 4 `GRAPPLING`; 5 `SPARRING`. Frontend dùng một hằng cùng giá trị, có test so khớp.

### Các phần và ca kiểm thử (Claude viết trước code)

Kiểm tra mỗi phần: `pnpm --filter nextjs-frontend lint`, `typecheck`, `test`, không thêm lỗi so với baseline; từ phần B4, chụp màn hình demo mode 1440 px và 390 px.

**B1. Phần A1, A2 của ticket này** (giữ nguyên mô tả A1, A2 ở trên; A3 không làm).

| Ca | Đầu vào | Kết quả mong đợi |
| --- | --- | --- |
| B1-1 | `coachTodoSchema` parse item `source: 'TRAINING_CONFLICTS_WITH_SUSPENSION', count: 3` | Parse được; thẻ hiện "3 buổi tập xung đột với đình chỉ" (vi) |
| B1-2 | Item `source: 'SUSPENSION_AWAITING_CLEARANCE'` | Parse được; thẻ hiện "Đình chỉ chờ xác nhận được tập lại" |
| B1-3 | Lỗi 409 `TRAINING_SUSPENSION_ACTIVE`, `details.suspensions = [{ reason:'KO', endsOn:'2026-12-01', requiresClearance:true }]` | Đọc được 1 đình chỉ; câu lỗi có lý do và ngày, không phải câu lỗi chung |
| B1-4 | Như B1-3 nhưng phần tử có `gradedReturn: { ceiling: 3, fullReturnOn: '2026-12-04' }` | Đọc được trần bậc 3 và ngày tập đầy đủ |
| B1-5 | 409 `TRAINING_MEDICAL_ELIGIBILITY_REQUIRED` có cả `reasons` và `suspensions` | Hiện cả lý do y tế lẫn đình chỉ |
| B1-6 | `details` sai hình dạng (`suspensions: 'x'`, phần tử thiếu `endsOn`) | Không ném lỗi; bỏ phần tử sai; vẫn có câu lỗi |

**B2. Nền dữ liệu**: kiểu dữ liệu (`lib/domain/types.ts`), service `lib/services/suspensions.ts` + `suspensions.demo.ts`, `readiness` (trong `bouts.ts` hoặc file riêng), server action `lib/actions/suspensions.ts`, `SessionStatus` thêm `pending` (map `PENDING` hai chiều trong `lib/services/training.ts`), hằng bậc `lib/domain/intensity-tiers.ts`, từ điển vi/en. Demo mode: dữ liệu mẫu có đủ 5 trường hợp (đang đình chỉ KO; chờ xác nhận; đang tập lại bậc 3 hôm nay; nghỉ bắt buộc có buổi chờ xếp lại; sẵn sàng); tạo đình chỉ ở demo mode áp đúng quyết định 23–25 trên buổi demo.

| Ca | Đầu vào | Kết quả mong đợi |
| --- | --- | --- |
| B2-1 | JSON đình chỉ đúng contract (lấy từ một response mẫu dựng theo `suspensionResponseSchema` của backend) | Parse được, có `maxAllowedTier`, `gradedReturn` |
| B2-2 | Buổi API `status: 'PENDING'` | Thành `pending`; map ngược ra `PENDING` |
| B2-3 | Hằng bậc frontend | Đúng 8 loại, đúng bậc như backend |
| B2-4 | Demo: tạo `OTHER` 7 ngày, `maxTier: 1`, có buổi demo `sparring` ngày thứ 3 | Response demo có `affectedSessions = [{ id, PENDING }]`; buổi thành `pending` |
| B2-5 | Demo: tạo `KO` cần xác nhận, buổi `sparring` sau `startsOn` | Buổi thành `cancelled`; giáo án demo pha `fight_camp` thành `rehab`, có trong `affectedPlans` |
| B2-6 | Demo: tạo với `maxTier: 3` | `blockedSessionTypes = ['SPARRING','GRAPPLING']` (thứ tự backend) |
| B2-7 | Demo: dữ liệu mẫu | Có đủ 5 trường hợp nêu trên |
| B2-8 | Mọi khoá i18n mới | Có ở cả vi và en (test integrity có sẵn qua) |

**B3. Component dùng chung**: `IntensityLadder`, `SuspensionStatusBadge`, `GradedReturnSteps`, badge `pending` trong `SessionStatusBadge`, keyframes trong `globals.css` có khối `prefers-reduced-motion`.

| Ca | Đầu vào | Kết quả mong đợi |
| --- | --- | --- |
| B3-1 | `IntensityLadder maxAllowedTier={3}` | 5 đoạn; đoạn 1–3 "được tập", 4–5 "bị chặn"; mỗi đoạn có nhãn cho trình đọc màn hình |
| B3-2 | `maxAllowedTier={5} ceiling={3}` | Đoạn 4–5 hiện "bị chặn hôm nay" (trần lộ trình) |
| B3-3 | `interactive`, đang bậc 2, nhấn mũi tên phải | `onChange(3)`; nhấn trái ở bậc 1 không xuống dưới 1 |
| B3-4 | `GradedReturnSteps gradedReturn={{ceiling:4, fullReturnOn:'2026-12-04'}}` | Bước 1 đã qua, bước 2 hiện tại, bước 3 có ngày 04/12 |
| B3-5 | `SessionStatusBadge status="pending"` | Chữ "Chờ xếp lại", có icon, khác badge "Chờ xác nhận" |
| B3-6 | CSS | Mọi animation mới nằm trong khối có `@media (prefers-reduced-motion: reduce)` tắt chúng |

**B4. Màn `/coach/bouts/suspensions`** (tab trong hub "Trận"; thêm route vào `lib/routes.ts`): danh sách, thẻ thống kê lọc, panel tạo đình chỉ, bảng tóm tắt hệ quả, form xác nhận tập lại (3–500 ký tự), ẩn nút xác nhận với ADMIN.

| Ca | Đầu vào | Kết quả mong đợi |
| --- | --- | --- |
| B4-1 | Demo, HLV mở trang | Thấy đủ các đình chỉ của võ sĩ mình; số đếm trên từng nút lọc đúng; bấm nút lọc thì danh sách chỉ còn trạng thái đó |
| B4-2 | Tạo `KO` từ panel | Panel chuyển sang bảng tóm tắt: buổi bị huỷ, giáo án sang hồi phục, đọc từ response |
| B4-3 | Chọn `maxTier` và tick loại buổi cùng lúc | Không cho; chỉ một trong hai |
| B4-4 | Lý do `KO` | Công tắc "Cần xác nhận" bật và khoá, có câu giải thích |
| B4-5 | Xác nhận tập lại với căn cứ 2 ký tự | Báo lỗi ngay, không gửi |
| B4-6 | ~~ADMIN mở trang~~ (bỏ 31/10: chỉ HLV, xem B6) | ~~Không có nút "Xác nhận được tập lại"~~. ADMIN mở trang thì bị chuyển về `/admin/dashboard` (B4-14) |
| B4-7 | Không có đình chỉ | Trạng thái rỗng có hướng dẫn |

**B5. Lịch tập** (`/coach/sessions`, chi tiết buổi, form sửa): badge và bộ lọc "Chờ xếp lại", nút "Xếp lại", thẻ giải thích 409.

| Ca | Đầu vào | Kết quả mong đợi |
| --- | --- | --- |
| B5-1 | Buổi `pending` | Badge "Chờ xếp lại"; có nút "Xếp lại"; không có nút "Bắt đầu" |
| B5-2 | Xếp lại vào ngày sau khi hết đình chỉ | Buổi thành `scheduled` |
| B5-3 | Xếp lại vào ngày còn đình chỉ | Thẻ giải thích 409 có lý do, ngày; thang bậc chỉ khi đang tập lại theo bậc (409 thật chỉ gửi `gradedReturn`, không gửi `maxAllowedTier`; sửa 31/10, xem B7); buổi vẫn `pending` |
| B5-4 | Lọc "Chờ xếp lại" | Chỉ còn buổi `pending` |

**B6. Màn `/coach/bouts/readiness`** (tab trong hub "Trận"; chỉ HLV; ẩn với FIGHTER, DOCTOR).
> **Ken quyết 31/10:** bảng Sẵn sàng và màn Đình chỉ chỉ dành cho HLV, không mở cho ADMIN. Code dùng `requireRole("coach")`; ADMIN bị chuyển về `/admin/dashboard` (test B6-admin, B4-14). Backend vẫn cho ADMIN gọi API, chỉ giao diện không có lối vào.

| Ca | Đầu vào | Kết quả mong đợi |
| --- | --- | --- |
| B6-1 | Dòng `ready: true` | Cột "Sẵn sàng" |
| B6-2 | Dòng có `gradedReturn` | Cột "Đang tập lại", có ngày tập đầy đủ |
| B6-3 | Dòng `SUSPENDED` không `gradedReturn`, `AWAITING_CLEARANCE`, `IN_BOUT` | Cột "Chưa sẵn sàng", lý do rõ |
| B6-4 | Lọc hạng cân mà thiếu bộ luật | Không gọi API sai (backend trả 422); form báo cần chọn bộ luật |
| B6-5 | Màn 390 px | Ba cột thành ba nhóm dọc |

**B7. Kiểm tra cuối**: `impeccable detect` trên các file UI mới, chụp màn hình đủ màn ở 1440 px và 390 px cả vi và en, review độc lập, merge vào `User_Feature`.

### Ngoài phạm vi phần B

Màn điện thoại của võ sĩ (Fon), cảnh báo R4 khi tạo trận (B4 cũ, làm sau nếu còn thời gian), form ghi kết quả (B5 cũ), thư viện mới, đổi backend.

### Phần B cũ (25/10, thay bằng phần trên)

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
8. A3: nhánh của T-030 có cổng demo của nhánh demo; đình chỉ tạo tay ở demo mà không chọn loại buổi thì chặn `pad_work` nhưng cho `recovery_mobility`.

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
