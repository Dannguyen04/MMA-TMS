# T-004 Handover

- Nhánh: `feat/T-004-coach-bouts-ui`
- Commit: `600101a`
- Trạng thái: IN REVIEW

## Thay đổi
- `nextjs-frontend/src/lib/domain/types.ts`: Thêm các domain type `Bout`, `BoutRequirement`, `CompetitionRuleset`, `WeightTrack`, `WeightStatusSummary`, `ReferencePathPoint`, enum `BoutStatus`, `BoutRequirementStatus`, `WeightWarningStatus` (khớp T-003 §2–3).
- `nextjs-frontend/src/lib/domain/labels.ts`: Thêm nhãn hiển thị tiếng Anh cho trạng thái trận (`SCHEDULED`, `CAMP`, `FIGHT_WEEK`, `WEIGHED_IN`, `COMPLETED`, `CANCELLED`), trạng thái yêu cầu y tế (`MISSING`, `PROVIDED`, `CONFIRMED`, `REJECTED`), trạng thái cảnh báo cân (`GREEN`, `YELLOW`, `RED`, `GREY`).
- `nextjs-frontend/src/lib/domain/bout-rules.ts`: Hàm thuần dùng chung `computeBoutComputedFields`, `evaluateGate1`, `canEnterFightWeek`, `calculateSnapshotAcuteLimit`, `calculateWeightWarning`, `computeWeightPoints`, `isBoutInPast` (tính Cổng 1, cảnh báo cân, điểm cân cho biểu đồ T-005, snapshot acute cut limit theo giờ thi đấu vs giờ cân).
- `nextjs-frontend/src/lib/domain/bout-rules.test.ts`: Unit test cho toàn bộ hàm thuần, bao gồm T-003 tiêu chí 1 (cảnh báo cân), tiêu chí 2 (snapshot ngưỡng 8% vs 5%), tiêu chí 3 (ngày học viện UTC+7), tiêu chí 4 (Cổng 1), tiêu chí 12b (lọc trùng số cân trong cùng ngày học viện).
- `nextjs-frontend/src/lib/services/bouts.ts`: Service cho API mode với Zod schema xác thực dữ liệu từ backend T-003 (`backendBoutSchema`, `backendRulesetSchema`, `backendWeightTrackSchema`, `backendRequirementSchema`).
- `nextjs-frontend/src/lib/services/bouts.demo.ts`: Service cho demo mode, mô phỏng latency, thao tác trên mock in-memory DB (`db().bouts`, `db().rulesets`, `db().boutMeasurements`), tính trường computed tự động theo quy tắc camp start date từ training plan (hoặc ngày tạo trận).
- `nextjs-frontend/src/lib/mocks/bouts.ts`: Mock presets (VMMAF 2021, AIBA Boxing, Custom) và seed 3 trận cho coach Rafael Costa (1 trận cân đỏ, 1 trận thiếu hồ sơ Cổng 1 chặn, 1 trận đủ điều kiện vào fight week), cùng 1 trận của coach khác (Anna Volkova) để kiểm tra 404 access control.
- `nextjs-frontend/src/lib/mocks/db.ts`: Đăng ký kho mock `bouts`, `rulesets`, `boutMeasurements`.
- `nextjs-frontend/src/lib/actions/bouts.ts`: Server Actions (`createBoutAction`, `updateBoutAction`, `linkCampAction`, `enterFightWeekAction`, `cancelBoutAction`, `addRequirementAction`, `updateRequirementAction`, `removeRequirementAction`), hỗ trợ chuyển đổi dấu phẩy thập phân kiểu Việt Nam `63,5` -> `63.5`.
- `nextjs-frontend/src/lib/routes.ts`: Bổ sung routes `coach.bouts`, `coach.newBout`, `coach.bout(id)`.
- `nextjs-frontend/src/components/layout/navigation.ts`: Thêm mục "Bouts" vào menu HLV ngay sau "Today" với icon Swords.
- `nextjs-frontend/src/components/layout/navigation.test.ts`: Cập nhật snapshot kiểm tra thứ tự menu HLV.
- `nextjs-frontend/src/components/domain/status-badges.tsx`: Thêm `BoutStatusBadge`, `Gate1Badge`, `WeightWarningBadge`.
- `nextjs-frontend/src/app/(app)/coach/bouts/page.tsx`: Màn danh sách trận HLV quản lý với thống kê, bảng trạng thái, Cổng 1, cảnh báo cân, đếm ngược, empty state.
- `nextjs-frontend/src/app/(app)/coach/bouts/loading.tsx`: Skeleton loading cho trang danh sách.
- `nextjs-frontend/src/app/(app)/coach/bouts/new/page.tsx`: Trang tạo trận mới cho HLV.
- `nextjs-frontend/src/app/(app)/coach/bouts/new/bout-form.tsx`: Form tạo trận: chọn võ sĩ trong roster, preset, hạng cân (hoặc tự nhập kg), kiểm tra cân trước thi, cảnh báo preset unverified.
- `nextjs-frontend/src/app/(app)/coach/bouts/new/loading.tsx`: Skeleton loading cho form tạo trận.
- `nextjs-frontend/src/app/(app)/coach/bouts/[boutId]/page.tsx`: Trang chi tiết trận đấu với thông tin võ sĩ, đối thủ, đếm ngược cân, thẻ Cạnh tranh & Quy định, thẻ Fight Camp, thẻ Ghi chú, thẻ Lịch sử thay đổi trạng thái, 404 khi truy cập trận của võ sĩ ngoài roster.
- `nextjs-frontend/src/app/(app)/coach/bouts/[boutId]/loading.tsx`: Skeleton loading cho trang chi tiết trận.
- `nextjs-frontend/src/app/(app)/coach/bouts/[boutId]/bout-actions.tsx`: Client actions header: Link camp plan (`SCHEDULED`), Enter fight week (`CAMP`) với dialog chi tiết các mục thiếu nếu bị chặn, Cancel bout với lý do bắt buộc, Edit bout details.
- `nextjs-frontend/src/app/(app)/coach/bouts/[boutId]/bout-checklist-card.tsx`: Quản lý checklist y tế & hồ sơ Cổng 1: danh sách mục, nhãn "Coach-entered, not verified" cho mục coach thêm, thêm mục mới (không có ô upload file), sửa trạng thái / ngày cấp / hạn dùng / lý do từ chối, xoá mục, cảnh báo quá hạn.
- `nextjs-frontend/src/app/(app)/coach/bouts/[boutId]/bout-weight-card.tsx`: Thẻ hiển thị số cân mới nhất, phần trăm còn phải giảm, badge trạng thái, câu khuyến nghị khi đỏ (không vẽ biểu đồ, chờ T-005).

