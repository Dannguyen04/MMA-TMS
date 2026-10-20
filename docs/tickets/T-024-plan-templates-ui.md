# T-024 · Template plan: màn tạo plan cho HLV

| | |
| --- | --- |
| **Trạng thái** | READY (chủ dự án mở lại phạm vi 20/10, [quyết định 21](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi)) |
| **Phần** | Frontend (`nextjs-frontend`) |
| **Nhánh** | `feat/T-024-plan-templates-ui` từ `fight-camp` mới nhất |
| **Người nhận** | FE (đề xuất) |
| **Phụ thuộc** | Contract của [T-023](./T-023-plan-templates-backend.md). Làm demo mode trước, nối API thật sau khi T-023 merge |
| **Mục tiêu hoàn thành** | Merge trước 27/10 |

## Bối cảnh

Màn `/coach/training-plans/new` ([page.tsx](../../nextjs-frontend/src/app/(app)/coach/training-plans/new/page.tsx)) chỉ có form trống (`PlanForm`). HLV hỏi chỗ chọn template giáo án và không thấy. Ticket này thêm bước chọn template vào đúng màn đó, cho xem trước lịch, rồi tạo plan kèm buổi tập qua endpoint của T-023.

## Phạm vi

1. Trên `/coach/training-plans/new`: bước chọn "Bắt đầu từ", gồm thẻ "Plan trống" (luồng hiện tại, không đổi) và một thẻ cho mỗi template.
2. Chọn template thì form đổi sang chế độ template: chọn võ sĩ, **ngày thi đấu** (thay cho ngày bắt đầu/kết thúc), tên plan (tuỳ chọn), trạng thái nháp/kích hoạt; hiện **xem trước lịch** theo tuần.
3. Server Action và hàm service gọi `POST /training-plans/from-template`, rồi kích hoạt plan nếu HLV chọn "Kích hoạt".
4. Demo mode (`isDemoAuthEnabled()`) có cùng hành vi.
5. Từ điển tiếng Việt và tiếng Anh cho mọi chữ mới.

## Ngoài phạm vi

Sửa plan tạo từ template (dùng màn sửa và thêm buổi có sẵn); lưu plan thành template; gắn vào trận; dịch lịch khi đổi ngày thi; thay đổi `PlanForm` ở chế độ `edit`; route đóng băng; cài thư viện; sửa backend (nếu contract của T-023 thiếu gì thì ghi vào handover).

## File cần sửa (đã kiểm tra là có thật)

| File | Việc |
| --- | --- |
| `nextjs-frontend/src/app/(app)/coach/training-plans/new/page.tsx` | Đọc `?template=<id>` từ `searchParams` (dùng `param` như dòng 26), tải danh sách template, render bước chọn và form template. `requireRole("coach")` giữ nguyên |
| `nextjs-frontend/src/components/training/plan-form.tsx` | **Không sửa logic.** `PlanFormProps.mode` chỉ có `create`/`edit`; không thêm chế độ thứ ba vào file này |
| File mới `nextjs-frontend/src/components/training/plan-template-picker.tsx` | Thẻ chọn template (server component, link `?template=`) |
| File mới `nextjs-frontend/src/components/training/plan-template-form.tsx` | Form template (client component, theo khuôn `PlanForm`: `useActionForm`, `Field`, `FormSection`, `SubmitButton`) và xem trước lịch |
| `nextjs-frontend/src/lib/actions/training.ts` | Thêm Server Action `createPlanFromTemplate`, cạnh `createPlan` (dòng 155), cùng khuôn: `authorizeCoach`, `canAccessFighter`, `validationError`, `planWriteFailure`, `revalidatePlan`, `redirect(routes.coach.plan(plan.id))` |
| `nextjs-frontend/src/lib/services/training.ts` | Thêm `listPlanTemplates()` và `createPlanFromTemplate(input, actor)`, cạnh `createPlan` (dòng 405). API mode dùng `authenticatedApiRequest` / `authenticatedMutableApiRequest` và schema Zod cho response; kích hoạt sau khi tạo giống `createPlan` |
| `nextjs-frontend/src/lib/services/training.demo.ts` | Thêm bản demo của hai hàm trên (cạnh `createPlan`, dòng 144); sinh buổi bằng cùng quy tắc ngày của T-023 |
| `nextjs-frontend/src/lib/domain/training-contract.ts` | Dùng `TRAINING_TYPE_FOR` (dòng 23) để đổi loại buổi của backend sang `TrainingType` khi hiển thị nhãn. Chỉ sửa nếu thiếu |
| Cặp file mới `src/lib/i18n/messages/plan-templates.en.ts` và `plan-templates.vi.ts` | Từ điển, khuôn như `coach-bouts.en.ts` / `coach-bouts.vi.ts`; đăng ký trong `messages/en.ts` và `messages/vi.ts` như dòng `enCoachBouts` / `viCoachBouts`. Tiền tố key: `planTemplates.`. Dùng cặp file riêng để không đụng T-015 (đang sửa `training.*`) |
| File test mới cạnh từng file mới/sửa | Xem tiêu chí nghiệm thu |

