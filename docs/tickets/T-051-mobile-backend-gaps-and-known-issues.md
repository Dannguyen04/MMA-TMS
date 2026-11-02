# T-051 · Việc backend cần làm cho mobile và các lỗi đã biết

| | |
| --- | --- |
| **Trạng thái** | DRAFT (31/10, Fon soạn). Chờ Claude rà và chủ dự án chia người nhận |
| **Người nhận** | A và B đã xong. C đến T: chủ dự án chỉ định |
| **Nhánh** | Theo từng phần, tạo từ `fight-camp`: `feat/T-051-<slug>` (A dùng luôn nhánh `feat/T-009-nutrition-backend` của T-009) |
| **Nguồn** | Đối chiếu `origin/fight-camp` `b92d391` (31/10 17:12) với T-009, T-038 B, T-041, T-047, T-048 và app `reactnative-mobile` (bản cập nhật 31/10 tối: thêm E đến K; 20:15 thêm L đến R sau khi dựng T-038 B2; 22:45 cập nhật sau khi áp T-048: J, J1, J2, S; 23:20 thêm T sau khi dựng T-041 trên box, đối chiếu `origin/fight-camp` `a40c499`; 23:35 đổi số thành T-051 sau khi pull `origin/fight-camp` `86b26ac`: A đã xong, sửa J và H theo T-049 và T-050 của backend; 23:40 B đã xong (server lọc sẵn)) |
| **Phụ thuộc** | Không có. Mỗi phần độc lập |
| **Ticket khác số** | Trước đây file này tên T-049. Backend đã dùng [T-049](./T-049-clear-only-when-awaiting.md) (chỉ xác nhận được tập lại khi đình chỉ đang chờ xác nhận, DONE 31/10) và [T-050](./T-050-early-end-by-doctor-exam.md) (bác sĩ khám để kết thúc đình chỉ sớm, đề xuất). Hai ticket đó khác ticket này; trong file này "T-049", "T-050" luôn là ticket của backend |

Chỉ ghi những thiếu sót kiểm được trong code hoặc ticket. Số dòng theo `origin/fight-camp` `b92d391`.

Mỗi phần có ba ý: **Backend cần làm / trả lời**, **Vì sao mobile cần**, **Mobile tạm thời làm gì**.

## A. T-009 phần A (dinh dưỡng): ĐÃ XONG

**Đã xong nhờ T-009 A merge** vào `fight-camp`: commit `62272cb` ("nutrition plan by phase and the daily "ate to plan?" check-in, migration 026 (T-009 A)"), merge qua `13dcddc` (`feat/T-009-nutrition-backend`), duyệt ở `68f5b78`; có trong `origin/fight-camp` `86b26ac`. Có migration `026_bout_nutrition.sql`, `PUT /bouts/:id/nutrition-plan` và `PUT /bouts/:id/nutrition-checkins/:date`.

**Backend không còn việc ở mục này.** Chủ dự án áp migration 026 lên Supabase nếu chưa áp.

**Mobile:** T-009 B2 (Fon) đã mở khoá; mobile sẽ đối chiếu contract trước khi dựng màn.

## B. Lời dặn AI giữa hiệp dài quá 140 ký tự (T-038 B2): ĐÃ XONG, server đã lọc sẵn

**Kiểm lại 31/10 23:40 trên `3c67e11` (gồm `origin/fight-camp` `86b26ac`).** `bout-ai.client.ts` không đổi so với lúc viết mục này; bản trước của mục B đọc sót đoạn lọc.

**Căn cứ**
- Hai lớp khác nhau:
  - Schema **đầu ra gửi Gemini** (`responseSchema`, `bout-ai.client.ts:59-76`): `BETWEEN_ROUNDS` chỉ có `maxItems: 3`, `text` (dòng 68) không có `maxLength`. Prompt (dòng 101-102) dặn "mỗi text tối đa 120 ký tự".
  - Server **kiểm lại kết quả AI** trước khi trả: mỗi lời dặn qua Zod `instruction` với `text: z.string().trim().min(1).max(120)` (`bout-ai.client.ts:18-21`); mục nào không qua `safeParse` thì bị bỏ, rồi lấy tối đa 3 mục (`bout-ai.client.ts:153-165`).
- Khác với hai chỗ trên, `bout-analysis.model.ts:132` và `:143` (`max(140)` trong `roundInputSchema`/`nextRoundPlanSchema`) là **kiểm đầu vào** khi lưu hiệp; đây là chỗ báo 422 nếu một lời dặn `CUSTOM` dài hơn 140 ký tự.

Vì server đã bỏ mọi lời dặn AI dài hơn 120 ký tự, lời dặn AI chọn làm `CUSTOM` luôn ≤ 140 nên không gây 422.

**Backend không còn việc bắt buộc.** Tuỳ chọn, ưu tiên thấp: thêm `maxLength: 120` cho `text` trong `responseSchema` để Gemini ít trả câu bị bỏ (đỡ mất lời dặn).

**Mobile:** giữ lớp ẩn lời dặn > 140 ký tự đã áp ngày 31/10 làm lớp phòng thủ; với server hiện tại lớp này không bao giờ ẩn gì.

## C. Cân hằng ngày: server chưa có quy tắc "một số cân mỗi ngày" (câu hỏi cho backend, chưa quyết)

**Căn cứ**
- `nestjs-api/migrations/003_mma_tms_complete_schema.sql:864-880`: bảng `fighter_measurements` chỉ có `UNIQUE (id, fighter_id)` (dòng 876) và `UNIQUE (supersedes_id)` (dòng 877). Không có ràng buộc theo ngày.
- `nestjs-api/src/fighters/fighters.service.ts:193-221` (`createMeasurement`): võ sĩ chỉ bị kiểm `SELF_REPORTED`, rồi thêm dòng mới. Không kiểm đã có số cân trong ngày hay chưa.
- Đã có `POST /fighters/:id/measurements/:measurementId/supersede` (`fighters.controller.ts:211`).

**Câu hỏi cho backend dev (chưa quyết)**
1. Võ sĩ ghi cân lần hai trong cùng ngày học viện (UTC+7) thì server làm gì? (a) chặn, trả 409; (b) tự tạo bản `supersede` của số cũ; (c) giữ cả hai, biểu đồ lấy số mới nhất trong ngày.
2. Nếu chọn (c), `weight-track` lấy số nào cho mỗi ngày? Ghi rõ trong contract.

**Vì sao mobile cần:** biểu đồ cân của võ sĩ và HLV phải biết mỗi ngày có một số hay nhiều số.

**Mobile tạm thời làm gì:** vẫn gửi `POST` như hiện nay, biểu đồ lấy số mới nhất trong ngày. Không tự chặn ghi lần hai vì server chưa có quy tắc.

**Tiêu chí nghiệm thu (sau khi có quyết định):** có test cho trường hợp ghi hai lần cùng ngày. `GET /bouts/:id/weight-track` trả đúng một điểm mỗi ngày.

**Mở khoá:** màn ghi cân của võ sĩ (T-005 A, T-009 B2) hiển thị đúng khi võ sĩ cân lại trong ngày.

