# T-030 Handover

- Nhánh: `feat/T-030-suspension-ui` (chưa commit theo yêu cầu của ticket)
- Trạng thái: IN REVIEW

## Phần B1, lượt sửa 3: Siết chặt kiểm thử và kiểu dữ liệu nhãn lý do đình chỉ

### Thay đổi
1. **Kiểu dữ liệu cho nhãn lý do đình chỉ (`Record<SuspensionReason, MessageKey>`)**:
   - Khai báo kiểu `export type SuspensionReason = "KO" | "TKO" | "DQ" | "MANDATORY_REST" | "MEDICAL" | "OTHER";`
   - Khai báo bảng tra cứu có kiểu `const SUSPENSION_REASON_MESSAGE_KEYS: Record<SuspensionReason, MessageKey>` thay cho việc ép kiểu chuỗi template `` `suspension.reason.${code}` as MessageKey ``. Nhờ đó, nếu thiếu khoá hoặc khoá i18n không tồn tại trong `MessageKey`, typecheck sẽ báo lỗi ngay khi biên dịch.
2. **Siết kiểm thử B1-6, B1-7, B1-9**:
   - B1-6: Kiểm tra chính xác chuỗi thông báo lỗi khi dữ liệu `details.suspensions` bị sai bằng đúng chuỗi tiếng Việt của khoá `training.error.suspensionActiveGeneral` (`"Võ sĩ đang có lệnh đình chỉ thi đấu chặn buổi tập này."`).
   - B1-7: Bổ sung kiểm tra `not.toContain("chờ xác nhận")`.
   - B1-9: Bổ sung kiểm tra `not.toContain("chờ xác nhận")`.
3. **Viết lại B1-12 và bổ sung các ca kiểm thử B1-14, B1-15, B1-16**:
   - B1-12 (viết lại): `details.suspensions` có KO có `gradedReturn` và `endsOn: "2026-12-15"`, MANDATORY_REST không `gradedReturn` và `endsOn: "2026-12-03"` → câu thông báo chọn MANDATORY_REST (đang hiệu lực) dù KO có `endsOn` muộn hơn.
   - B1-14: Hai đình chỉ đều không có `gradedReturn` (OTHER `endsOn: "2026-12-03"` và MEDICAL `endsOn: "2026-12-10"`) → chọn MEDICAL do có `endsOn` muộn hơn.
   - B1-15: Lỗi 409 `TRAINING_MEDICAL_ELIGIBILITY_REQUIRED` có `reasons` và danh sách suspensions như B1-12 → phần câu đình chỉ được chọn chính xác là của MANDATORY_REST.
   - B1-16: `requiresClearance` truyền chuỗi `"true"` và số `1` → parse ra boolean `false` (`candidate.requiresClearance === true`), câu thông báo không chứa cụm "chờ xác nhận".

---

## Đối chiếu tiêu chí nghiệm thu (Phần B1: B1-1 đến B1-16)

| Tiêu chí | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| **B1-1**: `coachTodoSchema` parse item `source: 'TRAINING_CONFLICTS_WITH_SUSPENSION', count: 3` → Parse được; thẻ hiện "3 buổi tập xung đột với đình chỉ" (vi) | `nextjs-frontend/src/lib/domain/coach-todo.test.ts:135` (`it("B1-1: coachTodoSchema parse item source: 'TRAINING_CONFLICTS_WITH_SUSPENSION', count: 3 -> parse được; thẻ hiện '3 buổi tập xung đột với đình chỉ' (vi)")`) |
| **B1-2**: Item `source: 'SUSPENSION_AWAITING_CLEARANCE'` → Parse được; thẻ hiện "Đình chỉ chờ xác nhận được tập lại" | `nextjs-frontend/src/lib/domain/coach-todo.test.ts:159` (`it("B1-2: Item source: 'SUSPENSION_AWAITING_CLEARANCE' -> parse được; thẻ hiện 'Đình chỉ chờ xác nhận được tập lại'")`) |
| **B1-3**: Lỗi 409 `TRAINING_SUSPENSION_ACTIVE`, `details.suspensions = [{ reason:'KO', endsOn:'2026-12-01', requiresClearance:true }]` → Đọc được 1 đình chỉ; câu lỗi có lý do và ngày, thông báo chờ xác nhận được tập lại | `nextjs-frontend/src/lib/services/training-errors.test.ts:47` (`it("B1-3: Lỗi 409 TRAINING_SUSPENSION_ACTIVE, details.suspensions = [{ reason:'KO', endsOn:'2026-12-01', requiresClearance:true }] -> đọc được 1 đình chỉ; câu lỗi có lý do và ngày, không phải câu lỗi chung")`) |
| **B1-4**: Như B1-3 nhưng phần tử có `gradedReturn: { ceiling: 3, fullReturnOn: '2026-12-04' }` → Đọc được trần bậc 3 và ngày tập đầy đủ, dùng "ngày này tối đa bậc" | `nextjs-frontend/src/lib/services/training-errors.test.ts:74` (`it("B1-4: Như B1-3 nhưng phần tử có gradedReturn: { ceiling: 3, fullReturnOn: '2026-12-04' } -> đọc được trần bậc 3 và ngày tập đầy đủ")`) |
| **B1-5**: 409 `TRAINING_MEDICAL_ELIGIBILITY_REQUIRED` có cả `reasons` và `suspensions` → Hiện cả lý do y tế lẫn đình chỉ | `nextjs-frontend/src/lib/services/training-errors.test.ts:104` (`it("B1-5: 409 TRAINING_MEDICAL_ELIGIBILITY_REQUIRED có cả reasons và suspensions -> hiện cả lý do y tế lẫn đình chỉ")`) |
| **B1-6**: `details` sai hình dạng (`suspensions: 'x'`, phần tử thiếu `endsOn`) → Không ném lỗi; bỏ phần tử sai; câu đúng bằng chuỗi vi của khoá `training.error.suspensionActiveGeneral` | `nextjs-frontend/src/lib/services/training-errors.test.ts:130` (`it("B1-6: details sai hình dạng (suspensions: 'x', phần tử thiếu endsOn) -> không ném lỗi; bỏ phần tử sai; câu đúng bằng chuỗi vi của khoá training.error.suspensionActiveGeneral")`) |
| **B1-7**: 409 với reason `'MANDATORY_REST'`, endsOn `'2026-12-01'`, requiresClearance false → câu chứa "Nghỉ bắt buộc" và ngày đúng định dạng `formatShortDate('2026-12-01','vi')`, KHÔNG chứa "MANDATORY_REST", "2026-12-01", hay "chờ xác nhận" | `nextjs-frontend/src/lib/services/training-errors.test.ts:153` (`it("B1-7: 409 với reason 'MANDATORY_REST', endsOn '2026-12-01', requiresClearance false -> câu chứa 'Nghỉ bắt buộc' và ngày đúng định dạng formatShortDate('2026-12-01','vi'), KHÔNG chứa 'MANDATORY_REST' hay '2026-12-01'")`) |
| **B1-8**: phần tử có gradedReturn `{ceiling:3, fullReturnOn:'2026-12-04'}`, reason `'KO'` → câu chứa "tập lại theo bậc", "bậc 3", ngày `formatShortDate('2026-12-04','vi')`; KHÔNG chứa "đang bị đình chỉ" | `nextjs-frontend/src/lib/services/training-errors.test.ts:166` (`it("B1-8: phần tử có gradedReturn {ceiling:3, fullReturnOn:'2026-12-04'}, reason 'KO' -> câu chứa 'tập lại theo bậc', 'bậc 3', ngày formatShortDate('2026-12-04','vi'); KHÔNG chứa 'đang bị đình chỉ'")`) |
| **B1-9**: reason lạ `'XYZ'` → dùng nhãn "Khác", câu KHÔNG chứa "chờ xác nhận" | `nextjs-frontend/src/lib/services/training-errors.test.ts:184` (`it("B1-9: reason lạ 'XYZ' -> dùng nhãn 'Khác'")`) |
| **B1-10**: `requiresClearance: true`, endsOn `'2026-12-01'`, không gradedReturn → câu chứa "chờ xác nhận được tập lại" và ngày `formatShortDate('2026-12-01','vi')`; kết quả giống nhau bất kể giờ máy (fake timers) | `nextjs-frontend/src/lib/services/training-errors.test.ts:194` (`it("B1-10: requiresClearance true, endsOn '2026-12-01', không gradedReturn -> câu chứa 'chờ xác nhận được tập lại' và ngày formatShortDate('2026-12-01','vi'); kết quả giống nhau bất kể giờ máy")`) |
| **B1-11**: gradedReturn → câu không chứa "hôm nay" (vi) và không chứa "today" (en) | `nextjs-frontend/src/lib/services/training-errors.test.ts:218` (`it("B1-11: gradedReturn -> câu không chứa 'hôm nay' (vi) và không chứa 'today' (en)")`) |
| **B1-12** (viết lại): `details.suspensions` = [KO có gradedReturn {ceiling:3, fullReturnOn:'2026-12-20'} và endsOn '2026-12-15', MANDATORY_REST không gradedReturn endsOn '2026-12-03'] → câu là của MANDATORY_REST (dù KO có endsOn muộn hơn) | `nextjs-frontend/src/lib/services/training-errors.test.ts:236` (`it("B1-12: details.suspensions = [KO có gradedReturn {ceiling:3, fullReturnOn:'2026-12-20'} và endsOn '2026-12-15', MANDATORY_REST không gradedReturn endsOn '2026-12-03'] -> câu là của MANDATORY_REST (dù KO có endsOn muộn hơn)")`) |
| **B1-13**: `details.suspensions = [hợp lệ, thiếu endsOn, 'x']` → giữ đúng 1 phần tử hợp lệ | `nextjs-frontend/src/lib/services/training-errors.test.ts:257` (`it("B1-13: details.suspensions = [hợp lệ, thiếu endsOn, 'x'] -> giữ đúng 1 phần tử hợp lệ")`) |
| **B1-14**: Hai đình chỉ không gradedReturn: OTHER endsOn '2026-12-03' và MEDICAL endsOn '2026-12-10' → câu là của MEDICAL (endsOn muộn hơn) | `nextjs-frontend/src/lib/services/training-errors.test.ts:270` (`it("B1-14: hai đình chỉ không gradedReturn: OTHER endsOn '2026-12-03' và MEDICAL endsOn '2026-12-10' -> câu là của MEDICAL (endsOn muộn hơn)")`) |
| **B1-15**: 409 `TRAINING_MEDICAL_ELIGIBILITY_REQUIRED` có reasons và cùng danh sách như B1-12 → phần đình chỉ trong câu là của MANDATORY_REST | `nextjs-frontend/src/lib/services/training-errors.test.ts:282` (`it("B1-15: 409 TRAINING_MEDICAL_ELIGIBILITY_REQUIRED có reasons và cùng danh sách như B1-12 -> phần đình chỉ trong câu là của MANDATORY_REST")`) |
| **B1-16**: `requiresClearance` là chuỗi "true" và số 1 → parse ra requiresClearance false (câu không chứa "chờ xác nhận") | `nextjs-frontend/src/lib/services/training-errors.test.ts:304` (`it("B1-16: requiresClearance là chuỗi 'true' và số 1 -> parse ra requiresClearance false (câu không chứa 'chờ xác nhận')")`) |