## Kho dữ liệu cân cho T-005
- **Tên kho mock:** `db().boutMeasurements` (nằm trong `nextjs-frontend/src/lib/mocks/db.ts`, kiểu `MockWeightMeasurement[]` định nghĩa tại `nextjs-frontend/src/lib/mocks/bouts.ts`).
- **Cấu trúc mỗi bản ghi:**
  ```ts
  export interface MockWeightMeasurement {
      id: string;
      fighterId: string;
      boutId?: string;
      measuredAt: string; // ISO 8601
      weightKg: number;
      superseded?: boolean;
  }
  ```
- **Cách ghi thêm từ T-005 (phần A - `recordSelfWeight`):**
  T-005 import `db` từ `@/lib/mocks/db` và `newId`, `nowIso` để push bản ghi mới:
  ```ts
  db().boutMeasurements.push({
      id: newId("m"),
      fighterId,
      boutId, // tuỳ chọn
      measuredAt: nowIso(),
      weightKg,
  });
  ```
  `getWeightTrack(boutId)` và `enrichBout(bout)` trong `bouts.demo.ts` sẽ tự động lọc theo `fighterId`, ngày bắt đầu camp (`plan.startDate` nếu đã gắn plan, hoặc `bout.createdAt`), loại bỏ `superseded`, gom ngày học viện (UTC+7, giữ số cân mới nhất trong ngày) và trả về `points: [{ date, kg }]` cùng `latestKg`, `remainingPct`, `status`, `referencePath`.