## D. Mã lỗi: thiếu `details` thì không, nhưng cần báo trước khi thêm hoặc đổi tên mã

**Căn cứ**
- `bouts.error.ts:165-177`: `BOUT_REQUIREMENTS_INCOMPLETE` trả `details: { missing, expiring }`. Dòng 275-282: `BOUT_REQUIREMENTS_LOCKED` không có `details` và không cần. Mobile đã xử lý cả hai (`screens/fight-camp/camp-rules.ts`).
- Theo quyết định của chủ dự án (T-038 B2 câu 7 chọn B và danh sách từ ngày 31/10): app **không bao giờ hiện thẳng `message` của server**. Mobile dịch từng mã sang câu tiếng Việt trong `reactnative-mobile/src/i18n/backend-codes.ts`. Mã lạ thì hiện câu chung theo HTTP status, rồi "Không thực hiện được thao tác. Hãy thử lại.".

**Backend cần làm / trả lời**
1. Khi thêm, đổi tên hay bỏ một mã lỗi hoặc một giá trị enum trong danh sách ở phần H, ghi vào handover của nhánh (hoặc báo Fon) để mobile thêm câu tiếng Việt.
2. Xác nhận mọi lỗi nghiệp vụ đều có `code` ổn định. `message` chỉ dùng để debug.

**Vì sao mobile cần:** mã mới mà mobile chưa biết sẽ chỉ hiện câu chung, người dùng không biết phải làm gì.

**Mobile tạm thời làm gì:** dùng câu chung theo HTTP status cho mã lạ.

## E. `BOUT_ROUND_OUT_OF_RANGE` khi gọi AI dặn giữa hiệp (câu hỏi)

**Căn cứ:** `POST /bouts/:id/ai/round-advice/:roundNo` chỉ nhận `roundNo` ≥ 2 và đúng bằng hiệp đã lưu cuối cùng + 1, sai thì trả `BOUT_ROUND_OUT_OF_RANGE`. Cùng mã này cũng dùng khi `PUT /bouts/:id/rounds/:n` có `n` ngoài số hiệp của trận.

**Backend cần trả lời**
1. `roundNo` là hiệp **sắp đánh** (lời dặn cho hiệp n+1 sau khi lưu hiệp n) đúng không?
2. Có thể tách mã riêng cho AI, ví dụ `BOUT_AI_ROUND_NOT_READY` ("chưa lưu hiệp trước"), khác với "số hiệp vượt quá số hiệp của trận" không?
3. Gọi AI cho hiệp cuối + 1 (sau hiệp cuối) thì trả mã nào?

**Vì sao mobile cần:** hai trường hợp cần câu khác nhau cho HLV. "Lưu hiệp trước rồi mới hỏi AI" khác hẳn "trận không có hiệp này".

**Mobile tạm thời làm gì** (đã áp vào app mobile trên `feat/mobile-platform` ngày 31/10, chưa commit): nút "AI dặn" chỉ hiện ở tab hiệp n khi n là hiệp đã lưu cuối cùng, n nhỏ hơn số hiệp của trận và trận ở `WEIGHED_IN` hoặc `COMPLETED`, tức là gọi với `roundNo` = n + 1 (giống điều kiện server). Lưu xong hiệp n thì màn hình ở lại tab n để HLV chọn lời dặn AI. Nếu vẫn gặp mã này thì hiện một dòng "Hiệp này nằm ngoài số hiệp của trận hoặc chưa đến lượt." thay cho khối AI, không chặn lưu hiệp.

## F. Giá trị `result.method` và kết quả trận (xác nhận contract)

**Căn cứ:** `BOUT_METHODS` = `KO, TKO, DECISION, SUBMISSION, DQ, OTHER`; `BOUT_RESULTS` = `WIN, LOSS, DRAW, NO_CONTEST`.

**Mobile đang hiện**

| Mã | Chữ trên app |
| --- | --- |
| KO / TKO | Knock-out (KO) / Knock-out kỹ thuật (TKO) |
| DECISION | Tính điểm |
| SUBMISSION | Khoá siết (đối thủ đầu hàng) |
| DQ | Truất quyền thi đấu |
| OTHER | Khác |
| WIN / LOSS / DRAW / NO_CONTEST | Thắng / Thua / Hoà / Không tính kết quả |

**Backend cần trả lời**
1. Danh sách trên đã đủ và sẽ không đổi trước 10/11 không? Có tách `DECISION` thành đồng thuận / chia điểm / đa số không?
2. `OTHER` có kèm ô ghi chú (ví dụ `result.note`) không? Nếu có, mobile hiện ghi chú thay cho "Khác".
3. Kết quả `WIN`/`LOSS` tính theo võ sĩ của học viện, đúng không?

**Vì sao mobile cần:** màn báo cáo sau trận (T-041) hiện "Cách kết thúc" từ mã này.

**Mobile tạm thời làm gì:** dùng bảng trên. Mã lạ hiện "Chưa rõ".

## G. Định dạng video được nhận (`VIDEO_FORMAT_UNSUPPORTED`)

**Căn cứ:** `nestjs-api/src/videos` trả `VIDEO_FORMAT_UNSUPPORTED`, nhưng mobile chưa đối chiếu danh sách định dạng hay giới hạn dung lượng.

**Backend cần trả lời**
1. Định dạng nào được nhận: chỉ MP4 và MOV, hay có cả WebM, M4V, 3GP? Kiểm theo đuôi tệp, MIME hay codec?
2. Dung lượng tối đa của `VIDEO_TOO_LARGE` và của `VIDEO_STORAGE_FILE_TOO_LARGE` là bao nhiêu? Hai mã khác nhau ở đâu?

**Vì sao mobile cần:** câu lỗi phải nói đúng định dạng và dung lượng, và app nên kiểm trước khi tải lên để võ sĩ không mất dung lượng mạng.

**Mobile tạm thời làm gì:** hiện "…Chọn tệp MP4 hoặc MOV." (chưa xác nhận). Sẽ sửa theo câu trả lời.

## H. Danh sách mã lỗi và enum mobile đang dịch (để backend báo khi đổi)

Nguồn: `reactnative-mobile/src/i18n/backend-codes.ts`.

