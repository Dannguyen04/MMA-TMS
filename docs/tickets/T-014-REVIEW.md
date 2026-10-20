# T-014 Review

- Ngày review: 20/10/2026, Claude.
- Phạm vi: nhánh `feat/T-014-i18n-auth-account`, commit `7c1a62a` (7 commit trên `fight-camp`, 62 file, +1782/−539). Gemini 3.8 Flash thực hiện qua Antigravity.
- **Kết luận: APPROVED.** Không có vấn đề mức "chặn". Có 3 vấn đề "nên sửa" và 3 "gợi ý", không cái nào cần chặn merge.

## Lệnh đã chạy lại

Chạy trên `7c1a62a` trong worktree của nhánh (lúc đó máy đang chạy thêm 6 tiến trình Gemini khác):

```text
$ pnpm --filter nextjs-frontend lint
$ eslint                                   (không lỗi)

$ pnpm --filter nextjs-frontend typecheck
✓ Types generated successfully

$ pnpm --filter nextjs-frontend test       (lần 1)
 FAIL  src/lib/services/training.test.ts > training API adapter > loads demo data only when demo mode is explicitly enabled
 Test Files  1 failed | 75 passed | 1 skipped (77)
      Tests  1 failed | 655 passed | 1 skipped (657)

$ npx vitest run src/lib/services/training.test.ts   (chạy riêng)
      Tests  18 passed (18)

$ pnpm --filter nextjs-frontend test       (lần 2)
 Test Files  76 passed | 1 skipped (77)
      Tests  656 passed | 1 skipped (657)
```

Lần 1 lỗi một test không liên quan: nhánh không sửa `training.test.ts`, `training.ts` hay `src/lib/mocks`. Test qua khi chạy riêng và qua ở lần chạy đầy đủ thứ hai, nên tôi coi là lỗi chập chờn do tải máy, không phải lỗi của ticket. Handover ghi "656 passed" không khớp lần chạy đầu của tôi nhưng khớp lần hai.

## Đối chiếu tiêu chí nghiệm thu

| # | Kết quả | Căn cứ |
| --- | --- | --- |
| 1 | Đạt, trừ ghi chú dưới | Quét chữ Anh trong `(auth)`, `(applicant)`, `settings`, `profile`, `notifications`, `components/account`, `notification-bell.tsx`, `global-error.tsx`, `lib/actions/{account,notifications,auth}.ts`, `account-errors.ts`: chỉ còn "Lotus Combat Academy" (tên thương hiệu). Vấn đề 1 về `components/admissions` |
| 2 | Đạt (kiểm bằng phương pháp gần đúng) | Tôi lấy 177 chuỗi tiếng Anh bị xoá khỏi diff và tìm trong các từ điển `*.en.ts`: 167 có mặt. 10 chuỗi còn lại đã giải thích được: 8 câu lỗi validate của `medical-contract.ts` (giữ nguyên làm giá trị mặc định khi không truyền `t`), "Lotus Combat Academy", và hai câu thông báo bị đổi dấu chấm (vấn đề 3) |
| 3 | Đạt | `regional-settings.tsx` dùng `INTL_LOCALE[locale]`; badge `RoleBadge`, `UserStatusBadge` có prop `locale` |
| 4 | Đạt | `translate.test.ts` nằm trong 656 test qua |
| 5 | Chưa kiểm tra | Handover thừa nhận chưa kiểm tra 390 px. Tôi cũng chưa mở trình duyệt |
| 6 | Đạt | Không test nào bị sửa; số test không đổi (656) |

Mục 7 của ticket (chữ Anh sót từ review T-005 và T-013): `loading.tsx` của 4 màn, chuông thông báo, `global-error.tsx` (đọc cookie ở client), bỏ trường `message` trong `recordSelfWeight`, thẻ onboarding và nhãn Weight trên Today của võ sĩ đều có trong diff.

## Vấn đề

| # | Mức | Vị trí | Mô tả | Cách tái hiện |
| --- | --- | --- | --- | --- |
| 1 | Nên sửa | Handover, tiêu chí 1 | Handover nói đã dịch toàn bộ `src/components/admissions/**`, nhưng diff chỉ sửa `application-form.tsx`, `application-progress.tsx` (và `activate-account-form.tsx`). `admission-admin-forms.tsx`, `assessment-form.tsx`, `application-views.tsx` vẫn tiếng Anh. Đó là các màn của HLV và admin thuộc `coach/admissions`, `admin/admissions` (đóng băng) nên không sai phạm vi, nhưng handover mô tả sai | `rg -n 'label="' nextjs-frontend/src/components/admissions` |
| 2 | Nên sửa | `src/lib/actions/medical-contract.ts:53-57` | `boundedText` nội suy `label` bằng tên trường tiếng Anh thô (ví dụ "reasoning") vào câu tiếng Việt: "Không nhập reasoning quá 500 ký tự". Số cũng định dạng `toLocaleString("en-US")` dù đang ở tiếng Việt. Phần này dùng ở form bác sĩ nên thuộc T-017 | Gửi form khám với lý do vượt giới hạn khi `mma_locale=vi` |
| 3 | Nên sửa | `src/lib/i18n/messages/account.en.ts` (`notifications.noNotificationsYet`, `notifications.emptyCaughtUpTitle`) | Hai câu tiếng Anh đổi so với bản cũ ("No notifications yet." mất dấu chấm). Ticket yêu cầu bản tiếng Anh giống hệt trước khi sửa | So `git diff fight-camp...HEAD -- src/components/layout/notification-bell.tsx` |
| 4 | Gợi ý | Handover, Thay đổi | Ghi `useTranslation()` nhiều chỗ, nhưng code dùng `useT()` (không có hàm `useTranslation`). Sai chữ trong tài liệu, code đúng | `rg useTranslation nextjs-frontend/src` |
| 5 | Gợi ý | Handover, tiêu chí 5 | Lý do "môi trường không có màn hình" cho việc không kiểm tra 390 px chưa thuyết phục (có thể chạy Playwright headless). T-021 sẽ có e2e | — |
| 6 | Gợi ý | Lịch sử git | Gemini chạy `git reset` lùi 2 commit trên nhánh chưa push rồi làm lại. Quy tắc cho phép (chỉ cấm với commit đã push); không ảnh hưởng kết quả | `git reflog` |

## Câu hỏi / việc còn mở

- Vấn đề 2: thêm vào phạm vi T-017 (đã ghi vào ticket).
- Có thể merge `feat/T-014-i18n-auth-account` vào `fight-camp`. Chủ dự án quyết định.
