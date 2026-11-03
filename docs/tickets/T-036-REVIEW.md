# T-036 Review (phần A)

- Nhánh: `feat/T-036-suspension-plan-link` (tạo từ `User_Feature` sau khi merge T-035).
- Người thực hiện: `agy`, `gemini-4-argon-high`, phiên `962bf6ae-18af-4d24-93dc-8d256de66b13`, 2 lượt (lượt đầu khoảng 46 phút, lượt sửa khoảng 60 phút).
- Ngày: 29/10/2026.

## Kết luận

Lượt sửa 1 Claude ghi APPROVED, nhưng **review độc lập** (subagent không mang ngữ cảnh, 29/10) tìm thêm 2 lỗi hành vi và một test rollback không có giá trị, nên trạng thái đổi thành **CHANGES REQUESTED**, sửa ở lượt 2 (commit `c6f3214`). Kết luận cuối ghi ở mục "Review độc lập" bên dưới. Migration 032 **chưa áp lên Supabase**: chủ dự án áp bằng `pnpm db:migrate:032` sau khi merge (chỉ cần ledger có 024).

## Lệnh Claude chạy lại (sau lượt sửa 1)

| Lệnh | Kết quả |
| --- | --- |
| `pnpm --filter nestjs-api lint` | Thoát 0 |
| `pnpm --filter nestjs-api build` | Thoát 0 |
| `pnpm --filter nestjs-api db:check` | `001-032 checksums OK. No database connection was opened.` |
| `pnpm --filter nestjs-api test:db` | `Migration checks passed: 46.` Có ca 032: áp trên ledger 24 không cần 025–031, thêm `PENDING`, chặn áp lại và chặn khi thiếu 024 |
| `npx vitest run src/suspensions src/training src/coaching src/bouts` | `Test Files 24 passed (24)`, `Tests 589 passed (589)` |
| `pnpm --filter nestjs-api test` | `Test Files 6 failed | 59 passed (65)`, `Tests 26 failed | 1034 passed (1060)`: 26 lỗi đúng [baseline](./BASELINE.md) B1, B2; tăng 6 test so với sau T-035 (1028) |
| `grep "from '../(training|bouts)" src/suspensions/` (không tính spec) | 0 dòng: hướng phụ thuộc giữ đúng |

## Vấn đề đã sửa ở lượt 1

| # | Mức | Vấn đề | Cách sửa |
| --- | --- | --- | --- |
| 1 | Chặn | `handleSuspensionsCreated` gửi thông báo huỷ **bên trong** transaction tạo đình chỉ hoặc ghi kết quả trận. Rollback thì võ sĩ vẫn nhận thông báo về buổi không bị huỷ | Kết quả có `afterCommit`; `SuspensionsService.createSuspension` (`suspensions.service.ts:136`) và `BoutsService` ghi kết quả (`bouts.service.ts:1567`) gọi sau khi transaction resolve. `afterCommit` không nằm trong response |
| 2 | Nên sửa | `@Optional()` cùng `= new SuspensionEffects()` ở 3 constructor: DI lỗi thì mỗi nơi một instance, cơ chế tự áp dụng tắt mà không báo | Đã bỏ |
| 3 | Nên sửa | `lockActiveCampPlansByFighterId?.(…)` che việc thiếu hàm | Gọi thẳng |

## Đối chiếu tiêu chí

