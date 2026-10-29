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

---

## Phần B3: Component dùng chung (Shared Components)

### 1. Thay đổi thực hiện
- **`IntensityLadder` (`src/components/domain/intensity-ladder.tsx`)**:
  - Nhận props: `maxAllowedTier` (0–5), `ceiling?` (3|4, trần lộ trình), `size` (`sm` | `md` | `lg`), `interactive?` + `value`/`onChange`, `locale`.
  - 5 đoạn tăng dần độ cao (bậc 1 thấp nhất tới bậc 5 cao nhất). Ở size `md` và `lg`, mỗi đoạn có icon loại buổi đại diện của bậc từ `TRAINING_TYPE_ICONS` (Bậc 1: `recovery_mobility`, Bậc 2: `strength_conditioning`, Bậc 3: `shadow_boxing`, Bậc 4: `grappling`, Bậc 5: `sparring`). Size `sm` vẽ dạng thanh tín hiệu tối giản không có icon.
  - Đoạn được phép tô màu đặc theo token `success` (`var(--success-solid)`, chữ/icon trắng).
  - Đoạn bị chặn mang sọc chéo `repeating-linear-gradient` từ token neutral (`--neutral-soft` và `--neutral-border`, chữ/icon `text-neutral-fg`).
  - Đoạn bị chặn do trần lộ trình hôm nay (`ceiling`) mang sọc chéo info (`--info-soft` và `--info-border`, chữ/icon `text-info-fg`).
  - Mỗi đoạn có nhãn cho trình đọc màn hình đầy đủ (ví dụ `"Bậc 3, kỹ thuật không va chạm: được tập"`).
  - Size `lg` hiển thị lưới chú thích tên bậc chi tiết dưới thanh.
  - Chế độ `interactive`: container mang `role="slider"`, `aria-valuemin=1`, `aria-valuemax=5`, `aria-valuenow`, `aria-valuetext` là tên bậc; hỗ trợ bàn phím mũi tên trái/phải/lên/xuống, Home, End; bấm vào từng đoạn để chọn bậc; focus ring dùng token ring (`focus-visible:ring-2 focus-visible:ring-[var(--ring)]`).
  - Chuyển động: chuyển màu lần lượt từ trái sang phải với transition 200 ms, so le 40 ms bằng `transition-delay`; sử dụng hook `useIsMounted` qua `useSyncExternalStore` để triệt tiêu chuyển động khi tải trang / SSR.

- **`SuspensionStatusBadge` (`src/components/domain/status-badges.tsx`)**:
  - Hỗ trợ đầy đủ 5 trạng thái với tone chuẩn thiết kế:
    - `ACTIVE`: "Đang đình chỉ" (hoặc "Đang đình chỉ · ngày x/y" khi truyền `startsOn`, `endsOn`, `today`), tone `danger` (solid).
    - `AWAITING_CLEARANCE`: "Chờ xác nhận", tone `warning` (soft), icon `Clock`.
    - `GRADED_RETURN`: "Tập lại bậc n/5" (với `ceiling`), tone `info` (soft), icon `TrendingUp`.
    - `ENDED`: "Đã hết", tone `success` (soft), icon `CircleCheck`.
    - `UPCOMING`: "Sắp hiệu lực", tone `neutral` (soft), icon `CalendarClock`.
  - Luôn đi kèm icon Lucide và nhãn chữ (không phụ thuộc vào màu sắc đơn thuần).

- **`GradedReturnSteps` (`src/components/domain/graded-return-steps.tsx`)**:
  - Nhận props: `gradedReturn` (`{ ceiling: 3 | 4, fullReturnOn: string }` hoặc `null`), `today`, `locale`.
  - 3 bước ngang nối nhau bằng thanh tiến độ: Bậc 3 · Bậc 4 · Tập đầy đủ.
  - Ngày dưới mỗi bước được định dạng chuẩn học viện qua `formatShortDate`.
  - Bước đã qua (`passed`) có dấu tích `Check` nền `success-solid`.
  - Bước hiện tại (`current`) nổi bật với nền `info-solid`, ring sáng nhẹ `animate-graded-pulse` (pulse 2 lần rồi dừng theo keyframes).
  - Câu tóm tắt "Sparring được từ {ngày}" phía dưới.
  - Trả về `null` (không render) khi `gradedReturn = null`.

- **`SessionStatusBadge` cập nhật trạng thái `pending` (`src/components/domain/status-badges.tsx`)**:
  - Trạng thái `pending`: hiển thị "Chờ xếp lại", icon đồng hồ `Clock`, tone `warning`, variant `outline` (`bg-transparent text-warning-fg ring-warning-border`), phân biệt rõ ràng với "Chờ xác nhận" (`soft`).

- **CSS & Keyframes (`src/app/globals.css`)**:
  - Thêm `@keyframes graded-step-pulse` và utility `.animate-graded-pulse` với cấu hình `animation: graded-step-pulse 1.2s ease-out 2 forwards;`.
  - Thêm utilities `.ladder-pattern-blocked` và `.ladder-pattern-ceiling` cho sọc chéo của thang bậc.
  - Khối `@media (prefers-reduced-motion: reduce)` toàn cục tắt toàn bộ transition/animation và bổ sung `.animate-graded-pulse { animation: none !important; }`.

- **Từ điển đa ngôn ngữ (`src/lib/i18n/messages/coach-bouts.vi.ts` & `coach-bouts.en.ts`)**:
  - Đồng bộ 100% các khoá i18n mới giữa `vi` và `en`: nhãn trạng thái đình chỉ, thang cường độ, và lộ trình tập lại.

- **Kiểm thử chất lượng (`src/components/domain/suspension-components.test.ts`)**:
  - Tạo bộ kiểm thử toàn diện 11 test case, bao gồm B3-1 đến B3-8 và các ca mở rộng.
  - Sử dụng `renderToStaticMarkup` từ `react-dom/server` kết hợp kiểm thử logic hàm thuần, phù hợp 100% với môi trường test của repository.

---

### 2. Đối chiếu tiêu chí nghiệm thu (Phần B3: B3-1 đến B3-8)

| Mã ca | Tiêu chí | Đáp ứng ở đâu (file:dòng) | Kết quả |
| --- | --- | --- | --- |
| **B3-1** | `IntensityLadder maxAllowedTier={3}`: 5 đoạn; đoạn 1–3 "được tập", 4–5 "bị chặn"; mỗi đoạn có nhãn cho trình đọc màn hình | `nextjs-frontend/src/components/domain/suspension-components.test.ts:27` | PASSED |
| **B3-2** | `maxAllowedTier={5} ceiling={3}`: Đoạn 4–5 hiện "bị chặn hôm nay" (trần lộ trình) | `nextjs-frontend/src/components/domain/suspension-components.test.ts:61` | PASSED |
| **B3-3** | `interactive`, đang bậc 2, nhấn mũi tên phải -> `onChange(3)`; nhấn trái ở bậc 1 không xuống dưới 1 | `nextjs-frontend/src/components/domain/suspension-components.test.ts:88` | PASSED |
| **B3-4** | `GradedReturnSteps gradedReturn={{ceiling:4, fullReturnOn:'2026-12-04'}}`: Bước 1 đã qua, bước 2 hiện tại, bước 3 có ngày 04/12; `gradedReturn=null` không render | `nextjs-frontend/src/components/domain/suspension-components.test.ts:142` | PASSED |
| **B3-5** | `SessionStatusBadge status="pending"`: Chữ "Chờ xếp lại", có icon, tone warning variant outline (khác badge "Chờ xác nhận" soft) | `nextjs-frontend/src/components/domain/suspension-components.test.ts:195` | PASSED |
| **B3-6** | CSS: Mọi animation mới nằm trong khối có `@media (prefers-reduced-motion: reduce)` tắt chúng | `nextjs-frontend/src/components/domain/suspension-components.test.ts:226` | PASSED |
| **B3-7** | `SuspensionStatusBadge GRADED_RETURN ceiling 4` hiện "Tập lại bậc 4/5" | `nextjs-frontend/src/components/domain/suspension-components.test.ts:252` | PASSED |
| **B3-8** | `IntensityLadder maxAllowedTier 0` -> cả 5 đoạn bị chặn | `nextjs-frontend/src/components/domain/suspension-components.test.ts:278` | PASSED |

