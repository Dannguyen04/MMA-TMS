# T-004 Sync Handover

- Nhánh: sync/T-004-fight-camp    Commit code: 9670f0d
- Trạng thái: IN REVIEW
- Merge commit: 6ca3f98; bản sửa typecheck: 3b4a71e; bản sửa demo/contract: 9670f0d.
- Nền đã merge: fight-camp (dbbb120), bằng git merge fight-camp, không rebase.

## Thay đổi

### File xung đột và cách giải (23 file)

- `nextjs-frontend/src/app/(app)/coach/bouts/[boutId]/bout-weight-card.tsx`: Giữ xoá; CampWeightCard/bout-weight-panel của nhánh thay widget cân cũ.
- `nextjs-frontend/src/app/(app)/coach/bouts/new/bout-form.tsx`: Giữ form tạo trận và kiểm tra lịch của Hoàng Anh; ghép preview khả năng đạt cân T-029, debounce và chống response cũ; giờ học viện đổi sang ISO trước khi gọi action.
- `nextjs-frontend/src/app/(app)/coach/dashboard/page.tsx`: Giữ kế hoạch nháp, cảnh báo cân và giấy tờ của nhánh; ghép getCoachTodo/CoachTodoCard mới, dùng chung scope võ sĩ.
- `nextjs-frontend/src/app/(app)/fighter/bout/page.tsx`: Giữ trang trận, dinh dưỡng và thông báo lưu cân của nhánh; ghép nhắc cân fight week T0 qua từ điển.
- `nextjs-frontend/src/app/(app)/fighter/dashboard/bout-weight-cell.tsx`: Giữ xoá; giao diện cân dùng CampWeightCard của nhánh.
- `nextjs-frontend/src/app/(app)/fighter/health/history/page.tsx`: Giữ timeline hiện tại, lấy emptyText qua từ điển T-015 và truyền locale.
- `nextjs-frontend/src/app/(app)/fighter/health/page.tsx`: Giữ hành vi trang health hiện tại; giữ mô tả chưa có clearance qua từ điển T-015.
- `nextjs-frontend/src/components/dashboard/care-team-card.tsx`: Giữ locale và nhãn từ T-015; giữ hướng dẫn phân công bác sĩ/HLV của nhánh, bổ sung khóa dịch cho trạng thái trống.
- `nextjs-frontend/src/components/dashboard/examination-summary-card.tsx`: Giữ hai trạng thái trống compact/full của nhánh và lấy chữ qua từ điển T-015.
- `nextjs-frontend/src/components/domain/status-badges.tsx`: Giữ badge Gate 1 theo missing/overdue, bout/requirement/suspension của nhánh cùng các badge health/training đã dịch; trạng thái cân đổi sang năm tên T-029, có NEUTRAL.
- `nextjs-frontend/src/components/domain/weight-summary.tsx`: Giữ xoá; dùng CampWeightCard của nhánh thay bộ WeightFigures/WeightStatusNote song song.
- `nextjs-frontend/src/components/medical/examination-presets.ts`: Giữ AssessmentResult của hành vi mới; ghép vitalAssessmentMessage và translator từ T-015.
- `nextjs-frontend/src/lib/actions/bouts.ts`: Giữ toàn bộ action lifecycle, cân chính thức, kết quả, đình chỉ của nhánh; ghép previewFeasibilityAction với kiểm tra quyền/scope và lịch; bảo đảm use server đứng đầu file.
- `nextjs-frontend/src/lib/domain/bout-rules.test.ts`: Giữ bộ test quy tắc lifecycle của nhánh thay bộ kiểm tra cài đặt Bout song song.
- `nextjs-frontend/src/lib/domain/bout-rules.ts`: Giữ quy tắc CampBout/lifecycle của nhánh; ghép calculateWeightFeasibility, feasibilityWarnings, computeWeighInReminder độc lập từ fight-camp; không giữ cài đặt cân/Gate 1 trùng.
- `nextjs-frontend/src/lib/domain/labels.ts`: Ghép các hàm nhãn health/clearance đã dịch với nhãn lifecycle của nhánh; không thêm lại hằng bout trùng; nhãn cân dùng nghĩa T-029.
- `nextjs-frontend/src/lib/domain/types.ts`: Giữ kiểu health/training đã merge; giữ các kiểu DTO và CoachTodo/feasibility mới từ fight-camp phục vụ contract đọc; lifecycle dùng CampBout trong domain/bout.ts.
- `nextjs-frontend/src/lib/domain/weigh-in.test.ts`: Giữ xoá; kiểm tra cân của nhánh nằm ở weight-input/nutrition và bộ test tương ứng.
- `nextjs-frontend/src/lib/domain/weigh-in.ts`: Giữ xoá; luồng cân của nhánh dùng weight-input/nutrition thay activeBout/weigh-in song song.
- `nextjs-frontend/src/lib/domain/weight-chart.test.ts`: Giữ bộ test biểu đồ có adherence của nhánh; đổi trạng thái và kỳ vọng nhãn trợ năng sang tên T-029.
- `nextjs-frontend/src/lib/mocks/bouts.ts`: Giữ xoá; chỉ dùng demoCampStore trong services/bouts.demo.ts, không khôi phục store trận thứ hai.
- `nextjs-frontend/src/lib/services/bouts.demo.ts`: Giữ store/lifecycle/cân chính thức/kết quả/đình chỉ của nhánh; ghép feasibility và coach todo đọc cùng store; cân sau WEIGHED_IN là NEUTRAL; clearance sớm theo contract T-007.
- `nextjs-frontend/src/lib/services/bouts.ts`: Giữ facade của nhánh, API lifecycle chỉ đi qua bouts.api.ts; bỏ backendBoutSchema và các hàm API trùng; ghép hai đọc mới feasibility/todo và schema trạng thái T-029.

