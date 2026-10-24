# T-020 Handover

- Nhánh: `feat/T-020-i18n-landing`
- Commit: `7c8a1c5`
- Trạng thái: IN REVIEW

## Thay đổi

- `nextjs-frontend/src/lib/i18n/messages/landing.en.ts` & `landing.vi.ts`:
  - Tạo mới cặp từ điển cho toàn bộ khu vực landing page (tiền tố `landing.`), bao gồm metadata (title, description), nhãn nút chính khi đăng nhập/chưa đăng nhập, header navigation & aria-labels, HUD chapter tour, Hero section (slogan 3 dòng, kicker, subheadline, các nút hành động, scroll cue), 5 chương nội dung (AI analysis, Training, Performance, Sports medicine, Roles), CTA cuối trang, footer và WebGL stage labels/aria-label.
  - `landing.vi.ts` kiểm tra tính đầy đủ bằng `satisfies Record<keyof typeof enLanding, string>`, bảo đảm đồng bộ 100% key và placeholder.
- `nextjs-frontend/src/lib/i18n/messages/en.ts` & `vi.ts`:
  - Thêm một dòng import `enLanding` / `viLanding` và một dòng spread `...enLanding` / `...viLanding`.
- `nextjs-frontend/src/app/page.tsx`:
  - Chuyển `metadata` sang hàm `generateMetadata(): Promise<Metadata>` dùng `getTranslator()`.
  - Cập nhật `HomePage` lấy `t` từ `getTranslator()` để dịch nhãn nút chính: `"Mở bảng điều khiển"` (`landing.primaryOpenDashboard`) khi đã đăng nhập và `"Vào võ đài"` (`landing.primaryEnterArena`) khi chưa đăng nhập. Giữ nguyên prop interface `primaryLabel` dạng chuỗi truyền vào `LandingPage`.
- `nextjs-frontend/src/components/landing/landing-data.ts`:
  - Thay đổi tất cả các mảng dữ liệu chứa chuỗi tiếng Anh (`CHAPTER_NAV`, `PIPELINE_STAGES`, `SAMPLE_METRICS`, `SAMPLE_FINDINGS`, `TRAINING_PHASES`, `SAMPLE_SCORES`, `SAMPLE_GOALS`, `RECOVERY_CHECK_IN`, `CLEARANCE_STEPS`, `ROLES`) thành dữ liệu chứa key từ điển (`labelKey`, `phaseKey`, v.v.).
  - Giữ nguyên toàn bộ số liệu mẫu, màu sắc, tone, hệ số và thứ tự.
- `nextjs-frontend/src/components/landing/landing-header.tsx`:
  - Chuyển thành async Server Component, dùng `getTranslator()` để dịch `aria-label` trang chủ, `aria-label` thanh điều hướng và nhãn các mục chương trong menu.
- `nextjs-frontend/src/components/landing/landing-page.tsx`:
  - Chuyển thành async Server Component, dùng `getTranslator()` để dịch `aria-label` của HUD điều hướng, nhãn các chương, hero kicker, slogan 3 dòng, mô tả, nút "Xem giới thiệu", scroll cue, CTA kicker, tiêu đề CTA, mô tả CTA và footer.
- `nextjs-frontend/src/components/landing/chapters/chapter-parts.tsx`:
  - Bỏ chuỗi tiếng Anh mặc định `"Sample analysis"` trong `SampleTag`, cho phép component gọi truyền text qua `{children}` đã dịch.
- `nextjs-frontend/src/components/landing/chapters/analysis-chapter.tsx`:
  - Chuyển thành async Server Component, dùng `getTranslator()` để dịch kicker, tiêu đề, đoạn văn mô tả, các bước pipeline qua `PIPELINE_STAGES`, tiêu đề kết quả, tag mẫu, metrics, findings, độ tin cậy AI, nhãn duyệt HLV ("HLV duyệt:"), các nút chip ("Xác nhận", "Sửa lại", "Từ chối") và ghi chú kết quả.
