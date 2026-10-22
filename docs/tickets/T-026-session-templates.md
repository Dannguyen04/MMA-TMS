# T-026 · Mẫu giáo án (buổi tập) trong form tạo buổi tập

| | |
| --- | --- |
| **Trạng thái** | READY (chủ dự án chọn hướng này 20/10, [quyết định 21](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi)) |
| **Phần** | Frontend (`nextjs-frontend`) |
| **Nhánh** | `feat/T-026-session-templates` từ `fight-camp` mới nhất |
| **Người nhận** | FE (đề xuất) |
| **Backend / migration** | Không. Mẫu là hằng số trong frontend; buổi tập vẫn tạo bằng `POST /training-sessions` có sẵn |
| **Mục tiêu hoàn thành** | Merge trước 27/10 |

## Bối cảnh

Bản demo `/concept/fight-camp`, tab "Thiết kế giáo án", cho HLV chọn một trong 4 mẫu buổi tập, xem lý do cân nhắc và các bước, rồi đưa vào lịch ([training-workspace.tsx:55](../../nextjs-frontend/src/app/concept/fight-camp/training-workspace.tsx)). App thật chưa có: form tạo buổi `/coach/sessions/new` ([session-form.tsx](../../nextjs-frontend/src/components/training/session-form.tsx)) là form trống. Ticket này đưa cách chọn mẫu của bản demo vào form thật.

Dữ liệu 4 mẫu nằm ở [camp-state.ts:62-90](../../nextjs-frontend/src/app/concept/fight-camp/camp-state.ts) (`templates`). Đó là dữ liệu của prototype, không import vào app thật.

## Phạm vi

1. Mục "Mẫu giáo án" ở đầu `SessionForm` khi `mode="create"`: 4 thẻ chọn (tên, nhóm, mục đích), thẻ đang chọn đánh dấu.
2. Chọn thẻ thì điền sẵn các trường form (xem "Thiết kế"), hiện khối "Vì sao cân nhắc bài này?" và danh sách các bước.
3. Thẻ của loại buổi đang bị hạn chế y tế của võ sĩ hiện nhãn "Có hạn chế" (dùng dữ liệu hạn chế form đã có), giống bản demo.
4. Dữ liệu mẫu và hàm áp mẫu là mã thuần, có test.
5. Từ điển tiếng Việt và tiếng Anh cho mọi chữ mới.

## Ngoài phạm vi

Mẫu cho cả camp (dàn nhiều buổi, ngày thi); lưu buổi đã sửa thành mẫu mới; mẫu do Admin hay HLV tự tạo; điền sẵn danh sách bài tập (`ExerciseBuilder`, chỉ có ở demo mode); thêm loại buổi mới ở backend (cần migration enum); sửa trang `edit`; sửa backend; route đóng băng; cài thư viện. Ghi nhận mục tiêu, tiêu chí đạt (%), kết quả sau buổi như bản demo: không làm.

## File cần sửa (đã kiểm tra là có thật)

| File | Việc |
| --- | --- |
| File mới `nextjs-frontend/src/lib/domain/session-templates.ts` | Hằng số `SESSION_TEMPLATES` và hàm thuần (xem dưới). Không import React |
| File mới `nextjs-frontend/src/lib/domain/session-templates.test.ts` | Test hàm thuần |
| File mới `nextjs-frontend/src/components/training/session-template-picker.tsx` | Client component: lưới thẻ, khối lý do, danh sách bước |
| `nextjs-frontend/src/components/training/session-form.tsx` | Thêm picker ở đầu form (chỉ `mode === "create"`) và một handler `applyTemplate`; không đổi phần còn lại. `setValues`, `values`, `restrictedTypes` (dòng ~96) và `serviceForm` đã có ở đó |
| Cặp file mới `src/lib/i18n/messages/session-templates.en.ts` và `session-templates.vi.ts` | Từ điển, khuôn như `coach-bouts.en.ts` / `coach-bouts.vi.ts`; đăng ký trong `messages/en.ts` và `messages/vi.ts` như dòng `enCoachBouts` / `viCoachBouts`. Tiền tố key: `sessionTemplates.`. Dùng `useT()` từ `@/components/i18n/locale-provider` |

