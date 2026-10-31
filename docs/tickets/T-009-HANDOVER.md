# T-009 Handover · Kế hoạch ăn theo giai đoạn và câu hỏi "Hôm qua ăn theo kế hoạch?" (migration 026)

- Nhánh: `feat/T-009-nutrition-backend`    Commit: `5899d0c`
- Trạng thái: IN REVIEW

---

## 1. Thay đổi

### Lượt sửa 2 (Dọn dẹp theo ponytail)
- `nestjs-api/migrations/026_bout_nutrition.sql`: Xoá chỉ mục `idx_bout_nutrition_checkins_bout_date` do trùng lặp với chỉ mục duy nhất tự động được tạo bởi `CONSTRAINT uq_bout_nutrition_checkins_date UNIQUE (bout_id, academy_date)`.
- `nestjs-api/migrations/manifest.json`: Cập nhật mã băm SHA-256 (LF) mới `31bfe49cb69dbab833460d440974d13ce6d0d831f3599ff549d30f303708a500` cho `026_bout_nutrition.sql`.
- `nestjs-api/src/bouts/bouts.dto.ts`: Dời khối import các schema nutrition lên đầu file, gộp chung với khối import từ `./bouts.model.js`.
- `nestjs-api/src/bouts/bouts.service.spec.ts`:
  - Xoá test N2 ở lớp service; N2 được kiểm tra tại `src/bouts/bouts.repo.spec.ts` (câu lệnh SQL sinh ra chứa mệnh đề `ON CONFLICT ("bout_id", "academy_date") DO UPDATE SET`) và `scripts/test-migrations.mjs` (PostgreSQL thật).
  - Xoá test N9 khỏi spec của bouts; tiêu chí N9 được bảo đảm toàn vẹn vì toàn bộ thư mục `src/fighters/` không bị sửa đổi và các test hiện có của fighters (`src/fighters/fighters.service.spec.ts:314-349`) đều chạy qua.
  - Bỏ tham số thứ 6 (`now`) khi gọi `service.putNutritionCheckin` (hàm nhận 5 tham số).

### Lượt sửa 1 (Sau review Claude, review độc lập và ponytail-review)
- `nestjs-api/run_sql.mjs`: Khôi phục `['--apply-025', '025_suspensions.sql']` và đặt `['--apply-026', '026_bout_nutrition.sql']` ngay sau; khôi phục `--apply-025` trong usage; dọn dòng trống thừa.
- `nestjs-api/migrations/026_bout_nutrition.sql`: Hàm trigger chuẩn hoá `CREATE FUNCTION mma_private.check_bout_nutrition_fighter()` (không `OR REPLACE`), `LANGUAGE plpgsql SET search_path = ''`, truy vấn bảng `public.bouts` với `SELECT ... FOR KEY SHARE`, ném mã lỗi 23514 (`ERRCODE = '23514'`), thu hồi quyền `REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated;`, preflight kiểm tra collision `to_regprocedure(...) IS NOT NULL`, đặt tên CHECK constraint cột note là `ck_bout_nutrition_checkins_note`.
- `nestjs-api/migrations/README.md`: Cập nhật tài liệu hàm trigger schema `mma_private`, khóa `FOR KEY SHARE`, mã lỗi 23514 và ràng buộc `ck_bout_nutrition_checkins_note`.
- `nestjs-api/scripts/test-migrations.mjs`: Thêm kiểm tra hàm trigger bị thu hồi quyền thực thi và kiểm tra preflight chặn collision nếu hàm đã tồn tại trước.
- `nestjs-api/src/bouts/bouts.model.ts`: Bỏ `isCheckinDateInFuture` và `assertCheckinDateNotFuture`; chuyển sang `.refine((d) => d <= academyDateOf(new Date()), 'Must not be in the future')` trên trường `date` của `nutritionCheckinParamsSchema` theo khuôn `src/medical/medical.model.ts:64`; chuẩn hoá `nutritionPlanPhaseEntrySchema = nutritionPlanPhaseInputSchema.extend({ updatedAt, updatedById })`.
- `nestjs-api/src/bouts/bouts.service.ts`: Bỏ `safeParse` và exception 422 tự dựng trong `putNutritionPlan` và `putNutritionCheckin`; dùng `NUTRITION_PHASES`; bỏ kiểm `isFinalStatus` trước transaction trong `putNutritionPlan`; bỏ `updatedAt: sql\`now()\`` trong repo và bỏ ép kiểu `as any`, `as NutritionAdherence`.
- `nestjs-api/src/bouts/bouts.model.spec.ts`: N3 viết lại ở tầng schema dùng `vi.useFakeTimers()` + `vi.setSystemTime`; N8 kiểm tra thêm giới hạn `author` 101 ký tự bị từ chối.
- `nestjs-api/src/bouts/bouts.repo.spec.ts`: Thêm ca kiểm thử câu lệnh SQL sinh ra bởi Drizzle (`upsertNutritionCheckin`).