- **Chung:** `NETWORK_ERROR`, `VALIDATION_ERROR`, `TOO_MANY_REQUESTS`. Dự phòng theo HTTP status: 0, 400, 401, 403, 404, 422, 429.
- **Trận (`BOUT_*`, 33 mã):** `BOUT_NOT_FOUND`, `BOUT_FIGHTER_NOT_FOUND`, `BOUT_ACTIVE_EXISTS`, `BOUT_COACH_REQUIRED`, `BOUT_COACH_NOT_ASSIGNED`, `BOUT_NOT_IN_FUTURE`, `BOUT_INVALID_SCHEDULE`, `BOUT_INVALID_WEIGHT_CLASS`, `BOUT_CHANGE_REASON_REQUIRED`, `BOUT_PLAN_INVALID`, `BOUT_REQUIREMENT_EXISTS`, `BOUT_REQUIREMENT_INVALID`, `BOUT_REQUIREMENT_NOT_FOUND`, `BOUT_REQUIREMENTS_INCOMPLETE`, `BOUT_REQUIREMENTS_LOCKED`, `BOUT_FIGHT_WEEK_TOO_EARLY`, `BOUT_INVALID_TRANSITION`, `BOUT_STATE_CONFLICT`, `BOUT_NOT_STARTED`, `BOUT_WEIGH_IN_TOO_EARLY`, `BOUT_WEIGH_IN_NOT_FAILED`, `BOUT_INVALID_CATCHWEIGHT`, `BOUT_RESULT_INVALID`, `BOUT_ROUNDS_NOT_SET`, `BOUT_ROUND_OUT_OF_RANGE`, `BOUT_ROUNDS_BELOW_RECORDED`, `BOUT_ROUNDS_INCOMPLETE`, `BOUT_ROUND_MARK_UNKNOWN`, `BOUT_NEXT_ROUND_PLAN_LAST_ROUND`, `BOUT_AI_NO_OBSERVATIONS`, `BOUT_AI_ALREADY_DECIDED`, `BOUT_CHECK_VIOLATION`, `BOUT_OPERATION_FAILED`.
- **Video (`VIDEO_*`):** `VIDEO_NOT_FOUND`, `VIDEO_FORMAT_UNSUPPORTED`, `VIDEO_SIZE_REQUIRED`, `VIDEO_TOO_LARGE`, `VIDEO_STORAGE_FILE_TOO_LARGE`, `VIDEO_STORAGE_REJECTED`, `VIDEO_STORAGE_UNAVAILABLE`, `VIDEO_SESSION_MISMATCH`, `VIDEO_JOB_EXISTS`.
- **Gợi ý AI:** `status` `OK`, `FAILED`; `errorCode` `NOT_CONFIGURED`, `TIMEOUT`, `QUOTA`, `UPSTREAM`, `EMPTY`; `kind` `PRE_BOUT_TACTICS`, `BETWEEN_ROUNDS`, `VIDEO_OBSERVATIONS`; `decision` `ACCEPTED`, `PARTIAL`, `REJECTED`; `safety` `RED`; cờ `cached`.
- **Kết quả trận:** xem phần F.

- **Đình chỉ (ghi để biết, mobile chưa dịch):** `SUSPENSION_NOT_AWAITING_CLEARANCE` (409, T-049 của backend). Mobile không gọi `POST /suspensions/:id/clear` nên không gặp mã này; chưa thêm câu tiếng Việt. Nếu sau này mobile có nút xác nhận thì thêm câu "Chỉ xác nhận được khi đình chỉ đã hết hạn và đang chờ xác nhận." (giống web).

**Backend cần trả lời:** có mã nào trong `bouts.error.ts`, `videos` hay các module khác mà võ sĩ, HLV hoặc bác sĩ có thể gặp trên điện thoại nhưng không có trong danh sách trên không (ví dụ mã của `suspensions`, `fighters/measurements`, `training-sessions`)?

**Mobile tạm thời làm gì:** mã không có trong danh sách hiện câu chung theo HTTP status.

## I. AI dặn giữa hiệp chưa từng trả lời thật (T-038 A)

**Căn cứ:** `docs/tickets/T-038B-ai-suggestions-ui.md:9`: "Gemini thật chưa trả lời được lần nào".

**Backend cần làm / trả lời**
1. Bật được Gemini trên môi trường demo, hoặc nói rõ khi nào bật.
2. Nếu đến tổng duyệt 9/11 vẫn chưa bật: endpoint trả `FAILED` + `NOT_CONFIGURED` (để app hiện "AI chưa được bật") hay có chế độ trả gợi ý mẫu?
3. Thời gian chờ tối đa phía server là bao nhiêu? T-038 B yêu cầu mobile chờ ≤ 12 giây.

**Vì sao mobile cần:** chưa kiểm được ở API mode (T-040 C) nếu AI chưa trả lời lần nào.

**Mobile tạm thời làm gì** (đã áp vào app mobile trên `feat/mobile-platform` ngày 31/10, chưa commit): demo mode dùng 3 lời dặn mẫu có nhãn "Gợi ý mẫu (demo)", không gọi server. API mode chờ tối đa 12 giây rồi hiện "AI không trả lời kịp". `FAILED` hiện một dòng theo `errorCode` (ví dụ `NOT_CONFIGURED` → "AI chưa được bật"), không có nút thử lại, không chặn lưu hiệp.

## J. Đình chỉ: `maxAllowedTier`, `gradedReturn` và buổi `PENDING` (đã đọc code, việc sửa là của mobile)

**Căn cứ**
- Backend đã trả `maxAllowedTier` và `gradedReturn` (`suspensions.model.ts:955-975`). Kiểu `Suspension` của mobile (`reactnative-mobile/src/api/fight-camp.ts:82-86`) chưa có hai trường này.
- Enum DB có `PENDING` (`database/schema.ts:152`), `listSessions` (`training-session.service.ts:55-72`) không loại trạng thái nào. Mobile chưa có `PENDING` trong `SESSION_STATUSES` (`reactnative-mobile/src/api/types.ts:143-151`, `one-tap.types.ts:59`).

**Đã trả lời được từ code (origin/fight-camp, 31/10)**
1. `maxAllowedTier` là số nguyên 0–5 (`suspensions.model.ts:966`). 0 nghĩa là chưa được tập loại nào. Bậc: 1 hồi phục, vật lý trị liệu; 2 thể lực; 3 đánh gió, đánh bao, đánh đích; 4 vật; 5 đấu tập (`suspensions.constants.ts:27-39`).
2. `gradedReturn` có dạng `{ ceiling: 3 | 4, fullReturnOn }` hoặc `null` (`suspensions.model.ts:951-953`, `:975`). Chỉ khác `null` khi lý do là KO/TKO, đình chỉ đã ENDED và đang trong 2 ngày tập lại (`:187-218`).
3. Hai giá trị trên tính theo từng đình chỉ, server không gộp. Có nhiều đình chỉ thì mobile tự chọn cái để hiện (T-048 dòng 47).
4. Võ sĩ không bắt đầu được buổi `PENDING`: `PENDING` chỉ chuyển sang `SCHEDULED` hoặc `CANCELLED` (`training.constants.ts:25`).

**Mobile làm gì** (T-048, đã áp 31/10 trên `feat/mobile-platform`, chưa commit): bổ sung hai trường và `PENDING` vào kiểu dữ liệu; buổi `PENDING` không có nút bắt đầu hay hoàn thành; giá trị lạ hiện "Chưa rõ".

