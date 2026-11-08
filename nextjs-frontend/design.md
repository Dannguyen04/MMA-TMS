# Bản tin buổi tập · tổng quan và điều hướng

Bản Sổ góc đài được lưu nguyên văn trong design.sakhi-old.local.md. Phương án kết hợp được duyệt sau khi thử trên dashboard HLV.

## Thay thế và giữ lại

- **Thay thế trên dashboard HLV**: tiêu đề display thể thao bằng Cambria lớn, nền workspace xanh/xám bằng giấy sáng #fbfbf7, bề mặt cảnh báo xanh sương #e4eee6 và vạch đỏ #8e2a24, thẻ bo đều bằng cụm dữ liệu có đường kẻ. Chữ dữ liệu và nhãn giữ sans dễ quét.
- **Mở rộng**: Sidebar dùng màu và kiểu chữ B cho cả năm vai trò. Bốn dashboard và trang hồ sơ Ứng viên dùng tiêu đề Cambria, nền giấy sáng và đường phân cách dưới tiêu đề. Chế độ tối dùng nền tối và bảng màu tương ứng.
- **Giữ lại**: Một WorkspaceSidebar với menu theo quyền, trạng thái đang chọn, nút thu gọn và ngăn điều hướng trên điện thoại. Các bảng nghiệp vụ giữ mật độ, kiểu chữ sans và số tabular.

## Skill Playbook

Taste Skill giữ một ý tưởng trung tâm, lề đều, nội dung thật và tránh vẻ card template. Impeccable Operate kiểm tra phân cấp công việc, mật độ, tương phản, focus, viewport 375/1440 và trạng thái lỗi. Khi quy tắc khác nhau, khả năng thao tác và yêu cầu giữ luồng dữ liệu của người dùng đứng trước trang trí.

## Token giao diện B

| Vai trò | Giá trị |
| --- | --- |
| Giấy | #fbfbf7 |
| Mực | #14282a |
| Chữ phụ | #425d5d |
| Xanh sương | #deebe3 |
| Đường kẻ | #a2b5ae |
| Đỏ cảnh báo | #8e2a24 |
| Tiêu đề | Cambria, Georgia, serif |
| Dữ liệu | Font sans hiện có, số tabular |

Cambria là font hệ thống trên Windows. Khi thiếu font này, trình duyệt dùng Georgia hoặc serif hệ thống. Chưa đo chất lượng fallback trên thiết bị thật.

Trong chế độ tối của workspace, nền than chì `#16191b` đi cùng bề mặt `#1d2124`, nền phụ xanh trầm `#222d2b` và chữ ngà `#f4efe5`. Xanh bạc hà `#a4dbc1` đánh dấu thao tác chính và mục điều hướng đang chọn. Đỏ san hô `#ffaaa1` trên nền đỏ nâu `#302426` dành cho cảnh báo. Viền focus dùng vàng nhạt `#ffd38d`. Các vai trò nhận bảng màu từ workspace chung. Điều khiển chế độ sáng, tối và theo hệ thống dùng thiết lập sẵn có trong app.

## Layout và trạng thái

Dashboard mở bằng tiêu đề lớn và cụm cảnh báo, sau đó việc cần xử lý với lịch bên cạnh. Danh sách dày giữ nhịp gọn và sans. Mobile xếp dọc theo mức ưu tiên. Focus có outline rõ. Loading, empty và error tiếp tục dùng component hiện có, giữ vùng nội dung không tràn ở 375 px. Sidebar giữ cấu trúc chung cho năm role.


