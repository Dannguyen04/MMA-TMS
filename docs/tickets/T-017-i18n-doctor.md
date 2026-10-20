# T-017 · Tiếng Việt: khu vực bác sĩ

| | |
| --- | --- |
| **Trạng thái** | DRAFT (Claude viết 20/10). Làm sau T-016 |
| **Phần** | Frontend (`nextjs-frontend`) |
| **Nhánh** | `feat/T-017-i18n-doctor` từ `fight-camp` mới nhất (sau khi T-016 đã merge) |
| **Thuộc** | Phần 3 của [T-013](./T-013-i18n-vi.md). Mục "Thiết kế" và "Quy ước khi dịch" của T-013 áp dụng nguyên văn |

## Bối cảnh

Khu vực bác sĩ (36 file trong `src/app/(app)/doctor`, 36 file `components/medical`, 24 file `components/clinical`) chưa dịch. Dùng lại badge và nhãn enum mà T-016 đã chuyển.

## Phạm vi

Tiền tố key: `doctor.`. Cặp file mới: `messages/doctor.en.ts` / `doctor.vi.ts`; được tách thêm `clinical.*` nếu quá dài.

- **Route:** `src/app/(app)/doctor/{dashboard,fighters,injuries,medical-clearance}/**`, `doctor/layout.tsx`, `doctor/page.tsx`.
- **Component:** phần còn lại của `src/components/medical/**` (triage, form cấp phép, SCAT6, restriction builder, patient card, health status control) và `src/components/clinical/**` (chấn thương, điều trị, kế hoạch hồi phục, mốc).
- **Server:** `src/lib/actions/{medical,clinical}.ts`, `src/lib/services/medical-errors.ts`; `src/lib/domain/{scat6,scat6-scoring}.ts` trả mã, không trả câu.
- **Nhãn enum:** `EXAMINATION_*`, `ASSESSMENT_RESULT_LABELS`, `TREATMENT_*` trong `labels.ts` nếu route trong phạm vi còn dùng.
- **Nội dung mẫu** (`examination-presets.ts`, `restriction-presets.ts`, `recovery-templates.ts`): dịch cả hai ngôn ngữ; giá trị đã lưu vào dữ liệu giữ đúng chữ người dùng chọn lúc đó.
- Component chỉ phục vụ route đóng băng (examination, ai-alerts, observation) thì bỏ qua và ghi vào handover.

## Ngoài phạm vi

- Route đóng băng `doctor/{medical-records,examinations,recovery,ai-alerts}`.
- Không đổi logic y tế, route, schema; không cài thư viện; không dịch tên riêng và dữ liệu người dùng nhập.

## Tiêu chí nghiệm thu

1. Với `mma_locale=vi` (hoặc không có cookie), các màn trong phạm vi không còn chữ Anh viết cứng, kể cả `aria-label`, `title`, placeholder, toast, `loading.tsx`, lỗi trả từ action và `medical-errors.ts`. Chữ giữ nguyên được liệt kê trong handover.
2. Với `mma_locale=en`, nội dung giống trước ticket.
3. Ngày giờ truyền `locale`; badge dùng prop `locale`.
4. `scat6*.ts` không còn trả câu chữ; `scat6.test.ts` cập nhật cho khớp.
5. `translate.test.ts` qua.
6. Không cuộn ngang ở 390 px, nhất là hàng đợi triage và form dài (kiểm tra tay, ghi vào handover).
7. Test hiện có vẫn qua; test nào đổi vì câu chữ thì ghi lý do. Thuật ngữ y khoa không chắc nghĩa ghi vào mục Câu hỏi.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```
