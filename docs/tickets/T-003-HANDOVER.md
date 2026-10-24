# T-003 Handover

- Nhánh: feat/T-003-bouts-core    Commit: 2898a82
- Trạng thái: IN REVIEW
- Người thực hiện: Claude (ngoại lệ riêng của chủ dự án cho T-003, thường Claude không viết code production)

## Thay đổi

Migration và các file đi kèm:

- `nestjs-api/migrations/024_bouts.sql`: 5 enum, `competition_rulesets` (+ 3 preset), `bouts`, `bout_requirements`, trigger `update_updated_at` / `audit_domain_mutation` / `reject_context_change('fighter_id')`, RLS + REVOKE, quyền `ruleset:read`, `bout:*`, cấp `fighter.measurement:write` cho FIGHTER (không cấp COACH). Preflight: ledger có 23, chưa có 24; có `training_plans.phase`; các hàm trigger của 003; quyền `fighter.measurement:write` của 004; không trùng enum, bảng, quyền. Advisory lock `(20260916, 24)`, ghi ledger version 24.
- `nestjs-api/migrations/manifest.json` (checksum), `nestjs-api/scripts/migration-files.mjs`, `nestjs-api/run_sql.mjs` (`--apply-024`, thông báo `001-024`), `nestjs-api/package.json` (`db:migrate:024`), `nestjs-api/migrations/README.md` (mục 024).
- `nestjs-api/scripts/test-migrations.mjs`: 2 ca mới (024 áp được sau 023 và kiểm chứng ràng buộc; 024 từ chối khi thiếu 023 hoặc trùng bảng, không để lại gì).
- `nestjs-api/src/database/schema.ts`: Drizzle schema cho 5 enum và 3 bảng, khớp migration.
- `nestjs-api/src/app.module.ts`: đăng ký `BoutsModule`.

Module `nestjs-api/src/bouts/`:

- `bouts.model.ts`: hàm thuần (ngày học viện UTC+7, snapshot ngưỡng, Cổng 1, bảng chuyển trạng thái, chọn hạng cân, điểm cân theo ngày, đường tham chiếu, cảnh báo cân, cursor) và Zod schema request/response.
- `bouts.repo.ts`: truy vấn Drizzle. Phạm vi truy cập viết lại trong repo này (không import `TrainingModule`): FIGHTER của chính mình, COACH và DOCTOR theo phân công, ADMIN tất cả.
- `bouts.service.ts`: nghiệp vụ F1, F2, F4, F8, theo dõi cân; chuyển trạng thái có `expectedStatus` (409 `BOUT_STATE_CONFLICT` nếu bị đổi song song) và ghi `history`.
- `bouts.controller.ts`, `bouts.dto.ts`, `bouts.error.ts`, `bouts.constants.ts`, `bouts.module.ts`: 12 endpoint của ticket, không có endpoint ghi cân, kết quả, cân chính thức, đình chỉ.
- Test: `bouts.model.spec.ts` (49), `bouts.service.spec.ts` (56), `bouts.controller.spec.ts` (13).

## Đối chiếu tiêu chí nghiệm thu

| Tiêu chí (theo ticket) | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| 1. Cảnh báo cân (RED 66, GREEN 64,5, GREY, YELLOW) | `bouts.model.ts` `computeWeightTrack` (dòng 362); `bouts.model.spec.ts:30` `describe('weight track (criterion 1)')` |
| 2. Snapshot ngưỡng 24h/6h/12h | `bouts.model.ts` `acuteLossLimitPctFor` (dòng 87); `bouts.model.spec.ts:232` |
| 3. Ngày học viện | `bouts.model.ts` `academyDateOf` (dòng 58); `bouts.model.spec.ts:254` |
| 4. Cổng 1 | `bouts.model.ts` `evaluateGate1` (dòng 151); `bouts.model.spec.ts:281` |
| 5. Bảng chuyển trạng thái | `bouts.model.ts` `BOUT_TRANSITIONS`, `canTransition` (dòng 109); `bouts.model.spec.ts:357` (kiểm tra cả 36 cặp) |
| 6. `weighInAt >= boutAt` -> 422 | `bouts.service.ts` `createBout`; `bouts.service.spec.ts:218` |
| 7. Coach không được phân công -> 403 | `bouts.service.ts` `assertWriteAccess`; `bouts.service.spec.ts:264` |
| 8. Preset 0 mục -> checklist rỗng; HLV thêm 3 mục `source = COACH` | `bouts.service.spec.ts:282` (thêm ca preset có mẫu -> `source = PRESET`) |
| 9. Trận thứ hai sang CAMP -> 409 `BOUT_ACTIVE_EXISTS` | `bouts.service.ts` `startCamp` + `mapBoutPersistenceError` (ràng buộc unique); `bouts.service.spec.ts:493`; DB: `test-migrations.mjs` ca 024 |
| 10. `fight-week` thiếu mục -> 409 `BOUT_REQUIREMENTS_INCOMPLETE`, trạng thái không đổi | `bouts.service.ts` `enterFightWeek`; `bouts.service.spec.ts:572` (`updateBout` không được gọi) |
| 11. Plan của võ sĩ khác hoặc phase khác `fight_camp` -> 422 | `bouts.service.ts` `startCamp`; `bouts.service.spec.ts:506`, `:516` (thêm plan đã xoá, không tồn tại) |
| 12. FIGHTER đọc trận võ sĩ khác -> 403 | `bouts.service.ts` `assertReadAccess`; `bouts.service.spec.ts:962` |
| 12a. Plan `start_date` 14 ngày trước, số cân 10 ngày trước | `bouts.service.ts` `loadWeightTrack`; `bouts.service.spec.ts:1039` (kiểm cả đối số `from` của truy vấn) |
| 12b. 66,0 rồi 65,4 cùng ngày, 64,8 hôm sau -> 2 điểm | `bouts.model.ts` `buildDailyWeightPoints` (dòng 279); `bouts.service.spec.ts:1080`; `bouts.model.spec.ts:177` |
| 13. `test:db` | `scripts/test-migrations.mjs:658` (áp sau 023, đúng 3 preset, `weigh_in_at < bout_at`, trận active thứ hai bị từ chối, áp lại bị từ chối, FIGHTER có `fighter.measurement:write`, COACH không có) và `:846` |

