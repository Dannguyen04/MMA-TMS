# T-026 · Mẫu giáo án (buổi tập) trong form tạo buổi tập

| | |
| --- | --- |
| **Trạng thái** | Backend: IN REVIEW (nhánh `feat/T-026-session-templates-backend`, [handover](./T-026-HANDOVER.md)). Frontend: READY sau khi backend merge |
| **Phần** | Backend (đã làm) + Frontend (`nextjs-frontend`, còn lại) |
| **Nhánh frontend** | `feat/T-026-session-templates-ui` từ `fight-camp` mới nhất (sau khi nhánh backend merge) |
| **Người nhận frontend** | FE (đề xuất) |
| **Mục tiêu hoàn thành** | Backend merge trước 24/10, frontend trước 27/10 |
| **Quyết định** | Chủ dự án 20/10: [quyết định 21](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi). Chủ dự án chọn "cả hai": thêm loại buổi mới và lưu mẫu ở backend. Phần backend do Claude viết theo chỉ dẫn trực tiếp của chủ dự án |

## Bối cảnh

Bản demo `/concept/fight-camp`, tab "Thiết kế giáo án", cho HLV chọn một trong 4 mẫu buổi tập, xem lý do cân nhắc và các bước, rồi đưa vào lịch ([training-workspace.tsx:55](../../nextjs-frontend/src/app/concept/fight-camp/training-workspace.tsx)). App thật chưa có: form tạo buổi `/coach/sessions/new` ([session-form.tsx](../../nextjs-frontend/src/components/training/session-form.tsx)) là form trống. Ticket đưa cách chọn mẫu của bản demo vào form thật, với mẫu lấy từ backend.

## Phần backend (đã làm, chờ review)

- **Migration 028** thêm giá trị `TACTICAL_ANALYSIS` vào enum `session_type` (phân tích chiến thuật, xem video, không có tải thể chất).
- **Migration 029** tạo bảng `session_templates` và seed 4 mẫu hệ thống (`distance`, `counter`, `strength`, `tactics`), mỗi mẫu có chữ tiếng Việt và tiếng Anh. Quyền `training.session_template:read` cho COACH và ADMIN.
- **Endpoint** `GET /training-session-templates?locale=vi|en` (mặc định `vi`) trả danh sách mẫu đang bật, theo thứ tự hiển thị, mỗi mẫu:

```ts
{ id: string; code: "distance" | "counter" | "strength" | "tactics" | string;
  category: "TECHNIQUE" | "SPARRING" | "CONDITIONING" | "TACTICS";
  sessionType: SessionType;            // enum backend, có thêm TACTICAL_ANALYSIS
  plannedDurationMin: number; targetRpe: number;
  name: string; purpose: string; rationale: string;
  steps: { name: string; detail: string }[] }
```

- **Quy tắc y tế:** danh sách `allowedSessionTypes` của clearance không chặn `TACTICAL_ANALYSIS` (buổi không có tải thể chất, giống `physical: false` của mẫu trong bản demo). Các quy tắc khác (cần khám, clearance còn hạn, kết luận NOT_ELIGIBLE) vẫn áp dụng. **Cần bác sĩ hoặc chủ dự án xác nhận quy tắc này.**
- Thời lượng và RPE của 4 mẫu là **đề xuất của Claude**: 45′/5, 45′/7, 60′/6, 40′/2. Cần HLV chuyên môn duyệt trước demo 31/10; đổi số là sửa dữ liệu seed, không đổi logic.
- Migration chỉ được chủ dự án áp lên Supabase (028 rồi 029), sau khi nhánh backend APPROVED và merge.

## Phạm vi frontend

1. Mục "Mẫu giáo án" ở đầu `SessionForm` khi `mode="create"`: thẻ chọn cho mỗi mẫu (tên, nhóm, mục đích), thẻ đang chọn đánh dấu.
2. Chọn thẻ thì điền sẵn form (xem "Thiết kế"), hiện khối "Vì sao cân nhắc bài này?" và danh sách các bước.
3. Thẻ của loại buổi đang bị hạn chế y tế của võ sĩ hiện nhãn "Có hạn chế" (dùng `restrictedTypes` form đã có).
4. Loại buổi mới `tactical_analysis` ở toàn bộ frontend (xem bảng file).
5. Demo mode có cùng 4 mẫu (bản sao dữ liệu, ghi chú đồng bộ thủ công với migration 029).
6. Từ điển tiếng Việt và tiếng Anh cho mọi chữ giao diện mới; chữ của mẫu đến từ API theo `locale` của người dùng.

