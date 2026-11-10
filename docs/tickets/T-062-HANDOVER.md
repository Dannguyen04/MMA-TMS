# T-062 Handover — Coach Dashboard Fight Camp & Active Suspensions

## 1. Danh sách file đã sửa / thêm mới

- `nextjs-frontend/src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts` (thêm mới)
- `nextjs-frontend/src/app/(app)/coach/dashboard/page.tsx`
- `nextjs-frontend/src/app/(app)/coach/dashboard/coach-todo-card.tsx`
- `nextjs-frontend/src/app/(app)/coach/dashboard/loading.tsx`
- `nextjs-frontend/src/components/dashboard/today-schedule.tsx`
- `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/page.tsx`
- `nextjs-frontend/src/lib/i18n/messages/vi.ts`
- `nextjs-frontend/src/lib/i18n/messages/en.ts`
- `docs/tickets/T-062-HANDOVER.md` (thêm mới)

---

## 2. Output thật của từng test case (Trước khi sửa code vs Sau khi sửa code)

### 2.1. Trước khi sửa code (Pre-fix — `vitest run "src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts"`)

```text
$ vitest run "src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts"

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend

 ❯ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts (24 tests | 23 failed) 702ms
   ❯ T-062: Coach dashboard fight camp & active suspensions (24)
     × S1 3ms
     × S2 0ms
     × S3 0ms
     × S4 0ms
     × S5 0ms
     × S6 0ms
     × S7 0ms
     × S8 0ms
     × S9 0ms
     × S10 0ms
     × R1 1ms
     × R2 1ms
     × R3 0ms
     × R4 7ms
     × R5 3ms
     × R6 0ms
     × R7 0ms
     × R8 0ms
     × R9 1ms
     × R10 2ms
     × R11 0ms
     × T1 6ms
     × P1 675ms
     ✓ K1 0ms

⎯⎯⎯⎯⎯⎯ Failed Tests 23 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  S1..S10
TypeError: activeSuspensionLines is not a function
 ❯ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts:136:21

 FAIL  R1
TypeError: Cannot read properties of null (reading 'items')
 ❯ Module.CoachTodoCard src/app/(app)/coach/dashboard/coach-todo-card.tsx:54:14
     54|     if (todo.items.length === 0) return null;

 FAIL  R2
AssertionError: expected null not to be null
 ❯ renderTodoCard src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts:126:25

 FAIL  R3
AssertionError: expected null not to be null
 ❯ renderTodoCard src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts:126:25

 FAIL  R4
AssertionError: expected -1 to be greater than -1
 ❯ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts:295:44
    295|         expect(html.indexOf("Hoàng Long")).toBeGreaterThan(-1);

 FAIL  R5
AssertionError: expected [] to have a length of 1 but got +0
 ❯ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts:330:43
    330|         expect(html.match(/Khẩn/g) ?? []).toHaveLength(1);

 FAIL  R6
AssertionError: expected null not to be null
 ❯ renderTodoCard src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts:126:25

 FAIL  R7
TypeError: Cannot read properties of null (reading 'items')
 ❯ Module.CoachTodoCard src/app/(app)/coach/dashboard/coach-todo-card.tsx:54:14

 FAIL  R8
AssertionError: expected null not to be null
 ❯ renderTodoCard src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts:126:25

 FAIL  R9
AssertionError: expected 1828 to be greater than 2542
 ❯ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts:442:41
    442|         expect(html.indexOf("Võ sĩ Y")).toBeGreaterThan(html.indexOf("Võ sĩ X"));

 FAIL  R10
AssertionError: expected '' to contain 'Võ sĩ Z'
 ❯ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts:471:30
    471|         expect(afterSection).toContain("Võ sĩ Z");

 FAIL  R11
TypeError: Cannot read properties of null (reading 'items')
 ❯ Module.CoachTodoCard src/app/(app)/coach/dashboard/coach-todo-card.tsx:54:14

 FAIL  T1
AssertionError: expected '<li class="relative flex items-start …' to contain 'Đang đình chỉ'
 ❯ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts:532:22
    532|         expect(rowA).toContain(label);

 FAIL  P1
AssertionError: expected '<div class="flex flex-col gap-6"><hea…' to contain 'id="suspension-susp-history-no-medical"'
 ❯ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts:544:22

 Test Files  1 failed (1)
      Tests  23 failed | 1 passed (24)
```