Tên nhãn loại buổi: dùng `TRAINING_TYPE_LABELS` trong `src/lib/domain/labels.ts` (nếu T-015 đã merge thì nhãn đã nằm trong từ điển, dùng nhãn đó).

## Thiết kế

### Luồng

1. `/coach/training-plans/new` không có `?template`: hiện hai khối. Bên trên là bộ chọn template (thẻ). Bên dưới là `PlanForm` như hiện nay (không đổi, mặc định thẻ "Plan trống" được chọn).
2. `?template=mma-camp-6w`: ẩn `PlanForm`, hiện `PlanTemplateForm`. Thẻ đang chọn được đánh dấu (`aria-pressed` hoặc `aria-current`). Nút "Plan trống" quay lại luồng cũ. `?template=` lạ thì bỏ qua như không có.
3. `PlanTemplateForm` có các trường: võ sĩ (cùng danh sách và `ClearanceCard`/cảnh báo cấp phép như `PlanForm`; dùng lại `clearances` đã tải trong `page.tsx`), **ngày thi đấu** (`type="date"`, `min` là ngày mai theo giờ học viện, mặc định 42 ngày sau hôm nay), tên plan tuỳ chọn, trạng thái (Nháp / Kích hoạt, dùng `ChoiceGroup` như `PlanForm`).
4. **Xem trước**: từ `slots` của template và ngày thi, hiện danh sách theo tuần (Tuần 6 … Tuần 1): mỗi dòng gồm thứ-ngày-tháng, giờ, nhãn loại buổi, thời lượng, số hiệp. Quy đổi ngày giống T-023: `ngày = ngàyThi − (7 × weekFromEnd − dayOffset + 1)`. Buổi đã qua so với hôm nay hiện mờ kèm chữ "Bỏ qua (đã qua)" và tổng "n buổi sẽ được tạo, m buổi bị bỏ". Tính trong hàm thuần để test được (`buildTemplatePreview(template, endDate, now)` trong `training-utils.ts` hoặc file mới).
5. Gửi form: Server Action gọi `createPlanFromTemplate`. Thành công thì chuyển đến trang plan (`routes.coach.plan(plan.id)`). Nếu chọn "Kích hoạt" mà việc kích hoạt bị từ chối thì giữ nháp và chuyển kèm `notice`, y như `createPlan` (dùng `PLAN_NOT_ACTIVATED`, `hrefWith`).
6. Chữ nhắc cố định dưới xem trước: "Mẫu minh họa cấu trúc. HLV chỉnh nội dung và liều lượng theo từng võ sĩ." (vì nội dung template chưa được thẩm định chuyên môn).

### Lỗi

Ánh xạ trong `src/lib/services/training-errors.ts` (có sẵn) cho `PLAN_TEMPLATE_NOT_FOUND` và `PLAN_TEMPLATE_END_DATE_PAST`; hiển thị lỗi trường `endDate` cho trường hợp thứ hai.

