# T-040 B Handover

- Nhánh: `feat/T-040-demo-seed` (từ `fight-camp` `77a95eb`)    Commit: chưa commit (chủ dự án chưa yêu cầu)
- Trạng thái: IN REVIEW

## Thay đổi

- `nestjs-api/scripts/demo-seed.mjs` (mới): script tạo dữ liệu demo **chỉ qua HTTP API**.
  - Phần thuần, có export: `buildPlan(now)` dựng toàn bộ dữ liệu theo `now`, giờ học viện UTC+7. Ngoài ra có `academyDate`, `addDays`, `isPastCutoff`, `isWriteMethod`, `missingEnv`, `parseArgs`.
  - Phần chạy: `run({ argv, env, fetch, now, out, err })` trả về mã thoát.
  - Cờ `--dry-run` và `--with-ai`. Cảnh báo stderr khi `--with-ai` gặp trận đã `COMPLETED` mà chưa có gợi ý OK; chỉ tính gợi ý có status `OK` là đã có. Bắt lỗi HTTP 401 khi đăng nhập HLV demo và báo rõ `coach demo exists with a different password`.
  - Tìm trước, tạo sau: user theo email, trận theo `eventName`, kế hoạch và buổi tập theo `title`. Phân công HLV, chuỗi số cân, đình chỉ và hiệp đấu thì kiểm có sẵn chưa. Trận đã có thì đi tiếp từ trạng thái hiện tại.
  - Cuối mỗi lần chạy in `created=<n> existing=<m>`.
- `nestjs-api/scripts/demo-seed.test.mjs` (mới): 14 test `node:test` cho S1–S10, S12–S14, gồm một ca đối chứng cho S9. API giả trong bộ nhớ thay `fetch` và giữ trạng thái thật giữa hai lần chạy: tạo bản ghi, chặn email trùng (409), kiểm chuyển trạng thái trận (409).
- `nestjs-api/package.json`: thêm `demo:seed` (`node scripts/demo-seed.mjs`) và `test:seed` (`node --test scripts/demo-seed.test.mjs`).

Không sửa `src/`, migration hay frontend. Không cài thư viện.

### Dữ liệu (ruleset `MMA – VMMAF 2021`, hạng `70` kg, 1 HLV `t040.coach@example.com`)

| Võ sĩ | Email | Giai đoạn | Dữ liệu chính |
| --- | --- | --- | --- |
| 1 | `t040.fighter1@example.com` | `CAMP` | Cân cách ngày từ −27 đến −3, nên tuần gần nhất có ngày trống và đường cân xám (`NOT_WEIGHED`, cân gần nhất ≥ 3 ngày). Cân chính thức +21 ngày |
| 2 | `t040.fighter2@example.com` | `FIGHT_WEEK` | Cân hằng ngày đến −2. Số cuối 75,8 kg, trên mức 70 kg 7,7 %, sát ngưỡng đỏ 8 %. Thiếu cân hôm qua nên có nhắc cân `YESTERDAY_MISSING`. Cân chính thức +3 ngày |
| 3 | `t040.fighter3@example.com` | `WEIGHED_IN` | `weighInAt` = 1 giờ trước, `boutAt` = 19:00 ngày mai. Cân chính thức 69,8 kg |
| 4 | `t040.fighter4@example.com` | Đình chỉ | Hai buổi `SPARRING` (+2, +5) và một buổi `RECOVERY` (+3) tạo **trước** đình chỉ. Đình chỉ `MANDATORY_REST` 14 ngày, chặn `SPARRING`, `GRAPPLING`, `PAD_WORK` |
| 5 | `t040.fighter5@example.com` | Sẵn sàng | Ba lần cân, không trận, không đình chỉ |
| 6 | `t040.fighter6@example.com` | `COMPLETED` | Trận 3 hiệp lúc 23:00 hôm nay. Có phân tích đối thủ (3 quan sát, 2 chiến thuật), hiệp 1 có `nextRoundPlan`, hiệp 2 bị knockdown. Kết quả `LOSS` `KO` hiệp 2, `UNDER_1_MIN`, `suspensionDays: 30`. Ruleset MMA không có luật đình chỉ nên backend bắt buộc gửi số ngày |

