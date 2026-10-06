# Đối chiếu mobile với FE-FIGHTER-COACH-FLOWS

> Kiểm tra ngày 28/09/2026, đọc code tĩnh (không chạy app, không gọi server). Nguồn chuẩn: controller/service/model trong `nestjs-api`. Mobile: `reactnative-mobile/src`.

**Doc và backend:** Các route, schema, enum, reason code và envelope trong doc khớp với code backend. Có 3 điểm nhỏ, không làm đổi plan:

- Roster: doc khuyên dùng `GET /coaches/:coachId/fighters`. Mobile đang dùng `GET /fighters`. Với COACH, backend `FightersService.findAll` chỉ trả Fighter đang được phân công (`findAllForCoach`), dùng cùng permission `fighter:get_all` và có cùng filter `medicalStatus`/`search`. Hai cách tương đương nhau.
- `PATCH /training-plans/:id` còn nhận `isActive`, nhưng doc không nhắc.
- Lỗi validation trả 422 `VALIDATION_ERROR` (`zod-validation.pipe.ts`), đúng như doc. `error.details` được filter giữ lại, nên đọc được `details.reasons` của 409 medical gate.

Các quyền baseline suy ra từ migration: FIGHTER chỉ có 7 quyền đọc Training (008) và 3 quyền Medical (011). FIGHTER **không có** `fighter:read`, `fighter:update`, `fighter.session:read`, `fighter.coach:read` hay `fighter.measurement:*`. COACH có 21 quyền (010) và 3 quyền Medical (011). COACH **không có** `training.exercise:create`, `fighter.coach:assign` hay `fighter.measurement:write`.

## Đã có

| Flow | File mobile | API | Khớp ở điểm nào |
| --- | --- | --- | --- |
| Đăng nhập, `/users/me`, refresh, logout, quên/đặt lại mật khẩu (§3) | `src/api/client.ts`, `src/api/auth.ts`, `src/session/session-context.tsx`, `src/screens/auth/reset-password.tsx` | `/auth/*`, `GET /users/me` | Refresh được gom (single-flight), thay cả hai token, xoá phiên khi refresh fail; reset đọc `token_hash` và dùng `admissionActivationReady`, không chờ session. |
| Fighter xem lịch sử hồ sơ gia nhập và kích hoạt (§4) | `src/app/(fighter)/ho-so-cua-toi/*`, `src/screens/admissions/applicant-list.tsx`, `applicant-detail.tsx`, `src/api/admissions.ts` | `GET /fighter-admissions/applications/me[/:id]`, `POST /fighter-admissions/activation` | Đọc `body.data.items`; nút kích hoạt chỉ hiện khi `APPROVED` + `PASSWORD_SET` (đúng guard trong `activate()`); gọi lại `/users/me` sau khi kích hoạt. |
| Fighter xem danh sách và chi tiết kế hoạch, bài tập trong plan (§5) | `src/screens/fighter/plans-screen.tsx`, `plan-detail-screen.tsx` | `GET /training-plans`, `/training-plans/:id`, `/training-plans/:id/exercises`, `/exercises/:id` | Chỉ đọc; hiển thị `progress` và sets/reps/RPE/ghi chú; lấy tên bài qua `exerciseId`. |
| Coach xem roster (§6 bước 2) | `src/screens/coach/fighters-list.tsx` | `GET /fighters?search&medicalStatus` | Backend tự giới hạn theo assignment; có filter `medicalStatus`; list rỗng hiển thị đúng. |
| Coach tạo training plan (§7 bước 2) | `src/screens/coach/plan-form.tsx` | `POST /training-plans` | Gửi `fighterId`, `coachId` lấy từ `/users/me.profile.id`, `title`, `startDate` dạng YYYY-MM-DD; field tuỳ chọn chỉ gửi khi có giá trị. |

## Chưa có hoặc mới một phần

### Việc chung trước tiên: xử lý lỗi và Medical client

Hai việc nền này được nhiều gap bên dưới dùng lại:

- `src/session/map-api-message.ts` đang map **mọi** lỗi 409 thành `registrationConflict` và mọi lỗi 401 thành `invalidCredentials`. Vì vậy các lỗi 409 như medical gate, assessment đã nộp hay xung đột cập nhật đều hiện sai thông báo.
- Mobile chưa có client cho `/fighters/:id/medical`, `/medical/history`, `/medical-examinations`, `/medical-review-requests` và `/doctors`.

---

### 1. Fighter xem lịch tập và chi tiết buổi tập (§5)

