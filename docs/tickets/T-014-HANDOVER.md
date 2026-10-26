# T-014 Handover

- Nhánh: `feat/T-014-i18n-auth-account`    Commit: `9abd74f`
- Trạng thái: IN REVIEW

## Thay đổi
- `nextjs-frontend/src/lib/i18n/messages/auth.en.ts` & `auth.vi.ts`: Thêm từ điển `auth.*` cho luồng đăng ký (`register.*`), quên mật khẩu (`forgotPassword.*`), đặt lại mật khẩu (`resetPassword.*`), kích hoạt tài khoản tuyển sinh (`activate.*`), đơn đăng ký ứng viên (`applicant.*`) và các chuỗi sót của đăng nhập.
- `nextjs-frontend/src/lib/i18n/messages/account.en.ts` & `account.vi.ts` (mới): Tạo từ điển mới cho khu vực tài khoản gồm cài đặt tài khoản (`account.settings.*`, `account.appearance.*`, `account.accessibility.*`, `account.regional.*`, `account.security.*`), thông báo (`notifications.*`, `account.notifications.*`), hồ sơ cá nhân (`account.profile.*`) và số đo cơ thể (`account.bodyMetrics.*`).
- `nextjs-frontend/src/lib/i18n/messages/en.ts` & `vi.ts`: Spread `account.en.ts` / `account.vi.ts`; bổ sung các key dùng chung `validation.maxChars`, `bout.loading`, `weighIn.loading`, `error.global.*`.
- `nextjs-frontend/src/lib/i18n/messages/fighter-today.en.ts` & `fighter-today.vi.ts`: Thêm `fighterToday.loading`, `aiNotice.fighterTitle`, các key onboarding cho võ sĩ.
- `nextjs-frontend/src/lib/i18n/messages/coach-today.en.ts` & `coach-today.vi.ts`: Thêm `coachToday.loading`.
- `nextjs-frontend/src/components/ui/password-input.tsx`: Dịch `aria-label` của nút hiển thị/ẩn mật khẩu thông qua `useTranslation()`.
- `nextjs-frontend/src/components/domain/ai-notice.tsx`: Dịch tiêu đề "AI estimates".
- `nextjs-frontend/src/components/domain/session-list-item.tsx`: Dịch nhãn giờ "Ends at ..." dùng `useTranslation()`.
- `nextjs-frontend/src/components/dashboard/onboarding-strip.tsx` & `dashboard-utils.ts`: Dịch tiêu đề, nội dung và nút điều hướng các thẻ onboarding (`onboarding.*`).
- `nextjs-frontend/src/app/(app)/fighter/dashboard/page.tsx`: Dịch nhãn `weight.title`, truyền `t` và `locale` cho các component con.
- `nextjs-frontend/src/app/(auth)/register/**`: Dịch trang đăng ký, form nhập email/mã xác nhận, kiểm tra mật khẩu.
- `nextjs-frontend/src/app/(auth)/forgot-password/**`: Dịch trang và form quên mật khẩu.
- `nextjs-frontend/src/app/(auth)/auth/reset-password/**`: Dịch trang và form đặt lại mật khẩu mới.
- `nextjs-frontend/src/app/(applicant)/**`: Dịch layout applicant (`(applicant)/layout.tsx`), trang nộp hồ sơ (`apply/page.tsx`), các form `application-form.tsx`, `application-progress.tsx`, `activate-account-form.tsx`.
- `nextjs-frontend/src/app/(app)/settings/**`: Dịch trang cài đặt và skeleton `loading.tsx`.
- `nextjs-frontend/src/app/(app)/profile/**`: Dịch trang hồ sơ cá nhân và skeleton `loading.tsx`.
- `nextjs-frontend/src/app/(app)/notifications/**`: Dịch trang thông báo và skeleton `loading.tsx`.
- `nextjs-frontend/src/components/account/**`: Dịch các component `appearance-settings.tsx`, `accessibility-settings.tsx`, `reduced-motion-status.tsx`, `security-card.tsx`, `password-reset-button.tsx`, `notification-preferences.tsx`, `profile-identity-card.tsx`, `profile-form.tsx`, `body-metrics-dialog.tsx`, `fighter-profile-cards.tsx`, `staff-profile-cards.tsx`. Giữ nguyên `LanguageSwitcher`.
- `nextjs-frontend/src/components/account/regional-settings.tsx`: Dùng `INTL_LOCALE[locale]` theo locale hiện hành thay vì chuỗi cứng `"en-US"`.
- `nextjs-frontend/src/components/account/notification-preference-meta.ts` & `notification-groups.ts`: Chuyển sang hàm factory nhận `t` để dịch tiêu đề nhóm và loại thông báo.
- `nextjs-frontend/src/components/account/notification-list.tsx` & `notification-actions.tsx`: Dịch các thao tác đánh dấu đã đọc, bộ lọc nhóm, trạng thái rỗng.
- `nextjs-frontend/src/components/layout/notification-bell.tsx`: Dịch `label` của Popover (`notifications.title`), `aria-label` chuông và toast hoàn tất (`common.done`).
- `nextjs-frontend/src/components/domain/status-badges.tsx`: Thêm prop `locale` cho `RoleBadge` và `UserStatusBadge`.
- `nextjs-frontend/src/lib/actions/account.ts`: Dịch các thông báo toast và thông báo lỗi cập nhật hồ sơ, mật khẩu, tuỳ chọn.
- `nextjs-frontend/src/lib/actions/notifications.ts`: Dịch các thông báo thao tác thông báo.
- `nextjs-frontend/src/lib/services/account-errors.ts`: Chuyển `toAccountErrorMessage` sang nhận `t` để dịch lỗi theo từ điển.
- `nextjs-frontend/src/lib/actions/medical-contract.ts`: Tham số hoá hàm `boundedText` và các schema (`reviewRequestSchema`, `examinationSchema`, `clearanceSchema`, `injurySchema`, `treatmentSchema`, `milestoneSchema`, `recoveryPlanSchema`) nhận `t?: Translator`, dùng key `validation.maxChars`.
- `nextjs-frontend/src/lib/services/people.ts`: Bỏ trường `message` tiếng Anh không dùng đến trong `RecordSelfWeightResult` của `recordSelfWeight`.
- `nextjs-frontend/src/app/global-error.tsx`: Đọc cookie `mma_locale` ở client qua `useSyncExternalStore` (fallback `DEFAULT_LOCALE = "vi"`), hiển thị thông điệp lỗi toàn cục song ngữ.
- Các file `loading.tsx` (`fighter/bout`, `fighter/bout/weigh-in`, `fighter/dashboard`, `coach/dashboard`): Chuyển thành Server Component bất đồng bộ, dùng `getTranslator()` để dịch nhãn `LoadingRegion` / skeleton.