## Đối chiếu ca kiểm thử

| Ca | Test (`nestjs-api/scripts/demo-seed.test.mjs`) | Code chính (`nestjs-api/scripts/demo-seed.mjs`) |
| --- | --- | --- |
| S1 | `:121` | `:215` (dry-run không gọi `fetch`, chỉ in request ghi) |
| S2 | `:134` | `:288`, `:355`, các nhánh `found()`; dòng tổng kết `:348` |
| S3 | `:155` | `:288` (user theo email), `:355` (trận theo `eventName`) |
| S4 | `:173` | `:38` `buildPlan` |
| S5 | `:182` | `:255` `missingEnv` |
| S6 | `:192` | `:38` `buildPlan` |
| S7 | `:219` | `:246` `isPastCutoff`, kiểm trước mọi request kể cả login |
| S8 | `:228` | `:397` (chỉ khi có `--with-ai`, cả GET lẫn POST `/ai/`) |
| S9 | `:245`, đối chứng `:254` | `:408–418` |
| S10 | `:263` | `:38` (dữ liệu võ sĩ 4); không có lệnh gọi `conflicts/apply` nào (`:348`) |
| S12 | `:293` | `:416` (cảnh báo stderr khi trận đã `COMPLETED` mà chưa có gợi ý OK) |
| S13 | `:306` | `:410` (chỉ tính `status === 'OK'`, gợi ý `FAILED` thì tạo lại) |
| S14 | `:315` | `:410` (đã có gợi ý `status === 'OK'` thì không gọi POST) |

Đã thử làm hỏng code để kiểm test không qua vô điều kiện (bản sao trong scratchpad, không sửa file thật):
- Bỏ tra user: S2, S3, S9 và S9 đối chứng lỗi.
- Bỏ kiểm gợi ý AI đã lưu: S9 lỗi.
- Bỏ chặn giờ: S7 lỗi.
- Cho dry-run gọi `fetch`: S1 lỗi.

**Lệch lớp so với ticket:** phần thứ tự tạo (buổi tập trước đình chỉ) và "không gọi apply" của S10 được kiểm bằng log request của API giả, không bằng hàm thuần, vì thứ tự nằm ở phần chạy. Phần ngày và loại buổi nằm trong khoảng đình chỉ thì vẫn kiểm trên `buildPlan`.

## Request script gửi, theo thứ tự (DB rỗng)

Ở mỗi bước, chỉ tạo khi bước GET đứng trước không tìm thấy bản ghi. `A` là admin, `C` là HLV demo.

1. `A` `POST /auth/login`, bỏ qua nếu có `DEMO_SEED_TOKEN`.
2. `A` `GET /users?search=t040.coach@example.com&role=COACH`, rồi `A` `POST /users` (COACH).
3. `C` `POST /auth/login`, bằng email HLV demo và `DEMO_SEED_USER_PASSWORD`.
4. `C` `GET /competition-rulesets`, chọn `MMA – VMMAF 2021`.
5. Với mỗi võ sĩ 1→6:
   1. `A` `GET /users?search=<email>&role=FIGHTER`, rồi `A` `POST /users` (FIGHTER).
   2. `A` `GET /fighters/:id/coaches`, rồi `A` `POST /fighters/:id/coaches`.
   3. `A` `GET /fighters/:id/measurements?limit=1`. Nếu `total = 0` thì `A` `POST /fighters/:id/measurements` cho từng số cân (`TRAINING`, có `measuredAt`). Võ sĩ 1: 13 lần, 2: 33, 3: 14, 4: 4, 5: 3, 6: 15.
   4. Riêng võ sĩ 4:
      - `C` `GET /training-sessions?fighterId=…&limit=100`, rồi `C` `POST /training-sessions` ×3.
      - `C` `GET /suspensions?fighterId=…&limit=100`, rồi `C` `POST /suspensions`.
   5. Võ sĩ 1, 2, 3, 6:
      - `C` `GET /bouts?fighterId=…&limit=100`, rồi `C` `POST /bouts`.
      - Nếu trận còn `SCHEDULED`: `C` `GET /training-plans?fighterId=…&limit=100`, `C` `POST /training-plans` (`fight_camp`), rồi `C` `POST /bouts/:id/camp`.
      - Võ sĩ 2, 3, 6: `C` `POST /bouts/:id/fight-week`.
      - Võ sĩ 6, khi trận chưa kết thúc: `C` `GET /bouts/:id`, rồi `C` `PUT /bouts/:id/opponent-analysis`.
      - Võ sĩ 6, chỉ khi có `--with-ai` và trận chưa kết thúc: `C` `GET /bouts/:id/ai/suggestions`, rồi `C` `POST /bouts/:id/ai/tactics`.
      - Võ sĩ 3, 6: `C` `POST /bouts/:id/weigh-in`.
      - Võ sĩ 6: `C` `GET /bouts/:id/rounds`, `C` `PUT /bouts/:id/rounds/1`, `C` `PUT /bouts/:id/rounds/2`, rồi `C` `POST /bouts/:id/result`.

