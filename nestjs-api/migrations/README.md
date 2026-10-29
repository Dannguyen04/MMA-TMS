# Migrations 003–030 — Backend, Database & API Permissions

## Áp dụng migration 030 (Kế hoạch hiệp sau)

030 yêu cầu ledger 027 và chưa có 030; không yêu cầu 028, 029.
Thêm bout_rounds.next_round_plan jsonb NOT NULL DEFAULT '{}' và CHECK
ck_bout_rounds_next_round_plan chỉ nhận object. Preflight chặn cột đã tồn tại;
advisory lock (20260916, 30), ledger version 30, checksum trong manifest.
Chủ dự án tự áp bằng db:migrate:030 sau khi kiểm db:check; không kết nối Supabase trong kiểm thử.

## Áp dụng migration 027 (Phân tích đối thủ và ghi hiệp)

027 chỉ yêu cầu ledger 024, chưa có 027; không yêu cầu 025, 026.
Thêm bouts.opponent_analysis (jsonb object, mặc định {}), scheduled_rounds
(NULL hoặc 1–12) và bảng bout_rounds (unique trận/hiệp, FK cascade khi xoá trận).
Preflight kiểm tra bảng/hàm trigger và collision. Các map phải là object;
giới hạn hiệp, số lần ngã, điểm tự chấm và độ dài ghi chú bằng CHECK.
Bật RLS, revoke PUBLIC/anon/authenticated; trigger cập nhật thời gian và audit.
Không thêm quyền; API dùng bout:read, bout:update, bout:result từ 024.
Ledger version 27, advisory lock (20260916, 27), checksum trong manifest.

```sh
pnpm db:check
pnpm db:migrate:027
```

## Áp dụng migration 025 (Đình chỉ tập/thi đấu và loại thông báo - suspensions)

025 chỉ yêu cầu ledger 024, chưa có 025; không yêu cầu 026 hay 027.
Nội dung:
- Enum `public.suspension_reason` (`KO`, `TKO`, `DQ`, `MANDATORY_REST`, `MEDICAL`, `OTHER`).
- Bảng `public.suspensions`: lưu đợt đình chỉ tự động sau trận hoặc tạo tay (`fighter_id`, `bout_id` nullable, `reason`, `starts_on`, `ends_on`, `loss_of_consciousness`, `suggested_days`, `override_reason`, `blocked_session_types`, `requires_clearance`, `cleared_at`, `cleared_by_id`, `clearance_note`, `created_by_id`, `created_at`, `updated_at`, `deleted_at`). Ràng buộc `ck_suspensions_loss_of_consciousness`, `ck_suspensions_dates` (`ends_on >= starts_on`), `ck_suspensions_cleared` (`(cleared_at IS NULL) = (cleared_by_id IS NULL)`); index `idx_suspensions_fighter_active (fighter_id, ends_on) WHERE deleted_at IS NULL`.
- Triggers: `public.update_updated_at()` và `mma_private.audit_domain_mutation()`.
- RLS bật, `REVOKE ALL` từ `PUBLIC, anon, authenticated`.
- Quyền: `suspension:read` (FIGHTER, COACH, DOCTOR, ADMIN); `suspension:create` (COACH, DOCTOR, ADMIN); `suspension:clear` (chỉ COACH, DOCTOR; ADMIN không có quyền này).
- Thêm 7 giá trị vào `public.notification_type` (`BOUT_CREATED`, `BOUT_WEIGHT_AT_RISK`, `BOUT_REQUIREMENT_REJECTED`, `BOUT_REQUIREMENT_DUE`, `BOUT_WEIGHT_MISSING`, `SUSPENSION_CREATED`, `SUSPENSION_AWAITING_CLEARANCE`), chỉ thêm chứ không dùng làm literal trong cùng transaction.
- Ledger version 25, advisory lock `(20260916, 25)`, checksum trong `manifest.json`.

```sh
pnpm db:check
pnpm db:migrate:025
```

## Áp dụng migration 024 (Bộ luật giải, trận, checklist hồ sơ - bouts)

024 yêu cầu ledger đã có version 23 (023 academy_settings), chưa có 24, và ghi ledger version 24. Preflight cũng kiểm tra `training_plans.phase` (018), các hàm trigger của 003 và quyền `fighter.measurement:write` của 004.
Nội dung:
- Enum `bout_status`, `bout_sport`, `bout_result`, `bout_method`, `bout_requirement_status`.
- Bảng `competition_rulesets` (hạng cân, mẫu hồ sơ, quy tắc đình chỉ ở dạng jsonb; `created_by_id` NULL cho preset hệ thống) và ba preset: "MMA – VMMAF 2021" (`verified = true`), "Boxing nghiệp dư – AIBA (tham khảo)" (kèm 3 mục hồ sơ mẫu cho demo), "Tự nhập".
- Bảng `bouts` (snapshot hạng cân, ngưỡng giảm cấp tốc, hạn nộp hồ sơ; cột kết quả để NULL cho T-006). Ràng buộc `weigh_in_at < bout_at`, `cancel_reason` và `result`/`method` khác NULL khi và chỉ khi `CANCELLED`/`COMPLETED`; unique index `uq_bouts_active_per_fighter` (một trận `CAMP`, `FIGHT_WEEK`, `WEIGHED_IN` mỗi võ sĩ); khoá ngoại ghép `(training_plan_id, fighter_id)` tới `training_plans`.
- Bảng `bout_requirements` (`source` PRESET hoặc COACH, `validity_days`; `PROVIDED` và `CONFIRMED` bắt buộc có `valid_until`, `REJECTED` bắt buộc có `status_reason`).
- Triggers: `public.update_updated_at()`, `mma_private.audit_domain_mutation()`, `mma_private.reject_context_change('fighter_id')` trên `bouts`.
- RLS bật, REVOKE ALL từ `PUBLIC, anon, authenticated`.
- Quyền: `ruleset:read` (COACH, DOCTOR, ADMIN); `bout:get_all`, `bout:read` (FIGHTER, COACH, DOCTOR, ADMIN); `bout:create`, `bout:update`, `bout:result`, `bout:requirement` (COACH, ADMIN). Cấp thêm `fighter.measurement:write` cho FIGHTER (không cấp cho COACH).

