# T-060 Ba khung lỗi thoáng qua trong ma trận API mode

- Trạng thái: DRAFT. Ngày: 08/11/2026. Người nhận: chưa giao.
- Phạm vi: phân loại các quan sát trong audit. Chưa xác nhận ba tuyến có chung nguyên nhân.

## Tái hiện

1. Dùng frontend API mode và tài khoản test đúng role.
2. Chạy cùng chuỗi mở tuyến như audit production, sau đó thử từng tuyến riêng.
3. Với Quản trị, lấy một hồ sơ từ liên kết trong danh sách đơn.

| Role | Route | Lượt ma trận | Lượt kiểm tra lại cổng 3042 |
| --- | --- | --- | --- |
| Võ sĩ | `/fighter/schedule` | HTTP 200, hiện khung lỗi | HTTP 200, render, 0 lỗi console |
| HLV | `/coach/training-plans` | HTTP 500, hiện khung lỗi | HTTP 200, render, 0 lỗi console |
| Quản trị | `/admin/admissions/[applicationId]` | HTTP 200, hiện khung lỗi | HTTP 200, render, 0 lỗi console |

## Kỳ vọng

Các màn hình hiển thị nội dung hoặc trạng thái nghiệp vụ phù hợp, cả khi mở riêng và khi chuyển nhanh giữa các màn hình.

## Tiêu chí nghiệm thu

- Ghi môi trường, phiên và tải tại lúc lỗi. Phân biệt lỗi của runner, request bị hủy và lỗi ứng dụng.
- Tách thành ticket riêng nếu xác nhận các nguyên nhân khác nhau. Dẫn chiếu mục kiểm tra lại trong `nextjs-frontend/ui-api-audit.local.md`.

## Điều tra 9/11

Chưa tái hiện được vì không có API mode. Ba tuyến không có chung một chỗ lỗi trong code. Điểm chung là một GET lỗi thoáng qua (mạng, timeout 10 giây ở `nextjs-frontend/src/lib/api/client.ts:13`, hoặc 5xx) làm cả trang ném lỗi. Đã sửa để GET phụ không còn làm hỏng trang. GET bắt buộc vẫn ném lỗi để hiện khung lỗi của tuyến.

**Cách đọc status trong ma trận**

Cả ba trang nằm dưới `src/app/(app)/loading.tsx`; hai trang Võ sĩ và HLV còn có `loading.tsx` riêng. Khi trang đã bắt đầu stream, Next.js chốt HTTP 200, nên lỗi của trang chỉ hiện thành "HTTP 200 + khung lỗi" (`node_modules/next/dist/docs/01-app/02-guides/streaming.md`, mục Status codes). "HTTP 500 + khung lỗi" ở `/coach/training-plans` nghĩa là lỗi xảy ra trước khi stream, tức ở `src/app/(app)/layout.tsx`. Layout này nằm ngoài mọi Suspense và lỗi rơi về `global-error.tsx`. Các GET của layout:

- `requireUser`, tức `/users/me`.
- Với HLV, `withAssignmentScope` còn đọc hết danh sách `/fighters` (`src/lib/auth/session.ts`) vì `/users/me` của backend không trả `assignmentScope`.

Phần này nằm ngoài phạm vi lần sửa này nên chưa đổi.

**`/fighter/schedule` (Võ sĩ)**

- Bắt buộc: buổi tập trong tuần và buổi tập sắp tới, cùng gọi `/training-sessions`. FIGHTER có `training.session:get_all` (`008`), controller ở `training-session.controller.ts:55-56`. Nếu xem lỗi là "không có buổi nào" thì sẽ báo sai cho võ sĩ, nên giữ bắt buộc.
- Phụ:
  - Cấp phép (`/fighters/:id/medical`): khi lỗi, trang hiện thông báo "chưa kiểm tra được cấp phép" kèm liên kết Sức khỏe, không ẩn im lặng.
  - Thẻ giáo án hiện tại (`/training-plans`): khi lỗi thì bỏ thẻ.
  - Tên HLV (`/coaches`): FIGHTER bị 403 theo thiết kế, nay không gọi nữa.

**`/coach/training-plans` (HLV)**

- Bắt buộc: `/training-plans`.
- Phụ:
  - Danh sách võ sĩ (tên, bộ lọc).
  - Tỷ lệ tuân thủ: `listSessions` đọc mọi buổi tập của mọi võ sĩ được giao, là GET nặng nhất, giới hạn 5000 mục. Khi lỗi, trang vẫn liệt kê giáo án, bỏ tên võ sĩ hoặc hiện "—" ở tỷ lệ tuân thủ.

**`/admin/admissions/[applicationId]` (Quản trị)**

- Bắt buộc: hồ sơ đăng ký. Controller chỉ cho ADMIN (`fighter-admissions.controller.ts:179-182`).
- Phụ:
  - Danh sách HLV (`/users?role=COACH`, ADMIN có `users.read`): khi lỗi, tên HLV hiện thành "HLV" và form phân công được thay bằng câu báo chưa tải được.
  - Đội chăm sóc sau kích hoạt (`/users/:id` và phân công): khi lỗi, thẻ hiện liên kết "Kiểm tra đội chăm sóc".

**File đã sửa**

- Trang: `fighter/schedule/page.tsx`, `coach/training-plans/page.tsx`, `admin/admissions/[applicationId]/page.tsx`.
- Service: `src/lib/services/people.ts` (xem T-058).
- Từ điển: `training.en.ts`/`training.vi.ts` (`training.clearanceBanner.unavailable*`), `screens-admin.en.ts`/`screens-admin.vi.ts` (`screens.admin.application.coachesUnavailable`).

**Cần kiểm tra trong API mode với tài khoản thật**

1. Chạy lại ma trận và mở từng tuyến riêng. Khi lỗi, ghi digest trong log Next server và GET lỗi trong log NestJS (status, thời gian phản hồi).
2. Với `/coach/training-plans` trả 500: xem `/users/me` hoặc `/fighters?page=` của HLV có lỗi hay chậm quá 10 giây không.
3. Xem lỗi có trùng lúc access token hết hạn không. Proxy làm mới token, và khi chuyển màn nhanh có thể có hai lần làm mới song song. Cần xem log NestJS có 401 ở `/auth/refresh` không.
4. Nếu xác nhận nguyên nhân ở layout hoặc session, tách ticket riêng cho `session.ts`.