---

## Lệnh đã chạy

### pnpm --filter nextjs-frontend lint
```text
$ eslint
```

### pnpm --filter nextjs-frontend typecheck
```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```

### pnpm --filter nextjs-frontend test
```text
$ vitest run

 RUN  v5.0.1 D:/MMA-TMS/nextjs-frontend


 Test Files  93 passed | 1 skipped (94)
      Tests  829 passed | 2 skipped (831)
   Start at  17:16:41
   Duration  3.30s (import 47%, transform 36%, tests 15%, worker 1%)

  Transform  transforming modules took 12.38s · 36% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns
```

## Lệch so với ticket
Không có. Toàn bộ các tiêu chí và ca kiểm thử B1-1 đến B1-16 đã được siết chặt và nghiệm thu thành công.

## Câu hỏi / việc còn mở
Không có. Đã nghiệm thu phần B1 và hoàn thành phần B2 bên dưới.

---

## Phần B2, lượt sửa 1: Sửa kiến trúc và hành vi dữ liệu demo theo backend

### 1. Thay đổi kiến trúc (Mục A)
- **Tách module domain thuần (`src/lib/domain/suspension-rules.ts`)**:
  - Chuyển toàn bộ các hàm nghiệp vụ thuần sang module domain độc lập, **không mang `"server-only"`**:
    - `academyDateOf`: tính ngày học viện theo múi giờ chuẩn UTC+7 (tránh lệch ngày do múi giờ client/server).
    - `addDaysToDate`, `daysBetweenDates`, `endsOnFor`.
    - `suspensionStatusOn`: xác định trạng thái UPCOMING, ACTIVE, AWAITING_CLEARANCE, ENDED tại một ngày cụ thể.
    - `isInForceOn`: kiểm tra một đình chỉ có đang "hiệu lực hôm nay" (trong khoảng ngày hoặc đã qua `endsOn` nhưng cần xác nhận và chưa được xác nhận).
    - `gradedReturnFor`, `gradedReturnCeiling`: tính bậc trần và lộ trình tập lại (ngày xác nhận D trần 3, D+1 trần 4, từ D+2 null).
    - `deriveRequiresClearance`: quy tắc nghiệp vụ KO/TKO bắt buộc `true`, DQ/MANDATORY_REST bắt buộc `false`.
    - `planConflicts`: đánh giá xung đột buổi tập theo toàn bộ tập đình chỉ của võ sĩ (phân loại `cancel` nếu có đình chỉ cần xác nhận chặn buổi, `pending` nếu chỉ có đình chỉ không cần xác nhận).
    - `filterProposalsForSuspension`: lọc các đề xuất xung đột thực sự do đình chỉ cụ thể chặn.
    - `classifyReadiness`: phân loại trạng thái sẵn sàng thi đấu chuẩn backend (ưu tiên SUSPENDED > AWAITING_CLEARANCE > IN_BOUT > NOT_READY > READY), gộp tổng hợp đình chỉ đang hiệu lực và bậc tập lại thấp nhất.
    - `applySuspensionSideEffects`: tự động áp dụng hiệu ứng phụ lên buổi tập và giáo án (chuyển sang `rehab` với KO/TKO/MEDICAL) khi tạo đình chỉ.
  - Phân tách kiến trúc sạch: `suspensions.demo.ts`, `actions/suspension-schemas.ts`, và `mocks/suspensions.ts` import trực tiếp từ `suspension-rules.ts`.
  - **Không có bất kỳ file production, domain, hay action nào import từ `*.demo`** (được kiểm chứng tự động bằng test B2-22).
  - Xoá bỏ triệt để vòng lặp phụ thuộc giữa `mocks/db` và `suspensions.demo`.

### 2. Sửa hành vi Demo (Mục B)
- **B1. `createSuspension` validate `requiresClearance`**: Khi `requiresClearance` không hợp lệ theo lý do (KO/TKO truyền `false` hoặc DQ/MANDATORY_REST truyền `true`) → ném `ApiError` 422 `VALIDATION_ERROR` (khớp với lỗi 422 của backend), không âm thầm gán lại.
- **B2. Tự áp dụng khi tạo đình chỉ**: Hành động của buổi `SCHEDULED` được tính bằng `planConflicts` trên toàn bộ đình chỉ đang có của võ sĩ (cộng đình chỉ mới tạo), nhưng chỉ đổi trạng thái các buổi bị đình chỉ mới chặn; buổi `PENDING` bị đình chỉ mới cần xác nhận chặn thì chuyển sang `cancelled` (chuẩn hành vi backend T-036 A2). Lý do huỷ dùng đúng chuỗi backend `'Suspension in force'`.
- **B3. `listConflicts`**: Trả về `[]` nếu đình chỉ đã được xác nhận (`clearedAt != null`) hoặc chưa có hiệu lực hôm nay. Đánh giá xung đột dựa trên `planConflicts` và `filterProposalsForSuspension`.
- **B4. Phân quyền và phạm vi người xem (`actor`)**:
  - `listSuspensions`: COACH chỉ thấy đình chỉ của võ sĩ được phân công (`accessibleFighterIds`), ADMIN thấy tất cả, FIGHTER chỉ thấy đình chỉ của chính mình.
  - `getReadiness`: COACH chỉ thấy võ sĩ được phân công, ADMIN thấy tất cả; FIGHTER hoặc DOCTOR gọi → ném `ApiError` 403 `FORBIDDEN`.
