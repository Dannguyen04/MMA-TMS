# T-018 · Tiếng Việt: Film và phân tích video AI

| | |
| --- | --- |
| **Trạng thái** | READY (chủ dự án duyệt 20/10) |
| **Phần** | Frontend (`nextjs-frontend`) |
| **Nhánh** | `feat/T-018-i18n-film-video` từ `fight-camp` mới nhất |
| **Thuộc** | Phần 3 của [T-013](./T-013-i18n-vi.md). Mục "Thiết kế" và "Quy ước khi dịch" của T-013 áp dụng nguyên văn |

## Bối cảnh

Khu vực video (35 file `src/components/video`, chỉ 1 file dùng `t`) chưa dịch. Nội dung do AI gợi ý phải luôn được ghi rõ là chưa được HLV duyệt; bản dịch không được làm yếu thông điệp này.

## Phạm vi

Tiền tố key: `video.`. Cặp file mới: `messages/video.en.ts` / `video.vi.ts`.

- **Route:** `src/app/(app)/fighter/videos/**` (gồm `live`, `upload`, `[videoId]`), `src/app/(app)/coach/video-analysis/**`, `src/app/(app)/coach/fighters/[fighterId]/videos/**`.
- **Component:** `src/components/video/**`, `src/components/domain/{ai-finding-card,confidence-meter,ai-notice}.tsx`.
- **Server:** `src/lib/actions/video.ts`; `src/components/video/job-failure.ts` (lý do lỗi job).
- **Nhãn enum** trong `labels.ts`: `VIDEO_STATUS_LABELS`, `AI_JOB_STATUS_LABELS`, `PIPELINE_STAGE_LABELS`, `MOVEMENT_EVENT_LABELS`, `FINDING_CATEGORY_LABELS`, `FINDING_IMPACT_LABELS`, `REVIEW_DECISION_LABELS`, `CAMERA_ANGLE_LABELS`, `VIDEO_TRAINING_TYPE_HINTS`, `COACHING_FINDING_STATE_LABELS`. `VideoStatusBadge` và `AIGeneratedBadge` đã có prop `locale`.
- Chữ vẽ trên canvas (`pose-canvas.ts`, `pose-player.tsx`) nếu có thì dịch. Thuật ngữ kỹ thuật không có từ Việt thông dụng (pose, bounding box) giữ tiếng Anh, ghi trong handover.

## Ngoài phạm vi

- Route đóng băng: `admin/ai-models`, `doctor/ai-alerts`. Admin xem job AI thuộc T-019.
- Không đổi logic pipeline, route, schema, worker; không cài thư viện; không dịch tên riêng và dữ liệu người dùng nhập.

## Tiêu chí nghiệm thu

1. Với `mma_locale=vi` (hoặc không có cookie), các màn trong phạm vi không còn chữ Anh viết cứng, kể cả `aria-label`, `title`, placeholder, toast, `loading.tsx`, lỗi job và lỗi từ action. Chữ giữ nguyên được liệt kê trong handover.
2. Với `mma_locale=en`, nội dung giống trước ticket.
3. Mọi chỗ hiển thị nội dung AI vẫn nêu rõ "do AI gợi ý" và trạng thái duyệt của HLV bằng cả hai ngôn ngữ.
4. Ngày giờ và thời lượng truyền `locale`; badge dùng prop `locale`.
5. `translate.test.ts` qua.
6. Không cuộn ngang ở 390 px, nhất là trình phát, timeline và wizard tải lên (kiểm tra tay, ghi vào handover).
7. Test hiện có vẫn qua; test nào đổi vì câu chữ thì ghi lý do.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```
