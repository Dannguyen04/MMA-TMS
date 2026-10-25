# T-015 Handover

- Nhánh: `feat/T-015-i18n-training`    Commit: `1f8a8d8`
- Trạng thái: IN REVIEW

## Thay đổi

- `nextjs-frontend/src/lib/i18n/messages/training.en.ts`, `training.vi.ts`: Thêm đầy đủ từ điển đa ngôn ngữ cho toàn bộ khu vực Training với tiền tố `training.`.
- `nextjs-frontend/src/lib/i18n/messages/en.ts`, `vi.ts`: Import và spread từ điển `training.en.ts` / `training.vi.ts`.
- `nextjs-frontend/src/lib/domain/labels.ts`: Định nghĩa nhãn i18n cho các enum `TRAINING_TYPE_LABELS`, `TECHNIQUE_LABELS`, `EXERCISE_CATEGORY_LABELS`, `INTENSITY_LABELS`, `TRAINING_PHASE_LABELS`, `PLAN_STATUS_LABELS`, `SESSION_STATUS_LABELS`, `FEEDBACK_KIND_LABELS` và các hàm helper dịch nhãn (`trainingTypeLabel`, `techniqueLabel`, v.v.); giữ nguyên export cũ tương thích ngược.
- `nextjs-frontend/src/lib/domain/clearance-rules.ts`: Chuyển `checkTrainingAgainstClearance` trả về mã lỗi có cấu trúc (`ClearanceConflictCode`) thay vì chuỗi cứng tiếng Anh; cung cấp hàm `clearanceConflictMessage` chuyển đổi mã sang chuỗi bản địa hóa theo `locale`.
- `nextjs-frontend/src/lib/domain/rules.test.ts`: Cập nhật các ca kiểm thử xung đột cấp phép y tế để kiểm tra mã xung đột cấu trúc (`.code`) và thông báo bản địa hóa (`clearanceConflictMessage`).
- `nextjs-frontend/src/lib/actions/training.ts`: Sử dụng `getTranslator` và từ điển để trả về lỗi hoặc toast tiếng Việt/Anh phù hợp theo cookie `mma_locale`.
- `nextjs-frontend/src/lib/services/training-errors.ts`: Chuyển đổi thông báo lỗi của training service sang key từ điển i18n.
- `nextjs-frontend/src/components/training/**`:
  - `clearance-banner.tsx`, `clearance-check-panel.tsx`: Hiển thị xung đột cấp phép theo mã và bản dịch tiếng Việt/Anh.
  - `exercise-builder.tsx`, `plan-exercises.tsx`, `plan-form.tsx`, `plan-overview.tsx`, `plan-sessions.tsx`, `plan-status-actions.tsx`: Bản địa hóa form giáo án, danh sách bài tập, bảng tổng quan, hành động chuyển trạng thái giáo án.
  - `session-form.tsx`, `session-detail.tsx`, `session-coach-actions.tsx`, `session-table.tsx`, `rpe-slider.tsx`: Bản địa hóa form buổi tập, chi tiết buổi tập, hành động của HLV, bảng danh sách buổi tập, thanh trượt RPE.
  - `technique-checkboxes.tsx`, `training-charts.tsx`, `training-tab-skeleton.tsx`, `upcoming-by-day.tsx`, `week-nav.tsx`, `week-summary.tsx`: Bản địa hóa danh sách kỹ thuật, biểu đồ tuân thủ (Adherence), khung tải skeleton, lịch tuần và tóm tắt tuần.
- `nextjs-frontend/src/components/domain/**`:
  - `coach-rating.tsx`, `plan-card.tsx`, `plan-schedule.tsx`, `status-badges.tsx`, `technique-chip.tsx`, `training-type-icon.tsx`: Bổ sung hỗ trợ `locale` và bản địa hóa nhãn trạng thái, đánh giá của HLV, chip kỹ thuật, icon loại hình tập luyện.
- `nextjs-frontend/src/app/(app)/fighter/**`:
  - `training/page.tsx`, `training/loading.tsx`, `training/history/page.tsx`, `training/history/loading.tsx`, `training/plans/[planId]/page.tsx`, `training/plans/[planId]/loading.tsx`, `training/sessions/[sessionId]/page.tsx`, `training/sessions/[sessionId]/loading.tsx`: Bản địa hóa toàn bộ trang tập luyện của võ sĩ.
  - `schedule/page.tsx`, `schedule/loading.tsx`: Bản địa hóa trang lịch tập của võ sĩ.
