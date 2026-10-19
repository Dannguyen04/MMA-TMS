# T-005 Handover

- Nhánh: `feat/T-005-weigh-in-and-chart`. Commit: `0b020b4`, `8b03e4f` (tạo từ `feat/T-004-coach-bouts-ui` ở `600101a`)
- Người làm: Claude, theo chỉ định của chủ dự án ngày 19/10 (chỉ áp dụng cho hôm nay; quy tắc trong `CLAUDE.md` giữ nguyên). Gemini đọc chéo code này.
- Trạng thái: IN REVIEW

## Thay đổi

Phần A, màn của võ sĩ:

- `src/lib/routes.ts`: thêm `fighter.bout` = `/fighter/bout` và `fighter.weighIn` = `/fighter/bout/weigh-in`.
- `src/components/layout/navigation.ts`: thêm mục "Bout" (icon `Swords`) ngay sau "Today" trong menu võ sĩ. `navigation.test.ts` cập nhật thứ tự ở hai chỗ.
- `src/lib/domain/weigh-in.ts` (mới) và `weigh-in.test.ts`:
  - `parseWeightKg`: nhận cả dấu phẩy lẫn dấu chấm, làm tròn 0,1 kg, giới hạn 30–200 kg.
  - `activeBout`: trận đang chạy là trận có ngày cân sớm nhất trong các trạng thái `SCHEDULED`, `CAMP`, `FIGHT_WEEK`, `WEIGHED_IN`.
  - `weightAlerts`: lọc và sắp cho thẻ cảnh báo của phần B.
  - `WEIGHT_SAVED_NOTICE`.
- `src/lib/services/people.ts`: hàm `recordSelfWeight(fighterId, weightKg)`.
  - API mode gọi `POST /fighters/:id/measurements` với body `{ weightKg, measurementContext: "SELF_REPORTED" }`. Lỗi 403 (backend chưa cấp quyền) trả về câu báo lỗi, không ném lỗi.
  - Demo mode push vào `db().boutMeasurements`, đúng kho mà `bouts.demo.ts` đọc (theo handover T-004), và cập nhật `fighter.weightKg`.
  - Test thêm vào `people.test.ts`: request ở API mode, lỗi 403, và ghi vào kho demo.
- `src/lib/actions/weigh-in.ts` (mới): `recordSelfWeightAction`.
  - Chỉ võ sĩ có `profileId` mới gọi được. Kiểm tra lại số bằng `parseWeightKg`.
  - Ghi xong, revalidate 4 trang, rồi redirect về `/fighter/bout?notice=weight-saved`, hoặc về `/fighter/dashboard` nếu võ sĩ không có trận đang chạy.
- `src/app/(app)/fighter/bout/weigh-in/` (mới): `page.tsx`, `weigh-in-form.tsx`, `loading.tsx`.
  - Ô nhập dùng `inputMode="decimal"` và `autoFocus`.
  - Form kiểm tra số phía client trong `prepare`, nên số sai không được gửi đi.
  - Nút Save dùng `size="lg"`, cao 44 px.
- `src/app/(app)/fighter/bout/` (mới): `page.tsx`, `loading.tsx`.
  - Đầu trang: giải, đối thủ, giới hạn kg, trạng thái, đếm ngược.
  - Thẻ Weight: badge, số mới nhất kèm ngày, % còn phải giảm, câu khuyến nghị khi đỏ, `WeightChart`, nút "Log weight".
  - Thẻ "Fight details" và thẻ "Medical documents" (chỉ đọc, "n of m ready").
  - Toast "Saved x kg / Status: …" sau khi ghi cân.
  - Hiện `EmptyState` "No upcoming bout" khi võ sĩ không có trận.