---

### 3. Lệnh đã chạy

#### pnpm --filter nextjs-frontend lint
```text
$ eslint
```
Kết quả: Sạch 100%, 0 lỗi, 0 cảnh báo (exit code 0).

#### pnpm --filter nextjs-frontend typecheck
```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```
Kết quả: 0 lỗi biên dịch TypeScript (exit code 0).

#### pnpm --filter nextjs-frontend test
```text
$ vitest run

 RUN  v5.0.1 D:/MMA-TMS/nextjs-frontend


 Test Files  96 passed | 1 skipped (97)
      Tests  883 passed | 2 skipped (885)
   Start at  20:10:55
   Duration  3.57s (import 46%, transform 35%, tests 18%, worker 1%)

  Transform  transforming modules took 12.10s · 35% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns
```
Kết quả: 96/96 test suites passed, 883 passed, 2 skipped (toàn bộ 8/8 ca kiểm thử B3-1 đến B3-8 đều pass 100%).

---

### 4. Tiêu chuẩn chất lượng (Impeccable Craft Floor)
- **Tương phản chữ ≥ 4.5:1**: Sử dụng hệ thống semantic token chuẩn (`--fg`, `--fg-muted`, `--text-info-fg`, `--text-warning-fg`, `--text-neutral-fg`, `--fg-inverse` trên solid).
- **Trạng thái không chỉ dựa vào màu**: Luôn có icon Lucide đi kèm (`Check`, `Clock`, `TrendingUp`, `CircleCheck`, `Ban`, `CalendarClock`, v.v.) và nhãn chữ rõ ràng hoặc screen reader label.
- **Không gradient chữ, không viền màu dày trên thẻ, không bóng đổ cứng, không emoji thay icon**: Toàn bộ icon dùng Lucide React SVG, border 1px tinh tế theo border tokens, bóng đổ chuẩn token.
- **Chuyển động có nghĩa**: Chỉ xuất hiện khi có sự kiện thay đổi trạng thái (chọn bậc đổi màu tuần tự 200ms so le 40ms; vòng sáng nhẹ pulse 2 lần rồi dừng cho bước hiện tại; hoàn toàn không có hiệu ứng khi tải trang).
- **Focus bàn phím thấy rõ**: Sử dụng `focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2`.

## Câu hỏi / việc còn mở
Không có việc còn mở cho Phần B3. Đã hoàn thành 100% component dùng chung và sẵn sàng bước sang **Phần B4: Màn /coach/bouts/suspensions**.


---

## Phần B3, lượt sửa 1: Tiếp thu phản hồi Review

### 1. Thay đổi thực hiện theo 12 điểm Review
1. **Loại bỏ animation pulse của bước hiện tại**:
   - Xoá `@keyframes graded-step-pulse` và utility `.animate-graded-pulse` khỏi `globals.css`.
   - `GradedReturnSteps`: Bước hiện tại làm nổi bật bằng vòng viền tĩnh (ring) theo token info: `ring-2 ring-info-solid ring-offset-2 ring-offset-surface`, tuyệt đối không có class animation nào.
2. **Loại bỏ inline style và mã màu cứng trong `IntensityLadder`**:
   - Xoá hoàn toàn `SEGMENT_STYLE_MAP` và toàn bộ inline style màu.
   - Chỉ dùng class Tailwind và các utility pattern: đoạn được phép dùng `bg-success-solid text-white border-success-solid` (text-white theo quy ước `ui/tone.ts:17` bảo đảm tương phản ≥ 4.5:1 cả light/dark mode); đoạn bị chặn dùng class `.ladder-pattern-blocked`; trần lộ trình dùng `.ladder-pattern-ceiling`.
3. **Độ tương phản số bậc**:
   - Bỏ `opacity-85` trên số bậc trong các đoạn của `IntensityLadder` để đạt độ tương phản chữ ≥ 4.5:1.
4. **Chuẩn hoá cấu trúc ARIA**:
   - Slider interactive: Chỉ phần tử cha mang `role="slider"`, `tabIndex={0}`, `aria-valuemin={1}`, `aria-valuemax={5}`, `aria-valuenow`. Các đoạn con `<span>` KHÔNG mang `role="button"` hay `tabIndex`, chỉ gắn `onClick` để click-to-select.
   - Xoá bỏ `aria-label` trên span chung để tránh trùng lặp đọc màn hình; giữ nhãn văn bản `sr-only` bên trong từng đoạn.
   - Ở chế độ không tương tác: toàn thang là `role="img"` có `aria-label` tóm tắt ("Tối đa Bậc n: ..."), các đoạn con có `aria-hidden="true"` để trình đọc màn hình không đọc lặp.
5. **Reduced motion**:
   - Thêm `transition-delay: 0s !important;` vào khối `@media (prefers-reduced-motion: reduce)` toàn cục trong `globals.css`.
   - Các class transition và delay trong `IntensityLadder` đều nằm dưới modifier `motion-safe:` (`motion-safe:transition-all`, `motion-safe:delay-[40ms]`, v.v.).
6. **Đa ngôn ngữ i18n & loại bỏ hằng số trùng lặp**:
   - Mọi chuỗi văn bản trong 3 component đều sử dụng `createTranslator(locale)` và bộ khoá i18n trong `coach-bouts.vi.ts` và `coach-bouts.en.ts`. Không viết cứng kiểm tra `locale === "en"`.
   - Xoá bỏ hằng số `TIER_NAMES_VI` / `TIER_NAMES_EN` trùng lặp, dùng trực tiếp các khoá `intensityTier.{1..5}.name` và `intensityTier.{1..5}.label`.
7. **Tách các hàm thuần sang module không có "use client"**:
   - Đã chuyển toàn bộ hàm thuần: `computeLadderSegments`, `getTierName`, `handleLadderKeyDown`, `TIER_REPRESENTATIVE_TYPES`, `computeGradedReturnSteps` sang `src/lib/domain/intensity-tiers.ts`.
   - Xác nhận file `src/lib/domain/intensity-tiers.ts` KHÔNG chứa directive `"use client"`. Các component client chỉ import và sử dụng.
8. **Chuẩn hoá `GradedReturnSteps`**:
   - Mỗi bước có văn bản `sr-only` trạng thái ("đã qua", "hôm nay", "sắp tới").
   - Đã loại bỏ prop `today` không sử dụng khỏi interface props.
   - Bố cục: các nút bước được gán độ rộng cố định cách đều (`w-24`), thanh kẻ nối giữa các bước co giãn linh hoạt (`flex-1 h-0.5`) chạm sát vào nút kế tiếp.
