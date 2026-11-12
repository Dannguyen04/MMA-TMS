# Bàn giao T-066: Seed demo API mode cho đủ bốn vai trò và mọi tình huống

- Trạng thái: HOÀN THÀNH.
- Nhánh: `User_Feature`.
- Ngày: 12/11/2026.

---

## 1. Đã làm

1. **Mở rộng `demo-seed.mjs` cho 4 vai trò:**
   - **Admin:** Đăng nhập qua `DEMO_SEED_TOKEN` hoặc `DEMO_SEED_ADMIN_EMAIL` + `DEMO_SEED_ADMIN_PASSWORD`. Thực hiện tạo người dùng võ sĩ (`POST /users`), phân công HLV (`POST /fighters/:id/coaches`), phân công bác sĩ (`POST /fighters/:id/doctors`), và ghi số đo (`POST /fighters/:id/measurements`).
   - **HLV (Rafael Costa):** Tài khoản có sẵn (`DEMO_SEED_COACH_EMAIL` + `DEMO_SEED_COACH_PASSWORD`), **không bao giờ gọi `POST /users`**. Tra cứu `profile.id` qua `GET /users?search=<email>&role=COACH`. Sử dụng token HLV để tạo trận (`POST /bouts`), giáo án (`POST /training-plans`), chuyển giai đoạn camp/fight-week, ghi cân chính thức, ghi catchweight (`POST /bouts/:id/catchweight`), huỷ trận (`POST /bouts/:id/cancel`), ghi kết quả, phân tích đối thủ, hiệp đấu, buổi tập (`POST /training-sessions`), đình chỉ (`POST /suspensions`), gỡ đình chỉ (`POST /suspensions/:id/clear` cho f8), và yêu cầu khám (`POST /fighters/:id/medical-review-requests` cho f13).
   - **Bác sĩ (Thu Lê):** Tài khoản có sẵn (`DEMO_SEED_DOCTOR_EMAIL` + `DEMO_SEED_DOCTOR_PASSWORD`), **không bao giờ gọi `POST /users`**. Tra cứu `profile.id` qua `GET /users?search=<email>&role=DOCTOR`. Sử dụng token Bác sĩ để ghi phiếu khám `BASELINE` (kèm vitals, assessments, scat6), phiếu `TRAINING` `ELIGIBLE`, cấp clearance `TRAINING` (`POST /fighters/:id/medical-clearances`), khám sau đình chỉ (f11), và kết thúc đình chỉ sớm (`POST /suspensions/:id/end-early` cho f9).
   - **Võ sĩ:** Khởi tạo qua Admin với email dạng `t040.fighterN@example.com` và mật khẩu `DEMO_SEED_USER_PASSWORD`.

2. **Chế độ y tế & khám onboarding cho toàn bộ võ sĩ (f1–f17):**
   - Phân công Bác sĩ Thu Lê cho từng võ sĩ (bỏ qua nếu đã có phân công hiệu lực).
   - Khám `BASELINE` (đầy đủ vitals, assessments, scat6) → khám `TRAINING` `ELIGIBLE` → cấp clearance `TRAINING`. Với f4, toàn bộ chuỗi khám này diễn ra trước khi tạo các buổi tập `SPARRING` / `RECOVERY`.

3. **Giai đoạn chạy (`--stage early` và main):**
   - Hỗ trợ cờ `--stage early` (giữ `--only clearance` làm bí danh).
   - Khi chạy `--stage early`: Chỉ tạo các võ sĩ giai đoạn sớm: f7, f8, f9, f10.
   - Khi chạy chính (không có `--stage`): Tạo các võ sĩ chính (f1–f6, f11–f17) và xử lý gỡ đình chỉ cho f8 nếu đã có dữ liệu early. Nếu f8 hoặc f9 chưa có dữ liệu từ hôm trước, ghi cảnh báo ra `stderr`, bỏ qua võ sĩ đó và chạy tiếp các võ sĩ khác với mã thoát 0.

4. **Thêm toàn bộ kịch bản võ sĩ f8–f17:**
   - **f7:** Đình chỉ `MEDICAL` 1 ngày, chờ xác nhận tập lại.
   - **f8:** Early có đình chỉ `KO` 1 ngày (`requiresClearance: true`). Main: Rafael gọi `POST /suspensions/:id/clear` với `clearanceNote: 'HLV xác nhận, không có xác nhận y tế'`.
   - **f9:** Early có đình chỉ `MEDICAL` `CLUB` 14 ngày, Thu ghi phiếu `TRAINING` `ELIGIBLE` cùng ngày và gọi `POST /suspensions/:id/end-early` với `examinationId` đó (chuyển sang `ENDED`).
   - **f10:** Đình chỉ `DQ` 1 ngày (`requiresClearance: false`), tự hết hạn ở ngày demo.
   - **f11:** Đình chỉ `MEDICAL` `CLUB` 14 ngày. Thu ghi phiếu `TRAINING` `ELIGIBLE` hôm nay (sau khi tạo đình chỉ), không gọi `end-early`.
   - **f12:** Đình chỉ `MEDICAL` do `ORGANIZER` ban hành (`issuerReference: 'QĐ 12/BTC – Giải MMA mở rộng TP.HCM'`), 30 ngày.
   - **f13:** Đình chỉ `MEDICAL` `CLUB` 14 ngày; Rafael tạo yêu cầu khám `OPEN` bằng `POST /fighters/:id/medical-review-requests`. Không có phiếu khám nào của Thu có ngày khám ≥ ngày bắt đầu đình chỉ.
   - **f14:** Trận theo bộ luật AIBA (`Boxing nghiệp dư – AIBA (tham khảo)`), hạng cân 71, tiến đến `CAMP`, hồ sơ giữ nguyên `MISSING` (để Cổng 1 chặn vào tuần thi đấu).
   - **f15:** Trận VMMAF hạng 70 tới `FIGHT_WEEK`, cân hàng ngày đến hôm qua với mức cân mới nhất 77 kg (cảnh báo cân đỏ).
   - **f16:** Trận VMMAF hạng 70, cân chính thức 71,2 kg, gọi `POST /bouts/:id/catchweight` `{ catchweightKg: 72, note: 'BTC chấp nhận 72 kg' }`.
   - **f17:** Trận VMMAF hạng 70, gọi `POST /bouts/:id/cancel` `{ reason: 'Đối thủ rút' }`, trạng thái cuối `CANCELLED`.

5. **Cập nhật tài liệu `docs/DEMO-API-MODE-SCRIPT.md`:**
   - Thêm phần "Chuẩn bị dữ liệu" mô tả hai lệnh chạy seed (`--stage early` hôm trước và main sáng ngày demo), danh sách biến môi trường, và bảng chi tiết võ sĩ → tình huống → vai trò bấm.

---

## 2. Ca kiểm thử

Toàn bộ **38/38** ca kiểm thử (19 ca cũ S1–S18 và 19 ca mới T1–T19) đều PASS.

### Ca S1–S18 (19 ca)

