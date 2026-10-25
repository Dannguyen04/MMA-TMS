# T-010 Handover

> Phần đầu lưu lịch sử lượt 1. Kết quả hiện tại xem mục **Lượt 2** ở cuối file; các phần từng hoãn mục 6/7 đã được hoàn tất ở lượt 2.

- Nhánh: feat/T-010-opponent-analysis-and-rounds. Commit code/test: f6048c3 (danh sách bên dưới).
- Trạng thái: IN REVIEW — phần làm ngay, mục 1–5.
- Ticket nguồn đã đọc tại D:/test/ai/docs/tickets/T-010-opponent-analysis-and-rounds.md; không sao chép/commit ticket vào worktree.
- **Mục 6, 7 CHƯA LÀM**, chờ T-006 merge; không merge hoặc đổi nhánh trong lượt này.

## Thay đổi

- `nestjs-api/migrations/027_opponent_analysis_and_rounds.sql:1`: migration 027, chỉ cần ledger 24; preflight/collision, advisory lock, cột analysis và số hiệp, bảng hiệp, constraints, cascade, audit, RLS/revoke. Đã đăng ký manifest checksum LF, migration-files, run_sql, package script và migrations/README.
- `nestjs-api/src/database/schema.ts:4476`, `nestjs-api/src/database/schema.ts:4573`: Drizzle khớp cột/bảng/check/unique/FK/RLS mới.
- `nestjs-api/src/bouts/bout-analysis.model.ts:4`: hằng số ngưỡng đề xuất ở một chỗ; Zod strict, ID, bằng chứng, hàm thuần R20–R24 và schema response.
- `nestjs-api/src/bouts/bouts.model.ts:508`: scheduledRounds ở create/update/summary/detail; detail có analysis/tacticsWithoutSessions/sessions. Lỗi mới ở bouts.error.ts.
- `nestjs-api/src/bouts/bouts.service.ts:146`: ghi toàn tài liệu, giữ review cùng ID, metadata server; ghi review thủ công chỉ COMPLETED; query session đúng fighter và chưa xóa.
- `nestjs-api/src/bouts/bouts.service.ts:200`, `nestjs-api/src/bouts/bouts.repo.ts:396`: khóa dòng trận trong transaction cho analysis/review/ghi hiệp và sửa scheduledRounds. Mọi mutation mới đặt audit context. Upsert chỉ cập nhật trường được gửi, giữ trường vắng; map gửi lại thay cả map.
- `nestjs-api/src/bouts/bouts.service.ts:126`: FIGHTER nhận đúng năm trường chiến thuật được phép, bỏ review/observationIds/profile/observations; sessions dùng trường thật training_sessions.id/title/scheduled_at, không trả session riêng tư của fighter khác.
- `nestjs-api/src/bouts/bouts.service.ts:250`: dùng resolveListScope và listBouts hiện có, duyệt đủ các trang scope, chuẩn hoá tên và lấy trận mới nhất theo boutAt (tie: ID), bỏ review khi chép. improvementPoints hiện null vì phụ thuộc mục 6.
- `nestjs-api/src/bouts/bouts.controller.ts:144`: route prior-context nằm trước :id; sáu endpoint mới dùng DTO, guards, permission, audit request ID, envelope và Swagger theo khuôn module.
- Test: bout-analysis.model.spec.ts, bouts.service.spec.ts, bouts.controller.spec.ts, bouts.repo.spec.ts; hai nhóm test migration 027 trong scripts/test-migrations.mjs.
- Không cài thư viện, không sửa fighters/training/medical, không push, không gọi Supabase hoặc db:migrate:*. Chỉ test:db tạo PostgreSQL tạm ở loopback và tự dừng sau test.

### Tác động contract với frontend hiện có

Đã đọc nextjs-frontend/src/lib/services/bouts.ts: backendBoutSchema chưa khai báo scheduledRounds/opponentAnalysis/tacticsWithoutSessions/sessions; Zod object của frontend sẽ bỏ các trường mới. Frontend phần B cần bổ sung chúng và sáu endpoint mới. Các trường response cũ được giữ nguyên. Những lệch cũ của frontend như schema requirements/createdById không được sửa vì ngoài phạm vi.