---

## 2. Đối chiếu tiêu chí nghiệm thu

| Ca kiểm thử | Tiêu chí nghiệm thu | Đáp ứng ở đâu (`file:dòng`, test nào) | Kết quả |
| --- | --- | --- | --- |
| **N1** | Migration 026 áp được trên ledger 24 không có 025..032; từ chối áp lại lần 2 (`'026 already applied'`); thiếu 024 bị từ chối; chặn collision hàm trigger | `nestjs-api/scripts/test-migrations.mjs:1099-1140` (`N1: 026 applies on ledger 24 without 025-032; rejects re-application, missing 024, collisions, and enforces fighter_id consistency`) | PASS |
| **N2** | Ghi checkin 2 lần cùng `date` → còn đúng 1 dòng, `adherence` và `note` là lần sau; kiểm tra câu lệnh SQL thực tế của Drizzle sinh ra mệnh đề ON CONFLICT DO UPDATE | `nestjs-api/scripts/test-migrations.mjs:1162-1184` (PostgreSQL thật)<br>`nestjs-api/src/bouts/bouts.repo.spec.ts:124-140` (SQL Drizzle sinh ra có `on conflict ("bout_id", "academy_date") do update set`) | PASS |
| **N3** | Giờ UTC = D 23:30 thì "hôm nay" học viện là D+1; `date = D+1` hợp lệ, `date = D+2` (tương lai) → lỗi schema với path `['date']` và message `'Must not be in the future'` (trả về 422 VALIDATION_ERROR qua `appZodValidationPipe`) | `nestjs-api/src/bouts/bouts.model.spec.ts:1204-1237` (Zod refine với `vi.useFakeTimers`) | PASS |
| **N4** | FIGHTER A ghi checkin vào trận của FIGHTER B → 403 FORBIDDEN | `nestjs-api/src/bouts/bouts.service.spec.ts:4602-4616` (`N4: FIGHTER A cannot record checkin for FIGHTER B (403 FORBIDDEN)`) | PASS |
| **N5** | DOCTOR ghi checkin → 403 FORBIDDEN (dù được cấp quyền lẻ) | `nestjs-api/src/bouts/bouts.service.spec.ts:4618-4631` (`N5: DOCTOR cannot record checkin (403 FORBIDDEN)`) | PASS |
| **N6** | `currentNutritionPhase` đúng cho 6 trạng thái: SCHEDULED, CAMP → camp; FIGHT_WEEK → fightWeek; WEIGHED_IN → postWeighIn; COMPLETED, CANCELLED → null | `nestjs-api/src/bouts/bouts.model.spec.ts:1239-1246` (`N6: currentNutritionPhase returns camp for SCHEDULED and CAMP, fightWeek for FIGHT_WEEK, postWeighIn for WEIGHED_IN, and null for COMPLETED and CANCELLED`) | PASS |
| **N7** | `PUT nutrition-plan` cho trận COMPLETED và CANCELLED → 409 BOUT_INVALID_TRANSITION (kiểm tra an toàn trong transaction sau khi lock dòng) | `nestjs-api/src/bouts/bouts.service.spec.ts:4633-4657` (`N7: PUT nutrition-plan rejected with 409 BOUT_INVALID_TRANSITION for COMPLETED and CANCELLED bouts`) | PASS |
| **N8** | Zod validation: `text` 2001 ký tự → 422; `author` 101 ký tự → 422; `note` 201 ký tự → 422; `text` 2000, `author` 100, `note` 200 ký tự hợp lệ; DB check constraint từ chối `note` > 200 | `nestjs-api/src/bouts/bouts.model.spec.ts:1248-1282`<br>`nestjs-api/scripts/test-migrations.mjs:1191-1197` | PASS |
| **N9** | Ghi cân qua service/controller hiện có không đổi hành vi, không file nào trong `src/fighters/` bị sửa đổi | `nestjs-api/src/fighters/fighters.service.spec.ts:314-349` (`records a self-reported measurement with actor provenance`) | PASS |
| **Thêm** | `fighter_id` của check-in khác `bouts.fighter_id` bị DB trigger `mma_private.check_bout_nutrition_fighter()` từ chối với mã lỗi 23514 | `nestjs-api/migrations/026_bout_nutrition.sql:69-83`<br>`nestjs-api/scripts/test-migrations.mjs:1185-1190` | PASS |

---

## 3. Lệnh đã chạy

### Lượt sửa 2