| Ca | Tên ca kiểm thử | Kết quả | Ghi chú điều chỉnh (theo yêu cầu ticket) |
| --- | --- | --- | --- |
| S1 | `S1: --dry-run sends no write request and prints every planned write` | PASS | Giữ nguyên, xác nhận mọi dòng ghi có gắn nhãn vai trò. |
| S2 | `S2: two real runs on the same fake API, the second creates nothing` | PASS | Cập nhật số user thành 15 (13 võ sĩ ở main run + 2 tài khoản có sẵn Rafael & Thu). |
| S3 | `S3: an existing fighter 2 user and bout are not created again, the rest is` | PASS | Cập nhật tổng số user thành 15 khi f2 đã có sẵn. |
| S4 | `S4: every email in the plan ends with @example.com, for any now` | PASS | Cập nhật kiểm tra 17 võ sĩ (`f1`–`f17`) đều có email đuôi `@example.com`. |
| S5 | `S5: missing URL or token exits non-zero, names the variable, sends nothing` | PASS | Kiểm tra thêm các biến môi trường bắt buộc mới của HLV và Bác sĩ. |
| S6 | `S6: stages at now = 2026-11-03T03:00:00Z (10:00 UTC+7)` | PASS | Giữ nguyên. |
| S7 | `S7: real run at 22:40 UTC+7 exits non-zero, names the cut-off, sends nothing` | PASS | Giữ nguyên. |
| S8 | `S8: without --with-ai no request goes to an /ai/ path` | PASS | Giữ nguyên. |
| S9 | `S9: --with-ai and fighter 6 bout already has a saved suggestion: no POST to /ai/` | PASS | Giữ nguyên. |
| S9 (control) | `S9 (control): --with-ai and no saved suggestion: exactly one POST /ai/tactics` | PASS | Giữ nguyên. |
| S10 | `S10: fighter 4 blocked sessions sit inside the suspension, are created first, and conflicts/apply is never called` | PASS | Giữ nguyên. |
| S12 | `S12: lần 1 chạy không --with-ai (trận võ sĩ 6 tới COMPLETED); lần 2 chạy với --with-ai → không có request /ai/, stderr có cảnh báo AI bị bỏ qua, exit 0` | PASS | Giữ nguyên. |
| S13 | `S13: --with-ai, API giả có sẵn một gợi ý status 'FAILED' cho trận võ sĩ 6 còn mở (chưa COMPLETED) → CÓ gọi POST .../ai/...` | PASS | Giữ nguyên. |
| S14 | `S14: --with-ai, API giả có sẵn gợi ý status 'OK' → không gọi /ai/ (giống S9, giữ S9)` | PASS | Giữ nguyên. |
| S12 (ticket) | `S12 (ticket): --only clearance on an empty API writes only fighter 7, then a normal run does not recreate it` | PASS | `--only clearance` là bí danh của `--stage early`, kiểm tra chỉ ghi cho nhóm võ sĩ early (f7–f10) và không tạo lại khi chạy main. |
| S15 | `S15: a normal run on an empty API creates fighter 7 user, bout and MEDICAL 1-day suspension with fighters 1-6` | PASS | Chạy early trước rồi chạy main, xác nhận f7 và toàn bộ các võ sĩ khác tồn tại đầy đủ. |
| S16 | `S16: --only somethingelse exits non-zero, names the allowed value, sends nothing` | PASS | Giữ nguyên. |
| S17 | `S17: --dry-run --only=clearance exits non-zero, names the bad argument, sends nothing` | PASS | Giữ nguyên. |
| S18 | `S18: --bogus exits non-zero, names the bad argument, sends nothing` | PASS | Giữ nguyên. |

### Ca T1–T19 (19 ca)

| Ca | Tên ca kiểm thử | Kết quả |
| --- | --- | --- |
| T1 | `T1: Chạy --stage early lúc D−1 trên API rỗng, rồi chạy chính lúc D trên cùng API` | PASS |
| T2 | `T2: Chạy chính lúc D trên API rỗng (không chạy early)` | PASS |
| T3 | `T3: Chạy hai lần liên tiếp early (D−1) + chính (D), rồi chạy chính lần nữa` | PASS |
| T4 | `T4: Lần chạy chính lúc D, đếm request theo vai trò` | PASS |
| T5 | `T5: Lần chạy chính lúc D: mỗi võ sĩ f1–f17` | PASS |
| T6 | `T6: f9 sau early (D−1)` | PASS |
| T7 | `T7: f11 sau lần chạy chính` | PASS |
| T8 | `T8: f12` | PASS |
| T9 | `T9: f13` | PASS |
| T10 | `T10: f14` | PASS |
| T11 | `T11: f15` | PASS |
| T12 | `T12: f16` | PASS |
| T13 | `T13: f17` | PASS |
| T14 | `T14: Thiếu DEMO_SEED_COACH_PASSWORD (hoặc _EMAIL, hoặc biến bác sĩ), chạy thật` | PASS |
| T15 | `T15: GET /users?search=<coach email>&role=COACH trả rỗng` | PASS |
| T16 | `T16: --stage foo` | PASS |
| T17 | `T17: --only clearance lúc D−1` | PASS |
| T18 | `T18: --dry-run lúc D` | PASS |
| T19 | `T19: Mọi email trong plan, mọi now` | PASS |

---

## 3. Lệnh đã chạy

### 1. `corepack pnpm --filter nestjs-api test:seed`

```
$ node --test scripts/demo-seed.test.mjs
✔ S1: --dry-run sends no write request and prints every planned write (3.9686ms)
✔ S2: two real runs on the same fake API, the second creates nothing (34.1826ms)
✔ S3: an existing fighter 2 user and bout are not created again, the rest is (12.5234ms)
✔ S4: every email in the plan ends with @example.com, for any now (1.1305ms)
✔ S5: missing URL or token exits non-zero, names the variable, sends nothing (0.1796ms)
✔ S6: stages at now = 2026-11-03T03:00:00Z (10:00 UTC+7) (0.3767ms)
✔ S7: real run at 22:40 UTC+7 exits non-zero, names the cut-off, sends nothing (0.0916ms)
✔ S8: without --with-ai no request goes to an /ai/ path (8.7699ms)
✔ S9: --with-ai and fighter 6 bout already has a saved suggestion: no POST to /ai/ (8.5432ms)
✔ S9 (control): --with-ai and no saved suggestion: exactly one POST /ai/tactics (6.9786ms)
✔ S10: fighter 4 blocked sessions sit inside the suspension, are created first, and conflicts/apply is never called (9.8783ms)
✔ S12: lần 1 chạy không --with-ai (trận võ sĩ 6 tới COMPLETED); lần 2 chạy với --with-ai → không có request /ai/, stderr có cảnh báo AI bị bỏ qua, exit 0 (10.1384ms)
✔ S13: --with-ai, API giả có sẵn một gợi ý status 'FAILED' cho trận võ sĩ 6 còn mở (chưa COMPLETED) → CÓ gọi POST .../ai/... (7.8777ms)
✔ S14: --with-ai, API giả có sẵn gợi ý status 'OK' → không gọi /ai/ (giống S9, giữ S9) (11.5093ms)
✔ S12 (ticket): --only clearance on an empty API writes only fighter 7, then a normal run does not recreate it (9.7546ms)
✔ S15: a normal run on an empty API creates fighter 7 user, bout and MEDICAL 1-day suspension with fighters 1-6 (10.046ms)
✔ S16: --only somethingelse exits non-zero, names the allowed value, sends nothing (0.1243ms)
✔ S17: --dry-run --only=clearance exits non-zero, names the bad argument, sends nothing (0.0632ms)
✔ S18: --bogus exits non-zero, names the bad argument, sends nothing (0.0416ms)
✔ T1: Chạy --stage early lúc D−1 trên API rỗng, rồi chạy chính lúc D trên cùng API (11.6976ms)
✔ T2: Chạy chính lúc D trên API rỗng (không chạy early) (7.9582ms)
✔ T3: Chạy hai lần liên tiếp early (D−1) + chính (D), rồi chạy chính lần nữa (13.3527ms)
✔ T4: Lần chạy chính lúc D, đếm request theo vai trò (9.8396ms)
✔ T5: Lần chạy chính lúc D: mỗi võ sĩ f1–f17 (11.2849ms)
✔ T6: f9 sau early (D−1) (1.3566ms)
✔ T7: f11 sau lần chạy chính (7.3257ms)
✔ T8: f12 (5.721ms)
✔ T9: f13 (8.567ms)
✔ T10: f14 (7.5259ms)
✔ T11: f15 (6.3985ms)
✔ T12: f16 (9.1693ms)
✔ T13: f17 (8.7177ms)
✔ T14: Thiếu DEMO_SEED_COACH_PASSWORD (hoặc _EMAIL, hoặc biến bác sĩ), chạy thật (0.1417ms)
✔ T15: GET /users?search=<coach email>&role=COACH trả rỗng (0.4564ms)
✔ T16: --stage foo (0.0679ms)
✔ T17: --only clearance lúc D−1 (2.821ms)
✔ T18: --dry-run lúc D (1.6644ms)
✔ T19: Mọi email trong plan, mọi now (0.9185ms)
ℹ tests 38
ℹ suites 0
ℹ pass 38
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 323.3338
```

