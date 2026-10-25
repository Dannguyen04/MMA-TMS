# T-026 Handover (backend và frontend)

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
- Frontend: xem phần dưới.

---

# Phần frontend

- Nhánh: feat/T-026-session-templates-ui (tạo từ nhánh backend; merge backend trước)    Commit: đầu nhánh (`git log -1`)
- **Người viết: Claude**, theo chỉ dẫn trực tiếp của chủ dự án ngày 20/10.

## Thay đổi
- `src/lib/domain/session-templates.ts` (mới) + test: kiểu `SessionTemplate`, `sessionTemplateNotes`, `applySessionTemplate` (điền tiêu đề, loại, thời lượng, RPE, ghi chú; địa điểm theo loại trừ khi HLV đã sửa tay; không đụng võ sĩ, plan, ngày, giờ, bài tập).
- `src/components/training/session-template-picker.tsx` (mới): thẻ chọn mẫu, khối lý do, các bước, nhãn "Có hạn chế", nút "Bỏ mẫu".
- `src/components/training/session-form.tsx`: prop `templates`, picker ở đầu form (chỉ `mode="create"`), `applyTemplate`, địa điểm mặc định `tactical_analysis`.
- `src/app/(app)/coach/sessions/new/page.tsx`: tải mẫu theo locale; lỗi (ví dụ chưa áp migration 029) chỉ ẩn picker.
- `src/lib/services/training.ts`, `training.demo.ts`, `src/lib/mocks/session-templates.ts` (mới): `listSessionTemplates(locale)`; API mode gọi `GET /training-session-templates?locale=…`; demo mode dùng bản sao 4 mẫu.
- Loại buổi `tactical_analysis`: `types.ts`, `medical-contract.ts`, `medical-mappings.ts`, `training-contract.ts`, `labels.ts`, `training-type-icon.tsx`, `mocks/training.ts`, `coach-today.{en,vi}.ts`.
- `medical-mappings.ts`: `restrictionFromAllowLists` không bao giờ chặn `tactical_analysis` (khớp quy tắc backend).
- `src/lib/i18n/messages/session-templates.{en,vi}.ts` (mới), đăng ký ở `en.ts`, `vi.ts`.

## Đối chiếu tiêu chí nghiệm thu (frontend, theo T-026)
| Tiêu chí | Đáp ứng ở đâu |
| --- | --- |
| 1. Đủ 4 thẻ ở demo và API mode | `listSessionTemplates` (`training.test.ts`: API mode và demo mode); kiểm tra tay demo mode: 4 nút |
| 2. Chọn mẫu điền đúng, không đụng trường khác | `session-templates.test.ts` (5 ca `applySessionTemplate`); kiểm tra tay: chọn thẻ thứ hai → tiêu đề, thời lượng 45, địa điểm Cage, ghi chú 3 dòng |
| 3. Ghi chú ≤ 1000 ký tự | `session-templates.test.ts` ("never exceeds"); migration 029 test độ dài của dữ liệu thật |
| 4. Địa điểm giữ hoặc đổi theo loại | `session-templates.test.ts` (2 ca) |
| 5. "Đọc trận" gửi `TACTICAL_ANALYSIS` | `training-contract.test.ts` (`sessionBody`); kiểm tra tay: chọn thẻ thứ tư → loại Tactical analysis, địa điểm Film room |
| 6. Nhãn "Có hạn chế" | Đã kiểm tra tay (demo mode, 8 võ sĩ): Marcus Hale (clearance chặn heavy bag, pad work, sparring) thấy nhãn ở "Jab – cross – thoát góc" (pad work) và "Phòng thủ → phản đòn" (sparring); Tariq Haddad chỉ ở "Phòng thủ → phản đòn"; 6 võ sĩ còn lại không có nhãn; "Đọc trận" và "Sức mạnh thân trên" không bao giờ có nhãn ở hai võ sĩ trên. `medical-mappings.test.ts` kiểm tra `tactical_analysis` không bị chặn |
| 7. "Bỏ mẫu" | Đã kiểm tra tay: sau khi bấm, thẻ hết đánh dấu, khối "Vì sao cân nhắc bài này?" biến mất, tiêu đề và thời lượng (45) giữ nguyên |
| 8. Tiếng Việt/Anh, không chữ cứng | kiểm tra tay `mma_locale=en` và `vi`: chữ mẫu đổi theo; `translate.test.ts` qua (đủ key hai phía) |
| 9. Kiểm tra tay API mode với backend đã áp 028, 029 | Đã làm 20/10, xem "Kiểm tra API mode" bên dưới (không tạo buổi tập thật) |
| 10. Trang edit và luồng khác không đổi; không cuộn ngang 390 px | picker chỉ hiện khi `mode="create"`; kiểm tra tay 390 px: `scrollWidth` 390 = `clientWidth` 390 |
| 11. lint, typecheck, test không thêm lỗi | bên dưới |

