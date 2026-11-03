# T-050: kết thúc sớm đình chỉ MEDICAL có căn cứ (phiếu khám hoặc văn bản gỡ của ban tổ chức)

- Trạng thái: **READY** (Ken duyệt bản đầy đủ 03/11: migration 033, 2 mã lỗi mới). Viết lại theo [review ticket](./T-050-TICKET-REVIEW.md).
- Phạm vi: phần A backend `nestjs-api` (migration 033); phần B frontend `nextjs-frontend`. Điện thoại: không.
- Người làm: Ken (Claude lead, `agy` code). Ken áp migration 033 lên Supabase.
- Phụ thuộc: T-049 (DONE), T-045 (lộ trình theo bậc). Demo: [T-052](./T-052-demo-doctor-mode.md).
- Review: phần A bằng `/ponytail:ponytail-review`, phần B bằng `/impeccable:impeccable` (Ken 03/11), cộng review độc lập theo quy định.

## Bối cảnh

Đình chỉ chỉ kết thúc khi hết số ngày (và được xác nhận nếu cần). Võ sĩ khỏi trước hạn không có đường quay lại tập. Ken đề xuất 31/10: HLV hoặc võ sĩ yêu cầu khám, bác sĩ được phân khám, khám ổn thì kết thúc sớm. Ken yêu cầu 03/11: **phải có căn cứ**.

Yêu cầu khám dùng luồng có sẵn của module `medical` (`medical_review_requests`, `ReviewRequestCard`, trang "Yêu cầu xem xét", phiếu khám đóng yêu cầu qua `reviewRequestIds`). Ticket này không đụng luồng đó.

## Căn cứ nghiệp vụ