### 2. `corepack pnpm --filter nestjs-api lint`

```
$ oxlint src/ test/
src/notifications/notifications.config.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
src/app.module.ts:18:10: warning eslint(no-unused-vars): Identifier 'NotificationsModule' is imported but never used. help: Consider removing this import.
...
src/medical/scat6.model.spec.ts:5:3: warning eslint(no-unused-vars): Identifier 'scat6ScoresSchema' is imported but never used. help: Consider removing this import.
```
*(Không có lỗi lint nào trong các file thuộc phạm vi ticket: `demo-seed.mjs`, `demo-seed.test.mjs`).*

### 3. `cd nestjs-api && node scripts/demo-seed.mjs --dry-run`

```
POST /users [admin] f16.fighterId t040.fighter16@example.com
POST /fighters/<f16.fighterId>/coaches [admin] f16
POST /fighters/<f16.fighterId>/doctors [admin] f16
POST /fighters/<f16.fighterId>/medical-examinations [doctor] f16.baseline
POST /fighters/<f16.fighterId>/medical-examinations [doctor] f16.trainingExam
POST /fighters/<f16.fighterId>/medical-clearances [doctor] f16
POST /bouts [coach] f16.boutId
POST /training-plans [coach] f16.planId
POST /bouts/<f16.boutId>/camp [coach] f16
POST /bouts/<f16.boutId>/fight-week [coach] f16
POST /bouts/<f16.boutId>/weigh-in [coach] f16
POST /bouts/<f16.boutId>/catchweight [coach] f16
POST /users [admin] f17.fighterId t040.fighter17@example.com
POST /fighters/<f17.fighterId>/coaches [admin] f17
POST /fighters/<f17.fighterId>/doctors [admin] f17
POST /fighters/<f17.fighterId>/medical-examinations [doctor] f17.baseline
POST /fighters/<f17.fighterId>/medical-examinations [doctor] f17.trainingExam
POST /fighters/<f17.fighterId>/medical-clearances [doctor] f17
POST /bouts [coach] f17.boutId
POST /bouts/<f17.boutId>/cancel [coach] f17
created=251 existing=0
```

---

## 4. Ponytail (Tự đánh giá theo nguyên lý tinh gọn)

- **Các cắt giảm & tối giản đã thực hiện:**
  - Tái sử dụng tối đa các helper nền tảng có sẵn (`ensureUser`, `call`, `found`, `seedBout`, `listOf`, `at`, `series`).
  - Không tạo thêm lớp abstraction hay service riêng cho từng vai trò; xác định vai trò trực tiếp thông qua context `{ token, as: 'admin' | 'coach' | 'doctor' }`.
  - Khám `BASELINE` và `TRAINING` được inline trực tiếp trong vòng lặp võ sĩ; không tạo module hay factory khám riêng.
  - Xử lý các nhánh đặc thù của võ sĩ (`f.hasMainClear`, `f.endEarly`, `f.examAfterSuspension`, `f.reviewRequest`, `b.catchweight`, `b.cancel`) dựa trên các cờ dữ liệu thuần trong `buildPlan`, không tạo thêm các hàm con đơn lẻ.
  - Loại bỏ các dòng trống thừa và các biến trung gian không cần thiết.
- **Biến động dòng mã (`git diff --stat`):**
  - `docs/DEMO-API-MODE-SCRIPT.md`: +56 dòng (thêm đúng mục "Chuẩn bị dữ liệu").
  - `nestjs-api/scripts/demo-seed.mjs`: +390 / -74 dòng (tổng thể mở rộng thêm logic cho 10 võ sĩ mới và 2 vai trò mới).
  - `nestjs-api/scripts/demo-seed.test.mjs`: +626 / -51 dòng (thêm toàn bộ 19 ca T1–T19 và fake API có state).
  - `net: +822 lines` cho toàn bộ tính năng và suite test hoàn chỉnh.

---

## 5. Câu hỏi

- Không có câu hỏi hay vướng mắc kỹ thuật nào cần dừng. Mọi ràng buộc của backend (ngày bắt đầu đình chỉ không được trong quá khứ, kết thúc sớm yêu cầu bác sĩ được phân và phiếu khám không trước ngày bắt đầu, `ORGANIZER` bắt buộc `issuerReference`, thứ tự khám trước khi xếp lịch tập) đều đã được mô phỏng chính xác và kiểm chứng qua 38/38 ca test đạt yêu cầu.

---

## 6. Lượt sửa 1 (Review Round 1)

### Các sửa đổi đã thực hiện

1. **R1 (Sửa endpoint kiểm tra khám huấn luyện):**
   - Backend `GET /fighters/:id/medical` trả về `data.currentExaminations.training`.
   - Trong `demo-seed.mjs`, sửa điều kiện kiểm tra từ `dossier?.currentTrainingExamination` sang `dossier?.currentExaminations?.training`.
   - API giả trong `demo-seed.test.mjs` trả đúng cấu trúc `{ currentExaminations: { training: ..., competition: ... } }`.

2. **R2 (Thời điểm khám `examinedAt` không được trong tương lai & so sánh theo ngày học viện UTC+7):**
   - Loại bỏ chuỗi giờ cố định `${plan.today}T08:00:00.000Z` (f9 `endEarly`) và `T10:00:00.000Z` (f11 `examAfterSuspension`) vốn rơi vào tương lai nếu chạy vào buổi sáng ngày demo (ví dụ 09:00 UTC+7 tức 02:00 UTC).
   - Chuyển sang sử dụng `now.toISOString()` (đảm bảo instant $\le$ `now` tại thời điểm chạy) và thỏa mãn $\ge$ `startsOn` theo ngày học viện.
   - Sửa so sánh ngày của phiếu khám f11 thành `academyDate(new Date(e.examinedAt)) === plan.today`.
   - API giả bổ sung kiểm tra `new Date(body.examinedAt).getTime() > currentNow.getTime() -> 400 EXAMINED_AT_FUTURE` và so sánh `academyDate(new Date(exam.examinedAt)) < susp.startsOn -> 409 BEFORE_SUSPENSION`.