### Lựa chọn cài đặt dùng chung và sửa lỗi sau merge

- Điểm gọi duy nhất cho màn trận là services/bouts.ts; API lifecycle thực thi trong services/bouts.api.ts với domain/bouts-contract.ts; demo thực thi trong services/bouts.demo.ts. Không giữ thêm cài đặt API lifecycle từ fight-camp trong facade.
- Một store demo duy nhất chứa trận, cân, dinh dưỡng và đình chỉ. Coach todo và preview feasibility đọc store này; test xác nhận chúng đổi theo cân chính thức và cân tự báo.
- Cân giữ các chức năng biểu đồ/adherence của nhánh; thay toàn bộ GREEN/YELLOW/RED/GREY bằng ON_TRACK/ABOVE_TARGET/OVER_LIMIT/NOT_WEIGHED, thêm NEUTRAL và nhãn dịch tương ứng. Sau cân chính thức không tiếp tục cảnh báo ép cân.
- Sửa lỗi TypeScript ở eligibility-reasons: bổ sung khóa dịch OTHER_MEDICAL_REASON của kiểu mới từ medical-contract.
- domain/coach-todo.ts nhận Pick các trường đọc thực sự cần thay vì bắt buộc toàn bộ DTO Bout; không tạo store hay service song song.
- Đối chiếu lỗi contract đình chỉ: backend suspensionStatusOn/isInForceOn bỏ chặn ngay khi clearedAt tồn tại, POST /suspensions/:id/clear cho phép kết thúc sớm và không thay endsOn. Demo/helper/test đã khớp hành vi này; CLEARED là nhãn trình bày nội bộ cho đình chỉ đã kết thúc bởi clearance.
- Chấp nhận xoá khỏi index: CLAUDE.md, GEMINI.md, nestjs-api/AGENTS.md, nestjs-api/CLAUDE.md, nextjs-frontend/AGENTS.md, nextjs-frontend/CLAUDE.md, reactnative-mobile/AGENTS.md, reactnative-mobile/CLAUDE.md.
- Không sửa backend: git diff fight-camp -- nestjs-api rỗng. Không cài dependency, không push, không merge thêm, không đổi nhánh.