```sh
pnpm db:check
pnpm db:migrate:024
```

## Áp dụng migration 023 (Chế độ giám sát y tế - academy_settings)

023 yêu cầu ledger đã có version 20 (020 movement evidence reviews) và ghi ledger version 23.
Nội dung:
- Enum `public.medical_supervision` (`DOCTOR`, `NONE`).
- Bảng một dòng `public.academy_settings` (`id boolean PRIMARY KEY DEFAULT true CHECK (id)`, `medical_supervision public.medical_supervision NOT NULL DEFAULT 'DOCTOR'`, `change_reason text`, `updated_by_id uuid REFERENCES public.users(id)`, `updated_at timestamptz NOT NULL DEFAULT now()`). Insert sẵn một dòng mặc định.
- Triggers: `public.update_updated_at()` và `mma_private.audit_domain_mutation()`.
- RLS bật, REVOKE ALL từ `anon, authenticated`.
- Quyền: `academy_settings:read` cho FIGHTER, COACH, DOCTOR, ADMIN; `academy_settings:manage` cho ADMIN.

```sh
pnpm db:check
pnpm db:migrate:023
```

## Áp dụng migration 018 (phase bắt buộc của Training Plan)

018 yêu cầu ledger đã có version 5 (005 thêm milestones) và ghi ledger version
18. Thêm enum `public.training_plan_phase` (`base`, `build`, `fight_camp`,
`taper`, `rehab`, `maintenance`) và cột `public.training_plans.phase`
`NOT NULL`, không default, không index. Migration khóa
`public.training_plans` (ACCESS EXCLUSIVE), thêm cột nullable, backfill mọi plan
hiện có (kể cả soft-deleted) thành `base` theo quyết định của chủ dự án ngày
2026-10-04, kiểm tra không còn NULL rồi mới `SET NOT NULL`; không xóa dữ liệu.
Collision enum/cột hoặc ledger đã có version 18 cũng dừng migration. Bản đầu
của 018 (abort khi bảng có dữ liệu) đã rollback và chưa vào ledger nên được sửa
trước khi áp dụng.
Backend chọn cột `phase` chỉ được deploy sau khi 018 đã áp dụng; request tạo
plan thiếu `phase` bị từ chối với 422.

```sh
pnpm db:check
pnpm db:migrate:018
```

Chưa chạy `pnpm db:check`/`pnpm test:db`/catalog comparison cho 018; chưa áp
dụng lên database nào.

## Áp dụng migration 017 (notification nhắc phân công bác sĩ)

017 yêu cầu ledger đã có version 15 (enum notification từ 015) và ghi ledger
version 17. Chỉ thêm giá trị `notification_type`
`FIGHTER_DOCTOR_ASSIGNMENT_REQUIRED` (không dùng làm literal trong cùng
transaction); không đổi bảng, RLS hay grant. Backend phát notification này sau
khi activation admission hoặc Admin tạo Fighter commit, tới Admin có quyền hiệu
lực `fighter.doctor:assign`, chỉ khi Fighter chưa có phân công bác sĩ hiệu lực.

```sh
pnpm db:check
pnpm db:migrate:017
```

Thứ tự trên DB đích: 015 → 016 → 017. Chưa chạy `db:check`/`test:db`/catalog
comparison cho 017; chưa áp dụng lên database nào.

## Áp dụng migration 016 (chi tiết khám và SCAT6 baseline)

016 yêu cầu ledger đã có version 12 (ghi ledger version 16). Nội dung:

- Enum `medical_examination_type` (BASELINE, ROUTINE, PRE_FIGHT, POST_INJURY,
  CONCUSSION_SCREEN, RETURN_TO_PLAY) — cùng tập loại khám mà web đang dùng.
- Bảng append-only `medical_examination_details`, tối đa một dòng/kết luận,
  FK `(examination_id, fighter_id)` → `medical_examinations(id, fighter_id)`:
  vitals typed (ghi cùng nhau hoặc không ghi), `assessments` JSON array,
  `recommendations`, `follow_up_date`, và với BASELINE bắt buộc hồ sơ SCAT6
  (`scat6_form_version`, `scat6_responses`, `scat6_scoring_version`,
  `scat6_scores`). Check ràng buộc: chỉ BASELINE có SCAT6; điểm luôn đi kèm
  phiên bản thuật toán.
- Kết luận ghi trước 016 không có dòng chi tiết, không bị coi là baseline,
  không backfill. Append-only (UPDATE/DELETE/TRUNCATE bị trigger từ chối); RLS
  bật, revoke client như các bảng clinical của 011. Không có audit trigger
  riêng: việc insert kết luận cùng transaction đã được audit bởi 011.