### Commit code/test

```text
999c881 feat(bouts): add migration 027 and isolated database checks (T-010)
fd3d781 feat(bouts): define analysis validation and corner advice models (T-010)
eb1915a feat(bouts): extend scheduled rounds and detail contracts (T-010)
bc0e447 feat(bouts): persist scoped analysis and round records with audit (T-010)
53187f4 feat(bouts): expose analysis rounds and corner card endpoints (T-010)
db7485d feat(bouts): document redacted prior context response (T-010)
0921979 feat(bouts): cover analysis round advice access and persistence (T-010)
e1a934f feat(bouts): match analysis text limits to ticket contract (T-010)
f6048c3 feat(bouts): cover unrestricted tactic and partner text (T-010)
```

## Đối chiếu tiêu chí nghiệm thu

Đường dẫn dưới đây tính từ gốc worktree; test có tên chứa AC/R tương ứng.

| Tiêu chí (theo ticket) | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| 1 — R20 | Đạt: `nestjs-api/src/bouts/bout-analysis.model.ts:137`; `nestjs-api/src/bouts/bout-analysis.model.spec.ts:37` kiểm REPEATED trước ONCE, trained, tie ổn định, round và acuteLossFlag. |
| 2 — R21 | Đạt: `nestjs-api/src/bouts/bout-analysis.model.ts:173`, `nestjs-api/src/bouts/bout-analysis.model.ts:224`; `nestjs-api/src/bouts/bout-analysis.model.spec.ts:67` kiểm drop 2 hiệp, EFFECTIVE cắt chuỗi, hiệp vắng không cắt, tactic chưa dùng cùng căn cứ ưu tiên khi bằng điểm. |
| 3 — R22 | Đạt: `nestjs-api/src/bouts/bout-analysis.model.ts:185`, `nestjs-api/src/bouts/bout-analysis.model.ts:224`; `nestjs-api/src/bouts/bout-analysis.model.spec.ts:104` kiểm t3 xuống cuối/t4 không xuống, SEEN nâng confidence khi đọc, không mutate gốc. |
| 4 — R23 | Đạt: `nestjs-api/src/bouts/bout-analysis.model.ts:224`; `nestjs-api/src/bouts/bout-analysis.model.spec.ts:135` kiểm HARD_TO_WIN_ON_POINTS, NEED_WINS, AHEAD, selfScored và hiệp đã ghi nhưng chưa chấm điểm. |
| 5 — R24 | Đạt: `nestjs-api/src/bouts/bout-analysis.model.ts:6`, `nestjs-api/src/bouts/bout-analysis.model.ts:224`; `nestjs-api/src/bouts/bout-analysis.model.spec.ts:160` kiểm tổng ngã, chuỗi choáng cuối, chuỗi bị ngắt và khoảng trống số hiệp. |
| 6 — R29 evaluateTactics | **Chưa làm**: hàm thuộc mục 6, được chỉ định hoãn đến khi T-006 merge. Không báo là đã đạt; xem Câu hỏi. |
| 7 — R30 buildImprovementPoints | **Chưa làm**: cùng phụ thuộc mục 6, không triển khai điểm cần luyện/mẫu fatigued/acuteLoss. |
| 8 — bằng chứng và validation | Đạt: `nestjs-api/src/bouts/bout-analysis.model.ts:56`, `nestjs-api/src/bouts/bouts.service.ts:146`; `nestjs-api/src/bouts/bouts.service.spec.ts:1408`, `nestjs-api/src/bouts/bouts.service.spec.ts:1428`, `nestjs-api/src/bouts/bout-analysis.model.spec.ts:192`, `nestjs-api/src/bouts/bouts.controller.spec.ts:138`. Kiểm 422, mã evidence yêu cầu, không ghi khi lỗi, 7 quan sát, thiếu evidence, javascript URL, review injection và strict keys. |
| 9 — sessions và chưa luyện | Đạt: `nestjs-api/src/bouts/bouts.repo.ts:402`, `nestjs-api/src/bouts/bouts.service.ts:146`, `nestjs-api/src/bouts/bouts.service.ts:706`; `nestjs-api/src/bouts/bouts.service.spec.ts:1466`, `nestjs-api/src/bouts/bouts.service.spec.ts:1492`, `nestjs-api/src/bouts/bouts.service.spec.ts:1522`; `nestjs-api/src/bouts/bouts.repo.spec.ts:17` kiểm SQL owner/deleted_at thực. |
| 10 — trạng thái analysis/review | Đạt: `nestjs-api/src/bouts/bouts.service.ts:146`, `nestjs-api/src/bouts/bouts.service.ts:166`; `nestjs-api/src/bouts/bouts.service.spec.ts:1541`, `nestjs-api/src/bouts/bouts.service.spec.ts:1553` kiểm COMPLETED/CANCELLED, WEIGHED_IN 409, COMPLETED review thành công, giữ review khác và auto:false. |
| 11 — quyền và dữ liệu riêng | Đạt cho phần làm ngay: `nestjs-api/src/bouts/bouts.service.ts:126`, `nestjs-api/src/bouts/bouts.service.ts:245`; `nestjs-api/src/bouts/bouts.service.spec.ts:1609`, `nestjs-api/src/bouts/bouts.service.spec.ts:1643`. FIGHTER rounds/corner-card 403, coach ngoài phân công 403. **Chưa có report/403 của report**, endpoint thuộc mục 6 hoãn. |
| 12 — ghi/upsert hiệp | Đạt: `nestjs-api/src/bouts/bouts.service.ts:200`, `nestjs-api/src/bouts/bouts.repo.ts:414`; `nestjs-api/src/bouts/bouts.service.spec.ts:1686`, `nestjs-api/src/bouts/bouts.service.spec.ts:1731`, `nestjs-api/src/bouts/bouts.repo.spec.ts:41`; test migration 027 kiểm một dòng thực sau ON CONFLICT. Hiệp 4/3, thiếu schedule, FIGHT_WEEK, ID mark lạ đều lỗi; COMPLETED cho ghi lại và giữ trường vắng. |
| 13 — rounds và advice | Đạt: `nestjs-api/src/bouts/bouts.service.ts:225`, `nestjs-api/src/bouts/bouts.repo.ts:410`; `nestjs-api/src/bouts/bouts.service.spec.ts:1763`, `nestjs-api/src/bouts/bouts.repo.spec.ts:27`. So advice bằng kết quả hàm thuần; null khi chưa ghi hoặc đủ hiệp; SQL ORDER BY round_no ASC. |
| 14 — hạ số hiệp | Đạt: `nestjs-api/src/bouts/bouts.service.ts:426`; `nestjs-api/src/bouts/bouts.service.spec.ts:1778`. 5 xuống 2 với 3 hiệp đã ghi trả 422 và không update; 5 xuống 4 được, dưới khóa parent. Test create/summary tại `nestjs-api/src/bouts/bouts.service.spec.ts:1824`, DTO range/null ở `nestjs-api/src/bouts/bouts.controller.spec.ts:232`. |
| 15 — prior-context | Đạt phần copy/scope: `nestjs-api/src/bouts/bouts.service.ts:250`; `nestjs-api/src/bouts/bouts.service.spec.ts:1834`, `nestjs-api/src/bouts/bouts.service.spec.ts:1873`, `nestjs-api/src/bouts/bouts.repo.spec.ts:62`; `nestjs-api/src/bouts/bouts.controller.spec.ts:111`. Chuẩn hóa tên, chọn mới nhất, strip review, scope coach và phân trang. **Chưa đạt nhánh improvementPoints**, trả null trong giai đoạn này do mục 6 chưa làm. |
| 16 — nối result/prefill/auto review | **Chưa làm**, thuộc mục 7 phụ thuộc T-006, theo chỉ định. |
| 17 — report khi không có hiệp | **Chưa làm**, thuộc mục 6 phụ thuộc T-006, theo chỉ định. |
| 18 — migration | Đạt: `nestjs-api/migrations/027_opponent_analysis_and_rounds.sql:7`; `nestjs-api/scripts/test-migrations.mjs:873`, `nestjs-api/scripts/test-migrations.mjs:906`. Áp trên ledger 24 không 25/26; default {}, NULL; scheduled 0/13 và round 0/13 bị chặn; unique, json object, cascade, RLS/no grants, reapply và thiếu 24 bị chặn. Thêm kiểm map object, self_score, ngã, note, audit và timestamp. |

