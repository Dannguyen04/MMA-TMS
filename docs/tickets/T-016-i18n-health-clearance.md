# T-016 · Tiếng Việt: Health và Medical Clearance (võ sĩ, HLV)

| | |
| --- | --- |
| **Trạng thái** | DRAFT (Claude viết 20/10) |
| **Phần** | Frontend (`nextjs-frontend`) |
| **Nhánh** | `feat/T-016-i18n-health-clearance` từ `fight-camp` mới nhất |
| **Thuộc** | Phần 3 của [T-013](./T-013-i18n-vi.md). Mục "Thiết kế" và "Quy ước khi dịch" của T-013 áp dụng nguyên văn |

## Bối cảnh

Khu vực sức khoẻ và cấp phép y tế chưa dịch. Thuật ngữ thống nhất: "cấp phép y tế" (Medical Clearance), "hồ sơ y tế". Nội dung y khoa và cảnh báo an toàn phải chính xác; chỗ không chắc nghĩa thì ghi vào mục Câu hỏi của handover, không đoán.

## Phạm vi

Tiền tố key: `health.`, `clearance.` (đã có `clearance.<state>` cho `ClearanceBadge`; dùng lại). Cặp file mới: `messages/health.en.ts` / `health.vi.ts`.

- **Võ sĩ:** `src/app/(app)/fighter/health/**`.
- **HLV:** `src/app/(app)/coach/medical-clearance/**`.
- **Component dùng chung:** `src/components/domain/{clearance-card,clearance-validity,injury-card,restriction-list,body-map,vitals-grid,recovery-progress,check-in-charts}.tsx`; `src/components/medical/{clearance-history,eligibility-reasons,restriction-summary,injury-history,print-button}.tsx`.
- **Logic thuần:** `src/lib/domain/clearance-rules.ts` và `vitals.ts` trả mã thay vì câu, màn hình dịch mã. Nếu T-015 đã đổi `clearance-rules.ts` thì dùng lại, không làm lại.
- **Nhãn enum** trong `src/lib/domain/labels.ts`: `HEALTH_STATUS_LABELS`, `HEALTH_STATUS_DESCRIPTIONS`, `CLEARANCE_LEVEL_LABELS`, `CLEARANCE_STATUS_LABELS`, `INJURY_TYPE_LABELS`, `INJURY_SEVERITY_LABELS`, `INJURY_STATUS_LABELS`, `INJURY_MECHANISM_LABELS`, `BODY_REGION_LABELS`, `RECOVERY_PLAN_STATUS_LABELS`. Giữ export cũ (tiếng Anh) cho nơi chưa dịch.

## Ngoài phạm vi

- Khu vực bác sĩ (T-017); route đóng băng `doctor/{medical-records,examinations,recovery,ai-alerts}`.
- Không đổi logic cấp phép, route, schema; không cài thư viện; không dịch tên riêng và dữ liệu người dùng nhập.

## Tiêu chí nghiệm thu

1. Với `mma_locale=vi` (hoặc không có cookie), các màn trong phạm vi không còn chữ Anh viết cứng, kể cả `aria-label`, `title`, placeholder, toast, `loading.tsx`, lỗi trả từ action. Chữ giữ nguyên được liệt kê trong handover.
2. Với `mma_locale=en`, nội dung giống trước ticket.
3. Ngày giờ truyền `locale`; `ClearanceBadge`, `HealthStatusBadge` dùng prop `locale`.
4. `clearance-rules.ts` và `vitals.ts` không còn trả câu chữ; test cập nhật cho khớp mã mới.
5. `translate.test.ts` qua.
6. Không cuộn ngang ở 390 px (kiểm tra tay, ghi vào handover).
7. Test hiện có vẫn qua; test nào đổi vì câu chữ thì ghi lý do.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```