- Bảng `medical_baseline_exemptions` (PK `fighter_id`): ảnh chụp **một lần**
  lúc áp dụng 016 các Fighter đã có kết luận TRAINING thật. Từ 016, TRAINING
  chỉ đủ điều kiện khi Fighter có kết luận BASELINE hoặc nằm trong bảng này;
  Fighter chưa từng khám không được miễn. Không tạo kết luận/clearance giả.
  Trigger từ chối mọi INSERT/UPDATE/DELETE/TRUNCATE sau khi 016 ghi xong.
- Không đụng bảng AI, `fighter_measurements`, policy/grant khác.

```sh
pnpm db:check
pnpm db:migrate:016
```

Chưa chạy `pnpm db:check`/`pnpm test:db`/catalog comparison cho 016; chưa áp
dụng lên database nào.

## Áp dụng migration 015 (Notification delivery)

015 yêu cầu ledger đã có version 13 và ghi ledger **version 15** (advisory
lock key 15). File này trước đây tên `014_notifications_delivery.sql` và ghi
version 14, trùng `014_video_ai_vertical_slice.sql`. Ngày 2026-10-04 ledger của
database đích có version 14 = `014_video_ai_vertical_slice.sql` (2026-09-29) và
chưa có bản notification, nên 015 được sửa thành version 15 trước khi áp dụng
lần nào; checksum đã đăng ký trong `manifest.json`. Database nào từng chạy bản
`014_notifications_delivery.sql` cũ (ledger 14 mang tên đó) **không** được chạy
015 mà cần quyết định vận hành riêng. Nội dung:

- Thêm 13 giá trị `notification_type` cho trigger Admission A1–A6 và Training
  T1–T4 (xem Master Specification §05.12). Không rename/drop giá trị cũ; giá
  trị mới không được dùng làm literal trong cùng transaction.
- Cột `notifications.dedupe_key TEXT` nullable (record trước 015 giữ NULL và
  vẫn đọc được), check độ dài 1–300.
- Unique partial index `uq_notifications_user_dedupe (user_id, dedupe_key)
  WHERE dedupe_key IS NOT NULL`: worker insert `ON CONFLICT DO NOTHING` rồi đọc
  lại, nên retry/race không tạo record trùng, không reset `is_read/read_at`.
- Index danh sách `idx_notifications_user_created (user_id, created_at DESC, id
  DESC)`; index unread của 003 giữ nguyên.
- Không đổi RLS/grant (bảng chỉ backend truy cập), FK, check đọc/payload.

```sh
pnpm db:check
pnpm db:migrate:015
```

Chưa chạy `pnpm db:check`, `pnpm test:db` hay catalog comparison cho 015; chưa
áp dụng lên database nào. Drizzle mapping (`schema.ts`) đã cập nhật cột, check,
hai index và enum.

## Chính sách Medical clinical — thay thế ngày 2026-09-27 (D1–D9)

Nguồn chuẩn: quyết định chủ dự án ngày 2026-09-27 (D1–D9, xem
[`docs/prompts/medical-CLAUDE-PROMPT.md`](../../docs/prompts/medical-CLAUDE-PROMPT.md))
và [Master Specification §05.10.1](../../docs/MMA-TMS-MASTER-SPECIFICATION-v3.md).
Chính sách "chỉ assigned Doctor được đọc" ngày 2026-09-25 **đã bị thay thế** cho
phần clinical thủ công:

| Actor | Đọc clinical (dossier, history, examinations, review requests, `/medical-summary`) | Ghi clinical (injury, treatment, recovery, examination, clearance) |
| --- | --- | --- |
| ADMIN | Tất cả Fighter | Không; chỉ quản lý assignment |
| FIGHTER | Chính mình | Không; chỉ gửi yêu cầu khám cho chính mình |
| COACH | Fighter đang được phân công hiệu lực | Không; chỉ gửi yêu cầu khám trong scope |
| DOCTOR | Fighter đang được phân công hiệu lực | Có, chỉ khi assignment đang hiệu lực |
| GUEST | Không | Không |

"Hiệu lực" nghĩa là `starts_at <= now AND (ends_at IS NULL OR ends_at > now)`,
profile active và chưa xóa. Permission guard và resource scope đều bắt buộc;
explicit user deny vẫn thắng role grant; quyền ghi clinical còn đòi hỏi Doctor
đang được phân công, bất kể override. Kết luận khám (`medical_examinations`) tách
khỏi clearance; `NOT_ELIGIBLE` thu hồi clearance cùng phạm vi trong cùng
transaction. Bệnh án không bị xóa; cập nhật ghi phiên bản.

Ngoài phạm vi đợt này và **giữ nguyên**: bảng AI (health_alerts, joint
states/history, baselines) cùng predicate `mma_private.can_read_fighter_medical`
của 003; `fighter_measurements` và quyền measurements hiện hữu (010). Chỉ khi
chạy 011 thì RLS/grants mới có hiệu lực; README này không xác nhận database đích
đã áp dụng.

## Áp dụng migration 012 (thứ tự phát hành clearance)

