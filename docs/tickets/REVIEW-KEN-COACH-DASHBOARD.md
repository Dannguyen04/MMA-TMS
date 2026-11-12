# Review: dashboard HLV của Ken (T-062, T-064 trên `User_Feature`)

- Người review: Claude (phiên điều phối), 12/11/2026. Chỉ đọc, không sửa code, không commit, không merge, không kết nối Supabase.
- Nhánh: `origin/User_Feature`, head `8c901ab` (10/11, Kenn0679). Hai commit trên nền `1befea2` (merge base với `origin/release/final-review`):
  - `3ab1b41` feat(web): coach dashboard shows active suspensions, merged bout tasks and a camp hero (T-062, T-064)
  - `8c901ab` chore(scripts): start_all asks for demo (3000) or API (3100) frontend mode; stop_all frees 3100
- Không có nhánh nào mới hơn của Ken có thay đổi dashboard (đã xem `git branch -r --sort=-committerdate` và `git log --remotes --author=ken --since=2026-11-06`). Nhánh **không đổi** kể từ review 12/11 (`docs/REVIEW-TEAM-2026-11-12.md`, mục Ken).
- Đích merge: `release/final-review` **local** `df73a9b` (gồm 3 commit hiệu năng hôm nay, `e80b1c1`, `9965139`, `df73a9b`, chưa push), và cả `origin/release/final-review` `ae7ecdf`.
- Worktree kiểm: `C:/test/ai-worktrees/review-ken-dashboard` (detached ở `8c901ab`). Phụ: `review-ken-merge` (merge thử, không commit) và `review-ken-base` (đối chứng build).

## Kết luận: **CHANGES REQUESTED**

Code chạy được, test, lint, typecheck, build đều qua, giao diện không tràn ở 390 px, đủ vi/en, sáng/tối đều ổn, 87 link đều trả 200. Nhưng chưa merge được vì:

1. **Xung đột** ở `coach/dashboard/page.tsx` với bản Suspense của release (4 đoạn), và cách Ken viết **hoàn tác A4** của kế hoạch hiệu năng: cả trang lại chờ `getCoachTodo`, `listCampBouts`, `listSuspensions` rồi mới render.
2. **Lỗi đã biết K3 chưa sửa**: hero hiện "0 · hôm nay cân" khi ngày cân là hôm qua mà võ sĩ chưa cân. Tái hiện được (xem V2).
3. **Trùng mã ticket**: T-062 (của Dan) và T-064 (kế hoạch hiệu năng đã dành cho endpoint y tế theo lô) đều đã có trên release.

## Thay đổi của nhánh (so với merge base `1befea2`)

```
 docs/tickets/README.md                             |   2 +
 docs/tickets/T-062-HANDOVER.md                     | 206 ++++++++
 docs/tickets/T-062-REVIEW.md                       |  35 ++
 docs/tickets/T-062-coach-dashboard-fight-camp.md   | 196 ++++++++
 docs/tickets/T-064-HANDOVER.md                     |  68 +++
 docs/tickets/T-064-REVIEW.md                       |  34 ++
 .../T-064-coach-dashboard-fighter-visual.md        | 118 +++++
 .../src/app/(app)/coach/bouts/suspensions/page.tsx |   3 +-
 .../coach/dashboard/coach-dashboard-visual.test.ts | 101 ++++
 .../src/app/(app)/coach/dashboard/coach-hero.tsx   | 100 ++++
 .../app/(app)/coach/dashboard/coach-todo-card.tsx  |  99 +++-
 .../src/app/(app)/coach/dashboard/loading.tsx      |  51 +-
 .../src/app/(app)/coach/dashboard/page.tsx         | 181 +++----
 .../coach/dashboard/t062-coach-dashboard.test.ts   | 524 +++++++++++++++++++++
 .../src/components/dashboard/today-schedule.tsx    |   8 +-
 nextjs-frontend/src/lib/i18n/messages/en.ts        |  29 +-
 nextjs-frontend/src/lib/i18n/messages/vi.ts        |  29 +-
 start_all.bat                                      |  30 +-
 stop_all.bat                                       |   1 +
 19 files changed, 1675 insertions(+), 140 deletions(-)
```