## Lệnh đã chạy

Chạy foreground trong D:/test/ai-worktrees/T-010; không dùng Start-Process hoặc tác vụ nền. Các khối dưới là nguyên văn cuối output, không tự tạo dòng PASS cho lệnh không có summary.

### pnpm --filter nestjs-api lint

Exit 0. Qua như baseline; chỉ có cảnh báo ở file ngoài ticket, không cảnh báo mới trong bouts. Lệnh oxlint hiện không in tổng kết pass/fail; cuối output nguyên văn:

```text
src/main.ts:7:10: warning eslint(no-unused-vars): Identifier 'createOpenApiDocument' is imported but never used. help: Consider removing this import.
src/medical/scat6.model.spec.ts:5:3: warning eslint(no-unused-vars): Identifier 'scat6ScoresSchema' is imported but never used. help: Consider removing this import.
src/dataset-export/dto/promotion-request.dto.ts:8:3: warning eslint(no-unused-vars): Identifier 'Matches' is imported but never used. help: Consider removing this import.
src/dataset-export/dto/candidate-export.dto.ts:15:29: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
```

### pnpm --filter nestjs-api build

Exit 0. Qua như baseline; Nest build thành công không in thêm dòng tổng kết:

```text
$ nest build
```

### pnpm --filter nestjs-api test