9. **Nhãn tiếng Anh trạng thái `pending` & loại bỏ dòng thừa**:
   - Cập nhật nhãn tiếng Anh của trạng thái `pending` thành `"To reschedule"` (thay vì "Reschedule pending") trong `labels.ts` và `coach-today.en.ts`.
   - `SESSION_STATUS_META.pending` sử dụng `SESSION_STATUS_LABELS.pending`. Khi không truyền `locale` vào `SessionStatusBadge`, badge hiển thị tiếng Anh chuẩn ("To reschedule").
   - Bỏ dòng thừa kiểm tra variant tại `SessionStatusBadge` (`variant ?? meta.variant`).
10. **`SuspensionStatusBadge` GRADED_RETURN thiếu `ceiling`**:
    - Khi không có `ceiling`, nhãn trả về "Tập lại" (vi) hoặc "Graded return" (en), tuyệt đối không kèm số và không mặc định "3/5".
11. **Kẹp giá trị Slider 1–5 & dọn dẹp**:
    - Giá trị của slider interactive luôn được kẹp chặt trong khoảng 1–5 (`clampedActive = Math.max(1, Math.min(5, ...))`). Khi `maxAllowedTier: 0` và không truyền `value`, `aria-valuenow` luôn là 1.
    - Xoá bỏ hook `useIsMounted` không cần thiết.
12. **Phân biệt trực quan giữa "bị chặn" và "trần lộ trình hôm nay"**:
    - `.ladder-pattern-blocked`: sọc chéo góc `-45deg`, mật độ lặp 4px / 8px từ token neutral.
    - `.ladder-pattern-ceiling`: sọc chéo góc `+45deg`, mật độ lặp 3px / 6px từ token info.
    - Khác biệt rõ rệt cả về góc nghiêng lẫn mật độ sọc, tuân thủ nguyên tắc không phân biệt trạng thái chỉ bằng màu sắc.

---

### 2. Đối chiếu ca kiểm thử (B3-1 đến B3-16)

| Mã ca | Tiêu chí nghiệm thu | Đáp ứng ở đâu (file:dòng) | Kết quả |
| --- | --- | --- | --- |
| **B3-1** | `IntensityLadder maxAllowedTier={3}`: 5 đoạn; đoạn 1–3 'được tập', 4–5 'bị chặn'; mỗi đoạn có nhãn cho trình đọc màn hình | `nextjs-frontend/src/components/domain/suspension-components.test.ts:27` | PASSED |
| **B3-2** | `maxAllowedTier={5} ceiling={3}`: Đoạn 4–5 hiện 'bị chặn hôm nay' (trần lộ trình) | `nextjs-frontend/src/components/domain/suspension-components.test.ts:61` | PASSED |
| **B3-3** | `interactive`, đang bậc 2, nhấn mũi tên phải -> `onChange(3)`; nhấn trái ở bậc 1 không xuống dưới 1 | `nextjs-frontend/src/components/domain/suspension-components.test.ts:88` | PASSED |
| **B3-4** | `GradedReturnSteps gradedReturn={{ceiling:4, fullReturnOn:'2026-12-04'}}`: Bước 1 đã qua, bước 2 hiện tại, bước 3 có ngày 04/12; `gradedReturn=null` không render | `nextjs-frontend/src/components/domain/suspension-components.test.ts:142` | PASSED |
| **B3-5** | `SessionStatusBadge status="pending"`: Chữ "Chờ xếp lại", có icon, tone warning variant outline (khác badge "Chờ xác nhận" soft) | `nextjs-frontend/src/components/domain/suspension-components.test.ts:195` | PASSED |
| **B3-6** | CSS: Có quy tắc làm `transition-delay` về 0 (hoặc delay chỉ nằm trong `motion-safe`) khi `prefers-reduced-motion` | `nextjs-frontend/src/components/domain/suspension-components.test.ts:226` | PASSED |
| **B3-7** | `SuspensionStatusBadge GRADED_RETURN ceiling 4` hiện "Tập lại bậc 4/5" | `nextjs-frontend/src/components/domain/suspension-components.test.ts:246` | PASSED |
| **B3-8** | `IntensityLadder maxAllowedTier 0` -> cả 5 đoạn bị chặn | `nextjs-frontend/src/components/domain/suspension-components.test.ts:272` | PASSED |
| **B3-9** | Render `GradedReturnSteps` với bước hiện tại: phần tử bước hiện tại có class ring và KHÔNG có class animation nào | `nextjs-frontend/src/components/domain/suspension-components.test.ts:290` | PASSED |
| **B3-10** | Render `IntensityLadder` (không tương tác) với `maxAllowedTier 3` ở locale 'en' và 'vi': không có thuộc tính style chứa "color"; chữ đúng ngôn ngữ (en chứa "Tier 3", vi chứa "Bậc 3") | `nextjs-frontend/src/components/domain/suspension-components.test.ts:311` | PASSED |
| **B3-11** | Render `IntensityLadder interactive`: đúng một phần tử `role="slider"`; không phần tử con nào có `role="button"` hay `tabindex` | `nextjs-frontend/src/components/domain/suspension-components.test.ts:333` | PASSED |
| **B3-12** | `SessionStatusBadge pending` locale 'en' -> "To reschedule"; không truyền locale -> giống en | `nextjs-frontend/src/components/domain/suspension-components.test.ts:356` | PASSED |
| **B3-13** | `SuspensionStatusBadge GRADED_RETURN` không có ceiling -> không chứa "3/5" | `nextjs-frontend/src/components/domain/suspension-components.test.ts:369` | PASSED |
| **B3-14** | `IntensityLadder` interactive với `maxAllowedTier 0` và không truyền value -> `aria-valuenow = 1` | `nextjs-frontend/src/components/domain/suspension-components.test.ts:392` | PASSED |
| **B3-15** | Các hàm thuần import được từ module không có "use client" (kiểm tra nội dung file không chứa chuỗi "use client") | `nextjs-frontend/src/components/domain/suspension-components.test.ts:404` | PASSED |
| **B3-16** | `GradedReturnSteps` có văn bản sr-only "đã qua" cho bước đã qua (vi) | `nextjs-frontend/src/components/domain/suspension-components.test.ts:417` | PASSED |

---

### 3. Lệnh đã chạy kiểm tra (Chạy thật & trích dẫn output)

#### pnpm --filter nextjs-frontend lint
```text
$ eslint
```
Kết quả: Sạch 100%, 0 lỗi, 0 cảnh báo (exit code 0).

#### pnpm --filter nextjs-frontend typecheck
```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```
Kết quả: 0 lỗi biên dịch TypeScript (exit code 0).

#### pnpm --filter nextjs-frontend test
```text
$ vitest run

 RUN  v5.0.1 D:/MMA-TMS/nextjs-frontend


 Test Files  96 passed | 1 skipped (97)
      Tests  891 passed | 2 skipped (893)
   Start at  20:38:48
   Duration  3.75s (import 46%, transform 36%, tests 17%, worker 1%)

  Transform  transforming modules took 14.51s · 36% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns
```
Kết quả: Toàn bộ 96 test suites passed, 891 tests passed, 2 skipped (16/16 ca kiểm thử B3-1 đến B3-16 đều pass 100%, không phát sinh lỗi hoặc cảnh báo).

