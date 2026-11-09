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