*(Ghi chú: `K1` là bài kiểm tra bảo toàn giao diện cho `SkeletonCoachDashboard`, pass cả trước và sau khi cập nhật `loading.tsx`).*

### 2.2. Sau khi sửa code (Post-fix — `vitest run "src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts" --reporter=verbose`)

```text
$ vitest run "src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts" "--reporter=verbose"

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend

 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > S1 1ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > S2 1ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > S3 0ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > S4 0ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > S5 0ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > S6 0ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > S7 0ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > S8 1ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > S9 0ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > S10 0ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > R1 6ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > R2 1ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > R3 2ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > R4 1ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > R5 1ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > R6 2ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > R7 1ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > R8 1ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > R9 1ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > R10 1ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > R11 1ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > T1 4ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > P1 516ms
 ✓ src/app/(app)/coach/dashboard/t062-coach-dashboard.test.ts > T-062: Coach dashboard fight camp & active suspensions > K1 0ms

 Test Files  1 passed (1)
      Tests  24 passed (24)
   Start at  18:28:35
   Duration  2.30s (import 47%, transform 28%, tests 25%)
```

---

## 3. Output thật của 3 lệnh ở Tiêu chí nghiệm thu 1

### 3.1. `pnpm --filter nextjs-frontend lint`

```text
$ eslint
```
*(Exit code 0)*

### 3.2. `pnpm --filter nextjs-frontend typecheck`

```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```
*(Exit code 0)*

### 3.3. `pnpm --filter nextjs-frontend test`

```text
$ vitest run

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  123 passed | 1 skipped (124)
      Tests  1251 passed | 2 skipped (1253)
   Start at  18:28:38
   Duration  7.09s (import 43%, transform 30%, tests 26%, worker 1%)

     Import  442 modules were evaluated 3287 times · 30.63s total, 43% of tracked time
             ~427ms faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation
```
*(Exit code 0)*

---

## 4. Câu hỏi

1. **Test case `R11` trên code cũ**: Trong bảng thiết kế test case, `R11` có đầu vào `todo: null`, `suspensions: []`, đồng thời ghi chú cuối bảng nêu `R11, K1 là bài kiểm tra bảo toàn giao diện, có thể pass ngay cả trên code cũ`. Tuy nhiên trên code cũ trước khi sửa, `CoachTodoCard` truy cập `todo.items.length` trực tiếp khi nhận `todo: null` nên ném lỗi `TypeError: Cannot read properties of null (reading 'items')`. Sau khi cập nhật `CoachTodoCard` nhận `CoachTodo | null`, `R11` pass đầy đủ (`data-ui="card"` và không có `"editorial"`).
2. **Test case `R6` kiểm tra không có `"1 days"`**: Khi render đồng thời dòng `daysLeft = 1` (`"1 day left"`) và dòng `daysLeft = 11` (`"11 days left"`), chuỗi `"11 days left"` có chứa chuỗi con `"1 days"` (`1[1 days] left`). Vì vậy trong test `R6`, điều kiện không chứa `"1 days"` được kiểm tra theo ranh giới từ (`/\b1 days\b/`) để phản ánh đúng yêu cầu ngữ pháp số ít `"1 day left"` thay vì `"1 days left"`.
3. **Khoá i18n trong `vi.ts` / `en.ts`**: Tiêu chí nghiệm thu 4 giới hạn chỉ sửa `src/lib/i18n/messages/{vi,en}.ts` (không sửa `coach-today.{vi,en}.ts`), đồng thời `coachToday.scheduleSession` vẫn đang được dùng tại `today-schedule.tsx:54`. Do đó `coachToday.newBout` và `coachToday.readiness` được bổ sung trực tiếp vào `vi.ts` và `en.ts`, giữ nguyên các khoá hiện có trong `coach-today.{vi,en}.ts`.