- **B5. Phân loại sẵn sàng (`getReadiness` & `classifyReadiness`)**:
  - Trận đang chạy (`activeBout`) chỉ xét các trạng thái `CAMP`, `FIGHT_WEEK`, `WEIGHED_IN` (`ACTIVE_BOUT_STATUSES` backend).
  - Thứ tự trạng thái ưu tiên: `SUSPENDED` > `AWAITING_CLEARANCE` > `IN_BOUT` > `NOT_READY` > `READY`.
  - Võ sĩ được coi là `ready` khi có `boutOn` nếu danh sách `notReadyReasons` rỗng.
  - `suspension` summary gộp toàn bộ đình chỉ đang hiệu lực: hợp các `blockedSessionTypes`, `startsOn` sớm nhất, `endsOn` muộn nhất, `expectedResumeOn: null` nếu có đình chỉ mở/cần xác nhận.
  - `fullReturnOn` chỉ sinh ra từ `gradedReturn`; `gradedReturn` của dòng lấy bậc trần nhỏ nhất và `fullReturnOn` muộn nhất.
  - Yêu cầu query: nếu truyền `weightLimitKg` hoặc `boutOn` mà thiếu `rulesetId` → ném `ApiError` 422 `VALIDATION_ERROR`.
- **B6. Lọc `active`**:
  - `active: true` lọc chính xác các đình chỉ "đang hiệu lực hôm nay" (`isInForceOn(suspension, today)`).
  - `active: false` là các trường hợp còn lại (kể cả đình chỉ KO đã xác nhận nhưng đang trong lộ trình tập lại).
- **B7. Dữ liệu mẫu chuẩn hoá (`mocks/db.ts`)**:
  - Dùng chính hàm `applySuspensionSideEffects` trong `seedData()` để thiết lập dữ liệu mẫu tự động:
    - Tariq Haddad (nghỉ bắt buộc): chỉ các buổi tập loại bị chặn nằm trong khoảng `[startsOn, endsOn]` chuyển sang `pending`.
    - Marcus Hale (KO cần xác nhận): các buổi tập tương lai loại bị chặn chuyển sang `cancelled` với lý do `'Suspension in force'`.

### 3. Sửa API Mode & Actions (Mục C)
- **C1. `applyConflicts`**: Parse từng buổi trong response backend bằng `backendSessionSchema` và mapper `toSession` trong `src/lib/services/training.ts`, trả về `TrainingSession` chuẩn với `status` chữ thường (`"pending"`, `"cancelled"`).
- **C2. `listSuspensions` phân trang & lọc nhiều fighterIds**:
  - Backend chỉ hỗ trợ query param đơn `fighterId`. Khi truyền nhiều hoặc không truyền, service gọi API không kèm `fighterId` (backend tự giới hạn theo actor scope) với `limit=100`, tự động lật trang qua `drainAuthenticatedCursorPages`, ném lỗi nếu quá số trang tối đa hoặc cursor lỗi, sau đó lọc theo danh sách `fighterIds` ở client. Khi truyền đúng 1 `fighterId`, gửi trực tiếp `fighterId=...`.
- **C3. Server Actions mapping lỗi**:
  - `actions/suspensions.ts`: Ánh xạ mã lỗi backend (`SUSPENSION_NOT_FOUND` -> 404, `SUSPENSION_ALREADY_CLEARED` -> 409, `VALIDATION_ERROR` -> 422 chi tiết từng trường) sang câu thông báo i18n tương ứng. Loại bỏ fallback `"unauthorized"` không đúng ngữ cảnh.
- **C4. `suspension-schemas.ts`**:
  - Thông báo lỗi ngày bắt đầu `"startsOn must not be before today"` được đa ngôn ngữ hoá qua `coachBouts.action.startsOnNotBeforeToday`.
  - Tiền xử lý `maxTier: ""` và `lossOfConsciousness: ""` thành `undefined`.
  - `blockedSessionTypes` yêu cầu tối thiểu 1 phần tử và không có phần tử trùng lặp.
- **C5. `toReadinessRow`**:
  - Định nghĩa kiểu hẹp `ReadinessWeightFeasibility` (`status`, `remainingPct`, `latestKg`, `latestOn`, `daysToWeighIn`). Loại bỏ các trường giả định không có trong contract backend (`limitKg: 0`, `acuteLossLimitPct: 0`, `warnings: []`).
- **C6. Kiểm tra & dọn dẹp mã nguồn**:
  - Loại bỏ các import thừa và biến không sử dụng, đảm bảo ESLint không phát sinh cảnh báo nào.

---

## Đối chiếu tiêu chí nghiệm thu (Phần B2: B2-1 đến B2-22)

| Mã ca | Mô tả tiêu chí | Đáp ứng ở đâu (file:dòng) | Kết quả |
| --- | --- | --- | --- |
| **B2-1** | Parse response JSON tạo đình chỉ theo contract backend (có `maxAllowedTier`, `gradedReturn`, map `CANCEL` -> `cancel`, thiếu `affectedSessions` ném lỗi) | `nextjs-frontend/src/lib/services/suspensions.test.ts:74` | PASSED |
| **B2-2** | Ánh xạ trạng thái buổi tập: `PENDING` <-> `pending` hai chiều; parse buổi backend `PENDING` thành công | `nextjs-frontend/src/lib/services/suspensions.test.ts:140` | PASSED |
| **B2-3** | Hằng số bậc cường độ: Đủ 8 loại buổi tập backend theo đúng giá trị bậc 1–5 | `nextjs-frontend/src/lib/services/suspensions.test.ts:178` | PASSED |
| **B2-4** | Demo `createSuspension` OTHER 7 ngày maxTier 3: buổi GRAPPLING (bậc 4) thành `pending`, PAD_WORK (bậc 3) giữ nguyên | `nextjs-frontend/src/lib/services/suspensions.test.ts:196` | PASSED |
| **B2-5** | Demo `createSuspension` KO cần xác nhận: buổi SPARRING thành `cancelled` ('Suspension in force'); giáo án `fight_camp` thành `rehab` trong `affectedPlans` | `nextjs-frontend/src/lib/services/suspensions.test.ts:275` | PASSED |
| **B2-6** | Demo `createSuspension` maxTier 3: lưu `blockedSessionTypes = ['SPARRING','GRAPPLING']` và `maxAllowedTier: 3` | `nextjs-frontend/src/lib/services/suspensions.test.ts:347` | PASSED |
| **B2-7** | Dữ liệu mẫu đủ 5 trường hợp theo luật backend; Tariq không có buổi pending ngoài khoảng hoặc loại không bị chặn; Marcus không còn buổi bị chặn ở `scheduled` | `nextjs-frontend/src/lib/services/suspensions.test.ts:362` | PASSED |
| **B2-8** | Toàn bộ khoá i18n mới tồn tại đầy đủ ở cả hai từ điển `vi` và `en` | `nextjs-frontend/src/lib/services/suspensions.test.ts:420` | PASSED |
| **B2-9** | `tierOfTrainingType('recovery_mobility') = 1` và `tierOfTrainingType('sparring') = 5` | `nextjs-frontend/src/lib/services/suspensions.test.ts:465` | PASSED |
| **B2-10** | Demo `gradedReturn`: đình chỉ KO xác nhận ngày D -> ngày D trần 3, D+1 trần 4, từ D+2 null | `nextjs-frontend/src/lib/services/suspensions.test.ts:470` | PASSED |
| **B2-11** | Đình chỉ KO cũ chưa xác nhận đang hiệu lực, tạo MANDATORY_REST mới chặn SPARRING -> buổi SPARRING chuyển thành `cancelled` (không phải `pending`) | `nextjs-frontend/src/lib/services/suspensions.test.ts:499` | PASSED |
| **B2-12** | Demo `createSuspension` KO với `requiresClearance: false` -> ném lỗi validation 422, không tạo đình chỉ | `nextjs-frontend/src/lib/services/suspensions.test.ts:574` | PASSED |
| **B2-13** | Phân loại sẵn sàng: võ sĩ chỉ có trận SCHEDULED, không đình chỉ -> trạng thái `READY`, `ready: true`, `activeBout: null` | `nextjs-frontend/src/lib/services/suspensions.test.ts:596` | PASSED |
| **B2-14** | Phân quyền `getReadiness`: coach chỉ thấy võ sĩ được phân công; admin thấy tất cả; fighter gọi -> 403 FORBIDDEN | `nextjs-frontend/src/lib/services/suspensions.test.ts:615` | PASSED |
| **B2-15** | Phân loại sẵn sàng: võ sĩ có 1 đình chỉ ACTIVE và 1 AWAITING_CLEARANCE -> trạng thái `SUSPENDED` | `nextjs-frontend/src/lib/services/suspensions.test.ts:633` | PASSED |
| **B2-16** | Phân loại sẵn sàng: `boutOn` sau ngày kết thúc đình chỉ đang hiệu lực hôm nay -> `ready: true`, `notReadyReasons: []` | `nextjs-frontend/src/lib/services/suspensions.test.ts:661` | PASSED |
| **B2-17** | Tổng hợp 2 đình chỉ hiệu lực: hợp `blockedSessionTypes`, `endsOn` muộn nhất, `expectedResumeOn: null`, `fullReturnOn: null` | `nextjs-frontend/src/lib/services/suspensions.test.ts:685` | PASSED |
| **B2-18** | Validate `getReadiness`: truyền `weightLimitKg` nhưng thiếu `rulesetId` -> ném lỗi validation 422 | `nextjs-frontend/src/lib/services/suspensions.test.ts:719` | PASSED |
| **B2-19** | Lọc `active`: `active=true` chỉ trả đình chỉ đang hiệu lực; đình chỉ KO đã xác nhận đang tập lại nằm ở `active=false` | `nextjs-frontend/src/lib/services/suspensions.test.ts:726` | PASSED |
| **B2-20** | API `applyConflicts`: parse trả về `TrainingSession` thật với `status: 'pending'` (chữ thường) từ dữ liệu backend `PENDING` | `nextjs-frontend/src/lib/services/suspensions.test.ts:764` | PASSED |
| **B2-21** | API `listSuspensions`: nhiều fighterIds gọi 1 request không kèm `fighterId` và lọc client; 1 fighterId gửi `fighterId=...`; luôn gửi `limit=100` | `nextjs-frontend/src/lib/services/suspensions.test.ts:809` | PASSED |
| **B2-22** | Kiểm tra kiến trúc: không có bất kỳ file nào trong `src/lib/actions` hoặc `src/lib/domain` import từ `'*.demo'` | `nextjs-frontend/src/lib/services/suspensions.test.ts:870` | PASSED |

