# T-010 · Phân tích đối thủ, ghi theo hiệp, thẻ góc đài, báo cáo trận (migration 027, backend phần A)

| | |
| --- | --- |
| **Trạng thái** | READY |
| **Phần** | A: Backend (`nestjs-api`). Phần B (tab Đối thủ, thẻ góc đài, màn ghi hiệp, báo cáo; Fon) có ticket riêng, dùng contract của ticket này |
| **Người nhận** | Dan (thực hiện qua Codex theo [TEAM-WORKFLOW §3a](../TEAM-WORKFLOW.md#3a-cách-giao-việc)) |
| **Nhánh** | `feat/T-010-opponent-analysis-and-rounds` từ `fight-camp` mới nhất |
| **Ước lượng** | 2–2,5 ngày |
| **Hạn** | Merge trước 27/10 |
| **Tài liệu dẫn chiếu** | [Luồng nghiệp vụ E2 và nghiệp vụ 6, 9, 10, 14; R13, R14, R20–R26, R29, R30](../FIGHT-CAMP-BUSINESS-FLOWS.md), [Tech spec §2.8, §4, §8](../FIGHT-CAMP-TECH-SPEC.md) |
| **Migration** | **027** (`027_opponent_analysis_and_rounds.sql`), chỉ yêu cầu ledger đã có 024 |

## Bối cảnh

Trận hiện chỉ có `opponent_name`. Ticket này thêm: (1) phân tích đối thủ gắn vào trận (E2, nghiệp vụ 6); (2) số hiệp dự kiến và bảng ghi theo hiệp (nghiệp vụ 9); (3) thẻ góc đài, lời dặn giữa hiệp, thế trận và cảnh báo an toàn, tính khi đọc (R20–R24); (4) báo cáo trận, đánh giá chiến thuật tự điền và "điểm cần luyện" cho camp sau (nghiệp vụ 14, R29, R30); (5) nối vào việc ghi kết quả của T-006 (R25, R26).

**Thiết kế bảng ghi hiệp (`bout_rounds`) do Claude đề xuất ngày 22/10**, vì [Tech spec](../FIGHT-CAMP-TECH-SPEC.md) mới có §2.8 cho `opponent_analysis`. Claude sẽ đưa mục 1 dưới đây vào Tech spec khi review. Các ngưỡng gắn nhãn **(đề xuất)** ở R21, R22, R24 chưa được HLV có chuyên môn duyệt; viết chúng thành hằng số có tên trong `bout-analysis.model.ts` để đổi một chỗ.

## Thứ tự làm (vì T-006 chưa merge)

T-006 phần A (cân chính thức, kết quả) merge trước 25/10 và sửa `bouts.service.ts`, `bouts.model.ts`, `bouts.error.ts`, `bouts.controller.ts`. Để không đợi:

1. **Làm ngay:** mục 1 (migration), 2, 3, 4, 5 (hàm thuần và endpoint đọc ghi hiệp, phân tích đối thủ, thẻ góc đài). Không phụ thuộc T-006.
2. **Sau khi T-006 đã merge vào `fight-camp`:** merge `fight-camp` vào nhánh này (không rebase), giải xung đột giữ cả hai bên, rồi làm mục 6 (báo cáo dùng `computeAcuteLoss` của T-006) và mục 7 (nối vào `POST /bouts/:id/result`).

Xung đột dự kiến khi merge: `bouts.model.ts`, `bouts.service.ts`, `bouts.error.ts`, `bouts.controller.ts`, và các file migration dùng chung (`migrations/README.md`, `manifest.json`, `package.json`, `run_sql.mjs`, `scripts/migration-files.mjs`, `scripts/test-migrations.mjs`) với T-007 (025) và T-009 (026): giữ cả ba, đúng thứ tự số.

## Phạm vi

### 1. Migration `027_opponent_analysis_and_rounds.sql`

Theo khuôn `024_bouts.sql` (đọc nó trước): `BEGIN`, `lock_timeout`, `statement_timeout`, `pg_advisory_xact_lock(20260916, 27)`, preflight, ghi `mma_private.migration_history` version 27.

- **Preflight:** ledger đã có version 24, chưa có 27; không yêu cầu 025, 026. Kiểm bảng `public.bouts` và `public.training_sessions` tồn tại, hàm trigger `public.update_updated_at()`, `mma_private.audit_domain_mutation()`, `mma_private.reject_context_change()` tồn tại; chưa có cột `bouts.opponent_analysis`, `bouts.scheduled_rounds`, bảng `bout_rounds` (collision thì `RAISE EXCEPTION '027 … collision'`).
- **Cột trên `bouts`:**
  - `opponent_analysis jsonb NOT NULL DEFAULT '{}'` (cấu trúc ở [Tech spec §2.8](../FIGHT-CAMP-TECH-SPEC.md#28-phân-tích-đối-thủ-migration-027)). CHECK `jsonb_typeof(opponent_analysis) = 'object'`.
  - `scheduled_rounds smallint` (NULL được; bản ghi cũ không có). CHECK `scheduled_rounds BETWEEN 1 AND 12`.
- **Bảng `public.bout_rounds`:**

```sql
CREATE TABLE public.bout_rounds (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bout_id               uuid NOT NULL REFERENCES public.bouts(id) ON DELETE CASCADE,
  round_no              smallint NOT NULL CHECK (round_no BETWEEN 1 AND 12),
  tactic_marks          jsonb NOT NULL DEFAULT '{}',   -- { "<tacticId>": "EFFECTIVE" | "INEFFECTIVE" | "NOT_USED" }
  observation_marks     jsonb NOT NULL DEFAULT '{}',   -- { "<observationId>": "SEEN" | "NOT_SEEN" }
  self_score            text CHECK (self_score IN ('WIN', 'LOSS', 'CLOSE')),   -- HLV tự chấm (R23)
  knockdowns_against    smallint NOT NULL DEFAULT 0 CHECK (knockdowns_against BETWEEN 0 AND 10),
  stunned               boolean NOT NULL DEFAULT false,
  bleeding              boolean NOT NULL DEFAULT false,
  fatigued              boolean NOT NULL DEFAULT false,
  note                  text CHECK (note IS NULL OR char_length(note) <= 300),
  recorded_by_id        uuid NOT NULL REFERENCES public.users(id),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bout_id, round_no)
);
```

  Thêm CHECK `jsonb_typeof(tactic_marks) = 'object'` và `jsonb_typeof(observation_marks) = 'object'`. Trigger `update_updated_at`, trigger audit `audit_domain_mutation` (như `bout_requirements` ở 024), `fighter_id` không cần vì đi qua `bout_id`.
- **RLS và revoke:** bật RLS và `REVOKE ALL … FROM anon, authenticated` cho `bout_rounds` đúng như 024 làm cho `bout_requirements`.
- **Quyền:** không thêm quyền mới. Ghi hiệp và phân tích đối thủ dùng `bout:update`; ghi `review` dùng `bout:result`; đọc dùng `bout:read` (đều có từ 024).
- File đi kèm đủ như các migration trước: `scripts/migration-files.mjs`, `manifest.json` (checksum), `run_sql.mjs` (`--apply-027`, cập nhật dòng Usage và thông báo `001-027`), `package.json` (`db:migrate:027`), `scripts/test-migrations.mjs`, mục mô tả trong `migrations/README.md` (kể cả dòng tiêu đề "Migrations 003–…"). Drizzle schema trong `src/database/schema.ts` khớp migration (cột mới của `bouts`, bảng `boutRounds`).

### 2. Số hiệp dự kiến

- `createBoutSchema`, `updateBoutSchema`, `boutSummarySchema`/`toBoutSummary`, `insertBout`: thêm `scheduledRounds` (số nguyên 1–12, tùy chọn khi tạo, `null` được). Sửa được khi trận chưa `COMPLETED`, `CANCELLED` (cùng quy tắc `boutNotEditable`). Hạ `scheduledRounds` xuống thấp hơn số hiệp đã ghi: 422 `BOUT_ROUNDS_BELOW_RECORDED`.

### 3. Phân tích đối thủ ([Tech spec §2.8](../FIGHT-CAMP-TECH-SPEC.md#28-phân-tích-đối-thủ-migration-027), R13, R14)

- **`PUT /bouts/:id/opponent-analysis`**, quyền `bout:update`, `assertWriteAccess`. Ghi cả tài liệu `profile`, `observations`, `tactics` (không có `review`; nếu body có `review` trong chiến thuật thì 422). Server giữ nguyên `review` đang có của các chiến thuật cùng `id`. Server tự điền `updatedAt`, `updatedById`.
- Kiểm tra bằng Zod (strict) và service, đúng bảng ở §2.8: `stance` ∈ {`ORTHODOX`,`SOUTHPAW`,`SWITCH`}, `style` ∈ {`STRIKER`,`WRESTLER`,`GRAPPLER`,`ALL_ROUND`}; tối đa 6 quan sát (`kind` ∈ {`STRENGTH`,`OPENING`,`HABIT`}, `text` 1–300, có `evidenceUrl` http/https **hoặc** `evidenceNote`, `confidence` ∈ {`ONCE`,`REPEATED`}); tối đa 5 chiến thuật, mỗi chiến thuật có ít nhất một `observationIds` trỏ tới quan sát trong cùng tài liệu (422 `OPPONENT_TACTIC_EVIDENCE_REQUIRED`); `sessionIds` phải là `training_sessions` của cùng `fighter_id`, `deleted_at IS NULL` (422). `id` của quan sát và chiến thuật do client đặt, 1–20 ký tự `[a-z0-9_-]`, duy nhất trong tài liệu. `round` của chiến thuật: null hoặc số nguyên 1–12.
- Trận `COMPLETED` hoặc `CANCELLED`: 409 `BOUT_INVALID_TRANSITION` (§2.8, dùng `boutNotEditable`).
- **`PUT /bouts/:id/opponent-analysis/review`**, quyền `bout:result`. Body `{ reviews: [{ tacticId, outcome: 'EFFECTIVE'|'INEFFECTIVE'|'NOT_USED', note?: ≤300 }] }`. Chỉ khi trận `COMPLETED` (nếu không: 409 `BOUT_INVALID_TRANSITION`). `tacticId` phải có trong tài liệu (422). Chỉ ghi `review` của các chiến thuật được nêu.
- **Giá trị tính khi đọc (R14):** `tacticsWithoutSessions` = danh sách `id` chiến thuật có `sessionIds` rỗng.
- **Phạm vi đọc:** `GET /bouts/:id` thêm `scheduledRounds`, `opponentAnalysis`, `tacticsWithoutSessions`. Với **FIGHTER**, `opponentAnalysis` chỉ gồm `tactics` đã bỏ `review` (`id`, `text`, `round`, `partnerBrief`, `sessionIds`), không có `profile`, `observations`; kèm `sessions` là danh sách `{ id, title?, scheduledAt? }` của các buổi tập liên quan (đọc tên trường thật trong schema `training_sessions` trước khi đặt). COACH, DOCTOR, ADMIN nhận đủ.
- **Chép phân tích (R4b):** `GET /bouts/prior-context?fighterId=<uuid>&opponentName=<chuỗi>` (đặt **trước** route `:id` trong controller để không bị bắt nhầm), quyền `bout:get_all`, phạm vi như `listBouts`. Trả `{ improvementPoints, copyableAnalysis }`:
  - `improvementPoints`: điểm cần luyện (mục 6) của trận `COMPLETED` gần nhất của võ sĩ, hoặc `null`.
  - `copyableAnalysis`: `{ boutId, eventName, opponentName, opponentAnalysis }` của trận gần nhất mà người gọi **được xem** và `opponent_name` khớp (so không phân biệt hoa thường, gộp và bỏ khoảng trắng thừa), hoặc `null`. Bản trả về bỏ `review` và `id` được giữ nguyên. COACH chỉ thấy trận của võ sĩ được phân công (dùng `listBouts` scope, không viết đường tắt bỏ qua phạm vi).

### 4. Ghi theo hiệp (nghiệp vụ 9)

- **`PUT /bouts/:id/rounds/:roundNo`**, quyền `bout:update`, `assertWriteAccess`. Ghi lại thì cập nhật dòng cũ (upsert theo `(bout_id, round_no)`). Điều kiện: trận `WEIGHED_IN` hoặc `COMPLETED` (ghi lại sau trận); trạng thái khác 409 `BOUT_INVALID_TRANSITION`. `scheduled_rounds` phải đã có (422 `BOUT_ROUNDS_NOT_SET`) và `roundNo ≤ scheduled_rounds` (422 `BOUT_ROUND_OUT_OF_RANGE`).
- Body (Zod strict, mọi trường tùy chọn, tối thiểu 4 chạm mặc định ở frontend): `tacticMarks` (map `tacticId → EFFECTIVE|INEFFECTIVE|NOT_USED`), `observationMarks` (map `observationId → SEEN|NOT_SEEN`), `selfScore` (`WIN`|`LOSS`|`CLOSE`), `knockdownsAgainst` (0–10), `stunned`, `bleeding`, `fatigued`, `note`. Khoá của hai map phải là `id` có trong `opponent_analysis` của trận (422 `BOUT_ROUND_MARK_UNKNOWN`). Trường vắng giữ giá trị cũ khi ghi lại, trừ khi gửi tường minh.
- **`GET /bouts/:id/rounds`**, quyền `bout:read`, **chỉ COACH, DOCTOR, ADMIN** (FIGHTER nhận 403: bản ghi hiệp chứa đánh giá của HLV). Trả `{ scheduledRounds, rounds: [...], advice }`, `rounds` sắp theo `roundNo`. `advice` là kết quả mục 5 tính trên các hiệp đã ghi, dành cho hiệp kế tiếp (`null` khi chưa ghi hiệp nào hoặc đã đủ `scheduled_rounds`).

### 5. Thẻ góc đài và lời dặn (R20–R24), hàm thuần

Tạo `src/bouts/bout-analysis.model.ts` (và `.spec.ts`), không phụ thuộc DB. Hằng số **(đề xuất)** đặt tên rõ: `INEFFECTIVE_STREAK_TO_DROP = 2`, `NOT_SEEN_STREAK_TO_DEMOTE = 2`, `KNOCKDOWN_WARN_TOTAL = 2`, `STUNNED_STREAK_WARN = 2`.

- **`buildCornerCard(analysis, roundsSoFar?, acuteLoss?)` (R20).** Sắp chiến thuật: (a) chiến thuật có ít nhất một quan sát căn cứ `REPEATED` trước chiến thuật chỉ có `ONCE`; (b) cùng mức, chiến thuật có `sessionIds` trước chiến thuật chưa luyện; (c) cùng mức nữa thì giữ thứ tự trong tài liệu. Mỗi chiến thuật trả `{ id, text, round, partnerBrief, trained: boolean, basis: 'REPEATED'|'ONCE' }`; `trained = false` là nhãn "Chưa luyện". Chiến thuật có `round` khác null chỉ có `round` đó (frontend lọc; hàm trả đủ và giữ trường `round`). Kèm `acuteLossFlag` (R19) nếu truyền `acuteLoss.status === 'EXCEEDED'`.
- **`GET /bouts/:id/corner-card`**, quyền `bout:read`. Trận phải `WEIGHED_IN` hoặc `COMPLETED` (R20 dựng thẻ khi sang `WEIGHED_IN`); khác thì 409 `BOUT_INVALID_TRANSITION`. COACH, ADMIN, DOCTOR được; FIGHTER 403 (thẻ chứa quan sát). `acuteLoss` lấy từ T-006 (mục 6); trước khi T-006 merge, truyền `null`.
- **`buildRoundAdvice(analysis, rounds, scheduledRounds)`** trả:
  - `tactics` đã xếp lại (R21): điểm = (số hiệp `EFFECTIVE`) − (số hiệp `INEFFECTIVE`), `NOT_USED` hoặc vắng = 0. Xếp theo điểm giảm dần; bằng điểm thì theo thứ tự R20. Chiến thuật `INEFFECTIVE` liên tiếp từ `INEFFECTIVE_STREAK_TO_DROP` hiệp gần nhất (hiệp không ghi dấu không cắt chuỗi, hiệp `EFFECTIVE` cắt chuỗi) có `dropped: true` và bị đưa xuống cuối danh sách. Chiến thuật chưa được dùng (mọi hiệp `NOT_USED` hoặc vắng) mà có quan sát căn cứ trùng với chiến thuật khác đang `EFFECTIVE`/`INEFFECTIVE` được đẩy lên trước khi bằng điểm.
  - Cập nhật quan sát (R22): quan sát có ít nhất một `SEEN` được coi là `REPEATED` khi xếp thứ tự R20 (không ghi đè dữ liệu gốc); quan sát `NOT_SEEN` liên tiếp từ `NOT_SEEN_STREAK_TO_DEMOTE` hiệp gần nhất khiến chiến thuật **chỉ** dựa trên quan sát đó xếp cuối kèm `note: 'OPPONENT_MAY_HAVE_CHANGED'`.
  - `standing` (R23): `w`, `l` là số hiệp `selfScore` `WIN`, `LOSS`; `r = scheduledRounds − số hiệp đã ghi`. Nếu `l ≥ w`: `needed = l − w + 1`; `needed > r` thì `{ kind: 'HARD_TO_WIN_ON_POINTS' }`, ngược lại `{ kind: 'NEED_WINS', needed, remaining: r }`. Nếu `l < w`: `{ kind: 'AHEAD' }`. Luôn kèm `selfScored: true` (đây là HLV tự chấm, không phải điểm chính thức). Hiệp chưa có `selfScore` không tính vào `w`, `l`, nhưng vẫn trừ vào `r` khi đã ghi.
  - `safety` (R24): `KNOCKDOWN_WARN_TOTAL` ≤ tổng `knockdownsAgainst`, hoặc `stunned` ở `STUNNED_STREAK_WARN` hiệp liên tiếp gần nhất → `{ level: 'RED', reasons: ['KNOCKDOWNS' | 'STUNNED_STREAK'] }`; ngược lại `null`. Văn bản "Cân nhắc dừng trận, báo bác sĩ của giải" do frontend hiển thị; backend chỉ trả mã. App không quyết định thay HLV.

### 6. Báo cáo trận và điểm cần luyện (nghiệp vụ 14, R29, R30) — sau khi T-006 đã merge

- **`evaluateTactics(analysis, rounds)` (R29)**, hàm thuần. Mỗi chiến thuật: `effectiveRounds`, `ineffectiveRounds`, và `outcome`: `EFFECTIVE` nếu `effectiveRounds ≥ 1` và `effectiveRounds ≥ ineffectiveRounds`; `INEFFECTIVE` nếu `ineffectiveRounds > effectiveRounds`; `NOT_USED` nếu không hiệp nào `EFFECTIVE`/`INEFFECTIVE`. Mỗi quan sát: `notSeenInBout = true` khi có ít nhất một dấu và mọi dấu là `NOT_SEEN`.
- **`buildImprovementPoints(analysis, rounds, acuteLoss)` (R30)**: gồm (a) mỗi chiến thuật có `outcome = INEFFECTIVE` theo review đã lưu, nếu chưa có review thì theo `evaluateTactics`; (b) `ACUTE_LOSS_EXCEEDED` khi `acuteLoss.status === 'EXCEEDED'`; (c) mẫu lặp lại: `FATIGUE_FROM_ROUND_N` khi `fatigued` đúng ở ít nhất hai hiệp liên tiếp kết thúc ở hiệp cuối đã ghi, với `N` là hiệp đầu của chuỗi đó. Chỉ trả danh sách mã và dữ liệu; không tạo kế hoạch tập.
- **`GET /bouts/:id/report`**, quyền `bout:read`, chỉ COACH, ADMIN, DOCTOR; trận `COMPLETED` (khác: 409 `BOUT_INVALID_TRANSITION`). Trả `{ result: { result, method, resultRound, knockedDown }, tactics: [{ id, text, effectiveRounds, ineffectiveRounds, outcome, review }], observations: [{ id, text, notSeenInBout }], acuteLoss, improvementPoints, roundsRecorded }`. Trận không có bản ghi hiệp: `tactics[].outcome` đều `null`, `improvementPoints` chỉ còn (b), và báo cáo chỉ có phần thành tích (R25).
- **Thành tích (record):** `GET /fighters/:id/…` **không** thuộc ticket này (sửa module fighters ngoài phạm vi). Báo cáo không kèm thành tích; frontend lấy từ `GET /bouts?fighterId=…&status=COMPLETED`.

### 7. Nối vào ghi kết quả của T-006 (R25, R26) — sau khi T-006 đã merge

- **R26:** trong `POST /bouts/:id/result`: `resultRound > scheduled_rounds` (khi `scheduled_rounds` có giá trị) → 422 `BOUT_RESULT_INVALID` với `reason = 'ROUND_EXCEEDS_SCHEDULED'`. Kết quả `DECISION` mà số hiệp đã ghi nhỏ hơn `scheduled_rounds` (và `scheduled_rounds` có giá trị, đã ghi ít nhất một hiệp): trả 409 `BOUT_ROUNDS_INCOMPLETE` kèm `{ recorded, scheduled }` **trừ khi** body có `confirmIncompleteRounds: true` (trường mới, boolean, tùy chọn). Đây là "app hỏi lại" của R26.
- **R25:** `GET /bouts/:id/result-prefill`, quyền `bout:result`, trận `WEIGHED_IN`. Nếu đã ghi hiệp: `{ resultRound: <hiệp cuối có bản ghi> | null, knockedDown: <tổng knockdownsAgainst > 0> }` (`resultRound` luôn `null` khi người dùng sẽ chọn `DECISION`, nên chỉ trả gợi ý; frontend điền khi chọn KO/TKO/…). Chưa có bản ghi hiệp: `{ resultRound: null, knockedDown: null }`.
- **Tự điền đánh giá (R29):** khi `submitResult` chuyển trận sang `COMPLETED`, trong **cùng giao dịch**, nếu trận có bản ghi hiệp và có chiến thuật thì ghi `tactics[].review = { outcome, note: null, auto: true }` cho từng chiến thuật chưa có `review`, theo `evaluateTactics`. `PUT …/review` của HLV ghi đè và đặt `auto: false`. Thiếu bản ghi hiệp thì không tự điền.

## Ngoài phạm vi

Frontend (tab Đối thủ, thẻ in A4, màn ghi hiệp, báo cáo: phần B); đình chỉ và cảnh báo R4 (T-007); kế hoạch ăn (T-009); thẻ Việc cần làm và R31 (T-029); thành tích thắng–thua trong module fighters; sửa module `training`, `fighters`, `medical`; thông báo; gắn video vào trận; gợi ý tập luyện tự động; ngưỡng R21/R22/R24 theo chuyên môn (chờ HLV duyệt, chỉ cần đặt hằng số).

## Tiêu chí nghiệm thu

Hàm thuần (`bout-analysis.model.spec.ts`):

1. **R20:** hai chiến thuật t1 (căn cứ `ONCE`, có buổi tập), t2 (căn cứ `REPEATED`, chưa có buổi tập) → t2 đứng trước t1; t2 có `trained = false`. Hai chiến thuật cùng `REPEATED`, một có buổi tập → chiến thuật có buổi tập trước.
2. **R21:** t1 `INEFFECTIVE` hiệp 1 và 2, t2 cùng quan sát căn cứ chưa dùng → lời dặn hiệp 3 không có t1 ở đầu (t1 `dropped: true`, xuống cuối) và t2 đứng đầu. t1 `INEFFECTIVE` hiệp 1, `EFFECTIVE` hiệp 2 → không `dropped`, điểm 0.
3. **R22:** quan sát o1 `NOT_SEEN` ở hiệp 1 và 2, chiến thuật t3 chỉ căn cứ o1 → t3 xếp cuối kèm `OPPONENT_MAY_HAVE_CHANGED`; t4 căn cứ o1 và o2 (o2 không `NOT_SEEN`) → không bị đẩy xuống. Quan sát `SEEN` một lần → coi là `REPEATED` khi xếp.
4. **R23:** trận 3 hiệp, HLV chấm thua hiệp 1 và 2 (`w = 0`, `l = 2`, `r = 1`) → `HARD_TO_WIN_ON_POINTS`. Thua hiệp 1, thắng hiệp 2, còn 1 hiệp (`w = 1`, `l = 1`, `needed = 1 ≤ r`) → `NEED_WINS` với `needed = 1`. Thắng 2, thua 1 → `AHEAD`. Mọi kết quả có `selfScored: true`.
5. **R24:** bị đánh ngã hiệp 1 (1 lần) và hiệp 2 (1 lần) → `RED` với `KNOCKDOWNS`. Chỉ 1 lần → `null`. `stunned` ở hiệp 2 và 3 → `RED` với `STUNNED_STREAK`; `stunned` ở hiệp 1 và 3 (không liên tiếp) → `null`.
6. **R29:** t1 `EFFECTIVE` hiệp 1 và 2, không dùng hiệp 3 → `EFFECTIVE`; t2 `EFFECTIVE` 1, `INEFFECTIVE` 2 → `INEFFECTIVE`; t3 không hiệp nào → `NOT_USED`; t2 `EFFECTIVE` 1 và `INEFFECTIVE` 1 → `EFFECTIVE` (bằng nhau, có ít nhất 1 hiệp hiệu quả).
7. **R30:** `fatigued` ở hiệp 2, 3, 4 (hiệp cuối đã ghi là 4) → `FATIGUE_FROM_ROUND_2`; `fatigued` chỉ ở hiệp 2, 4 → không có mẫu. `acuteLoss.status = EXCEEDED` → có `ACUTE_LOSS_EXCEEDED`; `NO_DATA` hoặc `WITHIN` → không.

Service và API (`bouts.service.spec.ts` và spec controller):

8. Chiến thuật không có `observationIds` hoặc trỏ tới quan sát không tồn tại → 422 `OPPONENT_TACTIC_EVIDENCE_REQUIRED`, không ghi gì. Quan sát thứ 7 → 422. Quan sát không có cả `evidenceUrl` lẫn `evidenceNote` → 422; `evidenceUrl` là `javascript:…` → 422.
9. `sessionIds` chứa buổi tập của võ sĩ khác, hoặc đã xoá → 422. Chiến thuật không có buổi tập → `tacticsWithoutSessions` chứa `id` của nó.
10. `PUT opponent-analysis` trên trận `COMPLETED` → 409 `BOUT_INVALID_TRANSITION`. `PUT opponent-analysis/review` khi trận `WEIGHED_IN` → 409; khi `COMPLETED` → thành công.
11. FIGHTER đọc `GET /bouts/:id` của chính mình: có `tactics` (không có `review`) và `sessions`; không có `profile`, `observations`. FIGHTER gọi `GET /bouts/:id/rounds`, `corner-card`, `report` → 403. COACH không được phân công → 403.
12. Ghi hiệp: `scheduled_rounds = 3`, ghi hiệp 4 → 422 `BOUT_ROUND_OUT_OF_RANGE`; `scheduled_rounds = null` → 422 `BOUT_ROUNDS_NOT_SET`; trận `FIGHT_WEEK` → 409; ghi hiệp 1 hai lần → một dòng duy nhất, giá trị lần sau; `tacticMarks` khoá không có trong tài liệu → 422 `BOUT_ROUND_MARK_UNKNOWN`. Ghi hiệp khi trận đã `COMPLETED` → được.
13. `GET /bouts/:id/rounds` trả `advice` khớp hàm thuần; `advice = null` khi đã ghi đủ `scheduled_rounds`.
14. `PATCH` hạ `scheduledRounds` từ 5 xuống 2 khi đã ghi 3 hiệp → 422 `BOUT_ROUNDS_BELOW_RECORDED`.
15. `prior-context`: đối thủ "  Nguyen  VAN a " khớp "nguyen van a" của trận cũ → `copyableAnalysis` có, không có `review`. COACH không được phân công võ sĩ của trận cũ → `copyableAnalysis = null` dù tên trùng. Võ sĩ có trận `COMPLETED` với chiến thuật `INEFFECTIVE` → `improvementPoints` chứa nó.
16. (Sau khi T-006 merge) `result` với `resultRound = 5` khi `scheduled_rounds = 3` → 422 `ROUND_EXCEEDS_SCHEDULED`. `DECISION` khi mới ghi 2/3 hiệp → 409 `BOUT_ROUNDS_INCOMPLETE`; gửi lại với `confirmIncompleteRounds: true` → thành công. `result-prefill` sau khi ghi hiệp 1–3 trong đó hiệp 2 bị đánh ngã 1 lần → `resultRound = 3`, `knockedDown = true`. Lưu kết quả xong, chiến thuật chưa có review nhận `review.auto = true` theo `evaluateTactics`; chiến thuật đã có review không bị ghi đè.
17. (Sau khi T-006 merge) `report`: trận không có bản ghi hiệp → `outcome` đều `null`, `improvementPoints` không có mục (a) hay (c).

Migration (`test:db`):

18. 027 áp được trên ledger có 24 (không cần 025, 026); sau đó `bouts.opponent_analysis` mặc định `{}`, `scheduled_rounds` NULL được; `scheduled_rounds = 0` và `13` bị từ chối; `bout_rounds` từ chối `round_no = 0` và `13`, từ chối hai dòng cùng `(bout_id, round_no)`, từ chối `opponent_analysis = '[]'`; xoá trận thì hiệp bị xoá theo; RLS bật và `anon`, `authenticated` không có quyền trên `bout_rounds`; áp lại 027 bị từ chối, và ledger thiếu 24 bị từ chối.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nestjs-api lint
pnpm --filter nestjs-api build
pnpm --filter nestjs-api test
pnpm --filter nestjs-api test:db
pnpm --filter nestjs-api db:check
```

Không lệnh nào được thêm lỗi so với [baseline](./BASELINE.md). Dán nguyên văn phần cuối output vào `docs/tickets/T-010-HANDOVER.md` theo mục 6 của [TEAM-WORKFLOW](../TEAM-WORKFLOW.md). Handover ghi rõ mục 6 và 7 đã làm sau khi T-006 merge hay chưa.

## Ghi chú cho người thực hiện

- Module mẫu: `src/bouts/` (đọc `bouts.service.ts`, `bouts.repo.ts`, `bouts.model.ts`, `bouts.error.ts` trước) và `migrations/024_bouts.sql`. Không import `TrainingModule`; kiểm tra `sessionIds` bằng truy vấn trong `bouts.repo.ts` (như cách T-003 làm cho `training_plans`).
- Phân tích đối thủ là dữ liệu của một HLV soạn, ghi cả khối; không ghi từng phần tử riêng lẻ.
- Ngày luôn là ngày học viện (`academyDateOf`). Không cài thư viện. Không đụng khu vực đóng băng.
- Mã lỗi mới theo khuôn `bouts.error.ts`: `OPPONENT_TACTIC_EVIDENCE_REQUIRED`, `BOUT_ROUNDS_NOT_SET`, `BOUT_ROUND_OUT_OF_RANGE`, `BOUT_ROUND_MARK_UNKNOWN`, `BOUT_ROUNDS_BELOW_RECORDED`, `BOUT_ROUNDS_INCOMPLETE`. Dùng lại `BOUT_INVALID_TRANSITION`, `BOUT_RESULT_INVALID` (T-006) khi đã có.
- Thấy lệch giữa ticket và code thì ghi vào mục "Câu hỏi" của handover, không đoán.