012 yêu cầu ledger đã có version 11. `medical_clearances.created_at` mặc định
là `now()` (thời điểm bắt đầu transaction); khi các lệnh cấp giấy bị serialize
bởi advisory lock theo Fighter, transaction bắt đầu trước có thể commit sau nên
`created_at` không phản ánh thứ tự phát hành. 012 thêm
`issue_sequence BIGINT GENERATED ALWAYS AS IDENTITY` (unique) và index
`(examination_id, issue_sequence DESC)`. Eligibility chọn giấy chi phối là giấy
có `issue_sequence` lớn nhất của examination hiện hành, **trước** khi xét trạng
thái: giấy chi phối đã REVOKED hoặc chưa hiệu lực không để giấy cũ hơn thay thế.

- Không fire row trigger, không tạo revision/audit, không đổi điều khoản giấy.
- Preflight **từ chối chạy** nếu đã có clearance gắn examination: thứ tự phát
  hành thật của chúng không tái dựng được. Khi đó cần quyết định vận hành riêng.
- Preflight giữ khóa `ACCESS EXCLUSIVE` trên `medical_clearances` trước khi
  đọc dữ liệu đến hết transaction. Lệnh cấp giấy đang chạy phải commit/rollback
  trước bước kiểm tra; không thể insert giữa preflight và việc thêm sequence.
- Không đụng bảng/policy/grant AI hay `fighter_measurements`.

```sh
pnpm db:check
pnpm db:migrate:012
```

Đã kiểm tra ngày 2026-09-27: checksum 001–012 đạt; `pnpm test:db
--export-catalog` đạt 21 kiểm tra trên PostgreSQL tạm cô lập, gồm issuer đồng
thời commit/rollback khi chạy 012, thứ tự cấp giấy trùng `created_at` và chống
chạy lại. Không áp dụng migration lên database dự án.

Đối chiếu riêng 12 bảng medical/assignment và 34 enum đạt sau khi bổ sung
chiều index và identity vào công cụ catalog, sửa 5 mapping index medical thiếu
`DESC`. Chạy lại bằng:

```sh
pnpm build
pnpm test:db --export-catalog
node scripts/check-drizzle-catalog.mjs dist/database/schema.js ../tmp/schema-catalog.json --medical
```

Đối chiếu toàn bộ vẫn báo lệch: Drizzle có thêm 7 bảng dataset/AI không có
trong chuỗi migration hiện tại. Các bảng đó nằm ngoài phạm vi lần sửa này.

## Áp dụng migration 011 (Medical clinical records)

011 yêu cầu ledger đã có version 10. Nội dung:

- Enum mới: `medical_examination_scope` (`TRAINING | COMPETITION`),
  `medical_examination_decision` (`ELIGIBLE | ELIGIBLE_WITH_RESTRICTIONS |
  NOT_ELIGIBLE`), `medical_review_request_status` (`OPEN | RESOLVED`),
  `medical_revision_source` (`APPLICATION | MIGRATION_BASELINE`).
  - `ELIGIBLE_WITH_RESTRICTIONS` là kết luận đạt; clearance cấp từ nó phải giữ
    nguyên mọi hạn chế.
  - `RESOLVED` nghĩa là yêu cầu khám đã được một lần khám TRAINING xử lý,
    **không** có nghĩa Fighter đủ điều kiện; kết luận của lần khám đó quyết định.
  - `MIGRATION_BASELINE` là snapshot trạng thái lúc chạy 011, không phải phiên
    bản lịch sử được tái dựng và không phải kết luận mới của bác sĩ.
- Bảng mới: `medical_examinations` (append-only, `sequence_no` là thứ tự phát
  hành do server quản lý, correction qua `supersedes_id` cùng Fighter + scope và
  chỉ trên kết luận hiện hành), `medical_review_requests` (OPEN → RESOLVED, không
  xóa), và 4 bảng lịch sử `injury_record_revisions`, `recovery_plan_revisions`,
  `medical_clearance_revisions`, `medical_review_request_revisions`.
- Cột mới: `medical_clearances.examination_id` (NULL chỉ cho clearance có từ
  trước 011 — được giữ nguyên, không tính vào eligibility), `revision` trên
  injury/recovery/clearance.
- Trigger: mọi insert/update injury, recovery plan, clearance, review request
  ghi snapshot cùng transaction (actor lấy từ audit context; thiếu context thì
  fail closed); chặn DELETE/TRUNCATE và soft-delete (`deleted_at`, `is_active`);
  treatments và examinations append-only; clearance mới phải xuất phát từ kết
  luận đạt hiện hành, không nới hạn chế/thời hạn; điều khoản clearance đã cấp
  bất biến.
- Baseline: 011 chụp trạng thái injury/recovery/clearance hiện có thành revision
  `MIGRATION_BASELINE` (không gán bác sĩ). Dữ liệu cũ không bị đổi trạng thái,
  không được hợp thức hóa thành kết luận khám mới.
- RLS: bảng mới chỉ backend truy cập. Policy `medical_read` (003) trên
  `medical_clearances`, `injury_records`, `treatments`, `recovery_plans` được
  thay bằng `clinical_read` dùng `mma_private.can_read_fighter_clinical` (cùng
  ma trận ở trên, gồm effective permission `fighter.medical:read`). Policy của
  bảng AI và measurements không đổi.
