# T-013 Review (phần 1 và phần 2)

- Ngày review: 20/10/2026, Claude. Review sau khi đã merge (theo yêu cầu trực tiếp của chủ dự án).
- Phạm vi: `feat/T-013-i18n-vi` (`c5cdb70`), đã nằm trong `fight-camp` qua merge `a3bb3bb`. Phần 1 (hạ tầng, khung app, màn T-005) do Claude viết ngày 19/10; phần 2 (màn trận của HLV) do Gemini viết.
- **Kết luận: APPROVED**, không có vấn đề mức "chặn". Có 4 vấn đề "nên sửa" (đều cùng loại: nhãn trợ năng còn tiếng Anh), 2 "gợi ý". Tiêu chí 3 chưa hoàn toàn đạt ở phần khung và màn T-005; các lỗi nhỏ, không đổi hành vi, đã chuyển vào T-014.

## Hạn chế của lần review này

- **Không độc lập ở phần 1**: Claude viết, nên tôi chỉ chạy lại lệnh và kiểm tra các điểm rủi ro. Phần 2 của Gemini được đọc như bình thường.
- **Chưa kiểm tra tay.** Tôi không mở trình duyệt, nên tiêu chí 1, 2, 4, 6 (hiện tiếng Việt khi chưa có cookie, đổi ngôn ngữ, định dạng ngày, 390 px) chưa được chạy lại. Chưa chạy e2e (xem T-021).

## Lệnh đã chạy lại

Chạy trên `fight-camp` tại `a2f66e8`:

```text
$ pnpm --filter nextjs-frontend typecheck
✓ Types generated successfully

$ pnpm --filter nextjs-frontend test
 Test Files  76 passed | 1 skipped (77)
      Tests  656 passed | 1 skipped (657)

$ npx eslint src e2e      (trong nextjs-frontend)
(không lỗi, exit 0)
```

`pnpm --filter nextjs-frontend lint` toàn thư mục báo lỗi do thư mục thừa `nextjs-frontend/nextjs-frontend/.next/` (bản build dev, git bỏ qua), không do mã nguồn. Xem T-005-REVIEW.

## Đối chiếu tiêu chí nghiệm thu

| # | Kết quả | Căn cứ |
| --- | --- | --- |
| 1 | Đạt theo mã | `DEFAULT_LOCALE = "vi"`, `parseLocale` rơi về `vi`; `src/app/layout.tsx:52` đặt `<html lang={locale}>` |
| 2 | Chưa chạy lại tay | `LanguageSwitcher` và `setLocalePreference` có mặt; nên được T-021 phủ bằng e2e |
| 3 | **Chưa đạt hoàn toàn** | Các màn trận của HLV sạch theo handover phần 2. Còn sót chữ Anh ở vấn đề 1–4 dưới đây |
| 4 | Đạt theo mã | `format.ts` nhận `locale`; `session-list-item.tsx` dùng `INTL_LOCALE` |
| 5 | Đạt | `translate.test.ts` trong 656 test qua |
| 6 | Chưa chạy lại tay | — |

## Vấn đề

| # | Mức | Vị trí | Mô tả | Cách tái hiện |
| --- | --- | --- | --- | --- |
| 1 | Nên sửa | `loading.tsx` của `fighter/bout`, `fighter/bout/weigh-in`, `fighter/dashboard`, `coach/dashboard` | Bốn nhãn `Loading …` viết cứng tiếng Anh, thuộc các màn mà phần 1 nói đã dịch | `mma_locale=vi`, xem `aria-label` khi tải trang |
| 2 | Nên sửa | `src/components/layout/notification-bell.tsx:31,37` | `label="Notifications"` của `Popover` và toast `"Done"` còn tiếng Anh; thuộc khung app | Mở chuông thông báo, bấm "đánh dấu đã đọc" ở tiếng Việt |
| 3 | Nên sửa | `src/app/(app)/fighter/dashboard/page.tsx:224,362-405` | Nhãn `Weight` và thẻ onboarding còn tiếng Anh. Thuộc Today của võ sĩ, T-014 mục 1 | Mở `/fighter/dashboard` ở tiếng Việt |
| 4 | Nên sửa | `src/app/global-error.tsx:7-19` | Trang lỗi toàn cục cố định `lang="en"` và chữ Anh. Không dùng được `cookies()` ở đây nên cần cách riêng (ví dụ đọc `document.cookie` ở client) | Gây lỗi gốc để thấy `GlobalError` |
| 5 | Gợi ý | Handover phần 2 | Nêu "Không có" ở mục Lệch và Câu hỏi nhưng đã tách `bout-schemas.ts` ở vòng 2; nên ghi vào mục Thay đổi (có ghi ở vòng 2, chấp nhận được) | — |
| 6 | Gợi ý | `translate.test.ts` | Test kiểm tra key và placeholder khớp, nhưng không kiểm tra bản `vi` không chứa nguyên văn bản `en` (bắt trường hợp quên dịch). Có thể thêm cảnh báo, không chặn | — |

## Câu hỏi / việc còn mở

- Vấn đề 1–4 đã được thêm vào phạm vi T-014 (mục 1 rà soát, mục 4 khung tài khoản và `global-error.tsx`).
- Chạy e2e và kiểm tra tay tiêu chí 2, 6 khi làm T-021.