Tổng khi DB rỗng: 120 request ghi, chưa kể 2 lần login. Có `--with-ai` thì thêm 1.

Vì sao chia admin và HLV:
- HLV không có quyền `fighter.measurement:write`: migration 010 chỉ cấp `read`.
- Tạo user và phân công HLV là việc của admin.
- Trận, kế hoạch, buổi tập và đình chỉ do HLV được phân công tạo. Nhờ vậy `bout.coachId` là HLV demo, và thẻ Việc cần làm (`GET /coach/todo`) của HLV này thấy cả 6 võ sĩ.

## Cách Ken chạy thật

1. Chạy backend trỏ tới Supabase của team. Migration 023–032 đã áp. Ruleset `MMA – VMMAF 2021` đến từ migration 024.
2. Chạy **trước 22:30 giờ Việt Nam**. Sau giờ đó script dừng trước mọi request và báo giờ giới hạn.
3. Đặt biến môi trường trong shell, không ghi vào file:

   ```bash
   export DEMO_SEED_API_URL=http://localhost:<cổng backend>
   export DEMO_SEED_ADMIN_EMAIL=<email admin>
   export DEMO_SEED_ADMIN_PASSWORD=<mật khẩu admin>   # hoặc: export DEMO_SEED_TOKEN=<access token admin>
   export DEMO_SEED_USER_PASSWORD=<mật khẩu cho 7 tài khoản demo, ≥ 8 ký tự>
   ```

4. Xem trước: `pnpm --filter nestjs-api demo:seed -- --dry-run`. Không gửi request nào, kể cả GET và login.
5. Chạy thật: `pnpm --filter nestjs-api demo:seed`. Thêm `-- --with-ai` nếu muốn gọi Gemini một lần cho gợi ý chiến thuật của võ sĩ 6. **Lưu ý:** Lần chạy đầu phải có `-- --with-ai` nếu cần gợi ý AI. Vì trận của võ sĩ 6 được đưa tới `COMPLETED` ngay trong lần chạy đầu, nếu chạy lần sau mới thêm `-- --with-ai` thì script sẽ bỏ qua và in cảnh báo ra stderr (`AI skipped: bout already completed; run the first seed with --with-ai`), không lỗi cả lượt.
6. Chạy lại lần 2: dòng cuối phải là `created=0 existing=<m>`.
7. Lỗi giữa chừng thì script in `<method> <path> [<tài khoản>] -> HTTP <mã> <code lỗi>` và thoát mã 1. Sửa nguyên nhân rồi chạy lại, script đi tiếp từ chỗ dừng.
8. Đăng nhập frontend bằng `t040.coach@example.com` và `DEMO_SEED_USER_PASSWORD` để xem bảng Sẵn sàng và thẻ Việc cần làm.

## Lệnh đã chạy

`node --test nestjs-api/scripts/demo-seed.test.mjs`

