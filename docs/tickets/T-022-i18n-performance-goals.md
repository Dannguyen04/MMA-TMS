# T-022 · Tiếng Việt: Performance và Goals (khu vực đóng băng)

| | |
| --- | --- |
| **Trạng thái** | READY (chủ dự án duyệt 20/10: dịch toàn bộ, kể cả khu vực đóng băng). Ưu tiên thấp |
| **Phần** | Frontend (`nextjs-frontend`) |
| **Nhánh** | `feat/T-022-i18n-performance-goals` từ `fight-camp` mới nhất |
| **Thuộc** | Phần 3 của [T-013](./T-013-i18n-vi.md). Mục "Thiết kế" và "Quy ước khi dịch" của T-013 áp dụng nguyên văn |

## Bối cảnh

Performance và Goals bị ẩn khỏi menu theo T-001 (trang, route và code vẫn còn, mở được bằng URL). Chủ dự án quyết định dịch cả các khu vực này để app hoàn toàn song ngữ. Chỉ dịch chữ hiển thị; không bật lại menu, không đổi logic.

## Phạm vi

Tiền tố key: `performance.`, `goals.`. Cặp file mới: `messages/performance.en.ts` / `performance.vi.ts`, `messages/goals.en.ts` / `goals.vi.ts`.

- **Route:** `src/app/(app)/fighter/{performance,goals}/**`, `src/app/(app)/coach/{performance,goals}/**`, `src/app/(app)/coach/fighters/[fighterId]/{performance,goals}/**`.
- **Component:** `src/components/performance/**` (biểu đồ kỹ thuật, KPI, bảng đội, mục tiêu, `goal-form`, `goal-actions`), `src/components/domain/{goal-card,metric-tile}.tsx` nếu chưa dịch.
- **Server:** `src/lib/actions/goals.ts`.
- **Nhãn enum** trong `src/lib/domain/labels.ts`: `GOAL_STATUS_LABELS`, `TECHNIQUE_LABELS` (nếu T-015 đã chuyển thì dùng lại), `STRIKE_TYPES` hiển thị.
- Nhãn trục, chú giải, tooltip và `aria-label` của biểu đồ trong `src/components/charts/**` mà các trang trên dùng cũng phải qua `t`.

## Ngoài phạm vi

- Không đưa Performance và Goals trở lại menu; không sửa `navigation.ts`.
- Không đổi công thức điểm, logic mục tiêu, route, schema, backend; không cài thư viện.
- Không dịch tên riêng và dữ liệu người dùng nhập (tên mục tiêu HLV tự nhập).

## Tiêu chí nghiệm thu

1. Với `mma_locale=vi` (hoặc không có cookie), mọi trang trong phạm vi không còn chữ Anh viết cứng, kể cả `aria-label`, tooltip và nhãn biểu đồ, toast, `loading.tsx`, lỗi từ action. Chữ giữ nguyên được liệt kê trong handover.
2. Với `mma_locale=en`, nội dung giống trước ticket từng chữ, kể cả dấu câu.
3. Ngày giờ và số (thập phân, đơn vị) truyền `locale` hoặc dùng `INTL_LOCALE`; không còn `Intl` cố định `en-GB` / `en-US` trong phạm vi.
4. Menu không đổi: `navigation.test.ts` vẫn qua và vẫn khẳng định các route này không có trong `NAVIGATION`.
5. `translate.test.ts` qua; mở trực tiếp URL các trang trong phạm vi vẫn hiển thị như trước.
6. Không cuộn ngang ở 390 px, nhất là biểu đồ và bảng (kiểm tra tay, ghi vào handover).
7. Test hiện có vẫn qua; test nào đổi vì câu chữ thì ghi lý do.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
npx eslint src e2e        # trong nextjs-frontend
```