## Ngoài phạm vi

Mẫu cho cả camp (dàn nhiều buổi theo ngày thi); HLV hay Admin tự tạo, sửa mẫu (backend chưa có endpoint ghi); điền sẵn danh sách bài tập (`ExerciseBuilder`, chỉ có ở demo mode); sửa trang `edit`; sửa backend (nếu contract thiếu gì thì ghi vào handover); route đóng băng; cài thư viện. Mục tiêu, tiêu chí đạt (%), kết quả sau buổi như bản demo: không làm.

## File cần sửa (đã kiểm tra là có thật)

| File | Việc |
| --- | --- |
| `nextjs-frontend/src/lib/domain/types.ts` (`TrainingType`, dòng ~189) | Thêm `"tactical_analysis"` |
| `nextjs-frontend/src/lib/domain/medical-contract.ts` (`SESSION_TYPES` dòng 42, nhãn dòng ~201) | Thêm `TACTICAL_ANALYSIS` và nhãn |
| `nextjs-frontend/src/lib/domain/training-contract.ts` (`SESSION_TYPE_FOR`, `TRAINING_TYPE_FOR` dòng 11, 23) | Ánh xạ `tactical_analysis` ↔ `TACTICAL_ANALYSIS`. `training-contract.test.ts` đã kiểm tra mọi `SESSION_TYPES` đều có ánh xạ |
| `nextjs-frontend/src/lib/domain/medical-mappings.ts` (dòng ~56, ~69) | Ánh xạ loại mới; `sessionTypesFor("tactical_analysis")` trả `["TACTICAL_ANALYSIS"]`. Cập nhật `medical-mappings.test.ts` |
| `nextjs-frontend/src/lib/domain/labels.ts` (`TRAINING_TYPE_LABELS`, dòng 140) và `src/lib/i18n/messages/coach-today.{en,vi}.ts` (key `trainingType.*`) | Nhãn loại mới ("Phân tích chiến thuật" / "Tactical analysis") |
| `nextjs-frontend/src/components/domain/training-type-icon.tsx` | Biểu tượng cho loại mới |
| `nextjs-frontend/src/components/training/session-form.tsx` (`DEFAULT_LOCATION` dòng ~76) | Địa điểm mặc định cho loại mới; thêm picker ở đầu form (`mode === "create"`) và handler `applyTemplate`. `setValues`, `values`, `restrictedTypes` đã có ở đó |
| `nextjs-frontend/src/lib/services/training.ts` | `listSessionTemplates(locale)`: API mode gọi `GET /training-session-templates?locale=…` bằng `authenticatedApiRequest` và schema Zod; demo mode trả bản sao |
| `nextjs-frontend/src/lib/services/training.demo.ts` | Bản demo của hàm trên |
| `nextjs-frontend/src/app/(app)/coach/sessions/new/page.tsx` | Tải mẫu theo locale, truyền `templates` cho `SessionForm` |
| File mới `nextjs-frontend/src/components/training/session-template-picker.tsx` | Client component: lưới thẻ, khối lý do, danh sách bước |
| File mới `nextjs-frontend/src/lib/domain/session-templates.ts` + `.test.ts` | Hàm thuần `applySessionTemplate`; test |
| Cặp file mới `src/lib/i18n/messages/session-templates.en.ts` và `.vi.ts` | Chữ giao diện của picker (tiêu đề mục, "Có hạn chế", "Bỏ mẫu", nhãn nhóm `TECHNIQUE`/`SPARRING`/`CONDITIONING`/`TACTICS`, dòng nhắc), khuôn như `coach-bouts.en.ts` / `.vi.ts`; đăng ký ở `messages/en.ts`, `messages/vi.ts`. Tiền tố `sessionTemplates.` |

**Xung đột với T-015:** T-015 dịch toàn bộ `session-form.tsx`. Giao diện mẫu nằm trong file mới; `session-form.tsx` chỉ sửa ở hai chỗ nhỏ (chèn picker, thêm handler) cộng `DEFAULT_LOCATION`. Ai merge sau thì rebase và giữ cả hai thay đổi.

## Thiết kế

`applySessionTemplate(values, template, defaultLocation)` trả giá trị form mới:

