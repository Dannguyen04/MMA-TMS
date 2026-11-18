# T-065 Handover: dashboard HLV, sửa 4 gợi ý review và polish

- Nhánh: `User_Feature`, HEAD vẫn là `8c901ab`. Không commit, không push, không tạo nhánh.
- Ngày: 10/11/2026.

## File đã sửa

| File | Thay đổi |
| --- | --- |
| `nextjs-frontend/src/app/(app)/coach/dashboard/coach-hero.tsx` | F1 (số ngày thô, cảnh báo lỡ cân), F2 (`suspensions` nhận `null`, câu "không tải được", ô số "—" kèm chữ ẩn), P3 (`focus-visible:outline-white` cho link "Tạo trận" trên nền hero), P4 (`break-words` cho tên giải) |
| `nextjs-frontend/src/app/(app)/coach/dashboard/page.tsx` | F3 (`active: true`), F2 (truyền `null` cho hero khi dịch vụ đình chỉ lỗi; `CoachTodoCard` vẫn nhận mảng) |
| `nextjs-frontend/src/app/(app)/coach/dashboard/coach-dashboard-visual.test.ts` | H2: bỏ trường hợp `bouts: null` (xem K1) |
| `nextjs-frontend/src/app/(app)/coach/dashboard/t065-coach-dashboard.test.ts` | File test mới: F1a, F1b, F1c, F2a, F2b, F2c, F3a |
| `nextjs-frontend/src/components/dashboard/today-schedule.tsx` | P3: nút "Lên lịch buổi tập" trong trạng thái trống cao tối thiểu 44px (`min-h-11`) |
| `nextjs-frontend/src/lib/services/bouts.ts` | F4: xoá `listWeightAlerts` và phần chỉ nó dùng |
| `nextjs-frontend/src/lib/i18n/messages/vi.ts`, `en.ts` | Thêm `coachToday.hero.weighInMissed`, `coachToday.hero.unavailable`, `coachToday.hero.statUnavailable` |
| `nextjs-frontend/src/lib/i18n/messages/coach-bouts.{vi,en}.ts`, `coach-today.{vi,en}.ts` | F4: xoá key thừa |

## F1 đến F3

- F1: `days = daysBetweenDates(today, weighInDay)`, không kẹp. `> 0`: số và "còn N ngày". `= 0`: số 0 và "hôm nay cân" hoặc "đã cân". `< 0`: không hiện số; `WEIGHED_IN` hiện "đã cân", phase khác hiện icon tam giác (`aria-hidden`) và "Chưa ghi cân chính thức" cùng kiểu chữ display của nhãn.
  - Icon: dùng `TriangleAlert` của lucide-react. `AlertTriangle` là tên cũ (alias) của cùng icon đó; `fight-hero.tsx` và `clearance-board.tsx` đều dùng `TriangleAlert`.
- F2: `bouts === null` hiện "Không tải được danh sách trận. Thử tải lại trang.", không có link "Tạo trận". Ô "Trận đang chạy" (khi `bouts === null`) và ô "Đang đình chỉ" (khi `suspensions === null`) hiện "—" kèm `<span class="sr-only">không tải được</span>`.
- F3: `listSuspensions(scope === "all" ? { active: true } : { fighterIds: scope, active: true }, user)`. Bản demo (`suspensions.demo.ts:89`) có xử lý `filter.active`; `activeSuspensionLines` vẫn lọc lại nên kết quả không đổi.

## F4: đã xoá, kèm bằng chứng grep

Grep trước khi xoá (từ `nextjs-frontend`, bỏ `node_modules`, `.next`, và các file message):

