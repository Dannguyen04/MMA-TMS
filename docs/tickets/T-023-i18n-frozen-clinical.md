# T-023 · Tiếng Việt: các trang y tế đóng băng của bác sĩ

| | |
| --- | --- |
| **Trạng thái** | READY (chủ dự án duyệt 20/10). Làm sau T-017 |
| **Phần** | Frontend (`nextjs-frontend`) |
| **Nhánh** | `feat/T-023-i18n-frozen-clinical` từ `fight-camp` mới nhất (sau khi T-017 đã merge) |
| **Thuộc** | Phần 3 của [T-013](./T-013-i18n-vi.md). Mục "Thiết kế" và "Quy ước khi dịch" của T-013 áp dụng nguyên văn |

## Bối cảnh

Các trang sau của bác sĩ bị ẩn khỏi menu theo T-001 nhưng vẫn mở được bằng URL: hồ sơ y tế, khám, hồi phục, cảnh báo AI. T-017 chỉ dịch phần các trang còn trong menu và bỏ qua component chỉ phục vụ các trang này. Ticket này dịch phần bị bỏ lại. Thuật ngữ y khoa theo T-016, T-017; chỗ không chắc nghĩa ghi vào mục Câu hỏi của handover.

## Phạm vi

Tiền tố key: `medicalRecords.`, `examination.`, `recovery.`, `aiAlerts.`. Cặp file mới: `messages/doctor-frozen.en.ts` / `doctor-frozen.vi.ts`.

- **Route:** `src/app/(app)/doctor/{medical-records,examinations,recovery,ai-alerts}/**`.
- **Component:** `src/components/medical/{medical-record-editor,medical-record-panel,examination-form,examination-list,examination-history,examination-decision-form,examination-details-fields,ai-observation-list}.tsx`, `examination-presets.ts`; `src/components/clinical/{recovery-plan-card,recovery-plan-form,recovery-tracker,recovery-templates,alert-decision-panel,observation-card,observation-evidence,observation-summary}`. File nào T-017 đã dịch thì bỏ qua.
- **Server:** phần còn lại của `src/lib/actions/{medical,clinical}.ts`, `src/lib/actions/examination-fields.ts`, `src/lib/domain/{medical-bodies,movement-review,movement-evidence,ai-review}.ts` (trả mã, không trả câu).
- **Nhãn enum:** `EXAMINATION_TYPE_LABELS`, `EXAMINATION_OUTCOME_LABELS`, `ASSESSMENT_RESULT_LABELS`, `RECOVERY_PLAN_STATUS_LABELS`, `ALERT_STATUS_LABELS`, `FINDING_*`, `REVIEW_DECISION_LABELS` và phần liên quan của `labels.ts`.
- Nội dung mẫu (`examination-presets.ts`, `recovery-templates.ts`): dịch cả hai ngôn ngữ; giá trị đã lưu giữ đúng chữ lúc chọn.

## Ngoài phạm vi

- Không đưa các trang trở lại menu; không đổi logic y tế, route, schema, backend; không cài thư viện.
- Không dịch tên riêng và dữ liệu người dùng nhập (chẩn đoán, ghi chú do bác sĩ nhập).

## Tiêu chí nghiệm thu

1. Với `mma_locale=vi` (hoặc không có cookie), mọi trang trong phạm vi không còn chữ Anh viết cứng, kể cả `aria-label`, placeholder, toast, `loading.tsx`, lỗi từ action. Chữ giữ nguyên được liệt kê trong handover.
2. Với `mma_locale=en`, nội dung giống trước ticket từng chữ.
3. Ngày giờ và số truyền `locale`; badge dùng prop `locale`.
4. Các hàm trong `src/lib/domain` ở phạm vi không còn trả câu chữ; test cập nhật.
5. `navigation.test.ts` vẫn qua (các route này vẫn không có trong menu); `translate.test.ts` qua.
6. Không cuộn ngang ở 390 px (kiểm tra tay, ghi vào handover).
7. Test hiện có vẫn qua; test nào đổi vì câu chữ thì ghi lý do.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
npx eslint src e2e        # trong nextjs-frontend
```
