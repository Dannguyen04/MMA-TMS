# T-029 · Thẻ Việc cần làm của HLV, nhắc cân tuần thi đấu, khả thi về cân, màu cân từ WEIGHED_IN (backend, phần A)

| | |
| --- | --- |
| **Trạng thái** | IN REVIEW (24/10). Claude làm cả backend lẫn frontend theo chỉ định của chủ dự án; Q1, Q2, Q3 đã chốt. Xem [handover](./T-029-HANDOVER.md) |
| **Phần** | A: Backend (`nestjs-api`). Phần B (form tạo trận hiện khả thi, thẻ Việc cần làm trên dashboard HLV, nhắc cân trên app võ sĩ) có ticket riêng: B1 Hoàng Anh, B2 Fon |
| **Người nhận** | Ken |
| **Nhánh** | `feat/T-029-coach-todo` từ `fight-camp` mới nhất (đã có T-003, T-006, T-010; và T-007 nếu đã merge) |
| **Hạn** | Làm 27–28/10. Mục 1 đến 4 không chờ T-007; hai nguồn của mục 5 phụ thuộc T-007 làm sau khi T-007 merge |
| **Tài liệu dẫn chiếu** | [Luồng nghiệp vụ R7, R11, R14, R16, R17, R26, R28, R31, R32, S3, "Việc cần làm của HLV"](../FIGHT-CAMP-BUSINESS-FLOWS.md), [Tech spec §3, §5](../FIGHT-CAMP-TECH-SPEC.md), [T-006](./T-006-weigh-in-and-result.md), [T-007](./T-007-suspensions-and-readiness.md), module chi tiết [04](../../nestjs-api/docs/modules/04-weight-feasibility.md), [06](../../nestjs-api/docs/modules/06-bout-create-warnings.md), [07](../../nestjs-api/docs/modules/07-weight-reminder.md), [08](../../nestjs-api/docs/modules/08-todo-card.md) |
| **Migration** | **Không có.** Mọi giá trị tính khi đọc, không lưu |

## Bối cảnh

T-003 có theo dõi cân (`computeWeightTrack`), T-006 có cân chính thức và kết quả, T-010 có phân tích đối thủ. Còn thiếu bốn thứ, ticket này làm:

1. **Lỗi màu cân sau ngày cân.** `computeWeightTrack` (`src/bouts/bouts.model.ts:371`) không xét trạng thái trận. Qua ngày cân, `daysLeft` thành số âm, nên số cân tự ghi sau buổi cân (lúc võ sĩ đã bù nước) rơi vào nhánh `daysLeft <= acuteWindowDays` và ra ĐỎ.
2. **Khả thi về cân khi tạo trận (R31).** Form tạo trận chưa biết võ sĩ có kịp xuống hạng cân không.
3. **Nhắc nhập cân hôm nay trong tuần thi đấu.** Luồng nghiệp vụ (nghiệp vụ 7, F5) yêu cầu nhưng T-006 chưa làm. Đã kiểm tra `origin/fight-camp`: không có `reminder` hay field tương tự trong `src/bouts` hay frontend.
4. **Thẻ Việc cần làm của HLV**, gom việc của ba giai đoạn; thẻ "Weight alerts" của T-005 B trở thành một nhóm của thẻ này.

## Quyết định đã chốt (chủ dự án trả lời Ken, 24/10)

