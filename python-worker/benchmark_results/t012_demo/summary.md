# T-012 — BLOCKED

Chưa chọn clip. Cả hai lệnh ứng viên đều thoát mã 1 trước khi xuất result JSON:
`RubricSelectionError: Unsupported martial art discipline 'boxing' requested.`

| Ứng viên | Số lần gọi process_video | Result | Nhãn bắt được | Ngoài mọi nhãn |
| --- | --- | --- | --- | --- |
| vid_01_cross_heavybag | 1 | Không được tạo | Chưa đo | Chưa đo |
| Adam | 1 | Không được tạo | Chưa đo | Chưa đo |

Không có số liệu để áp dụng thứ tự chọn clip. Chưa chạy lần xác nhận, chưa kiểm contract,
chưa có detectorVersion hoặc meta.timingsSeconds. Đây là trạng thái lỗi, không phải kết quả 0 cú đấm.
Xem run_info.json và hai log nguyên văn. Script summary chỉ được kiểm bằng dữ liệu tổng hợp trong test.

Kết quả chỉ đếm sự kiện đấm, không chấm kỹ thuật hay phân loại đòn