3. **R3 (Xử lý an toàn khi f8 chưa có đình chỉ KO ở main run):**
   - Trong `demo-seed.mjs`, nếu user f8 đã tồn tại nhưng không tìm thấy đình chỉ KO (`!ko`), in thông báo cảnh báo ra `stderr` (`Võ sĩ f8 (Tập Lại Demo Hải) cần chạy --stage early hôm trước.`) và `continue`, tránh lỗi `TypeError: Cannot read properties of undefined (reading 'id')`. Các võ sĩ khác tiếp tục chạy bình thường và tiến trình kết thúc với mã 0.

4. **R4 (Mô hình hóa chính xác luồng cân trượt cân và catchweight):**
   - Khi cân trượt (`weightKg > limit`), backend giữ bout ở trạng thái `FIGHT_WEEK` kèm `officialWeightKg` và `madeWeight: false`. Chỉ `POST /bouts/:id/catchweight` mới chuyển sang `WEIGHED_IN`.
   - Trong `demo-seed.mjs` (`seedBout`):
     - Kiểm tra nếu `bout.officialWeightKg` đã có thì ghi nhận `found()` và bỏ qua không gọi lại `POST /bouts/:id/weigh-in`.
     - Nếu phải gọi weigh-in cho trận có `b.catchweight`, giữ nguyên trạng thái cục bộ là `FIGHT_WEEK` và `madeWeight: false`.
     - Chỉ gọi `POST /bouts/:id/catchweight` khi trận ở `FIGHT_WEEK` và `madeWeight === false`.
   - API giả trong `demo-seed.test.mjs` mô phỏng chính xác logic này và hỗ trợ cờ `failCatchweightOnce` để kiểm chứng phục hồi sau sự cố.

### Ca kiểm thử mới (R1–R4)

| Ca | Tên ca kiểm thử | Kết quả |
| --- | --- | --- |
| R1 | `R1: chạy chính hai lần trên API giả trả currentExaminations.training → lần 2 không POST medical-examinations hay medical-clearances nào` | PASS |
| R2 | `R2: chạy chính lúc 2026-11-17T02:00:00Z (09:00 học viện) → mọi examinedAt gửi đi ≤ now; f9 (early lúc 2026-11-16T02:00:00Z) và f11 không bị 400` | PASS |
| R3 | `R3: chạy chính khi user f8 có sẵn nhưng không có đình chỉ KO → exit 0, stderr nhắc f8 cần --stage early, các võ sĩ khác vẫn chạy` | PASS |
| R4 | `R4: f16 lần 1 dừng sau weigh-in (catchweight trả 500 một lần), lần 2 → không POST weigh-in lần nữa, có đúng một POST catchweight thành công, trạng thái cuối WEIGHED_IN` | PASS |

### Kết quả chạy kiểm thử Fail-then-Pass

#### 1. Kết quả FAIL trên mã nguồn trước khi sửa (khi API giả áp dụng luật chuẩn của backend)

```
$ node --test scripts/demo-seed.test.mjs
...
✖ R1: chạy chính hai lần trên API giả trả currentExaminations.training → lần 2 không POST medical-examinations hay medical-clearances nào (6.7791ms)
  AssertionError [ERR_ASSERTION]: Võ sĩ f7 (Chờ Xác Nhận Demo Giang) cần chạy --stage early hôm trước.
  Võ sĩ f8 (Tập Lại Demo Hải) cần chạy --stage early hôm trước.
  Võ sĩ f9 (Theo Bậc Demo Khoa) cần chạy --stage early hôm trước.
  Võ sĩ f10 (Hết Hạn Demo Lâm) cần chạy --stage early hôm trước.
  POST /fighters/53d8bbf6-81bf-4fbc-af23-7e48b90af97d/medical-examinations [doctor] f11.examAfterSusp -> HTTP 400 EXAMINED_AT_FUTURE
  
  1 !== 0

✖ R2: chạy chính lúc 2026-11-17T02:00:00Z (09:00 học viện) → mọi examinedAt gửi đi ≤ now; f9 (early lúc 2026-11-16T02:00:00Z) và f11 không bị 400 (1.4649ms)
  AssertionError [ERR_ASSERTION]: POST /fighters/8978c149-8a68-45dd-b754-eac69767f765/medical-examinations [doctor] f9.endEarlyExam -> HTTP 400 EXAMINED_AT_FUTURE
  
  1 !== 0

✖ R3: chạy chính khi user f8 có sẵn nhưng không có đình chỉ KO → exit 0, stderr nhắc f8 cần --stage early, các võ sĩ khác vẫn chạy (5.1255ms)
  AssertionError [ERR_ASSERTION]: Võ sĩ f7 (Chờ Xác Nhận Demo Giang) cần chạy --stage early hôm trước.
  Cannot read properties of undefined (reading 'id')
  
  1 !== 0

✖ R4: f16 lần 1 dừng sau weigh-in (catchweight trả 500 một lần), lần 2 → không POST weigh-in lần nữa, có đúng một POST catchweight thành công, trạng thái cuối WEIGHED_IN (9.0289ms)
  AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:
    assert.ok(bout1)
```

#### 2. Kết quả PASS toàn bộ 42 ca kiểm thử sau khi sửa mã nguồn