Tóm tắt: bỏ hai thẻ "Cảnh báo cân" và "Hồ sơ đến hạn" (theo ticket T-062, mục này đã có trong to-do); thêm hero camp (`coach-hero.tsx`), dòng đình chỉ đang hiệu lực trong thẻ to-do, nhãn "Khẩn", huy hiệu "Đang đình chỉ" trong lịch hôm nay, lịch tuần (`WeekAgenda`), anchor `#suspension-<id>` trên trang đình chỉ.

## Lệnh đã chạy lại

Trong `C:/test/ai-worktrees/review-ken-dashboard` sau `pnpm install` (xong, exit 0):

```
$ pnpm --filter nextjs-frontend lint
$ eslint
EXIT 0
```

```
$ APP_DATA_MODE=api pnpm --filter nextjs-frontend typecheck
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
EXIT 0
```

```
$ pnpm --filter nextjs-frontend test
 Test Files  124 passed | 1 skipped (125)
      Tests  1258 passed | 2 skipped (1260)
EXIT 0
```

```
$ pnpm --filter nextjs-frontend build      (trong review-ken-dashboard, 3 lần)
> Build error occurred
Error: Turbopack build failed with 9 errors:
Error: Module not found: Can't resolve '@vercel/turbopack-next/internal/font/google/font'
Error while looking up import map: next/font/google queries have exactly one entry
Import trace: big_shoulders_….module.css ← src/components/doctor/doctor-frame.tsx ← src/app/(app)/layout.tsx
EXIT 1
```

Lỗi build này **không do code của Ken**: Ken không sửa `doctor-frame.tsx` hay `layout.tsx`, và cùng commit `8c901ab` build qua trong worktree thứ hai (`review-ken-base`, cài lại `pnpm install --frozen-lockfile`):

```
$ git checkout --detach 8c901ab && pnpm build      (trong review-ken-base)
✓ Compiled successfully in 6.8s
…
├ ƒ /coach/dashboard
…
ƒ Proxy (Middleware)
○  (Static)   prerendered as static content
ƒ  (Dynamic)  server-rendered on demand
EXIT 0
```

Merge base `1befea2` cũng build qua trong worktree đó (`✓ Compiled successfully in 22.6s`, EXIT 0). Nghi do cache font của Turbopack trong worktree đầu (lần cài đầu không dùng `--frozen-lockfile`). Không chặn ticket.

**So với [BASELINE](BASELINE.md):** lint qua, typecheck qua, test qua hết (baseline cũ ghi 578 test; nay 1258 qua, 2 skip, không lỗi). Không thêm lỗi. Khớp số trong handover T-064 và review 12/11.

**Trên cây đã merge thử** (`review-ken-merge` = `release/final-review` local + `User_Feature`, `merge --no-commit`), chạy `vitest run "src/app/(app)/coach/dashboard" src/lib/i18n src/components/dashboard`:

```
 Test Files  1 failed | 9 passed (10)
      Tests  1 failed | 65 passed (66)
```

Ca lỗi duy nhất là `hardcoded-english.test.ts`, do còn dấu xung đột `>>>>>>> origin/User_Feature` trong `page.tsx` (chuỗi tiếng Anh mới). Test `translate-client.test.ts` (A6: client không import `translate`) qua: các file mới của Ken đều là server component.

## Đối chiếu yêu cầu review