## Đối chiếu tiêu chí nghiệm thu

| Tiêu chí | Đáp ứng ở đâu |
| --- | --- |
| Merge fight-camp và giải đủ 23 file | Merge 6ca3f98, danh sách trên; không còn unmerged paths |
| Năm trạng thái cân T-029 | `nextjs-frontend/src/lib/domain/weight-chart.ts:6`; `nextjs-frontend/src/components/domain/status-badges.tsx:394`; không còn tên trạng thái cũ trong frontend |
| Giữ lifecycle và demo mode | `nextjs-frontend/src/lib/services/bouts.demo.ts:539`; bouts.demo.test.ts kiểm tra tạo/sửa, camp, Gate 1, cân chính thức/catchweight, kết quả, đình chỉ/Gate 2 |
| Giữ bản dịch health/clearance/training | health/history, health/page, care-team-card, examination-summary-card và status-badges dùng translator/locale; khóa mới nằm trong health.en.ts và health.vi.ts |
| Coach todo/feasibility dùng chung dữ liệu demo | `nextjs-frontend/src/lib/services/bouts.demo.test.ts:363`; 2 ca tích hợp store demo đều qua |
| Đình chỉ theo contract mới | `nextjs-frontend/src/lib/domain/suspension-rules.ts:123`; `nextjs-frontend/src/lib/services/bouts.demo.test.ts:349`; kiểm tra kết thúc sớm, giữ endsOn, ngừng chặn buổi tập |
| API typecheck và test/lint | Ba output cuối bên dưới, exit code đều 0 |

## Lệnh đã chạy

Output nguyên văn phần cuối của lần chạy cuối, trên code đã commit 9670f0d. APP_DATA_MODE=api được đặt bằng biến môi trường PowerShell trước typecheck; test và lint chạy lệnh thường, không khởi động tiến trình nền.

### APP_DATA_MODE=api pnpm --filter nextjs-frontend typecheck

Exit code: 0.

```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```

### pnpm --filter nextjs-frontend test

Exit code: 0. Test Files: 101 passed, 1 skipped; Tests: 924 passed, 2 skipped.

```text
$ vitest run

 RUN  v5.0.2 D:/test/ai-worktrees/T-004-sync/nextjs-frontend


 Test Files  101 passed | 1 skipped (102)
      Tests  924 passed | 2 skipped (926)
   Start at  14:14:05
   Duration  11.90s (import 61%, transform 25%, tests 13%, worker 1%)

     Import  313 modules were evaluated 1624 times · 47.09s total, 61% of tracked time
             ~1.50s faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation

```

### pnpm --filter nextjs-frontend lint

Exit code: 0; không lỗi, không warning trong lần chạy cuối.

```text
$ eslint
```

## Lệch so với ticket

Không mở rộng tính năng. Các file ngoài danh sách xung đột chỉ được sửa để xử lý lỗi trạng thái cân, khóa dịch, kiểu đọc coach todo và sai lệch contract đình chỉ đã phát hiện; test tương ứng cập nhật theo hành vi mới.

## Câu hỏi / việc còn mở

- Chưa chạy trình duyệt/E2E hoặc xác nhận triển khai; bằng chứng ở đây là typecheck, unit/integration test frontend và lint tại worktree này. Chưa đối chiếu test skipped với baseline riêng.
- Đình chỉ vẫn demo-only trong facade theo phạm vi nhánh được giao; chưa nối API đình chỉ. API mode không được coi là đã kiểm chứng chạy end-to-end.
- Store demo nằm trong bộ nhớ tiến trình; khởi động lại server để về seed. Không có câu hỏi chặn bàn giao.