| # | Kết quả |
| --- | --- |
| 1. Đình chỉ cố định → `PENDING`, giữ `scheduledAt`, có trong `affectedSessions` | Đạt |
| 2. Đình chỉ cần xác nhận → `CANCELLED` lý do `'Suspension in force'`, thông báo sau commit | Đạt (sau lượt 1) |
| 3. Loại không bị chặn, ngoài khoảng, đã `COMPLETED`/`IN_PROGRESS`: không đổi | Đạt |
| 4. Cùng transaction với ghi kết quả; rollback thì buổi không đổi | Đạt |
| 5. `PENDING` + `scheduledAt` sau đình chỉ → `SCHEDULED`; còn trong khoảng → 409; `IN_PROGRESS` → lỗi chuyển trạng thái; `CANCELLED` có lý do → được | Đạt (`applySessionUpdateInTransaction`, `updateSessionStatus` chặn `PENDING → SCHEDULED` không đổi ngày) |
| 6. KO, TKO, MEDICAL: plan `ACTIVE` `fight_camp`/`taper` → `rehab`; các trường hợp khác không đổi | Đạt (khoá plan trước khi đổi) |
| 7. `planConflicts` chỉ `PENDING`/`CANCEL`; `apply` với `CHANGE_TYPE` lỗi validation | Đạt |
| 8. `register` hai lần ném lỗi; `runOnCreated` không handler trả rỗng; không import ngược | Đạt |
| 9. Migration 032 qua `test:db`, `db:check`; không thêm lỗi so với baseline | Đạt |

## Gợi ý (không chặn)

- Ghi kết quả trận tạo nhiều đình chỉ cùng lúc (ví dụ KO cộng nghỉ bắt buộc): `affectedSessions`, `affectedPlans` là kết quả **chung** của cả lượt nhưng được gắn lặp lại vào từng đình chỉ trong response (`bouts.service.ts:1677-1678`). Frontend (phần B) nên đọc từ đình chỉ đầu tiên, hoặc chuyển lên cấp response khi làm phần B.
- Breaking change cho frontend: `CONFLICT_ACTIONS` không còn `CHANGE_TYPE`, `RESCHEDULE`. T-030 phần B (Hoàng Anh) phải theo hai hành động mới.

## Review độc lập (29/10)

Theo quy định mới của chủ dự án (29/10): trước khi kết luận xong, Claude cho một subagent không mang ngữ cảnh hội thoại review chỉ đọc, không tin handover.

### Lần 1 (trên `2130c70`, sau lượt sửa 1)

| # | Mức | Vấn đề | Xử lý |
| --- | --- | --- | --- |
| 1 | Nên sửa | Tự áp dụng khi tạo đình chỉ chạy `planConflicts` trên **mọi** đình chỉ của võ sĩ, nên buổi chỉ bị đình chỉ **cũ** chặn cũng bị đổi và tính vào `affectedSessions` của đình chỉ mới (vi phạm tiêu chí 3) | Lượt 2: chỉ giữ đề xuất cho buổi bị đình chỉ vừa tạo chặn (`filterProposalsForSuspension`); hành động vẫn tính trên mọi đình chỉ có hiệu lực |
| 2 | Nên sửa | Đọc buổi không khoá rồi mới khoá, không kiểm lại trạng thái: buổi vừa bắt đầu (`IN_PROGRESS`) có thể bị huỷ; buổi đã huỷ bởi đình chỉ khác làm lỗi cả việc tạo đình chỉ | Lượt 2: sau khi khoá, buổi không còn `SCHEDULED` thì bỏ qua |
| 3 | Nên sửa | Test rollback (tiêu chí 4) dùng handler giả và mock transaction tự khôi phục, qua bất kể code | Lượt 2: test dùng `TrainingSuspensionConflictsService` thật; mọi lời gọi repo thiếu đúng `tx` ném lỗi; kiểm thứ tự `tx:commit` trước thông báo |
| 4 | Nên sửa | Mặc định chặn của T-035 bị chép tay 6 loại | Lượt 2: lại lọc từ `SESSION_TYPES` |
| 5 | Nên sửa | Mô tả Swagger của conflicts còn nói `CHANGE_TYPE`, `RESCHEDULE` | Lượt 2: sửa |
| 6, 9 | Gợi ý | Thiếu test `CHANGE_TYPE` bị từ chối; hàm ngày học viện có hai bản | Lượt 2: thêm test; giữ một nguồn ở `suspensions.constants.ts` |
| 7 | Gợi ý | Ghi kết quả trận tạo nhiều đình chỉ: `affectedSessions` chung gắn lặp vào từng đình chỉ | Giữ, ghi cho phần B (frontend đọc từ đình chỉ đầu) |
| 8 | Gợi ý | Hàm khoá plan còn lọc `is_active = true`, chặt hơn ticket | Giữ, chủ ý |