**Quy tắc hết đình chỉ (đã kiểm từ code, origin/fight-camp)**
- Cần xác nhận hay không (`requiresClearance`) theo lý do (`suspensions.model.ts:243-272`): KO/TKO luôn cần, không tắt được; MEDICAL mặc định cần; DQ/MANDATORY_REST không bao giờ cần; OTHER mặc định không cần.
- Trạng thái tính lúc đọc theo ngày hiện tại, không có cron (`suspensions.model.ts:107-122`, `suspensions.service.ts:327-328`): đã xác nhận → ENDED; trước `startsOn` → UPCOMING; đến hết `endsOn` → ACTIVE; sau `endsOn` → AWAITING_CLEARANCE nếu cần xác nhận, còn không thì ENDED. Đình chỉ cần xác nhận vẫn chặn buổi tập cho đến khi được xác nhận (`suspensions.model.ts:124-137`, `suspension.gate.ts:35-45`).
- Xác nhận qua `POST /suspensions/:id/clear` kèm `clearanceNote`, chỉ HLV hoặc bác sĩ được phân công cho võ sĩ (`suspensions.controller.ts:115-146`). **Từ T-049 của backend (DONE 31/10, có trong `86b26ac`):** chỉ xác nhận được khi đình chỉ đang `AWAITING_CLEARANCE` vào ngày gọi (`suspensions.service.ts:154-198`). Trạng thái khác trả 409 `SUSPENSION_NOT_AWAITING_CLEARANCE` kèm `details.status` (`suspensions.error.ts:35`); đã xác nhận rồi vẫn trả `SUSPENSION_ALREADY_CLEARED`. Không còn kết thúc sớm qua đường này.
- Kết thúc sớm: [T-050](./T-050-early-end-by-doctor-exam.md) của backend **mới là đề xuất, chưa có code**. Chỉ cho `MEDICAL` và `OTHER`; HLV hoặc võ sĩ yêu cầu khám, bác sĩ được phân đồng ý hoặc từ chối. KO/TKO vẫn phải đủ ngày rồi xác nhận.
- **Việc mobile sắp làm (chưa code):** theo T-050 của backend, nút "Yêu cầu khám để kết thúc sớm" cho võ sĩ trên điện thoại làm tiếp trong T-048, sau khi T-050 được duyệt và có API.
- Tập lại theo bậc sau ENDED (chỉ KO/TKO, `suspensions.model.ts:177-223`, chặn ở `suspension.gate.ts:47-58`): ngày đầu (ngày xác nhận, hoặc `endsOn + 1` nếu không cần xác nhận) tập đến bậc 3; ngày thứ hai đến bậc 4; từ ngày thứ ba (`fullReturnOn`) tập đầy đủ.

### J1. `active=true` không bao giờ trả đình chỉ đang tập lại theo bậc (cần backend quyết)

**Căn cứ**
- `suspensions.repo.ts:379-389`: `active=true` chỉ lấy đình chỉ `clearedAt` rỗng, đã bắt đầu (`startsOn ≤ hôm nay`) và (`endsOn ≥ hôm nay` hoặc `requiresClearance`).
- `suspensions.model.ts:194-199`: `gradedReturn` chỉ khác `null` khi đình chỉ **đã hết hiệu lực** (ENDED). Nếu cần xác nhận thì còn phải đã được xác nhận (`clearedAt` có giá trị).
- Hai điều kiện không bao giờ trùng nhau. Vì vậy T-048 dòng 37 (`listSuspensions({ active: true })`) mâu thuẫn với ca F4 và F7: lọc `active=true` thì không bao giờ có đình chỉ có `gradedReturn`. `active=true` cũng không trả đình chỉ UPCOMING.

**Mobile đang làm (phương án A, đã chốt 31/10; T-048, đã áp 31/10 trên `feat/mobile-platform`, chưa commit):** gọi `GET /suspensions` **không** lọc `active`, đọc hết các trang, rồi tự giữ trên máy: UPCOMING, ACTIVE, AWAITING_CLEARANCE và ENDED có `gradedReturn ≠ null`.

**Phương án B (để backend quyết)**
- Backend cần làm, chọn một:
  - mở rộng `active=true` để trả thêm đình chỉ ENDED mà `gradedReturn` còn chạy (trong 2 ngày tập lại sau `endsOn + 1` hoặc sau ngày xác nhận); hoặc
  - thêm bộ lọc mới, ví dụ `current=true` hoặc `includeGradedReturn=true`, để không đổi nghĩa của `active=true`.
- Test cần sửa: test của `suspensions.repo` và `suspensions.service` cho bộ lọc `active` (hoặc thêm test cho bộ lọc mới), cùng các ca KO/TKO có và không cần xác nhận, ngày 0 và ngày 1.
- Ảnh hưởng tới nơi khác: nếu đổi nghĩa `active=true` thì màn HLV (T-030 B) và web đang dùng `active=true` sẽ thấy thêm các đình chỉ đang tập lại, nên cần rà các màn đó (ví dụ câu lỗi 409, danh sách đình chỉ đang hiệu lực). Thêm bộ lọc mới thì không ảnh hưởng ai.
- Được gì: mobile bỏ được phần logic "đang hiệu lực" viết lại trên máy, tải ít dữ liệu hơn (không phải đọc cả lịch sử) và chỉ còn một nguồn đúng là server.
- Cách khác: giữ nguyên backend và sửa T-048 dòng 37 cho đúng (không lọc `active`, chọn trên máy như phương án A).

**Cần Dan/Claude chọn:** B (kiểu nào) hay sửa dòng 37. Nếu chọn B, mobile sẽ chuyển sang bộ lọc của server.

### J2. Buổi `PENDING` không có lý do xếp lại

Buổi `PENDING` không kèm lý do hay đình chỉ gây ra. Với T-048 vậy là đủ: mobile chỉ hiện "Chờ xếp lại" và "HLV sẽ xếp lại buổi này". Ghi lại để biết, không cần sửa.

## K. T-047 AI xem video sau trận: chưa có contract

**Căn cứ:** T-047 còn DRAFT 29/10, chưa có contract, chưa có nhánh.

**Backend cần trả lời:** khi chốt contract, liệt kê luôn `kind`, `status`, `errorCode` và mã lỗi mới (nếu có) để mobile thêm vào phần H. `VIDEO_OBSERVATIONS` đã có trong danh sách AI `kind`; đây có phải loại dùng cho T-047 không?

**Vì sao mobile cần:** màn báo cáo sau trận của Fon (T-041) sẽ hiện phần này.

**Mobile tạm thời làm gì:** không dựng gì cho T-047.

## L. Cho phép sửa quyết định của HLV với gợi ý AI (câu hỏi)

**Căn cứ:** `bouts.service.ts` `decideAiSuggestion`: đã có `decision` thì trả 409 `BOUT_AI_ALREADY_DECIDED`. Spec `bout-ai.service.spec.ts` kiểm đúng hành vi này.

**Backend cần trả lời:** có cho `PATCH /bouts/:id/ai/suggestions/:suggestionId` ghi đè quyết định (ví dụ khi HLV lưu lại hiệp n với lựa chọn khác) không? Nếu có thì giữ lịch sử quyết định cũ hay chỉ giữ bản mới nhất?

**Vì sao mobile cần:** HLV có thể quay lại tab hiệp n, đổi lời dặn AI rồi bấm "Lưu lại hiệp n". Hiện quyết định đầu tiên được giữ, quyết định sau không được ghi.