`SERVICE_TRAINING_TYPES` và `sessionTypeFor` ở `src/lib/domain/training-contract.ts` đã có; dùng để biết loại nào mà service nhận.

**Xung đột với T-015:** T-015 (đang `READY`, nhánh `feat/T-015-i18n-training`) dịch toàn bộ `session-form.tsx`. Để giảm xung đột: toàn bộ giao diện mẫu nằm trong file mới; chỉ sửa `session-form.tsx` ở hai chỗ nhỏ (import + chèn `<SessionTemplatePicker>`, và hàm `applyTemplate`). Ai merge sau thì rebase và giữ cả hai thay đổi.

## Thiết kế

### Dữ liệu mẫu

Bốn mẫu lấy **nguyên văn** từ `camp-state.ts:66-89` (tên, nhóm, mục đích, lý do, ba bước) và chuyển vào từ điển (key `sessionTemplates.<id>.name|category|purpose|rationale|step1.name|step1.detail|…`). Thêm các trường mà bản demo không có, vì form thật cần:

| id | Loại buổi (`TrainingType`) | `durationMin` | `targetRpe` (chỉ form demo) |
| --- | --- | --- | --- |
| `distance` "Jab – cross – thoát góc" | `pad_work` | 45 | 5 |
| `counter` "Phòng thủ → phản đòn tình huống" | `sparring` | 45 | 7 |
| `strength` "Sức mạnh thân trên" | `strength_conditioning` | 60 | 6 |
| `tactics` "Đọc trận & phân tích đối thủ" | `technical_drilling` | 40 | 2 |

Đây là **số liệu do Claude đề xuất**, chưa được HLV chuyên môn thẩm định (bản demo chỉ có số hiệp × phút, không có thời lượng cả buổi). Cần duyệt trước demo 31/10; đổi số chỉ là đổi hằng số.

`tactics` dùng `technical_drilling`, loại mà training service **chưa có** (`SESSION_TYPE_FOR` ghi chú "Technical drilling has none yet"). Hệ quả:

- Form ở API mode (`serviceForm` true): **ẩn** mẫu mà loại của nó không thuộc `SERVICE_TRAINING_TYPES`. Chỉ còn 3 thẻ.
- Form ở demo mode: hiện đủ 4 thẻ.
- Muốn có mẫu "Đọc trận" ở API mode thì cần backend thêm loại buổi (migration enum). Không làm ở đây; ghi vào handover nếu chủ dự án muốn.

### Hàm thuần (`session-templates.ts`)

```ts
type SessionTemplateId = "distance" | "counter" | "strength" | "tactics";
interface SessionTemplate { id: SessionTemplateId; type: TrainingType; durationMin: number; targetRpe: number; stepCount: 3 }
const SESSION_TEMPLATES: SessionTemplate[];
function availableTemplates(serviceForm: boolean): SessionTemplate[];   // ẩn loại không có ở service khi serviceForm
function applySessionTemplate(values: SessionFormValues, template: SessionTemplate, text: { name: string; steps: { name: string; detail: string }[] }, defaultLocation: string): SessionFormValues;
```

`applySessionTemplate` trả giá trị form mới:

- `title` = tên mẫu; `type` = loại của mẫu; `durationMin` = `String(template.durationMin)`; `targetRpe` = `template.targetRpe`;
- `notes` = các bước viết thành văn bản: `"1. <tên bước>: <chi tiết>\n2. …\n3. …"` (độ dài ≤ 1000 ký tự, giới hạn của ô ghi chú);
- `location`: giữ nếu HLV đã đổi tay khác mặc định của loại cũ; không thì lấy mặc định của loại mới (cùng quy tắc với `changeType` ở `session-form.tsx`);
- **không đụng** `fighterId`, `planId`, `date`, `time`, `exercises`.

Chọn mẫu khác sau đó ghi đè các trường trên bằng mẫu mới; mọi sửa tay trước đó ở `title`, `notes`, `durationMin`, `targetRpe` bị thay. Có nút "Bỏ mẫu" chỉ bỏ đánh dấu thẻ, giữ nguyên giá trị đã điền.