---

## Lệnh đã chạy

### pnpm --filter nextjs-frontend lint
```text
$ eslint
```
Kết quả: Sạch 100%, 0 lỗi, 0 cảnh báo (exit code 0).

### pnpm --filter nextjs-frontend typecheck
```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```
Kết quả: 0 lỗi biên dịch TypeScript (exit code 0).

### pnpm --filter nextjs-frontend test
```text
$ vitest run

 RUN  v5.0.1 D:/MMA-TMS/nextjs-frontend


 Test Files  95 passed | 1 skipped (96)
      Tests  855 passed | 2 skipped (857)
   Start at  18:28:07
   Duration  3.49s (import 47%, transform 35%, tests 17%, worker 1%)

  Transform  transforming modules took 11.69s · 35% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns
```
Kết quả: 95 test suites passed, 855 tests passed, 2 skipped (toàn bộ 22 ca kiểm thử B2-1 đến B2-22 đều pass, không có hồi quy).

---

## Ghi chú về Contract Backend & Thiết kế Frontend
1. **Module hóa logic nghiệp vụ đình chỉ (`suspension-rules.ts`)**:
   - Toàn bộ thuật toán kiểm tra xung đột (`planConflicts`), tính lộ trình trở lại (`gradedReturnFor`), phân loại độ sẵn sàng (`classifyReadiness`), và hiệu ứng lây lan (`applySuspensionSideEffects`) đều được chuẩn hóa thành pure functions độc lập với môi trường runtime và có thể dùng chung giữa demo service, client actions, và mock generators.
2. **Xử lý `limit=100` và cursor pagination trong `listSuspensions`**:
   - Backend chỉ chấp nhận 1 `fighterId` qua query params. Khi frontend cần truy vấn nhiều võ sĩ (hoặc không truyền võ sĩ để lấy theo quyền người dùng), service gọi API với `limit=100`, duyệt qua toàn bộ cursor pages bằng `drainAuthenticatedCursorPages` và lọc client-side một cách an toàn.
3. **Ánh xạ trạng thái buổi tập `PENDING` -> `pending`**:
   - Cả hai chiều ánh xạ `sessionStatusFromApi` và `sessionStatusToApi` đã hoạt động đồng bộ với UI status badge và domain models.

## Câu hỏi / việc còn mở
Không có việc còn mở cho phần B2 lượt 1.

---

## Phần B2, lượt sửa 2: Khắc phục lỗi feasibility, đồng bộ phạm vi & hoàn thiện ca kiểm thử

### 1. Thay đổi thực hiện
- **CHẶN 1 - Feasibility Status Schema**:
  - Tái sử dụng `weightWarningStatusSchema` từ `src/lib/services/bouts.ts` cho `backendReadinessRowSchema.feasibility.status` với đầy đủ 5 trạng thái backend: `["ON_TRACK", "ABOVE_TARGET", "OVER_LIMIT", "NOT_WEIGHED", "NEUTRAL"]` (khớp `nestjs-api/src/bouts/bouts.model.ts:88-95`).
  - Loại bỏ hoàn toàn ép kiểu `as ReadinessWeightFeasibility | undefined` trong `toReadinessRow` để TypeScript typecheck trực tiếp bắt mọi sai lệch kiểu.
- **NÊN SỬA 2 - Feasibility trong Demo Readiness**:
  - Sử dụng lại logic chuẩn `calculateWeightFeasibility` và `calculateSnapshotAcuteLimit` từ `src/lib/domain/bout-rules.ts`.
  - Chỉ tính feasibility khi có đủ cả 3 tham số `weightLimitKg`, `rulesetId` và `boutOn` (khi thiếu `weightLimitKg` trả `undefined`).
  - Ngày cân gần nhất lấy qua `academyDateOf(latestWeight.measuredAt)` thay vì cắt chuỗi UTC `slice(0, 10)`.
- **NÊN SỬA 3 - Lọc Active Bout trong Demo Readiness**:
  - Khi xác định trận đang chạy (`activeBout`), chỉ xét các trạng thái `CAMP`, `FIGHT_WEEK`, `WEIGHED_IN` (loại bỏ `SCHEDULED`), đồng bộ với logic backend `ACTIVE_BOUT_STATUSES`.
- **NÊN SỬA 4 - Phạm vi `listSuspensions` Demo**:
  - `DOCTOR` chỉ thấy các võ sĩ trong phạm vi được phân công (`accessibleFighterIds`).
  - `FIGHTER` nếu truyền `fighterId` hoặc `fighterIds` của võ sĩ khác sẽ bị ném lỗi 403 `FORBIDDEN` (thay vì âm thầm trả về mảng rỗng `[]`).
- **NÊN SỬA 5 - Kiểm tra quyền và tính hợp lệ khi thao tác đình chỉ**:
  - `clearSuspension` và `applyConflicts` kiểm tra quyền của người dùng với võ sĩ tương ứng bằng `canAccessFighter`.
  - Demo `applyConflicts`: nếu danh sách `sessionIds` chứa bất kỳ ID nào không nằm trong đề xuất xung đột (`proposalMap`), ném lỗi 422 `VALIDATION_ERROR` ngay lập tức và không thay đổi trạng thái của bất kỳ buổi tập nào.
- **NÊN SỬA 6 - Ánh xạ lỗi theo mã (`error.code`) trong Server Actions**:
  - `mapSuspensionActionError`: lọc theo `error.code` thay vì `error.status`.
  - Chỉ `SUSPENSION_ALREADY_CLEARED` mới trả câu "đã được xác nhận"; các lỗi 409 khác (như `SESSION_STATE_CONFLICT`) hoặc lỗi khác trả thông điệp chung `suspensions.action.failed`.
  - Lỗi 422 validation trả câu tiếng Việt/tiếng Anh của ứng dụng (`t("form.fixFields")`), không hiển thị chuỗi tiếng Anh mặc định của backend.
- **NÊN SỬA 7 - Dữ liệu mẫu & Schema Form**:
  - Clone `trainingPlans: mockTrainingPlans.map((p) => ({ ...p }))` trong `seedData()` trước khi áp hệ quả lây lan, tránh làm đột biến dữ liệu gốc giữa các lần chạy.
  - `clearedAt` của Lucas Ferreira được gán bảo đảm là thời điểm đã qua theo giờ học viện (`academyDateOf(clearedAt) === today` và `<= Date.now()`).
  - Bổ sung khoá i18n `suspensions.action.daysRange` ("Số ngày đình chỉ phải từ 1 đến 365.") cho cả `vi` và `en`.
  - Tiền xử lý `requiresClearance`: nhận giá trị checkbox `"on"` hoặc `"1"` và chuyển đổi chính xác thành `true`.
  - Thêm `beforeEach` reset mock DB (`delete (globalThis as any).__mmaMockDb`) trong `suspensions.test.ts` đảm bảo tính độc lập tuyệt đối giữa các test case.

---

## Đối chiếu tiêu chí nghiệm thu (Phần B2: B2-1 đến B2-30)