- `title` = `template.name`; `type` = loại ánh xạ từ `template.sessionType` (qua `TRAINING_TYPE_FOR`); `durationMin` = `String(template.plannedDurationMin)`; `targetRpe` = `template.targetRpe` (chỉ dùng ở form demo);
- `notes` = các bước viết thành văn bản `"1. <tên bước>: <chi tiết>\n2. …"`, ≤ 1000 ký tự (migration 029 đã có test bảo đảm các bước của mẫu hệ thống vừa ô ghi chú);
- `location`: giữ nếu HLV đã đổi tay khác mặc định của loại cũ; không thì lấy mặc định của loại mới (cùng quy tắc `changeType` trong `session-form.tsx`);
- **không đụng** `fighterId`, `planId`, `date`, `time`, `exercises`.

Chọn mẫu khác thì ghi đè các trường trên. "Bỏ mẫu" chỉ bỏ đánh dấu thẻ, giữ giá trị đã điền. Mẫu bị hạn chế vẫn điền được: kiểm tra cấp phép trực tiếp có sẵn (`ClearanceCheckPanel`) sẽ chặn hay cảnh báo; không thêm logic chặn mới. Dòng nhắc cố định: "Mẫu minh họa cấu trúc. Nội dung và liều lượng cần HLV chuyên môn thẩm định." Giao diện theo mẫu có sẵn trong form (`FormSection`, `ChoiceGroup`, `Card`); thẻ một cột trên màn hẹp, hai cột từ `sm`; không cuộn ngang ở 390 px.

## Tiêu chí nghiệm thu (frontend)

1. Ở `/coach/sessions/new`, mục "Mẫu giáo án" hiện đủ 4 thẻ ở cả demo mode và API mode (API mode lấy từ `GET /training-session-templates`).
2. Chọn "Jab – cross – thoát góc": `title` = tên mẫu, loại = pad work, thời lượng = 45, ghi chú gồm đủ 3 bước đánh số; ở form demo `targetRpe` = 5. Test `applySessionTemplate` với form trống và với giá trị đã nhập tay (`fighterId`, `planId`, `date`, `time`, `exercises` không đổi).
3. `notes` sinh ra ≤ 1000 ký tự cho mọi mẫu, cả hai ngôn ngữ (test).
4. `location`: đã đổi tay thì giữ; còn là mặc định của loại cũ thì đổi theo loại mới (test).
5. Chọn "Đọc trận & phân tích đối thủ" đặt loại `tactical_analysis`; gửi form ở API mode gửi `sessionType: "TACTICAL_ANALYSIS"` (test `sessionBody` trong `training-contract.test.ts`).
6. Với võ sĩ có hạn chế chặn `sparring`, thẻ "Phòng thủ → phản đòn" hiện nhãn "Có hạn chế" và ở form demo panel kiểm tra cấp phép báo xung đột (kiểm tra tay, ghi vào handover). Chưa chọn võ sĩ thì không có nhãn.
7. "Bỏ mẫu" bỏ đánh dấu và khối lý do, giữ giá trị form.
8. Tiếng Việt mặc định, tiếng Anh với `mma_locale=en`: chữ của mẫu đổi theo (API mode gửi `locale`); không chữ cứng trong file mới; `translate.test.ts` qua.
9. Kiểm tra tay ở API mode với backend đã áp migration 028, 029 (dữ liệu giả, theo [TEAM-WORKFLOW §3a](../TEAM-WORKFLOW.md#3a-cách-giao-việc)): tạo buổi từ mỗi mẫu, mở lại buổi thấy đúng loại, tiêu đề, thời lượng, ghi chú. Ghi vào handover.
10. Trang `edit` và các luồng tạo buổi khác (từ trang plan, trang võ sĩ) không đổi hành vi; không cuộn ngang ở 390 px.
11. lint, typecheck, test qua; không thêm lỗi so với [BASELINE](./BASELINE.md).

## Lệnh kiểm tra bắt buộc

Frontend:

```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```

Backend (đã chạy, xem handover): `lint`, `build`, `test`, `test:db`, `db:check` của `nestjs-api`.

## Câu hỏi mở

- Thời lượng và RPE của 4 mẫu, và quy tắc "TACTICAL_ANALYSIS không bị danh sách loại buổi của clearance chặn": cần HLV và bác sĩ duyệt.
- Tên và ghi chú của buổi tạo từ mẫu là dữ liệu lưu trong database theo ngôn ngữ lúc chọn; đổi ngôn ngữ giao diện sau đó không dịch lại.
- Video AI dùng cột `training_type` cùng enum `session_type` (migration 014): giá trị mới cũng hợp lệ ở đó. Chưa có luồng nào dùng; ghi lại để biết.
