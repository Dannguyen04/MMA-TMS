# Trạng thái logic mobile

Cập nhật ngày 2026-09-28. Nguồn: `docs/FE-FIGHTER-COACH-FLOWS.md`, `docs/FE-FIGHTER-COACH-MOBILE-GAP.md` và báo cáo `reactnative-mobile/MMA-TMS_Web_vs_Mobile_Parity_Audit_2026-09-21.docx`. Mọi mục bên dưới đã được đối chiếu với code trong `reactnative-mobile/src` (đọc tĩnh), không chỉ dựa vào dòng "Đã làm" của gap doc. Chưa kiểm tra trên thiết bị.

**Ghi chú doc so với backend:**

- Roster: flows doc gợi ý `GET /coaches/:coachId/fighters`. Mobile dùng `GET /fighters`; với COACH, backend chỉ trả Fighter đang được phân công, nên hai cách tương đương.
- Backend không có `GET /injuries/:id`.
- `PATCH /training-plans/:id` còn nhận `isActive`, flows doc không nhắc.

## Đã làm

### Splash / intro

- Tiến độ tổng của splash gồm 3 lần đọc AsyncStorage và bước khôi phục phiên (`GET /users/me`), mỗi phần 25%.
- Thanh tiến độ chỉ hiện khi hiệu ứng kính vỡ chạy xong. Thanh chạy theo % thật, hoặc tua nhanh khoảng 320ms nếu đã xong. Đã bỏ nhịp giả 2 giây cũ.
- Các query của màn home Fighter **không** nằm trong điều kiện chờ của splash.

### Võ sĩ và HLV

1. **Xử lý lỗi dùng chung**: `src/session/map-api-message.ts`, `src/api/errors.ts`, `src/api/types.ts`. Copy 409 "đăng ký" chỉ dùng cho `REGISTRATION_CONFLICT`. Có `medicalGateReasons()` đọc `details.reasons` khi code là `TRAINING_MEDICAL_ELIGIBILITY_REQUIRED`. Type PATCH session đã bỏ `actualDurationSec`/`cancellationReason`; body đổi trạng thái có `cancellationReason`.
2. **Fighter lịch tập**: `src/screens/fighter/api.ts`, `sessions-screen.tsx`, `session-detail-screen.tsx`. Lấy từ `GET /training-sessions` (backend tự scope). Chi tiết buổi chỉ đọc, không đổi trạng thái hay nhập RPE. Danh sách chỉ lọc theo status.
3. **Fighter hồ sơ cá nhân**: `src/screens/fighter/me-screen.tsx`. Dữ liệu từ `getMe()`/profile trong session. Không có form sửa, không gọi `getFighter`, `updateFighter`, `listFighterCoaches`.
4. **Coach chi tiết Fighter**: `src/screens/coach/fighter-detail.tsx`. Lịch sử tập từ `GET /fighters/:id/sessions`, có lịch sử phân công (`listFighterCoaches`). Không có nút tự phân công, không có form ghi số đo. Reset state khi gặp 403/404.
5. **Medical client**: `src/api/medical.ts`, đủ 6 route (dossier, history, examinations, review requests GET/POST, doctors). Type theo `nestjs-api/src/medical/medical.model.ts`.
6. **Fighter dossier và recovery milestones**: `src/components/medical/medical-dossier-view.tsx`, `src/screens/fighter/body-screen.tsx`. Chỉ đọc. Chi tiết chấn thương (`src/screens/fighter/injury-detail-screen.tsx`) render từ dossier hoặc history snapshot, không gọi `GET /injuries/:id`.
7. **Lịch sử y tế**: `src/screens/medical/medical-history-screen.tsx`, route `src/app/(fighter)/suc-khoe/lich-su.tsx`. Có filter `recordType`, filter `scope` cho kết luận khám, phân trang theo `hasNextPage`.
8. **Fighter xem Doctor assignment**: `src/components/medical/doctor-assignment-list.tsx`, gắn trong `me-screen.tsx`. Chỉ đọc.
9. **Coach xem hồ sơ y tế Fighter**: `src/screens/coach/fighter-medical.tsx`, route `src/app/(coach)/fighters/[id]/medical.tsx` và `medical-history.tsx`. Gồm dossier, lịch sử, panel yêu cầu khám, danh sách Doctor. Xoá dữ liệu và rời màn khi mất quyền (403/404).
10. **Fighter thư viện bài tập**: `src/screens/fighter/exercise-screens.tsx`, route `src/app/(fighter)/giao-an/bai-tap/index.tsx` và `[id].tsx`. Có filter category, nhóm cơ, tìm kiếm, phân trang. Bài trong plan (`plan-detail-screen.tsx`) mở được chi tiết.
11. **Yêu cầu khám**: `src/components/medical/review-request-panel.tsx`. Chỉ gửi `{ reason }` (đã trim). Không có thao tác resolve/huỷ.
12. **Coach điều hành session**: `src/screens/coach/session-detail.tsx`. Chỉ hiện chuyển trạng thái hợp lệ (`ALLOWED_SESSION_TRANSITIONS`). `CANCELLED` bắt buộc lý do. 409 medical gate hiện danh sách lý do và link sang hồ sơ y tế. Không cập nhật optimistic. Form chỉ sửa ghi chú, RPE, loại buổi.
13. **Coach tạo session có plan**: `src/screens/coach/session-form.tsx`. Picker plan lấy từ `listTrainingPlans({ fighterId, isActive: true })`, gửi `planId`. Nhận sẵn `planId` từ màn plan.
14. **Coach cấu hình plan**: `src/screens/coach/plan-detail.tsx`, `plans-list.tsx`. Ẩn DRAFT khi plan đã kết thúc (`FORBIDDEN_PLAN_TRANSITIONS`). Hiện `progress`. Có editor milestones (đã xong phải có `completedAt`). Bài trong plan có `orderIndex`, `coachNotes`, `targetRpe` nguyên 1–10. Đã bỏ form tạo bài mới. Catalog là `listExercises({ limit: 50 })`, gọi lại mỗi lần tải màn (xem giới hạn ở phần Chưa làm).
15. **Coach đánh giá đầu vào**: `src/screens/admissions/staff-detail.tsx`. Form chỉ hiện khi hồ sơ `SUBMITTED` và chưa có assessment; nếu đã có thì hiện assessment chỉ đọc. Cho 1–30 criteria. Gặp 409 thì tải lại.