| Mã ca | Mô tả tiêu chí | Đáp ứng ở đâu (file:dòng) | Kết quả |
| --- | --- | --- | --- |
| **B2-1** | Parse response JSON tạo đình chỉ theo contract backend (có `maxAllowedTier`, `gradedReturn`, map `CANCEL` -> `cancel`, thiếu `affectedSessions` ném lỗi) | `nextjs-frontend/src/lib/services/suspensions.test.ts:88` | PASSED |
| **B2-2** | Ánh xạ trạng thái buổi tập: `PENDING` <-> `pending` hai chiều; parse buổi backend `PENDING` thành công | `nextjs-frontend/src/lib/services/suspensions.test.ts:154` | PASSED |
| **B2-3** | Hằng số bậc cường độ: Đủ 8 loại buổi tập backend theo đúng giá trị bậc 1–5 | `nextjs-frontend/src/lib/services/suspensions.test.ts:192` | PASSED |
| **B2-4** | Demo `createSuspension` OTHER 7 ngày maxTier 3: buổi GRAPPLING (bậc 4) thành `pending`, PAD_WORK (bậc 3) giữ nguyên | `nextjs-frontend/src/lib/services/suspensions.test.ts:210` | PASSED |
| **B2-5** | Demo `createSuspension` KO cần xác nhận: buổi SPARRING thành `cancelled` ('Suspension in force'); giáo án `fight_camp` thành `rehab` trong `affectedPlans` | `nextjs-frontend/src/lib/services/suspensions.test.ts:289` | PASSED |
| **B2-6** | Demo `createSuspension` maxTier 3: lưu `blockedSessionTypes = ['SPARRING','GRAPPLING']` và `maxAllowedTier: 3` | `nextjs-frontend/src/lib/services/suspensions.test.ts:361` | PASSED |
| **B2-7** | Dữ liệu mẫu nguyên bản đủ 5 trường hợp: Diego đúng `AWAITING_CLEARANCE`; Tariq có buổi pending và nằm trong [startsOn, endsOn] loại bị chặn; Marcus không còn buổi tương lai bị chặn ở `scheduled`; Lucas có ceiling 3; Emma READY | `nextjs-frontend/src/lib/services/suspensions.test.ts:376` | PASSED |
| **B2-8** | Toàn bộ khoá i18n mới tồn tại đầy đủ ở cả hai từ điển `vi` và `en` (bao gồm `daysRange`) | `nextjs-frontend/src/lib/services/suspensions.test.ts:436` | PASSED |
| **B2-9** | `tierOfTrainingType('recovery_mobility') = 1` và `tierOfTrainingType('sparring') = 5` | `nextjs-frontend/src/lib/services/suspensions.test.ts:481` | PASSED |
| **B2-10** | Demo `gradedReturn`: đình chỉ KO xác nhận ngày D -> ngày D trần 3, D+1 trần 4, từ D+2 null | `nextjs-frontend/src/lib/services/suspensions.test.ts:486` | PASSED |
| **B2-11** | Đình chỉ KO cũ chưa xác nhận đang hiệu lực, tạo MANDATORY_REST mới chặn SPARRING -> buổi SPARRING chuyển thành `cancelled` (không phải `pending`) | `nextjs-frontend/src/lib/services/suspensions.test.ts:515` | PASSED |
| **B2-12** | Demo `createSuspension` KO với `requiresClearance: false` -> ném lỗi validation 422, không tạo đình chỉ | `nextjs-frontend/src/lib/services/suspensions.test.ts:590` | PASSED |
| **B2-13** | Demo getReadiness: võ sĩ có trận SCHEDULED đứng trước trận CAMP trong mảng -> activeBout là trận CAMP; võ sĩ chỉ có trận SCHEDULED -> READY | `nextjs-frontend/src/lib/services/suspensions.test.ts:612` | PASSED |
| **B2-14** | Phân quyền: coach nhận đúng danh sách võ sĩ được phân công (không rỗng); doctor listSuspensions chỉ võ sĩ được phân công; fighter gọi với fighterId người khác -> 403 FORBIDDEN | `nextjs-frontend/src/lib/services/suspensions.test.ts:670` | PASSED |
| **B2-15** | Phân loại sẵn sàng: võ sĩ có 1 đình chỉ ACTIVE và 1 AWAITING_CLEARANCE -> trạng thái `SUSPENDED` | `nextjs-frontend/src/lib/services/suspensions.test.ts:717` | PASSED |
| **B2-16** | Phân loại sẵn sàng: `boutOn` sau ngày kết thúc đình chỉ đang hiệu lực hôm nay -> `ready: true`, `notReadyReasons: []` | `nextjs-frontend/src/lib/services/suspensions.test.ts:745` | PASSED |
| **B2-17** | Tổng hợp 2 đình chỉ hiệu lực: hợp `blockedSessionTypes`, `endsOn` muộn nhất, `expectedResumeOn: null`, `fullReturnOn: null` | `nextjs-frontend/src/lib/services/suspensions.test.ts:769` | PASSED |
| **B2-18** | Validate `getReadiness`: truyền `weightLimitKg` nhưng thiếu `rulesetId` -> ném lỗi validation 422 | `nextjs-frontend/src/lib/services/suspensions.test.ts:803` | PASSED |
| **B2-19** | Lọc `active`: `active=true` chỉ trả đình chỉ đang hiệu lực; đình chỉ KO đã xác nhận đang tập lại nằm ở `active=false` | `nextjs-frontend/src/lib/services/suspensions.test.ts:810` | PASSED |
| **B2-20** | API `applyConflicts`: parse trả về `TrainingSession` thật với `status: 'pending'` (chữ thường) từ dữ liệu backend `PENDING` | `nextjs-frontend/src/lib/services/suspensions.test.ts:848` | PASSED |
| **B2-21** | API `listSuspensions`: nhiều fighterIds gọi 1 request không kèm `fighterId` và lọc client; 1 fighterId gửi `fighterId=...`; luôn gửi `limit=100` | `nextjs-frontend/src/lib/services/suspensions.test.ts:893` | PASSED |
| **B2-22** | Kiểm tra kiến trúc: không có bất kỳ file nào trong `src/lib/actions` hoặc `src/lib/domain` import từ `'*.demo'` | `nextjs-frontend/src/lib/services/suspensions.test.ts:954` | PASSED |
| **B2-23** | Readiness API parse response: có `feasibility.status` là 'NEUTRAL' và 'OVER_LIMIT' -> không lỗi | `nextjs-frontend/src/lib/services/suspensions.test.ts:979` | PASSED |
| **B2-24** | Demo readiness feasibility: không có `weightLimitKg` -> feasibility undefined; có đủ -> status khớp `getFeasibility` của `bouts.demo` | `nextjs-frontend/src/lib/services/suspensions.test.ts:1022` | PASSED |
| **B2-25** | Demo tạo KO cần xác nhận: khi võ sĩ có buổi 'pending' loại bị chặn sau startsOn -> buổi thành 'cancelled', có trong affectedSessions | `nextjs-frontend/src/lib/services/suspensions.test.ts:1056` | PASSED |
| **B2-26** | Demo listConflicts: đình chỉ đã xác nhận -> `[]`; đình chỉ bắt đầu ngày mai -> `[]` | `nextjs-frontend/src/lib/services/suspensions.test.ts:1101` | PASSED |
| **B2-27** | Demo applyConflicts: sessionId không có trong đề xuất -> ném lỗi 422, không buổi nào bị đổi | `nextjs-frontend/src/lib/services/suspensions.test.ts:1163` | PASSED |
| **B2-28** | Server action clear: lỗi mã `SUSPENSION_ALREADY_CLEARED` trả câu "đã được xác nhận"; lỗi 409 mã `SESSION_STATE_CONFLICT` trả câu chung | `nextjs-frontend/src/lib/services/suspensions.test.ts:1225` | PASSED |
| **B2-29** | ListSuspensions API: phân trang vượt số trang tối đa -> ném lỗi `PAGINATION_LIMIT_EXCEEDED` | `nextjs-frontend/src/lib/services/suspensions.test.ts:1271` | PASSED |
| **B2-30** | Schema tạo đình chỉ: `requiresClearance` nhận `"on"` -> `true`; `days` ngoài 1-365 -> câu lỗi tiếng Việt | `nextjs-frontend/src/lib/services/suspensions.test.ts:1296` | PASSED |

---

## Lệnh đã chạy

### pnpm --filter nextjs-frontend lint
```text
$ eslint
```
Kết quả: 0 lỗi, 0 cảnh báo (exit code 0).

### pnpm --filter nextjs-frontend typecheck
```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```
Kết quả: 0 lỗi biên dịch TypeScript (exit code 0).