- **Rule của doc/backend:** Danh sách lấy từ `GET /training-sessions` (backend tự scope Fighter), filter `status/planId/sessionType/fromDate/toDate`; chi tiết lấy từ `GET /training-sessions/:id`. Fighter baseline **chỉ đọc**, không có nút đổi trạng thái hay nhập RPE. `GET /fighters/:id/sessions` cần `fighter.session:read`, mà Fighter không có quyền này.
- **Mobile hiện tại:**
  - `src/screens/fighter/api.ts` (`listSessionsForFighter`) gọi `/fighters/:id/sessions`. Hậu quả: `sessions-screen.tsx` và `home-screen.tsx` bị 403 với quyền baseline.
  - `session-detail-screen.tsx` có nút Bắt đầu/Bỏ/Huỷ/Hoàn thành/Dừng và form lưu RPE, thời lượng thực tế, lý do huỷ. Với baseline, các nút này bị 403.
  - Form lưu gửi `actualDurationSec` và `cancellationReason` lên `PATCH /training-sessions/:id`. Schema strict từ chối hai field này, nên luôn trả 422.
  - Nút `CANCELLED` không gửi `cancellationReason`, nên cũng trả 422.
- **Mức:** Một phần
- **Plan triển khai:**
  1. `src/screens/fighter/api.ts`: cho `listSessionsForFighter` gọi `listTrainingSessions` (bỏ `fighterId`, backend tự scope). Kiểu trả về đổi từ `TrainingSessionSummary` sang `TrainingSession`; sửa lại type ở `sessions-screen.tsx` và `home-screen.tsx` (chỉ sửa phần load dữ liệu của màn, không đụng preload lúc splash).
  2. `src/screens/fighter/session-detail-screen.tsx`: bỏ map `NEXT`, form kết quả và các import mutation; chỉ giữ phần hiển thị. Nếu sau này cấp quyền ghi cho Fighter thì làm lại theo gap 8.
  3. `src/screens/fighter/api.ts`: bỏ export `setSessionStatus`, `updateTrainingSession` vì không còn chỗ dùng.

### 2. Fighter xem hồ sơ cá nhân (§5)

- **Rule của doc/backend:** Hồ sơ cá nhân đọc từ `GET /users/me` (`data.profile`). `GET/PATCH /fighters/:id` và `GET /fighters/:id/coaches` cần quyền `fighter:*` mà Fighter baseline không có.
- **Mobile hiện tại:** `src/screens/fighter/me-screen.tsx` gọi `getFighter`, `updateFighter` và `listFighterCoaches`, nên cả màn lỗi 403 và form sửa không dùng được. `body-screen.tsx` gọi `/measurements` (đọc và ghi). Khi đọc số đo bị 403, màn throw lỗi, nên phần sức khỏe cũng không hiện.
- **Mức:** Một phần
- **Plan triển khai:**
  1. `me-screen.tsx`: lấy dữ liệu hiển thị từ `useSession().user.profile` (có thể refetch `getMe`). Bỏ form `updateFighter` và phần danh sách HLV, hoặc ẩn khi gặp 403, không coi 403 là lỗi toàn màn.
  2. `body-screen.tsx`: tách phần load. Measurements bị 403 thì chỉ ẩn phần số đo; bỏ form thêm/thay số đo khỏi baseline. Phần sức khỏe chuyển sang dossier ở gap 9.

### 3. Fighter xem thư viện và chi tiết bài tập (§5)

- **Rule của doc/backend:** `GET /exercises?category&targetMuscle&search` và `GET /exercises/:id` (Fighter có quyền đọc).
- **Mobile hiện tại:** Không có màn thư viện hay chi tiết bài tập. `plan-detail-screen.tsx` chỉ dùng `/exercises/:id` để lấy tên bài.
- **Mức:** Một phần
- **Plan triển khai:**
  1. `src/screens/fighter/api.ts`: re-export `listExercises`.
  2. Màn mới `src/screens/fighter/exercise-detail-screen.tsx` và route `src/app/(fighter)/giao-an/bai-tap/[id].tsx` (nằm trong stack `giao-an`) để hiện mô tả, nhóm cơ, `videoUrl`/`thumbnailUrl`.
  3. `plan-detail-screen.tsx`: bấm vào một bài để mở chi tiết. Nếu cần màn thư viện riêng có filter thì hỏi lại chỗ đặt trong điều hướng.

### 4. Coach xem chi tiết Fighter, lịch sử phân công và lịch sử tập (§6 bước 3–4)