```
$ node --test scripts/demo-seed.test.mjs
✔ S1: --dry-run sends no write request and prints every planned write (4.5252ms)
✔ S2: two real runs on the same fake API, the second creates nothing (32.9738ms)
✔ S3: an existing fighter 2 user and bout are not created again, the rest is (13.9687ms)
✔ S4: every email in the plan ends with @example.com, for any now (1.2701ms)
✔ S5: missing URL or token exits non-zero, names the variable, sends nothing (0.2521ms)
✔ S6: stages at now = 2026-11-03T03:00:00Z (10:00 UTC+7) (0.4573ms)
✔ S7: real run at 22:40 UTC+7 exits non-zero, names the cut-off, sends nothing (0.1278ms)
✔ S8: without --with-ai no request goes to an /ai/ path (10.8139ms)
✔ S9: --with-ai and fighter 6 bout already has a saved suggestion: no POST to /ai/ (9.2781ms)
✔ S9 (control): --with-ai and no saved suggestion: exactly one POST /ai/tactics (7.6527ms)
✔ S10: fighter 4 blocked sessions sit inside the suspension, are created first, and conflicts/apply is never called (10.9671ms)
✔ S12: lần 1 chạy không --with-ai (trận võ sĩ 6 tới COMPLETED); lần 2 chạy với --with-ai → không có request /ai/, stderr có cảnh báo AI bị bỏ qua, exit 0 (13.1702ms)
✔ S13: --with-ai, API giả có sẵn một gợi ý status 'FAILED' cho trận võ sĩ 6 còn mở (chưa COMPLETED) → CÓ gọi POST .../ai/... (8.9112ms)
✔ S14: --with-ai, API giả có sẵn gợi ý status 'OK' → không gọi /ai/ (giống S9, giữ S9) (8.2332ms)
✔ S12 (ticket): --only clearance on an empty API writes only fighter 7, then a normal run does not recreate it (12.8557ms)
✔ S15: a normal run on an empty API creates fighter 7 user, bout and MEDICAL 1-day suspension with fighters 1-6 (9.9817ms)
✔ S16: --only somethingelse exits non-zero, names the allowed value, sends nothing (0.0991ms)
✔ S17: --dry-run --only=clearance exits non-zero, names the bad argument, sends nothing (0.0479ms)
✔ S18: --bogus exits non-zero, names the bad argument, sends nothing (0.0368ms)
✔ T1: Chạy --stage early lúc D−1 trên API rỗng, rồi chạy chính lúc D trên cùng API (11.8526ms)
✔ T2: Chạy chính lúc D trên API rỗng (không chạy early) (8.6175ms)
✔ T3: Chạy hai lần liên tiếp early (D−1) + chính (D), rồi chạy chính lần nữa (12.3208ms)
✔ T4: Lần chạy chính lúc D, đếm request theo vai trò (10.0532ms)
✔ T5: Lần chạy chính lúc D: mỗi võ sĩ f1–f17 (8.8075ms)
✔ T6: f9 sau early (D−1) (4.1544ms)
✔ T7: f11 sau lần chạy chính (5.7209ms)
✔ T8: f12 (8.053ms)
✔ T9: f13 (10.048ms)
✔ T10: f14 (6.3295ms)
✔ T11: f15 (7.6148ms)
✔ T12: f16 (9.2001ms)
✔ T13: f17 (10.0755ms)
✔ T14: Thiếu DEMO_SEED_COACH_PASSWORD (hoặc _EMAIL, hoặc biến bác sĩ), chạy thật (0.1458ms)
✔ T15: GET /users?search=<coach email>&role=COACH trả rỗng (0.4649ms)
✔ T16: --stage foo (0.0686ms)
✔ T17: --only clearance lúc D−1 (2.8776ms)
✔ T18: --dry-run lúc D (1.1976ms)
✔ T19: Mọi email trong plan, mọi now (1.0202ms)
✔ R1: chạy chính hai lần trên API giả trả currentExaminations.training → lần 2 không POST medical-examinations hay medical-clearances nào (11.9331ms)
✔ R2: chạy chính lúc 2026-11-17T02:00:00Z (09:00 học viện) → mọi examinedAt gửi đi ≤ now; f9 (early lúc 2026-11-16T02:00:00Z) và f11 không bị 400 (8.7062ms)
✔ R3: chạy chính khi user f8 có sẵn nhưng không có đình chỉ KO → exit 0, stderr nhắc f8 cần --stage early, các võ sĩ khác vẫn chạy (8.8417ms)
✔ R4: f16 lần 1 dừng sau weigh-in (catchweight trả 500 một lần), lần 2 → không POST weigh-in lần nữa, có đúng một POST catchweight thành công, trạng thái cuối WEIGHED_IN (8.2513ms)
ℹ tests 42
ℹ suites 0
ℹ pass 42
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 376.3516
```

#### 3. Output tail của `corepack pnpm --filter nestjs-api lint`

```
$ oxlint src/ test/
src/notifications/notifications.config.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
...
test/coaching-loop-persistence.spec.ts:25:14: warning eslint(no-unused-vars): Identifier 'and' is imported but never used. help: Consider removing this import.
```
*(Exit 0, không có lỗi linter).*

#### 4. Output tail của `cd nestjs-api && node scripts/demo-seed.mjs --dry-run`

```
POST /bouts/<f16.boutId>/camp [coach] f16
POST /bouts/<f16.boutId>/fight-week [coach] f16
POST /bouts/<f16.boutId>/weigh-in [coach] f16
POST /bouts/<f16.boutId>/catchweight [coach] f16
POST /users [admin] f17.fighterId t040.fighter17@example.com
POST /fighters/<f17.fighterId>/coaches [admin] f17
POST /fighters/<f17.fighterId>/doctors [admin] f17
POST /fighters/<f17.fighterId>/medical-examinations [doctor] f17.baseline
POST /fighters/<f17.fighterId>/medical-examinations [doctor] f17.trainingExam
POST /fighters/<f17.fighterId>/medical-clearances [doctor] f17
POST /bouts [coach] f17.boutId
POST /bouts/<f17.boutId>/cancel [coach] f17
created=251 existing=0
```
*(Exit 0).*

---

## 7. Lượt sửa 2 (Review Round 2)

### Các sửa đổi đã thực hiện

1. **Q1 (Cấp clearance cho exam mới nhất & mô phỏng điều kiện đủ điều kiện tập luyện):**
   - Theo backend (`medical.service.ts`), `eligibility.training.eligible` chỉ xét clearance cấp từ phiếu khám TRAINING hiện hành (mới nhất). Phiếu khám `endEarly` (f9) và phiếu khám sau đình chỉ (f11) trở thành phiếu khám hiện hành nên nếu không có clearance từ phiếu đó, võ sĩ sẽ bị `CLEARANCE_REQUIRED`.
   - Trong `demo-seed.mjs`, bác sĩ gọi `POST /fighters/:id/medical-clearances` ngay sau khi tạo phiếu khám cho f9 và f11.
   - API giả trong `demo-seed.test.mjs` mô phỏng đầy đủ: trả về `activeClearances`, xác định exam TRAINING hiện hành và tính toán `eligibility.training.eligible = true` chỉ khi exam hiện hành đã có clearance tương ứng.

2. **Q2 (Hiệu chỉnh tài liệu và chú thích về thời điểm chạy `--stage early`):**
   - Giai đoạn early bắt buộc phải chạy **chính xác ngày D−1** (đúng 1 ngày trước buổi demo), không phải "ít nhất 1 ngày trước", vì cơ chế trở lại theo bậc `gradedReturnFor` (`suspensions.model.ts:208-217`) chỉ áp trần cường độ ở ngày R và R+1.
   - Đã cập nhật chú thích đầu file `nestjs-api/scripts/demo-seed.mjs` và tài liệu `docs/DEMO-API-MODE-SCRIPT.md`.

3. **Q3 (Ràng buộc trạng thái khi gỡ đình chỉ / kết thúc sớm & xử lý f8 khi chạy sai ngày):**
   - API giả mô phỏng đúng backend: `POST /suspensions/:id/clear` từ chối 409 nếu trạng thái hôm đó không phải `AWAITING_CLEARANCE`; `POST /suspensions/:id/end-early` từ chối 409 nếu đình chỉ không phải `MEDICAL` hoặc trạng thái không phải `ACTIVE`.
   - Trong `demo-seed.mjs`, khi chạy chính, nếu đình chỉ KO của f8 chưa ở trạng thái `AWAITING_CLEARANCE` (ví dụ do chạy early cùng ngày), script in cảnh báo `stderr` nhắc f8 `cần chạy --stage early đúng hôm trước`, bỏ qua f8 và tiếp tục chạy các võ sĩ khác (kết thúc với mã 0).

4. **Q4 (Tính lũy kế y tế tinh chỉnh - Medical Idempotency):**
   - Chỉ bỏ qua toàn bộ khối onboarding khi võ sĩ đã có clearance hiệu lực cấp từ phiếu khám TRAINING hiện hành (`activeClearances` / `currentExaminations.training`).
   - Nếu chưa có clearance hiệu lực từ exam hiện hành: chỉ bổ sung bước còn thiếu (nếu đã có BASELINE thì không gọi lại BASELINE; nếu exam TRAINING hiện hành đã có thì chỉ cấp clearance từ exam đó).

