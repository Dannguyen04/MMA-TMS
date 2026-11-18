# T-065: Dashboard HLV, sửa 4 gợi ý review của T-062/T-064 và polish

- Trạng thái: đã tự kiểm 10/11 (lint, typecheck, 1265 test qua; detector sạch; globals.css không đổi), chờ review độc lập trước commit. Ngày: 10/11/2026.
- Nhánh: `User_Feature`, nhánh đang checkout. Không tạo nhánh mới. Chưa commit cho tới khi chủ dự án yêu cầu.
- Phạm vi: `nextjs-frontend`, chỉ đụng trang `/coach/dashboard` và các component của trang.
- Nguồn: review độc lập trước commit `3ab1b41` (ghi trong [T-062-REVIEW](./T-062-REVIEW.md) và [T-064-REVIEW](./T-064-REVIEW.md)), cộng với lệnh `/impeccable polish` của chủ dự án.

## Bốn lỗi phải sửa (đã kiểm là có thật)

### F1. Lỡ buổi cân nhưng hero vẫn báo "hôm nay cân"

`coach-hero.tsx:36` tính `days = Math.max(0, daysBetweenDates(...))`. Khi ngày cân đã qua mà trận chưa sang `WEIGHED_IN`, số bị kẹp về 0 và nhãn ghi "hôm nay cân", tức là báo sai.

Sửa: tính số ngày thô, không kẹp.

| Trường hợp | Cách hiện |
| --- | --- |
| Số ngày thô `> 0` | Như hiện nay: con số lớn và nhãn "còn N ngày" |
| Số ngày thô `= 0` | Như hiện nay: "hôm nay cân", hoặc "đã cân" nếu `phase === "WEIGHED_IN"` |
| Số ngày thô `< 0`, `phase === "WEIGHED_IN"` | Không hiện con số lớn, chỉ hiện nhãn "đã cân" |
| Số ngày thô `< 0`, phase khác | Không hiện con số lớn. Hiện cảnh báo `coachToday.hero.weighInMissed` (vi "Chưa ghi cân chính thức", en "Official weigh-in not recorded"), cùng kiểu chữ display của nhãn, kèm icon `AlertTriangle` (`aria-hidden`), để không báo chỉ bằng màu |

### F2. Dịch vụ lỗi nhưng hero trông như "trống"

Khi `bouts === null` (dịch vụ trận lỗi), hero hiện "Chưa có trận nào" và số trận bằng 0. Khi `listSuspensions` lỗi, trang đổi `null` thành `[]`, nên số đình chỉ hiện 0. Cả hai đều báo sai.

Sửa:

- `CoachHero` nhận `suspensions: ActiveSuspensionLine[] | null`. `page.tsx` truyền `null` khi dịch vụ đình chỉ lỗi. `CoachTodoCard` vẫn nhận `[]` như cũ.
- Khi `bouts === null`, phần trái hiện câu `coachToday.hero.unavailable`:
  - vi: "Không tải được danh sách trận. Thử tải lại trang."
  - en: "Couldn't load bouts. Try reloading the page."
  
  Không hiện link "Tạo trận".
- Ô số tương ứng hiện "—" thay cho số khi nguồn dữ liệu là `null`: ô "Trận đang chạy" khi `bouts === null`, ô "Đang đình chỉ" khi `suspensions === null`. Kèm chữ ẩn cho trình đọc màn hình `coachToday.hero.statUnavailable` (vi "không tải được", en "unavailable").

### F3. API mode: dòng đình chỉ biến mất khi vượt giới hạn phân trang

`page.tsx` gọi `listSuspensions` không lọc trạng thái. Hàm này kéo mọi đình chỉ rồi lọc ở client. Khi có hơn 500 đình chỉ, nó ném `PAGINATION_LIMIT_EXCEEDED`, `nullIfServiceFails` nuốt lỗi, và các dòng đình chỉ biến mất.

Sửa: truyền `active: true` (`SuspensionFilter.active`, `lib/services/suspensions.ts:161`). Ở backend, `active=true` (`nestjs-api/src/suspensions/suspensions.repo.ts:409-419`) trả các đình chỉ chưa được cho tập lại, đã bắt đầu, và hoặc chưa hết hạn hoặc đang cần xác nhận. Tập này chứa mọi đình chỉ `ACTIVE`, và `activeSuspensionLines` vẫn lọc lại. Kiểm tra bản demo `listSuspensions` có tôn trọng `active` không. Nếu không tôn trọng, kết quả vẫn đúng vì có lọc lại, nên không sửa demo. Với F2, lỗi còn lại hiện "—" thay vì 0.

### F4. Code và key thừa

Xoá những thứ không còn ai dùng. Trước khi xoá từng thứ, grep cả `src/**` lẫn test để chắc chắn:

- `listWeightAlerts` (`lib/services/bouts.ts`), cùng các helper hay kiểu dữ liệu chỉ nó dùng.
- Các key i18n mà dashboard cũ dùng và nay không còn nơi nào dùng: `coachBouts.dashboard.weightAlerts`, `weightAlertsHint`, `documentsDue`, `documentsDueHint`, `due`, `allBouts`, và `coachToday.newPlan`. Xoá ở mọi file message `vi` và `en` có chúng. Key nào còn chỗ dùng thì giữ, và ghi lý do vào handover.
- Không xoá `coachToday.scheduleSession` (`today-schedule.tsx` vẫn dùng).

