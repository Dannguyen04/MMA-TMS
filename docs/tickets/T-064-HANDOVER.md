# T-064 Handover: Dashboard HLV dùng ngôn ngữ giao diện của dashboard fighter

- Nhánh: `User_Feature` (không commit, không push, không tạo nhánh). HEAD vẫn là `1befea2`.
- Các thay đổi T-062 trong working tree được giữ nguyên. `coach-todo-card.tsx` không cần đổi style nên không sửa.

## File đã sửa

| File | Thay đổi |
| --- | --- |
| `nextjs-frontend/src/app/(app)/coach/dashboard/coach-hero.tsx` (mới) | `CoachHero`: nửa trái nền `bg-hero-bg cage-hatch chamfer-tl` (tên sự kiện, tên võ sĩ, ngày cân, số ngày tới cân `font-display … tabular-nums`, hoặc trạng thái "Chưa có trận nào trong camp" + link `routes.coach.newBout`); nửa phải `chamfer-br bg-surface` gồm 4 `ReadinessCell` + `ReadinessNumber` (trận đang chạy, đang đình chỉ, chưa được tập, buổi tập hôm nay "xong/lên lịch") và `CardLink` tới `routes.coach.fighters`. |
| `nextjs-frontend/src/app/(app)/coach/dashboard/page.tsx` | Thêm `nullIfServiceFails(listCampBouts(scope))`; bố cục: `PageHeader` → `CoachHero` → lưới `lg:grid-cols-3` (T-062 không đổi) → thẻ "Tuần này" với `WeekAgenda` (`fightersById` dựng từ roster, link `routes.coach.session`). Thân trang bọc `flex flex-col gap-6` như trang fighter. |
| `nextjs-frontend/src/app/(app)/coach/dashboard/loading.tsx` | Thêm skeleton hero hai nửa và `WeekAgendaSkeleton`, theo `TodaySkeleton`. |
| `nextjs-frontend/src/lib/i18n/messages/{vi,en}.ts` | 15 khoá `coachToday.hero.*`, có ở cả hai file. Dùng lại `weight.weighInTodayShort`, `weight.fighterFallback`, `coachToday.newBout`, `fighterToday.weekTitle`, `fighterToday.weekDescription`, `coachToday.sessions`. |
| `nextjs-frontend/src/app/(app)/coach/dashboard/coach-dashboard-visual.test.ts` (mới) | Ca H1–H7. |

Không sửa `globals.css`, component dùng chung, backend hay trang khác. Không thêm màu, font, dependency.

## Quy tắc tính

- Trận đang chạy: `phase` khác `COMPLETED`/`CANCELLED` và `academyDateOf(boutAt) >= academyDateOf(now)`; trận gần nhất là trận có `weighInAt` sớm nhất.
- Số ngày: `max(0, daysBetweenDates(today, academyDateOf(weighInAt)))`. Khi bằng 0, chữ là "đã cân" nếu `phase === "WEIGHED_IN"`, ngược lại "hôm nay cân".
- Chưa được tập: roster có `clearanceState !== "full"`.
- Buổi tập hôm nay: `completed / (không cancelled)`, in bằng template string để markup là "1/2" liền.

## Test trước (lỗi)

Test viết trước khi có `coach-hero.tsx`; cả file lỗi vì module chưa tồn tại (H1–H7 đều không chạy được trên code cũ):

```
 FAIL  src/app/(app)/coach/dashboard/coach-dashboard-visual.test.ts
Error: Cannot find module './coach-hero' imported from D:/MMA-TMS/nextjs-frontend/src/app/(app)/coach/dashboard/coach-dashboard-visual.test.ts
 Test Files  1 failed | 1 passed (2)
      Tests  24 passed (24)
```

## Test sau (qua)

```
pnpm exec vitest run "src/app/(app)/coach/dashboard/"
 Test Files  2 passed (2)
      Tests  31 passed (31)
```

K1: `t062-coach-dashboard.test.ts` (24 ca) qua, không sửa.

## Lệnh kiểm tra

| Lệnh | Kết quả |
| --- | --- |
| `pnpm --filter nextjs-frontend lint` | exit 0, không cảnh báo |
| `pnpm --filter nextjs-frontend typecheck` | exit 0 |
| `pnpm --filter nextjs-frontend test` | 124 file qua, 1 bỏ qua; 1258 test qua, 2 bỏ qua |
| `git diff -- nextjs-frontend/src/app/globals.css` | rỗng |
| `impeccable detect --json "src/app/(app)/coach/dashboard"` (từ `nextjs-frontend`) | `[]` |

## Ở 375px

Hero là `grid-cols-1` dưới `lg`: nửa tối (sự kiện, số ngày) ở trên, nửa sáng (lưới 2×2 chỉ số, link "Tất cả võ sĩ") ở dưới. Không có chiều rộng cố định; mọi cột `min-w-0`, tên sự kiện `text-balance`. `WeekAgenda` dưới `lg` là danh sách ngày gập. Chưa kiểm bằng trình duyệt (ticket không cho chạy dev server).

## Ghi chú

- H1–H7 lỗi trên code cũ vì thiếu module, không phải từng ca lỗi riêng một assertion.
- Chuyển động: không thêm chuyển động mới; chỉ có `transition-colors` sẵn có của `ReadinessCell`.
- Link trong hero cao `min-h-11` (44px).

## Câu hỏi

Không có.