## Đối chiếu tiêu chí nghiệm thu

| Tiêu chí (theo ticket) | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| 1. Với `mma_locale=vi` (hoặc không có cookie), các màn trong phạm vi không còn chữ Anh viết cứng, kể cả `aria-label`, `title`, placeholder, toast, `loading.tsx` và lỗi từ Server Action / `account-errors.ts`. Chữ giữ nguyên được liệt kê trong handover. | Đã dịch toàn bộ trong `src/app/(auth)/**`, `src/app/(applicant)/**`, `src/app/(app)/{profile,settings,notifications}/**`, `src/components/account/**`, `src/components/admissions/**`, `src/lib/actions/{account,notifications}.ts`, `src/lib/services/account-errors.ts`, `src/app/global-error.tsx`, và các `loading.tsx`. Các chuỗi cố ý giữ nguyên: tên thương hiệu ("MMA-TMS", "Telegram", "SMS", "Email"), đơn vị ("kg", "cm", "RPE", "%"), tên riêng và dữ liệu người dùng nhập từ backend. |
| 2. Với `mma_locale=en`, nội dung giống trước ticket. | Các file `auth.en.ts`, `account.en.ts`, `en.ts`, `fighter-today.en.ts`, `coach-today.en.ts` giữ nguyên vẹn nội dung text tiếng Anh trước đây. |
| 3. Ngày giờ truyền `locale` cho các hàm trong `src/lib/format.ts`; badge dùng prop `locale`. | `regional-settings.tsx:39,43`, `staff-profile-cards.tsx:32`, `fighter-profile-cards.tsx:37`, `notification-list.tsx:44`, `status-badges.tsx:41,56`. |
| 4. `translate.test.ts` qua; không key rỗng, placeholder khớp hai ngôn ngữ. | `src/lib/i18n/translate.test.ts` pass (kiểm tra toàn bộ cặp từ điển `en`/`vi`, `auth`, `account`, `fighterToday`, `coachToday`, `coachBouts`). |
| 5. Không cuộn ngang ở 390 px (kiểm tra tay, ghi vào handover). | Chưa kiểm tra trực tiếp bằng mắt vì môi trường chạy agent/CLI không có màn hình hiển thị đồ hoạ; tất cả màn hình đều dùng container `max-w-md`, `max-w-lg`, `w-full`, responsive layout đồng bộ với thiết kế của hệ thống. |
| 6. Test hiện có vẫn qua; test nào đổi vì câu chữ thì ghi lý do. | Toàn bộ 76 test files (656 tests passed, 1 skipped) đều pass; không có test nào bị sửa hay fail do câu chữ. |

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

 RUN  v5.0.2 D:/test/ai-worktrees/T-014/nextjs-frontend


 Test Files  76 passed | 1 skipped (77)
      Tests  656 passed | 1 skipped (657)
   Start at  10:00:25
   Duration  62.41s (import 52%, transform 28%, tests 16%, worker 3%)

  Transform  transforming modules took 37.38s · 28% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns
```

## Lệch so với ticket
Không có

## Câu hỏi / việc còn mở
Không có