- Permission mới và baseline:

  | Code | ADMIN | DOCTOR | COACH | FIGHTER |
  | --- | --- | --- | --- | --- |
  | `fighter.medical:read` (đã có từ 004) | có từ 007 | + | + | + |
  | `fighter.medical:write` (injury/treatment/recovery; **không** gồm examination, clearance, assignment) | | + | | |
  | `fighter.medical_examination:create` | | + | | |
  | `fighter.medical_clearance:issue` / `:revoke` | | + | | |
  | `fighter.medical_review_request:create` | | + | + | + |
  | `fighter.doctor:read` | + | + | + | + |
  | `fighter.doctor:assign` | + | | | |
  | `fighter.doctor:end` (Doctor chỉ kết thúc assignment của chính mình) | + | + | | |
  | `doctor.fighter:get_all` | + | + | | |

  Không seed `user_permissions`; ADMIN không nhận quyền ghi chuyên môn.

Trước khi áp dụng, kiểm tra `mma_private.migration_history` và các
`user_permissions` override hiện có cho `fighter.medical:read` trên môi trường
đích (override `is_granted = true` vẫn chỉ mở trong scope; override `false` vẫn
chặn). Không áp dụng lên môi trường chưa xác định.

```sh
pnpm db:check
pnpm db:migrate:011
```

Chưa chạy `pnpm db:check`, `pnpm test:db` hay catalog comparison cho 011 trong
đợt triển khai 2026-09-27; Drizzle mapping của các CHECK mới được viết theo định
dạng `pg_get_constraintdef` nhưng chưa được đối chiếu với database thật.

Các ghi chú triển khai bên dưới là lịch sử từng migration, không xác nhận trạng
thái database đích hôm nay.

## Áp dụng migration 010 (Coach Platform permission grants)

010 không thêm permission code mới; chỉ cấp cho role `COACH` 21 permission
code đã có từ 004/006: `fighter:get_all`, `fighter:read`,
`fighter.measurement:read`, `fighter.coach:read`, `fighter.session:read`,
`training.plan:get_all|read|create|update|transition`,
`training.plan_exercise:read|create|update|delete`,
`training.session:get_all|read|create|update|transition` và
`training.exercise:get_all|read`.

Không cấp cho COACH: `fighter:create|update|delete`,
`fighter.measurement:write` (số đo chỉ đọc với Coach),
`fighter.coach:assign|end`, `training.exercise:create|update` (thư viện bài
tập chỉ ADMIN biên soạn), `fighter.medical:read` (medical là feature tương
lai, chưa thuộc phạm vi này) và mọi quyền AI/analysis/feedback.

Việc giới hạn Coach vào Fighter có `coach_fighters` đang hiệu lực
(`starts_at <= now AND (ends_at IS NULL OR ends_at > now)`) nằm ở tầng
application (`FightersService`, `CoachesService`, `TrainingAccessService`);
migration chỉ mở permission ở tầng thô.

```sh
pnpm db:check
pnpm db:migrate:010
```

## Áp dụng migration 009 (Fighter Admissions)

Chủ dự án đã xác nhận **008 đã chạy** trên môi trường đích. Không chạy lại 008,
không sửa file hay checksum của 001–008, không tự ghi ledger.

009 thêm role `GUEST` vào `public.user_role` và 5 bảng admission
(`fighter_applications`, `fighter_application_coach_assignments`,
`fighter_application_assessments`, `fighter_application_decisions`,
`fighter_application_activations`) cùng catalogue permission
`fighter_application:get_all|read|evaluate` (cấp cho `ADMIN` và `COACH`).

```sh
pnpm db:check
pnpm db:migrate:009
```

Lưu ý PostgreSQL: `ALTER TYPE ... ADD VALUE 'GUEST'` nằm trong transaction của
009, nên **không** file nào trong cùng transaction được dùng literal `'GUEST'`
(default, check, cast, seed, grant). Ràng buộc nào cần `'GUEST'` phải đưa sang
migration sau.

Trước đợt này, `scripts/migration-files.mjs` và `run_sql.mjs` mới đăng ký tới
007 nên script `db:migrate:008` không dùng được; cả hai đã được bổ sung 008 và
009. Việc này chỉ đồng bộ tooling, không áp dụng gì lên database.

## Áp dụng migration 004

- Mỗi migration catalogue mới phải đăng ký permission trong `public.permissions`
và đồng thời cấp các permission mới đó cho role `ADMIN` trong
`role_permissions`, **trừ quyền ghi clinical Medical (chỉ DOCTOR, xem 011 ở đầu
tài liệu)**. Không sửa lại 004 để áp dụng ngoại lệ này.
Migration không được seed `user_permissions`; baseline của
FIGHTER/COACH/DOCTOR và override theo user được quản lý riêng bằng admin-only
assignment API hoặc quy trình SQL được kiểm soát.

Sau khi xác nhận migration 003 đã có trong `mma_private.migration_history`, chạy:

```sh
pnpm db:check
pnpm db:migrate:004
```

Runner chỉ áp dụng 004, không tự chạy lại migration cũ. Có thể chạy nguyên file
004 trong SQL Editor bằng database owner; file tự quản lý transaction và
preflight. Không chạy migration trên database chưa xác định hoặc môi trường dùng
chung khi chưa có backup và phê duyệt vận hành.

## Áp dụng cho Supabase dev hiện tại

Trạng thái đầu vào đã được chủ dự án xác nhận: **001 và 002 đã chạy; 003 chưa chạy**. Chưa kết nối hoặc kiểm chứng trực tiếp database Supabase trong đợt sửa này.