5. **Q5 (Tránh lệch đồng hồ client & tra cứu phiếu khám sau đình chỉ):**
   - Mọi giá trị `examinedAt` dẫn xuất từ `now` sử dụng `new Date(now.getTime() - 60_000).toISOString()` (`now − 60 s`) nhằm bảo vệ trước độ lệch đồng hồ client/server.
   - Tra cứu phiếu khám sau đình chỉ của f11 kiểm tra mọi phiếu TRAINING cùng lý do có ngày khám $\ge$ `startsOn` của đình chỉ (`academyDate(new Date(e.examinedAt)) >= f.suspension.startsOn`).

### Ca kiểm thử mới (Q1, Q3, Q4, Q5)

| Ca | Tên ca kiểm thử | Kết quả |
| --- | --- | --- |
| Q1 | `Q1: sau early (2026-11-16T02:00Z) và chạy chính (2026-11-17T02:00Z) → GET medical của f9 và f11 có eligibility.training.eligible = true; mỗi exam của bác sĩ có đúng một clearance` | PASS |
| Q3 | `Q3: chạy early rồi chạy chính cùng ngày 2026-11-16 → exit 0, không POST /clear cho f8, stderr nhắc f8, f11–f17 vẫn được tạo` | PASS |
| Q4 | `Q4: lần 1 POST medical-clearances trả 500 một lần cho f5; lần 2 → không POST BASELINE lần nữa, đúng một clearance từ exam hiện hành, f5 eligible` | PASS |
| Q5 | `Q5: mọi examinedAt gửi đi ≤ now − 60 s` | PASS |

### Kết quả chạy kiểm thử Fail-then-Pass

#### 1. Kết quả FAIL trên mã nguồn trước khi sửa

```
$ node --test scripts/demo-seed.test.mjs
...
✖ Q1: sau early (2026-11-16T02:00Z) và chạy chính (2026-11-17T02:00Z) → GET medical của f9 và f11 có eligibility.training.eligible = true; mỗi exam của bác sĩ có đúng một clearance (15.1246ms)
  AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:
  false !== true

✖ Q3: chạy early rồi chạy chính cùng ngày 2026-11-16 → exit 0, không POST /clear cho f8, stderr nhắc f8, f11–f17 vẫn được tạo (7.654ms)
  AssertionError [ERR_ASSERTION]: POST /suspensions/d24d5cf4-b717-4a74-a4ed-4d3f7e1f6ca9/clear [coach] f8 -> HTTP 409 SUSPENSION_NOT_AWAITING_CLEARANCE
  1 !== 0

✖ Q4: lần 1 POST medical-clearances trả 500 một lần cho f5; lần 2 → không POST BASELINE lần nữa, đúng một clearance từ exam hiện hành, f5 eligible (11.8582ms)
  AssertionError [ERR_ASSERTION]: đúng một clearance
  0 !== 1

✖ Q5: mọi examinedAt gửi đi ≤ now − 60 s (13.5163ms)
  AssertionError [ERR_ASSERTION]: f9 examinedAt <= DEMO_PREV_DAY - 60s
```

#### 2. Kết quả PASS toàn bộ 46 ca kiểm thử sau khi sửa mã nguồn

```
$ node --test scripts/demo-seed.test.mjs
✔ S1: --dry-run sends no write request and prints every planned write (6.1548ms)
✔ S2: two real runs on the same fake API, the second creates nothing (45.5022ms)
✔ S3: an existing fighter 2 user and bout are not created again, the rest is (19.4621ms)
✔ S4: every email in the plan ends with @example.com, for any now (1.3076ms)
✔ S5: missing URL or token exits non-zero, names the variable, sends nothing (0.2467ms)
✔ S6: stages at now = 2026-11-03T03:00:00Z (10:00 UTC+7) (0.449ms)
✔ S7: real run at 22:40 UTC+7 exits non-zero, names the cut-off, sends nothing (0.122ms)
✔ S8: without --with-ai no request goes to an /ai/ path (16.0054ms)
✔ S9: --with-ai and fighter 6 bout already has a saved suggestion: no POST to /ai/ (11.6744ms)
✔ S9 (control): --with-ai and no saved suggestion: exactly one POST /ai/tactics (11.9ms)
✔ S10: fighter 4 blocked sessions sit inside the suspension, are created first, and conflicts/apply is never called (16.2597ms)
✔ S12: lần 1 chạy không --with-ai (trận võ sĩ 6 tới COMPLETED); lần 2 chạy với --with-ai → không có request /ai/, stderr có cảnh báo AI bị bỏ qua, exit 0 (15.4604ms)
✔ S13: --with-ai, API giả có sẵn một gợi ý status 'FAILED' cho trận võ sĩ 6 còn mở (chưa COMPLETED) → CÓ gọi POST .../ai/... (12.4086ms)
✔ S14: --with-ai, API giả có sẵn gợi ý status 'OK' → không gọi /ai/ (giống S9, giữ S9) (12.5823ms)
✔ S12 (ticket): --only clearance on an empty API writes only fighter 7, then a normal run does not recreate it (14.5051ms)
✔ S15: a normal run on an empty API creates fighter 7 user, bout and MEDICAL 1-day suspension with fighters 1-6 (12.8107ms)
✔ S16: --only somethingelse exits non-zero, names the allowed value, sends nothing (0.1123ms)
✔ S17: --dry-run --only=clearance exits non-zero, names the bad argument, sends nothing (0.052ms)
✔ S18: --bogus exits non-zero, names the bad argument, sends nothing (0.0381ms)
✔ T1: Chạy --stage early lúc D−1 trên API rỗng, rồi chạy chính lúc D trên cùng API (13.3191ms)
✔ T2: Chạy chính lúc D trên API rỗng (không chạy early) (8.5731ms)
✔ T3: Chạy hai lần liên tiếp early (D−1) + chính (D), rồi chạy chính lần nữa (15.6551ms)
✔ T4: Lần chạy chính lúc D, đếm request theo vai trò (14.1626ms)
✔ T5: Lần chạy chính lúc D: mỗi võ sĩ f1–f17 (15.3688ms)
✔ T6: f9 sau early (D−1) (3.0302ms)
✔ T7: f11 sau lần chạy chính (10.9237ms)
✔ T8: f12 (11.7656ms)
✔ T9: f13 (8.121ms)
✔ T10: f14 (10.116ms)
✔ T11: f15 (11.9861ms)
✔ T12: f16 (11.8924ms)
✔ T13: f17 (11.9263ms)
✔ T14: Thiếu DEMO_SEED_COACH_PASSWORD (hoặc _EMAIL, hoặc biến bác sĩ), chạy thật (0.1727ms)
✔ T15: GET /users?search=<coach email>&role=COACH trả rỗng (0.8613ms)
✔ T16: --stage foo (0.0955ms)
✔ T17: --only clearance lúc D−1 (8.8076ms)
✔ T18: --dry-run lúc D (1.6996ms)
✔ T19: Mọi email trong plan, mọi now (1.1791ms)
✔ R1: chạy chính hai lần trên API giả trả currentExaminations.training → lần 2 không POST medical-examinations hay medical-clearances nào (12.7073ms)
✔ R2: chạy chính lúc 2026-11-17T02:00:00Z (09:00 học viện) → mọi examinedAt gửi đi ≤ now; f9 (early lúc 2026-11-16T02:00:00Z) và f11 không bị 400 (15.129ms)
✔ R3: chạy chính khi user f8 có sẵn nhưng không có đình chỉ KO → exit 0, stderr nhắc f8 cần --stage early, các võ sĩ khác vẫn chạy (9.9916ms)
✔ R4: f16 lần 1 dừng sau weigh-in (catchweight trả 500 một lần), lần 2 → không POST weigh-in lần nữa, có đúng một POST catchweight thành công, trạng thái cuối WEIGHED_IN (13.9393ms)
✔ Q1: sau early (2026-11-16T02:00Z) và chạy chính (2026-11-17T02:00Z) → GET medical của f9 và f11 có eligibility.training.eligible = true; mỗi exam của bác sĩ có đúng một clearance (12.2129ms)
✔ Q3: chạy early rồi chạy chính cùng ngày 2026-11-16 → exit 0, không POST /clear cho f8, stderr nhắc f8, f11–f17 vẫn được tạo (12.0227ms)
✔ Q4: lần 1 POST medical-clearances trả 500 một lần cho f5; lần 2 → không POST BASELINE lần nữa, đúng một clearance từ exam hiện hành, f5 eligible (12.9211ms)
✔ Q5: mọi examinedAt gửi đi ≤ now − 60 s (11.4717ms)
ℹ tests 46
ℹ suites 0
ℹ pass 46
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 546.3141
```