Exit 1. 811 qua / 26 lỗi (837); 49 file qua / 6 file lỗi. Không thêm lỗi so baseline 26 lỗi / 611 qua: 5 lỗi coaching-loop và 21 lỗi dataset-export đều thiếu SUPABASE_URL (có ECONNREFUSED Redis localhost:6379); bốn spec notifications rỗng vẫn bị “No test suite found”. So với baseline B2 đã có 5 spec rỗng, doctor-assignment-reminder không còn rỗng ở nhánh nền hiện tại; ticket này không sửa các khu vực đó. Không có test bouts lỗi.

```text

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/30]⎯


 Test Files  6 failed | 49 passed (55)
      Tests  26 failed | 811 passed (837)
   Start at  12:05:59
   Duration  22.39s (transform 16.08s, setup 0ms, import 159.73s, tests 10.69s, environment 21ms)

[ELIFECYCLE] Test failed. See above for more details.
Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL

  × "pnpm recursive run" failed in D:\test\ai-worktrees\T-010\nestjs-api
```

### pnpm --filter nestjs-api test:db

Exit 0, 43 nhóm kiểm tra qua, PostgreSQL tạm đã dừng. Baseline B3 trước đây không chạy do cú pháp; lỗi đó đã được sửa trên nhánh nền trước ticket này, không cần sửa lại. Hai nhóm 027 đều PASS; phần cuối nguyên văn:

```text
PASS baseline drift aborts before domain DDL
PASS partial domain collision rolls back all new objects
PASS domain integrity and RLS role matrix
PASS fresh clinical schema through 011
PASS 012 rejects a concurrently committed clearance and rolls back DDL/ledger
PASS 012 proceeds after a concurrent issuer rolls back; no orphan revision
PASS 012 orders identical created_at values by server issuance sequence
PASS 012 rejects reapplication without changing the applied ledger
Migration checks passed: 43. PostgreSQL stopped after tests. Scratch: C:\Users\DAN\AppData\Local\Temp\mma-migrations-PLzEPO
```

### pnpm --filter nestjs-api db:check

Exit 0. Checksum qua như baseline; không kết nối database:

