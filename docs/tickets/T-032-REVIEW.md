# T-032 Review

- Ngày review: 27/10/2026, Claude. Hotfix theo yêu cầu trực tiếp của chủ dự án.
- Phạm vi: 2 commit của Fon (`fogit-hd`) trên `origin/feat/mobile-platform`: `1178c6c` (đổi tên DTO), `cd72f97` (Date trong JSON Schema, test, ticket). Mã lỗi gốc của Ken: `a43b227` (25/10, đình chỉ tập, T-007) và `e5d84dd` (25/09, fighter-admissions).
- **Kết luận: APPROVED.** Không có vấn đề mức "chặn".

## Nhánh

Hai commit nằm lẫn trong khoảng 408 file của nhánh mobile, nên Claude **không** merge nhánh đó. Claude tạo `fix/T-032-swagger-dto` từ `fight-camp` (`e697fee`) và cherry-pick hai commit, không xung đột: `26f722d`, `6b102e8`. Nhánh `feat/mobile-platform` review riêng.

## Lệnh đã chạy lại

Khởi động `dist/main.js` bằng env giả (Supabase, DB trỏ tới `127.0.0.1:9`):

```text
fight-camp e697fee : Error: Date cannot be represented in JSON Schema   (dừng ở SwaggerModule.createDocument)
hotfix 6b102e8     : qua Swagger, dừng ở CoachingService.onModuleInit, ECONNREFUSED 127.0.0.1:9 (đúng dự kiến, DB giả)
```

```text
nestjs-api lint  : không có lỗi (chỉ cảnh báo có sẵn)
nestjs-api build : $ nest build — qua
nestjs-api test  (hotfix)     : Tests  26 failed | 1023 passed (1049)
nestjs-api test  (fight-camp) : Tests  26 failed | 1021 passed (1047)
```

26 lỗi giống nhau ở hai bên, đều có sẵn (`dataset-export-trust-boundary` 20, `coaching-loop-persistence` 5, 4 file `notifications` không nạp được), xem [BASELINE](./BASELINE.md). Hotfix thêm 2 test, đều qua.

## Đối chiếu tiêu chí

| Tiêu chí ([T-032](./T-032-backend-json-schema-dto-fixes.md)) | Kết quả |
| --- | --- |
| Backend khởi động không còn lỗi Date | Đạt, chạy thử ở trên |
| Hai DTO assignment có tên OpenAPI riêng | Đạt: `AdmissionAssignCoachDto` (`fighter-admissions.dto.ts`), `AssignCoachDto` (`fighters.dto.ts:50`) |
| Regression test qua | Đạt: `src/suspensions/suspensions.dto.spec.ts`, 2 test |
| Build qua | Đạt |
| "Ken review bốn file" | Thay bằng review này: review là việc của Claude, Ken là tác giả code lỗi |

## Nhận xét

- `ConflictProposalResponseDto` chỉ dùng làm `model` của Swagger (`training-suspension-conflicts.controller.ts:65`), không parse response lúc chạy, nên đổi `toScheduledAt` sang chuỗi ISO không đổi hành vi API. Schema domain `conflictProposalResponseSchema` giữ nguyên.
- **Nên sửa (ticket sau):** review T-007 không bắt được lỗi vì bộ kiểm tra không có bước nào tạo tài liệu Swagger. Đề nghị thêm test tạo `SwaggerModule.createDocument` cho toàn app (không cần DB) vào định nghĩa hoàn thành backend.
- Ticket T-032 do Fon viết, Claude giữ nguyên nội dung vì đã đủ bối cảnh, nguyên nhân và cách sửa.