## Lệnh đã chạy
```
pnpm --filter nextjs-frontend lint
$ eslint   (không có cảnh báo hay lỗi)

pnpm --filter nextjs-frontend typecheck
$ next typegen && tsc --noEmit
✓ Types generated successfully   (không lỗi)

pnpm --filter nextjs-frontend test
 Test Files  77 passed | 1 skipped (78)
      Tests  666 passed | 2 skipped (668)
```
BASELINE ghi 578 test, 1 bị skip; số test tăng do các ticket đã merge sau BASELINE và 14 test mới của ticket này; không test nào lỗi.

Kiểm tra tay bằng trình duyệt headless (Chromium) với demo mode, tài khoản HLV demo, `/coach/sessions/new`: desktop (vi, en) và 390 px (vi); không lỗi trang (`pageerror` rỗng).

## Lệch so với ticket
- Hai biến thể của `restrictionFromAllowLists` và `medical-mappings.ts` được sửa thêm so với danh sách file trong ticket, để khớp quy tắc backend "TACTICAL_ANALYSIS không bị danh sách loại buổi chặn".
- Bản sao dữ liệu demo (`mocks/session-templates.ts`) ghi chú đồng bộ thủ công với migration 029.

## Câu hỏi / việc còn mở
- Chưa tạo thử một buổi tập thật từ mẫu bằng `POST /training-sessions` (sẽ ghi vào database dùng chung). Giá trị `TACTICAL_ANALYSIS` đã được database chấp nhận (4 dòng seed dùng cùng enum).
- Phần còn lại của `session-form.tsx` vẫn tiếng Anh vì T-015 chưa merge; picker đã song ngữ. Xung đột khi merge với T-015: chỉ ở `session-form.tsx` (hai import, một prop, một hàm, một khối JSX).
- `en.ts` và `vi.ts`: mỗi ticket dịch thêm một dòng đăng ký; xung đột chỉ là dòng liền kề, giữ cả hai.

## Kiểm tra API mode (20/10, sau khi chủ dự án yêu cầu áp migration)

Chủ dự án yêu cầu trực tiếp áp migration; Claude áp 028 rồi 029 lên Supabase bằng `run_sql.mjs --apply-028` và `--apply-029` (xem output ở thông báo cho chủ dự án): ledger có dòng 28 và 29, `session_type` có `TACTICAL_ANALYSIS`, `session_templates` có 4 dòng, RLS bật, quyền thuộc ADMIN và COACH.

Sau đó chạy backend từ nhánh `feat/T-026-session-templates-backend` (`dist/main.js`, cổng 3201, `.env` của team) và frontend từ nhánh này (cổng 3102, `APP_DATA_MODE=api`, `API_URL` trỏ cổng 3201); đăng nhập bằng phiên dev `/auth/demo-session` (chỉ ngoài production, theo quyết định 19). Backend ở cổng 3001 và frontend ở cổng 3000 của chủ dự án không bị đụng.

HTTP trực tiếp vào `/training-session-templates`:
| Tài khoản / yêu cầu | Kết quả |
| --- | --- |
| không token | 401 |
| COACH, `locale=vi`, `locale=en`, không có `locale` | 200, 4 mẫu `distance`, `counter`, `strength`, `tactics`, đúng loại buổi (PAD_WORK, SPARRING, STRENGTH_CONDITIONING, TACTICAL_ANALYSIS) và thời lượng 45, 45, 60, 40; chữ tiếng Việt cho `vi` và mặc định, tiếng Anh cho `en` |
| COACH, `locale=fr` | 422 `VALIDATION_ERROR` ở `locale` |
| ADMIN | 200, 4 mẫu |
| FIGHTER, DOCTOR | 403 |

