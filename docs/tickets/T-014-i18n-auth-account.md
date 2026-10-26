# T-014 · Tiếng Việt: đăng nhập, đăng ký, tài khoản

| | |
| --- | --- |
| **Trạng thái** | READY (chủ dự án duyệt 20/10) |
| **Phần** | Frontend (`nextjs-frontend`) |
| **Nhánh** | `feat/T-014-i18n-auth-account` từ `fight-camp` mới nhất |
| **Thuộc** | Phần 3 của [T-013](./T-013-i18n-vi.md). Mục "Thiết kế" và "Quy ước khi dịch" của T-013 áp dụng nguyên văn |

## Bối cảnh

Hạ tầng song ngữ (`src/lib/i18n/`) đã nằm trong `fight-camp`. Khu vực dưới đây chưa dùng hoặc mới dùng một phần `useT()` / `getTranslator()`, nên còn hiện tiếng Anh khi người dùng chọn tiếng Việt.

## Phạm vi

Tiền tố key: `auth.`, `account.`, `notifications.`. Cặp file mới: `messages/account.en.ts` / `account.vi.ts`.

1. **Rà soát đăng nhập và Today của võ sĩ** (đã có `messages/auth.*`, `messages/fighter-today.*`): tìm chữ Anh còn sót trong `src/app/(auth)/**`, `src/app/(app)/fighter/page.tsx`, `src/components/dashboard/{fight-hero,readiness-strip}.tsx`, `src/components/domain/{week-agenda,session-list-item,coach-feedback-item,ai-notice}.tsx`; dịch nốt, liệt kê trong handover những chỗ đã sót.
2. **Đăng ký, quên mật khẩu, đặt lại mật khẩu**: `src/app/(auth)/{register,forgot-password,auth/reset-password}/**`.
3. **Applicant**: `src/app/(applicant)/**`.
4. **Tài khoản**: `src/app/(app)/{profile,settings,notifications}/**`, `src/components/account/**` (không đụng `LanguageSwitcher`), `src/lib/actions/{auth,account,notifications}.ts`, `src/lib/services/account-errors.ts`, `src/components/domain/notification-meta.ts`.
5. `src/components/account/regional-settings.tsx` đang tạo `Intl.DateTimeFormat("en-US")`; chọn theo locale hiện hành (`INTL_LOCALE` trong `src/lib/i18n/config.ts`).
6. `src/lib/actions/medical-contract.ts` (dòng ~56) có câu `Keep the … under … characters` dùng chung nhiều form. Dịch ở ticket này bằng cách nhận `t` từ nơi gọi; không đọc cookie trong hàm thuần.
7. **Chữ Anh còn sót từ review T-005 và T-013** ([T-005-REVIEW](./T-005-REVIEW.md), [T-013-REVIEW](./T-013-REVIEW.md)):
    - Nhãn `loading.tsx` của `fighter/bout`, `fighter/bout/weigh-in`, `fighter/dashboard`, `coach/dashboard`.
    - `src/components/layout/notification-bell.tsx`: `label="Notifications"` và toast `"Done"`.
    - `src/app/(app)/fighter/dashboard/page.tsx`: nhãn `Weight` và các thẻ onboarding.
    - `src/lib/services/people.ts` (`recordSelfWeight`): ba câu `message` tiếng Anh; bỏ trường `message` nếu không ai dùng, hoặc dịch ở nơi gọi.
    - `src/app/global-error.tsx`: `lang="en"` và chữ Anh cố định. Không đọc được `cookies()` ở đây; chọn ngôn ngữ phía client từ cookie `mma_locale` (tên lấy từ `LOCALE_COOKIE`), mặc định tiếng Việt.

## Ngoài phạm vi

- Route đóng băng (ẩn khỏi menu theo T-001): `fighter/{performance,goals}`, `coach/{performance,goals,admissions}`, `doctor/{medical-records,examinations,recovery,ai-alerts}`, `admin/{admissions,ai-models}`.
- Landing page và `src/app/concept/`: chưa quyết, xem README.
- Không đổi logic, route, schema, backend; không cài thư viện; không dịch tên riêng và dữ liệu người dùng nhập.

## Tiêu chí nghiệm thu

1. Với `mma_locale=vi` (hoặc không có cookie), các màn trong phạm vi không còn chữ Anh viết cứng, kể cả `aria-label`, `title`, placeholder, toast, `loading.tsx` và lỗi từ Server Action / `account-errors.ts`. Chữ giữ nguyên (tên riêng, dữ liệu) được liệt kê trong handover.
2. Với `mma_locale=en`, nội dung giống trước ticket.
3. Ngày giờ truyền `locale` cho các hàm trong `src/lib/format.ts`; badge dùng prop `locale`.
4. `translate.test.ts` qua; không key rỗng, placeholder khớp hai ngôn ngữ.
5. Không cuộn ngang ở 390 px (kiểm tra tay, ghi vào handover).
6. Test hiện có vẫn qua; test nào đổi vì câu chữ thì ghi lý do.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```