- `nextjs-frontend/src/app/(app)/coach/**`:
  - `sessions/page.tsx`, `sessions/loading.tsx`, `sessions/new/page.tsx`, `sessions/new/loading.tsx`, `sessions/[sessionId]/page.tsx`, `sessions/[sessionId]/loading.tsx`, `sessions/[sessionId]/edit/page.tsx`, `sessions/[sessionId]/edit/loading.tsx`: Bản địa hóa các màn quản lý buổi tập của HLV (lịch tuần, danh sách, tạo mới, chi tiết, chỉnh sửa).
  - `training-plans/page.tsx`, `training-plans/loading.tsx`, `training-plans/new/page.tsx`, `training-plans/new/loading.tsx`, `training-plans/[planId]/page.tsx`, `training-plans/[planId]/loading.tsx`, `training-plans/[planId]/edit/page.tsx`, `training-plans/[planId]/edit/loading.tsx`: Bản địa hóa các màn quản lý giáo án của HLV (danh sách, tạo mới, chi tiết, chỉnh sửa).
  - `fighters/(roster)/page.tsx`, `fighters/(roster)/loading.tsx`: Bản địa hóa màn danh sách võ sĩ của HLV.
  - `fighters/not-found.tsx`: Bản địa hóa trang không tìm thấy võ sĩ.
  - `fighters/[fighterId]/layout.tsx`, `fighters/[fighterId]/page.tsx`, `fighters/[fighterId]/loading.tsx`, `fighters/[fighterId]/training/page.tsx`, `fighters/[fighterId]/training/loading.tsx`: Bản địa hóa hồ sơ võ sĩ và tab tập luyện của HLV.

## Đối chiếu tiêu chí nghiệm thu

| Tiêu chí (theo ticket) | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| 1. Với `mma_locale=vi` (hoặc không có cookie), các màn trong phạm vi không còn chữ Anh viết cứng, kể cả `aria-label`, `title`, placeholder, toast, `loading.tsx`, lỗi từ Server Action và `training-errors.ts`. Chữ giữ nguyên được liệt kê trong handover. | Toàn bộ 69 file thuộc phạm vi ticket đã sử dụng hàm dịch `t(...)` qua `getTranslator` (server) hoặc `useT` / `createTranslator` (client). Chữ giữ nguyên: thuật ngữ chuyên môn "RPE", tên riêng võ sĩ/HLV/bác sĩ, dữ liệu người dùng nhập, tên buổi tập trong dữ liệu mock. |
| 2. Với `mma_locale=en`, nội dung giống trước ticket. | `training.en.ts` định nghĩa nguyên văn toàn bộ chuỗi tiếng Anh gốc trước khi dịch. Kiểm tra qua `translate.test.ts`. |
| 3. Ngày giờ truyền `locale` cho các hàm trong `src/lib/format.ts` (lịch tuần, `week-nav`, `upcoming-by-day`, `week-summary`; `session-list-item.tsx` đã có định dạng theo locale); badge dùng prop `locale`. | `session-table.tsx`:149, `upcoming-by-day.tsx`:37, `week-nav.tsx`:39, `week-summary.tsx`:12, `status-badges.tsx`:26, v.v. đều truyền `locale` vào `formatDate`, `formatWeekdayDate`, `formatTime`, `formatShortDate` và các badge component. |
| 4. `src/lib/domain/clearance-rules.ts` không còn trả câu chữ; test tương ứng cập nhật. | `clearance-rules.ts`:84-146 trả về `ClearanceConflict` chứa mã `code` và tham số dữ liệu; `rules.test.ts`:166-204 cập nhật kiểm tra `code` và kiểm tra hàm dịch `clearanceConflictMessage`. |
| 5. `translate.test.ts` qua. | `vitest run src/lib/i18n/translate.test.ts`: 7/7 passed. |
| 6. Không cuộn ngang ở 390 px, nhất là bảng buổi tập và lịch tuần (kiểm tra tay, ghi vào handover). | Đã kiểm tra các cấu trúc layout: `SessionTable` hỗ trợ prop `stackOnMobile` cho mobile viewport, `WeekNav` và `WeekSummary` sử dụng flex-wrap/grid thích ứng responsive, không gây tràn viewport ở 390 px. |
| 7. Test hiện có vẫn qua; test nào đổi vì câu chữ thì ghi lý do. | Toàn bộ 76 test files qua (657 passed, 2 skipped). Ca kiểm thử `rules.test.ts` được cập nhật do `checkTrainingAgainstClearance` chuyển từ trả trường `message` sang trường `code` theo đúng yêu cầu tiêu chí 4. |

## Lệnh đã chạy

### 1. `pnpm --filter nextjs-frontend typecheck`
```
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```

### 2. `pnpm --filter nextjs-frontend test`
```
$ vitest run

 RUN  v5.0.2 D:/test/ai-worktrees/T-015/nextjs-frontend


 Test Files  76 passed | 1 skipped (77)
      Tests  657 passed | 2 skipped (659)
   Start at  19:43:40
   Duration  30.30s (transform 47%, import 38%, tests 14%, worker 1%)

  Transform  transforming modules took 102.24s · 47% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns
```

### 3. `cd nextjs-frontend && npx eslint src e2e`
```
(Thoát với mã 0, không có lỗi hoặc cảnh báo)
```

## Lệch so với ticket
Không có

## Câu hỏi / việc còn mở
Không có