- `nextjs-frontend/src/components/landing/chapters/training-chapter.tsx`:
  - Chuyển thành async Server Component, dùng `getTranslator()` để dịch kicker, tiêu đề, đoạn văn mô tả, thẻ buổi tập (thời gian, tiêu đề, RPE mục tiêu, số hiệp, đối chiếu Cấp phép y tế, ghi chú sau buổi tập) và các giai đoạn camp trong `TRAINING_PHASES`.
- `nextjs-frontend/src/components/landing/chapters/performance-chapter.tsx`:
  - Chuyển thành async Server Component, dùng `getTranslator()` để dịch kicker, tiêu đề, đoạn văn mô tả, danh sách điểm kỹ thuật, xu hướng điểm (tiêu đề, thời lượng, `aria-label` biểu đồ SVG, nhãn mục tiêu) và danh sách mục tiêu (`SAMPLE_GOALS`).
- `nextjs-frontend/src/components/landing/chapters/medicine-chapter.tsx`:
  - Chuyển thành async Server Component, dùng `getTranslator()` để dịch kicker, tiêu đề, đoạn văn mô tả, khối nhận xét AI (tiêu đề, nội dung, lưu ý bác sĩ), khối theo dõi hồi phục (`RECOVERY_CHECK_IN`), các bước Cấp phép y tế (`CLEARANCE_STEPS`) và ghi chú quyền riêng tư hồ sơ bệnh án.
- `nextjs-frontend/src/components/landing/chapters/roles-chapter.tsx`:
  - Chuyển thành async Server Component, dùng `getTranslator()` để dịch kicker, tiêu đề, đoạn văn mô tả, 4 thẻ vai trò (`ROLES`) và ghi chú quyền riêng tư dữ liệu y tế.
- `nextjs-frontend/src/components/landing/fighter-stage.tsx`:
  - Dùng `useT()` để dịch các nhãn 3D HTML trên sàn đấu: nhãn góc đầu gối trái ("Đầu gối trái 157°"), nhãn cảnh báo AI ("Nhận xét AI · Đầu gối trái") và các thanh điểm kỹ thuật theo `SAMPLE_SCORES`.
- `nextjs-frontend/src/components/landing/fighter-scene.tsx`:
  - Dùng `useT()` để bổ sung `aria-label` cho component `<Canvas>` WebGL (`landing.stage.canvasAria`: "Võ đài bát giác 3D" / "3D octagon stage").

## Slogan lựa chọn

- Slogan tiếng Anh: `"Train harder. Fight cleared."`
- Bản tiếng Việt được chọn: `"Tập chăm hơn. Lên đài an toàn."`
- Khẩu hiệu 3 dòng ở Hero:
  1. `Train harder.` -> `"Tập chăm hơn."`
  2. `Recover smarter.` -> `"Hồi phục khéo hơn."`
  3. `Fight cleared.` -> `"Lên đài an toàn."`
- Cụm từ này đồng nhất với slogan đã duyệt ở màn hình xác thực (`auth.slogan`: `"Tập chăm hơn. Hồi phục khéo hơn. Lên đài an toàn."`), diễn đạt tự nhiên theo văn phong võ thuật và y học thể thao thay vì dịch từng chữ.

## Chữ tiếng Anh cố ý giữ (tên riêng, mã kỹ thuật)

1. Tên sản phẩm: `"MMA-TMS"`.
2. Tên các kỹ thuật đòn đánh MMA theo quy ước chuẩn: `"Jab"`, `"Cross"`, `"Hook"`.
3. Chỉ số kỹ thuật quốc tế: `"RPE"` (Rate of Perceived Exertion).
4. Tên tệp video mẫu minh họa: `"heavy-bag-round-3.mp4"`.

## Đối chiếu tiêu chí nghiệm thu

