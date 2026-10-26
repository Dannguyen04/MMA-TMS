# T-024 · Tiếng Việt: Admissions và AI models (khu vực đóng băng)

| | |
| --- | --- |
| **Trạng thái** | READY (chủ dự án duyệt 20/10). Ưu tiên thấp. Làm sau T-014 và T-019 |
| **Phần** | Frontend (`nextjs-frontend`) |
| **Nhánh** | `feat/T-024-i18n-frozen-admissions-models` từ `fight-camp` mới nhất |
| **Thuộc** | Phần 3 của [T-013](./T-013-i18n-vi.md). Mục "Thiết kế" và "Quy ước khi dịch" của T-013 áp dụng nguyên văn |

## Bối cảnh

Hai khu vực bị ẩn khỏi menu theo T-001 nhưng vẫn mở được bằng URL: tuyển sinh của HLV và admin (`coach/admissions`, `admin/admissions`) và quản lý mô hình AI (`admin/ai-models`). T-014 đã dịch phía người nộp đơn (`application-form`, `application-progress`, `activate-account-form`) và T-019 bỏ qua `model-*`. Ticket này dịch phần còn lại. Review T-014 ghi các form HLV và admin trong `src/components/admissions` vẫn tiếng Anh.

## Phạm vi

Tiền tố key: `admissions.`, `aiModels.`. Cặp file mới: `messages/admissions-staff.en.ts` / `admissions-staff.vi.ts`, `messages/ai-models.en.ts` / `ai-models.vi.ts`.

- **Route:** `src/app/(app)/coach/admissions/**`, `src/app/(app)/admin/admissions/**`, `src/app/(app)/admin/ai-models/**`.
- **Component:** `src/components/admissions/{admission-admin-forms,assessment-form,application-views}.tsx`; `src/components/admin/{model-card,model-thresholds-form,promote-model-button,threshold-bands}.tsx`.
- **Server:** `src/lib/actions/admissions.ts`, phần mô hình AI trong `src/lib/actions/admin.ts`, `src/lib/domain/admissions.ts` (trả mã, không trả câu; cập nhật `admissions.test.ts`).
- **Nhãn enum:** `AI_MODEL_TASK_LABELS`, `AI_MODEL_STATUS_LABELS` và nhãn trạng thái đơn tuyển sinh.
- Thuật ngữ kỹ thuật ML (threshold, precision, recall) giữ tiếng Anh nếu không có từ Việt thông dụng; ghi lựa chọn trong handover.

## Ngoài phạm vi

- Không đưa các trang trở lại menu; không đổi logic tuyển sinh hay chuyển mô hình, route, schema, backend; không cài thư viện.
- Không dịch tên riêng và dữ liệu người dùng nhập (nội dung đánh giá của HLV, tên mô hình).

## Tiêu chí nghiệm thu

1. Với `mma_locale=vi` (hoặc không có cookie), mọi trang trong phạm vi không còn chữ Anh viết cứng, kể cả `aria-label`, placeholder, toast, `loading.tsx`, lỗi từ action. Chữ giữ nguyên được liệt kê trong handover.
2. Với `mma_locale=en`, nội dung giống trước ticket từng chữ, kể cả dấu câu.
3. Ngày giờ và số truyền `locale`; badge dùng prop `locale`.
4. `navigation.test.ts` vẫn qua; `translate.test.ts` qua; `admissions.test.ts` cập nhật nếu logic trả mã.
5. Không cuộn ngang ở 390 px (kiểm tra tay, ghi vào handover).
6. Test hiện có vẫn qua; test nào đổi vì câu chữ thì ghi lý do.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
npx eslint src e2e        # trong nextjs-frontend
```