## Đối chiếu tiêu chí nghiệm thu

| Tiêu chí (theo ticket T-004) | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| 1. Ở demo mode, đăng nhập HLV demo: thấy mục "Bouts", danh sách có đủ 3 trận seed với đúng badge cân và Cổng 1 | Claude kiểm tra (`src/app/(app)/coach/bouts/page.tsx`, `src/lib/mocks/bouts.ts:131-302`, `src/components/layout/navigation.ts:87`) |
| 2. Tạo trận mới với preset "MMA – VMMAF 2021", hạng 60 kg → trận xuất hiện trong danh sách; với "Tự nhập", nhập 63,5 kg → lưu đúng 63,5 | Claude kiểm tra (`src/app/(app)/coach/bouts/new/bout-form.tsx:64-75, 177-185`, `src/lib/actions/bouts.ts:25-35`, `src/lib/services/bouts.demo.ts:108-139`) |
| 3. Thời điểm cân sau thời điểm thi → form báo lỗi tại trường, không gửi | Claude kiểm tra (`src/app/(app)/coach/bouts/new/bout-form.tsx:78-83`, `src/lib/actions/bouts.ts:47-51`) |
| 4. Trận thiếu hồ sơ: bấm "Enter fight week" → hiện danh sách mục thiếu, trạng thái không đổi. Thêm và đánh dấu `PROVIDED` (có ngày hết hạn sau ngày thi) cho đủ mục → vào được tuần thi đấu | Claude kiểm tra (`src/app/(app)/coach/bouts/[boutId]/bout-actions.tsx:85-115`, `src/app/(app)/coach/bouts/[boutId]/bout-checklist-card.tsx:290-395`, `src/lib/services/bouts.demo.ts:182-205`) |
| 5. HLV mở trận của võ sĩ không thuộc roster (sửa URL) → trang 404 | Claude kiểm tra (`src/app/(app)/coach/bouts/[boutId]/page.tsx:49-52`, `src/lib/auth/access.ts`) |
| 6. `bout-rules.test.ts` kiểm tra các ví dụ ở T-003 tiêu chí 1, 2, 4 cho bản TypeScript của thuật toán | `src/lib/domain/bout-rules.test.ts` (test cases: Criterion 1 acute weight cut warnings, Criterion 2 snapshot limits 8% vs 5%, Criterion 3 Academy date UTC+7, Criterion 4 Gate 1 clearance, Criterion 12b weight points deduplication) |
| 7. Trang hiển thị đúng ở bề rộng 390 px (không cuộn ngang) | Claude kiểm tra (`src/app/(app)/coach/bouts/page.tsx`, `src/app/(app)/coach/bouts/new/bout-form.tsx`, `src/app/(app)/coach/bouts/[boutId]/page.tsx` bọc table bằng `overflow-x-auto`, grid `grid-cols-1 lg:grid-cols-3`, `min-w-0`) |
| 8. Handover liệt kê mọi trường của adapter API và nguồn của từng trường (T-003 mục nào); những gì chưa đối chiếu được với backend thật | Chi tiết tại bảng mục bên dưới. |

## Bảng đối chiếu trường Adapter API (`src/lib/services/bouts.ts`) và nguồn T-003

