# T-040 phần A · Handover

- Nhánh: `feat/T-040-merge-demo-branches` (tạo từ `fight-camp` `77a95eb`)    Commit code cuối: `f276c93`
- Người làm: Claude trên máy Hoàng Anh, theo chỉ đạo của chủ dự án ngày 31/10 ("Làm phần A ở đây"). Theo quyết định 30/10, phần giải xung đột vốn giao cho Codex; lần này Claude giải trực tiếp, theo đúng quy tắc ở mục 2 của ticket.
- Trạng thái: IN REVIEW

## Thứ tự gộp

| Commit | Gộp | Xung đột |
| --- | --- | --- |
| `e6cfd68` | `--no-ff origin/feat/T-046-embedded-youtube` (chuỗi T-004, T-006 B, nhánh demo 27/10, T-010B, T-033, T-046) | 21 file |
| `dcb1361` | `--no-ff origin/fix/T-032-demo-fixes` | 0 |
| `2077cd1` | `--no-ff origin/feat/T-042-043-ui-3d` ở `bf274ab` (APPROVED, xem `T-042-REVIEW.md`) | 0 |
| `f276c93` | Giữ bản dịch admissions của `fight-camp` trên form nhiều bước của nhánh demo; khôi phục `application-summary.test.ts` | — |

## Từng file xung đột (lần gộp đầu) và bên đã giữ

Hai bên có hai merge base (`35a3b76`, `bd1e727`). Mình so từng file theo ba câu hỏi: bên nào sửa file kể từ `35a3b76`, bên nào có khoá i18n mà bên kia không có, và bên kia có câu tiếng Anh viết cứng thay vào chỗ đó không.

| File | Giữ | Lý do |
| --- | --- | --- |
| `docs/SCOPE-FIGHT-CAMP.md`, `docs/tickets/README.md` | `fight-camp` | Theo ticket |
| `coach/dashboard/page.tsx` | demo | `fight-camp` không sửa kể từ `35a3b76`; demo có thêm 7 khoá (hàng đợi bàn giao, `d60b9d0`) |
| `fighter/dashboard/page.tsx`, `components/dashboard/fight-hero.tsx` | demo | `fight-camp` không sửa kể từ `35a3b76`. Các khoá chỉ có ở `fight-camp` (`onboarding.*`, `hero.noSessions`…) thuộc phần demo cố ý làm lại (`b9efefe` "show fighters what blocks them"). Bản demo không có câu tiếng Anh viết cứng nào |
| `components/dashboard/onboarding-strip.tsx` | xoá (demo) | `b9efefe` thay dải onboarding bằng phần "điều gì đang chặn"; không còn ai import |
| `components/layout/navigation.ts`, `navigation.test.ts` | demo | `fight-camp` không sửa kể từ `35a3b76`; demo gom menu admin thành hub |
| `auth/reset-password/page.tsx`, `reset-password-form.tsx` | demo | Bản demo có cả bản dịch (`auth.reset.*`) lẫn tính năng PR #22 (`passwordContext`) mà `fight-camp` đã mất |
| `register/email-code-form.tsx` | demo | Cùng khoá; demo thêm `TermHint` cho mã xác minh |
| `fighter/health/page.tsx`, `examination-summary-card.tsx`, `medical/examination-presets.ts` | `fight-camp` | Bên demo chỉ khác một dòng trống |
| `components/dashboard/care-team-card.tsx` | `fight-camp` | Cùng khoá, bên demo chỉ khác cách xuống dòng |
| `lib/actions/training.ts` | `fight-camp` | Giữ khoá `training.schema.exerciseListReadError`, `planExercisesMax`, `repeat.countInvalid`; bên demo còn câu tiếng Anh |
| `training.en.ts`, `training.vi.ts` | cả hai | Giữ hai khoá của `fight-camp`, thêm 4 khoá `clearanceCheck.noConflictsNamed`, `gate2.*` của demo |
| `(applicant)/apply/page.tsx`, `admissions/application-form.tsx`, `application-progress.tsx` | demo trong `e6cfd68`, rồi bản đã dịch ở `f276c93` | `fight-camp` có bản dịch của form cũ. Demo làm lại thành form nhiều bước (`051a660`) bằng tiếng Anh và có thông báo "đã đặt mật khẩu" của PR #22. `f276c93` lấy đúng các file này từ `feat/ui-p1-p3` (`b34917a`), nơi form nhiều bước đã được dịch: dùng lại khoá `applicant.*` của `fight-camp` và thêm khoá `screens.misc.*`. Không đổi hành vi |

**Không báo xung đột nhưng phải sửa:** `health.en.ts`, `health.vi.ts` bị gộp thành khoá trùng (cả hai bên cùng thêm `careTeam.noDoctor`, `careTeam.noCoach`, `eligibilityReason(Desc).OTHER_MEDICAL_REASON`). Mỗi khoá chỉ giữ một lần. `eligibilityReasonDesc.OTHER_MEDICAL_REASON` khác chữ giữa hai bên: giữ bản của `fight-camp` ("The medical service gave another reason that this app can't show yet…").

## Lệch so với ticket