```text
$ node run_sql.mjs --check
001-027 checksums OK. No database connection was opened.
```

### Kiểm tra bổ sung

- pnpm --filter nestjs-api exec vitest run src/bouts: lượt trước kiểm tra cuối có 161/161 test qua (5 file). Sau đó thêm một test giới hạn text; lượt full test cuối đã chạy cả test mới và không có lỗi bouts.
- git diff --check fight-camp...HEAD: exit 0.

## Lệch so với ticket

- Không làm mục 6/7 do T-006 chưa merge, đúng chỉ định trực tiếp. Cụ thể chưa có evaluateTactics, buildImprovementPoints, report, result-prefill, nối submitResult, confirmIncompleteRounds hoặc computeAcuteLoss. Corner-card truyền acuteLoss=null theo ticket.
- Do phụ thuộc chéo, AC6–7, nhánh report trong AC11 và nhánh improvementPoints trong AC15 chưa hoàn thành. prior-context tạm khai báo/trả improvementPoints:null, không giả lập tính toán R30. AC16–17 chưa làm. Phần copyableAnalysis đã hoàn thành và kiểm scope đầy đủ.
- Không có thay đổi khác về phạm vi. Ngưỡng R21/R22/R24 vẫn là hằng số đề xuất chưa được HLV chuyên môn duyệt.

## Câu hỏi / việc còn mở

1. Chỉ định yêu cầu AC1–15 ngay đồng thời cấm mục 6 trước T-006; nhưng AC6–7, phần report của AC11 và improvementPoints của AC15 thuộc mục 6. Đã dừng đúng các nhánh phụ thuộc, không đoán hoặc triển khai vượt chỉ định. Review cần chấp nhận phạm vi giai đoạn này; hoàn tất các nhánh này cùng AC16–17 khi được giao sau khi T-006 merge.
2. T-006 chưa merge ở worktree này; chưa thực hiện bước merge fight-camp vào nhánh (lượt này chủ dự án cấm merge). Sau khi T-006 sẵn sàng cần giao lượt tiếp và xử lý các điểm nối mục 6/7.
3. Không phát hiện mâu thuẫn code/ticket nào khác chặn phần 1–5. Các lệch contract frontend có sẵn được giữ ngoài phạm vi, đã ghi ở trên để phần B xem xét.


## Lượt 2 — hoàn tất backend mục 6, 7

- Nhánh: `feat/T-010-opponent-analysis-and-rounds`. Nền đã fast-forward sẵn: `593490e`; không đổi nhánh hay merge trong lượt này.
- Trạng thái: **IN REVIEW**. Giai đoạn 1 đã APPROVED; lượt 2 hoàn tất phần còn thiếu của AC6, 7, 11, 15, 16, 17 sau khi T-006 phần A đã merge.
- Commit hàm thuần + test: `ab50ce1` — feat(bouts): evaluate tactics and build improvement points (T-010).
- Commit service/controller/dto + test: `5c94a3c` — feat(bouts): add reports and integrate round-aware results (T-010).

### Thay đổi