**Mobile tạm thời làm gì** (đã áp vào app mobile trên `feat/mobile-platform` ngày 31/10, chưa commit): cách A. Mỗi gợi ý chỉ gửi quyết định một lần, lúc lưu hiệp. Gặp 409 thì coi như thành công, không báo lỗi. Gợi ý đã có `decision` trong lịch sử thì không gửi lại. **Quyết định của chủ dự án:** nếu backend chấp nhận sửa thì mobile theo cách B (gửi quyết định mới nhất mỗi lần lưu), còn không thì giữ cách A.

## M. Mã băm cache có cả `nextRoundPlan` của hiệp n (ưu tiên thấp)

**Căn cứ:** `bouts.service.ts` `generateAiSuggestion`: `inputHash` lấy từ toàn bộ `rounds` (mọi trường của `roundInputSchema`, gồm `nextRoundPlan`). `findAiCache` chỉ trả dòng `OK` trùng hash.

**Backend cần trả lời:** có nên bỏ `nextRoundPlan` của chính hiệp n khỏi dữ liệu băm khi xin lời dặn cho hiệp n + 1 không? Lời dặn của AI không dựa vào kế hoạch HLV vừa chọn.

**Vì sao mobile cần:** sau khi HLV chọn lời dặn AI và lưu lại hiệp n, hash đổi. Nếu HLV bấm "AI dặn" lần nữa thì server gọi Gemini mới (tốn lượt, chờ đến 12 giây, có thể ra lời dặn khác) thay vì trả bản cache.

**Mobile tạm thời làm gì** (đã áp vào app mobile trên `feat/mobile-platform` ngày 31/10, chưa commit): sau khi lưu không gọi lại `round-advice` mà đọc lịch sử (phần R), nên chỉ ảnh hưởng khi HLV tự bấm "AI dặn" lần nữa sau khi đổi kế hoạch. Hiện nút này không hiện lại khi đã có gợi ý trên màn hình.

## N. Server không đối chiếu `decision` với `acceptedItemIds` (câu hỏi)

**Căn cứ:** `aiDecisionSchema` (`bout-analysis.model.ts:13-16`) và `decideAiSuggestion` chỉ kiểm mỗi id có trong danh sách của gợi ý và không trùng. Ví dụ `ACCEPTED` với `[]` hay `REJECTED` với `["ai1"]` vẫn được nhận.

**Backend cần trả lời:** đây có phải chủ ý không? Nếu không, đề xuất: `ACCEPTED` = đủ mọi id, `PARTIAL` = một phần, `REJECTED` = `[]`, sai thì 422.

**Vì sao mobile cần:** số liệu "HLV dùng bao nhiêu lời dặn AI" sẽ sai nếu client gửi không nhất quán.

**Mobile tạm thời làm gì** (đã áp vào app mobile trên `feat/mobile-platform` ngày 31/10, chưa commit): tự tính theo lời dặn AI đang hiện: chọn hết → `ACCEPTED`, chọn một phần → `PARTIAL`, không chọn → `REJECTED` với `[]`. Lời dặn bị ẩn vì quá 140 ký tự không tính.

## O. Có ghi `REJECTED` cho gợi ý `FAILED` không (câu hỏi)

**Căn cứ:** `decideAiSuggestion` không chặn gợi ý `FAILED`. Danh sách lời dặn rỗng nên chỉ gửi được `acceptedItemIds: []`.

**Backend cần trả lời:** mobile có nên gửi `REJECTED` cho gợi ý `FAILED` (để thống kê) hay bỏ qua? Hay server nên chặn quyết định trên dòng `FAILED`?

**Vì sao mobile cần:** để biết khi nào gửi `PATCH`.

**Mobile tạm thời làm gì** (đã áp vào app mobile trên `feat/mobile-platform` ngày 31/10, chưa commit): không gửi gì cho gợi ý `FAILED`, và cũng không gửi khi không có lời dặn nào hiện được.

## P. `tacticId` trong lời dặn AI (câu hỏi)

**Căn cứ:** `generateAiSuggestion` trả `tacticId` (đã đổi về id thật) cho mục `BETWEEN_ROUNDS` nếu khớp chiến thuật. `instructionSchema` cho phép `tacticId` ở mọi mã, kể cả `CUSTOM`.

**Backend cần trả lời**
1. Khi HLV chọn lời dặn AI thành mục `CUSTOM`, có nên giữ `tacticId` không?
2. Nếu giữ, server có kiểm `tacticId` thuộc chiến thuật của trận (gồm chiến thuật thêm ở hiệp trước) khi `PUT /bouts/:id/rounds/:n` không? Sai thì trả mã nào?

**Vì sao mobile cần:** báo cáo sau trận (T-041) có thể muốn nối lời dặn AI với chiến thuật.

**Mobile tạm thời làm gì** (đã áp vào app mobile trên `feat/mobile-platform` ngày 31/10, chưa commit): bỏ `tacticId`, chỉ gửi `{ code: "CUSTOM", text }`.

## Q. Kết quả lỗi không được cache

**Căn cứ:** `findAiCache` (`bouts.repo.ts`) chỉ lấy dòng `status = 'OK'`. Dòng `FAILED` vẫn được ghi nhưng không dùng lại.

**Backend cần trả lời:** sau `QUOTA` hay `UPSTREAM`, mỗi lần bấm lại đều gọi Gemini và tốn lượt. Có cần giới hạn (ví dụ cache `FAILED` trong vài phút, hoặc trả `TOO_MANY_REQUESTS`) không?

**Vì sao mobile cần:** tránh HLV vô tình làm hết lượt AI ngay ở góc đài.

**Mobile tạm thời làm gì** (đã áp vào app mobile trên `feat/mobile-platform` ngày 31/10, chưa commit): không có nút thử lại sau lỗi. Mỗi lần lưu hiệp không tự gọi lại AI.

## R. Lịch sử gợi ý AI: tối đa 20 dòng, không lọc theo hiệp

**Căn cứ:** `GET /bouts/:id/ai/suggestions` (`bouts.controller.ts:400`) chỉ nhận `kind`. `listAiSuggestions` (`bouts.repo.ts`) sắp theo `createdAt` giảm dần và `limit(20)` cho cả trận, gồm cả dòng `FAILED`.

**Backend cần làm / trả lời:** thêm tham số `roundNo` (ví dụ `?kind=BETWEEN_ROUNDS&roundNo=3`), hoặc xác nhận 20 dòng là đủ cho một trận.

**Vì sao mobile cần:** mobile dùng endpoint này để hiện lại lời dặn AI sau khi lưu hiệp và khi HLV mở lại màn. Trận nhiều hiệp, bấm lại nhiều lần thì dòng của hiệp n + 1 có thể bị đẩy ra khỏi 20 dòng.

