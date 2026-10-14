# T-001 Handover

- Nhánh: `feat/T-001-hide-frozen-navigation`    Commit: `4f96b2b`
- Trạng thái: IN REVIEW

## Thay đổi
- `nextjs-frontend/src/components/layout/navigation.ts`:
  - Gỡ bỏ các import icon Lucide không còn sử dụng: `BrainCircuit`, `ClipboardList`, `ChartLine`, `Radar` (dòng 1–18).
  - `fighter`: Ẩn hub "Progress" (gồm cả 2 tab `Performance` và `Goals`). Giữ lại các mục: `Today`, `Training`, `Film`, `Health` (dòng 63–81).
  - `coach`: Ẩn 3 tab `Performance`, `Goals`, `Applicants` trong hub "Roster". Vì "Roster" chỉ còn duy nhất 1 tab (`Fighters`), loại bỏ thuộc tính `tabs` và chuyển thành mục thường trỏ tới `routes.coach.fighters`. Giữ lại các mục: `Today`, `Roster`, `Training`, `Film room`, `Clearance` (dòng 82–100).
  - `doctor`: Ẩn tab `Records` trong hub "Patients" (chỉ còn 1 tab nên bỏ `tabs` và trỏ trực tiếp tới `routes.doctor.fighters`); ẩn 2 tab `Examinations` và `Recovery` trong hub "Clinical" (còn 2 tab `Injuries` và `Clearance`, cập nhật `href` của hub thành tab đầu tiên còn lại là `routes.doctor.injuries`); ẩn hoàn toàn mục "Observations" (`routes.doctor.aiAlerts`). Giữ lại: `Triage`, `Patients`, `Clinical` (dòng 101–117).
  - `admin`: Ẩn mục "Admissions" trong nhóm Access; ẩn mục "AI models" trong nhóm AI platform. Giữ lại toàn bộ các mục còn lại; `mobilePrimaryItems` của admin tiếp tục trả về đủ 4 mục (`dashboard`, `users`, `aiJobs`, `auditLogs`) (dòng 118–154).
- `nextjs-frontend/src/components/layout/navigation.test.ts`:
  - Cập nhật các test suite có sẵn (`hubForPath`, `hubTabsFor`, `mobilePrimaryItems`) để phù hợp với menu mới và phản ánh đúng hành vi các hub/tab bị ẩn:
    - Trong `hubForPath`: thay `routes.fighter.goals` (Progress đã bị ẩn) bằng `routes.coach.sessions` (`Training`) và `routes.doctor.injuries` (`Clinical`); thay các detail page `fighter.technique("jab")` và `coach.fighter("f-1")` (Roster không còn là hub có tabs) bằng detail page của các hub còn lại (`coach.plan("p-1")`, `coach.session("s-1")`, `doctor.injury("inj-1")`, `doctor.grantClearance`); bổ sung kiểm tra `hubForPath` trả về `null` cho các mục đơn không còn `tabs` như `coach.fighters` và `doctor.fighters`.
    - Trong `hubTabsFor`: thay `coach.performance` (Performance bị ẩn, Roster không còn `tabs`) bằng `coach.sessions` (`Training`) và `doctor.injuries` (`Clinical`); cập nhật assertion detail pages cho các hub còn lại.
    - Trong `mobilePrimaryItems`: cập nhật nhãn kỳ vọng của `fighter` (bỏ "Progress" còn 4 mục) và `doctor` (bỏ "Observations" còn 3 mục).
  - Bổ sung test suite `acceptance criteria: frozen navigation removal` bao gồm:
    - Test cho Tiêu chí 1: duyệt toàn bộ `NAVIGATION` và xác nhận không có bất kỳ mục hay tab nào trỏ tới 11 route bị đóng băng.
    - Test cho Tiêu chí 2: kiểm tra mọi mục được giữ của cả 4 vai trò có mặt đúng thứ tự, và hub `Clinical` trỏ tới `Injuries` với 2 tab `Injuries`, `Clearance`.
    - Test cho Tiêu chí 3: duyệt toàn bộ các mục có `tabs` và xác nhận không có hub nào có đúng 1 tab (`tabs.length >= 2` và `!== 1`).

## Đối chiếu tiêu chí nghiệm thu
| Tiêu chí (theo ticket) | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| 1. Không mục hay tab nào trong `NAVIGATION` trỏ tới: `routes.fighter.performance`, `routes.fighter.goals`, `routes.coach.performance`, `routes.coach.goals`, `routes.coach.admissions`, `routes.doctor.records`, `routes.doctor.examinations`, `routes.doctor.recovery`, `routes.doctor.aiAlerts`, `routes.admin.admissions`, `routes.admin.aiModels` | `nextjs-frontend/src/components/layout/navigation.ts:63-143`<br>Test: `navigation.test.ts:117-136` (`acceptance criteria: frozen navigation removal > criterion 1: does not contain any hidden/frozen destination or tab in NAVIGATION`) |
| 2. Mọi mục được giữ ở bảng trên vẫn có mặt, đúng thứ tự | `nextjs-frontend/src/components/layout/navigation.ts:63-143`<br>Test: `navigation.test.ts:138-179` (`acceptance criteria: frozen navigation removal > criterion 2: all kept items are present in correct order`) |
| 3. Không hub nào có đúng một tab | `nextjs-frontend/src/components/layout/navigation.ts:86,105` (bỏ `tabs` ở Roster và Patients)<br>Test: `navigation.test.ts:180-192` (`acceptance criteria: frozen navigation removal > criterion 3: no hub has exactly one tab`) |
| 4. `navigation.test.ts` có test cho tiêu chí 1 và 3; các test cũ vẫn qua hoặc được cập nhật cho đúng cấu hình mới, ghi rõ trong handover test nào đổi và vì sao | `nextjs-frontend/src/components/layout/navigation.test.ts:1-193` (12 tests pass, chi tiết các test đổi đã ghi tại mục "Thay đổi" ở trên) |
| 5. Mở trực tiếp URL của một trang bị ẩn (ví dụ `/coach/performance`) vẫn hiển thị trang như trước | Trang `nextjs-frontend/src/app/(app)/coach/performance/page.tsx` giữ nguyên. Đã kiểm tra qua dev server demo mode (`http://localhost:3005/coach/performance` với cookie `mma_session=u-rafael-costa`): trang trả về mã 200, hiển thị đầy đủ tiêu đề "Team performance", bảng chỉ số kỹ thuật, thẻ khối lượng tập luyện. Menu bên cạnh không hiển thị liên kết tới trang. |

## Lệnh đã chạy

### 1. `pnpm --filter nextjs-frontend lint`
```text
$ eslint
```

### 2. `pnpm --filter nextjs-frontend typecheck`
```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```

### 3. `pnpm --filter nextjs-frontend test`
```text
$ vitest run

 RUN  v5.0.2 D:/test/ai-worktrees/T-001/nextjs-frontend


 Test Files  69 passed | 1 skipped (70)
      Tests  581 passed | 1 skipped (582)
   Start at  10:47:08
   Duration  8.63s (import 53%, transform 31%, tests 14%, worker 1%)

  Transform  transforming modules took 16.57s · 31% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns
```

## Lệch so với ticket
Không có

## Câu hỏi / việc còn mở
Không có