## Lệnh đã chạy

Output dán là phần cuối nguyên văn của lần chạy trên commit 2898a82.

`pnpm --filter nestjs-api lint` (thoát mã 0; lệnh không in dòng tổng kết, chỉ có cảnh báo cũ, không có cảnh báo nào trong `src/bouts`)

```text
test/coaching-loop-persistence.spec.ts:21:3: warning eslint(no-unused-vars): Identifier 'actionAssessments' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:22:3: warning eslint(no-unused-vars): Identifier 'actionFindingReviews' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:23:3: warning eslint(no-unused-vars): Identifier 'techniqueReferences' is imported but never used. help: Consider removing this import.
test/coaching-loop-persistence.spec.ts:25:14: warning eslint(no-unused-vars): Identifier 'and' is imported but never used. help: Consider removing this import.
```

`pnpm --filter nestjs-api build` (thoát mã 0)

```text
$ nest build
```

`pnpm --filter nestjs-api test`

```text
 Test Files  6 failed | 47 passed (53)
      Tests  26 failed | 767 passed (793)
```

26 lỗi là đúng B1 (`test/coaching-loop-persistence.spec.ts` 5, `test/dataset-export-trust-boundary.spec.ts` 21) và B2 (4 file spec rỗng trong `src/notifications/`), không thêm lỗi so với [baseline](BASELINE.md). Số test qua tăng nhờ T-002 và T-003 (118 test mới của T-003). Chạy riêng `npx vitest run src/bouts`: 3 file, 118 test qua.

`pnpm --filter nestjs-api test:db`

```text
PASS 023 applies on ledger 20, rejects second row, and records ledger 23
PASS 024 applies on ledger 23, seeds three presets and wires bouts, requirements and permissions
PASS 024 requires ledger 23 and leaves nothing behind on a collision
PASS 005 rejects a pre-existing milestones column without writing history
...
PASS 012 rejects reapplication without changing the applied ledger
Migration checks passed: 41. PostgreSQL stopped after tests. Scratch: C:\Users\DAN\AppData\Local\Temp\mma-migrations-WW8e95
```

`pnpm --filter nestjs-api db:check`

```text
$ node run_sql.mjs --check
001-024 checksums OK. No database connection was opened.
```

Không chạy `db:migrate:*`, không đọc `.env`, không kết nối Supabase, không push.

## Lệch so với ticket

