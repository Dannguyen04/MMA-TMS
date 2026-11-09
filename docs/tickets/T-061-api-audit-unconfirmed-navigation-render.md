# T-061 Xác minh điều hướng và render chưa kết luận trong ma trận API mode

- Trạng thái: DRAFT. Ngày: 08/11/2026. Người nhận: chưa giao.
- Phạm vi: kiểm chứng các quan sát chưa tái hiện độc lập. Chưa kết luận là lỗi sản phẩm.

## Bằng chứng

- `/admin/fighters/[fighterId]` trả HTTP 200 trong ma trận production, bộ đo không thấy tiêu đề và ghi lỗi console. Chưa xác minh nội dung thực tế bằng lượt độc lập.
- `/fighter` và `/doctor` ghi lỗi điều hướng trong runner sau HTTP 200. Source của hai trang gọi redirect về dashboard tương ứng.
- `/lab` chỉ dành cho dev theo source, loại khỏi tiêu chí giao diện production.

## Tái hiện và kỳ vọng

1. Với Quản trị, đi từ liên kết hồ sơ võ sĩ hợp lệ và kiểm tra nội dung, tiêu đề và console.
2. Với Võ sĩ và Bác sĩ, mở tuyến gốc và đợi URL ổn định. Kỳ vọng chuyển tới dashboard đúng role.
3. Thử lại mỗi trường hợp ngoài runner hàng loạt, ở phiên mới.

## Tiêu chí nghiệm thu

- Ghi rõ quan sát nào là lỗi sản phẩm, quan sát nào do runner hoặc do màn hình nằm ngoài production.
- Nếu tái hiện lỗi sản phẩm, đính kèm status, URL đã che và lỗi console đã lọc. Không ghi thông tin người dùng hoặc token.

