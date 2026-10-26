# 05. Bảng sẵn sàng nhận trận toàn CLB (R32)

- Ticket: T-007A. Người làm: Ken. Phụ thuộc: 01, 04. Hạn merge: trước 25/10.
- Trạng thái: chưa lập plan.
- Tài liệu: [Luồng nghiệp vụ R32, S3, H7](../../../docs/FIGHT-CAMP-BUSINESS-FLOWS.md).

## Mục tiêu

Một bảng chỉ đọc, tính khi đọc: mỗi võ sĩ trong phạm vi người xem có một dòng cho biết có sẵn sàng nhận trận mới không. Hiện ở tab "Sẵn sàng" của hub "Trận" (frontend là phần của Hoàng Anh).

## Nội dung mỗi dòng

- Trạng thái S3: đang đình chỉ (ngày x/y, loại buổi bị chặn, loại được tập, ngày dự kiến tập lại) → chờ xác nhận → được tập → sẵn sàng.
- Số cân gần nhất.
- Trận đang chạy (nếu có).

## Quy tắc "sẵn sàng"

- Không có trận ở `CAMP`, `FIGHT_WEEK`, `WEIGHED_IN` (khớp chỉ mục `uq_bouts_active_per_fighter`). Trận `SCHEDULED` **không** loại võ sĩ, vì tài liệu và chỉ mục chỉ tính ba trạng thái kia.
- Không có đình chỉ còn hiệu lực (định nghĩa ở 01).
- Lọc theo hạng cân (kg) và ngày thi dự kiến: với từng võ sĩ, tính khả thi về cân bằng hàm ở [04](./04-weight-feasibility.md). Đánh dấu "Chưa sẵn sàng" nếu có đình chỉ còn hiệu lực đến sau ngày đó, hoặc đang có trận ở ba trạng thái trên.

## Thiết kế đề xuất

- Endpoint chưa có trong Tech spec §4. Đề xuất `GET /readiness` (quyền dùng `bout:get_all` hoặc quyền mới trong migration 025); Ken chốt khi lập plan và ghi vào handover.
- Phạm vi: HLV chỉ thấy võ sĩ được phân công; Admin thấy toàn CLB. Kiểm tra trong service.
- Nên gom dữ liệu bằng truy vấn theo lô (đình chỉ, trận đang chạy, cân gần nhất cho cả danh sách võ sĩ), tránh N+1.

## Tiêu chí nghiệm thu

- Lọc hạng 60 kg, ngày thi dự kiến sau 30 ngày: võ sĩ có đình chỉ kết thúc sau ngày đó hiện "Chưa sẵn sàng" kèm ngày dự kiến tập lại; võ sĩ có trận ở `CAMP` không nằm trong nhóm sẵn sàng.
- HLV chỉ thấy võ sĩ của mình; Admin thấy tất cả.
- Võ sĩ có trận `SCHEDULED` nhưng không có đình chỉ: vẫn sẵn sàng.
- Test hàm thuần phân loại S3 theo ngày (ranh giới `ends_on`, `ends_on + 1`).

## Lệnh bắt buộc

`lint`, `build`, `test`, `test:db`, `db:check`.