### Giao diện

- Thẻ: dòng nhóm (Kỹ thuật, Đối kháng, Thể lực, Chiến thuật), tên, mục đích; `aria-pressed` cho thẻ đang chọn. Nhãn "Có hạn chế" khi loại của mẫu nằm trong `restrictedTypes` của võ sĩ đang chọn (khi chưa chọn võ sĩ thì không hiện).
- Chọn mẫu bị hạn chế vẫn điền được, vì kiểm tra cấp phép trực tiếp có sẵn (`ClearanceCheckPanel`) sẽ chặn hoặc cảnh báo; không thêm logic chặn mới.
- Khối "Vì sao cân nhắc bài này?" và ba bước chỉ hiện khi có mẫu được chọn. Dòng nhắc cố định dưới danh sách: "Mẫu minh họa cấu trúc. Nội dung và liều lượng cần HLV chuyên môn thẩm định." (như bản demo).
- Theo mẫu trình bày hiện có trong form (`FormSection`, `ChoiceGroup`, `Card`). Không cuộn ngang ở 390 px: thẻ xếp một cột trên màn hẹp, hai cột từ `sm`.

## Tiêu chí nghiệm thu

1. Ở `/coach/sessions/new`, mục "Mẫu giáo án" hiện ở đầu form. Demo mode: 4 thẻ. API mode: 3 thẻ (không có "Đọc trận & phân tích đối thủ"). Test `availableTemplates(true)` trả 3 mẫu, `availableTemplates(false)` trả 4.
2. Chọn "Jab – cross – thoát góc": `title` = tên mẫu, loại = pad work, thời lượng = 45, ghi chú gồm đủ 3 bước đánh số; trong demo mode `targetRpe` = 5. Test `applySessionTemplate` với giá trị form trống và với giá trị đã nhập tay (kiểm tra `fighterId`, `planId`, `date`, `time`, `exercises` không đổi).
3. `notes` của mọi mẫu, ở cả hai ngôn ngữ, dài ≤ 1000 ký tự (test).
4. `location`: đã đổi tay thì giữ; còn là mặc định của loại cũ thì đổi theo loại mới (test).
5. Với võ sĩ có hạn chế chặn `sparring`, thẻ "Phòng thủ → phản đòn" hiện nhãn "Có hạn chế" và ở form demo, panel kiểm tra cấp phép báo xung đột sau khi chọn (kiểm tra tay, ghi vào handover). Chưa chọn võ sĩ thì không có nhãn.
6. "Bỏ mẫu" bỏ đánh dấu và khối lý do, giữ giá trị form.
7. Gửi form sau khi chọn mẫu ở API mode tạo được buổi qua `POST /training-sessions` (kiểm tra tay với backend, dữ liệu giả, theo [TEAM-WORKFLOW §3a](../TEAM-WORKFLOW.md#3a-cách-giao-việc)): loại, tiêu đề, thời lượng, ghi chú đúng như đã điền.
8. Trang `edit` và các luồng tạo buổi khác (từ trang plan, trang võ sĩ) không đổi hành vi; test hiện có qua.
9. Tiếng Việt mặc định, tiếng Anh với `mma_locale=en`; không chữ cứng trong file mới; `translate.test.ts` qua (đủ key hai phía).
10. Không cuộn ngang ở 390 px (kiểm tra tay, ghi vào handover).
11. lint, typecheck, test qua; không thêm lỗi so với [BASELINE](./BASELINE.md).

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```

## Câu hỏi mở (ghi vào handover nếu người làm gặp, không tự đoán)

- Thời lượng và RPE của 4 mẫu cần HLV duyệt.
- Có muốn thêm loại buổi "Chiến thuật / phân tích video" ở backend để mẫu thứ tư dùng được ở API mode không (migration enum; chủ dự án quyết).
- Tên và ghi chú của buổi tạo từ mẫu là dữ liệu lưu trong database theo ngôn ngữ lúc chọn; đổi ngôn ngữ giao diện sau đó không dịch lại.