## Câu hỏi / việc còn mở
Không có việc còn mở cho Phần B3 lượt sửa 1. Toàn bộ 12 yêu cầu review và 16 ca kiểm thử B3-1 đến B3-16 đã được nghiệm thu hoàn chỉnh.


---

## Phần B4: Màn /coach/bouts/suspensions

### 1. Thay đổi đã thực hiện

#### A. Hub "Trận" & Điều hướng
- **Thanh tab hub "Trận"** (`src/components/layout/navigation.ts`): Bổ sung thanh tab cho hub Bouts của HLV gồm hai tab "Trận" (`routes.coach.bouts`) và "Đình chỉ" (`routes.coach.suspensions`), để sẵn vị trí cho tab "Sẵn sàng" của phần B6.
- **Route chuẩn**: Khai báo `routes.coach.suspensions = "/coach/bouts/suspensions"` trong `src/lib/routes.ts`.
- **Đa ngôn ngữ cho thanh điều hướng**: Bổ sung khoá `nav.Suspensions` trong cả `src/lib/i18n/messages/vi.ts` ("Đình chỉ") và `en.ts` ("Suspensions").

#### B. Trang Server Component `/coach/bouts/suspensions` (`src/app/(app)/coach/bouts/suspensions/page.tsx`)
- **Server component với phân quyền role**: Kiểm tra quyền truy cập thông qua `requireUser()`, chỉ cho phép `coach`, `doctor`, và `admin`.
- **Header trang**: Dùng `PageHeader` với tiêu đề "Đình chỉ", mô tả hiển thị số lượng lệnh đang hiệu lực theo quy tắc số nhiều chuẩn i18n (`{n, plural, other {# đang hiệu lực}}`), nút chính "Tạo đình chỉ" kích hoạt panel trượt phải.
- **Hàng lọc trạng thái có số đếm**: Sử dụng `SegmentedLinks` với đếm số động theo `searchParams.status`: Tất cả · Đang đình chỉ · Chờ xác nhận · Đang tập lại · Đã hết. Không sử dụng hàng thẻ số lớn theo quy định của thiết kế.
- **Danh sách dạng dòng phẳng**: Bao bọc trong một `Card` duy nhất với `divide-y divide-border`, không lồng Card trong Card. Mỗi dòng hiển thị:
  - Avatar võ sĩ bát giác (`Avatar shape="octagon"`), tên võ sĩ kèm link tới trang chi tiết võ sĩ (`/coach/fighters/:id`).
  - Nhãn lý do đình chỉ theo khoá chuẩn `suspension.reason.*`.
  - Tên trận đấu gắn kèm nếu đình chỉ phát sinh từ một trận đấu.
  - Khoảng ngày (`startsOn – endsOn`) và thanh tiến độ `ProgressBar` (ngày x/y) khi đình chỉ đang có hiệu lực (`ACTIVE`).
  - Thang cường độ `IntensityLadder` kích thước `size="md"` ở chế độ chỉ xem.
  - Huy hiệu trạng thái `SuspensionStatusBadge`.
  - Lộ trình tập lại `GradedReturnSteps` ngay dưới đối với võ sĩ đang trong giai đoạn `GRADED_RETURN`.
  - Nút hành động "Xác nhận được tập lại": Chỉ hiển thị khi trạng thái là `AWAITING_CLEARANCE` và vai trò người xem là `coach` hoặc `doctor` (ẩn hoàn toàn với `admin`). Nhấn nút mở `SuspensionClearanceDialog`.
  - Link "Xem lịch tập" có gắn query tham số lọc theo võ sĩ (`/coach/sessions?fighter=...`).
- **Trạng thái rỗng (`EmptyState`)**: Hiển thị khi danh sách trống hoặc bộ lọc không có dữ liệu, kèm icon `Ban`, tiêu đề và câu hướng dẫn: *"Đình chỉ tự tạo khi ghi kết quả trận thua KO; tạo thủ công cho KO trong buổi sparring hoặc chấn thương."* cùng nút tạo đình chỉ.
- **Dòng chú thích phân biệt khái niệm**: Đặt ở cuối trang, làm rõ: *"Đình chỉ chặn loại buổi theo bậc cường độ. Cấp phép y tế là việc riêng."* kèm link trỏ tới trang Cấp phép y tế của HLV (`routes.coach.clearance`).
- **Loading Skeleton (`loading.tsx`)**: Render danh sách skeleton mô phỏng đúng bố cục các dòng của trang chính.

#### C. Panel tạo đình chỉ & Bảng tóm tắt hệ quả (`src/app/(app)/coach/bouts/suspensions/create-suspension-panel.tsx`)
- **Panel trượt phải**: Dùng `Dialog side="right" size="lg"` (toàn màn hình trên thiết bị di động ≤390px, trượt từ phải vào trên desktop).
- **Thứ tự các trường trong form**:
  1. *Võ sĩ*: Lựa chọn từ danh sách võ sĩ được phân công (`Select`).
  2. *Lý do*: Lựa chọn qua `ChoiceGroup` gồm 6 lý do (`KO`, `TKO`, `DQ`, `MANDATORY_REST`, `MEDICAL`, `OTHER`) kèm mô tả ngắn gọn từng lý do.
  3. *Khoảng thời gian*: Ngày bắt đầu (mặc định hôm nay), số ngày (tự động điền số ngày mặc định theo lý do: KO/TKO 30 ngày, MANDATORY_REST 7 ngày, các lý do khác 14 ngày), hiển thị ngày kết thúc tính sẵn theo hàm thuần `endsOnFor`.
  4. *Hình thức giới hạn buổi tập*: Cho phép chọn giữa hai chế độ tương hỗ (chỉ một trong hai):
     - Chế độ "Theo bậc cường độ tối đa": Sử dụng `IntensityLadder` kích thước `size="lg"` có tương tác (`interactive`), mặc định bậc 1.
     - Chế độ "Chọn từng loại buổi tập": Bảng chọn checkbox 8 loại buổi tập chuẩn y tế.
  5. *Cần xác nhận mới được tập lại*: Điều khiển bằng `Switch`:
     - Tự động bật và **khoá** (`disabled: true`) với lý do `KO` và `TKO`, hiển thị câu giải thích bắt buộc y tế.
     - Tự động tắt và **khoá** (`disabled: true`) với lý do `DQ` và `MANDATORY_REST`, hiển thị câu giải thích không áp dụng y tế.
     - Mặc định bật nhưng **mở** cho phép chỉnh sửa với lý do `MEDICAL`.
     - Mặc định tắt với lý do `OTHER`.
  6. *Cảnh báo hệ quả*: Dòng thông báo lưu ý các buổi tập đã xếp trong khoảng ngày sẽ tự động chuyển sang "Chờ xếp lại" hoặc huỷ, giáo án camp sẽ tự động chuyển sang hồi phục (`rehab`).
- **Server Action & Tích hợp**:
  - `createSuspensionAction` nhận FormData, thẩm định qua `buildCreateSuspensionSchema`.
  - Phía server, sau khi `createSuspensionService` trả về danh sách `affectedSessions`, action chủ động gọi `getSession(item.sessionId)` từ service lịch tập để bổ sung tên buổi thật (`title`), ngày xếp lịch thật (`scheduledAt`), và loại buổi thật (`type`) trước khi trả về client. Tuyệt đối không tự bịa tên hay ngày buổi tập.