## Polish (đọc code, không có trình duyệt)

Giữ nguyên giao diện hiện tại: chỉ dùng component và token có sẵn, không sửa `globals.css`, không thêm màu, font hay CSS. Polish là tinh chỉnh, không thiết kế lại. Rà các file `app/(app)/coach/dashboard/{page,coach-hero,coach-todo-card,loading}.tsx` và `components/dashboard/today-schedule.tsx`:

- **P1. Skeleton khớp bố cục thật:** header, hero 2 nửa, lưới 3 cột, khối "Tuần này". Không có khối thừa hay thiếu.
- **P2. Cùng vai trò, cùng kiểu chữ:** các ô số trong hero theo đúng `ReadinessCell` của trang fighter. Tiêu đề các thẻ đều dùng `CardHeader`. Không có cỡ chữ tự đặt trùng vai trò với component có sẵn.
- **P3. Mọi link và nút có focus nhìn thấy được và cao tối thiểu 44px.** Link trên nền hero xanh phải có focus ring thấy được trên nền tối, theo đúng cách `fight-hero.tsx` làm.
- **P4. Chữ dài không làm vỡ bố cục:** tên giải hay tên võ sĩ dài thì xuống dòng gọn hoặc `truncate`, có `min-w-0`. Ở 375px không có phần tử nào rộng hơn viewport.
- **P5. Dọn code:** bỏ import thừa, giá trị trùng, và comment cũ còn nói về hai thẻ cảnh báo cân và hồ sơ đã bỏ.
- Nếu thấy một điểm polish cần đổi chữ đang hiển thị hay đổi hành vi, ghi vào mục "Câu hỏi" trong handover, không tự làm.

## Ca kiểm thử

Viết trước khi code, giữ nguyên tên và kết quả mong đợi. Các ca F1a–F3a phải lỗi trên code hiện tại.

File: `app/(app)/coach/dashboard/t065-coach-dashboard.test.ts`. Render tĩnh, ngôn ngữ `vi`, `now = 2026-11-10T03:00:00Z` (ngày học viện 2026-11-10).

| Ca | Đầu vào | Kết quả mong đợi |
| --- | --- | --- |
| F1a | Một trận `FIGHT_WEEK`, `weighInAt` 2026-11-09, `boutAt` 2026-11-11 | Có "Chưa ghi cân chính thức"; không có "hôm nay cân"; không có phần tử `font-display` nào chỉ chứa "0" |
| F1b | Trận `WEIGHED_IN`, `weighInAt` 2026-11-09, `boutAt` 2026-11-11 | Có "đã cân"; không có "Chưa ghi cân chính thức" |
| F1c | Trận `FIGHT_WEEK`, `weighInAt` 2026-11-10 | Có "hôm nay cân" (không đổi so với hiện nay) |
| F2a | `bouts: null` | Có "Không tải được danh sách trận"; không có "Chưa có trận nào trong camp"; không có `href` tới `routes.coach.newBout`; ô "Trận đang chạy" hiện "—" |
| F2b | `suspensions: null` | Ô "Đang đình chỉ" hiện "—"; markup có chữ "không tải được" |
| F2c | `bouts: []`, `suspensions: []` | Vẫn hiện "Chưa có trận nào trong camp", ô đình chỉ hiện "0" (không đổi) |
| F3a | Mock `listSuspensions` và các dịch vụ khác của trang theo cách các test trang hiện có làm. Nếu không render được trang, đọc nguồn `page.tsx` để kiểm | Lệnh gọi có `active: true` |
| K1 | Toàn bộ test hiện có, kể cả `t062-…` và `coach-dashboard-visual.test.ts` | Vẫn qua, không sửa test cũ. Riêng H2 có thể phải sửa, nhưng chỉ khi nó dựa vào `bouts: null` để kiểm trạng thái trống. Phải ghi lý do vào handover |

## Tiêu chí nghiệm thu

1. Đủ các ca, đúng tên, đúng đầu vào, đúng kết quả mong đợi.
2. Các lệnh sau đều qua:

   ```
   pnpm --filter nextjs-frontend lint
   pnpm --filter nextjs-frontend typecheck
   pnpm --filter nextjs-frontend test
   ```
3. `git diff -- nextjs-frontend/src/app/globals.css` rỗng.
4. Chạy từ thư mục `nextjs-frontend`:

   ```
   impeccable detect --json "src/app/(app)/coach/dashboard" src/components/dashboard/today-schedule.tsx
   ```

   Kết quả phải là `[]`.
5. Chữ mới có ở cả `vi` và `en`. `grep -rn "listWeightAlerts" nextjs-frontend/src` không còn kết quả.
6. File được sửa:
   - `app/(app)/coach/dashboard/*`
   - `components/dashboard/today-schedule.tsx`
   - `lib/services/bouts.ts` (chỉ phần F4)
   - các file message `vi` và `en` (thêm key mới, xoá key thừa)
   - file test mới

Không chạy dev server, không mở trình duyệt, không commit hay push.

## Handover

Ghi vào `docs/tickets/T-065-HANDOVER.md`:

- các file đã sửa;
- danh sách đã xoá ở F4, kèm kết quả grep chứng minh không còn chỗ dùng;
- output test trước (lỗi) và sau (qua);
- output của các lệnh kiểm tra;
- những gì đã polish (P1–P5);
- mục "Câu hỏi".