| Hạng mục | Kết quả |
| --- | --- |
| Số đếm, ngày, múi giờ UTC+7 | Hero dùng `academyDateOf`, đúng ngày học viện. Lỗi: V2 (K3), V4 (đếm "Chưa được tập"), V5 (chữ "7 ngày") |
| Trạng thái rỗng và lỗi | To-do có câu "không tải được" khi `todo === null`. Hero và số đình chỉ không phân biệt lỗi với rỗng (V3) |
| API mode và demo mode | `listApiBouts` tự nuốt lỗi, nên ở API mode `bouts` không bao giờ là `null` (V3). Demo không có backend nên không đo được request thật |
| Dịch vi và en | Đủ mọi key mới ở cả hai từ điển, không trùng key sau merge. Nội dung sai ở V5 |
| Tràn 390 px | Không: `scrollWidth = 390`, không phần tử nào trong `main` vượt mép phải (vi và en) |
| Fan-out theo võ sĩ | Không thêm fan-out: `listSuspensions` gửi một request (không `fighterId` khi nhiều võ sĩ), có phân trang. Ken còn **bỏ** `listWeightAlerts` (mỗi bout một lượt đọc weight track), nên ít request hơn release. Nhưng chặn render: V1 |
| Lỗi đã biết "0 · cân hôm nay" | **Chưa sửa** (V2) |
| Console, network, server log | Không có lỗi console, không lỗi trong log dev server; 87/87 link trong `main` trả 200 |

## Danh sách vấn đề

