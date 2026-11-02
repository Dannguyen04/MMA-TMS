# T-040 phần A · Review

## Lần 1 (2/11): CHANGES REQUESTED

- Nhánh: `feat/T-040-merge-demo-branches`, worktree `D:/test/ai-worktrees/T-040`. Đầu nhánh trên remote: `4f02265`. Handover: [T-040-A-HANDOVER.md](./T-040-A-HANDOVER.md) (trên nhánh). Ticket: [T-040](./T-040-real-backend-demo.md) phần A.
- Người review: Claude trên máy Dan, 2/11.
- **Kết luận: CHANGES REQUESTED.** Lint, typecheck, build, test backend, `test:db` đều đạt. Lần gộp `fight-camp` mới (`66c0887`) làm hỏng 1 test frontend, và khiến bốn component quay lại câu tiếng Anh trên màn `vi` ở những chỗ không truyền `locale` (tiêu chí 4). Còn hai vấn đề mức chặn, đều do lần gộp này, không phải do các lần gộp trước của phần A.

### Chuẩn bị nhánh

- Worktree sạch. Nhánh local lệch với remote: local có 2 commit chưa push (`472c70a` "Merge T-046 demo chain…", `1a3957c` "docs: handover T-040 demo merge"). Đây là lần thử gộp cũ, đã được làm lại trên remote từ `45ff6a4` (remote có `e6cfd68`, `dcb1361`, `2077cd1`…). Em giữ hai commit đó ở nhánh local `backup/T-040-A-old-attempt-1a3957c`, rồi đưa nhánh local về đúng `origin/feat/T-040-merge-demo-branches` (`4f02265`). Không mất gì: working tree sạch, hai commit vẫn còn ở nhánh backup.
- Merge `--no-ff origin/fight-camp` (`66c0887`): **commit `12ea66a`**, chỉ ở local, **chưa push**. Hai cha: `4f02265`, `66c0887`.
- Trong lúc review, `origin/fight-camp` có thêm `bcddf7c` (chỉ sửa tài liệu). Lần gộp này chưa có commit đó.

### Lần gộp `66c0887`: 15 file xung đột, cùng một nguồn