#### 1. `pnpm --filter nestjs-api lint`
```
$ oxlint src/ test/
src/dataset-export/dto/promotion-request.dto.ts:8:3: warning eslint(no-unused-vars): Identifier 'Matches' is imported but never used. help: Consider removing this import.
...
src/notifications/notification-distribution.service.spec.ts:74:9: warning eslint(no-unused-vars): Variable 'subscribedEmitted' is declared but never used. Unused variables should start with a '_'. help: Consider removing this declaration.
```
*(exit code 0; không có lỗi hoặc cảnh báo trong các file thay đổi)*

#### 2. `pnpm --filter nestjs-api build`
```
$ nest build
```
*(exit code 0; biên dịch TypeScript thành công)*

#### 3. `pnpm --filter nestjs-api exec vitest run src/bouts src/fighters`
```
The plugin "vite-tsconfig-paths" is detected. Vite now supports tsconfig paths resolution natively via the resolve.tsconfigPaths option. You can remove the plugin and set resolve.tsconfigPaths: true in your Vite config instead.

 RUN  v4.1.11 D:/MMA-TMS/nestjs-api


 Test Files  15 passed (15)
      Tests  456 passed (456)
   Start at  18:34:15
   Duration  2.67s (transform 2.43s, setup 0ms, import 18.86s, tests 580ms, environment 2ms)
```
*(exit code 0; toàn bộ 15/15 test files passed, 456/456 tests passed)*

#### 4. `pnpm --filter nestjs-api test:db`
```
$ node scripts/test-migrations.mjs
PASS 001 -> 002 -> 003 on an empty isolated database
PASS 004 registers Users and Fighters permissions without grants
...
PASS N1: 026 applies on ledger 24 without 025-032; rejects re-application, missing 024, collisions, and enforces fighter_id consistency
...
Migration checks passed: 49. PostgreSQL stopped after tests. Scratch: C:\Users\PC\AppData\Local\Temp\mma-migrations-uj9rYF
```
*(exit code 0; toàn bộ 49/49 migration checks passed trên PostgreSQL tạm độc lập)*

#### 5. `pnpm --filter nestjs-api db:check`
```
$ node run_sql.mjs --check
001-032 checksums OK. No database connection was opened.
```
*(exit code 0; toàn bộ checksums 001-032 khớp manifest)*

---

## 4. Lệch so với ticket

- **Phạm vi kiểm tra quyền**: Ticket nêu đối chiếu phạm vi quyền "như `goals.service.ts`", tuy nhiên nhánh `fight-camp` không có module `goals`. Theo chỉ đạo của ticket, đã dùng khuôn phân quyền chuẩn của `bouts.service.ts`:
  - `PUT /bouts/:id/nutrition-plan`: Dùng `assertWriteAccess` (cho phép ADMIN và COACH được phân công; các vai trò khác nhận 403 `forbidden()`).
  - `PUT /bouts/:id/nutrition-checkins/:date`: Dùng `assertNutritionCheckinAccess` được kiểm tra chặt chẽ trong service: ADMIN được phép; FIGHTER chỉ được ghi checkin cho chính trận của mình; COACH được phân công trận đó được phép; DOCTOR và các vai trò khác bị từ chối 403 `forbidden()` dù có được cấp quyền lẻ hay không.
- **Xác thực ngày tương lai**: Thay vì hàm tự ném ngoại lệ trong service, đã tích hợp `.refine((d) => d <= academyDateOf(new Date()), 'Must not be in the future')` trong `nutritionCheckinParamsSchema`. Khi client truyền ngày tương lai, `appZodValidationPipe` trả về 422 `VALIDATION_ERROR` chuẩn.

---

## 5. Câu hỏi / việc còn mở

- **Câu hỏi nghiệp vụ**: Trả lời ăn uống (`PUT /bouts/:id/nutrition-checkins/:date`) trên trận có trạng thái `COMPLETED` hoặc `CANCELLED` hiện tại vẫn ghi nhận được do đặc tả T-009 không cấm (khác với `PUT /bouts/:id/nutrition-plan` bị chặn 409 `BOUT_INVALID_TRANSITION`). Nếu nghiệp vụ tương lai cần chặn checkin trên các trạng thái này, có thể bổ sung kiểm tra `isFinalStatus` tương tự kế hoạch ăn.

## 6. Lượt cắt ponytail (31/10)

- `bouts.repo.ts`: `findNutritionCheckinsForBout` trả thẳng kết quả query (bỏ `.map` chép lại); `upsertNutritionCheckin` dùng `.values(data)`.
- Xoá type không ai dùng: `NutritionPlanPhaseInput`, `NutritionPlanPhaseEntry`, `NutritionCheckinParams` (`bouts.model.ts`), `InsertBoutNutritionCheckin` (`schema.ts`).
- Kiểm lại sau lượt cắt: lint 0 lỗi; build exit 0; `vitest run src/bouts src/fighters` 456/456; `test:db` 49 passed; `db:check` 001-032 OK.