### Demo mode

`listPlanTemplates()` trả bản sao dữ liệu hai template (ghi chú trong file: "đồng bộ thủ công với `nestjs-api/src/training/plans/plan-templates.ts`"). Không import chéo giữa hai package. `createPlanFromTemplate` demo tạo plan và các buổi vào kho demo hiện có, cùng quy tắc ngày, bỏ buổi đã qua.

### Giao diện

Theo mẫu `PlanForm` và các thẻ có sẵn trong `src/components/ui/`. Không cuộn ngang ở 390 px: thẻ template xếp một cột ở màn hẹp; danh sách xem trước xếp dòng, không dùng bảng rộng cố định.

## Tiêu chí nghiệm thu

1. Ở `/coach/training-plans/new` HLV thấy ba thẻ: "Plan trống", "MMA 6 tuần", "Boxing 6 tuần". Chọn một template thì URL có `?template=<id>` và hiện `PlanTemplateForm`; chọn "Plan trống" quay lại form cũ, hành vi form cũ không đổi (test hiện có qua).
2. Với `endDate` 2026-12-12 và hôm nay trước 2026-10-31, xem trước hiện đủ 41 buổi, buổi đầu `Thứ Bảy 31/10` Tuần 6, buổi cuối `Thứ Sáu 11/12` Tuần 1, không có buổi nào ngày 12/12. Test `buildTemplatePreview` với đúng ví dụ này.
3. Hôm nay nằm giữa kế hoạch: buổi quá khứ được đánh dấu bỏ qua và tổng "tạo / bỏ" đúng (test hàm thuần).
4. Ngày thi nhỏ hơn hoặc bằng hôm nay: nút tạo bị vô hiệu hoặc báo lỗi trường `endDate`; Server Action không gọi service (test action).
5. API mode: `createPlanFromTemplate` gọi `POST /training-plans/from-template` với đúng body (`templateId`, `fighterId`, `coachId`, `title`, `endDate`), parse response bằng Zod; chọn "Kích hoạt" thì gọi tiếp `setPlanStatus(..., "active")`; kích hoạt bị từ chối thì trả plan nháp (test với `fetch` giả, theo khuôn `training.test.ts`).
6. Demo mode: tạo xong, trang plan hiện đủ các buổi đã dàn (`getPlanWithSessions`).
7. HLV không có võ sĩ trong danh sách phụ trách bị chặn (`canAccessFighter`), cùng thông điệp với `createPlan`.
8. Cảnh báo cấp phép y tế của võ sĩ hiện ở form template giống `PlanForm` (cùng component).
9. Tiếng Việt mặc định, tiếng Anh với `mma_locale=en`; không chữ cứng trong file mới; `translate.test.ts` qua (đủ key hai phía).
10. Không cuộn ngang ở 390 px (kiểm tra tay, ghi vào handover); `aria-label` cho thẻ chọn và vùng xem trước.
11. lint, typecheck, test qua; không thêm lỗi so với [BASELINE](./BASELINE.md). Test e2e hiện có không hỏng.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```

Kiểm tra tay ở API mode với backend T-023 (dữ liệu giả, theo [TEAM-WORKFLOW §3a](../TEAM-WORKFLOW.md#3a-cách-giao-việc)): tạo một plan MMA 6 tuần cho một võ sĩ `@example.com`, mở trang plan xem đủ buổi, kích hoạt, mở trang võ sĩ thấy lịch. Ghi kết quả vào handover.

## Ghi chú

- Nếu T-015 (dịch Training) đã merge khi làm ticket này, nhãn loại buổi và giai đoạn đã nằm trong từ điển `training.*`: dùng lại, không thêm trùng.
- Nếu T-023 chưa merge, làm hết phần demo mode và test hàm thuần trước; phần API mode viết theo contract trong T-023 và chạy lại khi T-023 vào `fight-camp`.