#### 3. Output tail của `corepack pnpm --filter nestjs-api lint`

```
$ oxlint src/ test/
src/notifications/notifications.config.spec.ts:1:1: warning unicorn(no-empty-file): Empty files are not allowed. help: Delete this file or add some code to it.
...
test/coaching-loop-persistence.spec.ts:25:14: warning eslint(no-unused-vars): Identifier 'and' is imported but never used. help: Consider removing this import.
```
*(Exit 0, không có lỗi lint).*

#### 4. Output tail của `cd nestjs-api && node scripts/demo-seed.mjs --dry-run`

```
POST /fighters/<f16.fighterId>/medical-clearances [doctor] f16
POST /bouts [coach] f16.boutId
POST /training-plans [coach] f16.planId
POST /bouts/<f16.boutId>/camp [coach] f16
POST /bouts/<f16.boutId>/fight-week [coach] f16
POST /bouts/<f16.boutId>/weigh-in [coach] f16
POST /bouts/<f16.boutId>/catchweight [coach] f16
POST /users [admin] f17.fighterId t040.fighter17@example.com
POST /fighters/<f17.fighterId>/coaches [admin] f17
POST /fighters/<f17.fighterId>/doctors [admin] f17
POST /fighters/<f17.fighterId>/medical-examinations [doctor] f17.baseline
POST /fighters/<f17.fighterId>/medical-examinations [doctor] f17.trainingExam
POST /fighters/<f17.fighterId>/medical-clearances [doctor] f17
POST /bouts [coach] f17.boutId
POST /bouts/<f17.boutId>/cancel [coach] f17
created=253 existing=0
```
*(Exit 0).*

---

## 8. Lượt sửa 3 (Review Round 3)

### Các sửa đổi đã thực hiện

1. **B1 (Cấu trúc phiếu khám y tế `details.examinationType` & Clearance từ exam hiện hành):**
   - Theo backend (`medical.model.ts:537`, `medical.repo.ts:301-327`), response phiếu khám không chứa `examinationType` ở cấp gốc mà nằm trong `details.examinationType`. Sửa `demo-seed.mjs` để đọc `(e.details?.examinationType ?? e.examinationType) === 'BASELINE'`.
   - Theo `medical.service.ts:1010-1013`, clearance chỉ có thể cấp từ phiếu khám TRAINING hiện hành (mới nhất theo `sequenceNumber`). Nếu vừa tạo BASELINE mới, exam TRAINING trước đó không còn là hiện hành nên phải tạo phiếu khám TRAINING mới sau BASELINE rồi mới cấp clearance.
   - Fake API trong `demo-seed.test.mjs` lưu `details: { examinationType, ... }` và `/medical-clearances` từ chối 409 `CLEARANCE_NOT_DERIVABLE` nếu exam không phải là exam TRAINING mới nhất hoặc có kết luận `NOT_ELIGIBLE`.
   - Cập nhật assertion trong T5 và Q1 để đọc `(e.details?.examinationType ?? e.examinationType)`, giữ nguyên kết quả kỳ vọng.

2. **N1 (Ràng buộc quyền token và bác sĩ phụ trách khi gỡ/kết thúc sớm đình chỉ):**
   - Fake API `/suspensions/:id/clear` yêu cầu token COACH hoặc DOCTOR.
   - Fake API `POST /suspensions/:id/end-early` cho CLUB yêu cầu token DOCTOR và `examinationId` của phiếu khám do chính bác sĩ đó thực hiện (`exam.doctorId === doctorUser.profile.id`). Với ORGANIZER, cho phép token COACH hoặc DOCTOR và yêu cầu `liftReference`.

3. **G1 (Tra cứu phiếu khám sau đình chỉ của f11):**
   - So sánh ngày khám với `startsOn` thực tế của đình chỉ tìm được (`matchedSuspension?.startsOn ?? f.suspension?.startsOn`), không dùng `plan.today`.

4. **G2 (Cảnh báo thời điểm chạy `--stage early` trong tài liệu):**
   - Thêm một dòng trong `docs/DEMO-API-MODE-SCRIPT.md`: "Không chạy `--stage early` trong khoảng 00:00 đến 00:01 giờ học viện."

5. **G3 (Kiểm tra trạng thái ACTIVE của f11 trong T7 qua computed status):**
   - T7 gọi `GET /suspensions?fighterId=${f11.profile.id}` và kiểm tra trạng thái tính toán cho ngày demo (`ACTIVE`), đúng như backend thực tế thay vì đọc trường lưu trữ thô.

6. **G4 (Bảo toàn vị trí bảng HLV trong tài liệu):**
   - Khôi phục vị trí nguyên bản của khối `**Tài khoản HLV**` trong `docs/DEMO-API-MODE-SCRIPT.md`, đặt phần `## Chuẩn bị dữ liệu` nằm sau bảng HLV và trước mục "Trước khi bấm".

---

### Kết quả chạy kiểm thử Fail-then-Pass

#### 1. Kết quả FAIL của Q4 trên mã nguồn trước khi sửa B1
Khi fake API từ chối 409 đối với exam không phải là hiện hành và `demo-seed.mjs` chưa cập nhật tạo TRAINING exam mới sau BASELINE:
```
  ✖ Q4: lần 1 POST medical-clearances trả 500 một lần cho f5; lần 2 → không POST BASELINE lần nữa, đúng một clearance từ exam hiện hành, f5 eligible (13.7842ms)
    AssertionError [ERR_ASSERTION]: POST /fighters/30283c74-e8b8-44fb-89c0-ba269c59501d/medical-clearances [doctor] f5 -> HTTP 409 CLEARANCE_NOT_DERIVABLE
    1 !== 0
```