Bài học: review của Claude ở lượt 1 đã chấp nhận test rollback tự đúng và bỏ sót lỗi 1, 2. Từ lượt 2 áp quy định "ca kiểm thử viết trước code".

### Ca kiểm thử của lượt sửa 2 (Claude viết trước khi đọc code của lượt sửa)

## Ca kiểm thử lượt sửa 2 (Claude viết 29/10, trước khi đọc code của lượt sửa)

Ngày học viện cố định, không dùng giờ máy. Võ sĩ `F`. "Tạo đình chỉ" = gọi handler `handleSuspensionsCreated` qua đường thật `SuspensionsService.createSuspension` khi lớp test là service.

| # | Tên | Dữ liệu trước | Hành động | Kết quả mong đợi | Lớp |
| --- | --- | --- | --- | --- | --- |
| C1 | Đình chỉ mới không đụng buổi của đình chỉ cũ | Đình chỉ `OTHER` cũ 2026-11-01..07, không cần xác nhận. Buổi `S1` `SPARRING` 2026-11-03 trạng thái `SCHEDULED` | Tạo `MANDATORY_REST` 2026-12-01..03 | `S1` vẫn `SCHEDULED`; `affectedSessions` rỗng | Service (mock repo) |
| C2 | Đình chỉ mới vẫn xử lý buổi của mình khi có đình chỉ cũ | Như C1, thêm `S2` `SPARRING` 2026-12-02 `SCHEDULED` | Tạo `MANDATORY_REST` 2026-12-01..03 | `S2` thành `PENDING`; `S1` không đổi; `affectedSessions = [{S2, PENDING}]` | Service |
| C3 | Hành động tính trên mọi đình chỉ có hiệu lực | Đình chỉ `KO` cũ cần xác nhận, chưa xác nhận, từ 2026-11-25. Buổi `S3` `SPARRING` 2026-12-02 | Tạo `MANDATORY_REST` 2026-12-01..03 | `S3` thành `CANCELLED` (vì có đình chỉ cần xác nhận cùng chặn), nằm trong `affectedSessions` của đình chỉ mới với `CANCEL` | Service |
| C4 | Buổi đã sang `IN_PROGRESS` khi khoá thì bỏ qua | Đọc danh sách thấy `S4` `SCHEDULED`; lúc khoá dòng, `S4` đã là `IN_PROGRESS` | Tạo đình chỉ `KO` chặn `S4` | `S4` vẫn `IN_PROGRESS`; không gọi huỷ; không có trong `affectedSessions`; không ném lỗi; không có thông báo | Service |
| C5 | Buổi đã `CANCELLED` khi khoá thì bỏ qua | Đọc thấy `S5` `SCHEDULED`; lúc khoá đã `CANCELLED` | Tạo `OTHER` chặn `S5` | Tạo đình chỉ thành công; `S5` không đổi; không có trong `affectedSessions` | Service |
| C6 | Rollback thật | Buổi `S6` bị chặn; transaction ném lỗi **sau** `runOnCreated` | Ghi kết quả trận thua KO | Mọi lời gọi ghi trong handler (khoá, huỷ/chờ, đổi pha) nhận **đúng đối tượng `tx`** của transaction đang chạy; `notifySessionCancelled` **không** được gọi. Test phải lỗi nếu handler dùng `this.db` hoặc gửi thông báo trước khi transaction resolve | Service, dùng `TrainingSuspensionConflictsService` thật |
| C7 | Mặc định chặn lấy từ `SESSION_TYPES` | — | So sánh `DEFAULT_MANUAL_BLOCKED_SESSION_TYPES` | Bằng `SESSION_TYPES` bỏ `RECOVERY`, `PHYSICAL_THERAPY`, cùng thứ tự | Unit |
| C8 | Hành động cũ bị từ chối | — | `POST /suspensions/:id/conflicts/apply` với `{ sessionIds: [S], action: 'CHANGE_TYPE' }` (hoặc dạng body thật của schema) | Lỗi validation có sẵn, không đổi buổi nào | Unit schema hoặc service |
| C9 | Một nguồn cho ngày học viện | — | `academyDateOf` dùng trong `bouts.model.ts` | Là cùng hàm import từ `suspensions.constants.ts` (kiểm bằng `grep`: `bouts.model.ts` không còn định nghĩa `academyDateOf`, `addDaysToDate`, `daysBetweenDates`, `ACADEMY_UTC_OFFSET_MS`, `LOSS_OF_CONSCIOUSNESS_VALUES`) | grep |