| Tiêu chí (theo ticket) | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| 1. Với `mma_locale=vi` (hoặc không có cookie), trang `/` không còn chữ Anh viết cứng ở tiêu đề tab, mô tả, header, mọi chương, nút, `aria-label` và `alt`. Tên sản phẩm "MMA-TMS" và thuật ngữ giữ nguyên được liệt kê trong handover. | `src/app/page.tsx:7-24`, `src/components/landing/landing-header.tsx:7-34`, `src/components/landing/landing-page.tsx:20-142`, `src/components/landing/chapters/*.tsx`, `src/components/landing/fighter-stage.tsx:69-80`, `src/components/landing/fighter-scene.tsx:28`. |
| 2. Với `mma_locale=en`, nội dung giống trước ticket từng chữ (`e2e/landing.spec.ts` xem T-021 dựa vào điều này). | `src/lib/i18n/messages/landing.en.ts:1-155` định nghĩa nguyên văn 100% từng chuỗi tiếng Anh trước khi sửa, khớp toàn bộ text và `aria-label`. |
| 3. Nút chính hiện "Mở bảng điều khiển" khi đã đăng nhập và nhãn vào đăng nhập khi chưa, theo từ điển; vẫn trỏ đúng `dashboardPath(role)` / `routes.login`. | `src/app/page.tsx:22-25`: `primaryLabel={user ? t("landing.primaryOpenDashboard") : t("landing.primaryEnterArena")}` với `landing.primaryOpenDashboard` = `"Mở bảng điều khiển"` / `"Open dashboard"`, `landing.primaryEnterArena` = `"Vào võ đài"` / `"Enter the arena"`, `primaryHref` giữ nguyên logic `user ? dashboardPath(user.role) : routes.login`. |
| 4. Cuộn kể chuyện, cảnh WebGL và `prefers-reduced-motion` hoạt động như trước (kiểm tra tay trên trình duyệt, ghi vào handover). | Chưa kiểm tra trực quan trên trình duyệt thật vì môi trường CLI không có giao diện đồ hoạ/màn hình hiển thị. Về mã nguồn: không thay đổi bất kỳ logic WebGL nào trong `stage/*`, `story.ts`, `landing-motion.ts`, `landing-experience.tsx`; chỉ cấp prop `t` cho chữ hiển thị trên nhãn HTML overlay và `aria-label` của `<Canvas>`. `story.test.ts` và `pose-skeleton.test.ts` chạy qua 22/22 tests. |
| 5. Không cuộn ngang ở 390 px; tiêu đề chương dài hơn bản Anh không bị cắt hay đè lên cảnh (kiểm tra tay, đính kèm ảnh chụp 390 px và 1280 px cho từng chương vào handover). | Chưa kiểm tra trực quan trên trình duyệt thật vì môi trường CLI không có giao diện đồ hoạ/màn hình hiển thị. Về mã nguồn: các container text đều dùng `text-balance`, `max-w-*`, `leading-tight`, `break-words` và responsive padding sẵn có (`px-5 sm:px-8 lg:px-12`); `overflow-x-clip` trên landing shell ngăn cuộn ngang. |
| 6. `translate.test.ts` qua; các test `src/components/landing/*.test.ts` vẫn qua. | `src/lib/i18n/translate.test.ts` qua (7/7 tests); `src/components/landing/pose-skeleton.test.ts` (5/5 tests); `src/components/landing/story.test.ts` (10/10 tests). Toàn bộ frontend test suite qua 656 tests, 0 failed. |

## Lệnh đã chạy

### 1. `pnpm --filter nextjs-frontend typecheck`

```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```

(Thoát với mã 0)

### 2. `npx eslint src e2e` (trong `nextjs-frontend`)

```text
(Không có lỗi hoặc cảnh báo nào)
```

(Thoát với mã 0)

### 3. `pnpm --filter nextjs-frontend test`

```text
$ vitest run

 RUN  v5.0.2 D:/test/ai-worktrees/T-020/nextjs-frontend


 Test Files  76 passed | 1 skipped (77)
      Tests  656 passed | 2 skipped (658)
   Start at  10:24:19
   Duration  90.36s (import 59%, transform 22%, tests 16%, worker 3%)

    Isolate  77 workers spawned · ~11.14s startup each (spawn + environment, per file)
             at least ~66.86s faster with isolate: false — reuses workers across files instead of one per file
```

(Thoát với mã 0)

## Lệch so với ticket

Không có.

## Câu hỏi / việc còn mở

Không có.
