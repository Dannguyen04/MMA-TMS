# T-062: Dashboard HLV hiện đình chỉ và gộp việc Fight Camp theo giai đoạn trận (giữ style cũ)

- Trạng thái: APPROVED 10/11 ([review](./T-062-REVIEW.md)). Ngày: 10/11/2026.
- Nhánh: `User_Feature`, nhánh đang checkout. Không tạo nhánh, không commit.
- Phạm vi: chỉ `nextjs-frontend`, chỉ trang `/coach/dashboard` và các component trang này dùng trực tiếp. Không đổi backend, API, nguồn to-do `/coach/todo`, mã lỗi, migration hay dữ liệu demo.
- Nguồn: critique ngày 10/11 trên `User_Feature` (`.impeccable/critique/2026-11-10T11-10-07Z__src-app-app-coach-dashboard-page-tsx.md`, 21/40).
- Chủ dự án đã chọn:
  - Hiện đình chỉ và gộp hai danh sách.
  - Nhóm việc theo giai đoạn trận.
  - Đổi nút đầu trang và sửa a11y nhỏ.
  - Đưa khối Fight Camp lên cột chính.
  - Báo lỗi và báo "mọi việc ổn".
  - Thêm nhãn "Khẩn" và sửa câu "2 ngày / 3 ngày".
  - Thêm huy hiệu đình chỉ trong lịch hôm nay.
  - Dựng đình chỉ ở frontend từ `listSuspensions` (phương án a).

## Quy tắc style (bắt buộc)

Chủ dự án yêu cầu giữ đúng giao diện hiện có trên `User_Feature`. Một lần làm trước, trên nhánh khác, đã tự thêm hệ thống giao diện mới và bị bỏ.

- **Chỉ dùng** component và token có sẵn: `Card`, `CardHeader`, `CardContent`, `CardLink`, `ButtonLink`, `PageHeader`, `Badge` / `StatusBadge` / `*Badge` trong `components/domain/status-badges.tsx`, `Skeleton*`, các lớp Tailwind và token màu đang dùng trong các file dashboard hiện tại (`text-fg`, `text-fg-muted`, `text-warning-fg`, `divide-border`…).
- **Không sửa `src/app/globals.css`**. Không thêm font, màu, file CSS, lớp `editorial`, nền giấy, vạch đỏ, hay bỏ viền thẻ.
- Dòng mới phải trông giống các dòng sẵn có: dòng cảnh báo cân hiện tại (`page.tsx:151`, `Link` cả dòng `flex min-h-11 … py-3`) và dòng to-do hiện tại (`coach-todo-card.tsx`).
- Nhãn "Khẩn" dùng `Badge` có sẵn (tone warning hoặc danger), không tự tạo span có style riêng.

## Thiết kế

### 1. Dòng đình chỉ (hàm thuần)

Export từ `app/(app)/coach/dashboard/coach-todo-card.tsx`:

```ts
export interface ActiveSuspensionLine { suspensionId: string; fighterId: string; reason: SuspensionReason; endsOn: string; daysLeft: number; maxAllowedTier: number; }
export function activeSuspensionLines(suspensions: Suspension[], today: string): ActiveSuspensionLine[];
```

- Chỉ lấy đình chỉ có `suspensionStatusOn(s, today) === "ACTIVE"`. Hàm này nằm trong `lib/domain/suspension-rules.ts:109` và tính theo ngày. Không đọc trường `status` có sẵn.
- Mỗi võ sĩ tối đa một dòng, lấy đình chỉ có `endsOn` muộn nhất.
- Sắp theo `endsOn` tăng dần. Cùng ngày thì sắp theo `fighterId`.
- `daysLeft = daysBetweenDates(today, endsOn) + 1`. Gọi với `today = academyDateOf(now)`; cả hai hàm đều nằm trong `suspension-rules.ts`.

### 2. Khối "Việc của các trận" (`CoachTodoCard`)

- Props mới: `todo: CoachTodo | null` và `suspensions: ActiveSuspensionLine[]`. Component **luôn hiển thị**, bỏ `return null`.
- `todo === null` (dịch vụ lỗi): hiện câu `coachTodo.unavailable`. Các dòng đình chỉ vẫn hiện nếu có.
  - vi: "Không tải được việc của các trận. Thử tải lại trang."
  - en: "Couldn't load bout tasks. Try reloading the page."