- **Rule của doc/backend:** Chi tiết lấy từ `GET /fighters/:id`, lịch sử phân công từ `GET /fighters/:id/coaches`, lịch sử tập tổng quát từ `GET /fighters/:id/sessions` (`/training-sessions?fighterId` chỉ trả buổi mang coachId của chính Coach). Khi gặp 403 thì xoá dữ liệu cũ. Coach **không** tự assign và không ghi số đo theo baseline.
- **Mobile hiện tại:** `src/screens/coach/fighter-detail.tsx` đọc được Fighter và medical-summary, nhưng:
  - Mục "sắp tới" lấy từ `listTrainingSessions({ fighterId })`, là danh sách đã lọc theo Coach, không phải lịch sử tổng quát.
  - Không có tab lịch sử phân công.
  - Có nút "tự phân công" (`POST /fighters/:id/coaches`) và form ghi số đo (`POST /measurements`), cả hai đều 403 với baseline.
  - Khi 403, state `fighter` cũ không bị xoá.
- **Mức:** Một phần
- **Plan triển khai:**
  1. `fighter-detail.tsx`: thêm `listFighterSessions(fighterId)` cho phần lịch sử tập và `listFighterCoaches(fighterId)` cho phần phân công (hai client này đã có trong `src/api/fighters.ts`).
  2. Bỏ `onAssign` và form ghi số đo; chỉ giữ phần đọc measurements.
  3. Trong `catch` của `load`, khi status 403/404 thì reset `fighter/medical/sessions/plans` về rỗng.

### 5. Coach cấu hình plan: sửa, đổi trạng thái, bài tập (§7 bước 3–7)

- **Rule của doc/backend:**
  - `PATCH /training-plans/:id` (có `milestones`; milestone đã xong phải có `completedAt`).
  - `PATCH /training-plans/:id/status`: cấm `COMPLETED/CANCELLED → DRAFT`.
  - `POST/PATCH/DELETE /training-plans/:id/exercises[/:planExerciseId]` với `orderIndex`, `sets`, `reps`, `durationSeconds`, `targetRpe` (số nguyên 1–10), `coachNotes`.
  - Coach **không** được tạo bài mới trong thư viện.
- **Mobile hiện tại:**
  - `src/screens/coach/plan-detail.tsx` gọi đúng API sửa plan, đổi trạng thái và thêm/sửa/xoá bài. Còn thiếu:
    - Chip trạng thái vẫn cho chọn DRAFT từ trạng thái kết thúc.
    - Không hiện `progress`, không có milestones, không có `coachNotes`/`orderIndex` cho bài trong plan.
    - `targetRpe` bị làm tròn thay vì kiểm tra 1–10.
    - Tên bài chỉ tìm trong 50 bài đầu của catalog; không tìm thấy thì hiện UUID.
  - `plans-list.tsx` có form `createExercise` (`POST /exercises`), bị 403 với baseline.
- **Mức:** Một phần
- **Plan triển khai:**
  1. `plan-detail.tsx`: ẩn chip DRAFT khi plan đang `COMPLETED/CANCELLED`; hiện `plan.progress`; kiểm tra `targetRpe` là số nguyên 1–10; thêm field `coachNotes`; lấy tên bài qua `getExercise(exerciseId)` khi không có trong catalog.
  2. `plan-detail.tsx`: thêm editor milestones cho training plan (`title`, `isCompleted`, `completedAt` bắt buộc khi đã xong, `notes`). PATCH chỉ gửi `milestones`.
  3. `plans-list.tsx`: bỏ form tạo bài; chỉ giữ phần đọc catalog.

### 6. Coach tạo training session (§8)

- **Rule của doc/backend:** `POST /training-sessions`, `planId` tuỳ chọn nhưng phải là plan `isActive` của cùng Fighter. Tiến độ plan chỉ đếm các session gắn với plan.
- **Mobile hiện tại:** `src/screens/coach/session-form.tsx` gửi đúng các field bắt buộc và `coachId`, nhưng không cho chọn `planId`, nên `progress` của plan luôn bằng 0.
- **Mức:** Một phần
- **Plan triển khai:**
  1. `session-form.tsx`: sau khi chọn Fighter, gọi `listTrainingPlans({ fighterId, isActive: true })` và thêm picker plan (tuỳ chọn), gửi kèm `planId`.
  2. (Tuỳ chọn) Nhận param `planId` từ `plan-detail.tsx` để mở form với plan đã chọn sẵn.