- **Người giải xung đột:** Claude, không phải Codex (chủ dự án quyết lại ngày 31/10).
- **Ba file admissions** lấy bản đã dịch từ `feat/ui-p1-p3` (nhánh chưa review), kèm `application-summary.ts` và từ điển `screens-misc.en/vi.ts`. Lý do: đây là cách duy nhất giữ được cả bản dịch của `fight-camp` lẫn form mới của demo mà không phải dịch lại từ đầu. `screens-misc` có thêm khoá cho các file khác của `feat/ui-p1-p3` (chưa dùng ở nhánh này, vô hại; khi `feat/ui-p1-p3` merge sẽ trùng nội dung, không xung đột).
- **T-030 B** không chờ, đúng mục 6.

## File test của các ticket nguồn

Tất cả có mặt và qua (`vitest run` 18 file, `Tests 142 passed (142)`):

| Ticket | File test |
| --- | --- |
| T-003 (chuỗi T-004) | `lib/domain/bouts-contract.test.ts`, `lib/services/bouts.api.test.ts` |
| T-004 | `lib/domain/suspension-rules.test.ts`; `a001b21`: `lib/domain/nutrition.test.ts`, `weight-input.test.ts`, `lib/services/bouts.demo.test.ts`; `11c11b5`: `lib/domain/weight-track.test.ts` |
| T-010B | `lib/domain/round-advice.test.ts`, `lib/services/bout-analysis.test.ts` |
| T-033 | `lib/domain/opponent-analysis-form.test.ts`, `opponent-analysis-insights.test.ts`, `opponent-video-suggestions.test.ts` |
| T-042 | `components/fighter-3d/body/body-models.test.ts`, `build.test.ts`, `components/fighter-3d/figure-params.test.ts`, `lib/graphics-tier.test.ts` |
| T-043 | `components/replay/replay-data.test.ts` |
| Form nhiều bước (`051a660`) | `components/admissions/application-summary.test.ts`: khôi phục ở `f276c93` (T-044 đã xoá vì lúc đó form chưa có trên `fight-camp`) |

Test có trong nhánh nguồn nhưng không còn ở đây, đúng theo quyết định của T-044 (`3e7b598`, xoá file không dùng; không file nào còn được import): `lib/api/coaching-client.test.ts`, `reactnative-mobile/.../auth-step-pager.test.tsx`, `auth-step-rail.test.tsx`. T-046 và T-006 B không thêm file test frontend riêng.

## Lệnh đã chạy (trên `f276c93`)

```text
$ pnpm --filter nextjs-frontend lint
$ eslint

$ APP_DATA_MODE=api pnpm --filter nextjs-frontend typecheck
✓ Types generated successfully

$ pnpm --filter nextjs-frontend test
 Test Files  110 passed | 1 skipped (111)
      Tests  987 passed | 2 skipped (989)

$ APP_DATA_MODE=api pnpm --filter nextjs-frontend build
build exit 0

$ pnpm --filter nestjs-api lint
lint exit 0   (5 warning có sẵn)

$ pnpm --filter nestjs-api build
$ nest build
build exit 0

$ pnpm --filter nestjs-api test
 Test Files  6 failed | 62 passed (68)
      Tests  26 failed | 1144 passed (1170)

$ pnpm --filter nestjs-api db:check
001-032 checksums OK. No database connection was opened.
```

- **Tiêu chí 3 (số test frontend):** `fight-camp` `77a95eb` đếm riêng được `813 passed | 2 skipped (815)`. Nhánh gộp có 987 qua, lớn hơn 813 + 142 (test của các file mới) = 955. Phần chênh là các ca mới trong file test sẵn có.
- **Backend:** lần gộp không đổi file nào trong `nestjs-api` (`git diff origin/fight-camp HEAD -- nestjs-api` rỗng). 26 test lỗi đúng là baseline B1 (`coaching-loop-persistence` 5, `dataset-export-trust-boundary` 21, cần Redis và Supabase) và B2 (file spec notifications rỗng).
- **`test:db`:** không chạy được trên máy này (`initdb.exe` không có, máy không cài PostgreSQL). Không có migration nào đổi, `db:check` khớp checksum 001–032.
- **Tiêu chí 1:** `git merge-base --is-ancestor` trả 0 cho `origin/feat/T-046-embedded-youtube`, `origin/fix/T-032-demo-fixes`, `origin/feat/T-042-043-ui-3d`; `git grep -n '^<<<<<<<'` rỗng.

**Kiểm bằng mắt (demo mode, `vi`, Playwright):** mở mọi trang trong menu của bốn vai trò cộng một trang chi tiết cho mỗi dạng đường dẫn, ở 1440 px và 390 px: 172 trang mỗi khổ, 0 lỗi HTTP 5xx, 0 lỗi trang, 0 lỗi console, 0 trang cuộn ngang. Lượt 1440 px đầu bị ngắt vì một trang đang biên dịch lần đầu thì chuyển hướng; chạy lại thì qua.

## Câu hỏi / việc còn mở

- Ken: sau khi phần A merge, merge `fight-camp` mới vào `feat/T-030-suspension-ui` (mục 6).
- Phần C: Dan đề nghị đo hình 3D trên điện thoại thật (thẻ võ sĩ, hồ sơ võ sĩ).
- `feat/ui-foundation`, `feat/ui-p1-p3` (chưa review) và `feat/T-009-nutrition-ui` (chờ T-009 A) gộp sau, không thuộc phần A.