- Không có việc và không có đình chỉ: hiện `coachTodo.empty`.
  - vi: "Không có việc nào cho các trận đang chạy."
  - en: "Nothing to do on running bouts."
  - Dùng component trống có sẵn nếu hợp (`components/ui/states.tsx`), nếu không thì một dòng `text-sm text-fg-muted`.
- Giữ ba giai đoạn `BEFORE`, `DURING`, `AFTER`, mỗi giai đoạn trong một `<section aria-labelledby>` trỏ tới `<h3>` của nó, không lặp `aria-label`.
- **Thêm** `AFTER` vào map giai đoạn: `RESULT_OVERDUE` được xếp vào `AFTER` khi hiển thị, bằng cách đổi phase lúc render trong card, không sửa `coach-todo.ts`.
- **Dòng đình chỉ** nằm ở `AFTER`, đứng trước các mục khác của `AFTER`.
  - Hiện tên võ sĩ và chữ `plural(t, "coachTodo.SUSPENSION_ACTIVE", daysLeft, { reason, date, tier })`, lấy từ `lib/i18n/translate.ts`. Số đếm là `{n}`, dạng số ít ở `<key>.one`.
  - vi: "Đình chỉ {reason} đến {date} · còn {n} ngày · tối đa bậc {tier}"
  - en: "Suspended ({reason}) until {date} · {n} days left · max tier {tier}", dạng `.one` là "1 day left"
  - `reason` lấy từ `suspensionReasonLabel(reason, t)`, `date` định dạng bằng `formatShortDate`.
  - Link: `${routes.coach.suspensions}#suspension-${suspensionId}`.
- **Mục khẩn**: tập `URGENT` hiện có, cộng `WEIGHT_NOT_WEIGHED` (7 ngày không có số cân, nặng hơn mục 2 ngày vốn đã khẩn), cộng dòng đình chỉ.
  - Mỗi mục khẩn có `Badge` chữ `coachTodo.urgent` ("Khẩn" / "Urgent").
  - Mục khẩn đứng đầu nhóm giai đoạn của nó, sắp ổn định (giữ thứ tự cũ trong từng nhóm).
- `coachTodo.title` đổi thành "Việc của các trận" / "Bout tasks".

### 3. Sửa câu (theo đúng quy tắc trong code)

- `WEIGHT_NOT_WEIGHED` nghĩa là không có số cân trong 7 ngày (`bout-rules.ts:597`).
  - vi: "7 ngày chưa có số cân"
  - en: "No weight logged in 7 days"
- `WEIGHT_NOT_LOGGED` ứng với nhắc `YESTERDAY_MISSING`, tức từ 2 ngày không ghi (`bout-rules.ts:654`).
  - vi: "Từ 2 ngày chưa ghi cân"
  - en: "No weight logged for 2+ days"

### 4. Bố cục `page.tsx`

- **Bỏ** hai thẻ "Cảnh báo cân" và "Hồ sơ đến hạn" (`page.tsx:138-195`), cùng mọi lời gọi và import chỉ hai thẻ đó dùng. To-do đã có đủ các mục này.
- Thêm `nullIfServiceFails(listSuspensions(scope === "all" ? {} : { fighterIds: scope }, user))` vào `Promise.all`. Kiểm tra lại cách lọc theo phạm vi của `listSuspensions` (`lib/services/suspensions.ts:197`). Kết quả `null` coi như không có đình chỉ.
- `todo` vẫn dùng `nullIfServiceFails`. Truyền thẳng `todo` (có thể `null`) vào card.
- Lưới `lg:grid-cols-3` giữ như cũ:
  - Cột trái `lg:col-span-2`: khối "Việc của các trận" ở trên, `QueueCard` ở dưới. `QueueCard` giữ nguyên nội dung, bộ lọc và props.
  - Cột phải: `TodaySchedule`.
  - Trên màn hẹp, thứ tự là khối trận → hàng việc → lịch.
- Dựng `fighterNames` một lần, bỏ bản dựng lại ở dòng 212.
- Nút đầu trang (`PageHeader actions`):
  - Nút chính: "Tạo trận" → `routes.coach.newBout`.
  - Nút phụ (`variant="secondary"`): "Bảng sẵn sàng" → `routes.coach.readiness`.
  - Thêm key `coachToday.newBout` / `coachToday.readiness`. Icon lấy từ `lucide-react`.
  - Key cũ `coachToday.newPlan` / `coachToday.scheduleSession` chỉ được xoá khi grep cho thấy không còn chỗ nào dùng.

### 5. Huy hiệu đình chỉ trong lịch hôm nay