- `src/app/(app)/fighter/dashboard/page.tsx` và `weigh-in-prompt.tsx` (mới):
  - Khi có trận đang chạy, thêm một thẻ ở đầu trang gồm tên giải, badge cân và nút "Log today's weight".
  - Đọc `listBouts` song song với các lần đọc khác, bọc trong `nullIfServiceFails` để trang vẫn hiện khi service trận lỗi.
  - Thêm toast cho `?notice=weight-saved`.
  - Không sửa `FightHero` và `weightCheck`.

Phần B, biểu đồ cân:

- `src/lib/domain/weight-chart.ts` (mới) và `weight-chart.test.ts`:
  - `weightChartRange(track, weighInDay)`: tính khoảng ngày của biểu đồ.
  - `weightChartData(track, from, to)` trả `days`, `labels`, `weight`, `reference` và `target` (`{ value: limitKg, label: "Limit" }`).
- `src/components/domain/weight-chart.tsx` (mới): `WeightChart`, dùng `LineChart` có sẵn.
  - Series "Weight" màu `--chart-1`, series "Reference" màu `CHART_MUTED`.
  - `valueSuffix: " kg"`, `decimals: 1`.
  - `ariaLabel` gồm giới hạn, số mới nhất và trạng thái.
- `src/app/(app)/coach/bouts/[boutId]/bout-weight-card.tsx`: thành async component, tự gọi `getWeightTrack(bout.id)` (bọc `nullIfServiceFails`) rồi vẽ `WeightChart` dưới 4 ô số. Nhờ vậy không phải sửa `page.tsx` của T-004.
- `src/app/(app)/coach/dashboard/page.tsx` và `weight-alerts-card.tsx` (mới):
  - Thẻ "Weight alerts" nằm ở cột phải, trên "Today's schedule".
  - Dữ liệu lấy từ `listBouts({ fighterIds: scope })`, cùng nguồn với badge của `/coach/bouts`, rồi qua `weightAlerts`.
  - Thứ tự: đỏ, rồi vàng, rồi xám. Ẩn thẻ khi không có trận nào cần chú ý.

## Đối chiếu tiêu chí nghiệm thu

Kiểm tra tay ở demo mode trên `next dev -p 3105` trong worktree này, chạy Playwright với Edge. Script nằm trong scratchpad của Claude, không commit. Tài khoản: võ sĩ `u-minh-tran`, HLV `u-rafael-costa`.

| # | Tiêu chí | Kết quả | Đáp ứng ở đâu / bằng chứng |
| --- | --- | --- | --- |
| 1 | Võ sĩ của trận đỏ: menu có "Bout"; `/fighter/bout` đúng giải, hạng cân, badge đỏ | Đạt | `navigation.ts`, `fighter/bout/page.tsx`. Trang hiện "Saigon Warriors MMA 04", "60.0 kg", badge "Exceeds cut limit" |
| 2 | Ghi 66,5 → 66,5 kg, về `/fighter/bout`, badge tính lại | Đạt | Từ dashboard, bấm thẻ, nhập "66,5", Save → `/fighter/bout`; toast "Saved 66.5 kg · Status: Exceeds cut limit"; số mới nhất 66.5 kg |
| 3 | Ghi hai lần trong ngày (66,5 rồi 66,1) → một điểm cho hôm nay, là 66,1 | Đạt | Số mới nhất 66.1 kg; tooltip biểu đồ có một giá trị cho 19/10. Phần gom theo ngày nằm ở `computeWeightPoints` của T-004 |
| 4 | Nhập 0, 250, chữ → lỗi tại ô, không gửi | Đạt | `parseWeightKg` gọi trong `prepare`. Cả ba lần vẫn ở `/fighter/bout/weigh-in`, lỗi tại ô "Enter a weight between 30 and 200 kg." / "Enter a number, for example 66.5." Test: `weigh-in.test.ts` |
| 5 | Không có trận → `EmptyState`, vẫn ghi cân được | Đạt | Đăng nhập `u-tariq-haddad`: `/fighter/bout` hiện "No upcoming bout" kèm "Log weight". Ghi 77,2 → về `/fighter/dashboard`, toast "Weight saved" |
| 6 | 390 px không cuộn ngang; từ dashboard đến lúc lưu ≤ 30 giây | Đạt | `scrollWidth = innerWidth = 390` ở `/fighter/bout` và `/fighter/bout/weigh-in`. Ba thao tác: bấm thẻ, nhập số, Save. Chạy tự động mất 1,9 giây; người bấm chưa đo |
| 7 | API mode gửi đúng `POST /fighters/{profileId}/measurements` với `SELF_REPORTED` | Đạt | `people.test.ts` › "posts a self-reported weigh-in for the fighter's own profile in API mode" |
| 8 | `weight-chart.test.ts`: ngày thiếu thì null; nhãn liên tục; không có điểm nào thì Weight toàn null, vẫn có Reference | Đạt | `weight-chart.test.ts` (8 test) |
| 9 | Chi tiết trận của HLV có đường cân, tham chiếu, giới hạn; xem giá trị bằng chuột hoặc phím | Đạt | `bout-weight-card.tsx`. `aria-label` "Weight trend: limit 60.0 kg, latest 66.1 kg, status Exceeds cut limit."; phím ← đọc "20 Oct: Weight No data, Reference 60.7 kg" |
| 10 | Dashboard HLV: "Weight alerts" có trận đỏ, đứng trước vàng và xám | Đạt | Thẻ có Minh Trần (đỏ). Seed không có trận vàng hay xám nên thứ tự chỉ kiểm tra bằng `weigh-in.test.ts` › `weightAlerts` |
| 11 | Ghi rõ đã và chưa đối chiếu với backend thật | Xem dưới | |