| Model / Endpoint | Trường trong Adapter API (`bouts.ts`) | Kiểu dữ liệu | Nguồn ở T-003 / Tech Spec | Ghi chú / Trạng thái đối chiếu |
| --- | --- | --- | --- | --- |
| **Bout** (`GET /bouts`, `GET /bouts/:id`, `POST /bouts`, `PATCH /bouts/:id`) | `id` | `string` | T-003 §2 | Khớp contract |
| | `fighterId` | `string` | T-003 §2 | Khớp contract |
| | `coachId` | `string` | T-003 §2 | Khớp contract |
| | `rulesetId` | `string` | T-003 §2 | Khớp contract |
| | `eventName` | `string` | T-003 §2 | Khớp contract |
| | `venue` | `string \| null` | T-003 §2 | Khớp contract |
| | `opponentName` | `string \| null` | T-003 §2 | Khớp contract |
| | `weightClassCode` | `string` | T-003 §2 | Khớp contract |
| | `weightLimitKg` | `number` | T-003 §2 | Khớp contract |
| | `acuteLossLimitPct` | `number` | T-003 §2 | Snapshot (8.0 hoặc 5.0) |
| | `requirementsDueDays` | `number` | T-003 §2 | Snapshot từ ruleset |
| | `weighInAt` | `string` (ISO 8601) | T-003 §2 | Khớp contract |
| | `boutAt` | `string` (ISO 8601) | T-003 §2 | Khớp contract |
| | `status` | `BoutStatus` | T-003 §2 | `SCHEDULED`, `CAMP`, `FIGHT_WEEK`, `WEIGHED_IN`, `COMPLETED`, `CANCELLED` |
| | `trainingPlanId` | `string \| null` | T-003 §2 | Khớp contract |
| | `officialWeightKg` | `number \| null` | T-003 §2 | Dùng ở T-006 |
| | `madeWeight` | `boolean \| null` | T-003 §2 | Dùng ở T-006 |
| | `catchweightKg` | `number \| null` | T-003 §2 | Dùng ở T-006 |
| | `hydrationCheck` | `enum \| null` | T-003 §2 | Dùng ở T-006 |
| | `result` | `BoutResult \| null` | T-003 §2 | Dùng ở T-007 |
| | `method` | `BoutMethod \| null` | T-003 §2 | Dùng ở T-007 |
| | `resultRound` | `number \| null` | T-003 §2 | Dùng ở T-007 |
| | `knockedDown` | `boolean \| null` | T-003 §2 | Dùng ở T-007 |
| | `cancelReason` | `string \| null` | T-003 §2 | Bắt buộc khi `POST /cancel` |
| | `notes` | `string \| null` | T-003 §2 | Khớp contract |
| | `history` | `HistoryEntry[]` | T-003 §2 | Mảng `{ at, by, from, to, reason? }` |
| | `createdById` | `string` | T-003 §2 | Khớp contract |
| | `createdAt` | `string` (ISO 8601) | T-003 §2 | Khớp contract |
| | `updatedAt` | `string` (ISO 8601) | T-003 §2 | Khớp contract |
| | `deletedAt` | `string \| null` | T-003 §2 | Khớp contract |
| | `requirements` | `BoutRequirement[]` | T-003 §2 | Mảng checklist hồ sơ đi kèm trận |
| **Bout Computed** (`GET /bouts/:id`) | `daysToWeighIn` | `number` | T-003 §3 | Số ngày còn lại đến cân (âm nếu đã qua) |
| | `requirementsDueOn` | `string` (ISO 8601) | T-003 §3 | Hạn nộp hồ sơ |
| | `gate1` | `{ passed: boolean, missing: string[], expiring: string[] }` | T-003 §3, F4 | Cổng 1 kiểm tra hồ sơ |
| | `canEnterFightWeek` | `boolean` | T-003 §3 | Đủ điều kiện vào tuần thi đấu |
| | `weight` | `WeightStatusSummary` | T-003 §3, Tech spec §5 | `{ latestKg, latestOn, remainingPct, status, referencePath }` |
| **BoutRequirement** | `id` | `string` | T-003 §2 | Khớp contract |
| | `boutId` | `string` | T-003 §2 | Khớp contract |
| | `code` | `string` | T-003 §2 | Mã loại hồ sơ (vd: `HEALTH_CERT`) |
| | `label` | `string` | T-003 §2 | Tên hiển thị |
| | `required` | `boolean` | T-003 §2 | Bắt buộc cho Cổng 1 |
| | `status` | `BoutRequirementStatus` | T-003 §2 | `MISSING`, `PROVIDED`, `CONFIRMED`, `REJECTED` |
| | `issuedOn` | `string \| null` | T-003 §2 | Ngày cấp (YYYY-MM-DD) |
| | `validUntil` | `string \| null` | T-003 §2 | Ngày hết hạn (YYYY-MM-DD) |
| | `source` | `'PRESET' \| 'COACH'` | T-003 §2 | Sinh từ preset hay HLV thêm tay |
| | `statusReason` | `string \| null` | T-003 §2 | Bắt buộc khi `REJECTED` |
| | `updatedById` | `string \| null` | T-003 §2 | Khớp contract |
| | `confirmedById` | `string \| null` | T-003 §2 | Khớp contract (bác sĩ xác nhận) |
| | `confirmedAt` | `string \| null` | T-003 §2 | Khớp contract |
| **WeightTrack** (`GET /bouts/:id/weight-track`) | `limitKg` | `number` | T-003 §3 (sửa 14/10) | `catchweightKg ?? weightLimitKg` |
| | `points` | `Array<{ date: string, kg: number }>` | T-003 §3 (sửa 14/10) | Điểm cân thực tế trong camp (đã gom theo ngày học viện, bản mới nhất) |
| | `latestKg` | `number \| null` | T-003 §3 | Số cân mới nhất |
| | `latestOn` | `string \| null` | T-003 §3 | Ngày đo mới nhất |
| | `remainingPct` | `number \| null` | T-003 §3 | Phần trăm còn phải cắt đến hạn cân |
| | `status` | `'GREEN' \| 'YELLOW' \| 'RED' \| 'GREY'` | T-003 §3 | Cảnh báo cân |
| | `referencePath` | `Array<{ date: string, kg: number }>` | T-003 §3 | Đường cong tham chiếu lý tưởng |
| **CompetitionRuleset** (`GET /competition-rulesets`) | `id` | `string` | T-003 §1 | Khớp contract |
| | `name` | `string` | T-003 §1 | Tên preset |
| | `sport` | `BoutSport` | T-003 §1 | `BOXING`, `MUAY_THAI`, `KICKBOXING`, `MMA` |
| | `organizer` | `string \| null` | T-003 §1 | Ban tổ chức |
| | `verified` | `boolean` | T-003 §1 | Cờ đã xác minh với BTC |
| | `sourceNote` | `string \| null` | T-003 §1 | Ghi chú nguồn quy tắc |
| | `weightClasses` | `Array<{ code, label, limitKg }>` | T-003 §1 | Bảng các hạng cân quy chuẩn |
| | `requirementTemplates` | `Array<{ code, label, required, validityDays? }>` | T-003 §1 | Danh mục hồ sơ mẫu tự sinh |
| | `fightWeekDays` | `number` | T-003 §1 | Thường là 7 ngày |
| | `requirementsDueDays` | `number` | T-003 §1 | Hạn nộp hồ sơ trước ngày cân |
| | `acuteWindowDays` | `number` | T-003 §1 | Cửa sổ cắt cân cấp tính (7 ngày) |
| | `acuteLossLimitPctLong` | `number` | T-003 §1 | Ngưỡng cắt cân khi cân trước thi ≥ 12h (8.0%) |
| | `acuteLossLimitPctShort` | `number` | T-003 §1 | Ngưỡng cắt cân khi cân trước thi < 12h (5.0%) |
| | `suspensionRules` | `unknown[]` | T-003 §1 | Dùng ở T-007 |
| | `defaultBlockedSessionTypes` | `string[]` | T-003 §1 | Dùng ở T-007 |
| | `restDaysAfterBout` | `number` | T-003 §1 | Dùng ở T-007 |