**Điểm đang chờ chốt trước khi áp dụng:** bản hiện tại giữ nguyên quyền truy cập của `analysis_jobs` từ baseline. Bảng này vẫn chứa JSON `health_alerts`/`joint_states`; nếu Supabase đang cấp quyền đọc trực tiếp cho client thì policy trên các bảng y tế mới không bảo vệ phần JSON legacy. Đã đề xuất thu hồi quyền trực tiếp của `anon`/`authenticated` và giữ truy cập qua backend, nhưng chưa áp dụng thay đổi quyền này khi chưa nhận trả lời của chủ dự án.

1. Giữ một bản backup/snapshot của database dev trước khi nâng cấp.
2. Kiểm tra file tại thư mục `nestjs-api`:

   ```sh
   pnpm db:check
   ```

   Lệnh này chỉ kiểm tra checksum file, không mở kết nối database.

3. Mở Supabase SQL Editor bằng tài khoản quản trị database, chạy **toàn bộ `003_mma_tms_complete_schema.sql` một lần**. Không chạy lại 001 hoặc 002. File đã có `BEGIN`/`COMMIT`; không chạy từng đoạn riêng lẻ.
4. Nếu có thông báo `Baseline ... drift`, object đã tồn tại hoặc lock timeout: giữ nguyên database, lưu thông báo lỗi để đối chiếu. Không bỏ qua preflight, không xóa bảng, không sửa 001–002 để vượt lỗi.
5. Kiểm tra sau khi chạy:

   ```sql
   SELECT version, name, source_sha256, applied_at
   FROM mma_private.migration_history WHERE version = 3;

   SELECT count(*) AS legacy_job_count FROM public.analysis_jobs;

   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'analysis_jobs'
   ORDER BY ordinal_position;

   SELECT tablename, policyname, roles, cmd
   FROM pg_policies WHERE schemaname = 'public'
   ORDER BY tablename, policyname;
   ```

`source_sha256` là NULL khi chạy bằng SQL Editor. Nếu dùng runner, checksum nguồn được ghi vào lịch sử migration.

### Runner tùy chọn

Sau khi cài dependencies và cung cấp `DATABASE_URL` qua môi trường an toàn:

```sh
pnpm db:migrate:003
```

Runner chỉ chạy 003, kiểm tra checksum 001–003, bật xác minh chứng chỉ TLS cho kết nối remote, không tự đọc `.env`, không chứa thông tin đăng nhập trong source và không tự retry. Dùng direct connection hoặc session pooler của Supabase cho migration. Không đưa password vào câu lệnh được lưu trong shell history. Nếu cần CA riêng, cấu hình CA tin cậy cho Node; không tắt xác minh TLS.

`run_sql.mjs` trước đây có credential ghi trực tiếp trong source; phiên bản mới đã loại bỏ. Nếu credential cũ còn hiệu lực, chủ dự án cần thay credential đó vì sửa file hiện tại không loại bỏ nó khỏi lịch sử Git.

## Những thay đổi trong 003

| Phần             | Thiết kế hiện tại                                                                                                                                                                                                         |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Baseline         | Giữ nguyên 12 cột của `analysis_jobs`, enum `job_status`, 4 index và trigger cập nhật timestamp từ 001–002. Chỉ thêm 5 FK nullable và các ràng buộc cho liên kết mới. Không backfill JSON/score hoặc thay `user_id TEXT`. |
| Identity         | `users.auth_user_id` unique, FK đến `auth.users.id`. Role `FIGHTER / COACH / DOCTOR / ADMIN`; profile và role phải khớp bằng composite FK. Email được lưu lowercase, trim và unique. Không lưu mật khẩu ứng dụng.         |
| Phân công        | `coach_fighters`, `doctor_fighters` lưu từng đợt với người giao/kết thúc và lý do. Một cặp chỉ có một đợt chưa kết thúc; đợt đã đóng không sửa/xóa. Không tự mở lại record cũ.                                            |
| Kế hoạch tập     | Bổ sung `training_plan_exercises`; session exercises giữ tên/hướng dẫn tại thời điểm giao bài. Session phải cùng Fighter với plan; có kiểm tra trạng thái và timestamp.                                                   |
| Hiệp và video    | `session_rounds` thuộc buổi tập; `video_round_segments` giữ mốc milliseconds của hiệp trong từng video, có FK đảm bảo cùng session.                                                                                       |
| Upload/phân tích | Mỗi upload có video riêng; mỗi video tối đa một job liên kết và một `ai_analyses`. Analysis bắt buộc tham chiếu job cùng video. Upload tiếp theo tạo record mới, kể cả cùng buổi tập.                                     |
| Kết quả          | Liên kết Fighter/session/config nhất quán; summary khóa theo analysis để hai upload cùng session không ghi đè nhau. Review của coach lưu revision, giữ kết quả AI gốc. Không tạo pipeline xử lý mới.                      |
| Provenance       | Không seed model/config/baseline. Config đã công bố hoặc được sử dụng không sửa tham số. Baseline có nguồn, người và thời điểm phê duyệt; baseline đã duyệt không sửa số liệu.                                            |
| Y tế             | Clearance, injury, treatment, recovery có FK, kiểm tra mốc thời gian và người phụ trách. Injury dẫn về source alert bằng một chiều FK; không tự suy ra chẩn đoán.                                                         |
| Số đo            | Thêm `fighter_measurements` để lưu lịch sử thể trạng và đính chính, chi tiết bên dưới.                                                                                                                                    |
| Audit            | Ghi metadata thay đổi của identity/permission, phân công, y tế, config/baseline và coach review. Audit, lịch sử khớp, review và số đo có trigger chặn UPDATE/DELETE/TRUNCATE.                                             |
| Vận hành         | Transaction, advisory lock, lock timeout, preflight baseline, ledger riêng `mma_private`, checksum file và kiểm thử PostgreSQL cô lập.                                                                                    |