| # | Mức | Chỗ | Vấn đề | Tái hiện / cách sửa |
| --- | --- | --- | --- | --- |
| V1 | **chặn** | `nextjs-frontend/src/app/(app)/coach/dashboard/page.tsx:61-75` | **Hoàn tác A4 (PERFORMANCE-PLAN §3).** `listSuspensions`, `getCoachTodo`, `listCampBouts` nằm trong `Promise.all` chính, nên khung trang, hàng việc và lịch hôm nay chờ lệnh đọc chậm nhất. Release vừa tách thẻ cảnh báo và to-do vào `<Suspense>` để trang hiện trước. Merge kiểu "giữ bản của Ken" sẽ mất phần stream; "giữ bản release" sẽ mất hero và đình chỉ | Giải xung đột theo hướng ở mục "Xung đột merge": `CoachHero` và `CoachTodoCard` mỗi thứ một server component con trong `<Suspense>` với skeleton giữ chiều cao, nhận promise tạo trước `Promise.all`. Kiểm bằng `API_TIMING_LOG=1`: HTML đầu gửi đi trước khi `/coach/todo` trả về |
| V2 | **chặn** | `coach-hero.tsx:36`, `:62-64` | **K3 chưa sửa.** Ngày cân là hôm qua, trận hôm nay, chưa `WEIGHED_IN`: `Math.max(0, …)` ra `0` và nhãn "hôm nay cân", che việc lỡ cân chính thức | Render `CoachHero` với `now = 2026-11-12T03:00:00Z`, bout `FIGHT_WEEK`, `weighInAt = 2026-11-11T05:00:00Z`, `boutAt = 2026-11-12T12:00:00Z`. Kết quả thật: `Trận gần nhất Ev Võ sĩ A · Cân chính thức 11/11 0 hôm nay cân`. Sửa: ngày âm và chưa `WEIGHED_IN` thì hiện "lỡ cân" (cảnh báo), thêm test cho ca này |
| V3 | nên sửa | `page.tsx:72-74`, `coach-hero.tsx:32`, `:70`; `lib/services/bouts.api.ts` (`listApiBouts` gọi `nullIfServiceFails` bên trong) | **Lỗi trông như rỗng (K4 chưa sửa).** Dịch vụ trận lỗi: ở API mode `listCampBouts` trả `[]` chứ không ném, nên `bouts` không bao giờ `null`; hero hiện "Chưa có trận nào trong camp" và "Trận đang chạy 0". Dịch vụ đình chỉ lỗi hoặc hơn 500 bản ghi (`PAGINATION_LIMIT_EXCEEDED`, `suspensions.ts:231`): `nullIfServiceFails` nuốt lỗi, số "Đang đình chỉ" về 0 và thẻ to-do không có dòng đình chỉ nào, không báo gì | Render `CoachHero` với `bouts = null`: ra `Chưa có trận nào trong camp … Trận đang chạy 0`. Sửa: phân biệt `null` (hiện "không tải được") với `[]`; với đình chỉ, gọi `listSuspensions({ active: true, … })` để backend lọc, khỏi kéo cả lịch sử |
| V4 | nên sửa | `coach-hero.tsx:41` | Ô **"Chưa được tập"** đếm mọi `clearanceState !== "full"`, gồm cả `restricted` (được tập có hạn chế). Demo: hero ghi "Chưa được tập 6", trong khi lịch hôm nay gắn "Tập có hạn chế" cho Kenji, Marcus, Tariq: chỉ 3 người thật sự không được tập | Đăng nhập HLV demo, so ô hero với huy hiệu trong "Lịch hôm nay". Sửa: đếm `none` và `expired` (không tính `restricted`), hoặc đổi nhãn thành "Chưa cấp phép đầy đủ" |
| V5 | nên sửa | `lib/i18n/messages/vi.ts:204`, `en.ts:210` | Ken đổi `coachTodo.WEIGHT_NOT_WEIGHED` thành "7 ngày chưa có số cân" / "No weight logged in 7 days". Mục này sinh từ trạng thái weight track `NOT_WEIGHED`, ngưỡng **3 ngày**: `WEIGHT_STALE_DAYS = 3` ở `nestjs-api/src/bouts/bouts.model.ts:103` và `nextjs-frontend/src/lib/domain/weight-track.ts:10`. Số 7 là của kiểm tra khả thi (`FEASIBILITY_WEIGHT_MAX_AGE_DAYS`), không phải của to-do | Demo: Emma Lindqvist có dòng "7 ngày chưa có số cân". Sửa: trả về "3 ngày chưa ghi cân", hoặc lấy số từ hằng `WEIGHT_STALE_DAYS` |
| V6 | nên sửa | `docs/tickets/T-062-*.md`, `T-064-*.md`, `docs/tickets/README.md` | **Trùng mã ticket.** Release đã có T-062 của Dan (`T-062-persistence-spec-off-shared-db.md`), và `docs/PERFORMANCE-PLAN.md` §4 dành T-063 đến T-069 cho backend (T-064 = endpoint y tế theo lô). `git merge-tree` không báo xung đột README nên hai dòng T-062 lọt vào lặng lẽ. Review 12/11 gợi ý đổi sang T-063, nhưng số đó cũng đã có chủ | Đổi thành **T-070** và **T-071** (số trống đầu tiên trên release) ở tên file, README, commit message về sau |
| V7 | gợi ý | `coach-todo-card.tsx:98` | Dòng đình chỉ luôn nằm dưới tiêu đề "Sau trận", kể cả đình chỉ `MEDICAL` không gắn trận nào (demo: Hoàng Long, Sofia, Bảo Nguyễn) | Tách nhóm "Đình chỉ đang hiệu lực" riêng, hoặc chỉ xếp vào "Sau trận" khi đình chỉ có `boutId` |
| V8 | gợi ý | `today-schedule.tsx` (dòng huy hiệu); dữ liệu demo | Huy hiệu mới làm lộ chỗ dữ liệu mâu thuẫn: Hoàng Long vừa "Được tập" vừa "Đang đình chỉ" trong lịch hôm nay | Không phải lỗi của Ken; ghi để bên dữ liệu demo hoặc rules xem lại (cấp phép "full" trong khi đình chỉ đang hiệu lực) |
| V9 | gợi ý | `start_all.bat` (lệnh `choice`) | Như K5 của review 12/11: `choice` chờ bàn phím, chạy không tương tác sẽ treo | Thêm tham số `demo` / `api` để bỏ qua câu hỏi |

