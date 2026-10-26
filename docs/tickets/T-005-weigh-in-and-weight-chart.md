# T-005 · Màn ghi cân và trang trận của võ sĩ; biểu đồ cân

| | |
| --- | --- |
| **Trạng thái** | READY (phần A và B bắt đầu được ngay; bước tích hợp chờ T-004 merge) |
| **Phần** | Frontend (`nextjs-frontend`), chia hai phần cho hai người |
| **Người nhận (đề xuất)** | Phần A: MW (dev mobile, làm web cho điện thoại). Phần B: FE |
| **Nhánh** | A: `feat/T-005a-fighter-weigh-in`. B: `feat/T-005b-weight-chart`. Cả hai tạo từ `fight-camp` |
| **Hạn** | Merge trước hết ngày **18/10**, để kịp dựng demo cho review 2 ngày 20/10 (T-008a) |
| **Ước lượng** | A: 1,5 ngày. B: 1 ngày |
| **Tài liệu dẫn chiếu** | [Luồng nghiệp vụ F3](../FIGHT-CAMP-BUSINESS-FLOWS.md#f3-ghi-cân-hằng-ngày-và-cảnh-báo), [Tech spec §5](../FIGHT-CAMP-TECH-SPEC.md#5-cảnh-báo-cân-nặng), [T-003 §3](./T-003-bouts-core.md) (contract `weight-track`), [T-004](./T-004-coach-bouts-ui.md) (kiểu, service, demo), [frontend-architecture.md](../../nextjs-frontend/docs/frontend-architecture.md) |

## Bối cảnh

Võ sĩ ghi cân mỗi sáng trên điện thoại; app so số cân với giới hạn hạng cân và báo xanh / vàng / đỏ / xám. HLV nhìn xu hướng trên biểu đồ. Đây là kịch bản 1 của demo ở review 2: "võ sĩ ghi cân → cân chuyển đỏ".

Backend không cần sửa trong ticket này:

- Ghi cân dùng endpoint có sẵn `POST /fighters/:id/measurements` (body `{ weightKg, measurementContext: "SELF_REPORTED" }`, schema `createMeasurementSchema` trong `nestjs-api/src/fighters/fighters.model.ts`). Quyền `fighter.measurement:write` cho FIGHTER được cấp trong migration 024 của T-003. Trước khi T-003 merge, API mode sẽ trả 403; demo mode không bị ảnh hưởng.
- Số cân, đường tham chiếu và trạng thái lấy từ `GET /bouts/:id/weight-track` của T-003: `{ limitKg, points: [{ date, kg }], latestKg, latestOn, remainingPct, status, referencePath: [{ date, kg }] }`.
- Ghi hai lần trong một ngày **không** cần gọi endpoint supersede: `points` của T-003 chỉ lấy bản mới nhất trong mỗi ngày học viện.
- `fighterId` của võ sĩ đăng nhập là `user.profileId`, như `src/app/(app)/fighter/dashboard/page.tsx` đang dùng với `requireFighterAccess`.

**Phụ thuộc T-004** (Gemini đang làm): kiểu `Bout`, `WeightTrack`, service `src/lib/services/bouts.ts` / `bouts.demo.ts`, hàm `listBouts`, `getBout`, `getWeightTrack`, badge trạng thái cân. Phần nào không cần T-004 thì làm trước; khi T-004 merge, merge `fight-camp` vào nhánh của mình rồi nối vào. Nếu kiểu `WeightTrack` của T-004 thiếu `limitKg` hoặc `points`, bổ sung theo T-003 §3 và ghi vào handover.

## Phần A · Màn của võ sĩ (MW)

1. **Routes** trong `src/lib/routes.ts`: `fighter.bout` = `/fighter/bout`, `fighter.weighIn` = `/fighter/bout/weigh-in`.
2. **Menu:** thêm mục "Bout" vào `NAVIGATION.fighter` (`src/components/layout/navigation.ts`), ngay sau "Today", icon từ `lucide-react`. Cập nhật test thứ tự trong `navigation.test.ts`.
3. **Service ghi cân:** hàm `recordSelfWeight(fighterId, weightKg)` trong `src/lib/services/people.ts`, gọi `POST /fighters/:id/measurements` với `measurementContext: "SELF_REPORTED"`. Bản demo ghi vào **cùng kho dữ liệu cân** mà `bouts.demo.ts` của T-004 dùng để tính `getWeightTrack`, để số mới hiện ngay trên biểu đồ và badge. Server action tương ứng trong `src/lib/actions/`.
4. **Trang `/fighter/bout/weigh-in`** (ưu tiên điện thoại):
    - Một ô số kg, `inputMode="decimal"`, tự focus, nhận cả `66,5` và `66.5`, giới hạn 30–200 kg, bước 0,1. Mặc định là hôm nay; không có ô ngày giờ.
    - Nút "Save" cao ít nhất 44 px.
    - Lưu xong thì chuyển về `/fighter/bout` và hiện thông báo kèm trạng thái mới, ví dụ "Saved 66.0 kg. Status: Red".
    - Võ sĩ không có trận đang chạy vẫn ghi được cân; khi đó chuyển về `/fighter/dashboard`.
5. **Trang `/fighter/bout`:** trận đang chạy của võ sĩ, tức trận đầu tiên theo `weighInAt` ở `SCHEDULED`, `CAMP`, `FIGHT_WEEK` hoặc `WEIGHED_IN`.
    - Đầu trang: giải, đối thủ (hoặc "Opponent TBA"), hạng cân (kg), ngày giờ cân và thi đấu, số ngày còn đến ngày cân.
    - Thẻ Weight: số cân mới nhất và ngày, phần trăm còn phải giảm, badge trạng thái, nút "Log weight" dẫn tới trang ghi cân. Khi đỏ thì hiện câu khuyến nghị của F3 (giống T-004). Có biểu đồ `WeightChart` của phần B khi phần B đã merge.
    - Thẻ Medical documents, chỉ đọc: "n of m ready" và danh sách tên mục kèm trạng thái. Không có nút sửa (võ sĩ không cập nhật hồ sơ).
    - Không có trận nào: `EmptyState` "No upcoming bout", kèm nút "Log weight".
6. **Dashboard võ sĩ:** khi có trận đang chạy, thêm một thẻ ở đầu `src/app/(app)/fighter/dashboard/page.tsx` gồm badge trạng thái cân và nút "Log today's weight". Không sửa `FightHero` và `weightCheck` hiện có (xem Ngoài phạm vi).
7. `loading.tsx` cho hai trang mới.

## Phần B · Biểu đồ cân (FE)

1. **Hàm thuần** `weightChartData(track, from, to)` trong `src/lib/domain/weight-chart.ts`, có test `weight-chart.test.ts`:
    - `labels`: mọi ngày học viện từ `from` đến `to`, gồm cả hai đầu. `from` là ngày của điểm đầu tiên, hoặc ngày đầu của `referencePath` nếu chưa có điểm nào; `to` là ngày cân.
    - Series "Weight": giá trị của `points`, ngày không có số thì `null` (biểu đồ để trống, không nối).
    - Series "Reference": giá trị của `referencePath`, ngày không có thì `null`.
    - `target` của `LineChart` = `{ value: limitKg, label: "Limit" }`.
2. **Component** `WeightChart` trong `src/components/domain/weight-chart.tsx`, dùng `LineChart` có sẵn (`src/components/charts/line-chart.tsx`, prop `series`, `labels`, `target`, `valueSuffix: " kg"`, `decimals: 1`). Không cài thư viện biểu đồ mới. `ariaLabel` có giới hạn, số mới nhất và trạng thái.
3. **Chi tiết trận của HLV** (`/coach/bouts/[boutId]`, trang của T-004): thêm `WeightChart` vào thẻ Weight.
4. **Dashboard HLV** (`src/app/(app)/coach/dashboard/page.tsx`): thẻ "Weight alerts" liệt kê trận đang chạy có trạng thái cân `RED`, `YELLOW` hoặc `GREY`, đỏ trước rồi vàng rồi xám, mỗi dòng dẫn tới chi tiết trận. Lấy dữ liệu từ cùng nguồn mà danh sách `/coach/bouts` của T-004 dùng cho badge cân. Không có trận nào cần chú ý thì ẩn thẻ.

## Ngoài phạm vi

- Backend, migration (quyền ghi cân nằm ở T-003).
- HLV ghi cân hộ võ sĩ: `createMeasurement` chưa kiểm tra phân công HLV, nên chưa cấp quyền cho COACH.
- Câu hỏi "ăn theo kế hoạch?" và chấm màu ăn uống (T-009).
- Cân chính thức (T-006).
- Thông báo.
- Sửa `FightHero`, `weightCheck` hay `FAST_CUT_KG_PER_WEEK` trên dashboard võ sĩ (các phần này dùng hạng cân enum cũ; ghi vào handover nếu chúng hiển thị mâu thuẫn với thẻ mới).

## Tiêu chí nghiệm thu

Phần A:

1. Ở demo mode, đăng nhập võ sĩ của trận đang đỏ trong dữ liệu mẫu của T-004: menu có "Bout"; `/fighter/bout` hiện đúng giải, hạng cân và badge đỏ.
2. Ghi 66,5 (dấu phẩy) → lưu thành 66,5 kg, quay về `/fighter/bout`, số mới nhất là 66,5, badge tính lại.
3. Ghi hai lần trong cùng ngày (66,5 rồi 66,1) → thẻ Weight và biểu đồ chỉ có một điểm cho hôm nay, là 66,1.
4. Nhập 0, 250 hoặc chữ → báo lỗi tại ô, không gửi.
5. Võ sĩ không có trận nào → `EmptyState`, ghi cân vẫn được.
6. Ở bề rộng 390 px: không cuộn ngang; từ dashboard đến lúc lưu xong chỉ cần bấm vào thẻ, nhập số, bấm Save (bấm giờ ≤ 30 giây, ghi kết quả vào handover).
7. Ở API mode, `recordSelfWeight` gửi đúng `POST /fighters/{profileId}/measurements` với `measurementContext: "SELF_REPORTED"` (test service với fetch giả lập).

Phần B:

8. `weight-chart.test.ts`: `points` có ngày bị thiếu → giá trị `null` đúng ngày đó; `labels` liên tục từ `from` đến ngày cân; không có điểm nào → series "Weight" toàn `null` nhưng vẫn có "Reference".
9. Chi tiết trận của HLV hiện biểu đồ có đường cân, đường tham chiếu và đường giới hạn; di chuột hoặc dùng phím mũi tên thấy giá trị từng ngày.
10. Dashboard HLV ở demo mode: thẻ "Weight alerts" có trận đỏ của dữ liệu mẫu, đứng trước các trận vàng và xám.

Chung:

11. Handover ghi rõ những gì đã đối chiếu với backend thật (sau khi T-003 merge) và những gì chưa.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```

Tiêu chí 1–6, 9, 10 kiểm tra bằng tay ở demo mode (`pnpm --filter nextjs-frontend dev`). Tắt dev server sau khi kiểm tra xong. Handover riêng cho từng phần: `T-005a-HANDOVER.md`, `T-005b-HANDOVER.md`.