- `nestjs-api/src/bouts/bout-analysis.model.ts:349`: `evaluateTactics` tính số hiệp hiệu quả/không hiệu quả, hòa số lần thì EFFECTIVE khi đã dùng, NOT_USED khi chưa dùng; quan sát chỉ mang notSeenInBout khi có dấu và tất cả NOT_SEEN.
- `nestjs-api/src/bouts/bout-analysis.model.ts:402`: `buildImprovementPoints` ưu tiên review đã lưu, nếu chưa có thì dùng đánh giá từ hiệp; thêm cờ giảm cấp tốc và chuỗi fatigued liên tiếp kết thúc ở hiệp cuối. Không mutate input; không tạo kế hoạch tập. Không có hiệp thì chỉ cho phép cờ giảm cấp tốc, kể cả có review thủ công.
- Contract `improvementPoints` là danh sách: `{ code: 'TACTIC_INEFFECTIVE', tacticId, text }`, `{ code: 'ACUTE_LOSS_EXCEEDED' }`, hoặc `{ code: 'FATIGUE_FROM_ROUND_N', fromRound: N }`. Không có trận COMPLETED trước đó thì prior-context trả null; có trận nhưng không có điểm thì trả []. Schema tại `bout-analysis.model.ts:388` và `:443`.
- `nestjs-api/src/bouts/bouts.service.ts:375`, `bouts.controller.ts:321`, `bouts.dto.ts:108`: GET report, quyền bout:read; chỉ COACH được phân công, DOCTOR được phân công và ADMIN. FIGHTER bị 403. Chỉ COMPLETED; trả kết quả, đánh giá tính từ hiệp, review lưu riêng, quan sát, acuteLoss, improvementPoints, roundsRecorded. Thiếu hiệp thì outcome null và không có điểm chiến thuật/mẫu mệt.
- `nestjs-api/src/bouts/bouts.service.ts:440`: prior-context chọn trận COMPLETED gần nhất theo boutAt (tie: ID) của đúng fighter được yêu cầu, từ các trang listBouts trong scope hiện có; không phụ thuộc tên đối thủ. Giữ nguyên logic copyableAnalysis có scope và bỏ review.
- `nestjs-api/src/bouts/bouts.service.ts:1384`: tách loader dùng chung `computeAcuteLoss` của T-006; dùng trong detail, report, prior-context và corner-card (`:364`). Giữ nguyên cửa sổ ngày học viện, ngưỡng snapshot trên bout và cách tính của T-006; không có cân chính thức trả null.
- `nestjs-api/src/bouts/bouts.service.ts:407`, `bouts.controller.ts:345`, `bouts.dto.ts:138`: GET result-prefill, quyền bout:result và phạm vi ghi, chỉ WEIGHED_IN; trả hiệp cuối và bị ngã, hoặc hai null khi chưa ghi hiệp. Giá trị resultRound là gợi ý; frontend bỏ khi chọn DECISION.
- `nestjs-api/src/bouts/bouts.service.ts:1199` (điểm nối ở `:1288`): `recordResult` khóa parent bout trước khi đọc số hiệp, kiểm ROUND_EXCEEDS_SCHEDULED và BOUT_ROUNDS_INCOMPLETE. `confirmIncompleteRounds` là boolean tùy chọn (`bouts.model.ts:710`), phải đúng true mới xác nhận. Lỗi mới có details { recorded, scheduled } tại `bouts.error.ts:362`.
- Tự điền review cho chiến thuật chưa có review vào **cùng một update và transaction có audit** với kết quả/status COMPLETED; giữ review đã có. PUT review thủ công tiếp tục ghi đè với auto:false. Không có hiệp thì không tự điền. Test kiểm dữ liệu khóa mới nhất, không ghi khi lỗi, cùng tx, và CAS thất bại không gây update review riêng.
- Định dạng lại phần service giai đoạn 1 theo góp ý review. Không sửa nghiệp vụ ngoài ticket, không thêm thư viện/migration, không sửa module fighters/training/medical hay tài liệu docs khác. Không push; không gọi Supabase hoặc db:migrate:*.

### Đối chiếu tiêu chí nghiệm thu

Các đường dẫn code/test dưới đây thuộc `nestjs-api/src/bouts/`.

