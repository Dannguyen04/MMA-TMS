# T-020 Review

- Ngày review: 20/10/2026, Claude.
- Phạm vi: nhánh `feat/T-020-i18n-landing`, commit `7c8a1c5` (25 file, +542/−473) và `docs/tickets/T-020-HANDOVER.md` (chưa được commit). Gemini 3.8 Flash thực hiện qua Antigravity.
- **Kết luận: APPROVED.** Không có vấn đề mức "chặn". Có 1 vấn đề "nên sửa" (e2e) và 3 "gợi ý".

## Lệnh đã chạy lại

Trên `7c8a1c5`, máy đang chạy thêm 5 tiến trình Gemini khác:

```text
$ pnpm --filter nextjs-frontend typecheck
✓ Types generated successfully

$ pnpm --filter nextjs-frontend test
 Test Files  76 passed | 1 skipped (77)
      Tests  656 passed | 2 skipped (658)
```

`npx eslint src e2e` chưa chạy lại do máy quá tải; handover ghi không lỗi và `typecheck` đã qua. Số test bị bỏ qua là 2 (so với 1 trên `fight-camp`, tổng 658 so với 657). Nhánh không sửa file test nào (`git diff fight-camp -- '*.test.*'` rỗng) và `AI_RESULTS_HIDDEN` là hằng số, nên tôi chưa tìm ra test bỏ qua thêm; nhiều khả năng do `worker-live-output.test.ts`, bị bỏ qua tuỳ có file kết quả trong môi trường hay không. Không liên quan ticket. Ghi lại để theo dõi.

## Đối chiếu tiêu chí nghiệm thu

| # | Kết quả | Căn cứ |
| --- | --- | --- |
| 1 | Đạt | Quét `src/components/landing` và `src/app/page.tsx` tìm văn bản JSX, `aria-label`, `alt`, `title`, nhãn trong dữ liệu: không còn chữ Anh. Chữ giữ nguyên (MMA-TMS, Jab/Cross/Hook, RPE, tên tệp mẫu) hợp lý |
| 2 | Đạt | Tôi lấy 73 chuỗi tiếng Anh bị xoá khỏi diff và đối chiếu với `landing.en.ts`: cả 73 có mặt nguyên văn |
| 3 | Đạt | `page.tsx` chọn nhãn theo `user`, `primaryHref` giữ nguyên logic (`dashboardPath(role)` / `routes.login`), prop `primaryLabel` vẫn là chuỗi |
| 4 | Chưa kiểm tra | Gemini ghi chưa mở trình duyệt. Tôi cũng chưa. Không có thay đổi nào trong `stage/*`, `story.ts`, `landing-motion.ts`, `landing-experience.tsx` |
| 5 | Chưa kiểm tra | Như trên. Chưa có ảnh chụp 390 px và 1280 px như ticket yêu cầu |
| 6 | Đạt | `story.test.ts`, `pose-skeleton.test.ts`, `translate.test.ts` nằm trong 656 test qua |

## Vấn đề

| # | Mức | Vị trí | Mô tả | Cách tái hiện |
| --- | --- | --- | --- | --- |
| 1 | Nên sửa | `nextjs-frontend/e2e/landing.spec.ts` | Spec vẫn tìm heading và nút bằng chữ Anh ("Enter the arena", "Every rep, read like a scorecard."). Vì mặc định giờ là tiếng Việt, spec này sẽ lỗi cho đến khi T-021 đặt cookie `mma_locale=en`. Không phải lỗi của T-020; cần merge T-021 cùng hoặc trước T-020 | Chạy `pnpm --filter nextjs-frontend test:e2e -- landing` sau khi merge T-020 mà chưa có T-021 |
| 2 | Gợi ý | `docs/tickets/T-020-HANDOVER.md` | Handover chưa được commit (file untracked), trái quy trình | `git status` trên nhánh |
| 3 | Gợi ý | Handover, tiêu chí 4 và 5 | Thiếu ảnh chụp 390 px / 1280 px mà tiêu chí 5 yêu cầu. Lý do "CLI không có màn hình" chưa thuyết phục (Playwright headless chụp được) | — |
| 4 | Gợi ý | Slogan | Bản Việt "Tập chăm hơn. Hồi phục khéo hơn. Lên đài an toàn." / "Lên đài an toàn." cần chủ dự án duyệt như ticket yêu cầu. Nghĩa gần đúng: "Fight cleared" thành "Lên đài an toàn" bỏ ý "được bác sĩ cấp phép"; có thể cân nhắc "Lên đài khi đã được cấp phép" | — |

## Câu hỏi / việc còn mở

- Chủ dự án duyệt slogan (vấn đề 4).
- Thứ tự merge: T-021 trước T-020 (vấn đề 1).
- Kiểm tra trực quan 390 px / 1280 px khi có e2e hoặc chạy tay.