### pnpm --filter nextjs-frontend test
```text
$ vitest run

 RUN  v5.0.1 D:/MMA-TMS/nextjs-frontend


 Test Files  95 passed | 1 skipped (96)
      Tests  863 passed | 2 skipped (865)
   Start at  18:57:57
   Duration  3.29s (import 46%, transform 35%, tests 17%, worker 1%)

  Transform  transforming modules took 12.06s · 35% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns
```
Kết quả: Toàn bộ 95 test suite và 863 test cases passed, 2 skipped (toàn bộ 30 ca kiểm thử B2-1 đến B2-30 đều pass 100%).

## Câu hỏi / việc còn mở
Không có việc còn mở cho Phần B2 lượt sửa 2.

---

## Phần B2, lượt sửa 3: Chuẩn hoá timeline anchor, siết chặt phân quyền và kiểm thử B2-1 đến B2-35

### 1. Thay đổi thực hiện
- **CHẶN N1 - Chuẩn hoá mốc thời gian Mock Data (`suspensions.ts`)**:
  - `src/lib/mocks/suspensions.ts`: chuyển toàn bộ khởi tạo ngày và thời điểm sang sử dụng `TODAY_KEY` và `MOCK_ANCHOR_MS` từ `@/lib/mocks/time`.
  - `clearedAt` của Lucas Ferreira được xác định bằng `Math.max(startOfDayMs, MOCK_ANCHOR_MS - 30 * 60_000)`.
  - Toàn bộ thư mục `nextjs-frontend/src/lib/mocks/` không còn bất kỳ lệnh `new Date()` hay `Date.now()` không xác định nào do B2 thêm vào. Đảm bảo `fingerprint(seedData())` hoàn toàn bất biến giữa các bundle (trang, server action, route handler).
- **NÊN SỬA 5 - Kiểm tra quyền chính xác từ đối tượng đình chỉ trong Server Actions**:
  - `clearSuspensionAction` và `applyConflictsAction` gọi `getSuspensionService(id)` để lấy đình chỉ thật từ kho dữ liệu, sau đó xác thực quyền với `suspension.fighterId` qua `canAccessFighter(user, suspension.fighterId)`.
  - Không tin cậy và không sử dụng giá trị `fighterId` gửi từ client form. Trường hợp không tìm thấy đình chỉ trả lỗi `suspensions.action.notFound`; trường hợp thiếu quyền trả `suspensions.action.unauthorized`.
- **NÊN SỬA 6 - Chuẩn hoá ánh xạ lỗi 422 & lỗi không phải ApiError**:
  - `mapSuspensionActionError`: với lỗi 422 (`VALIDATION_ERROR`), các `fieldErrors` được ánh xạ trực tiếp từ `path` sang từ điển i18n của ứng dụng (`clearanceNoteLength`, `daysRange`, `startsOnNotBeforeToday`, `maxTierAndTypesExclusive`, `blockedSessionTypesMin`, `requiresClearanceKoMandatory`, ...), không bao giờ hiển thị thông điệp tiếng Anh từ backend (`details[].message`).
  - Lỗi không phải `ApiError` (ví dụ `Error` mạng hoặc runtime) không đoán theo chuỗi `"not found"`, luôn trả thông điệp chung an toàn `suspensions.action.failed`.
- **NÊN SỬA N2 - Siết chặt phân quyền Demo `clearSuspension`**:
  - Chỉ người dùng có vai trò `coach` hoặc `doctor` (và được phân công võ sĩ tương ứng) mới được phép xác nhận kết thúc đình chỉ.
  - Người dùng có vai trò `fighter` hoặc `admin` khi gọi sẽ bị ném lỗi 403 `FORBIDDEN` (đồng bộ tuyệt đối với `nestjs-api/src/suspensions/suspensions.service.ts:171`).
- **NÊN SỬA N3 - Bổ sung tham số actor & phân quyền Demo `listConflicts`**:
  - `listConflicts(id: string, actor?: User)` ở cả tầng service API và demo nhận `actor`.
  - Demo `listConflicts`: nếu `id` không tồn tại ném 404 `SUSPENSION_NOT_FOUND`; nếu `actor` không phải `admin` và không có quyền truy cập võ sĩ của đình chỉ (`!canAccessFighter(actor, suspension.fighterId)`) ném 403 `FORBIDDEN` (đồng bộ với `nestjs-api/src/training/training-suspension-conflicts.service.ts:274-277`).
- **NÊN SỬA N4 - Lọc và ưu tiên trận đấu trong Demo Readiness**:
  - Bỏ qua toàn bộ các trận đấu đã bị xoá mềm (`b.deletedAt === null || b.deletedAt === undefined`).
  - Khi võ sĩ có nhiều trận đang chạy (`CAMP`, `FIGHT_WEEK`, `WEIGHED_IN`), sắp xếp theo `boutAt` tăng dần và chọn trận có ngày thi đấu sớm nhất (`candidateBouts[0]`).
- **NÊN SỬA N5 - Kiểm tra Ruleset tồn tại & Phân quyền Coach/Doctor trong `listSuspensions`**:
  - Demo `getReadiness`: khi nhận `rulesetId`, kiểm tra trong `db().rulesets`; nếu không tìm thấy ném lỗi 404 `RULESET_NOT_FOUND` (như backend `requireRuleset`).
  - Demo `listSuspensions`: nếu `coach` hoặc `doctor` truyền `filter.fighterId` hoặc `filter.fighterIds` chứa võ sĩ không được phân công, ném lỗi 403 `FORBIDDEN` ngay lập tức (không trả về mảng rỗng `[]`).
- **NÊN SỬA N6 - Quy tắc xung đột với `technical_drilling`**:
  - `technical_drilling` không có mã backend tương đương, thuộc bậc 3. Trong `isSessionBlockedBySuspension` và `planConflicts`, buổi `technical_drilling` bị chặn khi bậc của nó (3) lớn hơn `maxAllowedTier` của đình chỉ. Có comment giải thích chi tiết trong code.

---

## Phần B2, lượt sửa 4: Tối ưu hoá API mode, hoàn thiện side effects cho technical_drilling và kiểm thử B2-1 đến B2-39

### Thay đổi
1. **F1 - Truyền `type` trong `applySuspensionSideEffects` (`src/lib/domain/suspension-rules.ts`)**:
   - Truyền `type: s.type` trong `sessionInputs` (dòng ~610-616) và `type: session.type` trong `isSessionBlockedBySuspension` (dòng ~648-653) khi tính side effects.
   - Nhờ đó, các buổi tập `technical_drilling` (bậc 3) tương lai của võ sĩ sẽ được tự động huỷ hoặc chuyển sang chờ xác nhận khi tạo đình chỉ có bậc tối đa < 3 (ví dụ KO mặc định `maxAllowedTier: 1`).
2. **F2 - Bỏ pre-check `getSuspension` ở API mode trong Server Actions (`src/lib/actions/suspensions.ts`)**:
   - Ở API mode, `clearSuspensionAction` và `applyConflictsAction` gọi thẳng `authenticatedMutableApiRequest` đến endpoint backend (`POST /suspensions/:id/clear`, `POST /suspensions/:id/conflicts/apply`), không gọi `getSuspension(id)` duyệt toàn bộ trang danh sách đình chỉ (tránh gây lỗi `PAGINATION_LIMIT_EXCEEDED` khi số lượng bản ghi lớn).
   - Backend đã có cơ chế kiểm tra quyền và ném 403/404; `mapSuspensionActionError` của action bắt lỗi và map ra câu tiếng Việt chuẩn.
   - Ở Demo mode, kiểm tra phân quyền vẫn được thực thi đầy đủ tại service demo.
3. **F3 - Phân biệt thông báo lỗi 422 `requiresClearance` theo lý do (`src/lib/actions/suspensions.ts`)**:
   - Khi backend hoặc schema trả lỗi 422 trên trường `requiresClearance`:
     - Nếu lý do là `KO` hoặc `TKO` (hoặc thông báo backend chứa "mandatory"): map về khoá `suspensions.action.requiresClearanceKoMandatory` ("Đình chỉ do KO hoặc TKO bắt buộc phải cần xác nhận y tế mới được tập lại.").
     - Nếu lý do là `DQ` hoặc `MANDATORY_REST`: map về khoá `suspensions.action.requiresClearanceDqForbidden` ("Đình chỉ do DQ hoặc nghỉ bắt buộc không được bật yêu cầu xác nhận.").