1. `competition_rulesets.created_by_id` cho phép NULL (Tech spec §2.2 ghi NOT NULL). Lý do: migration seed preset khi chưa có user nào; NULL nghĩa là preset hệ thống.
2. `bout_requirements` thêm cột `validity_days` (để `validityDays` của mẫu và của mục HLV thêm có chỗ lưu, và `PROVIDED` + `issuedOn` tự suy ra `validUntil`), `created_at` (giữ thứ tự checklist), `updated_at` (có trigger). Thêm check: `REJECTED` bắt buộc `status_reason`, `valid_until >= issued_on`.
3. `bouts.training_plan_id` dùng khoá ngoại ghép `(training_plan_id, fighter_id) -> training_plans (id, fighter_id)` (dùng `uq_plan_fighter` có sẵn) thay cho khoá ngoại đơn, để DB chặn plan của võ sĩ khác.
4. Thêm unique index `uq_competition_rulesets_name` (tên không phân biệt hoa thường, chưa xoá) và các index tra cứu của `bouts`.
5. Hạng "trên 120 kg" (MMA) và "trên 91 kg" (Boxing) có `limitKg = null` trong `weight_classes`; khi chọn hạng này HLV phải truyền `weightLimitKg` (30-200), nếu không 422 `BOUT_INVALID_WEIGHT_CLASS`. Ruleset "Tự nhập" lưu `weight_class_code = 'CUSTOM'`.
6. Preset "Tự nhập" có `sport = 'MMA'` (cột NOT NULL, ticket không nói).
7. Thứ tự kiểm tra của `fight-week`: Cổng 1 trước, rồi mới 409 `BOUT_FIGHT_WEEK_TOO_EARLY`. Ticket không quy định thứ tự.
8. `limitKg` của weight-track vẫn là số (không `null`) khi chưa có số cân, vì biểu đồ cần đường giới hạn; các trường `latestKg`, `latestOn`, `remainingPct` là `null`, `points` và `referencePath` rỗng. "Không có số cân trong 3 ngày" hiểu là ngày học viện gần nhất có số cân cách hôm nay từ 3 ngày trở lên.
9. Đường tham chiếu: bắt đầu từ ngày bắt đầu camp với W0 là số cân đầu tiên; nếu W0 đã thấp hơn mức mục tiêu thì đường đi ngang (không đi lên).
10. Phản hồi thêm so với ticket: `GET /bouts/:id` có thêm `requirementsOverdue` (Luồng F4 "hồ sơ trễ hạn") và `ruleset`; `GET /bouts` trả `{ data, hasNextPage, nextCursor }` (không có `total`); POST/PATCH/DELETE requirement trả `{ requirement, gate1 }` / `{ code, gate1 }`.
11. Bảng chuyển trạng thái chỉ chứa các bước của ticket này (`SCHEDULED -> CAMP`, `CAMP -> FIGHT_WEEK`, mọi trạng thái chưa kết thúc `-> CANCELLED`). `FIGHT_WEEK -> WEIGHED_IN` và `WEIGHED_IN -> COMPLETED` để T-006 thêm.
12. `bout:requirement` chỉ cấp COACH và ADMIN (theo ticket); Tech spec §7 còn ghi DOCTOR.
13. Mục hồ sơ do HLV sửa được ở mọi trạng thái trừ `COMPLETED`, `CANCELLED` (409 `BOUT_INVALID_TRANSITION`); việc "khoá hồ sơ ở FIGHT_WEEK, mở khoá kèm lý do" (F5) không nằm trong ticket nên chưa làm.
14. Khi tạo trận, `boutAt` phải ở tương lai (Luồng nghiệp vụ §3); khi PATCH có `boutAt` thì cũng kiểm tra như vậy.
15. Ngoài ticket, thêm kiểm tra trong service: FIGHTER và DOCTOR bị 403 ở mọi thao tác ghi dù được cấp quyền lẻ (như `assertTrainingWriteAllowed`).

## Câu hỏi / việc còn mở

1. Hạng mở ("trên 120", "trên 91"): giới hạn cân nên là bao nhiêu? Hiện bắt HLV nhập (mục 5 của phần Lệch). Nếu muốn mặc định thì ghi vào preset.
2. F8 yêu cầu ghi lý do khi đổi hạng cân hoặc ngày, nhưng PATCH của ticket không có trường lý do và `history` chỉ dành cho chuyển trạng thái. Hiện chỉ có audit trigger ghi cột thay đổi. Có cần trường `reason` và phần tử `history` cho PATCH không?
3. Test service dùng repo giả. Các truy vấn SQL của `bouts.repo.ts` (phạm vi COACH/DOCTOR bằng `exists`, cursor `(weigh_in_at, id)`, loại số cân bị supersede) chưa có test chạy trên PostgreSQL thật, vì `test:db` chỉ chạy file migration và repo dùng Drizzle. Đề nghị người review đọc kỹ `bouts.repo.ts` hoặc bổ sung kiểm tra tích hợp ở T-008a (cần database có `.env`, ngoài quyền của tôi).
4. Preset lấy theo `id` sinh ngẫu nhiên (`gen_random_uuid()`); nếu T-008a cần id cố định cho demo thì phải tra theo `name`.
5. `acute_window_days`, `fight_week_days`, `requirements_due_days` của 3 preset dùng mặc định 7; chưa có nguồn riêng cho từng preset (MMA VMMAF cân trước 1 ngày, Điều 9).
