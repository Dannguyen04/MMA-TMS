# T-059 Danh sách Phiếu khám Bác sĩ render không ổn định

- Trạng thái: DRAFT. Ngày: 08/11/2026. Người nhận: chưa giao.
- Phạm vi: điều tra tuyến danh sách `/doctor/examinations`, tách khỏi luồng tạo phiếu.

## Tái hiện

1. Đăng nhập bằng tài khoản test Bác sĩ trên frontend API mode.
2. Mở trực tiếp `/doctor/examinations` ở 375 và 1440 px. Lặp ở phiên mới và phiên đã mở dashboard.
3. Ghi status điều hướng, trạng thái render và thời gian của GET phiếu khám và GET võ sĩ được phân công.

## Kỳ vọng

Danh sách render ổn định ở cả hai viewport, hoặc hiện trạng thái rỗng khi chưa có phiếu.

## Thực tế và bằng chứng

- Lượt trước trả 200 và không có lỗi console ở cả hai viewport. Lượt ma trận production trả 500 và hiện khung lỗi. Lượt kiểm tra lại ở 3042 timeout.
- Trang lấy danh sách bằng `listFighters` và `listExaminations` song song. Chưa xác định request hoặc lỗi gốc.
- Nguồn quan sát nằm ở mục ma trận API mode và kiểm tra lại trong `nextjs-frontend/ui-api-audit.local.md`.

## Tiêu chí nghiệm thu

- Tái hiện được hoặc ghi số lượt thử không tái hiện theo môi trường và viewport.
- Khi tái hiện, lưu mã lỗi, endpoint và thời gian đã che định danh. Xác minh lại mà không tạo phiếu khám.

## Điều tra 9/11

- **Nguyên nhân khả dĩ (đọc code):** trang chờ một `Promise.all` gồm `listFighters` (`GET /doctors/:id/fighters`, rút hết các trang) và `listExaminations` (mỗi võ sĩ được giao một `GET /fighters/:id/medical-examinations`), tức N+1 request. Chỉ 403/404 được bỏ qua (`nullIfUnreadable` trong `medical.api.ts`); một 5xx, timeout 10 s (`API_TIMEOUT`), lỗi mạng hay phản hồi sai dạng ở **bất kỳ** request nào cũng ném lên `doctor/error.tsx` và hiện khung lỗi. Điều này khớp với kết quả lúc 200, lúc 500, lúc timeout.
- **Tái hiện:** máy kiểm tra không có backend nên chưa chạy được API mode (0 lượt) và chưa có mã lỗi hay endpoint thật. Ở demo mode, `ui-smoke` render 200 ở cả 390 và 1440 px trong mọi lượt chạy ngày 9/11.
- **Đã sửa (`src/app/(app)/doctor/examinations/page.tsx`):**
  - `listFighters` được bọc `nullIfServiceFails`. Khi lỗi, trang vẫn hiện phiếu khám, chỉ ẩn tên và bộ lọc võ sĩ, kèm thông báo.
  - Phiếu khám được đọc riêng cho từng võ sĩ, mỗi lượt bọc `nullIfServiceFails`. Võ sĩ nào lỗi thì chỉ thiếu phiếu của võ sĩ đó, và trang báo "Không đọc được phiếu khám của N võ sĩ". Nếu mọi lượt đều lỗi, panel hiện khung lỗi kèm nút Tải lại thay cho trạng thái rỗng; cả trang không sập.
  - Không mở rộng quyền: phạm vi vẫn lấy từ `accessibleFighterIds`/`canAccessFighter`, không thêm endpoint, số request vẫn là N+1. Phiên hết hạn (401) vẫn ném lỗi như cũ.
  - Test: `src/app/(app)/doctor/examinations/t059-partial-read.test.ts`, 6 ca (một võ sĩ lỗi, danh sách võ sĩ lỗi, mọi lượt lỗi, 401, lọc theo võ sĩ không được giao).
- **Còn mở:** cần chạy lại trên API mode và đọc log server theo `digest` để biết request nào trả 500. Hướng bền hơn là backend có danh sách phiếu khám theo bác sĩ, để trang không phải gửi N request.