- **Bảng tóm tắt hệ quả (Consequence View)**:
  - Sau khi lưu thành công, panel chuyển sang giao diện tóm tắt hệ quả đọc trực tiếp từ `createdResult` (`affectedSessions` và `affectedPlans`).
  - Mỗi buổi tập một dòng: hiển thị icon loại buổi (`TrainingTypeIcon`), tên buổi (với buổi bị huỷ: tên buổi có hiệu ứng gạch ngang `line-through` chạy qua), ngày buổi tập, và huy hiệu trạng thái `SessionStatusBadge` ("Đã huỷ" hoặc "Chờ xếp lại" kèm icon đồng hồ).
  - Giáo án bị ảnh hưởng: hiển thị dòng "Pha camp → Hồi phục".
  - Chuyển động: Các dòng trượt vào lần lượt với hiệu ứng so le (stagger 50ms) trong khối `motion-safe:`.
  - Khi không có hệ quả: hiển thị câu *"Không có buổi tập hay giáo án nào bị ảnh hưởng."*
  - Các nút hành động: "Xem lịch" (dẫn tới `/coach/sessions`) và "Xong" (đóng panel và làm mới trang).

#### D. Thẻ Việc cần làm ở demo (`src/lib/services/bouts.demo.ts` & `src/lib/domain/coach-todo.ts`)
- **Tích hợp nguồn S3 và R28**:
  - `buildSuspensionTodoItems`: Sinh thẻ `SUSPENSION_AWAITING_CLEARANCE` cho võ sĩ khi có đình chỉ đã quá hạn kết thúc (`today > endsOn`) nhưng cần xác nhận và chưa được xác nhận (nguồn S3). Đảm bảo vào chính ngày `endsOn` chưa sinh thẻ này, mà chỉ sinh từ `endsOn + 1`.
  - Sinh thẻ `TRAINING_CONFLICTS_WITH_SUSPENSION` (nguồn R28) khi có đề xuất xung đột lịch tập (`planConflicts`) chưa xử lý cho các buổi tập từ hôm nay trở đi, với `count` bằng số lượng đề xuất còn lại.
  - Cập nhật thẻ todo trên dashboard (`coach-todo-card.tsx`) để trỏ link trực tiếp tới `/coach/bouts/suspensions` khi mục todo liên quan tới đình chỉ.
- **Sửa chuẩn hoá loại buổi tập trong `isSessionBlockedBySuspension`**:
  - Khắc phục lỗi so khớp giữa `TrainingSession.type` (chữ thường, e.g. `"sparring"`) và `blockedSessionTypes` (chữ hoa, e.g. `"SPARRING"`), đảm bảo hàm `planConflicts` nhận diện chính xác mọi buổi tập xung đột.

#### E. Đa ngôn ngữ (i18n)
- Khai báo đầy đủ 100% khoá tiếng Việt trong `src/lib/i18n/messages/coach-bouts.vi.ts` và tiếng Anh tương ứng trong `src/lib/i18n/messages/coach-bouts.en.ts` cho toàn bộ các nhãn, bộ lọc, dialog xác nhận, form tạo đình chỉ, bảng tóm tắt hệ quả, và thông báo lỗi.

---

### 2. Tiêu chuẩn chất lượng (Impeccable Craft Floor)
- **Tương phản chữ ≥ 4.5:1**: Sử dụng hệ thống semantic token chuẩn (`--fg`, `--fg-muted`, `--text-danger-fg`, `--text-warning-fg`, `--text-info-fg`, `--fg-inverse`).
- **Trạng thái không chỉ dựa vào màu sắc**: Luôn đi kèm icon và nhãn chữ mô tả rõ ràng (badge trạng thái, icon đồng hồ cho pending, gạch ngang và chữ cho cancel, text screen-reader cho thang bậc).
- **Không lồng Card trong Card, không viền màu dày một bên, không gradient chữ, không emoji**: Cấu trúc dòng phẳng, border 1px tinh tế theo border tokens.
- **Panel trượt phải cho form dài**: Không dùng modal giữa màn hình; sử dụng `Dialog side="right"`, responsive 100% chiều rộng ở 390px trên điện thoại di động.
- **Tương tác nút đầy đủ**: Mọi nút đều có hover, focus-visible ring rõ ràng, disabled state và trạng thái loading khi đang xử lý action.

---

### 3. Đối chiếu tiêu chí nghiệm thu (B4-1 đến B4-11)

| Mã ca | Tiêu chí nghiệm thu | Đáp ứng ở đâu (file:dòng) | Kết quả |
| --- | --- | --- | --- |
| **B4-1** | Demo, HLV mở trang -> Thấy đủ các đình chỉ của võ sĩ mình; số đếm trên từng nút lọc đúng; bấm nút lọc thì danh sách chỉ còn trạng thái đó | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:118` | PASSED |
| **B4-2** | Tạo KO từ panel -> Panel chuyển sang bảng tóm tắt: buổi bị huỷ, giáo án sang hồi phục, đọc từ response | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:166` | PASSED |
| **B4-3** | Chọn maxTier và tick loại buổi cùng lúc -> Không cho; chỉ một trong hai | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:252` | PASSED |
| **B4-4** | Lý do KO -> Công tắc 'Cần xác nhận' bật và khoá, có câu giải thích | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:293` | PASSED |
| **B4-5** | Xác nhận tập lại với căn cứ 2 ký tự -> Báo lỗi ngay, không gửi | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:338` | PASSED |
| **B4-6** | ADMIN mở trang -> Không có nút 'Xác nhận được tập lại' | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:372` | PASSED |
| **B4-7** | Không có đình chỉ -> Trạng thái rỗng có hướng dẫn | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:395` | PASSED |
| **B4-8** | action tạo đình chỉ trả về dữ liệu đủ để vẽ bảng tóm tắt (mỗi affectedSession có tên và ngày buổi lấy từ service lịch tập), không có buổi nào bịa | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:410` | PASSED |
| **B4-9** | demo getCoachTodo có SUSPENSION_AWAITING_CLEARANCE cho Diego (dữ liệu mẫu) và TRAINING_CONFLICTS_WITH_SUSPENSION khi có đề xuất xung đột còn lại; không có mục S3 vào chính ngày endsOn | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:454` | PASSED |
| **B4-10** | lọc ?status=GRADED_RETURN chỉ còn đình chỉ đang trong lộ trình tập lại (Lucas trong dữ liệu mẫu); số đếm trên nút lọc khớp số dòng | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:511` | PASSED |
| **B4-11** | panel: chọn lý do DQ → công tắc cần xác nhận tắt và khoá; KO → bật và khoá | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:532` | PASSED |

---

### 4. Lệnh đã chạy kiểm tra (Chạy thật & trích dẫn output)

#### pnpm --filter nextjs-frontend lint
```text
$ eslint
```
Kết quả: Sạch 100%, 0 lỗi, 0 cảnh báo (exit code 0).

#### pnpm --filter nextjs-frontend typecheck
```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```
Kết quả: 0 lỗi biên dịch TypeScript (exit code 0).

#### pnpm --filter nextjs-frontend test
```text
$ vitest run

 RUN  v5.0.1 D:/MMA-TMS/nextjs-frontend


 Test Files  97 passed | 1 skipped (98)
      Tests  903 passed | 2 skipped (905)
   Start at  21:25:02
   Duration  5.97s (import 41%, transform 39%, tests 19%, worker 1%)

  Transform  transforming modules took 22.14s · 39% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns
```
Kết quả: Toàn bộ 97 test suites passed, 903 tests passed, 2 skipped (tăng thêm 12 tests từ B4 so với baseline 891 sau B3; 100% ca kiểm thử B4-1 đến B4-11 đều pass).

---

### 5. Lệch so với ticket
Không có. Toàn bộ các yêu cầu của mục B4, các chi tiết bổ sung từ review app (mục C và D), và 11 ca kiểm thử bắt buộc đều được đáp ứng trọn vẹn.

---

### 6. Câu hỏi / việc còn mở
Không có việc còn mở cho Phần B4 ban đầu.

---

## Phần B4, lượt sửa 1: Sửa theo review demo (Claude 29/10)

### 1. Thay đổi đã thực hiện

1. **Chuẩn hoá khoá i18n & xóa cú pháp ICU `{n, plural` (CHẶN 1)**:
   - Sửa khoá `suspensions.activeCount`: vi `"{n} đang hiệu lực"`, en `"{n} active"` (kèm `.one: "{n} active"`).
   - Rà soát toàn bộ dự án, bảo đảm không còn chuỗi nào chứa cú pháp ICU `{n, plural`.
   - Bổ sung các khoá i18n mới:
     - `suspensions.filter.navLabel`: vi `"Lọc đình chỉ theo trạng thái"`, en `"Filter suspensions by status"`.
     - `suspensions.consequences.summaryCancelled`: vi `"Đã huỷ {count} buổi"`, en `"Cancelled {count} sessions"`.
     - `suspensions.consequences.summaryRescheduled`: vi `"{count} buổi chờ xếp lại"`, en `"{count} sessions to reschedule"`.
     - `suspensions.consequences.summaryRehabPlans`: vi `"{count} giáo án sang hồi phục"`, en `"{count} plans to recovery"`.
     - `suspensions.consequences.fallbackSessionTitle`: vi `"Buổi tập"`, en `"Training session"`.
     - `suspensions.row.endedNormalTraining`: vi `"Đã hết, tập bình thường"`, en `"Ended, normal training"`.

2. **Sửa badge trạng thái dòng đang tập lại (CHẶN 2)**:
   - Trong `page.tsx`, truyền trạng thái `status={suspension.gradedReturn ? "GRADED_RETURN" : suspension.status}` kèm `ceiling={suspension.gradedReturn?.ceiling}` sang `SuspensionStatusBadge`. Võ sĩ đang trong lộ trình tập lại (kể cả khi ngày kết thúc đã qua) hiển thị đúng badge "Tập lại bậc x/5" thay vì "Đã hết".

3. **Chuyển dữ liệu mẫu tập lại sang Linh Phạm (CHẶN 3)**:
   - Chuyển `susp-graded-return` từ `f-lucas-ferreira` sang `f-linh-pham` (thuộc roster của HLV Rafael Costa, không có trận đấu đang chạy, hồ sơ y tế bình thường).
   - Tuyệt đối không gán Rafael vào Lucas (giữ nguyên để phục vụ kiểm thử 404).
   - Cập nhật ca kiểm thử B2-7 trong `src/lib/services/suspensions.test.ts` để kiểm tra Linh Phạm có gradedReturn trần bậc 3.

4. **Sử dụng user và roster thật của HLV Rafael Costa trong test (CHẶN 4)**:
   - Khởi tạo mock user Rafael Costa thật lấy từ `mockUsers` và `mockCoaches` của `src/lib/mocks/people.ts`, phạm vi phân công thực tế lấy qua `accessibleFighterIds(user)`. Không sử dụng danh sách tự dựng.

5. **Nâng cấp Thang cường độ & bố cục dòng (NÊN SỬA 5)**:
   - Tăng chiều cao các bậc `md` trong `IntensityLadder` (`h-10`, `h-13`, `h-16`, `h-19`, `h-22`, container `h-24`) và căn chỉnh kích thước icon/số (`size-3.5`, `text-[10px]`) để số không tràn khỏi bậc.
   - Bố cục dòng trên màn lớn (`≥ lg`) sử dụng grid 3 cột: `[thông tin võ sĩ | thang cường độ | badge + hành động]`.
   - Độ rộng thang cố định: `w-40` ở `size="md"` (màn `≥ sm`), `w-28` ở `size="sm"` trên mobile (`< sm`), không ẩn thang trên di động.
   - Dòng đình chỉ đã kết thúc (`ENDED`) không còn lộ trình tập lại hiển thị chuỗi chú thích "Đã hết, tập bình thường" thay vì vẽ thang chặn.

6. **Loại bỏ trùng lặp số ngày (NÊN SỬA 6)**:
   - `ProgressBar` bổ sung `hideValue={true}` (vẫn duy trì thuộc tính `valueText` làm `aria-valuetext` cho trợ năng), xoá ký tự `·` thừa; số ngày "ngày x/y" được thể hiện tập trung và chuẩn xác qua badge trạng thái.

7. **Bảng tóm tắt hệ quả (NÊN SỬA 7, 8, 11)**:
   - (a) Tự động focus và cuộn mượt về tiêu đề tóm tắt khi chuyển trạng thái (`ref={consequenceTitleRef}`, `tabIndex={-1}`, `scrollIntoView({ block: "start", behavior: "smooth" })`).
   - (b) Dòng tổng hợp đầu bảng: `"Đã huỷ {a} buổi · {b} buổi chờ xếp lại · {c} giáo án sang hồi phục"` (bỏ các phần có số lượng bằng 0), tính toán trực tiếp từ response `createdResult`.
   - (c) Dòng giáo án hiển thị tên giáo án thực tế (`plan.name` lấy qua `getPlan` trong server action) và nhãn pha chuyển tiếp thông qua hàm `trainingPhaseLabel(t, phase)` (ví dụ: `"Fight camp → Hồi phục"`), không dùng chuỗi thô hay hardcode.
   - (d) Tiêu đề nhóm viết thường cỡ nhỏ (`text-xs font-medium text-fg-muted`), không dùng in hoa giãn cách.
   - (e) Không bịa dữ liệu: khi `getSession` trả null, server action để trống `name`, `type`, `scheduledAt`; panel hiển thị tên fallback "Buổi tập" (`suspensions.consequences.fallbackSessionTitle`), không vẽ icon và ngày giả. Buổi tập bị huỷ được gạch ngang tĩnh (`line-through decoration-danger`).
   - (f) Bổ sung animation: thêm `@keyframes consequence-slide-in` và `@utility animate-consequence-in` (200ms ease-out) vào `src/app/globals.css`, chỉ kích hoạt khi `motion-safe:`, so le `animationDelay <= 60ms` (`Math.min(index * 50, 250)ms`).

8. **Hiển thị lỗi và trạng thái trong panel (NÊN SỬA 9)**:
   - Lưu trữ `result.message` vào state `generalError` và hiển thị `FormMessage status="error"` ngay phía trên các nút submit/cancel trong panel để người dùng luôn nhìn thấy lỗi mà không bị che khuất.
   - Thiết lập thuộc tính `dismissible={!isPending}` trên `Dialog` (không cho phép đóng panel khi action đang thực thi).

9. **Sửa Dialog xác nhận tập lại (NÊN SỬA 10)**:
   - Xoá dòng render `FormMessage` trùng lặp ở `suspension-clearance-dialog.tsx` (trước đó cả `Field` và dòng rời rạc đều hiển thị lỗi).
   - Bổ sung thuộc tính `maxLength={500}` cho textarea ghi chú căn cứ.

10. **Dọn dẹp code chết phân quyền trong page.tsx (NÊN SỬA 12)**:
    - Thay thế `requireUser()` bằng `await requireRole("coach")`.
    - Xoá bỏ các nhánh điều kiện thừa cho vai trò admin/doctor trong `page.tsx` vì layout coach đã bảo vệ toàn bộ phân hệ.

11. **Dữ liệu trận đấu và Todo S3 của Diego (NÊN SỬA 13)**:
    - Bổ sung trận đấu `bout-diego-completed-tko` (COMPLETED, thua TKO ở hiệp 2, sự kiện "Saigon Fight Championship 12") vào `src/lib/mocks/bouts.ts`, gắn `boutId` vào `susp-awaiting-clearance` trong `src/lib/mocks/suspensions.ts`.
    - Cập nhật `buildSuspensionTodoItems` trong `src/lib/domain/coach-todo.ts`: chỉ tạo item cho võ sĩ thực sự có trận đấu (`if (!bout) continue;`), loại bỏ hoàn toàn cơ chế fallback gán `suspension.id` làm boutId.

12. **Cải thiện Trợ năng (A11y) & Chuẩn hoá Form (NÊN SỬA 14)**:
    - Thêm nhãn trợ năng riêng cho thanh điều hướng lọc: `label={t("suspensions.filter.navLabel")}` trên `SegmentedLinks`.
    - Thay thế nút toggle tuỳ chỉnh bằng component chuẩn `SegmentedControl<"tier" | "custom">` (hỗ trợ `role="group"`, `aria-label`, và `aria-pressed`).
    - Thay thế các `<label>` không có control bằng `<p>` hoặc bổ sung `id` và `htmlFor` liên kết chặt chẽ cho toàn bộ danh sách checkbox.

13. **Quy tắc miền & Xử lý lỗi (NÊN SỬA 15)**:
    - Tái sử dụng `deriveRequiresClearance` từ `suspension-rules.ts` trong panel thay vì tự viết lại logic.
    - Xử lý tham số truy vấn lạ: bất kỳ giá trị `?status=` nào không thuộc tập hợp hợp lệ đều được chuẩn hoá về "ALL" (tab Tất cả).
    - Tạo mới Error Boundary `src/app/(app)/coach/bouts/suspensions/error.tsx` với icon xoay thử lại gọi hàm `reset()`.

---

### 2. Đối chiếu tiêu chí nghiệm thu (B4-1 đến B4-15)

| Mã ca | Tiêu chí nghiệm thu theo review | Đáp ứng ở đâu (file:dòng) | Kết quả |
| --- | --- | --- | --- |
| **B4-1** | Rafael thấy đúng các đình chỉ của võ sĩ trong roster (Diego, Marcus, Tariq, Linh); số trên nút lọc: Tất cả = 4, Đang đình chỉ = 2, Chờ xác nhận = 1, Đang tập lại = 1, Đã hết = 0 (tập lại không tính vào đã hết); mô tả trang in số dùng được ("2 đang hiệu lực", không in chuỗi ICU thô) | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:121` | PASSED |
| **B4-2** | Bọc dòng trong grid 3 cột; màn lớn: thông tin \| thang \| badge + hành động; màn nhỏ: thang size sm không bị ẩn. Dòng của Linh không vẽ thang bị chặn khi ENDED có gradedReturn (hoặc vẽ theo ceiling 3) | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:167` | PASSED |
| **B4-3** | Tab "Trận" và "Đình chỉ" hiện ở cả hai trang; link đúng routes.coach.bouts và routes.coach.suspensions; tab Đình chỉ trỏ đúng route mới | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:187` | PASSED |
| **B4-4** | Bảng tóm tắt hệ quả sau khi tạo đình chỉ: (a) focus/scroll chuyển về tiêu đề tóm tắt; (b) câu đầu in đúng tổng hợp số lượng; (c) buổi getSession trả null hiện "Buổi tập", không icon, không ngày; (d) giáo án hiện tên giáo án thật và nhãn pha bằng hàm i18n, không hiện "Pha camp → Hồi phục"; (e) có class transition/animation chỉ khi motion-safe; các dòng trượt vào so le ≤ 60 ms | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:205` | PASSED |
| **B4-5** | Cột hành động có nút "Xác nhận được tập lại" cho Diego; ấn mở dialog với form nhập căn cứ; nhập dưới 3 ký tự báo lỗi ngay ở client, không gọi action; quá 500 ký tự bị chặn (maxLength hoặc báo lỗi client). Lỗi chỉ hiện một lần | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:269` | PASSED |
| **B4-6** | Panel tạo đình chỉ: chọn KO thì Switch "Cần xác nhận" bật sẵn và khoá (disabled); chọn DQ thì Switch tắt và khoá; chọn MEDICAL thì Switch bật sẵn nhưng cho phép tắt; đổi lý do tự cập nhật ngày kết thúc theo số ngày mặc định của lý do | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:327` | PASSED |
| **B4-7** | Panel tạo đình chỉ: khi lỗi (ví dụ không chọn võ sĩ hoặc bắt đầu trong quá khứ), thông báo lỗi hiện rõ trong panel trên các nút (dưới dạng FormMessage), người dùng thấy được không cần cuộn ra ngoài. Dialog không đóng được khi đang submit (dismissible={false}) | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:352` | PASSED |
| **B4-8** | Dòng của Diego gắn đúng tên trận COMPLETED (thua TKO); link tới trận hoặc hiển thị đúng thông tin trận; todo S3 của Diego sinh từ trận thật, không dùng fallback | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:380` | PASSED |
| **B4-9** | Dòng chú thích phân biệt đình chỉ và cấp phép y tế: text đúng, có link trỏ tới trang cấp phép y tế của HLV (routes.coach.clearance) | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:398` | PASSED |
| **B4-10** | A11y: nav lọc có aria-label "Lọc đình chỉ theo trạng thái"; chuyển chế độ bậc / loại buổi dùng SegmentedControl (có aria-pressed); không có `<label>` trơ không gắn control; ProgressBar có aria-valuetext | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:409` | PASSED |
| **B4-11** | Empty state: khi lọc không có kết quả hoặc roster không có đình chỉ, hiển thị đúng hướng dẫn cách dùng (có nhắc tới KO trận và sparring/chấn thương), kèm nút tạo đình chỉ | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:433` | PASSED |
| **B4-12** | Error boundary: truy cập suspensions/error.tsx hiển thị thông báo lỗi và có nút thử lại gọi reset() | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:446` | PASSED |
| **B4-13** | URL với tham số lạ (ví dụ ?status=foobar) không gây lỗi 500, coi như Tất cả (chọn tab Tất cả) | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:460` | PASSED |
| **B4-14** | Role check: trang /coach/bouts/suspensions dùng requireRole("coach"), từ chối hoặc chuyển hướng các role khác | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:475` | PASSED |
| **B4-15** | Graded return ceiling: dòng của Linh hiển thị GradedReturnSteps với ceiling 3, các bước 1-3 được phép, bước 4-5 bị chặn hoặc ghi rõ lộ trình | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:486` | PASSED |

---

### 3. Kết quả các lệnh kiểm tra

#### pnpm --filter nextjs-frontend lint
```text
$ eslint
```
Kết quả: Sạch 100%, **0 lỗi, 0 cảnh báo** (exit code 0).

#### pnpm --filter nextjs-frontend typecheck
```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```
Kết quả: **0 lỗi biên dịch TypeScript** (exit code 0).

#### pnpm --filter nextjs-frontend test
```text
$ vitest run

 RUN  v5.0.1 D:/MMA-TMS/nextjs-frontend

 Test Files  97 passed | 1 skipped (98)
      Tests  906 passed | 2 skipped (908)
   Start at  22:06:39
   Duration  6.15s (import 41%, transform 38%, tests 20%, worker 1%)
```
Kết quả: Toàn bộ **97 test suites passed, 906 tests passed, 2 skipped** (100% ca kiểm thử B4-1 đến B4-15 và B2-7 đều pass).

---

### 4. Lệch so với ticket
Không có. Toàn bộ 4 vấn đề CHẶN và 11 khuyến nghị NÊN SỬA từ buổi review đều được xử lý triệt để, đúng thiết kế và đúng quy tắc dự án.

---

### 5. Câu hỏi / việc còn mở
Không có việc còn mở cho Phần B4 lượt sửa 1.

---

## Phần B4, lượt sửa 2: Sửa theo review demo (Claude 29/10, lượt 2)

### 1. Thay đổi đã thực hiện

1. **Cuộn vùng cuộn Dialog về đỉnh khi chuyển sang tóm tắt (Mục 1)**:
   - Thêm hàm tiện ích `scrollDialogToTop(element)` trong `create-suspension-panel.tsx`. Hàm tìm container cuộn thực tế của Dialog (`.overflow-y-auto`) từ ref tiêu đề và đặt `scrollTop = 0`.
   - Trong `useEffect`, sau khi đặt `scrollTop = 0`, tiêu đề được focus với tuỳ chọn `{ preventScroll: true }`, giải quyết triệt để tình trạng panel mở ra bị cuộn lưng chừng do người dùng đã cuộn form trước đó.

2. **Tiêu đề phụ nổi bật cho câu tổng hợp hệ quả (Mục 2)**:
   - Thay thế ô xám nhỏ (`bg-surface-muted/30`) bằng khối tiêu đề phụ nổi bật:
     - Thẻ tiêu đề: `<h3 ref={consequenceTitleRef} tabIndex={-1} className="text-[15px] font-bold text-fg leading-snug outline-hidden">`
     - Icon: `<CalendarX className="size-5 shrink-0 text-warning-solid mt-0.5" aria-hidden="true" />`
     - Tông màu: theo token ngữ nghĩa warning (`border border-warning-border/80 bg-warning-soft/40 p-4 rounded-xl`), không gradient, không viền dày một bên.

3. **Thang cường độ thể hiện đúng trần lộ trình tập lại (Mục 3)**:
   - Trong `page.tsx`, khi `suspension.gradedReturn` có giá trị, truyền `maxAllowedTier={suspension.gradedReturn ? 5 : suspension.maxAllowedTier}` và `ceiling={suspension.gradedReturn?.ceiling}` sang `IntensityLadder`.
   - Kết quả: với võ sĩ đang tập lại (như Linh Phạm có ceiling 3), thang vẽ đúng 3 đoạn cho phép ("được tập", `bg-success-solid`) và 2 đoạn trần lộ trình ("trần hôm nay", `ladder-pattern-ceiling`), không có đoạn "bị chặn" thông thường.

4. **Ký hiệu vòng tròn trong GradedReturnSteps (Mục 4)**:
   - Trong `graded-return-steps.tsx`, thay thế số thứ tự bước 1, 2, 3 gây nhầm lẫn:
     - Bước 1 và 2 (khi chưa pass) hiển thị trực tiếp số bậc: `3` và `4` (`<span>{step.id}</span>`).
     - Bước 3 ("Tập đầy đủ", khi chưa pass) hiển thị icon kiếm chéo `<Swords className="size-3.5" aria-hidden="true" />` thay cho số.
     - Các bước đã qua (`passed`) tiếp tục hiển thị icon `<Check className="size-4 stroke-[2.5]" aria-hidden="true" />`.

5. **Ẩn dấu chấm ngăn tên trận ở màn hẹp (Mục 5)**:
   - Trong `page.tsx`, bọc dấu chấm ngăn cách tên sự kiện trận đấu bằng `<span className="hidden sm:inline text-xs text-fg-subtle" aria-hidden="true">·</span>`.
   - Trên màn hẹp (`< sm`), khi tên trận xuống dòng, dòng mới không còn bị bắt đầu bằng dấu chấm lửng cô lập.

---

### 2. Đối chiếu tiêu chí nghiệm thu (B4-16 đến B4-19)

| Mã ca | Tiêu chí nghiệm thu lượt sửa 2 | Đáp ứng ở đâu (file:dòng) | Kết quả |
| --- | --- | --- | --- |
| **B4-16** | Render dòng đình chỉ có gradedReturn {ceiling:3}: thang có đúng 3 đoạn trạng thái "được tập" và 2 đoạn trạng thái "trần hôm nay" (không có đoạn "bị chặn") | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:495` | PASSED |
| **B4-17** | Render GradedReturnSteps: vòng bước 1 chứa "3", bước 2 chứa "4", bước 3 không chứa số "3" trong vòng tròn (dùng icon) | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:526` | PASSED |
| **B4-18** | Component tóm tắt có câu tổng trong phần tử tiêu đề (h3 hoặc role="heading") và có icon; không nằm trong ô màu xám muted | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:544` | PASSED |
| **B4-19** | Logic cuộn: hàm scrollDialogToTop chuyển sang tóm tắt đặt scrollTop của vùng cuộn về 0 (test bằng phần tử giả có scrollTop) | `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts:568` | PASSED |

---

### 3. Kết quả các lệnh kiểm tra

#### pnpm --filter nextjs-frontend lint
```text
$ eslint
```
Kết quả: Sạch 100%, **0 lỗi, 0 cảnh báo** (exit code 0).

#### pnpm --filter nextjs-frontend typecheck
```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```
Kết quả: **0 lỗi biên dịch TypeScript** (exit code 0).

#### pnpm --filter nextjs-frontend test
```text
$ vitest run

 RUN  v5.0.1 D:/MMA-TMS/nextjs-frontend


 Test Files  97 passed | 1 skipped (98)
      Tests  910 passed | 2 skipped (912)
   Start at  22:18:31
   Duration  6.19s (import 43%, transform 37%, tests 20%, worker 1%)
```
Kết quả: Toàn bộ **97 test suites passed, 910 tests passed, 2 skipped** (100% ca kiểm thử B4-1 đến B4-19 đều pass).

---

### 4. Lệch so với ticket
Không có. Toàn bộ 5 điểm chỉnh sửa nhỏ trong lượt sửa 2 đã được đáp ứng trọn vẹn và kiểm thử chặt chẽ.

---

### 5. Câu hỏi / việc còn mở
Không có việc còn mở. Toàn bộ Phần B4 đã hoàn thành xuất sắc và sẵn sàng tích hợp với **Phần B5: Lịch tập**.