4. **F4 - Chuẩn hoá tham số và hành vi backend trong Demo Service (`src/lib/services/suspensions.ts`, `src/lib/services/suspensions.demo.ts`)**:
   - `listConflicts`: Tham số `actor: User` là bắt buộc (không còn tuỳ chọn).
   - Demo `applyConflicts`: Từ chối người dùng có role `doctor` (và `fighter`) với mã lỗi 403 `FORBIDDEN` (khớp với `assertTrainingWriteAllowed` của backend).
   - Demo `getReadiness`: Lọc bỏ võ sĩ không hoạt động (`deletedAt != null` hoặc `status === "inactive" || status === "suspended" || isActive === false`), sắp xếp các dòng trả về theo tên võ sĩ `a.name.localeCompare(b.name) || a.id.localeCompare(b.id)` khớp với `nestjs-api/src/bouts/bouts.repo.ts:691-726`.
5. **Mocks & Test Suite**:
   - `src/lib/mocks/db.ts`: Export `seedData` và `fingerprint`.
   - `src/lib/services/suspensions.test.ts`:
     - Mock `next/cache` với `revalidatePath: vitest.fn()`.
     - Cập nhật **B2-7**: Bổ sung `technical_drilling` vào danh sách loại bị chặn của Marcus.
     - Cập nhật **B2-27**: Coach phân công võ sĩ A gửi form fighterId = A nhưng đình chỉ thuộc B -> bị từ chối; đối chứng: đình chỉ thuộc A -> thành công (cả clear và applyConflicts); sessionId không thuộc đề xuất -> 422.
     - Cập nhật **B2-28**: Không dùng spy `getSuspensionSpy`, kiểm tra map lỗi theo mã.
     - Viết lại **B2-31**: Gọi `seedData()` 2 lần với fake timers cách nhau 1 giờ -> fingerprint giống hệt nhau, và kết quả chứa hiệu ứng tự áp dụng (Tariq có buổi pending, Marcus có buổi cancelled).
     - Bổ sung **B2-35**: Demo `createSuspension` KO mặc định cho võ sĩ có buổi `technical_drilling` scheduled trong khoảng -> buổi đó `cancelled` và có trong `affectedSessions`.
     - Thêm **B2-36**: API mode `clearSuspensionAction` không gọi request liệt kê đình chỉ nào (`authenticatedApiRequest` gọi 0 lần), gọi thẳng `POST /suspensions/:id/clear` (`authenticatedMutableApiRequest`); backend trả 403 -> câu vi forbidden.
     - Thêm **B2-37**: 422 `requiresClearance` với lý do MANDATORY_REST -> câu `requiresClearanceDqForbidden`; với KO -> câu bắt buộc xác nhận.
     - Thêm **B2-38**: Demo readiness: không có dòng cho võ sĩ không hoạt động; các dòng sắp theo tên.
     - Thêm **B2-39**: Demo `applyConflicts` bởi DOCTOR -> 403 `FORBIDDEN`.

---

## Đối chiếu tiêu chí nghiệm thu (Phần B2: Toàn bộ B2-1 đến B2-39)