### 7. Coach điều hành session và medical gate (§8 + §11.6)

- **Rule của doc/backend:**
  - Chỉ cho chuyển `SCHEDULED→IN_PROGRESS|SKIPPED|CANCELLED` và `IN_PROGRESS→COMPLETED|ABANDONED|CANCELLED`. Khi `CANCELLED` bắt buộc gửi `cancellationReason`.
  - `PATCH /training-sessions/:id` **không** nhận `actualDurationSec`/`cancellationReason`.
  - Khi chuyển sang `IN_PROGRESS`, hoặc đổi `sessionType` lúc đang `IN_PROGRESS`, có thể nhận 409 `TRAINING_MEDICAL_ELIGIBILITY_REQUIRED` với `error.details.reasons` (`REVIEW_REQUEST_PENDING`, `EXAMINATION_NOT_ELIGIBLE`, `CLEARANCE_REQUIRED`, `CLEARANCE_EXPIRED`, `SESSION_TYPE_RESTRICTED`). Không cập nhật optimistic; refetch session, dossier và yêu cầu khám.
- **Mobile hiện tại:** `src/screens/coach/session-detail.tsx`:
  - Hiện chip cho cả 6 trạng thái, kể cả chuyển sai.
  - `CANCELLED` không gửi lý do, nên luôn 422.
  - Nút lưu gửi `actualDurationSec` và `cancellationReason`, nên luôn 422.
  - Không sửa được `sessionType`.
  - 409 chỉ hiện thông báo chung (và sai nội dung); không đọc `reasons`, không refetch plan.
  - `UpdateTrainingSessionBody` trong `src/api/types.ts` có 2 field backend không nhận; `UpdateTrainingSessionStatusBody` thiếu `cancellationReason`.
- **Mức:** Một phần
- **Plan triển khai:**
  1. `src/api/types.ts`: bỏ `actualDurationSec` và `cancellationReason` khỏi `UpdateTrainingSessionBody`; thêm `cancellationReason?: string` vào `UpdateTrainingSessionStatusBody`.
  2. `src/api/errors.ts`: thêm helper `medicalGateReasons(error): string[] | null`, trả mảng khi `code === "TRAINING_MEDICAL_ELIGIBILITY_REQUIRED"`, đọc từ `details.reasons`.
  3. `src/session/map-api-message.ts`: 409 mặc định dùng thông báo "dữ liệu đã thay đổi, tải lại"; chỉ `REGISTRATION_CONFLICT` giữ copy đăng ký. Thêm copy cho `TRAINING_MEDICAL_ELIGIBILITY_REQUIRED`. Xem lại chỗ map 401 cho các màn không phải login.
  4. `src/i18n/coach.ts`: thêm copy cho 5 reason code.
  5. `session-detail.tsx`: chỉ hiện các chuyển trạng thái hợp lệ (dùng bảng giống `ALLOWED_SESSION_TRANSITIONS`); `CANCELLED` bắt buộc nhập lý do và gửi qua route status; form sửa chỉ gửi `coachNotes`, `reportedRpe`, `sessionType` (cùng các field lịch nếu cần). Khi gặp 409 gate thì hiện danh sách lý do và link sang hồ sơ y tế/yêu cầu khám (gap 12), rồi refetch session. Nếu có `planId` thì refetch cả plan.

### 8. Coach đánh giá hồ sơ đầu vào (§9)

- **Rule của doc/backend:** `POST /fighter-admissions/assigned/:id/assessment` với `{ conclusion, summary, criteria[1..30] }`; mỗi criterion có `criterionName/method/observation`, thêm `value/unit/note` tuỳ chọn. Chỉ hợp lệ khi hồ sơ còn `SUBMITTED`; không có API sửa/xoá; nộp trùng trả 409.
- **Mobile hiện tại:** `src/screens/admissions/staff-detail.tsx` (`audience="coach"`) gọi đúng API nhưng:
  - Chỉ nhập được 1 criterion, không có `value/unit/note`.
  - Form luôn hiện, kể cả khi status khác `SUBMITTED` hoặc đã có `assessment`.
  - Không hiện assessment đã nộp.
  - 409 hiện sai copy.
- **Mức:** Một phần
- **Plan triển khai:**
  1. `staff-detail.tsx`: chỉ hiện form khi `item.status === "SUBMITTED" && !item.assessment`; ngược lại hiện assessment chỉ đọc (conclusion, summary, criteria).
  2. Cho thêm/xoá criterion (tối đa 30), thêm field `value` (số), `unit`, `note`.
  3. Dùng message 409 đã sửa ở gap 7 bước 3; sau 409 thì tải lại.

