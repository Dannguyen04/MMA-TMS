# T-064: Dashboard HLV dùng ngôn ngữ giao diện của dashboard fighter

- Trạng thái: APPROVED 10/11 ([review](./T-064-REVIEW.md)). Ngày: 10/11/2026.
- Nhánh: `User_Feature`, nhánh đang checkout. Không tạo nhánh, không commit, không push.
- Phụ thuộc: T-062. Các thay đổi của T-062 đang ở working tree, chưa commit, phải được giữ nguyên.
- Phạm vi: chỉ `nextjs-frontend`, chỉ trang `/coach/dashboard`.

## Mục tiêu

Trang Today của HLV phải trông cùng một sản phẩm với trang Today của võ sĩ (`src/app/(app)/fighter/dashboard/page.tsx`): hero kiểu thể thao, dải chỉ số, lịch tuần. HLV nhìn một lần phải trả lời được: "Các camp có đúng tiến độ không, ai không được tập hôm nay?"

## Quy tắc bắt buộc

1. **Dùng lại, không tự viết lại.** Lấy đúng các mẫu đã có ở dashboard fighter:
   - **Nền hero:** `bg-hero-bg` + `cage-hatch` + `chamfer-tl` / `chamfer-br`, như ở `components/dashboard/fight-hero.tsx:79-97`.
   - **Chữ display:** `font-display … font-extrabold italic` (Barlow), như ở `fight-hero.tsx:117,124` và `components/ui/page-header.tsx:36`.
   - **Chỉ số:** `ReadinessStrip`, `ReadinessCell`, `ReadinessNumber` trong `components/dashboard/readiness-strip.tsx`.
   - **Lịch tuần:** `WeekAgenda` truyền `fightersById` (`components/domain/week-agenda.tsx`). Component này đã hỗ trợ màn của nhân viên.
   - **Thẻ và huy hiệu:** `Card`, `CardHeader`, `CardContent`, `CardLink` và các badge trong `components/domain/status-badges.tsx`.
2. **Không sửa `src/app/globals.css`.**
   - Không thêm font, màu, file CSS hay dependency.
   - Không dùng lớp màu thô (`slate-*`, `blue-*`), mã hex hay gradient tự chế.
   - Nếu một mẫu có vẻ cần token mới, dừng lại và ghi vào mục "Câu hỏi".
3. **Giữ nguyên toàn bộ T-062**, chỉ đổi style chỗ nào cần để khớp trang fighter, không đổi hành vi:
   - khối "Việc của các trận": dòng đình chỉ, nhãn Khẩn, trạng thái không tải được và trạng thái trống;
   - hai nút "Tạo trận" và "Bảng sẵn sàng";
   - huy hiệu đình chỉ trong lịch hôm nay;
   - `QueueCard` và bộ lọc của nó.
4. **Mọi con số đều lấy từ dữ liệu trang đã tải.** Không bịa, không viết cứng.
   - Nguồn: `getCoachTodo`, `listSuspensions`, `loadRoster`, `listSessions`.
   - Được thêm `listCampBouts(scope)` (`lib/services/bouts.ts:80`), bọc trong `nullIfServiceFails`. Khi kết quả là `null`, hero hiện trạng thái không có trận.
5. **Chữ, chế độ chạy và a11y:**
   - mọi chữ mới có trong cả `vi.ts` và `en.ts`;
   - chạy được ở cả demo mode và API mode;
   - chuyển động tôn trọng `prefers-reduced-motion`;
   - không báo trạng thái chỉ bằng màu;
   - vùng bấm cao tối thiểu 44px.
6. **Kiểu code ponytail:** code ngắn nhất chạy được, không thêm abstraction, helper dùng một lần thì viết inline.

## Bố cục (từ trên xuống)

1. **`PageHeader`:** giữ nguyên (lời chào, ngày ở eyebrow, hai nút của T-062).
2. **Hero camp:** phiên bản HLV của hero fighter.
   - **Trận đang chạy:** `phase` khác `COMPLETED` và `CANCELLED`, và ngày `boutAt` theo giờ học viện chưa qua so với hôm nay.
   - **Trận gần nhất:** trận đang chạy có `weighInAt` sớm nhất.
   - **Bên trái:**
     - tên sự kiện (`event`) và tên võ sĩ;
     - số ngày tới cân chính thức, chữ số `font-display` lớn, tính bằng `daysBetweenDates(today, academyDateOf(weighInAt))` với `today = academyDateOf(now)`;
     - nếu cân hôm nay hoặc đã cân thì số là 0, kèm chữ "hôm nay cân" hoặc "đã cân" theo `phase`.
     - Không có trận đang chạy: hiện trạng thái "chưa có trận nào trong camp" nhẹ nhàng, có link `routes.coach.newBout`.
   - **Bên phải:** 4 con số, mỗi số là một `ReadinessCell` hoặc cùng kiểu với cell đó:
     - số trận đang chạy;
     - số võ sĩ đang bị đình chỉ (`activeSuspensionLines(...).length`);
     - số võ sĩ chưa được cấp phép tập (roster có `clearanceState` khác `"full"`);
     - số buổi tập hôm nay đã xong trên số đã lên lịch, dạng "đã xong/đã lên lịch". Buổi `cancelled` không tính vào số đã lên lịch.
   - **Link:** hero có một `CardLink` hoặc link tương đương tới `routes.coach.fighters`, thay cho roster grid.
