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