- `components/dashboard/today-schedule.tsx`: mỗi phần tử của `fighters` nhận thêm `suspensionState?: SuspensionState`.
  - Khi `suspensionState === "ACTIVE"`, hiện `<SuspensionStateBadge state="ACTIVE" size="sm" locale={locale} />` cạnh `ClearanceBadge` (dòng 94).
  - Trạng thái khác thì không hiện. `ClearanceBadge` giữ nguyên.
- `page.tsx` truyền `suspensionState: "ACTIVE"` cho võ sĩ có dòng trong `activeSuspensionLines`.

### 6. Trang đình chỉ

`app/(app)/coach/bouts/suspensions/page.tsx`: thêm `` id={`suspension-${suspension.id}`} `` và `scroll-mt-20` vào `div` của mỗi dòng. Không đổi gì khác.

### 7. A11y nhỏ

- `CardLink` dùng trong dashboard này: truyền `className="min-h-11"` qua prop có sẵn. Không sửa `card-link.tsx`.
- Nút và link mới trên trang cao tối thiểu 44px (`min-h-11`).

### 8. Skeleton

`loading.tsx` dựng skeleton khớp bố cục mới từ các component có sẵn trong `components/ui/skeleton.tsx` (`Skeleton`, `PageHeaderSkeleton`, `LoadingRegion`…):
- lưới `lg:grid-cols-3`;
- cột trái: một khối thẻ vài dòng, rồi một khối hàng việc;
- cột phải: một khối lịch.

Dùng đúng kiểu thẻ hoặc skeleton mà `QueueSkeleton` đang dùng để trông giống. Không sửa `QueueSkeleton`.

## Ngoài phạm vi

- Backend, `/coach/todo`, `lib/domain/coach-todo.ts`, dữ liệu demo, `globals.css`.
- `attention-list.tsx`, `card-link.tsx`, `QueueSkeleton`, các nhóm của hàng việc cũ.
- Bọc lỗi cho các dịch vụ khác của trang, dịch `error.tsx`.

## Ca kiểm thử

Các lớp test:
- **S**: unit cho hàm thuần `activeSuspensionLines`.
- **R**: render tĩnh `CoachTodoCard` bằng `renderToStaticMarkup`, theo cách `suspensions-page.test.ts` đang làm, dịch `vi` trừ khi ghi khác.
- **T**: render tĩnh `TodaySchedule`.
- **P**: render tĩnh trang đình chỉ.

Quy ước chung:
- `today = "2026-11-10"`.
- Đình chỉ mặc định có `clearedAt null`, `requiresClearance false`, `maxAllowedTier 1`.
- File test: `app/(app)/coach/dashboard/t062-coach-dashboard.test.ts`.

