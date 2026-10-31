# T-021 Review

- Ngày review: 24/10/2026, Claude.
- Phạm vi: `feat/T-021-i18n-e2e`: `e96817d` (phần dở của lượt Gemini 20/10, Claude commit khi lượt đó hết quota), `93aa85b` (Claude merge `fight-camp`), `bbcef28`, `e962b98` (Gemini lượt 2).
- **Kết luận: CHỜ CHẠY E2E.** Code đạt và không có vấn đề mức "chặn". Tiêu chí 1–2 bắt buộc phải chạy Playwright với server thật (`E2E_PASSWORD`, `.env` nối Supabase), mà Gemini và Claude không được làm. Cần một dev có `.env` (đề xuất Hoàng Anh) chạy theo mục "Việc còn lại", rồi mới APPROVED.

## Lệnh đã chạy lại (trong `D:/test/ai-worktrees/T-021` tại `e962b98`)

```text
typecheck : ✓ Types generated successfully
test      : Test Files  76 passed | 1 skipped (77)
                 Tests  657 passed | 2 skipped (659)
eslint e2e: không có lỗi, exit 0
test:e2e  : chưa chạy (cần E2E_PASSWORD và server nối Supabase)
```

Khớp với output trong handover.

## Đối chiếu tiêu chí

| Tiêu chí | Kết quả | Ghi chú |
| --- | --- | --- |
| 1. `test:e2e` qua toàn bộ | Chưa kiểm | Fixture tự động `defaultLocale` (`e2e/fixtures.ts`) đặt `mma_locale=en` trước mọi test, đúng thiết kế |
| 2. Xoá cookie `en` thì `landing.spec.ts` lỗi | Chưa kiểm | Handover mới lập luận từ `DEFAULT_LOCALE = "vi"`, chưa có bằng chứng chạy |
| 3. `locale.spec.ts` đủ bốn bước | Đạt (đọc code) | Không cookie → `/login` tiếng Việt, `lang="vi"`; đổi English; reload vẫn English; đổi lại Tiếng Việt |

Phạm vi đúng: chỉ sửa `nextjs-frontend/e2e/` và handover. `submitLoginForm` nhận nhãn cả hai ngôn ngữ, nên spec `locale.spec.ts` đăng nhập được khi đang ở tiếng Việt.

## Vấn đề

| # | Mức | Vị trí | Vấn đề | Xử lý |
| --- | --- | --- | --- | --- |
| 1 | Gợi ý | `e2e/contrast.spec.ts`, `VI_TRANSLATED_SCREENS` | `/fighter/bout` dùng `h1: /.+/`, nên không chứng minh được trang đang ở tiếng Việt | Thay bằng tiêu đề tiếng Việt cụ thể khi chạy e2e |
| 2 | Gợi ý | `e2e/fixtures.ts`, `submitLoginForm` | `exact: true` bị Playwright bỏ qua khi tham số là RegExp | Vô hại; có thể bỏ |

## Việc còn lại (dev có `.env`)

1. Chạy backend và frontend ở API mode (TEAM-WORKFLOW §3a), đặt `E2E_PASSWORD`, rồi chạy `pnpm --filter nextjs-frontend test:e2e` trên nhánh này. Dán dòng tổng kết vào handover. Lỗi nào cũng xuất hiện trên `fight-camp` thì ghi kèm bằng chứng.
2. Tạm xoá fixture `defaultLocale` và chạy `pnpm --filter nextjs-frontend exec playwright test e2e/landing.spec.ts`: phải lỗi. Ghi output, rồi khôi phục fixture.