Không còn tranh chấp **K2 (style editorial)**: release đã bỏ toàn bộ CSS editorial ở `dca9e17` ("back to the owner's app shell … the editorial dashboard CSS is gone"). Class `workspace-editorial coach-editorial` còn trong `page.tsx` của release là class chết, không có CSS nào dùng. Khi giải xung đột, bỏ các class này là hợp với ticket của Ken và không đổi giao diện của release.

## Ảnh chụp (demo mode, `APP_DATA_MODE=demo`, cổng 3200, HLV demo Rafael Costa, 12/11 khoảng 20:20)

1. **1440 px, vi, sáng:** header "Chào buổi tối, Rafael · 11 võ sĩ · 9 buổi tập hôm nay", nút "Bảng sẵn sàng" và "Tạo trận". Hero xanh "TRẬN GẦN NHẤT · Vietnam MMA Open 2026 · Diego Alvarez · Cân chính thức 11/11", số lớn **0 ĐÃ CÂN** (ngày cân là hôm qua, phase `WEIGHED_IN`, nên nhãn đúng; ca chưa cân thì sai, xem V2). Bốn ô: Trận đang chạy 5, Đang đình chỉ 5, Chưa được tập 6 (V4), Buổi tập hôm nay 5/9 "đã xong/đã lên lịch" (khớp "9 buổi · huỷ 2" ở lịch). Bên dưới: "Việc của các trận" (Trước trận 5 dòng, Tuần thi đấu 1, Sau trận 6, nhãn "Khẩn" màu cam), "Việc cần xử lý" 17 việc, "Lịch hôm nay", "Tuần này 09/11 – 15/11 · 49 buổi tập".
2. **390 px, vi, sáng:** hero xếp dọc; hai nút header nằm trên một hàng; lưới số 2×2 vừa khung, "đã xong/đã lên lịch" xuống dòng gọn. Thanh điều hướng dưới không che nội dung. Không cuộn ngang.
3. **390 px, en, sáng:** "Good evening, Rafael · 11 fighters in your corner · 9 sessions today", "NEXT BOUT", "0 WEIGHED IN", "NOT CLEARED TO TRAIN" xuống hai dòng nhưng không tràn; to-do "No weight logged in 7 days" (V5), "Suspended (Medical) until 25/11 · 14 days left · max tier 1". Không cuộn ngang.
4. **1440 px, en, tối** (`mma_theme=dark`): nền navy, hero xanh giữ tương phản, chữ cam "Urgent" và dòng đình chỉ đọc rõ, huy hiệu "Suspended" đỏ trong lịch hôm nay.
5. **Bấm dòng đình chỉ Marcus Hale:** mở `/coach/bouts/suspensions#suspension-susp-active-ko`, phần tử có `id` tồn tại, cuộn đúng hàng "Marcus Hale · KO · 02/11 – 01/12" (cách đỉnh 101 px nhờ `scroll-mt-20`).
6. Lúc chuyển ngôn ngữ, màn chờ chung `(app)/loading.tsx` ghi cứng "Đang tải trang" dù đang ở en. File này không thuộc nhánh Ken; ghi lại để xử lý riêng.

Link: 87 `href` khác nhau trong `main` (hero, to-do, hàng việc với bộ lọc `?queue=…`, lịch hôm nay, lịch tuần, anchor đình chỉ), `fetch` từng cái trong phiên HLV: **87/87 trả 200**. Console: không có lỗi. Log dev server: không có lỗi.

## Xung đột merge

`git merge-tree --write-tree release/final-review origin/User_Feature` cho cùng kết quả với release local `df73a9b`, với `fd09098` (local, chạy lại cuối buổi sau hai commit mới `71c7e32`, `fd09098`) và với `origin/release/final-review` (`ae7ecdf`):

