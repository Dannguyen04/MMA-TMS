# T-074 Thay đổi ngoài app mobile trong đợt làm lại giao diện mobile

- Trạng thái: CHỜ REVIEW. Ngày: 14/11/2026. Nhánh: `feat/mobile-platform`.
- Người làm: Claude, trong phiên làm lại giao diện `reactnative-mobile` (10/11 – 14/11).
- Phạm vi ghi ở đây: các thay đổi **ngoài** `reactnative-mobile`, chủ yếu ở `nestjs-api`. Phần mobile ghi ở [IMPLEMENTATION-CONTEXT](../IMPLEMENTATION-CONTEXT.md) và [REDESIGN-BRIEF-2026-11](../../reactnative-mobile/docs/REDESIGN-BRIEF-2026-11.md).
- Không có migration, không đổi mã lỗi. `nextjs-frontend` và `worker` không đổi.

## Tóm tắt

| # | Thay đổi | Vùng | Lý do | Đã commit? |
| --- | --- | --- | --- | --- |
| 1 | `GET /bouts` nhận `order=desc` | `nestjs-api/src/bouts` | Danh sách trận trên mobile cần trận mới nhất lên đầu | Có (`fc72735`) |
| 2 | Module mới `schedule`: `GET /doctor/schedule`, `GET /doctor/review-requests` | `nestjs-api/src/schedule` (mới), `app.module.ts` | Tab Lịch và màn Hôm nay của bác sĩ trên mobile | Chưa |
| 3 | Sửa lỗi làm mới phiên đăng nhập (`/auth/refresh` luôn trả 422) | `nestjs-api/src/auth` | Người dùng bị đăng xuất khi access token hết hạn | Chưa |
| 4 | Trạng thái y tế tóm tắt của võ sĩ tính lại từ hồ sơ khám (P0) | `nestjs-api/src/medical` | Danh sách của nhân viên báo "Khỏe" cho võ sĩ đang chấn thương | Chưa |
| 5 | Trang xem trước thiết kế và nguồn model 3D | `design-previews/` (mới) | Duyệt thiết kế trước khi làm, không chạy trong app | Chưa |

## 1. `GET /bouts?order=desc` (10/11)

- `bouts.model.ts`: query có thêm `order: 'asc' | 'desc'` (không bắt buộc). Bỏ trống là `asc`, nên client cũ (web HLV) không bị ảnh hưởng.
- Repo và service đảo chiều sắp xếp theo `weigh_in_at, id` và đảo chiều cursor tương ứng.
- Mobile gọi `order=desc`, mỗi trang 20 trận, có nút "Xem thêm".

## 2. Module `schedule` cho bác sĩ (11/11)

File mới trong `nestjs-api/src/schedule/`: `schedule.module.ts`, `doctor-schedule.{controller,model,repo,service}.ts`, `doctor-reviews.model.ts`, kèm spec. Đăng ký `ScheduleModule` trong `app.module.ts`.

- **`GET /doctor/schedule?from&to`:**
  - Chỉ dành cho DOCTOR, cần quyền `bout:get_all` và `suspension:read`.
  - Khoảng ngày tối đa 62 ngày, tính theo ngày của học viện.
  - Trả các mục:
    - `FOLLOW_UP`: `followUpDate` của các phiếu khám hiện hành.
    - `CLEARANCE_EXPIRY`: `validUntil` của giấy phép còn hiệu lực, chưa bị thu hồi.
    - `WEIGH_IN`, `BOUT`: các trận chưa kết thúc.
    - `SUSPENSION_END`: đình chỉ chưa xác nhận tập lại hoặc đã kết thúc sớm.
  - Hạn đình chỉ và lịch tái khám của cùng võ sĩ trong cùng ngày được gộp làm một.
- **`GET /doctor/review-requests`:**
  - Chỉ dành cho DOCTOR, cần quyền `fighter.medical:read`.
  - Trả các yêu cầu xem xét y tế còn `OPEN` của võ sĩ được phân cho bác sĩ, cũ nhất trước.
  - Tối đa 50 mục, kèm cờ `truncated`.
  - Tên người gửi lấy từ `coaches` hoặc `sports_doctors`.
- Chỉ đọc, không ghi database.

## 3. Làm mới phiên đăng nhập (13/11)

- **Lỗi:** `refreshBodySchema` bắt `refreshToken` dài ít nhất 20 ký tự, nhưng refresh token của Supabase hiện chỉ 12 ký tự. Vì vậy mọi lần gọi `/auth/refresh` đều trả 422, và người dùng bị đăng xuất khi access token hết hạn.
- **Sửa:** đổi thành `z.string().trim().min(8).max(4_096)` trong `auth.model.ts`. Spec có thêm ca token 12 ký tự.
- **Ảnh hưởng tới web:** web cũng gọi `/auth/refresh` nên hưởng luôn bản sửa này, không cần đổi code web.

