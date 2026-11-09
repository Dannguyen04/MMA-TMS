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