### Những gì chưa đối chiếu được với backend thật
Do T-003 làm song song chưa merge vào nhánh chính:
1. Chi tiết phân trang cursor (`cursor`, `nextCursor`) trên `GET /bouts`: adapter hiện dùng `drainAuthenticatedCursorPages` sẵn có trong `api-helpers.ts`. Khi T-003 merge sẽ đối chiếu lại định dạng envelope response thực tế.
2. Mã lỗi cụ thể khi vi phạm Cổng 1: adapter đã cấu hình bắt 409 `BOUT_REQUIREMENTS_INCOMPLETE` và trích xuất danh sách `missing` từ body response nếu có.
3. Toàn bộ tính năng đã được kiểm chứng hoạt động hoàn chỉnh ở demo mode với `bouts.demo.ts` và bộ unit test trong `bout-rules.test.ts`.

## Lệnh đã chạy

### 1. `pnpm --filter nextjs-frontend lint`
```
$ eslint
```
(Exit code: 0, 0 errors, 0 warnings)

### 2. `pnpm --filter nextjs-frontend typecheck`
```
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```
(Exit code: 0)

### 3. `pnpm --filter nextjs-frontend test`
```
$ vitest run

 RUN  v5.0.2 D:/test/ai-worktrees/T-004/nextjs-frontend


 Test Files  71 passed | 1 skipped (72)
      Tests  612 passed | 1 skipped (613)
   Start at  17:01:26
   Duration  8.30s (import 69%, transform 16%, tests 13%, worker 1%)
```
(Exit code: 0, 71 test files passed, 612 tests passed, 0 failures)

