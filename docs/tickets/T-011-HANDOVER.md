# T-011 Handover

- Nhánh: `chore/T-011-sync-main` (từ `origin/fight-camp`, `git merge --no-ff origin/main`)
- Trạng thái: DONE, đã merge vào `fight-camp` theo yêu cầu của chủ dự án (26/10). Không mở PR `fight-camp` → `main` (team không đụng `main` nữa).

## Giải xung đột

- Backend bouts (`nestjs-api/src/bouts/bouts.service.ts`, `bouts.controller.spec.ts`) và `docs/tickets/README.md`: lấy bản `fight-camp`.
- 11 file frontend ở mục 2 của ticket: giữ hành vi PR #22 và bản dịch T-015, T-016.
  - `examination-summary-card.tsx`, `care-team-card.tsx`, `training-errors.ts`, `examination-presets.ts`, `fighter/health/page.tsx`, `fighter/health/history/page.tsx`: gộp tay.
  - `coach/fighters/[fighterId]/page.tsx`, `coach/sessions/[sessionId]/page.tsx`, `coach/sessions/new/page.tsx`, `session-form.tsx`, `lib/actions/training.ts`: lấy bản đã gộp sẵn trên `feat/T-004-bout-lifecycle-ui` (nhánh này đã gộp PR #22 với bản dịch từ 25/10).
- `health.en.ts`, `health.vi.ts`: thêm `careTeam.noDoctor`, `careTeam.noCoach`, `eligibilityReason.OTHER_MEDICAL_REASON`, `eligibilityReasonDesc.OTHER_MEDICAL_REASON`; đổi "baseline physical" thành "baseline exam" ở 4 câu tiếng Anh cho khớp PR #22.

## Phát hiện: `main` mất một phần PR #22

`origin/main` typecheck ra 52 lỗi (đo bằng worktree 26/10). Nguyên nhân là commit merge `1fe50de` trong PR #26 (`User_Feature`) giải xung đột làm rơi code PR #22. Các commit thường của PR #26 không sửa file frontend nào, nên phần hỏng chỉ đến từ commit merge. Đã khôi phục từ bản đã gộp đúng trên nhánh T-004 (mỗi file được kiểm là không kèm code bouts):

- `components/ui/form.tsx`: prop `info` trên `Field`, `Checkbox`, `FormSection` (kèm `cancelLabel` không bắt buộc trên `FormFooter`).
- `components/dashboard/dashboard-utils.ts` (`greetingTitle`), `coach-attention.tsx`, `coach-today.en.ts`, `coach-today.vi.ts` (hàng đợi "Cần giáo án", "Ứng viên").
- `components/training/plan-form.tsx`, `plan-exercises.tsx`, `lib/domain/training-templates.ts`, `coach/training-plans/new/page.tsx`, `coach/training-plans/[planId]/page.tsx` (tạo giáo án từ mẫu hoặc bản sao, nút nhân bản).
- `lib/actions/medical-contract.ts`, `medical-contract.test.ts`, `lib/actions/training.test.ts` (mock i18n).
- `components/layout/navigation.test.ts`: lấy bản `fight-camp`. Bản `main` còn coi Admissions và AI models là mục của admin, trái với T-001.

## Dịch thêm (tiêu chí 3)

`lib/actions/training.ts` còn 3 chuỗi tiếng Anh mới từ PR #22 ở luồng của HLV, đã đưa qua từ điển:
- `training.schema.exerciseListReadError` (key có sẵn), `training.schema.planExercisesMax`, `training.repeat.countInvalid` (mới, có en và vi).

Chưa dịch, ngoài phạm vi ticket:
- Các action thư viện bài tập của admin (`createLibraryExercise`, `importStarterLibrary`): cả trang `/admin/exercises` của PR #22 đều chưa dịch, nên để chung một ticket i18n cho admin.
- Form khám của bác sĩ (`examination-decision-form.tsx`, `examination-details-fields.tsx`) chưa dịch trên cả `fight-camp` lẫn `main`. Câu `assessmentRowsProblem` vẫn là tiếng Anh.

## Kiểm tra (26/10)

| Lệnh | Kết quả |
| --- | --- |
| `git diff origin/fight-camp -- nestjs-api/src/bouts nestjs-api/src/suspensions` | rỗng |
| `git diff origin/fight-camp -- nestjs-api/src` | rỗng |
| frontend `npm run typecheck` (NODE_ENV=development) | 0 lỗi, bằng baseline `fight-camp` |
| frontend `npx vitest run` | 95 file pass, 822 test pass, 2 skip |
| frontend `npx eslint src` | sạch |
| frontend `next build` (APP_DATA_MODE=api) | pass |
| backend `npm run build` | pass |
| backend `npm test` | 1045 pass; hỏng 4 suite notifications (file spec rỗng 0 byte, có sẵn trên `fight-camp` và `main`) và 2 test `coaching-loop-persistence` (cần database, file không đổi so với `fight-camp`) |

Kiểm tay ở demo mode (tiêu chí 2):
- `/coach/training-plans/new`: form 4 bước. Chọn mẫu "Boxing fundamentals" thì form tự điền 4 tuần và 7 bài tập; bấm Next chuyển sang bước Basics.
- `/coach/sessions/new`: có "Repeat weekly".
- `/doctor/examinations/new`: chọn loại "Routine check" thì form nạp sẵn 6 hạng mục, có nút "Mark the 6 unmarked areas Normal" và chip tái khám "In 1/2/4 weeks".
- Cảnh báo hydration trong dev chỉ do thuộc tính `data-cursor-ref` mà trình duyệt kiểm thử chèn vào, không phải lỗi của app.