## 4. Trạng thái y tế tóm tắt tính từ hồ sơ khám (P0, 13/11)

- **Lỗi:**
  - Cột `fighters.current_medical_status` có trước module khám lâm sàng, và không có chỗ nào ghi vào nó.
  - Danh sách, bộ lọc, ô đếm của nhân viên và bản tóm tắt y tế đều đọc cột này.
  - Hậu quả: võ sĩ Minh Trần đang chấn thương cổ chân, giấy phép hạn chế chưa có hiệu lực tới 01/12, vẫn hiện "Khỏe".
- **Quy tắc** (`medical-status.ts`, hàm `deriveMedicalStatus`). Xét lần lượt, gặp điều kiện nào đúng trước thì lấy kết quả đó:
  1. Có chấn thương `ACTIVE` → `INJURED`.
  2. Không đủ điều kiện tập (dùng cùng `evaluateEligibility` với cổng bắt đầu buổi tập) → `NOT_CLEARED`.
  3. Có chấn thương `RECOVERING` hoặc kế hoạch hồi phục đang chạy → `RECOVERY`.
  4. Phiếu khám `TRAINING` hiện hành là `ELIGIBLE_WITH_RESTRICTIONS` → `MONITORING`.
  5. Còn lại → `HEALTHY`.
- **Khi nào chạy:**
  - **Sau mỗi lần ghi hồ sơ khám:** `MedicalService.syncMedicalStatus` chạy trong cùng transaction (hàm `writeFor`). Áp dụng cho yêu cầu xem xét, chấn thương (tạo, sửa), kế hoạch hồi phục (tạo, sửa), phiếu khám, cấp và thu hồi giấy phép. Điều trị không làm đổi trạng thái.
  - **Định kỳ:** `MedicalStatusRefresher` (mới, file `medical-status-refresher.service.ts`, đăng ký trong `medical.module.ts`) chạy `syncAllMedicalStatuses` một lần khi khởi động để điền lại dữ liệu cũ, sau đó mỗi giờ một lần để bắt các giấy phép bắt đầu hoặc hết hạn theo ngày.
  - Chỉ cập nhật những dòng có trạng thái khác giá trị đang lưu. Võ sĩ nào lỗi thì bỏ qua, các võ sĩ khác vẫn chạy tiếp.
  - Tắt khi `NODE_ENV=test` hoặc `MEDICAL_STATUS_REFRESH=off`.
- **Repo** (`medical.repo.ts`): thêm `updateFighterMedicalStatus` (chỉ ghi khi giá trị khác) và `listActiveFighterIds`.
- **Đã chạy trên Supabase dùng chung:** lần điền lại khi khởi động đã chạy lúc khởi động lại API ngày 13/11 23:49. Minh Trần giờ là `INJURED`: trang bác sĩ hiện "Chấn thương", màn Hôm nay của bác sĩ hiện "Võ sĩ cần theo dõi 2".
- **Lưu ý cho người review:** đây là thay đổi hành vi dữ liệu dùng chung. Mỗi lần khởi động và mỗi giờ, service sẽ ghi `current_medical_status` cho mọi võ sĩ đang hoạt động có trạng thái lệch. Web đọc cột này nên sẽ thấy giá trị mới.

## 5. Ngoài app, không chạy trong sản phẩm

- `design-previews/*.html`: các trang HTML tĩnh để chủ dự án duyệt thiết kế mobile. Mở bằng `python -m http.server 4321 --directory design-previews`.
- `design-previews/models-src/`: nguồn model 3D cho võ sĩ nữ, đều theo giấy phép CC BY 4.0, phải ghi công nếu dùng.
  - `ren/female_muscle_human_body.glb`: thân người, của Ren (Sketchfab).
  - `kost/sport_cloth_women.glb`: trang phục, của Kost_A (Sketchfab).
  - `vo-si-nu.blend`: bản đã chỉnh. Gồm chân đặt phẳng, áo bra cắt quai thành không dây, quần ướm theo người, mặt làm trơn, cơ làm rõ, vải dày 1,5 mm.
  - Chưa đưa model nữ vào app (chủ dự án chốt 14/11).

## Kiểm tra (14/11)

- `npx vitest run src/medical src/schedule src/auth/auth.model.spec.ts src/bouts`: 21 file, 546 test qua.
- `oxlint src/medical src/schedule src/auth`: chỉ còn một cảnh báo có từ trước (import không dùng trong `scat6.model.spec.ts`), không phải do đợt này.
- Chưa chạy `test:db`. Lý do: không có migration.
- Chưa chạy toàn bộ test backend trong đợt này.

## Việc còn lại

- Review độc lập phần 2, 3 và 4, nhất là service chạy định kỳ ở phần 4.
- Commit các phần chưa commit. Chờ chủ dự án cho phép.
- Báo team web: `current_medical_status` giờ phản ánh đúng hồ sơ khám, và có endpoint mới `/doctor/schedule`, `/doctor/review-requests` nếu web muốn dùng.