**Mobile tạm thời làm gì** (đã áp vào app mobile trên `feat/mobile-platform` ngày 31/10, chưa commit): đọc `?kind=BETWEEN_ROUNDS`, lấy dòng `OK` mới nhất có `roundNo` = n + 1 và có lời dặn hiện được. Gợi ý đã có `decision` thì không gửi lại quyết định. Đọc lỗi thì giữ nguyên màn hình, không báo lỗi. Gợi ý đọc lại từ lịch sử có dòng nhỏ "Gợi ý lấy lại từ lần trước".

## S. Lỗi đã biết, không do patch mobile

Kiểm lại ngày 31/10 22:45 sau khi áp t037b+vi+t038b2, phase 4 và T-048, và sau khi cài `expo-image-picker`. Kết quả: jest chạy toàn bộ 548/551 bài qua, 3 bài lỗi: S1, S2 và S3 (lúc lỗi lúc qua). tsc có 40 lỗi, không lỗi nào nằm trong file của patch. **Cập nhật 31/10 23:43**, sau khi pull `origin/fight-camp` (HEAD `3c67e11`) và áp T-041: jest toàn bộ 560/564 bài qua, 4 bộ lỗi: S1, S2 và S3 (lúc lỗi lúc qua, nay gồm cả `doctor-detail`). tsc vẫn 40 lỗi, không lỗi nào nằm trong file của patch. Mục này chỉ ghi lại, chưa sửa code.

### S1. Bài `measurement role baseline` (`src/api/role-contracts.test.ts:19`)

- **Lỗi:** bài chờ `roleMayWriteMeasurements("FIGHTER")` trả `false`, nhưng code trả `true`.
- **Nguyên nhân:** commit `a999519` (27/10) đã cho FIGHTER ghi số đo (`ADMIN || FIGHTER`) nhưng không sửa bài test. Backend (fight-camp `b92d391`, `POST /fighters/:id/measurements`) cũng cho võ sĩ tự ghi số đo với ngữ cảnh SELF_REPORTED. Vậy code đúng, bài test đã cũ.
- **Người sửa:** mobile.
- **Cách sửa:** đổi dòng 19 thành chờ `true`. Kiểm lại các dòng 20–22 xem có cùng giả định cũ không.

### S2. Bài `video-upload.test.tsx:110` ("keeps the draft across cancel, file selection…")

- **Lỗi:** sau khi cài `expo-image-picker`, bộ test này mới chạy được, nhưng bài thứ hai lỗi vì không tìm thấy chữ "Không có quyền mở thư viện video." Chạy riêng bộ này: 1 lỗi, 1 qua.
- **Nguyên nhân:** màn hình báo lỗi quyền bằng toast (`useToastMessage(form.error, "error")`), không hiện chữ ngay trên màn. Bài test lại tìm chữ đó trong cây màn hình, nơi không có toast. Patch chỉ đổi cách đọc lỗi khi gửi lên server (`messageFor`), không đụng đến lỗi quyền. Trước đây lỗi này bị che vì thiếu thư viện nên cả bộ test không chạy.
- **Người sửa:** mobile.
- **Cách sửa (chọn một):** (a) cho bài test bọc màn hình trong ToastProvider hoặc giả lập `useToastMessage` rồi kiểm toast; (b) nếu muốn người dùng luôn thấy lỗi quyền ngay tại nút chọn video, hiện thêm một dòng lỗi trên màn. Đề xuất (a), vì không đổi giao diện.

### S3. Các bộ test lúc lỗi lúc qua (`AuthSelectField`, "Video & AI", `doctor-detail`, `body3d`, `auth-date-field`, `coach-nav`)

- **Lỗi:** ở lần chạy toàn bộ trước đó, hai bộ này lỗi. Chạy riêng thì qua. Lần chạy toàn bộ khoảng 20:45 qua, lần 22:45 thì "Video & AI" lại lỗi (chạy riêng vẫn qua). Chạy riêng lại: `AuthSelectField` 1/1 qua; nhóm "Video" 70/71 qua, bài lỗi duy nhất là S2.
- **Thêm sau khi pull `3c67e11` (31/10 23:30–23:43):** `src/screens/doctor/detail/doctor-detail.test.tsx` ("Tổng quan: đầu hồ sơ + các thẻ; badge Khám…"), `src/components/body3d/body3d.test.tsx` ("3D + danh sách (có Vùng khác)…") và `src/components/auth/auth-date-field.test.tsx` ("dismisses the keyboard before opening…") lỗi trong lần chạy toàn bộ, chạy riêng thì qua. `doctor-detail` lỗi ở cả lần chạy sau khi áp T-041 (23:43), chạy riêng cùng các bộ fight-camp vẫn 108/108 qua. Lần pull không đổi file nào trong `reactnative-mobile`, T-041 không đụng các màn này.
- **Thêm 01/11 (UTC+7), sau khi áp Phase 5 A, D, F, E:** bộ `coach-nav` (`src/screens/coach/nav/coach-nav.test.tsx`) lỗi trong lần chạy toàn bộ trên máy (590/595 qua, 5 bộ lỗi: S1, S2, `doctor-detail`, `video-ai-screens`, `coach-nav`). Chạy riêng thì qua. Các patch Phase 5 chỉ đổi bố cục, không đổi logic của màn này.
- **Nguyên nhân có thể:** bài phụ thuộc thời gian hoặc thứ tự khi jest chạy song song và máy bận (hết thời gian chờ `findBy…`, timer giả hoặc mock dùng chung chưa được dọn giữa các bài). Chưa thấy lỗi lặp lại được nên chưa chỉ ra được dòng cụ thể.
- **Người sửa:** mobile.
- **Cách sửa:** chạy `npx jest --runInBand` vài lần để xem có tái hiện không. Nếu có, thêm `afterEach(() => { jest.useRealTimers(); jest.clearAllMocks(); })` và tăng thời gian chờ `findBy` ở bài chậm.

### S4. 40 lỗi tsc (không có trong file của patch)

| Nhóm | File (số lỗi) | Nguyên nhân | Người sửa | Cách sửa |
| --- | --- | --- | --- | --- |
| Test dùng API của Node | `video-ai.swagger.test.ts` (2), `pending-review-card.test` (2), `medical-screen.reads.test` (3), `one-tap.test` (2), `status-actions.test` (2), `video-upload.test` (1, `global`) | Test đọc file bằng `fs`, `__dirname`, `global`, nhưng tsconfig không có kiểu của Node | mobile | Thêm `"types": ["node", "jest"]` cho file test (tsconfig riêng cho test) hoặc dùng `globalThis`. Không cần thêm thư viện nếu `@types/node` đã có sẵn |
| auth-shell | `auth-shell.tsx` (6), `auth-text-field.tsx` (1), `auth-vision-tokens.test` (1) | Code viết theo kiểu RN cũ; RN 0.86 đổi kiểu ref (`ReactNativeElement`) và `ColorSchemeName` | mobile, sau khi chủ dự án quyết | Xem ghi chú dưới bảng |
| launch/splash | `launch-gate` (1), `mma-splash` (10), `splash-glass-shatter` (5), `splash-hud-overlay` (1), `splash-video-player` (2) | RN 0.86 bỏ `StyleSheet.absoluteFillObject`, kiểu style chặt hơn, có phép so sánh màu không bao giờ đúng | mobile, sau khi chủ dự án quyết | Xem ghi chú dưới bảng |
| Test theme | `theme-preference.test.tsx` (1) | Kiểu `AppearanceListener` đổi trong RN 0.86 | mobile | Ép kiểu listener trong bài test hoặc sửa mock theo kiểu mới |