| Tiêu chí | File:dòng và tên test |
| --- | --- |
| 6 — R29 | `bout-analysis.model.ts:349`; `bout-analysis.model.spec.ts:280` — `R29 evaluates counts, ties, unused tactics and observation evidence without mutation (AC6)`. Bao gồm 2 effective, 1 effective/2 ineffective, chưa dùng, hòa 1/1 và notSeenInBout. |
| 7 — R30 | `bout-analysis.model.ts:402`; `bout-analysis.model.spec.ts:336` — `R30 uses saved reviews before calculated outcomes and omits tactics without rounds (AC7, AC17)`; `:359` — `R30 detects only a consecutive fatigue suffix, sorting without mutation (AC7)`. Có fatigue 2–4, ngắt chuỗi, khoảng trống hiệp, WITHIN/NO_DATA/EXCEEDED. |
| 11 — report còn thiếu | `bouts.service.ts:375` và assertPrivateReadAccess; `bouts.service.spec.ts:2754` — `report restricts private data by role and assignment before loading rounds (AC11)`. Fighter/coach ngoài phạm vi/doctor ngoài phạm vi 403; doctor đúng phạm vi và admin đọc được. `bouts.controller.spec.ts:14` bảng route kiểm GET report cần bout:read. |
| 15 — improvementPoints còn thiếu | `bouts.service.ts:440`; `bouts.service.spec.ts:2884` — `prior-context derives points from latest completed bout of requested fighter across scoped pages (AC15)`: lấy trận đúng fighter qua nhiều trang, bỏ qua trận fighter khác mới hơn, không phụ thuộc opponentName; coach ngoài phạm vi 403. Test copy cũ tiếp tục qua. |
| 16 — R25/R26/R29 | `bouts.service.ts:407`, `:1199`, `:1288`; `bouts.service.spec.ts:2928` — `result-prefill returns the last recorded round and knockdowns, or nulls without rounds (AC16)`; `:2960` — `R26 validates scheduled rounds from locked row and requires explicit incomplete decision confirmation (AC16)`; `:3008` — `R26 allows decisions without recorded rounds or without a schedule (%s) and does not auto review absent rounds (AC16)`; `:3038` — `R29 auto reviews only missing reviews in the same audited result update (AC16)`; `:3112` — `result does not write reviews when locked status changes or the conditional result update fails (AC16)`. DTO boolean tại `bouts.controller.spec.ts:288` — `R26 accepts only explicit boolean incomplete-round confirmation (AC16)`. |
| 17 — report thiếu hiệp | `bouts.service.ts:375`, `bout-analysis.model.ts:402`; `bouts.service.spec.ts:2829` — `report without rounds suppresses outcomes and tactical points even with saved reviews (AC17)`; `:2772` — `report requires COMPLETED, rejects %s (AC17)`. Response schema tại `bouts.controller.spec.ts:309` — `documents no-round nulls and preserves improvement point payloads (AC17)`. |

Kiểm tra nối bổ sung: `bouts.service.spec.ts:2866` — `corner-card uses T-006 acute loss, including NO_DATA and absent official weight`; `:2784` — `report exposes evaluations, saved reviews and improvement data without changing analysis (AC6, AC7)`; `bouts.controller.spec.ts:345` — `forwards report and prefill reads with authenticated actor and rejects missing authentication`.

### Tác động contract frontend

Đã đọc `nextjs-frontend/src/lib/services/bouts.ts`: chưa có client cho report/result-prefill/prior-context/improvementPoints. Phần B cần thêm hai endpoint đọc, schema điểm cần luyện trên prior-context, và gửi confirmIncompleteRounds:true sau khi người dùng xác nhận lỗi 409 BOUT_ROUNDS_INCOMPLETE. Khi chọn DECISION phải bỏ gợi ý resultRound. Không sửa frontend trong phần A.

### Lệnh đã chạy (lượt 2)

Chạy foreground, lần lượt trong worktree này; không dùng Start-Process, job hay tác vụ nền. Dưới đây là NGUYÊN VĂN phần cuối từng output.

#### pnpm --filter nestjs-api lint

Exit 0. Qua như baseline; cảnh báo còn lại đều ngoài bouts, không có lỗi mới. Oxlint không in dòng tổng kết.

```text
src/dataset-export/services/authoritative-governance.service.ts:86:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/dataset-export/services/authoritative-governance.service.ts:87:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/dataset-export/services/governance-verifier.service.ts:45:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
src/dataset-export/services/governance-verifier.service.ts:46:10: warning eslint(no-useless-escape): Unnecessary escape character '-' help: Replace `\-` with `-`.
```

#### pnpm --filter nestjs-api build

Exit 0. Qua như baseline. Nest build không in thêm dòng tổng kết sau lệnh.

```text
$ nest build
```

#### pnpm --filter nestjs-api test

