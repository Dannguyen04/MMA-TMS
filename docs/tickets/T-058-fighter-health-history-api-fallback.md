# T-058 Lịch sử sức khỏe Võ sĩ hiện khung lỗi trong API mode

- Trạng thái: DRAFT. Ngày: 08/11/2026. Người nhận: chưa giao.
- Phạm vi: điều tra `/fighter/health/history` trên môi trường test. Không đổi quyền, migration hoặc dữ liệu.

## Tái hiện

1. Chạy frontend API mode và NestJS local với cấu hình test hiện có.
2. Đăng nhập tài khoản test Võ sĩ. Mở `/fighter/health/history` trực tiếp ở 1440 px.
3. Quan sát nội dung và ghi method, URL đã che, status của các GET liên quan.

## Kỳ vọng

Lịch sử hiển thị theo quyền Võ sĩ. Khi không có bản ghi, trang hiện trạng thái rỗng.

## Thực tế và bằng chứng

- Bản production và lần kiểm tra lại ở cổng 3042 đều trả HTTP 200 cho HTML nhưng hiện khung lỗi. Lần kiểm tra lại ghi ba lỗi console.
- Trace production ghi 403 ở GET chỉ số và HLV. GET dữ liệu hồ sơ, lịch sử y tế và phiếu khám của võ sĩ có lỗi mạng trong cửa sổ đo.
- Nguyên nhân gốc chưa xác định. Bằng chứng chi tiết ở `nextjs-frontend/ui-api-audit.local.md`, mục ma trận API mode và mục kiểm tra lại.

## Tiêu chí nghiệm thu

- Xác định GET bắt buộc thất bại và bằng chứng lỗi an toàn. Tách các GET phụ có 403 theo quyền.
- Trang render được với hồ sơ test có dữ liệu và xử lý đúng khi rỗng. Không mở thêm quyền để che lỗi.

## Điều tra 9/11

Chưa tái hiện được vì không có API mode. Kết luận dưới đây rút từ code và quyền backend.

**Nguyên nhân tìm được**

- 403 ở GET số đo (`/fighters/:id/measurements`) và HLV (`/fighters/:id/coaches`) là đúng thiết kế. Role FIGHTER không có `fighter.measurement:read` và `fighter.coach:read`: hai quyền này chỉ cấp cho COACH (`nestjs-api/migrations/010_grant_coach_permissions.sql`) và ADMIN (`007`), controller ở `nestjs-api/src/fighters/fighters.controller.ts:149-150` và `:252-253`. Frontend vốn đã coi 403 là danh sách rỗng, nên 403 không gây khung lỗi. Nay frontend không gọi hai GET này cho Võ sĩ và Bác sĩ nữa.
- Các GET Võ sĩ được phép (FIGHTER có `fighter.medical:read` và `fighter.doctor:read`, `011_medical_clinical_records.sql:696-698`): `/users/me`, `/fighters/:id/medical-summary` (`fighters.controller.ts:386-387`), `/fighters/:id/medical`, `/medical/history`, `/medical-examinations` (`medical.controller.ts:79-139`). Đây là các GET có lỗi mạng trong trace. Lỗi mạng, timeout 10 giây (`nextjs-frontend/src/lib/api/client.ts:13`) hoặc 5xx ở bất kỳ GET bắt buộc nào đều làm trang ném lỗi và hiện khung lỗi. Đây là hành vi đúng cho GET bắt buộc.
- Yếu tố khuếch đại: trang gọi `getInjuryDetail` cho từng chấn thương. Mỗi lần gọi lại `getFighter` không có cache, nên `/medical-summary` và `/measurements` lặp lại theo số chấn thương. Chỉ cần một lượt lặp lỗi là hỏng cả trang.

**Phân loại GET của trang**

- Bắt buộc: hồ sơ (`/users/me` và `/medical-summary`), phiếu khám, chấn thương (`/medical` và `/medical/history?recordType=INJURY`).
- Phụ: phác đồ điều trị (`recordType=TREATMENT`), quyết định cấp phép (`recordType=MEDICAL_CLEARANCE`), tên bác sĩ, cùng số đo, HLV và bác sĩ dùng để điền thêm hồ sơ.

**File đã sửa**

- `nextjs-frontend/src/lib/services/people.ts`:
  - `getFighter` đọc một lần cho mỗi request.
  - Số đo và phân công HLV chỉ gọi cho COACH và ADMIN.
  - Lỗi dịch vụ ở số đo, HLV hay bác sĩ không còn chặn hồ sơ; hồ sơ vẫn là GET bắt buộc.
  - `listCoaches` không hỏi phân công HLV cho Võ sĩ và Bác sĩ.
- `nextjs-frontend/src/app/(app)/fighter/health/history/page.tsx`: phác đồ điều trị và quyết định cấp phép là GET phụ. Khi lỗi, trang vẫn hiện phiếu khám và chấn thương, kèm ghi chú "dòng thời gian có thể còn thiếu".
- `health.en.ts` và `health.vi.ts`: thêm khoá `fighterHistory.timelineIncomplete`.
- `nextjs-frontend/src/lib/services/people.test.ts`: thêm 7 ca.

**Cần kiểm tra trong API mode với tài khoản thật**

1. Đăng nhập Võ sĩ test, mở `/fighter/health/history`. Log NestJS không còn GET `/measurements` hay `/coaches` từ trang này.
2. Nếu vẫn hiện khung lỗi, lấy digest trong log Next server và ghi GET nào lỗi, kèm status hoặc loại lỗi (network, timeout). Đo thời gian phản hồi của `/fighters/:id/medical` và `/medical/history` (trên 10 giây sẽ thành timeout).
3. Kiểm tra trạng thái rỗng với một võ sĩ test chưa có phiếu khám.
4. Chặn tạm `recordType=TREATMENT` để thấy ghi chú thiếu dữ liệu.
5. Còn ngoài phạm vi: thẻ đội chăm sóc ở `/profile` và hành trình trên dashboard Võ sĩ (`coachesForFighter`) vẫn gọi `/coaches` và nhận 403, nhưng xử lý thành rỗng nên không gây khung lỗi.

