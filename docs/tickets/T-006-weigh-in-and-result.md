# T-006 · Tuần thi đấu, cân chính thức, ghi kết quả (backend, phần A)

| | |
| --- | --- |
| **Trạng thái** | READY |
| **Phần** | A: Backend (`nestjs-api`). Phần B (màn HLV) và C (màn cân chính thức trên điện thoại) có ticket riêng, dùng contract của ticket này |
| **Người nhận** | Dan (thực hiện qua Gemini theo [TEAM-WORKFLOW §3a](../TEAM-WORKFLOW.md#3a-cách-giao-việc)) |
| **Nhánh** | `feat/T-006-weigh-in-and-result` từ `fight-camp` mới nhất (đã có T-003) |
| **Ước lượng** | 1,5–2 ngày |
| **Hạn** | Merge trước 25/10 |
| **Tài liệu dẫn chiếu** | [Luồng nghiệp vụ F5, F6, nghiệp vụ 7, 8, 10, R17–R19, R25–R26, H2–H6](../FIGHT-CAMP-BUSINESS-FLOWS.md), [Tech spec §2.3, §4, §5](../FIGHT-CAMP-TECH-SPEC.md), [review T-003](./T-003-REVIEW.md) |
| **Migration** | **Không có.** Mọi cột cần dùng đã có ở migration 024. Số 025–027 dành cho T-007, T-009, T-010 |

## Bối cảnh

T-003 dừng ở `FIGHT_WEEK`: từ `FIGHT_WEEK` và `WEIGHED_IN` chỉ còn chuyển được sang `CANCELLED` (`BOUT_TRANSITIONS` trong `src/bouts/bouts.model.ts`). Ticket này mở tiếp hai bước còn lại của vòng đời một trận, cộng ba việc T-003 để lại:

1. Khoá hồ sơ trong tuần thi đấu (nghiệp vụ 7).
2. Cân chính thức: đạt thì tự sang `WEIGHED_IN`, không đạt thì chọn catchweight hoặc huỷ; cờ giảm cấp tốc (nghiệp vụ 8, R17–R19).
3. Ghi kết quả, trận sang `COMPLETED` (nghiệp vụ 10, R26, H2–H6).
4. Hai vấn đề của review T-003: hạng mở (vấn đề 1) và lý do đổi hạng (vấn đề 2).

Đình chỉ tự động sau trận thuộc T-007; điền sẵn từ bản ghi hiệp (R25) và `scheduled_rounds` thuộc T-010. Ticket này để sẵn dữ liệu cho hai ticket đó (xem mục "Dữ liệu để lại cho T-007, T-010").

## Phạm vi

### 1. Mở bảng chuyển trạng thái

Trong `BOUT_TRANSITIONS` (`bouts.model.ts`):

```ts
FIGHT_WEEK: ['WEIGHED_IN', 'CANCELLED'],
WEIGHED_IN: ['COMPLETED', 'CANCELLED'],
```

Cập nhật comment đầu mục "State machine" (đang ghi "only the steps of T-003"). `COMPLETED → CANCELLED` và `CANCELLED → *` vẫn bị từ chối.

### 2. Khoá hồ sơ trong tuần thi đấu (nghiệp vụ 7, F5 bước 2)

Ba endpoint `POST/PATCH/DELETE /bouts/:id/requirements…` (`addRequirement`, `updateRequirement`, `removeRequirement` trong `bouts.service.ts`) hiện chỉ chặn khi trận ở trạng thái cuối. Thêm:

- Trận ở `FIGHT_WEEK` hoặc `WEIGHED_IN`: body phải có `unlockReason` (chuỗi 3–500 ký tự, cùng quy tắc `trimmedTextSchema(500, 3)` như `cancelBoutSchema`). Thiếu thì 409 `BOUT_REQUIREMENTS_LOCKED`. DELETE chưa có body: nhận `unlockReason` ở query string.
- Có `unlockReason` thì cho sửa, và ghi một phần tử vào `bouts.history`: `{ at, by, from: status, to: status, reason: unlockReason, action: 'REQUIREMENT_UNLOCK', requirementCode }` (cần nới `boutHistoryEntrySchema` và `BoutHistoryEntry` cho các trường tùy chọn mới, xem mục 6).
- Trận ở `SCHEDULED`, `CAMP`: không đổi hành vi, và `unlockReason` bị bỏ qua.
- Mục `source = PRESET` hay `COACH` đều bị khoá như nhau.

### 3. Cân chính thức (nghiệp vụ 8, F5, R17–R19)

**`POST /bouts/:id/weigh-in`**, quyền `bout:update`, `assertWriteAccess`. Body (Zod strict):

```ts
{ weightKg: number (30–200), hydrationCheck?: 'NOT_APPLICABLE' | 'PASSED' | 'FAILED', notes?: string (≤ 500) }
```

Điều kiện: trận ở `FIGHT_WEEK` và hôm nay (ngày học viện) ≥ ngày học viện của `weigh_in_at`. Sai trạng thái: 409 `BOUT_INVALID_TRANSITION`. Chưa đến ngày cân: 409 `BOUT_WEIGH_IN_TOO_EARLY` (kèm `earliestOn`). `hydrationCheck` bỏ trống thì coi là `NOT_APPLICABLE`.

Trong **một giao dịch** (cùng `setAuditContext`):

1. Chèn một dòng `fighter_measurements` với `measurement_context = 'WEIGH_IN'`, `weight_kg`, `measured_at = now`, `recorded_by_id = actor.id`. Viết truy vấn trong `bouts.repo.ts` bằng bảng `fighterMeasurements` của `src/database/schema.ts`; **không import `FightersModule`** (cùng lý do với `TrainingModule` ở T-003). Mỗi lần gọi chèn một dòng mới, không supersede.
2. Ghi `official_weight_kg`, `made_weight`, `hydration_check` lên trận.
3. `made_weight = weightKg ≤ limit` với `limit = catchweight_kg ?? weight_limit_kg`, so bằng số thập phân hai chữ số, không dùng so sánh số thực thô.
4. **Đạt** (R17: `made_weight` và `hydrationCheck ≠ 'FAILED'`): chuyển `FIGHT_WEEK → WEIGHED_IN` trong cùng giao dịch, ghi `history`.
5. **Không đạt** (số cân vượt, hoặc `hydrationCheck = 'FAILED'`): trận **giữ `FIGHT_WEEK`**, `made_weight = false`. Khi nước `FAILED` mà cân đạt, vẫn lưu `made_weight = true` (phản ánh số cân) nhưng không chuyển trạng thái; phản hồi nêu rõ lý do.

Cho phép gọi lại khi trận còn `FIGHT_WEEK` (cân lại); lần sau ghi đè ba cột trận, và dòng `fighter_measurements` cũ vẫn giữ. Trận đã `WEIGHED_IN` thì 409.

Phản hồi: `BoutDetailResponse` kèm khối mới:

```ts
weighIn: {
  outcome: 'PASSED' | 'FAILED';
  reason: 'OVER_LIMIT' | 'HYDRATION_FAILED' | null;
  overByKg: number | null;      // weightKg − limit khi vượt, làm tròn 2 chữ số
  overByPct: number | null;     // overByKg / limit × 100, làm tròn 1 chữ số
  options: ('CATCHWEIGHT' | 'CANCEL')[];   // rỗng khi PASSED (R18: chỉ hỏi một câu)
}
```

**`POST /bouts/:id/catchweight`**, quyền `bout:update`. Body `{ catchweightKg?: number, note?: string (≤ 500) }`. Điều kiện: trận `FIGHT_WEEK` và `made_weight` đã được ghi bằng `false` hoặc `hydration_check = 'FAILED'`; ngược lại 409 `BOUT_WEIGH_IN_NOT_FAILED`. `catchweightKg` bỏ trống thì mặc định bằng `official_weight_kg` (R18). Giá trị phải ≥ `official_weight_kg` và > `weight_limit_kg`, ngoài khoảng đó 422 `BOUT_INVALID_CATCHWEIGHT`. Ghi `catchweight_kg`, đặt `made_weight = true`, chuyển `FIGHT_WEEK → WEIGHED_IN`, ghi `history` với `reason = note ?? 'Catchweight'` và `catchweightKg`.

**Huỷ vì không đạt cân** dùng lại `POST /bouts/:id/cancel` có sẵn với `reason: "Không đạt cân"`. Không thêm endpoint.

**Cờ giảm cấp tốc (R19)**, tính khi đọc trong `buildDetail`, không lưu. Khi `official_weight_kg` khác NULL, thêm vào `BoutDetailResponse`:

```ts
acuteLoss: {
  status: 'EXCEEDED' | 'WITHIN' | 'NO_DATA';
  startKg: number | null; startOn: string | null;   // số cân đầu tiên trong cửa sổ
  lossPct: number | null;                            // (startKg − official) / startKg × 100, 1 chữ số
  limitPct: number;                                  // acute_loss_limit_pct của trận
} | null    // null khi chưa có cân chính thức
```

Cửa sổ là `[ngày học viện của weigh_in_at − acute_window_days, ngày học viện của weigh_in_at]`. `startKg` là số cân **đầu tiên** trong cửa sổ, lấy từ `fighter_measurements` **không tính** `measurement_context = 'WEIGH_IN'` và không tính bản đã bị supersede. Không có số cân nào: `NO_DATA`, `startKg`, `startOn`, `lossPct` đều `null`. `EXCEEDED` khi `lossPct > limitPct`. Viết hàm thuần `computeAcuteLoss` trong `bouts.model.ts`.

### 4. Ghi kết quả (nghiệp vụ 10, F6, H2, H3, H4, H6)

**`POST /bouts/:id/result`**, quyền `bout:result`, `assertWriteAccess`. Điều kiện: trận `WEIGHED_IN` (sai trạng thái: 409 `BOUT_INVALID_TRANSITION`) và hôm nay ≥ ngày học viện của `bout_at` (R26: 409 `BOUT_NOT_STARTED`, kèm `earliestOn`). Body (Zod strict):

| Trường | Kiểu | Quy tắc |
| --- | --- | --- |
| `result` | `WIN`, `LOSS`, `DRAW`, `NO_CONTEST` | bắt buộc |
| `method` | `KO`, `TKO`, `DECISION`, `SUBMISSION`, `DQ`, `OTHER` | bắt buộc |
| `resultRound` | số nguyên 1–12 | bắt buộc với `KO`, `TKO`, `SUBMISSION`; phải bỏ trống với `DECISION`; tùy chọn với `DQ`, `OTHER` |
| `knockedDown` | boolean | tùy chọn, mặc định `false`; chỉ lưu tham khảo (H6) |
| `lossOfConsciousness` | `NONE`, `UNDER_1_MIN`, `OVER_1_MIN`, `UNKNOWN` | bắt buộc khi `result = LOSS` và `method ∈ {KO, TKO}`; ngoài trường hợp đó phải bỏ trống |
| `stoppedByHeadStrike` | boolean | bắt buộc khi `result = LOSS` và `method = TKO` (H3); ngoài trường hợp đó phải bỏ trống |
| `injuryNote` | chuỗi ≤ 1000 | tùy chọn (H2) |
| `notes` | chuỗi ≤ 2000 | tùy chọn; ghi đè `bouts.notes` nếu có |

Vi phạm các ràng buộc có điều kiện: 422 `BOUT_RESULT_INVALID` kèm `reason` (ví dụ `ROUND_REQUIRED`, `ROUND_NOT_ALLOWED`, `CONSCIOUSNESS_REQUIRED`, `CONSCIOUSNESS_NOT_ALLOWED`, `HEAD_STRIKE_REQUIRED`, `HEAD_STRIKE_NOT_ALLOWED`), theo khuôn `requirementInvalid` / `boutInvalidWeightClass` trong `bouts.error.ts`.

Trong một giao dịch: ghi `result`, `method`, `result_round`, `knocked_down`, `notes`; chuyển `WEIGHED_IN → COMPLETED`; ghi `history` với các trường `lossOfConsciousness`, `stoppedByHeadStrike`, `injuryNote` (chỉ trường nào có giá trị). **Không** tạo bản ghi `injury_records`, **không** sửa module `medical` (H2). **Không** tạo đình chỉ hay ngày nghỉ (H6; T-007 làm). Ràng buộc DB `result`, `method` khác NULL khi và chỉ khi `COMPLETED` đã có ở 024.

**Huỷ sau khi cân (H4):** `WEIGHED_IN → CANCELLED` giữ nguyên hành vi; không tạo đình chỉ hay ngày nghỉ. Thêm một ca test khẳng định điều này.

### 5. Hai việc còn lại của review T-003

- **Hạng mở (vấn đề 1).** Trong `resolveWeightClass` (`bouts.model.ts:231`), với hạng có `limitKg === null`, giới hạn nhập tay phải **lớn hơn giới hạn lớn nhất** trong các hạng còn lại của preset; nếu không thì `{ ok: false, reason: 'LIMIT_OUT_OF_RANGE' }` (đã nằm trong union `WeightClassResolution`, `boutInvalidWeightClass` đã xử lý mã này nên không thêm mã mới). Ví dụ preset VMMAF, hạng `120+`, `weightLimitKg: 100` → từ chối; `121` → nhận. Áp dụng cả `createBout` lẫn `updateBout`.
- **Lý do đổi hạng (vấn đề 2, F8, R4c).** Trong `updateBoutSchema` thêm `reason` (`trimmedTextSchema(500, 3)`, tùy chọn). Khi `PATCH /bouts/:id` làm **đổi** `weight_class_code` hoặc `weight_limit_kg` so với giá trị hiện tại mà thiếu `reason`: 422 `BOUT_CHANGE_REASON_REQUIRED`. Có thì ghi một phần tử `history`: `{ at, by, from: status, to: status, reason, action: 'WEIGHT_CLASS_CHANGE', fromClass, toClass, fromLimitKg, toLimitKg }`. Gửi lại đúng hạng cũ thì coi là không đổi, không cần lý do. `reason` gửi kèm mà không đổi hạng thì bỏ qua.

### 6. Hợp đồng và phản hồi

- `boutHistoryEntrySchema` (`bouts.model.ts:615`) và kiểu `BoutHistoryEntry`: thêm các trường tùy chọn `action`, `requirementCode`, `fromClass`, `toClass`, `fromLimitKg`, `toLimitKg`, `catchweightKg`, `lossOfConsciousness`, `stoppedByHeadStrike`, `injuryNote`. Phần tử cũ đã lưu (không có trường mới) vẫn phải parse được.
- `boutDetailResponseSchema` (`bouts.model.ts:701`): thêm `acuteLoss` (mục 3). `weighIn` chỉ có trong phản hồi của `POST /weigh-in`; đặt thành trường tùy chọn của một schema riêng `weighInResponseSchema = boutDetailResponseSchema.extend({ weighIn })`.
- Thêm DTO tương ứng trong `bouts.dto.ts` (`WeighInDto`, `CatchweightDto`, `RecordResultDto`, `WeighInResponseDto`), route và Swagger trong `bouts.controller.ts` theo khuôn các route đang có; quyền dùng `BOUT_PERMISSIONS` trong `bouts.constants.ts` (đã có `bout:update`, `bout:result`).
- Mã lỗi mới (thêm vào `bouts.error.ts`, cùng khuôn các hàm hiện có): `BOUT_NOT_STARTED`, `BOUT_WEIGH_IN_TOO_EARLY`, `BOUT_WEIGH_IN_NOT_FAILED`, `BOUT_INVALID_CATCHWEIGHT`, `BOUT_RESULT_INVALID`, `BOUT_REQUIREMENTS_LOCKED`, `BOUT_CHANGE_REASON_REQUIRED`. Cập nhật `mapBoutPersistenceError` nếu cần.
- Cập nhật `docs/FIGHT-CAMP-TECH-SPEC.md` **không** thuộc ticket này (Claude làm khi review).

## Dữ liệu để lại cho T-007, T-010

Không làm gì thêm, chỉ bảo đảm dữ liệu đọc lại được: trên phần tử `history` của lần chuyển sang `COMPLETED` có `lossOfConsciousness`, `stoppedByHeadStrike`, `injuryNote`; cột `knocked_down`, `official_weight_kg`, `made_weight`, `catchweight_kg`, `hydration_check` đã có trên `bouts`; `acuteLoss` tính lại được từ `fighter_measurements`. T-007 đọc `history` để quyết định đình chỉ; T-010 dùng `acuteLoss` cho thẻ góc đài.

## Ngoài phạm vi

Migration; frontend; đình chỉ, Cổng 2, ngày nghỉ bắt buộc (T-007); `scheduled_rounds`, bản ghi hiệp, điền sẵn kết quả từ hiệp, kiểm tra "hiệp kết thúc > số hiệp" (T-010); kiểm tra khả thi cân khi tạo trận R31 và thẻ Việc cần làm (T-029); thông báo; mở khoá riêng cho từng mục hồ sơ ngoài cơ chế `unlockReason`; sửa module `medical`, `fighters`, `training`.

## Tiêu chí nghiệm thu

Hàm thuần (`bouts.model.spec.ts`):

1. `BOUT_TRANSITIONS`: `FIGHT_WEEK → WEIGHED_IN`, `WEIGHED_IN → COMPLETED` qua; `COMPLETED → CANCELLED`, `WEIGHED_IN → CAMP`, `FIGHT_WEEK → COMPLETED` bị từ chối.
2. `resolveWeightClass`: VMMAF `120+` với 100 → `LIMIT_OUT_OF_RANGE`; với 121 → ok; AIBA `91+` với 90 → từ chối, 92 → ok.
3. `computeAcuteLoss`: cửa sổ 7 ngày, `startKg` 66,0, cân chính thức 60,8, ngưỡng 8 → `lossPct` 7,9, `WITHIN`; cân chính thức 60,0 → 9,1, `EXCEEDED`; không có số cân nào trong cửa sổ → `NO_DATA`; số cân loại `WEIGH_IN` và bản đã supersede không được chọn làm `startKg`; có nhiều số cân thì chọn số **sớm nhất** trong cửa sổ.

Service và API (`bouts.service.spec.ts`, `bouts.controller.spec.ts`):

4. Giới hạn 60 kg, cân chính thức 59,8, không kiểm tra nước → trận sang `WEIGHED_IN` ngay, một dòng `fighter_measurements` mới với context `WEIGH_IN`, `history` có chuyển trạng thái, phản hồi `weighIn.outcome = 'PASSED'`, `options` rỗng.
5. Cân chính thức 60,0 (bằng giới hạn) → đạt. Cân 60,5 → `FAILED`, `OVER_LIMIT`, `overByKg = 0,5`, `overByPct = 0,8`, trận vẫn `FIGHT_WEEK`, `options = ['CATCHWEIGHT','CANCEL']`.
6. Cân 59,8 nhưng `hydrationCheck = 'FAILED'` → trận vẫn `FIGHT_WEEK`, `HYDRATION_FAILED`, `made_weight = true`.
7. Sau ca 5, gọi `catchweight` không truyền giá trị → `catchweight_kg = 60,5`, trận sang `WEIGHED_IN`. Truyền 60,2 (< số cân chính thức) → 422 `BOUT_INVALID_CATCHWEIGHT`. Gọi `catchweight` khi cân đã đạt → 409 `BOUT_WEIGH_IN_NOT_FAILED`.
8. Cân lại khi còn `FIGHT_WEEK`: lần 2 đạt → `WEIGHED_IN`, trận mang số cân lần 2, cả hai dòng `fighter_measurements` còn. Gọi `weigh-in` khi đã `WEIGHED_IN` → 409.
9. `weigh-in` trước ngày cân (ngày học viện) → 409 `BOUT_WEIGH_IN_TOO_EARLY`; trận `CAMP` → 409 `BOUT_INVALID_TRANSITION`.
10. Cân chính thức làm `status` của `weight-track` đổi theo (điểm cân chính thức nằm trong `points`).
11. `result` trước ngày thi → 409 `BOUT_NOT_STARTED`, trận không đổi. Từ ngày thi, `WIN` + `DECISION` + không `resultRound` → `COMPLETED`.
12. `LOSS` + `KO` thiếu `lossOfConsciousness` → 422 `BOUT_RESULT_INVALID` (`CONSCIOUSNESS_REQUIRED`); `WIN` + `KO` có `lossOfConsciousness` → 422 (`CONSCIOUSNESS_NOT_ALLOWED`); `LOSS` + `TKO` thiếu `stoppedByHeadStrike` → 422; `DECISION` kèm `resultRound` → 422; `KO` thiếu `resultRound` → 422.
13. `LOSS` + `TKO` + `lossOfConsciousness: 'NONE'` + `stoppedByHeadStrike: true` + `injuryNote` → `COMPLETED`; `history` của lần chuyển chứa đúng ba trường đó; không có bản ghi nào trong `injury_records` hay đình chỉ được tạo (kiểm tra bằng mock repo không bị gọi).
14. `WEIGHED_IN → CANCELLED` với lý do "Không đạt cân": không tạo gì khác (H4).
15. Khoá hồ sơ: trận `FIGHT_WEEK`, `PATCH /requirements/:code` không có `unlockReason` → 409 `BOUT_REQUIREMENTS_LOCKED`; có → thành công và `history` có phần tử `REQUIREMENT_UNLOCK`. Cùng kiểm tra cho `POST` và `DELETE`. Trận `CAMP` không cần `unlockReason`.
16. `PATCH` đổi hạng không có `reason` → 422 `BOUT_CHANGE_REASON_REQUIRED`; có `reason` → thành công, `history` có `WEIGHT_CLASS_CHANGE` với hạng và giới hạn cũ, mới; gửi lại đúng hạng cũ không cần lý do.
17. FIGHTER gọi `weigh-in`, `catchweight`, `result` → 403. COACH không được phân công → 403. ADMIN → được.
18. Hai request `weigh-in` đồng thời trên cùng trận: một thành công, một nhận `BOUT_STATE_CONFLICT` hoặc 409 (dựa vào `expectedStatus` của `repo.updateBout`); không có trận nào ở trạng thái lệch.

Không có migration nên không thêm ca vào `scripts/test-migrations.mjs`; `test:db` và `db:check` phải vẫn qua.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nestjs-api lint
pnpm --filter nestjs-api build
pnpm --filter nestjs-api test
pnpm --filter nestjs-api test:db
pnpm --filter nestjs-api db:check
```

Không lệnh nào được thêm lỗi so với [baseline](./BASELINE.md). Dán nguyên văn phần cuối output vào handover `docs/tickets/T-006-HANDOVER.md` theo mẫu ở mục 6 của [TEAM-WORKFLOW](../TEAM-WORKFLOW.md).

## Ghi chú cho người thực hiện

- Module mẫu cùng loại: chính `src/bouts/` (đọc `transition()`, `enterFightWeek`, `cancelBout`, `loadWeightTrack` trong `bouts.service.ts` trước). Chuyển trạng thái đi qua `transition(actor, bout, to, requestId, { changes, reason })` rồi `repo.updateBout(..., { expectedStatus, historyEntry })`; **không** tự viết SQL chuyển trạng thái riêng.
- Ngày luôn là ngày học viện (`academyDateOf`, UTC+7); không dùng `toISOString().slice(0, 10)`.
- Không cài thêm thư viện. Không đụng các khu vực đóng băng.
- Thấy lệch giữa ticket và code thì ghi vào mục "Câu hỏi" của handover, không đoán.