Trình duyệt headless, `/coach/sessions/new` với HLV thật, desktop: tiếng Việt và tiếng Anh đều hiện đủ 4 thẻ lấy từ API; chọn "Đọc trận & phân tích đối thủ" thì điền tiêu đề, loại `tactical_analysis`, thời lượng 40, địa điểm Film room, ghi chú 3 dòng; không lỗi trang.

Chưa làm: gửi form tạo buổi tập thật (sẽ ghi dữ liệu vào database dùng chung).

## Cập nhật 25/10: merge `fight-camp` mới vào nhánh

- Nhánh: `feat/T-026-session-templates-ui`. Merge `origin/fight-camp` tại `0ff5f13` (gồm T-003, T-006 A, T-010, T-012 A, T-015, T-022), **không rebase**, theo kế hoạch Sprint 2 của chủ dự án.
- Người làm: Claude (Opus 5.5), theo chỉ dẫn trực tiếp của chủ dự án ngày 25/10.

### Xung đột và cách giải

| File | Cách giải |
| --- | --- |
| `nestjs-api/migrations/manifest.json`, `scripts/migration-files.mjs`, `run_sql.mjs`, `package.json` | Giữ cả hai bên theo thứ tự số: 024, 027 (fight-camp) rồi 028, 029 (nhánh này). `run_sql.mjs`: dòng hướng dẫn liệt kê đủ `--apply-024 … --apply-029`, thông báo `001-029 checksums OK` |
| `nestjs-api/scripts/test-migrations.mjs` | Giữ cả hai: hằng `target024` cạnh `target028`, `target029`; ca 024, 027 chạy trước, rồi 028, 029 trên cùng database `mma_013` |
| `nestjs-api/migrations/README.md` | Tiêu đề "003–029"; các mục theo thứ tự 029, 028, 027, 024; đóng lại khối lệnh của 028 bị cắt ở chỗ xung đột |
| `docs/tickets/README.md` | Lấy bản của `fight-camp` (mới hơn) |
| `nextjs-frontend/src/components/training/session-form.tsx` | Giữ prop `templates` và khối `SessionTemplatePicker` của nhánh này, dùng key dịch của T-015 cho mục "Võ sĩ & giáo án"; bỏ một dòng `import { useT }` bị lặp sau merge |

028 chỉ yêu cầu ledger 023 nên chạy được sau 024 và 027; 029 yêu cầu 028. Không đổi nội dung file SQL nào, checksum giữ nguyên.

### Lệnh đã chạy (sau merge)

```
pnpm --filter nestjs-api db:check
001-029 checksums OK. No database connection was opened.

pnpm --filter nestjs-api test:db
Migration checks passed: 46. PostgreSQL stopped after tests.
  (PASS 024 …, 024 requires ledger 23 …, 027 applies directly after 024 …, 027 rejects missing ledger 24 …,
   028 adds the TACTICAL_ANALYSIS session type …, 029 seeds four read-only session templates …,
   028 and 029 reject a database without their ledger prerequisites)

pnpm --filter nestjs-api lint     → exit 0, chỉ cảnh báo có sẵn
pnpm --filter nestjs-api build    → $ nest build (không lỗi)
pnpm --filter nestjs-api test
 Test Files  5 failed | 53 passed (58)
      Tests  2 failed | 901 passed (903)
  5 file lỗi đều thuộc baseline: 4 file spec rỗng của notifications (B2) và test/coaching-loop-persistence.spec.ts cần Redis (B1).

pnpm --filter nextjs-frontend lint       → $ eslint (không lỗi)
APP_DATA_MODE=api pnpm --filter nextjs-frontend typecheck → ✓ Types generated successfully, tsc không lỗi
pnpm --filter nextjs-frontend test
 Test Files  77 passed | 1 skipped (78)
      Tests  667 passed | 2 skipped (669)
```

`test:db` chạy trong container `postgres:18` (Docker, PostgreSQL 18, `PG_TEST_BIN=/usr/lib/postgresql/18/bin`) vì máy này chưa cài PostgreSQL 18 ở `C:/Program Files/PostgreSQL/18`. Repo mount chỉ đọc; cluster tạm trong container, không đọc `.env`, không kết nối Supabase.

Kiểm tra tay (demo mode, tiếng Việt): `/coach/sessions/new?fighter=f-minh-tran` hiện 4 thẻ mẫu; chọn "Jab – cross – thoát góc" điền tiêu đề, loại Đấm đích (`pad_work`), 45 phút và ghi chú 3 bước. Phần còn lại của form nay tiếng Việt nhờ T-015.