```text
✔ S1: --dry-run sends no write request and prints every planned write (3.0951ms)
✔ S2: two real runs on the same fake API, the second creates nothing (19.3517ms)
✔ S3: an existing fighter 2 user and bout are not created again, the rest is (5.4664ms)
✔ S4: every email in the plan ends with @example.com, for any now (0.9733ms)
✔ S5: missing URL or token exits non-zero, names the variable, sends nothing (0.2007ms)
✔ S6: stages at now = 2026-11-03T03:00:00Z (10:00 UTC+7) (0.359ms)
✔ S7: real run at 22:40 UTC+7 exits non-zero, names the cut-off, sends nothing (0.0828ms)
✔ S8: without --with-ai no request goes to an /ai/ path (5.3822ms)
✔ S9: --with-ai and fighter 6 bout already has a saved suggestion: no POST to /ai/ (7.1134ms)
✔ S9 (control): --with-ai and no saved suggestion: exactly one POST /ai/tactics (3.9459ms)
✔ S10: fighter 4 blocked sessions sit inside the suspension, are created first, and conflicts/apply is never called (4.309ms)
ℹ tests 11
ℹ suites 0
ℹ pass 11
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

`DEMO_SEED_API_URL=http://127.0.0.1:9 DEMO_SEED_ADMIN_EMAIL=admin@example.com DEMO_SEED_ADMIN_PASSWORD=fake-password DEMO_SEED_USER_PASSWORD=fake-password node nestjs-api/scripts/demo-seed.mjs --dry-run` (exit 0). Dry-run không gửi request nào, kể cả GET, nên không cần backend chạy:

```text
Dry-run: không gửi request nào. Các request ghi sẽ gửi khi DB rỗng (ngày học viện 2026-10-31):
POST /auth/login [admin]
POST /users [admin] coach t040.coach@example.com
POST /auth/login [coach]
…
POST /bouts/<f6.boutId>/fight-week [coach] f6
PUT /bouts/<f6.boutId>/opponent-analysis [coach] f6
POST /bouts/<f6.boutId>/weigh-in [coach] f6
PUT /bouts/<f6.boutId>/rounds/1 [coach] f6
PUT /bouts/<f6.boutId>/rounds/2 [coach] f6
POST /bouts/<f6.boutId>/result [coach] f6
created=120 existing=0
```

`pnpm --filter nestjs-api lint`: exit 0. 37 cảnh báo, 0 lỗi, tất cả có từ trước trong `src/` và `test/`. Lint không quét `scripts/`. Chạy riêng `oxlint scripts/` cũng exit 0, không cảnh báo.

```text
$ oxlint src/ test/
…
src/medical/scat6.model.spec.ts:5:3: warning eslint(no-unused-vars): Identifier 'scat6ScoresSchema' is imported but never used. help: Consider removing this import.
```

`pnpm --filter nestjs-api build`: exit 0.

```text
$ nest build
```

Không chạy script thật tới backend hay Supabase, đúng luật của ticket.

## Lệch so với ticket

- S10, lớp test: xem mục "Đối chiếu ca kiểm thử".
- S10, ý đồ "còn một buổi `SCHEDULED` xung đột": backend không cho làm qua API, xem câu hỏi 1. Script làm đúng phần đặc tả (buổi bị chặn tạo trước, nằm trong khoảng, không gọi `apply`), nhưng trên backend thật sẽ không còn buổi `SCHEDULED` nào xung đột.

## Câu hỏi / việc còn mở

1. **S10 mâu thuẫn với backend thật. `TRAINING_CONFLICTS_WITH_SUSPENSION` không tạo được qua API.**
   - `POST /suspensions` tự áp R28 cho mọi buổi `SCHEDULED` bị chặn ngay trong transaction tạo đình chỉ: `suspensions.service.ts:136` gọi `suspensionEffects.runOnCreated`, chạy vào `training-suspension-conflicts.service.ts:102–255` `handleSuspensionsCreated`.
     - Đình chỉ không cần xác nhận tập lại thì buổi chuyển `PENDING`.
     - `KO`, `TKO` hoặc có `requiresClearance` thì buổi chuyển `CANCELLED`.
   - Tạo buổi bị chặn **sau** đình chỉ thì bị Cổng 2 từ chối: `training-session.service.ts:112` `assertNotSuspended`, ra `TRAINING_SUSPENSION_ACTIVE`. Đổi loại hay giờ của buổi cũng qua cùng cổng (`:197`).
   - Vì vậy sau khi chạy: võ sĩ 4 có 2 buổi `PENDING` ("Chờ xếp lại") và 1 buổi `RECOVERY` `SCHEDULED` không bị chặn, nhưng **không** có buổi `SCHEDULED` xung đột.
   - Chủ dự án chọn một trong ba:
     - (a) Chấp nhận thẻ Việc cần làm không có nguồn này.
     - (b) Mở ticket backend để `POST /suspensions` có tuỳ chọn không tự áp, cho HLV áp tay.
     - (c) Bỏ nguồn này khỏi tiêu chí 6.