3. **Lưới chính `lg:grid-cols-3`:**
   - cột trái `col-span-2`: khối việc của các trận (T-062), rồi `QueueCard`;
   - cột phải: `TodaySchedule`.
4. **Tuần này:** `WeekAgenda` cho mọi võ sĩ trong phạm vi `scope`, dùng `weekSessions` trang đã tải và `fightersById` dựng từ roster. Không có bộ lọc phía client.

Ở 375px: hero xếp dọc (trái trên, phải dưới), không có chiều rộng cố định, không phần tử nào rộng hơn viewport.

## Ngoài phạm vi

- Roster grid: trùng với `/coach/fighters`, hero chỉ link sang đó.
- Bộ lọc mới.
- Backend, `globals.css`, các trang khác.
- Sửa component dùng chung (`fight-hero.tsx`, `readiness-strip.tsx`, `week-agenda.tsx`).

## File được sửa

- `app/(app)/coach/dashboard/{page,coach-todo-card,loading}.tsx`
- Tối đa một file mới `app/(app)/coach/dashboard/coach-hero.tsx`
- `lib/i18n/messages/{vi,en}.ts`
- File test mới

## Ca kiểm thử

Viết trước khi code, giữ nguyên tên và kết quả mong đợi. Các ca H1–H6 phải lỗi trên code hiện tại.

- File: `app/(app)/coach/dashboard/coach-dashboard-visual.test.ts`.
- Cách chạy: render tĩnh bằng `renderToStaticMarkup` component hero (export từ `coach-hero.tsx`, nhận dữ liệu qua props), ngôn ngữ `vi`.
- Mốc thời gian: `today = 2026-11-10`, `now = 2026-11-10T03:00:00Z`.

| Ca | Đầu vào | Kết quả mong đợi |
| --- | --- | --- |
| H1 | Một trận `phase CAMP`, `weighInAt` ngày 2026-11-20 theo giờ học viện, `event "Lion Championship 25"` | Hero có "10" bên trong phần tử mang lớp `font-display`, và có "Lion Championship 25" |
| H2 | Không có trận (`[]` hoặc `null`) | Hero có chữ báo chưa có trận và có `href` tới `routes.coach.newBout`; không ném lỗi |
| H3 | 2 dòng đình chỉ đang hiệu lực của 2 võ sĩ khác nhau (đầu vào đã qua `activeSuspensionLines`, đình chỉ đã hết bị loại trước đó) | Con số võ sĩ bị đình chỉ là 2 |
| H4 | 3 buổi tập hôm nay: 1 `completed`, 1 `cancelled`, 1 `scheduled` | Con số buổi tập là "1/2" |
| H5 | Bất kỳ đầu vào hợp lệ | Markup có `bg-hero-bg` và `cage-hatch`; không có `slate-`, `rounded-2xl`, `editorial`, cũng không có mã màu dạng `#xxxxxx` |
| H6 | Như H1 | Mọi phần tử chứa con số chỉ số có `tabular-nums` |
| H7 | Hai trận đang chạy, cân ngày 2026-11-25 và 2026-11-14; một trận `COMPLETED` cân ngày 2026-11-12 | Hero chọn trận cân 2026-11-14 (số "4"); con số trận đang chạy là 2 |
| K1 | Toàn bộ test cũ, kể cả `t062-coach-dashboard.test.ts` | Vẫn qua, không sửa test cũ |

## Lệnh kiểm tra và tiêu chí nghiệm thu

```
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
git diff -- nextjs-frontend/src/app/globals.css   # rỗng
"C:/Users/PC/.claude/plugins/synced/a69751b9-2214-4f09-a885-dabd05841d9f_b5c4ae71-117f-4bd8-8dd2-8c846cd65536/impeccable~g2/skills/impeccable/scripts/impeccable" detect --json "src/app/(app)/coach/dashboard"   # []
```

Lệnh `impeccable detect` chạy từ thư mục `nextjs-frontend`.

Không chạy dev server, không mở trình duyệt.

## Handover

Ghi vào `docs/tickets/T-064-HANDOVER.md`:
- các file đã sửa;
- output test trước (lỗi) và sau (qua);
- output của các lệnh kiểm tra;
- cách hero xếp ở 375px;
- mục "Câu hỏi" ghi `file:dòng`.
