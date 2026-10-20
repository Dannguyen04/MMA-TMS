# T-026 Handover (phần backend)

- Nhánh: feat/T-026-session-templates-backend    Commit: đầu nhánh (`git log -1`)
- Trạng thái: IN REVIEW
- **Người viết: Claude**, theo chỉ dẫn trực tiếp của chủ dự án ngày 20/10 (CLAUDE.md thường chỉ cho Claude viết tài liệu). Vì vậy phần này nên được người khác review kỹ hơn bình thường.

## Thay đổi
- `nestjs-api/migrations/028_session_type_tactical_analysis.sql`: thêm giá trị `TACTICAL_ANALYSIS` vào enum `session_type`. Yêu cầu ledger đã có 023.
- `nestjs-api/migrations/029_session_templates.sql`: enum `session_template_category`, bảng `session_templates` (RLS bật, revoke `anon`/`authenticated`), seed 4 mẫu (vi + en), quyền `training.session_template:read` cho COACH và ADMIN. Yêu cầu ledger đã có 028.
- `manifest.json`, `scripts/migration-files.mjs`, `run_sql.mjs`, `package.json` (`db:migrate:028`, `db:migrate:029`), `migrations/README.md`: đăng ký theo quy ước.
- `scripts/test-migrations.mjs`: 3 ca mới (028; 029; 028 và 029 từ chối khi thiếu ledger tiền đề).
- `src/database/schema.ts`: enum, giá trị `TACTICAL_ANALYSIS`, bảng `sessionTemplates`. Không khai báo CHECK `ck_session_templates_translations` trong Drizzle (chỉ có ở SQL).
- `src/training/training.model.ts`, `training.dto.ts`, `training.module.ts`: loại buổi mới, quyền `SESSION_TEMPLATE_READ`, schema và DTO của mẫu.
- `src/training/templates/` (mới): `session-template.repo.ts`, `.service.ts`, `.controller.ts` và ba file spec. Endpoint `GET /training-session-templates?locale=vi|en`.
- `src/fighters/fighters.model.ts`: thêm loại buổi mới vào `sessionTypes`.
- `src/medical/medical.service.ts`: `NON_PHYSICAL_SESSION_TYPES`; `TACTICAL_ANALYSIS` không bị `allowedSessionTypes` của clearance chặn. Hai test mới trong `medical.service.spec.ts`.
- `docs/tickets/T-026-session-templates.md`: viết lại theo phần backend đã làm và phần frontend còn lại.

## Đối chiếu tiêu chí nghiệm thu
Không có tiêu chí backend riêng trong ticket (ticket gốc chỉ frontend). Tự đặt:

| Tiêu chí | Đáp ứng ở đâu |
| --- | --- |
| 028, 029 áp được trên ledger 023, ghi ledger, từ chối áp lại | `test-migrations.mjs`: "028 adds…", "029 seeds…" |
| Thiếu ledger tiền đề thì từ chối, không ghi gì | `test-migrations.mjs`: "028 and 029 reject a database without their ledger prerequisites" |
| Ràng buộc dữ liệu (mã, thời lượng, RPE, đủ vi/en, cùng số bước, mã trùng) | 5 ca `rejects` trong "029 seeds…" (đã bắt được một lỗi NULL trong CHECK, đã sửa bằng COALESCE) |
| RLS bật, `authenticated` không đọc được | cùng ca |
| Quyền chỉ cho COACH, ADMIN | cùng ca; `session-template.controller.spec.ts` kiểm tra metadata quyền |
| Chữ ghép thành ghi chú ≤ 1000 ký tự | cùng ca (truy vấn độ dài) |
| API trả chữ đúng ngôn ngữ, đúng thứ tự, không lộ cột nội bộ | `session-template.service.spec.ts` |
| Dòng Drizzle (Date) qua Zod thành entity | `session-template.repo.spec.ts` |
| `TACTICAL_ANALYSIS` không bị danh sách loại buổi của clearance chặn, vẫn cần khám và clearance | `medical.service.spec.ts` (hai test mới) |

## Lệnh đã chạy
```
pnpm --filter nestjs-api lint
(exit 0; chỉ cảnh báo có sẵn, không cảnh báo nào ở file mới)

pnpm --filter nestjs-api build
$ nest build   (exit 0)

pnpm --filter nestjs-api test
 Test Files  6 failed | 46 passed (52)
      Tests  26 failed | 654 passed (680)
(26 lỗi đều là B1, B2 trong BASELINE: coaching-loop-persistence 5, dataset-export-trust-boundary 21, bốn file spec rỗng của notifications)

PG_TEST_BIN="C:/Program Files/PostgreSQL/18/bin" pnpm --filter nestjs-api test:db
PASS 028 adds the TACTICAL_ANALYSIS session type and records ledger 28
PASS 029 seeds four read-only session templates, grants read to COACH and ADMIN, records ledger 29
PASS 028 and 029 reject a database without their ledger prerequisites
Migration checks passed: 42. PostgreSQL stopped after tests.

pnpm --filter nestjs-api db:check
001-029 checksums OK. No database connection was opened.
```
So với BASELINE: 26 lỗi trước, 26 lỗi sau, cùng nguyên nhân; `test:db` chạy được (BASELINE B3 ghi không chạy được, đã được sửa từ T-002).

## Lệch so với ticket
- Ticket gốc chỉ frontend. Chủ dự án thêm hai việc backend (loại buổi mới, bảng mẫu + endpoint), làm trên nhánh riêng này.
- Hai migration (028 và 029) thay vì một: PostgreSQL không cho dùng giá trị enum mới trong cùng transaction thêm nó, mà seed cần `TACTICAL_ANALYSIS`.
- Số 028, 029 vì 024–027 đã dành cho T-003, T-007, T-009, T-010. 028 chỉ yêu cầu ledger có 023, nên không phụ thuộc các ticket đó. `migration-files.mjs` và `manifest.json` sẽ xung đột văn bản nhỏ khi merge cùng các ticket kia; giữ cả hai bên.
- Chưa có endpoint ghi; không có audit trigger.

## Câu hỏi / việc còn mở
- **Quy tắc y tế mới** ("TACTICAL_ANALYSIS không bị `allowedSessionTypes` chặn") là quyết định nghiệp vụ tôi đề xuất dựa trên bản demo (`physical: false`). Cần bác sĩ hoặc chủ dự án xác nhận. Đổi lại chỉ là xoá `NON_PHYSICAL_SESSION_TYPES` và hai test.
- Thời lượng và RPE của 4 mẫu (45′/5, 45′/7, 60′/6, 40′/2) là đề xuất, chưa HLV duyệt.
- Chưa áp migration lên Supabase (chủ dự án áp 028 rồi 029 sau khi APPROVED).
- Chưa chạy backend thật hay gọi endpoint bằng HTTP: kiểm tra bằng unit test và test migration. `main.ts` và guard không đổi.
- Frontend chưa làm: phần còn lại của ticket T-026.