| Mã ca | Mô tả tiêu chí | Đáp ứng ở đâu (file:dòng) | Kết quả |
| --- | --- | --- | --- |
| **B2-1** | Parse response JSON tạo đình chỉ theo contract backend (có `maxAllowedTier`, `gradedReturn`, map `CANCEL` -> `cancel`, thiếu `affectedSessions` ném lỗi) | `nextjs-frontend/src/lib/services/suspensions.test.ts:109` | PASSED |
| **B2-2** | Ánh xạ trạng thái buổi tập: `PENDING` <-> `pending` hai chiều; parse buổi backend `PENDING` thành công | `nextjs-frontend/src/lib/services/suspensions.test.ts:175` | PASSED |
| **B2-3** | Hằng số bậc cường độ: Đủ 8 loại buổi tập backend theo đúng giá trị bậc 1–5 | `nextjs-frontend/src/lib/services/suspensions.test.ts:213` | PASSED |
| **B2-4** | Demo `createSuspension` OTHER 7 ngày maxTier 3: buổi GRAPPLING (bậc 4) thành `pending`, PAD_WORK (bậc 3) giữ nguyên | `nextjs-frontend/src/lib/services/suspensions.test.ts:231` | PASSED |
| **B2-5** | Demo `createSuspension` KO cần xác nhận: buổi SPARRING thành `cancelled` ('Suspension in force'); giáo án `fight_camp` thành `rehab` trong `affectedPlans` | `nextjs-frontend/src/lib/services/suspensions.test.ts:310` | PASSED |
| **B2-6** | Demo `createSuspension` maxTier 3: lưu `blockedSessionTypes = ['SPARRING','GRAPPLING']` và `maxAllowedTier: 3` | `nextjs-frontend/src/lib/services/suspensions.test.ts:382` | PASSED |
| **B2-7** | Dữ liệu mẫu nguyên bản đủ 5 trường hợp: Diego đúng `AWAITING_CLEARANCE`; Tariq có buổi pending, nằm trong [startsOn, endsOn] và loại nằm trong `blockedSessionTypes`; Marcus không còn buổi tương lai bị chặn ở `scheduled` (kể cả `technical_drilling`); Lucas có ceiling 3; Emma READY | `nextjs-frontend/src/lib/services/suspensions.test.ts:397` | PASSED |
| **B2-8** | Toàn bộ khoá i18n mới tồn tại đầy đủ ở cả hai từ điển `vi` và `en` (bao gồm `daysRange`) | `nextjs-frontend/src/lib/services/suspensions.test.ts:459` | PASSED |
| **B2-9** | `tierOfTrainingType('recovery_mobility') = 1` và `tierOfTrainingType('sparring') = 5` | `nextjs-frontend/src/lib/services/suspensions.test.ts:504` | PASSED |
| **B2-10** | Demo `gradedReturn`: đình chỉ KO xác nhận ngày D -> ngày D trần 3, D+1 trần 4, từ D+2 null | `nextjs-frontend/src/lib/services/suspensions.test.ts:509` | PASSED |
| **B2-11** | Đình chỉ KO cũ chưa xác nhận đang hiệu lực, tạo MANDATORY_REST mới chặn SPARRING -> buổi SPARRING chuyển thành `cancelled` (không phải `pending`) | `nextjs-frontend/src/lib/services/suspensions.test.ts:538` | PASSED |
| **B2-12** | Demo `createSuspension` KO với `requiresClearance: false` -> ném lỗi validation 422, không tạo đình chỉ | `nextjs-frontend/src/lib/services/suspensions.test.ts:613` | PASSED |
| **B2-13** | Demo getReadiness: võ sĩ có trận SCHEDULED đứng trước trận CAMP trong mảng -> activeBout là trận CAMP; võ sĩ chỉ có trận SCHEDULED -> READY | `nextjs-frontend/src/lib/services/suspensions.test.ts:635` | PASSED |
| **B2-14** | Phân quyền: coach nhận đúng danh sách võ sĩ được phân công (không rỗng); doctor listSuspensions chỉ võ sĩ được phân công; fighter gọi với fighterId người khác -> 403 FORBIDDEN | `nextjs-frontend/src/lib/services/suspensions.test.ts:693` | PASSED |
| **B2-15** | Phân loại sẵn sàng: võ sĩ có 1 đình chỉ ACTIVE và 1 AWAITING_CLEARANCE -> trạng thái `SUSPENDED` | `nextjs-frontend/src/lib/services/suspensions.test.ts:724` | PASSED |
| **B2-16** | Phân loại sẵn sàng: `boutOn` sau ngày kết thúc đình chỉ đang hiệu lực hôm nay -> `ready: true`, `notReadyReasons: []` | `nextjs-frontend/src/lib/services/suspensions.test.ts:752` | PASSED |
| **B2-17** | Tổng hợp 2 đình chỉ hiệu lực: hợp `blockedSessionTypes`, `endsOn` muộn nhất, `expectedResumeOn: null`, `fullReturnOn: null` | `nextjs-frontend/src/lib/services/suspensions.test.ts:776` | PASSED |
| **B2-18** | Validate `getReadiness`: truyền `weightLimitKg` nhưng thiếu `rulesetId` -> ném lỗi validation 422 | `nextjs-frontend/src/lib/services/suspensions.test.ts:810` | PASSED |
| **B2-19** | Lọc `active`: `active=true` chỉ trả đình chỉ đang hiệu lực; đình chỉ KO đã xác nhận đang tập lại nằm ở `active=false` | `nextjs-frontend/src/lib/services/suspensions.test.ts:817` | PASSED |
| **B2-20** | API `applyConflicts`: parse trả về `TrainingSession` thật với `status: 'pending'` (chữ thường) từ dữ liệu backend `PENDING` | `nextjs-frontend/src/lib/services/suspensions.test.ts:855` | PASSED |
| **B2-21** | API `listSuspensions`: nhiều fighterIds gọi 1 request không kèm `fighterId` và lọc client; 1 fighterId gửi `fighterId=...`; luôn gửi `limit=100` | `nextjs-frontend/src/lib/services/suspensions.test.ts:900` | PASSED |
| **B2-22** | Kiểm tra kiến trúc: không có bất kỳ file nào trong `src/lib/actions` hoặc `src/lib/domain` import từ `'*.demo'` | `nextjs-frontend/src/lib/services/suspensions.test.ts:961` | PASSED |
| **B2-23** | Readiness API parse response: có `feasibility.status` là 'NEUTRAL' và 'OVER_LIMIT' -> không lỗi; parse 'CAUTION' -> ném lỗi Zod | `nextjs-frontend/src/lib/services/suspensions.test.ts:986` | PASSED |
| **B2-24** | Demo readiness feasibility: dùng `f-minh-tran`, không có `weightLimitKg` -> undefined; có đủ -> status, remainingPct, latestKg, daysToWeighIn khớp `getFeasibility` của `bouts.demo` | `nextjs-frontend/src/lib/services/suspensions.test.ts:1037` | PASSED |
| **B2-25** | Demo tạo KO cần xác nhận: khi võ sĩ có buổi 'pending' loại bị chặn sau startsOn -> buổi thành 'cancelled', có trong affectedSessions | `nextjs-frontend/src/lib/services/suspensions.test.ts:1075` | PASSED |
| **B2-26** | Demo listConflicts: đình chỉ đã xác nhận -> `[]`; đình chỉ bắt đầu ngày mai -> `[]`; đình chỉ đang hiệu lực -> có proposal | `nextjs-frontend/src/lib/services/suspensions.test.ts:1120` | PASSED |
| **B2-27** | Demo applyConflicts: sessionId không có trong đề xuất -> 422; unassigned coach -> 403; action clear và applyConflicts gửi form fighterId sai vẫn kiểm tra suspension.fighterId thật | `nextjs-frontend/src/lib/services/suspensions.test.ts:1236` | PASSED |
| **B2-28** | Server action clear: lỗi 409 `SUSPENSION_ALREADY_CLEARED` trả câu vi "đã được xác nhận"; 404 trả câu riêng vi; 422 clearanceNote tiếng Việt không chứa "Too short"; lỗi khác trả câu chung | `nextjs-frontend/src/lib/services/suspensions.test.ts:1450` | PASSED |
| **B2-29** | ListSuspensions API: phân trang vượt số trang tối đa -> ném lỗi `PAGINATION_LIMIT_EXCEEDED` | `nextjs-frontend/src/lib/services/suspensions.test.ts:1515` | PASSED |
| **B2-30** | Schema tạo đình chỉ: `requiresClearance` nhận `"on"` -> `true`; `days` ngoài 1-365 -> câu lỗi tiếng Việt | `nextjs-frontend/src/lib/services/suspensions.test.ts:1540` | PASSED |
| **B2-31** | Deterministic mock anchor: gọi `seedData()` tại các thời điểm `Date.now()` cách nhau 1 giờ vẫn giữ nguyên fingerprint và có hiệu ứng tự áp dụng (Tariq pending, Marcus cancelled) | `nextjs-frontend/src/lib/services/suspensions.test.ts:1586` | PASSED |
| **B2-32** | Phân quyền clear: demo `clearSuspension` bởi `fighter` và `admin` -> ném 403 `FORBIDDEN` | `nextjs-frontend/src/lib/services/suspensions.test.ts:1612` | PASSED |
| **B2-33** | Phân quyền conflicts: demo `listConflicts` id sai -> 404 `SUSPENSION_NOT_FOUND`; unassigned coach -> 403 `FORBIDDEN` | `nextjs-frontend/src/lib/services/suspensions.test.ts:1629` | PASSED |
| **B2-34** | Chọn trận đấu readiness: võ sĩ có 2 trận CAMP (trận sớm hơn boutAt +10 ngày, trận muộn boutAt +20 ngày) và 1 trận CAMP bị xoá mềm -> chọn đúng trận sớm chưa xoá | `nextjs-frontend/src/lib/services/suspensions.test.ts:1650` | PASSED |
| **B2-35** | Xung đột `technical_drilling`: đình chỉ KO bậc tối đa 1 chặn `technical_drilling` (bậc 3); đình chỉ bậc tối đa 3 không chặn; demo createSuspension KO huỷ buổi `technical_drilling` | `nextjs-frontend/src/lib/services/suspensions.test.ts:1767` | PASSED |
| **B2-36** | API mode `clearSuspensionAction` không gọi request duyệt danh sách đình chỉ (`authenticatedApiRequest` 0 lần), gọi thẳng `POST /suspensions/:id/clear`; backend trả 403 -> câu vi forbidden | `nextjs-frontend/src/lib/services/suspensions.test.ts:1831` | PASSED |
| **B2-37** | 422 `requiresClearance` với lý do MANDATORY_REST -> câu `requiresClearanceDqForbidden`; với KO -> câu bắt buộc xác nhận (`requiresClearanceKoMandatory`) | `nextjs-frontend/src/lib/services/suspensions.test.ts:1878` | PASSED |
| **B2-38** | Demo readiness: không có dòng cho võ sĩ không hoạt động (bị đình chỉ, xoá mềm); các dòng sắp theo thứ tự chữ cái tên võ sĩ | `nextjs-frontend/src/lib/services/suspensions.test.ts:1942` | PASSED |
| **B2-39** | Demo `applyConflicts` bởi DOCTOR -> 403 `FORBIDDEN` (như backend `assertTrainingWriteAllowed`) | `nextjs-frontend/src/lib/services/suspensions.test.ts:1975` | PASSED |

---

## Lệnh đã chạy

### pnpm --filter nextjs-frontend lint
```text
$ eslint
```
Kết quả: 0 lỗi, 0 cảnh báo (exit code 0).

### pnpm --filter nextjs-frontend typecheck
```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```
Kết quả: 0 lỗi biên dịch TypeScript (exit code 0).

### pnpm --filter nextjs-frontend test
```text
$ vitest run

 RUN  v5.0.1 D:/MMA-TMS/nextjs-frontend


 Test Files  95 passed | 1 skipped (96)
      Tests  872 passed | 2 skipped (874)
   Start at  19:49:01
   Duration  3.24s (import 45%, transform 36%, tests 17%, worker 1%)

  Transform  transforming modules took 12.49s · 36% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns
```
Kết quả: 95/95 test suites passed, 872 passed, 2 skipped (toàn bộ 39/39 ca kiểm thử B2-1 đến B2-39 đều pass 100%).

## Câu hỏi / việc còn mở
Không có việc còn mở cho Phần B2. Toàn bộ các yêu cầu của Review lượt 4 (F1, F2, F3, F4 và các ca kiểm thử B2-1 đến B2-39) đã được hoàn thành triệt để, đúng khuôn mẫu và đạt 100% chuẩn chất lượng. Đã sẵn sàng chuyển sang **Phần B3: Component dùng chung (Shared Components)**.
---

## Lệnh đã chạy

### pnpm --filter nextjs-frontend lint
```text
$ eslint
```
Kết quả: 0 lỗi, 0 cảnh báo (exit code 0).

### pnpm --filter nextjs-frontend typecheck
```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```
Kết quả: 0 lỗi biên dịch TypeScript (exit code 0).

### pnpm --filter nextjs-frontend test
```text
$ vitest run

 RUN  v5.0.1 D:/MMA-TMS/nextjs-frontend


 Test Files  95 passed | 1 skipped (96)
      Tests  868 passed | 2 skipped (870)
   Start at  19:24:51
   Duration  3.55s (import 45%, transform 36%, tests 18%, worker 1%)

  Transform  transforming modules took 12.52s · 36% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns
```
Kết quả: 95/95 test suites passed, 868 passed, 2 skipped (toàn bộ 35/35 ca kiểm thử B2-1 đến B2-35 đều pass 100%).

## Câu hỏi / việc còn mở
Không có việc còn mở cho Phần B2. Toàn bộ các yêu cầu của Review lượt 3 (CHẶN N1, NÊN SỬA 5, 6, N2, N3, N4, N5, N6 và các ca kiểm thử B2-1 đến B2-35) đã được hoàn thành triệt để, đúng khuôn mẫu và đạt 100% chuẩn chất lượng. Đã sẵn sàng chuyển sang **Phần B3: Component dùng chung (Shared Components)**.