```
grep -rn "coachBouts.dashboard\|coachToday.newPlan\|listWeightAlerts" --exclude-dir=node_modules --exclude-dir=.next . | grep -v "src/lib/i18n/messages"
(không có kết quả)
grep -rn '`coachToday\.\${\|`coachBouts\.\${\|`coachBouts\.dashboard' --include=*.ts --include=*.tsx src
(không có kết quả, tức không có key ghép động)
grep -rn "WeightAlert" src   # trước khi xoá
src/lib/services/bouts.demo.test.ts:27,95  (listDemoWeightAlerts)
src/lib/services/bouts.demo.ts:580,586     (DemoWeightAlert, listDemoWeightAlerts)
src/lib/services/bouts.ts:35,139,141,154   (WeightAlert, listWeightAlerts)
```

Đã xoá:

- `bouts.ts`: `listWeightAlerts`, interface `WeightAlert`, hằng `STATUS_ORDER`, import `getFighter` và kiểu `WeightStatus` (chỉ `listWeightAlerts`/`STATUS_ORDER` dùng).
- Key i18n, ở cả `vi` và `en`: `coachBouts.dashboard.weightAlerts`, `weightAlertsHint`, `documentsDue`, `documentsDueHint`, `due`, `allBouts` (trong `coach-bouts.*.ts`), `coachToday.newPlan` (trong `coach-today.*.ts`).

Giữ lại, có lý do:

- `wayOffForBout`, `getWeightTrack`, `isRunningPhase`: còn chỗ dùng (`coach/bouts/[boutId]/page.tsx:83`, `fighter/bout/page.tsx:57`, `bouts.ts` nội bộ).
- `listDemoWeightAlerts`, `DemoWeightAlert` (`bouts.demo.ts`): `bouts.demo.test.ts:95` còn dùng, và `bouts.demo.ts` không nằm trong danh sách file được sửa.
- `coachToday.scheduleSession`: `today-schedule.tsx` vẫn dùng.

Sau khi xoá: `grep -rn "listWeightAlerts" nextjs-frontend/src` không có kết quả (exit 1).

## Test

Trước khi sửa code production (chạy file test mới trên code cũ):

```
     × F1a 13ms
     × F2a 3ms
     × F2b 1ms
     × F3a 616ms
 FAIL  ... > F1a  AssertionError: expected '<section aria-label="Các camp đang ch…' to contain 'Chưa ghi cân chính thức'
 FAIL  ... > F2a  AssertionError: expected '<section aria-label="Các camp đang ch…' to contain 'Không tải được danh sách trận'
 FAIL  ... > F2b  TypeError: Cannot read properties of null (reading 'length')
 FAIL  ... > F3a  AssertionError: expected "vi.fn()" to be called with arguments: [ …(2) ]
                  (lần gọi thật: { fighterIds: [...] }, không có active)
      Tests  4 failed | 3 passed (7)
```

F1b, F1c, F2c qua ngay trên code cũ, đúng ý ticket: đó là các ca "không đổi so với hiện nay". F1b qua vì code cũ kẹp về 0 và đã hiện "đã cân".

Sau khi sửa:

```
pnpm vitest run "src/app/(app)/coach/dashboard"
 Test Files  3 passed (3)
      Tests  38 passed (38)
```

K1: toàn bộ test cũ vẫn qua. Chỉ sửa H2 trong `coach-dashboard-visual.test.ts`: nó lặp `[[], null]` và đòi `bouts: null` hiện "Chưa có trận nào trong camp" kèm link "Tạo trận". Đó chính là hành vi F2 bỏ đi (F2a đòi ngược lại), nên H2 nay chỉ kiểm `bouts: []`. Trường hợp `null` do F2a kiểm.

## Lệnh kiểm tra (chạy từ `D:\MMA-TMS`)

```
pnpm --filter nextjs-frontend lint        -> eslint, exit 0, không lỗi/cảnh báo
pnpm --filter nextjs-frontend typecheck   -> next typegen && tsc --noEmit, không lỗi
pnpm --filter nextjs-frontend test        -> Test Files 125 passed | 1 skipped (126); Tests 1265 passed | 2 skipped (1267)
git diff -- nextjs-frontend/src/app/globals.css   -> rỗng
(từ nextjs-frontend) impeccable detect --json "src/app/(app)/coach/dashboard" src/components/dashboard/today-schedule.tsx
                                          -> []
```

`impeccable` không có trên PATH; đã chạy bằng script của plugin (`.../impeccable~g2/skills/impeccable/scripts/impeccable detect ...`), kết quả `[]`.

## Polish

- P1. Skeleton: đã đối chiếu `loading.tsx` với trang (header có eyebrow và 2 nút, hero 2 nửa, lưới 3 cột gồm thẻ việc, thẻ hàng chờ và lịch hôm nay, khối "Tuần này"). Khớp, không đổi.
- P2. Các ô số trong hero đã dùng `ReadinessCell`/`ReadinessNumber` như trang fighter. Ô "—" dùng cùng `ReadinessNumber`. Tiêu đề thẻ việc, lịch hôm nay và tuần này đều qua `CardHeader`. Không đổi gì thêm.
- P3. Nút "Lên lịch buổi tập" trong trạng thái trống của `TodaySchedule` (`size="sm"`, cao 32px) thêm `min-h-11`, giống các nút ở header trang. Các link khác đã có `min-h-11` hoặc là link phủ cả dòng. Link "Tạo trận" là phần tử duy nhất focus được trên nền hero xanh. Theo quyết định của lead (xem mục "Lượt bổ sung"), link này có thêm `focus-visible:outline-white`, vẫn giữ độ dày và offset của vòng focus chung. Không sửa `fight-hero.tsx`.
- P4. Tên giải trong hero thêm `break-words` để một từ rất dài không tràn ở 375px. Tên võ sĩ trong thẻ việc và lịch hôm nay đã có `truncate` và `min-w-0`.
- P5. Không còn import thừa hay comment nói về hai thẻ cảnh báo cân và hồ sơ trong các file của trang. Phần code thừa nằm ở `bouts.ts` và đã xoá ở F4.

Không có trình duyệt nên chưa kiểm bằng mắt ở 375px hay vòng focus thật.

## Lượt bổ sung: vòng focus trên nền hero

Lead quyết định cho Câu hỏi 1: chỉ sửa `coach-hero.tsx`, không đụng `fight-hero.tsx`.

- F2c có thêm một assertion: thẻ `<a>` có `href` tới `routes.coach.newBout` phải có class chứa `focus-visible:outline-white`.
- Chạy trên code gốc (HEAD `8c901ab`), F2c lỗi đúng ở assertion này:

  ```
  × F2c
  AssertionError: expected '<a class="mt-2 inline-flex min-h-11 w…' to match /class="[^"]*focus-visible:outline-whi…/
  ```

  Bản assertion đầu tiên dùng regex giả định `href` đứng trước `class`, nên vẫn lỗi cả khi đã có class. Tôi đổi cách tìm thẻ `<a>` để không phụ thuộc thứ tự thuộc tính; kết quả mong đợi giữ nguyên.
- Sửa: link "Tạo trận" có thêm `focus-visible:outline-white`. Trên nền hero chỉ link này focus được. `CardLink` "Tất cả võ sĩ" nằm ở nửa phải, trên nền `bg-surface`.
- Sau khi sửa, mọi lệnh đều qua:
  - lint: exit 0;
  - typecheck: exit 0;
  - test: `Test Files 125 passed | 1 skipped (126)`, `Tests 1265 passed | 2 skipped (1267)`;
  - impeccable detect: `[]`;
  - diff `globals.css`: rỗng.

## Câu hỏi

Không còn câu hỏi mở. Hai câu dưới đây đã có quyết định.

1. (Đã giải quyết: lead chọn `focus-visible:outline-white`, chỉ sửa trong `coach-hero.tsx`.) Vòng focus trên nền hero: `fight-hero.tsx` không có xử lý riêng, chỉ dựa vào `:focus-visible { outline: 2px solid var(--ring) }` trong `globals.css`. Ở theme sáng `--ring` là `#3b6be0` còn `--hero-bg` là `#1846c4`, hai màu xanh gần nhau nên vòng focus nhiều khả năng khó thấy (chưa đo). Tôi làm đúng như `fight-hero.tsx` và không thêm màu riêng. Nếu cần vòng focus rõ hơn trên hero, cả `fight-hero.tsx` lẫn `coach-hero.tsx` phải đổi, ví dụ `focus-visible:outline-white`. Việc này đụng file ngoài phạm vi và thêm giá trị màu, nên cần chủ dự án quyết.
2. (Đã giải quyết: lead chấp nhận `TriangleAlert`.) Ticket ghi icon `AlertTriangle`; tôi dùng `TriangleAlert`. Đây là cùng một icon (tên mới của lucide), và codebase đang dùng tên này. Nếu bắt buộc dùng đúng tên `AlertTriangle` thì báo lại.