**Đối chiếu backend thật (tiêu chí 11):** chưa có. T-003 chưa có nhánh, nên `GET /bouts*` và `weight-track` chưa tồn tại. Migration 024, nơi cấp quyền `fighter.measurement:write` cho FIGHTER, cũng chưa có. Ở API mode, ghi cân sẽ nhận 403 và hiện câu báo lỗi; các trang dùng `listBouts` coi như không có trận.

## Lệnh đã chạy

Chạy trên `8b03e4f`, working tree sạch.

```text
$ pnpm --filter nextjs-frontend lint
$ eslint
lint exit 0

$ pnpm --filter nextjs-frontend typecheck
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully

$ pnpm --filter nextjs-frontend test
 Test Files  73 passed | 1 skipped (74)
      Tests  629 passed | 1 skipped (630)
```

## Lệch so với ticket

1. Làm một nhánh `feat/T-005-weigh-in-and-chart` cho cả hai phần, thay vì hai nhánh `T-005a`/`T-005b`, và chỉ có một handover. Lý do: một người làm cả hai phần trong một ngày, và phần A dùng `WeightChart` của phần B.
2. Nhánh tạo từ `feat/T-004-coach-bouts-ui` (`600101a`), không tạo từ `fight-camp`, vì T-005 cần kiểu và service của T-004. Phải merge T-004 vào `fight-camp` trước rồi mới merge nhánh này.
3. Series "Reference" nối thẳng giữa các mốc của `referencePath`, thay vì để `null` ở ngày không có mốc. Lý do: theo Tech spec §5, `referencePath` là đường gấp khúc qua 3 mốc (đầu camp, ngày cân − A, ngày cân). Để `null` giữa các mốc thì biểu đồ chỉ còn 3 chấm rời. Ngoài khoảng của đường tham chiếu vẫn là `null`.
4. `weightChartData` trả thêm `days` (khoá ngày `YYYY-MM-DD`); `labels` là nhãn hiển thị ("19 Oct").
5. Toast ở trang ghi cân dùng nhãn trạng thái có sẵn ("Exceeds cut limit"), không dùng chữ "Red" như ví dụ trong ticket.

## Câu hỏi / việc còn mở

- Tiêu chí 6: chưa bấm giờ bằng tay trên điện thoại thật.
- Tiêu chí 11: chờ T-003.