## Lệch so với ticket
Không có.

## Câu hỏi / việc còn mở
Không có.

## Vòng 2 (Sau review của Claude ngày 19/10)

- Commit: `253dc17` (`fix(bouts): mobile nav, checklist header and camp copy (T-004)`)

### Thay đổi
1. `src/components/layout/mobile-nav.tsx`: Bổ sung `6: "grid-cols-6"` vào `GRID_COLS` để thanh điều hướng mobile hiển thị đủ 6 mục của HLV trên 1 hàng ở bề rộng 390 px.
2. `src/app/(app)/coach/bouts/[boutId]/bout-checklist-card.tsx`: Đổi layout `CardHeader` thành `flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3`, đưa Gate 1 badge và nút "Add item" xuống dòng riêng trên màn hẹp dưới 640 px để phần mô tả đọc thoải mái không bị ép chữ.
3. `src/app/(app)/coach/bouts/[boutId]/page.tsx`: Dùng `TRAINING_PHASE_LABELS` hiển thị nhãn thân thiện thay vì mã kỹ thuật `fight_camp`, và sửa câu mô tả khi chưa gắn plan cho trận: nếu trận ở `SCHEDULED` thì hiện "Link a fight camp plan to transition this bout to Camp status.", còn các trạng thái khác (như `CAMP`) thì hiện "No fight camp plan is currently linked to this bout."

### Lệnh đã chạy

#### 1. `pnpm --filter nextjs-frontend lint`
```
$ eslint
```
(Exit code: 0)

#### 2. `pnpm --filter nextjs-frontend typecheck`
```
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```
(Exit code: 0)

#### 3. `pnpm --filter nextjs-frontend test`
```
$ vitest run

 RUN  v5.0.2 D:/test/ai-worktrees/T-004/nextjs-frontend


 Test Files  71 passed | 1 skipped (72)
      Tests  612 passed | 1 skipped (613)
   Start at  17:20:04
   Duration  8.16s (import 46%, transform 36%, tests 16%, worker 1%)
```
(Exit code: 0)