2. **`SUSPENSION_AWAITING_CLEARANCE` không có trong ngày chạy.**
   - Đình chỉ chỉ bắt đầu được từ hôm nay (`suspensions.model.ts:447–455`, `startsOn` không trước hôm nay) và có ít nhất 1 ngày, nên `endsOn ≥ hôm nay`.
   - Nguồn này chỉ xuất hiện từ `endsOn + 1` (`bouts-todo.model.ts:175`).
   - Võ sĩ 6 có đình chỉ KO 30 ngày, cần xác nhận tập lại, nên sẽ vào `AWAITING_CLEARANCE` sau 30 ngày, không kịp demo.
   - Nếu cần nguồn này cho tổng duyệt 9/11, có cách: chạy script một ngày trước, và thêm cho võ sĩ 4 một đình chỉ `MEDICAL` 1 ngày (`requiresClearance: true`). Hôm sau nó sang `AWAITING_CLEARANCE`. Script **chưa** làm việc này. Chờ quyết định, vì nó đổi giai đoạn trình bày của võ sĩ 4.
3. **Đăng nhập tài khoản HLV demo vừa tạo.** Script đăng nhập HLV ngay sau `POST /users`. Nếu `POST /auth/login [coach]` trả 401 (ví dụ tài khoản đã có sẵn từ trước với mật khẩu khác), script báo rõ `coach demo exists with a different password` rồi dừng mã 1. Cần biết cách team kích hoạt tài khoản do admin tạo nếu Supabase thật yêu cầu xác nhận email.
4. **"Cân gần đỏ" của võ sĩ 2.**
   - Trong tuần thi đấu, đường cân chỉ có hai trạng thái là `OVER_LIMIT` (đỏ) hoặc `ON_TRACK`. `ABOVE_TARGET` (vàng) chỉ có khi còn hơn `acuteWindowDays` ngày (`bouts.model.ts:468–480`).
   - Script đặt 7,7 %, sát ngưỡng 8 %, nên đường cân vẫn xanh và có nhắc cân. Nguồn "cân xám" của tiêu chí 6 đến từ võ sĩ 1.
   - Nếu muốn võ sĩ 2 hiện đỏ thì đổi số cân cuối lên khoảng 76,2 kg.
5. **Cùng tên sự kiện, khác ngày.** Script tìm trận theo `eventName` cố định. Nếu Ken chạy ngày D rồi chạy lại ngày D+3, trận cũ được giữ, nên giai đoạn có thể đã lệch: võ sĩ 2 có thể quá ngày cân, võ sĩ 3 có thể quá ngày thi và hiện `RESULT_OVERDUE`. Ngày trình bày nên chạy trên DB chưa có dữ liệu `t040.*`. Script không có bước dọn, vì ticket không yêu cầu và không có API xoá trận.

## Lượt sửa 1