**Ghi chú cho chủ dự án:** ở nhánh `fight-camp` (`b92d391`), việc T-044 A đã xoá hai thư mục `src/components/launch` và `src/components/auth`. Nếu nhánh mobile sẽ theo fight-camp thì 26 lỗi của hai nhóm này tự hết khi gộp nhánh, không nên sửa. Nếu giữ hai thư mục này thì mobile cần sửa theo RN 0.86 (đổi `absoluteFillObject` thành `absoluteFill`, sửa kiểu ref và style). Cần chủ dự án chọn hướng.

### S5. Nhãn trạng thái ở thư viện video hiện thẳng mã backend khi gặp giá trị lạ (ĐÃ SỬA trong Phase 5 patch C)

- **Lỗi:** `analysisBadge` và `videoProcessingBadge` trong `reactnative-mobile/src/screens/media/video-model.ts` trả về chính mã backend (ví dụ `COMPLETED`) khi trạng thái không có trong bảng dịch, nên nhãn ở thư viện video hiện chữ tiếng Anh viết hoa. `trainingLabel`, `angleLabel` và `anglePhrase` trong cùng file cũng trả về mã thô khi gặp giá trị lạ.
- **Phát hiện:** 01/11/2026 (UTC+7), khi chụp màn hình Phase 5 C. Lỗi có từ trước, không do patch Phase 5 gây ra.
- **Người sửa:** mobile.
- **Đã sửa:** Phase 5 patch C (`p5-c-servertext.patch`). Giá trị lạ nay hiện "Chưa rõ" (`UNKNOWN_VALUE` trong `src/i18n/backend-codes.ts`) với màu trung tính; giá trị đã biết giữ nguyên nhãn và màu. Có test trong `video-model.test.ts`.
- **Backend:** không cần sửa. Nếu thêm trạng thái job hoặc video mới, báo mobile để thêm vào `src/i18n/media.ts`.

## T. Báo cáo sau trận (T-041): hai câu hỏi

Đối chiếu `origin/fight-camp` `a40c499` (31/10 21:48). T-041 phần mobile đã dựng trên box (`t041.patch`), **chưa áp** vào `reactnative-mobile` trên `feat/mobile-platform`.

### T1. `acuteLoss.lossPct` đã là phần trăm chưa

**Căn cứ:** `GET /bouts/:id/report` (`bouts.controller.ts:459`, `bouts.service.ts:646-676`) trả `acuteLoss` theo `acuteLossResponseSchema` (`bouts.model.ts:1182-1188`: `status`, `startKg`, `startOn`, `lossPct`, `limitPct`). Code tính ở `bouts.model.ts:823-826`: `((startKg - officialWeightKg) / startKg) * 100`, làm tròn 1 chữ số, rồi so với `limitPct` để ra `EXCEEDED`. Theo code thì `lossPct` đã là phần trăm (6,25 nghĩa là 6,25%), nhưng contract chưa ghi đơn vị.

**Backend cần trả lời:**
1. Xác nhận `lossPct` và `limitPct` cùng đơn vị phần trăm (không phải tỉ lệ 0–1) và sẽ giữ như vậy.
2. Có ghi đơn vị vào schema/Swagger (ví dụ `.describe('percent, 1 decimal')`) không?

**Vì sao mobile cần:** khối "Giảm cân cấp tốc" của báo cáo sau trận hiện "Giảm {lossPct}% so với {startKg} kg ngày {dd/MM}, vượt ngưỡng {limitPct}%". Nếu là tỉ lệ 0–1 thì số trên màn sai 100 lần.

**Mobile tạm thời làm gì:** coi cả hai là phần trăm, hiện 1 chữ số thập phân với dấu phẩy. `lossPct` null thì hiện "Chưa rõ".

### T2. Ai được lưu đánh giá chiến thuật

**Căn cứ:**
- Đọc báo cáo: `GET /bouts/:id/report` cần `bout:read` (`bouts.controller.ts:459-460`), và service chỉ cho COACH, DOCTOR, ADMIN (`assertPrivateReadAccess`, `bouts.service.ts:698-709`).
- Lưu đánh giá: `PUT /bouts/:id/opponent-analysis/review` cần `bout:result` (`bouts.controller.ts:275-276`), rồi `mutateAnalysis` kiểm `assertWriteAccess` (`bouts.service.ts:503-513`).
- `bout:result` chỉ cấp cho COACH và ADMIN (`migrations/024_bouts.sql:317`; `scripts/test-migrations.mjs:727`: `bout:result=ADMIN,COACH`).

Vậy bác sĩ đọc được báo cáo nhưng lưu sẽ bị 403.

**Backend cần trả lời:**
1. Đúng ý là bác sĩ chỉ xem, không sửa đánh giá chiến thuật?
2. ADMIN có được lưu đánh giá thay HLV không, hay chỉ HLV phụ trách võ sĩ? (`assertWriteAccess` có giới hạn HLV theo võ sĩ được phân công không?)
3. Sau này có định đổi danh sách vai trò của `bout:result` không? Nếu có, báo mobile trước.

**Vì sao mobile cần:** mobile cần biết vai trò nào thì hiện ô sửa và nút "Lưu đánh giá", vai trò nào chỉ xem.

**Mobile tạm thời làm gì:** mở màn báo cáo từ màn trận của HLV. Bản T-041 hiện nút lưu cho mọi người xem được báo cáo. Nếu gặp 403, màn hiện lỗi chung (qua `campError`), không có câu riêng. Khi backend xác nhận, mobile sẽ ẩn ô sửa và nút lưu với vai trò không có `bout:result` (dự kiến DOCTOR).

## U. Phase 5 (mobile audit 01/11): đình chỉ so với cổng buổi tập, ngôn ngữ chữ do server viết

Kiểm trên HEAD `3c67e11`, chỉ đọc.

### U1. Cổng buổi tập dùng gì (đã kiểm từ code)