### 9. Fighter xem hồ sơ sức khỏe (dossier) và recovery milestones (§11.2, §11.4, §11.5)

- **Rule của doc/backend:** `GET /fighters/:id/medical` (`fighter.medical:read`, chỉ bản thân) trả `activeInjuries`, `activeRecoveryPlans` (có milestones), `currentExaminations.training/competition`, `activeClearances` (có `isCurrentlyValid`, `restrictions`), `openReviewRequests`, `eligibility.training/competition`. Không tự chọn "giấy chi phối" từ `activeClearances`. Milestones có thể ở dạng legacy, cần hiển thị chỉ đọc.
- **Mobile hiện tại:** `home-screen.tsx` và `body-screen.tsx` chỉ dùng `/medical-summary` (shape cũ) và suy ra "bị hạn chế" từ `currentMedicalStatus`. Chưa có client hay màn nào cho dossier.
- **Mức:** Chưa có
- **Plan triển khai:**
  1. `src/api/types.ts`: thêm type theo response schema trong `nestjs-api/src/medical/medical.model.ts`: dossier, examination, clearance, recovery plan và milestone (chuẩn hoặc legacy `unknown[]`), review request, history entry, doctor assignment.
  2. File mới `src/api/medical.ts` (theo mẫu `fighters.ts`, dùng `apiFetch` + `withQuery`): `getFighterMedical`, `listFighterMedicalHistory`, `listFighterMedicalExaminations`, `listFighterReviewRequests`, `createFighterReviewRequest`, `listFighterDoctors`. List dùng `Paginated<T>`. Export trong `src/api/index.ts`.
  3. Component dùng chung mới `src/components/medical/medical-dossier-view.tsx`: hiện eligibility theo phạm vi, kết luận hiện hành, danh sách clearance kèm hạn chế và 2 loại notes, chấn thương, recovery milestones (kiểm tra dạng dữ liệu trước khi render), và disclaimer.
  4. `body-screen.tsx`: thay phần medical-summary bằng dossier view. `home-screen.tsx`: thẻ sức khỏe dùng `eligibility.training`, không dùng `currentMedicalStatus` (chỉ sửa phần load dữ liệu của màn home, không đụng splash).
  5. `src/app/(fighter)/suc-khoe/chan-thuong/[id].tsx`: backend **không có** `GET /injuries/:id`. Chỉ render từ dossier (`activeInjuries`) hoặc từ history snapshot; nếu cần endpoint chi tiết riêng thì **STOP và hỏi**.

### 10. Fighter xem lịch sử y tế và lịch sử kết luận khám (§11.2, §11.5)

- **Rule của doc/backend:** `GET /fighters/:id/medical/history?recordType=…` trả các entry có `recordType`, `revision`, `source`, `recordedAt`, `snapshot` (key snake_case). `GET /fighters/:id/medical-examinations?scope=…`. Chỉ đọc.
- **Mobile hiện tại:** `src/app/(fighter)/suc-khoe/lich-su.tsx` là `BlockedFighterPage`, không có dữ liệu.
- **Mức:** Chưa có
- **Plan triển khai:**
  1. Dùng client ở gap 9 bước 2.
  2. Màn mới `src/screens/medical/medical-history-screen.tsx` (dùng chung cho Fighter và Coach): filter `recordType`, phân trang theo `hasNextPage`, adapter snapshot theo `recordType`, hiện nhãn `MIGRATION_BASELINE`; tab kết luận khám với filter `scope`.
  3. `suc-khoe/lich-su.tsx`: render màn trên với `fighterId` lấy từ `useFighterId`.

### 11. Fighter gửi và theo dõi yêu cầu khám (§11.3)

- **Rule của doc/backend:** `GET /fighters/:id/medical-review-requests?status=OPEN|RESOLVED`; `POST` chỉ gửi `{ reason }` (đã trim, 1–2000 ký tự), trả 201, **không idempotent**. Sau khi gửi thì refetch dossier và danh sách. Không có API resolve/huỷ. `RESOLVED` không có nghĩa là đã đủ điều kiện tập.
- **Mobile hiện tại:** Không có màn.
- **Mức:** Chưa có
- **Plan triển khai:**
  1. Component mới `src/components/medical/review-request-panel.tsx`: danh sách có filter status và form lý do (đếm ký tự, khoá nút khi đang gửi). Khi response bị mất thì refetch danh sách trước khi cho gửi lại.
  2. Gắn panel vào `body-screen.tsx` dưới dossier view.