## Chưa làm

### Võ sĩ và HLV (API đã có)

1. **Catalog bài tập của Coach bị giới hạn 50 bài.**
   - Rule: `GET /exercises` hỗ trợ `category`, `targetMuscle`, `search`, phân trang.
   - File: `src/screens/coach/plan-detail.tsx`.
   - Hiện tại: chỉ tải 50 bài đầu, không có tìm kiếm, filter hay phân trang khi thêm bài vào plan. Bài ngoài 50 bài đầu thì không thêm được từ màn này (tên bài đã có trong plan vẫn được lấy qua `getExercise`).
2. **Coach không sửa được thông tin lịch của session sau khi tạo.**
   - Rule: `PATCH /training-sessions/:id` nhận `title`, `scheduledAt`, `location`, `plannedDurationSec`, `roundCount`.
   - File: `src/screens/coach/session-detail.tsx`.
   - Hiện tại: form chỉ có ghi chú, RPE, loại buổi.
3. **Lưu session gửi lại ghi chú và RPE dù không đổi.**
   - File: `src/screens/coach/session-detail.tsx` (`onSave`).
   - Hiện tại: luôn gửi `coachNotes` và `reportedRpe`; chỉ `sessionType` được so sánh với giá trị cũ.
4. **Sau 409 medical gate chưa refetch dữ liệu y tế tại chỗ.**
   - Rule (§11.6): refetch session, dossier và yêu cầu khám.
   - File: `src/screens/coach/session-detail.tsx` (`handleFailure`).
   - Hiện tại: refetch session và plan liên kết; dossier và yêu cầu khám chỉ tải khi người dùng mở link sang màn y tế.
5. **Lỗi 422 chưa gắn vào từng field.**
   - Rule: 422 `VALIDATION_ERROR` có `error.details`.
   - File: các form Coach (`coach-error.ts` và các màn gọi nó), `src/screens/fighter/errors.ts`.
   - Hiện tại: hiện một banner lỗi chung.
6. **Fighter chưa mở được plan từ chi tiết buổi tập.**
   - File: `src/screens/fighter/session-detail-screen.tsx`.
   - Hiện tại: không đọc `planId`, không có link sang plan.
7. **Fighter lọc lịch tập chỉ theo status.**
   - Rule: `GET /training-sessions` nhận `status`, `planId`, `sessionType`, `fromDate`, `toDate`.
   - File: `src/screens/fighter/sessions-screen.tsx`.
   - Hiện tại: chỉ có chip status.
8. **Fighter chưa thấy milestones của training plan.**
   - File: `src/screens/fighter/plan-detail-screen.tsx`.
   - Hiện tại: hiện `progress` (số buổi đã xong), không render `plan.milestones`.

### Chưa làm được vì chưa có API

**STOP.** Các mục dưới đây cần hợp đồng backend mới. Không tự đặt endpoint hay payload; phải hỏi trước khi làm.

1. **Video và AI (P0 trong docx)**: upload video, tiến độ job, evidence/findings, Coach review/override, điểm số và lịch sử/tiến độ của Fighter. Backend `/jobs` là bản cũ: nhận `videoUrl` công khai, không gắn quyền sở hữu theo Fighter, không có upload, không có endpoint finding/review. Các route video trên mobile (`src/app/(fighter)/video/*`, `src/app/(coach)/video-analysis/*`, `src/app/(coach)/fighters/[id]/videos.tsx`) chỉ là placeholder.
2. **Performance, goals, notifications**: backend chưa có module. Các route `hieu-suat`, `muc-tieu`, `thong-bao` và `performance`/`goals` của Coach là placeholder.

### Bác sĩ, admin, khách

- **Bác sĩ (P2 trong docx)**: backend đã có API ghi lâm sàng và assignment. Mobile: các màn ghi của Doctor (`examinations/new`, `injuries/new`, `recovery/new`, `clearance/new`) là placeholder `DisabledForm`. `src/screens/doctor/medical-screen.tsx` vẫn dùng `GET /fighters/:id/medical-summary` (shape cũ), chưa dùng dossier.
- **Admin (P3)**: backend có users/authorization. Mobile admin phần lớn là placeholder (ví dụ `quan-tri/nguoi-dung.tsx`, `quan-tri/thong-bao.tsx`), trừ thao tác staff cho hồ sơ gia nhập.
- **Khách**: docx không nêu yêu cầu riêng cho guest.
- **Copy lỗi thời** trong `src/i18n/blocked.ts`: vẫn ghi `/jobs` không có guard, "không có controller ghi khám", và đọc giấy phép qua `medical-summary`. Đây là lệch copy, không phải lỗ hổng logic của Fighter/Coach.

## Không nằm trong kết luận

- Chưa xác nhận migration 008–012 đã chạy trên database thật, cũng như có override quyền theo user hay không.
- Chưa chạy app hay test trên thiết bị.
- Chưa đối chiếu Figma.