- **Nguồn sự thật là `blockedSessionTypes`.** `SuspensionGate.blockingSuspensions` chặn khi đình chỉ đang có hiệu lực **và** `row.blockedSessionTypes.includes(sessionType)` (`nestjs-api/src/suspensions/suspension.gate.ts:21`, `:38`). Ngoài hiệu lực mà đang tập lại theo bậc thì chặn theo `SESSION_INTENSITY_TIERS[sessionType] > gradedReturn.ceiling` (`suspension.gate.ts:45-57`). Xung đột lịch cũng dùng `blockedSessionTypes` (`training/training-suspension-conflicts.service.ts:66`). Không chỗ nào dùng `maxAllowedTier` để chặn.
- **`maxAllowedTier` chỉ là số suy ra cho response:** `toSuspensionResponse` gán `maxAllowedTier(row.blockedSessionTypes)` (`suspensions/suspensions.service.ts:324`). Đó là bậc cao nhất `t` sao cho **mọi** loại ở bậc ≤ `t` đều không bị chặn (`suspensions/suspensions.model.ts:156-175`). Bậc: RECOVERY, PHYSICAL_THERAPY = 1; STRENGTH_CONDITIONING = 2; SHADOW_BOXING, HEAVY_BAG, PAD_WORK = 3; GRAPPLING = 4; SPARRING = 5 (`suspensions/suspensions.constants.ts:27-38`).
- **Cách tạo `blockedSessionTypes`:** đình chỉ tay nhận `maxTier` (thì `blockedTypesForMaxTier`) **hoặc** một danh sách tự do; không gửi gì thì mặc định là 6 loại trừ RECOVERY và PHYSICAL_THERAPY (`suspensions.service.ts:108-113`, `suspensions.model.ts:56-57`). Không được gửi cả hai (`suspensions.model.ts:425-430`).
- **Hai giá trị có thể lệch nhau:**
  1. Khi tạo bằng danh sách tự do không liền bậc, ví dụ chỉ chặn GRAPPLING: `maxAllowedTier = 3` nhưng SPARRING (bậc 5) **không bị chặn** theo cổng.
  2. Khi đang tập lại theo bậc (status `ENDED`, `gradedReturn` khác null): `maxAllowedTier` vẫn tính từ danh sách cũ của bản ghi (thường là 1), trong khi cổng dùng `gradedReturn.ceiling` (3 rồi 4). Readiness của trận thì đã đúng, dùng `blockedTypesForMaxTier(gradedReturn.ceiling)` (`bouts/bouts.model.ts:1504-1511`).
- **Lỗi phía mobile (do patch của mình, không phải backend):** `SuspensionCard` hiện `allowedLine(s.maxAllowedTier)` cả khi đang tập lại theo bậc (`reactnative-mobile/src/screens/fight-camp/camp-suspension.tsx:18`), nên có thể ghi "Được tập: phục hồi, vật lý trị liệu" trong khi thực tế đã được tập đến bậc 3–4. Danh sách "không bị chặn" (`camp-rules.ts:81`) thì đúng với cổng khi còn hiệu lực. Mobile sẽ sửa ở lô B của Phase 5: lấy danh sách được tập từ `blockedSessionTypes` (khi còn hiệu lực) hoặc từ `gradedReturn.ceiling` (khi tập lại theo bậc), không dựa vào `maxAllowedTier`.
- Câu hỏi còn lại cho backend:
  - **U1-a:** Có muốn `maxAllowedTier` trong response phản ánh `gradedReturn.ceiling` khi đang tập lại theo bậc không? Hay ghi rõ trong Swagger rằng nó chỉ tính từ `blockedSessionTypes` của bản ghi?
  - **U1-b:** Danh sách tự do không liền bậc (ví dụ chặn GRAPPLING mà mở SPARRING) có phải là cố ý không? Nếu không, nên ràng buộc ở validation.

### U2. Ngôn ngữ chữ do server viết (đã kiểm từ code)

- **Gợi ý quay video:** python-worker trả `recordingGuidance: [{ code, message }]`, với `message` **tiếng Anh** (`python-worker/pipeline/movement_evidence.py:21-34`, `:189`; contract `nestjs-api/src/coaching/movement-evidence.contract.ts:28`). Có `code` ổn định (QUALITY_BLOCKED, LOW_FPS, MISSING_POSE, …), nên mobile sẽ dịch theo `code` qua `backend-codes.ts`; mã lạ hiện "Chưa rõ". Không cần backend đổi.
- **Thông báo:** `title` và `message` được backend viết sẵn bằng **tiếng Anh**, ví dụ `ADMISSION_NOTIFICATION_TEXT` (`fighter-admissions/fighter-admissions.constants.ts:86-105`). Response có `type` (`notifications/notifications.model.ts:125-127`), gồm 23 loại (`shared/contracts/notification.contract.ts:7-43`), nên mobile có thể hiện tiêu đề tiếng Việt theo `type`. Nhưng phần `message` có thể chứa chi tiết cụ thể, và mobile không dựng lại được nếu thiếu dữ liệu.
- **Tên video phân tích lại:** backend nối thêm `" (Reanalysis)"` vào tên video (`coaching/coaching.service.ts:399`), nên chữ tiếng Anh sẽ hiện trong danh sách video.
- Câu hỏi còn lại cho backend:
  - **U2-a:** Thông báo: (a) backend viết `title`/`message` bằng tiếng Việt; (b) giữ tiếng Anh và thêm `payload` đủ dữ liệu để mobile tự dựng câu theo `type`; (c) mobile chỉ dịch tiêu đề theo `type` và ẩn `message`. Bên mobile khuyên (a).
  - **U2-b:** Hậu tố `" (Reanalysis)"`: bỏ hậu tố và để cờ hoặc trường riêng (ví dụ `reanalysisOf`), hay đổi thành tiếng Việt?
  - **U2-c:** Lỗi validation và câu `message` trong envelope thành công (ví dụ `bouts.controller.ts:227`, `auth.controller.ts:67`) là tiếng Anh. Mobile không hiện các câu này (chỉ dùng `code`), nên ghi lại để biết, không cần sửa.

## Đã kiểm, không phải việc backend

- **T-041:** `GET /bouts/:id/report` (`bouts.controller.ts:459`, `a40c499`) và `PUT /bouts/:id/opponent-analysis/review` (`:275`) đã đủ trường cho ticket (`resultRound`, `knockedDown`, `acuteLoss`, ba dạng `improvementPoints`). Còn hai câu hỏi về đơn vị `lossPct` và quyền lưu: xem phần T. Riêng mã `method` xem phần F.
- **T-037 B:** backend phần A đã merge (`dc5a707`), migration 030 đã áp. Không thấy thiếu.

## Việc của chủ dự án (không phải code backend)

| Việc | Hiện trạng 31/10 17:12 | Chặn |
| --- | --- | --- |
| Merge T-040 A (`feat/T-040-merge-demo-branches`) | Có handover 31/10, chưa merge (67 commit) | Nhánh T-041; T-006 C; T-040 C |
| Merge T-030 B (`feat/T-030-suspension-ui`) | Chưa merge (8 commit), chờ T-040 A | Nhánh T-048 |
| Áp migration 026 sau khi phần A APPROVED | Chưa có migration | T-009 B2 |
| T-048 bắt đầu khi T-030 B đã merge vào `fight-camp` (T-048 dòng 4) | Chưa merge, chờ leader merge (31/10 21:40). Mobile đang làm trước trên `feat/mobile-platform` | Điều kiện bắt đầu T-048 |

## Lệnh kiểm tra bắt buộc (phần có sửa code backend: A, B, C, E, I và L–R nếu đổi)

```bash
pnpm --filter nestjs-api lint
pnpm --filter nestjs-api build
pnpm --filter nestjs-api test
pnpm --filter nestjs-api test:db   # chỉ phần A, C nếu có migration
```