Đối chiếu sau lượt 2: C1–C6, C8, C9 có test tương ứng (`training-suspension-conflicts.service.spec.ts`: "only applies proposals for sessions blocked by the newly created suspension(s)…", "skips sessions that are no longer SCHEDULED after row locking…", "rejects POST apply payload containing legacy action CHANGE_TYPE…"; `bouts.service.spec.ts`: "runs SuspensionEffects.runOnCreated once with both KO and MANDATORY_REST… (Criterion 4)"). C7 dùng test của T-035 kiểm đủ 6 loại.

Lệnh Claude chạy lại sau lượt 2 (trên `User_Feature` sau khi merge): `lint` thoát 0, `build` thoát 0, `db:check` `001-032 checksums OK`, `test:db` `Migration checks passed: 46`, `npx vitest run src/suspensions src/training src/coaching src/bouts` `Tests 601 passed (601)`.

### Lần 2 (trên `User_Feature` sau khi merge lượt sửa 2)

Subagent mới, không mang ngữ cảnh, review chỉ đọc trên `acb7850`: cả 7 điểm **đã sửa** (có `file:dòng` và lý do vì sao test mới lỗi được nếu code sai). Merge với T-045 tự động, không xung đột, không làm hỏng lộ trình tập lại hay bảng sẵn sàng. Còn 3 gợi ý, không chặn:
- N1: mock `notifyResolved` trong `bouts.service.spec.ts:4001` lệch kiểu (TS2322, chỉ ở spec; `tsc --noEmit` trên spec đã có 75 lỗi có sẵn).
- N2: test rollback chưa kiểm `tx` cho repo đình chỉ (`insertSuspension` chỉ kiểm có tham số).
- N3: buổi đã `PENDING` do đình chỉ cố định cũ không bị huỷ khi có thêm đình chỉ KO; vẫn an toàn vì xếp lại phải qua Cổng 2. Có muốn huỷ hay không là quyết định nghiệp vụ, ghi để chủ dự án xem.

Toàn bộ test trên `acb7850`: `Test Files 6 failed | 59 passed (65)`, `Tests 26 failed | 1046 passed (1072)`, 26 lỗi đúng baseline B1, B2.

**Kết luận cuối: APPROVED** (T-036 phần A cùng T-035, T-045 trên `User_Feature`).

## Phần A2 (29/10): buổi "Chờ xếp lại" khi có thêm đình chỉ cần xác nhận

- Nhánh `fix/T-036-a2-pending-on-clearance`. `agy`: argon-high hết quota giữa chừng, `gemini-3.8-flash-high` làm tiếp trong cùng phiên.
- Ca kiểm thử P1–P7 Claude viết trước code (ticket mục 5b).
- Lệnh Claude chạy lại: `lint` thoát 0, `build` thoát 0, `db:check` `001-032 checksums OK`, `test:db` `Migration checks passed: 48`, test liên quan `651 passed (651)`, toàn bộ `Tests 26 failed | 1144 passed (1170)` (26 lỗi đúng baseline).
- Review độc lập (subagent không mang ngữ cảnh): logic đúng quy tắc; đọc và ghi đều qua transaction; chỉ nuốt lỗi bỏ qua của chính nó; không xử lý trùng buổi; thông báo chỉ sau commit; P1–P6 sẽ lỗi nếu code sai. Một mục nên sửa: P7 là test giữ chỗ, tên không khớp nội dung; đã đổi tên cho đúng thứ nó kiểm. N1, N2 của lần review trước đã đạt.
- **Kết luận: APPROVED.**