### Nội dung sửa
1. **Gợi ý AI võ sĩ 6 khi trận đã hoàn thành:** Nếu chạy với `--with-ai` mà trận đã `COMPLETED` và chưa có gợi ý OK thì in cảnh báo rõ ràng ra stderr (`AI skipped: bout already completed; run the first seed with --with-ai`), không lỗi cả lượt (exit 0). Đã bổ sung lưu ý vào mục cách chạy: lần chạy đầu phải có `--with-ai` nếu cần gợi ý AI.
2. **Xử lý gợi ý status `FAILED`:** Backend vẫn lưu dòng khi AI lỗi hoặc hết quota (`status: 'FAILED'`). Script đổi logic kiểm tra: chỉ tính gợi ý có `status: 'OK'` là đã có. Nếu có sẵn gợi ý `FAILED` và trận còn mở, script sẽ gọi lại `POST .../ai/tactics` để thử lại.
3. **Đăng nhập HLV demo bị 401:** Bắt lỗi HTTP 401 tại bước `POST /auth/login` của HLV demo và báo rõ `coach demo exists with a different password` rồi dừng mã 1.
4. **Bổ sung 3 ca kiểm thử mới (`S12`, `S13`, `S14`):** Tổng cộng 14 tests pass.
   - S12: lần 1 chạy không `--with-ai` (trận võ sĩ 6 tới `COMPLETED`); lần 2 chạy với `--with-ai` → không có POST `/ai/`, stderr có cảnh báo AI bị bỏ qua, exit 0.
   - S13: `--with-ai`, API giả có sẵn gợi ý status `'FAILED'` cho trận võ sĩ 6 còn mở → CÓ gọi `POST .../ai/tactics`.
   - S14: `--with-ai`, API giả có sẵn gợi ý status `'OK'` → không gọi POST `/ai/` (giống S9, giữ S9).

### Phần cuối output các lệnh kiểm tra cuối

`node --test nestjs-api/scripts/demo-seed.test.mjs`

```text
✔ S1: --dry-run sends no write request and prints every planned write (3.7141ms)
✔ S2: two real runs on the same fake API, the second creates nothing (20.834ms)
✔ S3: an existing fighter 2 user and bout are not created again, the rest is (5.6788ms)
✔ S4: every email in the plan ends with @example.com, for any now (1.0548ms)
✔ S5: missing URL or token exits non-zero, names the variable, sends nothing (0.1866ms)
✔ S6: stages at now = 2026-11-03T03:00:00Z (10:00 UTC+7) (0.3607ms)
✔ S7: real run at 22:40 UTC+7 exits non-zero, names the cut-off, sends nothing (0.0889ms)
✔ S8: without --with-ai no request goes to an /ai/ path (7.004ms)
✔ S9: --with-ai and fighter 6 bout already has a saved suggestion: no POST to /ai/ (8.0042ms)
✔ S9 (control): --with-ai and no saved suggestion: exactly one POST /ai/tactics (4.7159ms)
✔ S10: fighter 4 blocked sessions sit inside the suspension, are created first, and conflicts/apply is never called (4.1993ms)
✔ S12: lần 1 chạy không --with-ai (trận võ sĩ 6 tới COMPLETED); lần 2 chạy với --with-ai → không có request /ai/, stderr có cảnh báo AI bị bỏ qua, exit 0 (6.129ms)
✔ S13: --with-ai, API giả có sẵn một gợi ý status 'FAILED' cho trận võ sĩ 6 còn mở (chưa COMPLETED) → CÓ gọi POST .../ai/... (4.2244ms)
✔ S14: --with-ai, API giả có sẵn gợi ý status 'OK' → không gọi /ai/ (giống S9, giữ S9) (4.1166ms)
ℹ tests 14
ℹ suites 0
ℹ pass 14
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
```

`DEMO_SEED_API_URL=http://127.0.0.1:9 DEMO_SEED_ADMIN_EMAIL=admin@example.com DEMO_SEED_ADMIN_PASSWORD=fake-password DEMO_SEED_USER_PASSWORD=fake-password node nestjs-api/scripts/demo-seed.mjs --dry-run`

```text
POST /bouts/<f6.boutId>/fight-week [coach] f6
PUT /bouts/<f6.boutId>/opponent-analysis [coach] f6
POST /bouts/<f6.boutId>/weigh-in [coach] f6
PUT /bouts/<f6.boutId>/rounds/1 [coach] f6
PUT /bouts/<f6.boutId>/rounds/2 [coach] f6
POST /bouts/<f6.boutId>/result [coach] f6
created=120 existing=0
```

`pnpm --filter nestjs-api lint`

```text
$ oxlint src/ test/
…
src/medical/scat6.model.spec.ts:5:3: warning eslint(no-unused-vars): Identifier 'scat6ScoresSchema' is imported but never used. help: Consider removing this import.
```

`pnpm --filter nestjs-api build`

```text
$ nest build
```