| Nội dung | Quyết định |
| --- | --- |
| Màu cân từ `WEIGHED_IN` | Từ `WEIGHED_IN` trở đi (gồm `COMPLETED`, `CANCELLED`) không tính màu cân. Biểu đồ vẫn hiện các điểm cân. **Việc này thuộc T-029** (thẻ Việc cần làm cũng đọc màu cân) |
| Nhắc cân | **Không** nhắc nhập cân ngày thi (app không theo dõi bù nước, Nghiên cứu §4). Nhắc cân **chỉ áp trong `FIGHT_WEEK`**. Thay thế cửa sổ "`CAMP` tới hết ngày thi" của module 07 |
| XÁM | Không đổi `WEIGHT_STALE_DAYS = 3` (R7 đã duyệt). Nhắc "hôm nay chưa ghi cân" (T0) là quy tắc riêng, **không dựa vào XÁM** và **không có mức "XÁM 2 ngày trong cửa sổ cấp tính"** |
| Ngưỡng theo WBC | Không đổi, không làm. Muốn đề xuất thì gửi văn bản gốc; nếu dùng thì làm tham số của bộ luật. Ngưỡng hiện tại: 8% / 5% cho cửa sổ cấp tính `acute_window_days` (Reale 2018, Nghiên cứu §4) |
| Hàm R31 | Được viết hàm mới thay vì dùng lại `computeWeightTrack` (Ken quyết 22/10); ghi vào "Lệch so với ticket" theo mẫu ở [README modules](../../nestjs-api/docs/modules/README.md#mẫu-lệch-so-với-ticket-cho-handover). Lý do: `buildReferencePath` bắt đầu từ cân đầu camp, lúc tạo trận chưa có camp nên nhánh VÀNG không bao giờ chạy |
| Không có nút "hôm nay không cân" | Ốm đau thuộc module medical (Ken quyết 22/10) |
| Nhập bù | Nhắc luôn hướng tới hôm nay, không nhập bù ngày cũ |

## Phạm vi

### 1. Không tính màu cân từ `WEIGHED_IN`

- Thêm `boutStatus` vào đầu vào `computeWeightTrack`. Khi `boutStatus` là `WEIGHED_IN`, `COMPLETED` hoặc `CANCELLED`: `status = NEUTRAL` (Q1), vẫn trả `points`, `latestKg`, `latestOn`, `remainingPct`, `referencePath`. Các trạng thái còn lại (`SCHEDULED`, `CAMP`, `FIGHT_WEEK`) giữ nguyên hành vi hiện tại.
- Truyền `bout.status` ở `loadWeightTrack` (`bouts.service.ts:1159`).
- `acuteLoss` (`computeAcuteLoss`) không đổi.
- Tác động contract: `weight.status` đang được đọc ở `nextjs-frontend/src/components/domain/status-badges.tsx`, `src/app/(app)/coach/bouts/page.tsx`, `coach/dashboard/weight-alerts-card.tsx`, `fighter/bout/page.tsx`, `components/domain/weight-chart.tsx`, `lib/domain/weigh-in.ts`, và các khoá i18n `weightStatus.*`. Ghi danh sách này vào handover; sửa frontend thuộc phần B.

### 2. Hàm khả thi về cân (R31)

Hàm thuần mới `computeWeightFeasibility` cạnh `computeWeightTrack` trong `bouts.model.ts`, theo [module 04](../../nestjs-api/docs/modules/04-weight-feasibility.md): đầu vào `limitKg`, `L` (`acute_loss_limit_pct` của trận, hoặc `acuteLossLimitPctFor(weighInAt, boutAt, limits)` khi trận chưa tồn tại), `A` (`acute_window_days`), `D` (số ngày học viện đến ngày cân), cân mới nhất `W` và ngày đo.

- `remainingPct = max(0, (W − limitKg) / W × 100)` (cùng mẫu số với `computeWeightTrack`).
- Không có cân trong 7 ngày gần nhất (cân 8 ngày trước cũng là không có): `INSUFFICIENT_DATA`, không hiện màu.
- `D <= A`: luật R7 (`remainingPct > L` là ĐỎ, ngược lại XANH).
- `D > A`: **chờ Q2**.
- Hằng số đặt tên `FEASIBILITY_*`, không hard-code rải rác. Không sửa `computeWeightTrack` ngoài việc ở mục 1.

### 3. Khả thi trong luồng tạo trận và bảng sẵn sàng

- **Xem trước:** một endpoint đọc, không ghi, nhận `fighterId`, `weightClassCode`, `weighInAt`, `boutAt`, `rulesetId`, quyền `bout:create`, trả kết quả của mục 2. Form tạo trận hiện trạng thái đỏ **trước khi lưu**. Tên: Q3.
- **Khi lưu:** `createBout` vẫn lưu được và trả cảnh báo R31 trong cùng mảng `warnings` mà T-007 mục 6 thêm vào (mã: Q3). T-007 và T-029 cùng sửa `createBout`; ai merge trước tạo field `warnings`, người sau thêm mã. Không đụng `updateBout`, `resolveWeightClass`.
- **Bảng sẵn sàng (R32):** nối hàm mục 2 vào bộ lọc "hạng cân (kg) và ngày thi dự kiến" của `GET /readiness` (T-007 mục 5 chừa chỗ). Nếu T-007 chưa merge thì làm mục này sau.

### 4. Nhắc nhập cân hôm nay (T0, chỉ trong `FIGHT_WEEK`)

Hàm thuần `computeWeighInReminder` cạnh `computeWeightTrack`. Đầu vào: `status` của trận, `today` (ngày học viện), các điểm cân theo ngày (`buildDailyWeightPoints`). Không đọc `boutAt` hay `weighInAt` ngoài việc trạng thái trận đã quyết định.

- Chỉ nhắc khi `status = FIGHT_WEEK`. `SCHEDULED`, `CAMP`, `WEIGHED_IN`, `COMPLETED`, `CANCELLED`: không nhắc.
- `g` = số ngày học viện từ ngày có cân gần nhất đến `today`. Chưa có cân nào: mức `ASK_TODAY`.

| `g` | Mức | Mã nội dung (text do frontend dịch) |
| --- | --- | --- |
| 0 | Không nhắc | Hôm nay đã có cân |
| 1 | `ASK_TODAY` | "Hôm nay bạn chưa cập nhật số cân, hãy cập nhật ngay" |
| ≥ 2 | `YESTERDAY_MISSING` | "HÔM QUA BẠN CHƯA CẬP NHẬT SỐ CÂN, HÃY CẬP NHẬT NGÀY HÔM NAY ĐỂ TRACKING" |

- Không có mức XÁM/`STALE` riêng; không đụng `WEIGHT_STALE_DAYS`.
- Nhắc luôn hướng tới hôm nay, không có nhập bù, không có nút "hôm nay không cân".
- Ranh giới nửa đêm theo `Asia/Ho_Chi_Minh` (dùng `academyDateOf`).
- Đầu ra thêm vào `GET /bouts/:id` (cả bản võ sĩ xem): `weightReminder` (tên và hình dạng: Q3). Không thêm thông báo, không job nền. Dùng chung hàm này cho thẻ HLV (mục 5) và app võ sĩ (phần B2, việc của Fon).

### 5. Thẻ "Việc cần làm" của HLV

Tính khi đọc, không job nền, không gửi thông báo. Mỗi nguồn là một provider độc lập trả danh sách `{ source, phase, fighterId, boutId?, ... }`; nguồn chưa có dữ liệu trả mảng rỗng, thẻ không lỗi. Phạm vi: HLV chỉ thấy việc của võ sĩ được phân công (kiểm tra trong service), Admin thấy toàn CLB. Gom dữ liệu theo lô, tránh N+1. Tên endpoint: Q3.

| Giai đoạn | Việc | Quy tắc | Nguồn trong code (đã kiểm tra 24/10) | Sẵn sàng? |
| --- | --- | --- | --- | --- |
| Trước | Hồ sơ còn thiếu (≤ 14 ngày đến hạn nộp), hồ sơ trễ hạn | R11 | `gate1`, `requirementsDueOn`, `requirementsOverdue` trong `buildDetail` | Có |
| Trước | Cân vàng, đỏ, xám | R7 | `computeWeightTrack` (sau mục 1, trận từ `WEIGHED_IN` không còn màu) | Có |
| Trước | Chiến thuật chưa có buổi tập | R14 | `tacticsWithoutSessions` trong `buildDetail` (T-010 đã merge) | Có |
| Trước | Đủ điều kiện vào tuần thi đấu | R16 | `canEnterFightWeek` | Có |
| Trong | Hôm nay cân chính thức | R17 | Trận `FIGHT_WEEK` mà hôm nay (ngày học viện) = ngày của `weigh_in_at` | Có (T-006 đã merge) |
| Trong | Đã qua ngày thi mà chưa có kết quả | R26 | Trận chưa `COMPLETED`/`CANCELLED` mà hôm nay > ngày của `bout_at` | Có (T-006 đã merge) |
| Trong | **Chưa nhập cân hôm nay (mới)** | T0 | Mục 4, chỉ mức `YESTERDAY_MISSING` (nhắc từng ngày nằm ở app võ sĩ) | Làm |
| Sau | Buổi tập xung đột với đình chỉ chưa xử lý | R28 | T-007 mục 4 | Chờ T-007 |
| Sau | Đình chỉ chờ xác nhận được tập lại | S3 | T-007 mục 1 (`AWAITING_CLEARANCE`, xuất hiện từ `ends_on + 1`) | Chờ T-007 |
| Sau | Cân nhắc đình chỉ thủ công | R27, H6 | Phụ thuộc cảnh báo R24 (T-010 giai đoạn sau). Hiện trả mảng rỗng | Không |

Thiếu nguồn nào thì provider đó trả `[]`; không làm hỏng các nguồn còn lại. Nút "Đã trao đổi" và thống kê tuân thủ "X/Y ngày" **không làm**.

## Ngoài phạm vi

- Frontend và điện thoại (phần B): form tạo trận, thẻ trên dashboard, nhắc trên app võ sĩ, i18n `weightStatus.*`.
- Đổi `WEIGHT_STALE_DAYS`, ngưỡng 8% / 5%, mốc theo WBC.
- Job nền và thông báo `BOUT_WEIGHT_MISSING` (chỉ đã có giá trị enum từ T-007).
- `updateBout`, `resolveWeightClass` (của Dan).
- Nhập cân bù ngày cũ (`measuredAt` tùy chọn ở `fighters.model.ts:154` là chuyện khác, không đổi).

## Chờ chủ dự án xác nhận (stop-and-ask)

Ken **không code** phần phụ thuộc cho tới khi có trả lời. Tên là gợi ý của Claude, chưa có trong Tech spec.

| # | Câu hỏi | Gợi ý |
| --- | --- | --- |
| Q1 | **Đã chốt 24/10 (chủ dự án), làm xong trong slice 1:** đổi tên `weight.status` từ tên màu sang ý nghĩa, frontend tự ánh xạ màu | `GREEN→ON_TRACK`, `YELLOW→ABOVE_TARGET`, `RED→OVER_LIMIT`, `GREY→NOT_WEIGHED`, thêm `NEUTRAL` (từ `WEIGHED_IN`, `COMPLETED`, `CANCELLED` trở đi: không đánh giá). Màu: xanh, vàng, đỏ, xám, không màu |
| Q2 | **Đã chốt 24/10: phương án B.** Khả thi khi `D > A` (còn xa ngày cân) | **Phương án B:** chỉ tô màu khi `D <= A` như tài liệu R31 và ví dụ 60 kg / 66 kg; khi `D > A` chỉ trả `remainingPct` và nhãn "Chưa đến cửa sổ cấp tính", không màu. **Phương án A:** mô hình trượt theo tuần của module 04 (`capGreen = min(L + 1,0 × w, 15)`, `capYellow = L + 1,5 × w`, `w = (D − A) / 7`). Mô hình A là [SUY RA], không có tài liệu công bố, lỏng hơn WBC ở 14 và 7 ngày; tô màu đỏ/vàng cho trận còn hàng tuần dựa trên một công thức tự đặt có thể gây áp lực sai cho võ sĩ |
| Q3 | **Đã chốt 24/10: dùng đúng các tên bên cạnh.** Tên mới: (a) endpoint xem trước khả thi `GET /bouts/feasibility`; (b) mã cảnh báo `WEIGHT_AT_RISK`, `WEIGHT_INSUFFICIENT_DATA` trong `warnings` của `createBout`; (c) field `weightReminder: { active, level, daysSinceLastWeight, messageCode }`, level `ASK_TODAY` / `YESTERDAY_MISSING`, messageCode tương ứng; (d) endpoint thẻ `GET /coach/todo` và mã nguồn việc (`source`) | Dùng đúng các tên trên |

## Tiêu chí nghiệm thu

Hàm thuần (`bouts.model.spec.ts`; các test hiện có của `computeWeightTrack` không đổi):

1. Mục 1: trận `WEIGHED_IN` với số cân 66 kg tự ghi ngày thi và giới hạn 60 kg, ngưỡng 8%: **không ĐỎ** (theo Q1); `points` còn nguyên. Cùng dữ liệu với trận `FIGHT_WEEK` vẫn ĐỎ. `COMPLETED`, `CANCELLED`: không màu.
2. Mục 2: `D <= A`, giới hạn 60 kg, L = 8, còn 2 ngày, 66 kg: `remainingPct` 9,09 ĐỎ, 64,5 kg: 6,98 XANH; cân dưới hạng cân: `remainingPct` 0, XANH; không có cân trong 7 ngày (hoặc 8 ngày trước): `INSUFFICIENT_DATA`; ranh giới `D = A`. Phần `D > A`: theo Q2.
3. Mục 4: `FIGHT_WEEK`, cân hôm qua có, hôm nay chưa: `ASK_TODAY`; cân gần nhất cách 2 ngày: `YESTERDAY_MISSING`; nhập cân hôm nay: không nhắc; chưa có cân nào: `ASK_TODAY`; `SCHEDULED`, `CAMP`, `WEIGHED_IN`, `COMPLETED`, `CANCELLED`: không nhắc kể cả ngày thi; ranh giới nửa đêm `Asia/Ho_Chi_Minh`; `WEIGHT_STALE_DAYS` vẫn 3.

Service và API (`bouts.service.spec.ts`, spec của module thẻ việc, controller spec):

4. `GET /bouts/:id` trả `weightReminder`; bản võ sĩ xem cũng có. `GET /bouts/:id/weight-track` ở `WEIGHED_IN` không đỏ.
5. Mục 3: giới hạn 60 kg, L = 8, cân sau 2 ngày, 66 kg ghi hôm qua: preview trả ĐỎ và phần phải giảm 9,1%; `createBout` vẫn lưu được và có cảnh báo; không có cân trong 7 ngày: `INSUFFICIENT_DATA` / cảnh báo thiếu dữ liệu, vẫn lưu được. `updateBout`, `resolveWeightClass` không đổi.
6. Mục 5: trận `CAMP`, Cổng 1 đạt, hôm nay đúng ngày cân − 7: có dòng "Đủ điều kiện vào tuần thi đấu". Thiếu nguồn T-007 (hoặc T-010): thẻ vẫn trả kết quả, không lỗi. HLV không thấy việc của võ sĩ không được phân công; Admin thấy tất cả. Mỗi nguồn có test độc lập. Đình chỉ KO kết thúc ngày D: dòng "Chờ xác nhận được tập lại" xuất hiện ngày D + 1, không phải D (sau khi T-007 merge).
7. Hôm nay cân chính thức (R17) và đã qua ngày thi chưa có kết quả (R26) có dòng tương ứng; trận `COMPLETED`/`CANCELLED` không có dòng nào.

Không có migration nên không thêm ca vào `scripts/test-migrations.mjs`; `test:db` và `db:check` phải vẫn qua.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nestjs-api lint
pnpm --filter nestjs-api build
pnpm --filter nestjs-api test
pnpm --filter nestjs-api test:db
pnpm --filter nestjs-api db:check
```

Không lệnh nào được thêm lỗi so với [baseline](./BASELINE.md). Dán nguyên văn phần cuối output vào `docs/tickets/T-029-HANDOVER.md` theo mẫu ở mục 6 của [TEAM-WORKFLOW](../TEAM-WORKFLOW.md).

## Ghi chú cho người thực hiện

- Module mẫu: `src/bouts/` (đọc `computeWeightTrack`, `buildDailyWeightPoints`, `loadWeightTrack`, `buildDetail`, `resolveListScope`, `assertReadAccess` trước). Ngày luôn là ngày học viện (`academyDateOf`), không dùng `toISOString().slice(0, 10)`.
- "Lệch so với ticket" trong handover phải ghi: hàm R31 mới thay vì dùng lại `computeWeightTrack` (mẫu ở README modules); việc sửa `computeWeightTrack` để nhận `boutStatus`; mọi tên đã chốt ở Q1 đến Q3; cửa sổ nhắc cân đổi từ "`CAMP` tới hết ngày thi" của module 07 sang `FIGHT_WEEK`.
- Báo Dan trước khi sửa `bouts.service.ts` và `bouts.model.ts`; báo Hoàng Anh và Fon khi contract đổi (`weight.status` có giá trị mới, `weightReminder`, `warnings`, endpoint mới).
- Thấy lệch giữa ticket và code thì ghi vào mục "Câu hỏi" của handover, không đoán.