### 12. Coach xem hồ sơ y tế của Fighter và gửi yêu cầu khám (§11.1–§11.3)

- **Rule của doc/backend:** Giống gap 9–11, nhưng dành cho Fighter trong assignment hiện tại. Có thêm `GET /fighters/:id/doctors` (`fighter.doctor:read`). Gặp 403 `MEDICAL_ACCESS_DENIED`/`FORBIDDEN` thì đóng view và xoá cache.
- **Mobile hiện tại:** `src/screens/coach/fighter-detail.tsx` chỉ hiện `/medical-summary` (clearance số ít, chấn thương). `src/app/(coach)/clearance.tsx` là trang blocked.
- **Mức:** Chưa có
- **Plan triển khai:**
  1. Route mới `src/app/(coach)/fighters/[id]/medical.tsx` và khai báo trong `fighters/[id]/_layout.tsx`. Route này render `medical-dossier-view`, `review-request-panel` và danh sách Doctor assignment (chỉ đọc, không có nút assign/end), cùng link sang `medical-history-screen`.
  2. `fighter-detail.tsx`: thay thẻ medical-summary bằng tóm tắt `eligibility.training` và link sang route trên.
  3. Gặp 403 trong route trên thì reset state và quay về roster.

### 13. Fighter xem lịch sử Doctor assignment (§11.1)

- **Rule của doc/backend:** `GET /fighters/:id/doctors?page&limit`, trả `doctorId`, `doctorName?`, `startsAt`, `endsAt`, `endReason`. Chỉ đọc.
- **Mobile hiện tại:** Không có.
- **Mức:** Chưa có
- **Plan triển khai:** Dùng client `listFighterDoctors` (gap 9) và thêm một section chỉ đọc trong `me-screen.tsx` hoặc `body-screen.tsx`.

## Thứ tự nên làm

1. Việc chung: sửa `map-api-message.ts` (409/401), sửa type session trong `types.ts`, thêm helper `medicalGateReasons` (gap 7 bước 1–3). — **Đã làm**
2. Gap 1: Fighter lịch tập (chuyển sang `/training-sessions`, bỏ mutation). — **Đã làm**
3. Gap 2: Fighter hồ sơ cá nhân (dùng `/users/me`, bỏ phụ thuộc `fighter:*`). — **Đã làm**
4. Gap 4: Coach chi tiết Fighter (lịch sử phân công và lịch sử tập, bỏ assign/ghi số đo). — **Đã làm**
5. Medical client và types (gap 9 bước 1–2). — **Đã làm**
6. Gap 9: Fighter dossier và recovery milestones (chỉ đọc). — **Đã làm** (chi tiết chấn thương render từ dossier/history snapshot, không gọi `GET /injuries/:id`)
7. Gap 10: Lịch sử y tế và kết luận khám (chỉ đọc, dùng chung). — **Đã làm**
8. Gap 13: Fighter lịch sử Doctor assignment (chỉ đọc). — **Đã làm** (section trong `me-screen.tsx`)
9. Gap 12 (phần đọc): Coach hồ sơ y tế Fighter. — **Đã làm** (route `fighters/[id]/medical` và `fighters/[id]/medical-history`)
10. Gap 3: Fighter thư viện và chi tiết bài tập (chỉ đọc). — **Đã làm** (thư viện có filter đặt trong stack `giao-an`: `giao-an/bai-tap`)
11. Gap 11 và Gap 12 (phần gửi): yêu cầu khám cho Fighter và Coach. — **Đã làm**
12. Gap 7: Coach điều hành session và xử lý medical gate. — **Đã làm**
13. Gap 6: Coach gắn `planId` khi tạo session. — **Đã làm**
14. Gap 5: Coach cấu hình plan (DRAFT guard, progress, milestones, bỏ tạo bài). — **Đã làm**
15. Gap 8: Coach đánh giá đầu vào (nhiều criteria, khoá theo trạng thái). — **Đã làm**

## Chưa xác minh

- Chưa rõ migration 008–012 đã chạy trên database đích hay chưa, và có override quyền theo user hay không. Các kết luận 403 ở trên đều dựa vào baseline suy ra từ SQL.
- Không chạy app hay test trên thiết bị. Không đối chiếu Figma cho các màn mới đề xuất.
- Chưa đọc chi tiết từng field response của Medical. Các type ở gap 9 phải lấy trực tiếp từ `medical.model.ts` khi triển khai.