Database sau 001–003 có **35 bảng public, 26 enum public**, cộng bảng lịch sử migration trong `mma_private`. SQL là nguồn quản lý cấu trúc; `schema.ts` ánh xạ đầy đủ bảng/cột/default/check/FK/key/index cho Drizzle. `auth.users` chỉ là tham chiếu ngoài, không thuộc quyền quản lý của migration.

## Hồ sơ thể trạng phù hợp với dữ liệu MMA

`fighter_measurements` lưu:

- `weight_kg`: cân nặng bắt buộc, số thập phân 2 chữ số; không dùng số thực dấu phẩy động cho cân nặng.
- `height_cm`, `reach_cm`: chiều cao và sải tay tùy chọn, đơn vị cm.
- `measured_at`, `recorded_by_id`: thời điểm đo thực tế và người ghi nhận.
- `measurement_context`: `TRAINING`, `CHECKUP`, `WEIGH_IN`, `SELF_REPORTED` để phân biệt nguồn/ngữ cảnh; không đồng nghĩa với kết quả kiểm định đủ điều kiện thi đấu.
- `supersedes_id`: bản đo được đính chính; bản mới phải thuộc cùng Fighter, mỗi bản cũ chỉ có một bản kế tiếp.

Các giá trị phải dương và hữu hạn. Đây là kiểm tra tính hợp lệ của dữ liệu, không phải ngưỡng đánh giá sức khỏe. Không tự thêm chẩn đoán, ngưỡng sinh tồn hoặc khuyến nghị giảm cân.

`fighters.weight_class` là **hạng cân đăng ký**, độc lập với cân nặng đo từng ngày. Migration chưa có domain giải đấu/ruleset/giới tính/loại cân chính thức để tự xếp hạng cân. Không áp một bảng ngưỡng duy nhất cho mọi giải MMA. `fighters.height_cm` và `reach_cm` là snapshot profile; không có cơ chế tự đồng bộ từ measurement.

Ví dụ lấy bản đo mới nhất còn hiệu lực sau đính chính:

```sql
SELECT m.*
FROM public.fighter_measurements m
WHERE m.fighter_id = $1
  AND NOT EXISTS (
    SELECT 1 FROM public.fighter_measurements correction
    WHERE correction.supersedes_id = m.id
  )
ORDER BY m.measured_at DESC, m.created_at DESC, m.id DESC
LIMIT 1;
```

Backend cần quy định ai được ghi số đo, xác thực thời điểm/nguồn đo và cung cấp ngữ cảnh phù hợp khi xếp hạng cân. Các quyền ghi này không được suy ra từ quyền đọc.

## Quyền đọc y tế trong migration 003 — lịch sử, không phải target mới

Bảng dưới mô tả RLS SELECT của migration 003 và quyết định tại thời điểm viết migration. Với `medical_clearances`, `injury_records`, `treatments`, `recovery_plans`, bảng này đã được 011 thay bằng `clinical_read` (ma trận D1 ở đầu tài liệu); các bảng AI và `fighter_measurements` vẫn giữ predicate 003. Không dùng bảng này để thiết kế Medical mới. RLS không tự cấp permission HTTP.

| Vai trò ứng dụng                            | Hồ sơ/số đo y tế                                      | Audit logs |
| ------------------------------------------- | ----------------------------------------------------- | ---------- |
| Fighter                                     | Chỉ Fighter gắn với tài khoản đang hoạt động của mình | Không      |
| Coach                                       | Tất cả Fighter, không giới hạn assignment             | Không      |
| Doctor / Medical Staff                      | Tất cả Fighter, không giới hạn assignment             | Không      |
| Admin                                       | Tất cả Fighter                                        | Đọc        |
| Anonymous, unmapped, inactive, deleted user | Không                                                 | Không      |

RLS SELECT áp dụng cho `medical_clearances`, `injury_records`, `treatments`, `recovery_plans`, `fighter_measurements`, `health_alerts`, `fighter_joint_states`, `joint_health_history`, `fighter_baselines`. Role Doctor sử dụng identifier `DOCTOR`; hồ sơ chuyên môn vẫn ở `sports_doctors`.

- Authenticated clients không được ghi trực tiếp vào các bảng domain mới; không thể tự sửa role hoặc tự nhận danh tính người ghi.
- Mọi quyền ghi phải qua backend có kiểm tra quyền. Với dữ liệu clinical (011), chỉ Doctor đang được phân công có permission được ghi; Admin không được sửa nội dung chuyên môn. Không role nào được phá tính append-only của audit/history/measurements.
- Các bảng domain ngoài nhóm trên bật RLS và chưa mở policy client. Backend sẽ cung cấp API theo scope nghiệp vụ tiếp theo.
- **Kết nối owner/superuser/service role có thể bypass RLS**; migration không thay thế kiểm tra quyền ở NestJS. Không cung cấp credential này cho client. Giữ `mma_private` ngoài danh sách schema expose của Supabase.
- Audit trigger ghi `SYSTEM` nếu request không mang Supabase subject. Khi backend sử dụng pooled connection, đặt subject đã xác thực và `mma.request_id` trong transaction bằng `SET LOCAL`/`set_config(..., true)`; không lấy actor từ body người dùng.
- **RLS không ghi log SELECT.** Backend cần ghi audit truy cập y tế (actor, target, request, timestamp) trong đường xử lý request; tính năng API này chưa được triển khai trong đợt migration. Trigger không sao chép toàn bộ nội dung sức khỏe vào audit.