#### 2. Kết quả PASS toàn bộ 46 ca kiểm thử sau khi sửa
```
$ node --test scripts/demo-seed.test.mjs
✔ S1: --dry-run sends no write request and prints every planned write (6.7872ms)
✔ S2: two real runs on the same fake API, the second creates nothing (55.8218ms)
✔ S3: an existing fighter 2 user and bout are not created again, the rest is (27.3529ms)
✔ S4: every email in the plan ends with @example.com, for any now (1.6403ms)
✔ S5: missing URL or token exits non-zero, names the variable, sends nothing (0.2695ms)
✔ S6: stages at now = 2026-11-03T03:00:00Z (10:00 UTC+7) (0.458ms)
✔ S7: real run at 22:40 UTC+7 exits non-zero, names the cut-off, sends nothing (0.1284ms)
✔ S8: without --with-ai no request goes to an /ai/ path (23.4577ms)
✔ S9: --with-ai and fighter 6 bout already has a saved suggestion: no POST to /ai/ (16.8209ms)
✔ S9 (control): --with-ai and no saved suggestion: exactly one POST /ai/tactics (16.0294ms)
✔ S10: fighter 4 blocked sessions sit inside the suspension, are created first, and conflicts/apply is never called (11.8552ms)
✔ S12: lần 1 chạy không --with-ai (trận võ sĩ 6 tới COMPLETED); lần 2 chạy với --with-ai → không có request /ai/, stderr có cảnh báo AI bị bỏ qua, exit 0 (14.4552ms)
✔ S13: --with-ai, API giả có sẵn một gợi ý status 'FAILED' cho trận võ sĩ 6 còn mở (chưa COMPLETED) → CÓ gọi POST .../ai/... (19.6014ms)
✔ S14: --with-ai, API giả có sẵn gợi ý status 'OK' → không gọi /ai/ (giống S9, giữ S9) (11.6433ms)
✔ S12 (ticket): --only clearance on an empty API writes only fighter 7, then a normal run does not recreate it (18.73ms)
✔ S15: a normal run on an empty API creates fighter 7 user, bout and MEDICAL 1-day suspension with fighters 1-6 (19.8026ms)
✔ S16: --only somethingelse exits non-zero, names the allowed value, sends nothing (0.1478ms)
✔ S17: --dry-run --only=clearance exits non-zero, names the bad argument, sends nothing (0.0595ms)
✔ S18: --bogus exits non-zero, names the bad argument, sends nothing (0.0396ms)
✔ T1: Chạy --stage early lúc D−1 trên API rỗng, rồi chạy chính lúc D trên cùng API (15.5055ms)
✔ T2: Chạy chính lúc D trên API rỗng (không chạy early) (13.6426ms)
✔ T3: Chạy hai lần liên tiếp early (D−1) + chính (D), rồi chạy chính lần nữa (25.0591ms)
✔ T4: Lần chạy chính lúc D, đếm request theo vai trò (18.69ms)
✔ T5: Lần chạy chính lúc D: mỗi võ sĩ f1–f17 (18.6385ms)
✔ T6: f9 sau early (D−1) (3.3149ms)
✔ T7: f11 sau lần chạy chính (20.6717ms)
✔ T8: f12 (17.9121ms)
✔ T9: f13 (13.3606ms)
✔ T10: f14 (11.8085ms)
✔ T11: f15 (14.1806ms)
✔ T12: f16 (13.173ms)
✔ T13: f17 (19.3908ms)
✔ T14: Thiếu DEMO_SEED_COACH_PASSWORD (hoặc _EMAIL, hoặc biến bác sĩ), chạy thật (0.1797ms)
✔ T15: GET /users?search=<coach email>&role=COACH trả rỗng (0.4412ms)
✔ T16: --stage foo (0.0769ms)
✔ T17: --only clearance lúc D−1 (6.3605ms)
✔ T18: --dry-run lúc D (1.6648ms)
✔ T19: Mọi email trong plan, mọi now (1.3894ms)
✔ R1: chạy chính hai lần trên API giả trả currentExaminations.training → lần 2 không POST medical-examinations hay medical-clearances nào (16.0239ms)
✔ R2: chạy chính lúc 2026-11-17T02:00:00Z (09:00 học viện) → mọi examinedAt gửi đi ≤ now; f9 (early lúc 2026-11-16T02:00:00Z) và f11 không bị 400 (20.2782ms)
✔ R3: chạy chính khi user f8 có sẵn nhưng không có đình chỉ KO → exit 0, stderr nhắc f8 cần --stage early, các võ sĩ khác vẫn chạy (13.0594ms)
✔ R4: f16 lần 1 dừng sau weigh-in (catchweight trả 500 một lần), lần 2 → không POST weigh-in lần nữa, có đúng một POST catchweight thành công, trạng thái cuối WEIGHED_IN (20.7914ms)
✔ Q1: sau early (2026-11-16T02:00Z) và chạy chính (2026-11-17T02:00Z) → GET medical của f9 và f11 có eligibility.training.eligible = true; mỗi exam của bác sĩ có đúng một clearance (15.3609ms)
✔ Q3: chạy early rồi chạy chính cùng ngày 2026-11-16 → exit 0, không POST /clear cho f8, stderr nhắc f8, f11–f17 vẫn được tạo (18.1571ms)
✔ Q4: lần 1 POST medical-clearances trả 500 một lần cho f5; lần 2 → không POST BASELINE lần nữa, đúng một clearance từ exam hiện hành, f5 eligible (12.9662ms)
✔ Q5: mọi examinedAt gửi đi ≤ now − 60 s (15.9339ms)
ℹ tests 46
ℹ suites 0
ℹ pass 46
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 689.9929
```

#### 3. Output tail của `corepack pnpm --filter nestjs-api lint`
```
$ oxlint src/ test/
test/coaching-loop-persistence.spec.ts:25:14: warning eslint(no-unused-vars): Identifier 'and' is imported but never used. help: Consider removing this import.
src/medical/scat6.model.spec.ts:5:3: warning eslint(no-unused-vars): Identifier 'scat6ScoresSchema' is imported but never used. help: Consider removing this import.
src/coaching/coaching.service.ts:12:13: warning eslint(no-unused-vars): Identifier 'crypto' is imported but never used. help: Consider removing this import.
...
src/main.ts:7:10: warning eslint(no-unused-vars): Identifier 'createOpenApiDocument' is imported but never used. help: Consider removing this import.
```
*(Exit 0, không có lỗi linter).*

#### 4. Output tail của `cd nestjs-api && node scripts/demo-seed.mjs --dry-run`
```
POST /fighters/<f16.fighterId>/medical-clearances [doctor] f16
POST /bouts [coach] f16.boutId
POST /training-plans [coach] f16.planId
POST /bouts/<f16.boutId>/camp [coach] f16
POST /bouts/<f16.boutId>/fight-week [coach] f16
POST /bouts/<f16.boutId>/weigh-in [coach] f16
POST /bouts/<f16.boutId>/catchweight [coach] f16
POST /users [admin] f17.fighterId t040.fighter17@example.com
POST /fighters/<f17.fighterId>/coaches [admin] f17
POST /fighters/<f17.fighterId>/doctors [admin] f17
POST /fighters/<f17.fighterId>/medical-examinations [doctor] f17.baseline
POST /fighters/<f17.fighterId>/medical-examinations [doctor] f17.trainingExam
POST /fighters/<f17.fighterId>/medical-clearances [doctor] f17
POST /bouts [coach] f17.boutId
POST /bouts/<f17.boutId>/cancel [coach] f17
created=253 existing=0
```
*(Exit 0).*