Exit 1. 864 qua / 26 lỗi (890); 49 file qua / 6 file lỗi. Không tăng lỗi so baseline B1 (26 lỗi / 611 qua): 5 test coaching-loop và 21 test dataset-export thiếu SUPABASE_URL, kèm Redis ECONNREFUSED localhost:6379. B2 vẫn còn bốn spec notifications rỗng báo No test suite found; doctor-assignment-reminder đã có test trên nhánh nền. Không sửa các vùng đóng băng để che lỗi baseline; toàn bộ test bouts qua.

```text
 ❯ TestingInjector.loadProvider ../node_modules/.pnpm/@nestjs+core@12.1.0_@nestjs_b4cbd863ea2658345935822d2a51a1a7/node_modules/@nestjs/core/injector/injector.js:110:9
 ❯ ../node_modules/.pnpm/@nestjs+core@12.1.0_@nestjs_b4cbd863ea2658345935822d2a51a1a7/node_modules/@nestjs/core/injector/instance-loader.js:58:13

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[5/30]⎯


 Test Files  6 failed | 49 passed (55)
      Tests  26 failed | 864 passed (890)
   Start at  15:48:15
   Duration  31.98s (transform 8.71s, setup 0ms, import 194.15s, tests 17.73s, environment 15ms)

[ELIFECYCLE] Test failed. See above for more details.
Error: ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL

  × "pnpm recursive run" failed in D:\test\ai-worktrees\T-010\nestjs-api
```

#### pnpm --filter nestjs-api test:db

Exit 0. 43 nhóm kiểm tra qua, PostgreSQL tạm đã dừng. Hai nhóm 027 đều PASS. Tốt hơn baseline B3 từng lỗi cú pháp; lượt này không sửa migration hoặc script database.

```text
PASS reapplying 003 fails safely
PASS baseline drift aborts before domain DDL
PASS partial domain collision rolls back all new objects
PASS domain integrity and RLS role matrix
PASS fresh clinical schema through 011
PASS 012 rejects a concurrently committed clearance and rolls back DDL/ledger
PASS 012 proceeds after a concurrent issuer rolls back; no orphan revision
PASS 012 orders identical created_at values by server issuance sequence
PASS 012 rejects reapplication without changing the applied ledger
Migration checks passed: 43. PostgreSQL stopped after tests. Scratch: C:\Users\DAN\AppData\Local\Temp\mma-migrations-Lc6Xwc
```

#### pnpm --filter nestjs-api db:check

Exit 0. Checksum 001–027 qua như baseline; không kết nối database.

```text
$ node run_sql.mjs --check
001-027 checksums OK. No database connection was opened.
```

Kiểm tra bổ sung: `pnpm --filter nestjs-api exec vitest run src/bouts`: 5 file qua, **215/215 test qua**, exit 0. `git diff --check`: exit 0.

### Lệch so với ticket

- Ticket gọi hàm nối kết quả là `submitResult`; code thực của T-006 là `recordResult`. Dùng `recordResult` theo chỉ định, giữ endpoint POST /bouts/:id/result.
- Không thực hiện bước merge được mô tả trong ticket/review cũ: nhánh đã fast-forward sẵn lên 593490e và chỉ định lượt này cấm merge.
- Không có lệch nghiệp vụ nào khác ở mục 6/7. Contract mã và dữ liệu cho improvementPoints được công khai ở trên để phần B sử dụng.

### Câu hỏi / việc còn mở

- Không có câu hỏi chặn triển khai. Chỗ lệch tên submitResult/recordResult đã được chủ dự án nêu rõ cách xử lý; ghi lại ở mục Lệch so với ticket, không tạo thêm hàm tên giả.
- Các mục 6/7 từng hoãn và câu hỏi phụ thuộc T-006 trong lượt 1 đã được giải quyết ở lượt 2. Chờ Claude review; chưa có kiểm chứng API trên hosted/Supabase, không chạy deploy hoặc migration database thật.
- Ngưỡng chuyên môn đề xuất R21/R22/R24 của giai đoạn 1 tiếp tục chờ HLV duyệt, không thay đổi ở lượt này.
