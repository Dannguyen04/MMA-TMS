# T-020 · Tiếng Việt: landing page

| | |
| --- | --- |
| **Trạng thái** | DRAFT (Claude viết 20/10) |
| **Phần** | Frontend (`nextjs-frontend`) |
| **Nhánh** | `feat/T-020-i18n-landing` từ `fight-camp` mới nhất |
| **Thuộc** | Phần 3 của [T-013](./T-013-i18n-vi.md). Mục "Thiết kế" và "Quy ước khi dịch" của T-013 áp dụng nguyên văn |
| **Quyết định** | Chủ dự án, 20/10: dịch landing page |

## Bối cảnh

Landing page (`/`) là trang công khai đầu tiên người xem demo thấy, nhưng còn 100% tiếng Anh: tiêu đề trang, mô tả, nút "Enter the arena" / "Open dashboard" trong `src/app/page.tsx`, các chương trong `src/components/landing/`. Trang này có cuộn kể chuyện và cảnh WebGL; chỉ chữ hiển thị được dịch, không đổi cảnh, chuyển động hay bố cục.

`src/app/concept/fight-camp/` **không cần dịch**: bản thử nghiệm này đã viết hoàn toàn bằng tiếng Việt (`lang="vi"`). Không sửa.

## Phạm vi

Tiền tố key: `landing.`. Cặp file mới: `messages/landing.en.ts` / `landing.vi.ts`.

- `src/app/page.tsx`: `metadata` chuyển sang `generateMetadata()` dùng `getTranslator()`; nhãn nút chính.
- `src/components/landing/{landing-page,landing-header,landing-experience}.tsx`.
- `src/components/landing/chapters/{analysis,training,performance,medicine,roles}-chapter.tsx` và `chapter-parts.tsx`.
- `src/components/landing/landing-data.ts`: các mảng `CHAPTER_NAV`, `PIPELINE_STAGES`, `SAMPLE_METRICS`, `SAMPLE_FINDINGS`, `TRAINING_PHASES`, `SAMPLE_SCORES`, `SAMPLE_GOALS`, `RECOVERY_CHECK_IN`, `CLEARANCE_STEPS`, `ROLES` đang chứa chữ. Đổi thành dữ liệu chứa key (hoặc hàm nhận `t`), không để chuỗi Anh trong dữ liệu. Số liệu mẫu giữ nguyên.
- Chữ nằm trong WebGL (`src/components/landing/stage/*`, `fighter-scene.tsx`, `fighter-stage.tsx`) nếu có thì dịch; `aria-label` của canvas cũng phải qua `t`.
- `landing-page.tsx` nhận `primaryLabel` dạng chuỗi từ `page.tsx`; giữ giao diện prop này, chỉ đổi giá trị truyền vào.
- `story.ts`, `pose-skeleton.ts`, `arena-plate.ts`, `landing-motion.ts` là logic thuần; không đổi trừ khi chứa chữ hiển thị.

## Ngoài phạm vi

- `src/app/concept/**`; route đóng băng; logic app khác.
- Không đổi ảnh, cảnh 3D, chuyển động, bố cục; không cài thư viện.
- Slogan "Train harder. Fight cleared." dịch thành câu tiếng Việt tự nhiên, không dịch từng chữ; ghi bản chọn trong handover để chủ dự án duyệt.

## Tiêu chí nghiệm thu

1. Với `mma_locale=vi` (hoặc không có cookie), trang `/` không còn chữ Anh viết cứng ở tiêu đề tab, mô tả, header, mọi chương, nút, `aria-label` và `alt`. Tên sản phẩm "MMA-TMS" và thuật ngữ giữ nguyên được liệt kê trong handover.
2. Với `mma_locale=en`, nội dung giống trước ticket từng chữ (`e2e/landing.spec.ts` xem T-021 dựa vào điều này).
3. Nút chính hiện "Mở bảng điều khiển" khi đã đăng nhập và nhãn vào đăng nhập khi chưa, theo từ điển; vẫn trỏ đúng `dashboardPath(role)` / `routes.login`.
4. Cuộn kể chuyện, cảnh WebGL và `prefers-reduced-motion` hoạt động như trước (kiểm tra tay trên trình duyệt, ghi vào handover).
5. Không cuộn ngang ở 390 px; tiêu đề chương dài hơn bản Anh không bị cắt hay đè lên cảnh (kiểm tra tay, đính kèm ảnh chụp 390 px và 1280 px cho từng chương vào handover).
6. `translate.test.ts` qua; các test `src/components/landing/*.test.ts` vẫn qua.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```