Phía `fight-camp` có 19 commit mới. Phần lớn là app `reactnative-mobile` (PR #29, không đụng `nextjs-frontend`). Commit gây xung đột là `8c41af94` (Fon, "Refactor video title handling and improve error messaging"). Dù tên commit nói về video, commit này sửa **187 file** của `nextjs-frontend` và thay câu tiếng Anh viết cứng bằng câu tiếng Việt viết cứng. Ở cùng những dòng đó, phía nhánh demo (dịch L0–L2, `048c1ae`, `d62aeae`) đã chuyển sang khoá i18n `t(...)`, hoặc đã có dữ liệu demo tiếng Việt riêng.

| File | Số đoạn | Bên đã giữ ở các đoạn xung đột |
| --- | --- | --- |
| `components/charts/bar-chart.tsx`, `chart-figure.tsx`, `line-chart.tsx`, `radar-chart.tsx` | 1, 2, 2, 1 | demo (`useT()`, chạy theo ngôn ngữ đang chọn) |
| `components/ui/choice-group.tsx`, `form-steps.tsx` | 1, 6 | demo (`useT()`) |
| `components/domain/confidence-meter.tsx`, `status-badges.tsx`, `term-hint.tsx` | 2, 7, 1 | demo (`t` khi có `locale`, tiếng Anh khi không có). **Xem C2** |
| `lib/domain/labels.ts` | 1 | demo: khối `BOUT_STATUS_LABELS`… cũ của T-004 đã đổi tên thành `BOUT_PHASE_LABELS`… ở các lần gộp trước, `fight-camp` chỉ dịch chữ trong khối cũ |
| `lib/format.ts` | 1 | demo: `formatMinutes` theo `locale` |
| `lib/mocks/ai.ts`, `medical.ts`, `people.ts`, `platform.ts` | 17, 88, 2, 7 | demo: dữ liệu demo tiếng Việt L2 đã review ở T-042 |

Các đoạn không xung đột của `8c41af94` vẫn được gộp vào, ví dụ: nhãn `labels.ts`, ngày `dd/mm/yyyy` cho mọi ngôn ngữ trong `format.ts`, `pluralizeVi`, `AIGeneratedBadge` mặc định `vi`. Không có xung đột kiểu xoá/sửa. Không còn dấu xung đột. Typecheck đạt nên không có khoá trùng trong từ điển `*.en.ts`/`*.vi.ts`.

### Lệnh Claude chạy (worktree T-040, `12ea66a`)

```text
$ pnpm --filter nestjs-api lint
… (chỉ warning có sẵn, ví dụ)
src/app.module.ts:18:10: warning eslint(no-unused-vars): Identifier 'NotificationsModule' is imported but never used.
exit 0

$ pnpm --filter nestjs-api build
$ nest build
exit 0

$ pnpm --filter nestjs-api test
 Test Files  6 failed | 62 passed (68)
      Tests  26 failed | 1163 passed (1189)
 FAIL: test/coaching-loop-persistence.spec.ts (5), test/dataset-export-trust-boundary.spec.ts (21),
       4 file spec notifications rỗng ("No test suite found")

$ pnpm --filter nestjs-api test:db
PASS 012 rejects reapplication without changing the applied ledger
Migration checks passed: 49. PostgreSQL stopped after tests.
exit 0

$ pnpm --filter nestjs-api db:check
001-032 checksums OK. No database connection was opened.

$ pnpm --filter nextjs-frontend lint
$ eslint
exit 0

$ pnpm --filter nextjs-frontend typecheck
$ next typegen && tsc --noEmit
✓ Types generated successfully
exit 0

$ pnpm --filter nextjs-frontend test
 FAIL  src/components/admissions/application-summary.test.ts > applicationSummary > shows the answers in the form's words, with the weight limit and the account email
-       "value": "19 Jul 2003",
+       "value": "19/07/2003",
 Test Files  1 failed | 115 passed | 1 skipped (117)
      Tests  1 failed | 1135 passed | 2 skipped (1138)
exit 1

$ APP_DATA_MODE=api pnpm --filter nextjs-frontend build
✓ Compiled successfully in 17.1s
✓ Generating static pages using 11 workers (80/80) in 902ms
exit 0
```

So với [baseline](./BASELINE.md) và baseline ở mục 5 của ticket:

| Lệnh | Kết quả | So với baseline |
| --- | --- | --- |
| backend lint, build | đạt | bằng |
| backend test | 26 lỗi | bằng: đúng B1 (5 + 21). B2 còn 4 file rỗng (baseline 5) |
| `test:db` | 49 ca đạt | tốt hơn: B3 đã sửa từ trước. Handover chưa chạy được lệnh này vì máy không có PostgreSQL |
| `db:check` | đạt | bằng |
| frontend lint, typecheck, build | đạt | bằng |
| frontend test | **1 lỗi mới** | **thêm lỗi**, xem C1 |

`git diff 66c0887 12ea66a -- nestjs-api reactnative-mobile` rỗng: lần gộp không đổi backend hay app mobile so với `fight-camp`.

### Đối chiếu tiêu chí nghiệm thu (phần A)

| # | Tiêu chí | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| 1 | Chứa đầu chuỗi 1 và chuỗi 2; không còn `<<<<<<<` | Đạt | `git merge-base --is-ancestor` trả 0 cho `origin/feat/T-046-embedded-youtube`, `origin/fix/T-032-demo-fixes`, `origin/feat/T-042-043-ui-3d` và `66c0887`. `git grep -n '^<<<<<<<'` rỗng |
| 2 | Frontend lint, typecheck, build sạch | Đạt | Output ở trên |
| 3 | Số test qua ≥ `fight-camp` + test mới; không test nào của ticket nguồn bị xoá hay `skip` | **Chưa đạt** | 18 file test trong bảng của handover đều còn. `suspension-rules.test.ts` của T-004 đã đổi tên thành `bout-suspension-rules.test.ts`, đúng như handover ghi. Hai file có `.skip` (`lib/api/movement-evidence.test.ts`, `worker-live-output.test.ts`) giống hệt `fight-camp`. Nhưng `application-summary.test.ts` (form nhiều bước, `051a660`) lỗi: C1 |
| 4 | Câu đã dịch ở `fight-camp` không quay lại tiếng Anh | **Chưa đạt** | C2 |

### Kiểm các mục trong handover (lấy mẫu)

Các mục sau khớp với code: `WeightWarningBadge = WeightStatusBadge` (`status-badges.tsx`); `suspensionBoutNames()` ở `services/suspensions.ts:298`; `calculateSnapshotAcuteLimit` ở `bout-rules.ts:667`; `weightWarningStatusSchema` được export ở `services/bouts.ts:329`; `coach.suspensions` khai báo một lần ở `routes.ts:62`; `training.demo.ts` gọi cả `throwIfSuspended` lẫn `suspensionGate` khi tạo, sửa và bắt đầu buổi (`:522/525`, `:598/628`, `:787/789`); `bouts.demo.ts:1104` gọi `buildSuspensionTodoItems`; `onboarding-strip.tsx` đã xoá và không còn chỗ nào import; `passwordContext` của PR #22 còn ở `reset-password/page.tsx:34`; `lib/actions/training.ts` dùng khoá `training.schema.exerciseListReadError`. Lần gộp `4f02265` (`2ab1e97`) không có xung đột (`git show --remerge-diff` rỗng).

### Vấn đề

**C1 · chặn.** `nextjs-frontend/src/components/admissions/application-summary.test.ts:18` vẫn chờ `"19 Jul 2003"`, nhưng `8c41af94` đổi `formatDate` thành `dd/mm/yyyy` cho mọi ngôn ngữ (`lib/format.ts:13`, `:40` hàm `slash`). Đây là xung đột về ý nghĩa: test chỉ có ở nhánh demo (khôi phục ở `f276c93`), còn `fight-camp` không có file test này nên không ai sửa theo.
- Tái hiện: `pnpm --filter nextjs-frontend exec vitest run src/components/admissions/application-summary.test.ts`.
- Cách sửa: `fight-camp` đã chọn `dd/mm` cho mọi ngôn ngữ, nên đổi giá trị chờ thành `"19/07/2003"`. Nếu chủ dự án muốn giữ `19 Jul 2003` cho `en` thì đó là sửa `format.ts`, cần hỏi Fon.

**C2 · chặn.** Ở các đoạn xung đột của `confidence-meter.tsx`, `status-badges.tsx` (`ReviewStateBadge`, `ConfidenceBadge`) và `term-hint.tsx`, em giữ bên demo. Bên demo dịch qua `t` khi có prop `locale`, và **khi không có `locale` thì dùng câu tiếng Anh**. Trên `fight-camp` `66c0887`, cùng chỗ đó là câu tiếng Việt. Vì vậy mọi chỗ gọi không truyền `locale` đều quay lại tiếng Anh trên màn `vi`:
- `ReviewStateBadge` (`status-badges.tsx:233`–`260`): "Human verified", "Unreviewed"… ở `components/video/moment-panel.tsx:141`, `detections-panel.tsx:126`.
- `ConfidenceBadge` (`status-badges.tsx:282`): "80% confidence" ở `components/clinical/observation-summary.tsx:46`, `medical/ai-observation-list.tsx:58`, `medical/triage-queue.tsx:229`, `doctor/ai-alerts/[alertId]/page.tsx:94`, `video/video-detail-view.tsx:188`.
- `ConfidenceMeter` (`confidence-meter.tsx:30`, `:32`, `:52`): "unavailable — requires review" và `aria-valuetext` "(review threshold …%)" ở cả 5 chỗ gọi, ví dụ `clinical/observation-card.tsx:66`.
- `TermHint` (`term-hint.tsx:44`): `aria-label` "What is …?" ở 44/55 chỗ gọi.
- Tái hiện: chạy demo mode, `vi`, mở `/doctor/ai-alerts/<id>` hoặc màn video có phát hiện của AI. Trên `fight-camp` các nhãn này là tiếng Việt ("Tin cậy 80%", "Chưa duyệt"); trên `12ea66a` chúng là tiếng Anh.
- Cách sửa, đúng quy tắc "giữ cả hai" của ticket: nhánh không có `locale` lấy lại câu tiếng Việt của `fight-camp` (bên "theirs" của 9 đoạn xung đột đó), hoặc cho bốn component này mặc định `locale = "vi"` như `fight-camp` đã làm với `AIGeneratedBadge` và `Gate1Badge`. Sửa xong thì đổi luôn comment "English when omitted".

**N1 · nên sửa.** Handover chưa có phần cho lần gộp `66c0887` (commit `12ea66a`): danh sách 15 file ở trên, bên đã giữ, kết quả lệnh. Thêm mục "Cập nhật 2/11" giống mục 31/10.

**G1 · gợi ý, ngoài phạm vi phần A, báo chủ dự án và Fon.** Commit `8c41af94` đã có trên `fight-camp` và làm hỏng bản `en` ở nhiều chỗ không qua i18n. Điều này ảnh hưởng tới việc kiểm `en` ở tiêu chí 7 (phần C):
- Mọi nhãn hằng trong `lib/domain/labels.ts` giờ là tiếng Việt, kể cả khi đang ở `en`.
- `lib/format.ts:169`: `JUST_NOW.en = "vừa xong"`.
- Thay hàng loạt "Active" thành "Đang điều trị", nên sai nghĩa ở `USER_STATUS_LABELS` (`labels.ts:82`), `PLAN_STATUS_LABELS` (`:223`), `AI_MODEL_STATUS_LABELS` (`:437`), `CLEARANCE_STATUS_LABELS` (`:553`).
- Tên bác sĩ demo không thống nhất: `mocks/people.ts:72` ghi "Dr. Samuel Brooks", `mocks/medical.ts:40` ghi "BS. Samuel Brooks".
- Tên commit không nói gì về 187 file được dịch.

Nên mở ticket riêng để đưa các câu này vào từ điển.

### Việc cần làm để APPROVED

1. C1: sửa giá trị chờ ở `application-summary.test.ts:18`.
2. C2: khôi phục câu tiếng Việt khi không có `locale` ở bốn component.
3. N1: cập nhật handover.
4. Chạy lại `pnpm --filter nextjs-frontend test` (phải là 0 lỗi), lint và typecheck. Sau đó chủ dự án quyết việc push `12ea66a` cùng các commit sửa.
