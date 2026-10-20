# T-015 · Tiếng Việt: Training

| | |
| --- | --- |
| **Trạng thái** | READY (chủ dự án duyệt 20/10) |
| **Phần** | Frontend (`nextjs-frontend`) |
| **Nhánh** | `feat/T-015-i18n-training` từ `fight-camp` mới nhất |
| **Thuộc** | Phần 3 của [T-013](./T-013-i18n-vi.md). Mục "Thiết kế" và "Quy ước khi dịch" của T-013 áp dụng nguyên văn |

## Bối cảnh

Khu vực Training chưa dịch (1 trong 24 file `src/components/training` dùng `t`). Thuật ngữ: "giáo án", "buổi tập", "tuần"; RPE giữ nguyên.

## Phạm vi

Tiền tố key: `training.`. Cặp file mới: `messages/training.en.ts` / `training.vi.ts`.

- **Võ sĩ:** `src/app/(app)/fighter/training/**`, `src/app/(app)/fighter/schedule/**`.
- **HLV:** `src/app/(app)/coach/sessions/**`, `src/app/(app)/coach/training-plans/**`, `src/app/(app)/coach/fighters/(roster)/**`, `coach/fighters/not-found.tsx`, `coach/fighters/[fighterId]/{layout,page,loading}.tsx`, `[fighterId]/training/**`.
- **Component:** `src/components/training/**`, `src/components/domain/{plan-card,plan-schedule,training-type-icon,technique-chip,coach-rating}.tsx`.
- **Server:** `src/lib/actions/training.ts`, `src/lib/services/training-errors.ts`.
- **Nhãn enum** trong `src/lib/domain/labels.ts`: `TRAINING_TYPE_LABELS`, `TECHNIQUE_LABELS`, `EXERCISE_CATEGORY_LABELS`, `INTENSITY_LABELS`, `TRAINING_PHASE_LABELS`, `PLAN_STATUS_LABELS`, `SESSION_STATUS_LABELS`, `FEEDBACK_KIND_LABELS`. Chuyển sang key trong từ điển; giữ export cũ (tiếng Anh) cho nơi chưa dịch.
- **Câu xung đột cấp phép:** `src/components/training/{clearance-banner,clearance-check-panel}.tsx` hiển thị câu sinh từ `src/lib/domain/clearance-rules.ts`. Đổi hàm đó trả mã, dịch ở component, cập nhật `clearance-rules.test.ts`. T-016 dùng lại phần này; ticket nào làm trước thì làm, ticket sau không làm lại.

## Ngoài phạm vi

- Route đóng băng: `fighter/{performance,goals}`, `coach/{performance,goals,admissions}`, `coach/fighters/[fighterId]/{goals,performance}`.
- Landing, `concept/`; không đổi logic, route, schema; không cài thư viện; không dịch tên riêng, dữ liệu người dùng nhập, tên buổi tập trong dữ liệu mock.

## Tiêu chí nghiệm thu

1. Với `mma_locale=vi` (hoặc không có cookie), các màn trong phạm vi không còn chữ Anh viết cứng, kể cả `aria-label`, `title`, placeholder, toast, `loading.tsx`, lỗi từ Server Action và `training-errors.ts`. Chữ giữ nguyên được liệt kê trong handover.
2. Với `mma_locale=en`, nội dung giống trước ticket.
3. Ngày giờ truyền `locale` cho các hàm trong `src/lib/format.ts` (lịch tuần, `week-nav`, `upcoming-by-day`, `week-summary`; `session-list-item.tsx` đã có định dạng theo locale); badge dùng prop `locale`.
4. `src/lib/domain/clearance-rules.ts` không còn trả câu chữ; test tương ứng cập nhật.
5. `translate.test.ts` qua.
6. Không cuộn ngang ở 390 px, nhất là bảng buổi tập và lịch tuần (kiểm tra tay, ghi vào handover).
7. Test hiện có vẫn qua; test nào đổi vì câu chữ thì ghi lý do.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```