```
Auto-merging docs/tickets/README.md
Auto-merging nextjs-frontend/src/app/(app)/coach/dashboard/page.tsx
CONFLICT (content): Merge conflict in nextjs-frontend/src/app/(app)/coach/dashboard/page.tsx
Auto-merging nextjs-frontend/src/lib/i18n/messages/en.ts
Auto-merging nextjs-frontend/src/lib/i18n/messages/vi.ts
```

Một file xung đột, bốn đoạn:

| # | Đoạn trong `page.tsx` | Release | Ken | Gợi ý |
| --- | --- | --- | --- | --- |
| C1 | Import (đầu file) | `Suspense`, `Link`, `CalendarPlus`/`ClipboardPlus`, `Gate1Badge`, `WeightStatusBadge`, `listWeightAlerts`, `adherenceAlertLine`, các hàm `requirements*` | `CalendarDays`/`ShieldCheck`/`Swords`, `WeekAgenda`, `academyDateOf`, `listSuspensions`, `CoachHero`, `activeSuspensionLines` | Lấy import của Ken, **thêm lại** `Suspense` từ `react`. Bỏ import chỉ thẻ cảnh báo cân và hồ sơ dùng (ticket T-062 bỏ hai thẻ này) |
| C2 | Chuẩn bị promise trước `Promise.all` | `fighterNamesRead`, `alertsRead`, `todoRead` cùng `.catch(() => {})` | Không có | Giữ khuôn của release, đổi nội dung: `boutsRead = listCampBouts(scope)`, `suspensionsRead = listSuspensions(…)`, `todoRead = getCoachTodo(scope)`, mỗi cái `.catch(() => {})`. Bỏ `listWeightAlerts` |
| C3 | Danh sách `Promise.all` chính | 8 phần tử, không có lệnh đọc trận | 11 phần tử, thêm `suspensions`, `todo`, `bouts` | Giữ 8 phần tử của release. `suspendedIds` cho huy hiệu lịch hôm nay: hoặc chờ `suspensionsRead` (một request, nhanh), hoặc đưa huy hiệu vào phần stream; chủ dự án chọn |
| C4 | JSX và hai component `TodoSlot`, `BoutAlerts` | Bọc `workspace-editorial coach-editorial`; `BoutAlerts` trong `Suspense`; `TodoSlot` trong `Suspense` cột phải | Hero, to-do + hàng việc cột trái, lịch hôm nay cột phải, lịch tuần dưới cùng | Bố cục của Ken; bỏ class editorial (đã chết, xem K2). `CoachHero` thành `HeroSlot` async trong `<Suspense fallback={<HeroSkeleton/>}>`, `CoachTodoCard` thành `TodoSlot` trong `<Suspense>`, skeleton lấy từ `loading.tsx` mới của Ken để giữ chiều cao. Xoá `BoutAlerts`. `QueueCard`, `TodaySchedule`, `WeekAgenda` render ngay |

Các file khác tự merge sạch. Sau khi merge thử, đã kiểm: không key i18n nào bị trùng (mọi key mới chỉ có ở `en.ts`/`vi.ts`, không trùng file con như `coach-today.*.ts`). `coach-todo-card.tsx`, `today-schedule.tsx`, `loading.tsx`, `suspensions/page.tsx` không bị release sửa. `docs/tickets/README.md` tự gộp **hai dòng T-062** (dòng 62 và 116), xem V6.

## Việc cần làm trước khi merge

1. Sửa V2, V3 (hero và số đình chỉ), V4, V5; thêm test cho ca lỡ cân và ca dịch vụ lỗi.
2. Đổi mã ticket thành T-070 / T-071 (V6).
3. Merge `release/final-review` vào nhánh, giải C1–C4 theo bảng trên, giữ stream Suspense (V1). Chạy lại bộ lệnh §5 và `API_TIMING_LOG=1` ở API mode để xác nhận không còn `/bouts`, `/coach/todo` trên đường chờ đầu tiên.