- **Việt Nam:** Luật thi đấu VMMAF 2021 (QĐ 01/QĐ-LĐVTTHVN) Điều 8: "Ban Tổ chức sẽ tiến hành kiểm tra y tế trước và sau trận đấu (quy định chi tiết theo điều lệ giải)"; Điều 13: giám sát y tế là bác sĩ do ban tổ chức chỉ định. Không có điều nào về số ngày đình chỉ, ai gỡ hay điều kiện thi đấu lại. Thông tư 03/2015/TT-BVHTTDL: kiểm tra sức khỏe vận động viên do cơ sở khám chữa bệnh có giấy phép thực hiện, không nói về trở lại sau chấn thương. Hệ quả: đình chỉ của ban tổ chức đi theo điều lệ giải, ban tổ chức gỡ.
- **Quốc tế:** AIBA cần văn bản của bác sĩ thần kinh hoặc y học thể thao để thi đấu lại; Minn. Stat. §341.27: cơ quan ra đình chỉ gỡ sau khi nhận văn bản của bác sĩ; NSAC ghi điều kiện "bác sĩ cho phép" trong đình chỉ.
- **Lộ trình sau chấn thương đầu:** đồng thuận Amsterdam 2022 (đã dùng cho T-045).
- Nguồn: [VMMAF 2021](https://vmmaf.org/images/pdf_file/2021/mau-mma_1618298572.pdf); [TT 03/2015 (Thư Viện Pháp Luật)](https://thuvienphapluat.vn/phap-luat/kiem-tra-suc-khoe-cua-van-dong-vien-gom-nhung-noi-dung-gi-co-quan-nao-kiem-tra-suc-khoe-cua-van-don-554292-79569.html); [Minn. Stat. 341.27](https://www.revisor.mn.gov/statutes/cite/341.27); [AIBA Medical Handbook 2020](https://www.iba.sport/wp-content/uploads/2020/12/AIBA-Medical-Handbook-2020_-24.10.2020.pdf).

## Quyết định (Ken, 03/11)

| # | Câu hỏi | Chọn |
| --- | --- | --- |
| 1 | Làm trước hay sau 10/11 | Làm ngay |
| 2–3 | Chế độ `NONE` | Đình chỉ của CLB: tắt (409 `MEDICAL_SUPERVISION_DISABLED`), vì không có bác sĩ thì không có phiếu khám. Đình chỉ của ban tổ chức: vẫn kết thúc được bằng văn bản gỡ |
| 4 | Đình chỉ do ban tổ chức ra | Ghi nguồn đình chỉ. Đình chỉ của ban tổ chức chỉ kết thúc sớm bằng văn bản gỡ của ban tổ chức; phiếu khám của bác sĩ CLB không thay được |
| 5 | Lộ trình theo bậc cho `MEDICAL` | Có, như KO/TKO |
| 6 | `OTHER` | Không kết thúc sớm |
| 7 | Bảng riêng hay dùng `medical_review_requests` | Dùng có sẵn |
| 8 | Cổng Doctor đóng băng | Bỏ đóng băng phần cần cho luồng này; thêm khối Đình chỉ vào trang võ sĩ của bác sĩ |

## Quy tắc

1. **Nguồn đình chỉ** (`issuedBy`): `CLUB` (mặc định, mọi đình chỉ hiện có và đình chỉ tạo từ kết quả trận) hoặc `ORGANIZER`. `ORGANIZER` chỉ cho lý do `MEDICAL` (FLOWS H5), bắt buộc `issuerReference` (tên giải, số/ngày văn bản; 3–200 ký tự). `CLUB` không có `issuerReference`.
2. **Chỉ kết thúc sớm** đình chỉ lý do `MEDICAL`, trạng thái `ACTIVE` (theo `suspensionStatusOn`, ngày học viện). `AWAITING_CLEARANCE` dùng `/clear` như cũ; `UPCOMING` chưa bắt đầu.
3. **Đình chỉ `CLUB`:** chỉ bác sĩ được phân. Căn cứ bắt buộc là một phiếu khám (`examinationId`) thỏa đủ:
   - cùng võ sĩ;
   - do chính bác sĩ đang bấm ghi (`medical_examinations.doctor_id` → `sports_doctors.user_id = actor.id`);
   - `scope = TRAINING`;
   - `decision` là `ELIGIBLE` hoặc `ELIGIBLE_WITH_RESTRICTIONS` (hạn chế của phiếu vẫn được medical gate áp tiếp);
   - ngày học viện của `examined_at` ≥ `startsOn` của đình chỉ;
   - chưa bị phiếu khác thay thế (không có phiếu nào `supersedes_id` = phiếu này);
   - chưa hết hạn (`valid_until` null hoặc sau lúc bấm).
   Chế độ `NONE`: 409 `MEDICAL_SUPERVISION_DISABLED`.
4. **Đình chỉ `ORGANIZER`:** HLV hoặc bác sĩ được phân (`assertClearAccess` có sẵn). Căn cứ bắt buộc là `liftReference` (số/ngày văn bản gỡ của ban tổ chức, 3–200). Không nhận `examinationId`. Chạy cả ở chế độ `NONE`.
5. Mọi lần kết thúc sớm ghi `cleared_at` = lúc bấm, `cleared_by_id` = người bấm, `clearance_note` = ghi chú (3–500, bắt buộc), cùng căn cứ (`early_end_examination_id` hoặc `lift_reference`).
6. **Lộ trình theo bậc:** `gradedReturnFor` áp cho `KO`, `TKO` và `MEDICAL`, mọi cách kết thúc. Ngày `R` = ngày học viện của `cleared_at` khi có; chưa có và không cần xác nhận thì `endsOn + 1`. KO/TKO giữ nguyên kết quả cũ.
7. Buổi "Chờ xếp lại" không tự quay lại lịch (như T-036). Nhật ký kiểm toán: trigger `trg_suspensions_audit` có sẵn ghi mọi cột mới.
8. `/clear` không đổi (kể cả với đình chỉ `ORGANIZER`; xem "Ngoài phạm vi").

**Tác dụng phụ có sẵn, không sửa:** ở chế độ `DOCTOR`, yêu cầu khám đang mở chặn mọi buổi TRAINING kể cả `RECOVERY` (`REVIEW_REQUEST_PENDING`, `medical.service.ts:155`) cho tới khi bác sĩ ghi phiếu khám.

## Phần A · Backend

### Migration 033 (`nestjs-api/migrations/033_suspension_early_end.sql`)

Khuôn: `032_session_status_pending.sql` (khung giao dịch, lock, preflight, ledger) và `025_suspensions.sql` (bảng `suspensions`).

- `BEGIN`; `SET LOCAL lock_timeout/statement_timeout/search_path` như 032; `pg_advisory_xact_lock(20260916, 33)`.
- Preflight: có `mma_private.migration_history`; chưa có version 33 (`'033 already applied'`); có version 25 (`'033 requires migration 025'`) và version 11 (`'033 requires migration 011'`); có `public.suspensions` và ràng buộc `uq_medical_examination_fighter`. Không yêu cầu 026–032.
- `CREATE TYPE public.suspension_issuer AS ENUM ('CLUB', 'ORGANIZER')`.
- `ALTER TABLE public.suspensions ADD COLUMN`:
  - `issued_by public.suspension_issuer NOT NULL DEFAULT 'CLUB'`
  - `issuer_reference text`
  - `early_end_examination_id uuid`
  - `lift_reference text`
- Ràng buộc:
  - `ck_suspensions_issuer`: `(issued_by = 'ORGANIZER') = (issuer_reference IS NOT NULL)` và `issued_by = 'CLUB' OR reason = 'MEDICAL'`; `issuer_reference` null hoặc `length(btrim(...))` 3–200.
  - `ck_suspensions_early_end`: `early_end_examination_id IS NULL OR lift_reference IS NULL`; có một trong hai thì `cleared_at IS NOT NULL`; `early_end_examination_id` chỉ khi `issued_by = 'CLUB'`; `lift_reference` chỉ khi `issued_by = 'ORGANIZER'`, độ dài 3–200.
  - `fk_suspensions_early_end_examination`: `(early_end_examination_id, fighter_id) REFERENCES public.medical_examinations (id, fighter_id)` (dùng `uq_medical_examination_fighter`; khoá ghép bảo đảm phiếu cùng võ sĩ).
- Ghi `migration_history` version 33, tên file, `mma.migration_sha256` như 032. `COMMIT`.
- Không thêm quyền, trigger, bảng hay loại thông báo. RLS và `REVOKE` của bảng có sẵn.
- Đăng ký: `migrations/manifest.json` (checksum), `scripts/migration-files.mjs`, `run_sql.mjs` (`--apply-033`, dòng usage), `package.json` (`db:migrate:033`), mục "Áp dụng migration 033" đầu `migrations/README.md` (đổi tiêu đề "003–033"), ca trong `scripts/test-migrations.mjs`, `src/database/schema.ts` (enum, cột, check, FK).

### API

**`POST /suspensions`** (có sẵn): body thêm `issuedBy?: 'CLUB' | 'ORGANIZER'` (mặc định `CLUB`), `issuerReference?: string`. Sai quy tắc 1 → 422 `VALIDATION_ERROR` (zod refine trong schema tạo đình chỉ hiện có).

**`POST /suspensions/:id/end-early`** (mới), `@RequirePermissions({ allOf: [SUSPENSION_PERMISSIONS.CLEAR] })` (COACH, DOCTOR đã có, migration 025 dòng 98). Body: `{ note: string (trim 3–500), examinationId?: uuid, liftReference?: string (trim 3–200) }`. Phản hồi: `SuspensionResponse`.

Thứ tự kiểm trong `SuspensionsService.endSuspensionEarly`, chép khuôn `clearSuspension` (`suspensions.service.ts:154-205`):

1. Parse body → 422 `VALIDATION_ERROR` (`suspensionValidationError`). Chỉ đúng một trong `examinationId`, `liftReference`.
2. `requireSuspension` → 404 `SUSPENSION_NOT_FOUND`.
3. `issuedBy = CLUB`: phải có `examinationId` (thiếu, hoặc gửi `liftReference` → 422); `actor.role !== DOCTOR` → 403; chế độ `NONE` (`AcademySettingsRepository.getMedicalSupervision()`) → 409 `medicalSupervisionDisabled()` (từ `medical/medical.error.ts`); `isDoctorAssignedToFighter` sai → 403. `SuspensionsModule` import `AcademySettingsModule` (chỉ phụ thuộc `DatabaseModule`, không vòng).
4. `issuedBy = ORGANIZER`: phải có `liftReference` (thiếu, hoặc gửi `examinationId` → 422); `assertClearAccess` (HLV hoặc bác sĩ được phân, còn lại 403). Không kiểm chế độ.
5. Trong `repo.transaction`: `setAuditContext`; `lockSuspensionById`; `clearedAt !== null` → 409 `SUSPENSION_ALREADY_CLEARED`; lý do khác `MEDICAL` hoặc trạng thái khác `ACTIVE` → 409 `SUSPENSION_EARLY_END_NOT_ELIGIBLE`; với `CLUB`, đọc phiếu khám (query trực tiếp `medical_examinations` join `sports_doctors` trong `suspensions.repo.ts`, không import service medical) và kiểm quy tắc 3 → 409 `SUSPENSION_EARLY_END_EXAM_INVALID`; ghi `cleared_*` và căn cứ; ghi trả `null` → `SUSPENSION_ALREADY_CLEARED`.
6. `mapSuspensionPersistenceError` như `/clear`.

**Mã lỗi mới** (Ken duyệt 03/11), ở `suspensions.error.ts`, khuôn `suspensionNotAwaitingClearance`:

| Mã | HTTP | Khi nào | `details` |
| --- | --- | --- | --- |
| `SUSPENSION_EARLY_END_NOT_ELIGIBLE` | 409 | Lý do khác `MEDICAL` hoặc trạng thái khác `ACTIVE` | `{ reason, status }` |
| `SUSPENSION_EARLY_END_EXAM_INVALID` | 409 | Phiếu khám không thỏa quy tắc 3 | `{ cause }`, `cause` ∈ `NOT_FOUND` (không có hoặc của võ sĩ khác), `OTHER_DOCTOR`, `NOT_TRAINING`, `NOT_ELIGIBLE`, `BEFORE_SUSPENSION`, `SUPERSEDED`, `EXPIRED` |

**Phản hồi đình chỉ** (`toSuspensionResponse`, `suspensions.service.ts:308`) thêm `issuedBy`, `issuerReference`, `earlyEndExaminationId`, `liftReference` (null khi không có).

**`gradedReturnFor`** (`suspensions.model.ts:178`): thêm `MEDICAL`; `R` lấy từ `clearedAt` khi có, bất kể `requiresClearance`. Sửa JSDoc.

### File phần A (đã kiểm có thật, trừ file migration mới)

`migrations/033_suspension_early_end.sql` (mới), `migrations/manifest.json`, `migrations/README.md`, `scripts/migration-files.mjs`, `scripts/test-migrations.mjs`, `run_sql.mjs`, `package.json`, `src/database/schema.ts`, `src/suspensions/suspensions.{controller,service,repo,model,dto,error,module,constants}.ts` và các `*.spec.ts` cùng thư mục.

## Phần B · Frontend

- `lib/domain/types.ts:1315` (`Suspension`): thêm 4 trường. Map trong `lib/services/suspensions.ts`.
- `lib/services/suspensions.ts` (+ `suspensions.demo.ts`): `endSuspensionEarly(id, input, actor)`; `createSuspension` gửi `issuedBy`, `issuerReference`.
- `lib/actions/suspensions.ts`: `endSuspensionEarlyAction`, khuôn `clearSuspensionAction` (dòng 163); map `SUSPENSION_EARLY_END_NOT_ELIGIBLE`, `SUSPENSION_EARLY_END_EXAM_INVALID` (theo `cause`), `MEDICAL_SUPERVISION_DISABLED`, `SUSPENSION_ALREADY_CLEARED` sang câu dễ hiểu (khuôn dòng 51). `lib/actions/suspension-schemas.ts`: schema cho nguồn và căn cứ.
- **HLV, form tạo** (`coach/bouts/suspensions/create-suspension-panel.tsx`): lý do `MEDICAL` thì hiện chọn "Do CLB" / "Do ban tổ chức"; ban tổ chức thì ô "Giải và văn bản đình chỉ" bắt buộc. Lý do khác thì ẩn.
- **HLV, danh sách** (`coach/bouts/suspensions/page.tsx`): đình chỉ `ORGANIZER` `ACTIVE` có nút "Ban tổ chức đã gỡ" mở hộp thoại (văn bản gỡ, ghi chú), khuôn `suspension-clearance-dialog.tsx`. Đình chỉ `MEDICAL` `CLUB` `ACTIVE` hiện dòng gợi ý "Muốn kết thúc sớm: gửi yêu cầu khám, bác sĩ được phân kết thúc sau khi khám" kèm link tới trang võ sĩ (`routes.coach`) nơi có `ReviewRequestCard`. Dòng nguồn: nhãn "Ban tổ chức: <issuerReference>".
- **Bác sĩ** (`doctor/fighters/[fighterId]/page.tsx`, trang đã tải `listExaminations`): khối "Đình chỉ" liệt kê đình chỉ của võ sĩ (`GET /suspensions?fighterId=`). `MEDICAL` `CLUB` `ACTIVE`: nút "Kết thúc sớm" mở hộp thoại chọn phiếu khám (chỉ liệt kê phiếu `TRAINING`, kết luận đủ điều kiện, ngày khám ≥ ngày bắt đầu đình chỉ; không có phiếu nào thì báo và link `routes.doctor.newExamination`, nút gửi tắt), ô ghi chú, dòng "Võ sĩ sẽ tập lại theo bậc: hôm nay tới bậc 3, ngày mai bậc 4, từ ngày kia mọi bậc". `ORGANIZER` `ACTIVE`: nút "Ban tổ chức đã gỡ" như HLV. Trang bác sĩ đang viết chữ tiếng Việt trực tiếp: giữ cách đó.
- **Đã kết thúc sớm**: dòng căn cứ "Kết thúc sớm theo phiếu khám ngày …" (link `routes.doctor.examination(id)` ở trang bác sĩ) hoặc "Ban tổ chức gỡ: <liftReference>".
- i18n `vi`/`en` cho trang HLV trong `lib/i18n/messages/coach-bouts.{vi,en}.ts`.
- Không trang mới, không thông báo mới.

## Ngoài phạm vi

- Kết thúc sớm `KO`, `TKO`, `DQ`, `MANDATORY_REST`, `OTHER`.
- `/clear` đòi văn bản gỡ với đình chỉ `ORGANIZER` đã quá hạn.
- Đặt lịch khám, đính kèm ảnh giấy tờ; rút ngắn số ngày; lùi bậc khi có triệu chứng.
- Sửa tác dụng phụ `REVIEW_REQUEST_PENDING`.
- Điện thoại (T-048); dữ liệu demo (T-052).

## Ca kiểm thử

Hôm nay = 2026-11-05 (UTC+7). Võ sĩ F có HLV C, bác sĩ D được phân; bác sĩ D2 không được phân; bác sĩ D3 cũng được phân cho F. Chế độ `DOCTOR` trừ khi ghi khác.

- Đình chỉ **SC**: `MEDICAL`, `CLUB`, `startsOn 2026-11-01`, `endsOn 2026-11-14`, `requiresClearance false`, chưa xác nhận.
- Đình chỉ **SO**: như SC nhưng `ORGANIZER`, `issuerReference "Giải MMA Hà Nội 2026, QĐ 12/BTC ngày 31/10"`.
- Phiếu **X1**: của F, do D ghi, `TRAINING`, `ELIGIBLE`, `examinedAt 2026-11-05T02:00:00Z`, `validUntil null`, chưa bị thay.

Service test mock repo và `AcademySettingsRepository`; mock `lockSuspensionById` trả đúng dòng của ca; **không** mock giao dịch tự đổi dữ liệu.

### Tạo đình chỉ

| Ca | Đầu vào | Kết quả mong đợi | Lớp |
| --- | --- | --- | --- |
| C1 | `POST /suspensions` `MEDICAL`, `issuedBy ORGANIZER`, `issuerReference` như SO | 201; phản hồi `issuedBy 'ORGANIZER'`, `issuerReference` đúng chuỗi | service |
| C2 | `ORGANIZER`, không `issuerReference` | 422 `VALIDATION_ERROR` | service/dto |
| C3 | `ORGANIZER`, lý do `KO` | 422 `VALIDATION_ERROR` | service/dto |
| C4 | Không gửi `issuedBy` | 201; `issuedBy 'CLUB'`, `issuerReference null` | service |
| C5 | `CLUB` kèm `issuerReference` | 422 `VALIDATION_ERROR` | service/dto |

### Kết thúc sớm, đình chỉ CLB

| Ca | Đầu vào | Hành động | Kết quả mong đợi | Lớp |
| --- | --- | --- | --- | --- |
| E1 | SC, X1 | D gọi, `note "Khám ổn, hết đau đầu"`, `examinationId X1` | Trả `status ENDED`; repo ghi một lần với `clearedById = D`, `clearanceNote` đúng chuỗi, `earlyEndExaminationId = X1`, `liftReference null`, `clearedAt` là `Date` | service |
| E2 | SC nhưng `reason KO` | D gọi | 409 `SUSPENSION_EARLY_END_NOT_ELIGIBLE`, `details { reason: 'KO', status: 'ACTIVE' }`; không ghi | service |
| E3 | SC nhưng `reason OTHER` | D gọi | 409 `SUSPENSION_EARLY_END_NOT_ELIGIBLE`, `details.reason 'OTHER'` | service |
| E4 | SC nhưng `startsOn 2026-11-10`, `endsOn 2026-11-20` | D gọi | 409 `SUSPENSION_EARLY_END_NOT_ELIGIBLE`, `details.status 'UPCOMING'` | service |
| E5 | SC nhưng `startsOn 2026-10-20`, `endsOn 2026-10-26`, `requiresClearance true` | D gọi | 409 `SUSPENSION_EARLY_END_NOT_ELIGIBLE`, `details.status 'AWAITING_CLEARANCE'` | service |
| E6 | SC, `clearedAt 2026-11-04T03:00:00Z` | D gọi | 409 `SUSPENSION_ALREADY_CLEARED` | service |
| E7 | SC | D2 gọi | 403; không mở giao dịch | service |
| E8 | SC | C gọi (kèm `examinationId X1`) | 403 | service |
| E9 | SC, chế độ `NONE` | D gọi | 409 `MEDICAL_SUPERVISION_DISABLED`; không ghi | service |
| E10 | SC | D gọi `note "ok"`; rồi `note` 501 ký tự | Cả hai 422 `VALIDATION_ERROR` | service/dto |
| E11 | id không tồn tại | D gọi | 404 `SUSPENSION_NOT_FOUND` | service |
| E12 | SC | D gọi `POST /suspensions/:id/clear` | Vẫn 409 `SUSPENSION_NOT_AWAITING_CLEARANCE` | service |
| E13 | SC, `lockSuspensionById` trả dòng đã có `clearedAt` | D gọi | 409 `SUSPENSION_ALREADY_CLEARED` | service |
| E14 | SC, X1 | D gọi | `setAuditContext` gọi với `authSubject` của D và `requestId`, trong giao dịch | service |
| E15 | SC | D gọi không `examinationId`; rồi với cả `examinationId` và `liftReference` | Cả hai 422 `VALIDATION_ERROR` | service/dto |

### Phiếu khám không hợp lệ (SC, D gọi; mỗi ca 409 `SUSPENSION_EARLY_END_EXAM_INVALID`, không ghi)

| Ca | Phiếu | `details.cause` |
| --- | --- | --- |
| X2 | id không tồn tại | `NOT_FOUND` |
| X3 | Phiếu của võ sĩ khác | `NOT_FOUND` |
| X4 | Phiếu do D3 ghi | `OTHER_DOCTOR` |
| X5 | Như X1 nhưng `scope COMPETITION` | `NOT_TRAINING` |
| X6 | Như X1 nhưng `decision NOT_ELIGIBLE` | `NOT_ELIGIBLE` |
| X7 | Như X1 nhưng `examinedAt 2026-10-31T10:00:00Z` (ngày học viện 31/10) | `BEFORE_SUSPENSION` |
| X8 | X1 đã bị một phiếu khác thay (`supersedes_id = X1`) | `SUPERSEDED` |
| X9 | Như X1 nhưng `examinedAt 2026-11-01T03:00:00Z`, `validUntil 2026-11-04T00:00:00Z` | `EXPIRED` |
| X10 | Như X1 nhưng `ELIGIBLE_WITH_RESTRICTIONS` | **Không lỗi**: 200, `status ENDED` |
| X11 | Như X1 nhưng `examinedAt 2026-10-31T18:00:00Z` (01:00 ngày 01/11 giờ học viện) | **Không lỗi**: 200 (biên ngày theo UTC+7) |

### Kết thúc sớm, đình chỉ ban tổ chức

| Ca | Đầu vào | Hành động | Kết quả mong đợi | Lớp |
| --- | --- | --- | --- | --- |
| O1 | SO | C gọi, `liftReference "CV 15/BTC ngày 04/11 gỡ đình chỉ"`, `note "Đã nhận văn bản gỡ"` | 200 `status ENDED`; ghi `liftReference` đúng chuỗi, `earlyEndExaminationId null`, `clearedById = C` | service |
| O2 | SO | D gọi như O1 | 200 | service |
| O3 | SO, chế độ `NONE` | C gọi như O1 | 200 (không kiểm chế độ) | service |
| O4 | SO | C gọi không `liftReference`; rồi với `examinationId X1` thay vì `liftReference` | Cả hai 422 `VALIDATION_ERROR` | service/dto |
| O5 | SO | D2 gọi; HLV không được phân gọi | Cả hai 403 | service |

### Lộ trình theo bậc và Cổng 2

| Ca | Đầu vào | Hành động | Kết quả mong đợi | Lớp |
| --- | --- | --- | --- | --- |
| G1 | SC, `clearedAt 2026-11-05T03:00:00Z` | `gradedReturnFor` tại 11-05 / 11-06 / 11-07 | `{ ceiling 3, fullReturnOn '2026-11-07' }` / `{ ceiling 4, fullReturnOn '2026-11-07' }` / `null`. **Phải lỗi trên code cũ** | unit |
| G2 | `MEDICAL`, `endsOn 2026-11-14`, `requiresClearance true`, `clearedAt 2026-11-20T02:00:00Z` | tại 2026-11-20 | `{ ceiling 3, fullReturnOn '2026-11-22' }` | unit |
| G3 | `MEDICAL`, `endsOn 2026-11-14`, `requiresClearance false`, không `clearedAt` | tại 2026-11-15 | `{ ceiling 3, fullReturnOn '2026-11-17' }` | unit |
| G4 | `OTHER`, kết thúc như G1 | tại 2026-11-05 | `null` | unit |
| G5 | Các ca KO/TKO có sẵn của T-045 | chạy lại | Qua, **không sửa** kết quả mong đợi | unit |
| G6 | SC kết thúc như G1 | `SuspensionGate`: `SPARRING` 11-05; `PAD_WORK` 11-05; `SPARRING` 11-07 | 409 `TRAINING_SUSPENSION_ACTIVE` kèm `gradedReturn.ceiling 3`; qua; qua. Chỉ Cổng 2, không medical gate | service gate |

### Migration (`test:db`)

| Ca | Kết quả mong đợi |
| --- | --- |
| M1 | 033 áp được trên ledger có 011 và 025 mà không có 026–032; áp lại báo `033 already applied`; ledger không có 025 báo `033 requires migration 025` |
| M2 | Dòng `suspensions` có sẵn trước 033 nhận `issued_by = 'CLUB'`, ba cột còn lại null |
| M3 | Bị từ chối: `ORGANIZER` không `issuer_reference`; `ORGANIZER` lý do `KO`; `CLUB` có `issuer_reference` |
| M4 | Bị từ chối: `early_end_examination_id` trỏ phiếu của võ sĩ khác (khoá ghép) |
| M5 | Bị từ chối: có cả `early_end_examination_id` và `lift_reference`; có một trong hai mà `cleared_at` null; `lift_reference` trên `CLUB`; `early_end_examination_id` trên `ORGANIZER` |
| M6 | Hợp lệ: `CLUB` đã xác nhận có `early_end_examination_id` cùng võ sĩ; `ORGANIZER` đã xác nhận có `lift_reference` |

### Frontend (phần B)

| Ca | Đầu vào | Kết quả mong đợi | Lớp |
| --- | --- | --- | --- |
| W1 | Trang bác sĩ, F có SC, SO và một đình chỉ `KO` `ACTIVE` | SC có nút "Kết thúc sớm"; SO có "Ban tổ chức đã gỡ"; KO không có nút nào | vitest |
| W2 | Hộp thoại kết thúc sớm, phiếu: X1, một phiếu `COMPETITION`, một phiếu ngày 31/10 | Chỉ X1 được liệt kê | vitest |
| W3 | Hộp thoại, không phiếu nào hợp lệ | Có câu báo và link "Ghi phiếu khám"; nút gửi tắt | vitest |
| W4 | Ghi chú 2 ký tự | Báo lỗi, không gọi action | vitest |
| W5 | Action nhận 409 `SUSPENSION_EARLY_END_EXAM_INVALID` `cause EXPIRED`, và `MEDICAL_SUPERVISION_DISABLED` | Trả câu đã dịch theo từng mã/cause, không phải mã thô | vitest |
| W6 | Form tạo của HLV: lý do `MEDICAL` | Có chọn nguồn; chọn ban tổ chức mà để trống văn bản thì báo lỗi; lý do `KO` thì không có chọn nguồn | vitest |
| W7 | Danh sách HLV: SO `ACTIVE`, SC `ACTIVE` | SO có "Ban tổ chức đã gỡ"; SC không có nút kết thúc, có dòng gợi ý yêu cầu khám | vitest |
| W8 | Đình chỉ đã kết thúc sớm theo X1; một cái theo `liftReference` | Hiện "Kết thúc sớm theo phiếu khám ngày 05/11/2026" / "Ban tổ chức gỡ: CV 15/BTC…" | vitest |
| W9 | i18n | Mọi khóa mới có cả `vi` và `en` (test dịch có sẵn qua) | vitest |

## Tiêu chí nghiệm thu

1. Mọi ca trên có test đúng tên, đúng đầu vào và kết quả mong đợi. G1 có output lỗi trên code cũ và qua trên code mới trong handover.
2. `test:db` qua cả M1–M6; `db:check` báo `001-033 checksums OK`.
3. `/clear` không đổi hành vi (E12, test T-049 có sẵn qua).
4. Phản hồi đình chỉ có đủ 4 trường mới; client cũ không gửi `issuedBy` vẫn tạo được đình chỉ (C4).
5. Lệnh dưới đây không thêm lỗi so với [baseline](./BASELINE.md).

## Lệnh kiểm tra bắt buộc

Phần A:
```
pnpm --filter nestjs-api lint
pnpm --filter nestjs-api build
pnpm --filter nestjs-api test
pnpm --filter nestjs-api test:db
pnpm --filter nestjs-api db:check
```
Phần B:
```
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```