Tham khảo cơ chế: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase Auth user data](https://supabase.com/docs/guides/auth/managing-user-data), [PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html).

## Tương thích và giới hạn triển khai

- Python worker, processing jobs, queue, frontend và mobile không nằm trong thay đổi. Các bảng mới chưa được pipeline hiện tại tự điền dữ liệu.
- Writer cũ vẫn có thể insert/update các cột từ 001–002; chưa tự chuyển legacy job thành domain analysis. FK mới để NULL cho tới khi có mapping được xác thực.
- Vì Drizzle SELECT mặc định chọn toàn bộ cột đã khai báo, **chạy 003 trước khi chạy backend dùng schema.ts mới**. Các insert cũ không cần thêm field.
- Liên kết context của video/analysis và record lịch sử được giữ cố định; sửa sai context bằng record mới. Các FK lịch sử dùng RESTRICT để tránh xóa dây chuyền; chưa thực hiện purge hoặc chính sách lưu trữ tự động.
- Unique assignment áp dụng cho đợt chưa kết thúc; không phải exclusion constraint cấm mọi khoảng thời gian quá khứ chồng lấn. Backend cần kiểm tra lịch sử nhập/bổ sung theo nghiệp vụ.
- Segment kiểm tra mốc dương, end > start và cùng session. Kiểm tra duration thực tế, segment chồng lấn hoặc phân đoạn từ video thuộc trách nhiệm validation dữ liệu media; migration không đọc video.
- Chưa có baseline dữ liệu lớn để benchmark index, phân vùng hoặc cam kết latency. Chỉ thêm index theo truy vấn và các key cần cho ràng buộc nhất quán.
- Preflight đối chiếu cột/default/enum/PK/trigger và 4 index baseline; collision domain làm rollback. Đây không phải công cụ phát hiện mọi thay đổi thủ công về privilege hoặc nội dung function trên Supabase.

## Kiểm thử và thay đổi tiếp theo

```sh
# Không cần npm dependencies: chỉ cần Node và PostgreSQL binaries.
# Windows mặc định tìm C:/Program Files/PostgreSQL/18/bin.
# Dùng PG_TEST_BIN nếu PostgreSQL cài nơi khác.
pnpm test:db
```

Test tạo cluster PostgreSQL mới trong thư mục tạm, listen localhost ở port tạm, dựng fixture Supabase Auth tối thiểu, rồi dừng cluster trong `finally`. Không đọc `.env` hoặc `DATABASE_URL`, không kết nối Supabase, không dùng database PostgreSQL đang có. Fixture auth không thay thế một bài integration test trên Supabase thật. Dữ liệu thử nghiệm nằm trong thư mục tạm in ở cuối test để điều tra khi cần.

Phạm vi kiểm thử: chạy mới 001→002→003→004, nâng cấp baseline có dữ liệu khác shape, hợp đồng insert/update legacy, chạy lại migration, schema drift và partial collision rollback, permission catalogue không tự tạo role/user grant, FK/check/domain history, quyền đọc y tế và privilege dưới role thật của PostgreSQL.

Đối chiếu SQL/Drizzle sau khi build:

```sh
node scripts/test-migrations.mjs --export-catalog
node scripts/check-drizzle-catalog.mjs dist/database/schema.js ../tmp/schema-catalog.json
```

`--export-catalog` ghi vào `../tmp`; đây là output phục vụ test, không phải snapshot Supabase. Checker đối chiếu 35 bảng, 26 enum, type/nullability/default, checks, FK/actions, keys và indexes. RLS/functions/grants được kiểm tra qua bài SQL, không sinh từ Drizzle.

`db:push` và `db:generate` được chặn để tránh để schema diff tự quản lý thiếu trigger, RLS, grants và ledger. Sau khi 004 đã áp dụng, mọi thay đổi tiếp theo phải tạo migration **005 trở đi**; không sửa rồi chạy lại migration cũ. Manifest dùng SHA-256 của nội dung UTF-8 đã chuẩn hóa CRLF→LF để kiểm tra giống nhau giữa Windows/Linux.

Rollback: lỗi trong lúc 003 chạy làm rollback toàn transaction. Sau khi đã COMMIT và phát sinh dữ liệu domain, không có down script xóa schema; sửa bằng migration kế tiếp hoặc phục hồi từ backup đã xác nhận.

### Kết quả kiểm tra trong workspace ngày 2026-09-15

- PostgreSQL 18.4 cô lập: 7 nhóm kiểm thử đã qua, gồm nâng cấp có dữ liệu, rollback và ma trận quyền đọc y tế.
- TypeScript 6.0.2 + Drizzle 0.45.2: schema compile thành công bằng bộ dependencies kiểm tra riêng trong `tmp`.
- Metadata PostgreSQL/Drizzle: khớp 35 bảng public, 26 enum và các cột/default/check/FK/key/index.
- Checksum xác nhận 001–002 giữ nguyên byte; kiểm tra manifest và `git diff --check` đã qua.
- Chưa chạy full build NestJS: `npm ci --offline` bị thiếu dependency trong cache. Chưa thực thi trên Supabase hoặc thay đổi dữ liệu dự án.