| Ca | Lớp | Đầu vào | Kết quả mong đợi |
| --- | --- | --- | --- |
| S1 | S | `MEDICAL` võ sĩ A, `startsOn 11-08`, `endsOn 11-20` | 1 dòng: `fighterId A`, `endsOn "2026-11-20"`, `daysLeft 11`, `maxAllowedTier 1`, đúng `suspensionId` |
| S2 | S | `KO`, `startsOn 11-03`, `endsOn 11-10` | 1 dòng, `daysLeft 1` |
| S3 | S | `DQ`, `startsOn 11-12`, `endsOn 11-20` | `[]` |
| S4 | S | `KO`, `startsOn 10-20`, `endsOn 11-05`, `requiresClearance true` | `[]` |
| S5 | S | `MEDICAL`, `startsOn 11-08`, `endsOn 11-20`, `clearedAt "2026-11-09T03:00:00Z"` | `[]` |
| S6 | S | `DQ`, `startsOn 10-20`, `endsOn 11-01` | `[]` |
| S7 | S | Võ sĩ A có `MANDATORY_REST` `endsOn 11-15` và `KO` `endsOn 11-25` (đều `startsOn 11-05`) | 1 dòng, `endsOn "2026-11-25"`, `reason "KO"` |
| S8 | S | A `endsOn 11-25`, B `endsOn 11-12` | 2 dòng, thứ tự B, A |
| S9 | S | `[]` | `[]` |
| S10 | S | `DQ`, `startsOn 10-20`, `endsOn 11-01`, `status: "ACTIVE"` | `[]` |
| R1 | R | `todo null`, `suspensions []` | Có chữ của `coachTodo.unavailable`; không trả `null` |
| R2 | R | `todo { items: [], truncated: false }`, `suspensions []` | Có chữ của `coachTodo.empty` |
| R3 | R | `todo { items: [] }`; 1 dòng đình chỉ: "Hoàng Long", `MEDICAL`, `endsOn 2026-11-20`, `daysLeft 11`, tier 1, id `s-1` | Có "Sau trận", "Hoàng Long", "Đình chỉ", "20/11", "11 ngày", "bậc 1", `href="/coach/bouts/suspensions#suspension-s-1"` |
| R4 | R | Dòng đình chỉ "Hoàng Long" và mục `SUSPENSION_AWAITING_CLEARANCE` (`AFTER`) của "Linh Phạm" | "Hoàng Long" đứng trước "Linh Phạm" |
| R5 | R | `WEIGHT_OVER_LIMIT` của X và `CAN_ENTER_FIGHT_WEEK` của Y | "Khẩn" xuất hiện đúng 1 lần, trong `<li>` của X |
| R6 | R | Dịch `en`; hai dòng đình chỉ `daysLeft 1` và `11` | Có "1 day left" và "11 days left"; không có "1 days" |
| R7 | R | `todo null`, 1 dòng đình chỉ | Có chữ `coachTodo.unavailable` và tên võ sĩ của dòng đình chỉ |
| R8 | R | Dòng đình chỉ như R3 | `<li>` của nó chứa "Khẩn" |
| R9 | R | Nhóm `BEFORE`: `CAN_ENTER_FIGHT_WEEK` của Y rồi `WEIGHT_NOT_WEIGHED` của X | X đứng trước Y; `<li>` của X có "Khẩn"; có chữ "7 ngày chưa có số cân" |
| R10 | R | `RESULT_OVERDUE` (từ nguồn với phase `DURING`) của Z | Tên Z nằm trong section "Sau trận", không nằm trong "Tuần thi đấu và ngày thi" |
| R11 | R | `todo null` | Markup không có `class` chứa `editorial`; thẻ ngoài cùng là `Card` có sẵn (`data-ui="card"` nếu `Card` có thuộc tính đó, nếu không thì cùng class gốc của `Card`) |
| T1 | T | Một buổi tập của võ sĩ A với `suspensionState "ACTIVE"`, một buổi của B không có trường này | Hàng của A chứa nhãn đình chỉ ACTIVE (chữ `boutLabel.suspensionState.ACTIVE` bản vi); hàng của B không có |
| P1 | P | Trang đình chỉ của HLV với seed demo | Mỗi dòng đình chỉ có `id="suspension-<id>"` |
| K1 | — | Toàn bộ test cũ | Vẫn qua, không giảm số test |

- S1–S10, R1–R10, T1, P1 phải **lỗi trên code hiện tại**. Handover dán output lỗi trước khi sửa và output qua sau khi sửa.
- R11 là ca giữ style, nên qua cả trước và sau.

## Tiêu chí nghiệm thu

1. Đủ các ca, đúng tên, đúng đầu vào, đúng kết quả mong đợi. Không sửa kết quả mong đợi cho khớp code. Ca nào mâu thuẫn với ticket thì ghi vào "Câu hỏi" trong handover và dừng phần đó.
2. `page.tsx`:
   - không còn gọi `listWeightAlerts` hay `listCampBouts`;
   - có `nullIfServiceFails(listSuspensions(...))`;
   - khối trận nằm ở cột trái, phía trên `QueueCard`;
   - nút đầu trang dẫn tới `newBout` và `readiness`.
3. `git diff -- nextjs-frontend/src/app/globals.css` rỗng. `grep -rn "editorial" nextjs-frontend/src` không ra dòng nào.
4. Chỉ sửa các file sau:
   - `app/(app)/coach/dashboard/{page,coach-todo-card,loading}.tsx`
   - `components/dashboard/today-schedule.tsx`
   - `app/(app)/coach/bouts/suspensions/page.tsx` (chỉ `id` và `scroll-mt`)
   - `lib/i18n/messages/{vi,en}.ts`
   - file test mới
5. Mọi chữ mới có cả `vi.ts` và `en.ts`.
6. `lint`, `typecheck` và `test` của `nextjs-frontend` đều qua.

## Lệnh bắt buộc

```
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```

Không chạy dev server, không mở trình duyệt, không commit, push hay đổi nhánh.

Handover ghi vào `docs/tickets/T-062-HANDOVER.md`, gồm:
- các file đã sửa;
- output lỗi trước và qua sau cho từng ca;
- output của ba lệnh;
- câu hỏi.
