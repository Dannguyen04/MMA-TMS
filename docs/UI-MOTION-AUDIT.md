# Audit chuyển động giao diện (30/10)

> Thuộc G7 trong [UI-LAB-PLAN.md](UI-LAB-PLAN.md#7-đợt-3-3010-model-3d-thật-và-đưa-vào-màn). Làm theo skill `emil-design-eng`: mỗi chuyển động phải có mục đích, dùng ease-out, giao diện thường dưới 250 ms, không bắt đầu từ `scale(0)`, có phương án cho reduced motion. Nhánh `feat/T-042-043-ui-3d`.

## Hiện trạng

Nền đang sạch: không chỗ nào dùng `transition-all` hay `ease-in`; các component đều chỉ chuyển màu (`transition-colors`). Nhưng gần như không có phản hồi khi nhấn, và các lớp phủ hiện ra đột ngột. Đó là hai chỗ người dùng gặp nhiều nhất.

## Đã sửa

| Trước | Sau | Vì sao |
| --- | --- | --- |
| `Button`: chỉ `transition-colors`, nhấn không có phản hồi | `active:scale-[0.97]`, 150 ms ease-out, chỉ chuyển các thuộc tính cần thiết; tắt khi reduced motion | Nút là thứ được bấm nhiều nhất; nút hơi lún xuống cho người dùng biết app đã nhận lệnh |
| `Dialog` giữa màn hình hiện ra tức thì | Mờ dần vào và đi lên 8 px, `scale(0.98 → 1)`, 220 ms; giữ tâm ở giữa | Tránh cảm giác giật. Hộp thoại không gắn với nút nào nên phóng to từ giữa |
| `Dialog` cạnh phải (ngăn kéo) hiện ra tức thì | Trượt vào 32 px từ bên phải, 220 ms | Hướng vào khớp với vị trí ngăn kéo |
| Toast xuất hiện tức thì | Đi lên 8 px và mờ dần vào, 220 ms | Toast tới bất ngờ, chuyển động nhẹ giúp mắt bắt được mà không làm phiền |
| Lớp nền tối của dialog hiện tức thì | Mờ dần 200 ms | Lớp nền và hộp thoại xuất hiện cùng lúc |
| Thanh cân nặng trên hồ sơ | Thanh dài ra một lần, 520 ms, sau đó đứng yên | Mắt đọc được cân nặng hiện tại so với vạch giới hạn hạng cân |
| Body 3D vẽ liên tục 60 khung hình/giây | Chỉ vẽ khi có thứ đang chuyển động (quét, xoay, camera, vùng nhấp nháy) | Hình đứng yên không tốn gì, đỡ cho máy yếu |

Khi đóng thì không có hiệu ứng: dialog gốc đóng ngay và toast biến mất ngay, đúng nguyên tắc "đóng nhanh hơn mở". Khi bật reduced motion, mọi lớp phủ chỉ còn mờ dần, không di chuyển.

## Chưa làm (file của người khác hoặc cần chốt)

| Chỗ | Đề xuất | Lý do chưa làm |
| --- | --- | --- |
| `StatCard` (`components/ui/stat-card.tsx`) | Số đếm lên một lần khi thẻ vào màn hình (400 ms, ease-out); không đếm lại khi đổi bộ lọc | Dùng ở hầu hết dashboard. Cần chốt với Fon và Dan để tránh xung đột |
| Danh sách võ sĩ, hàng đợi review | Các mục xuất hiện lần lượt, cách nhau 40 ms, chỉ ở lần tải đầu | Danh sách được mở hàng chục lần mỗi ngày, nên chỉ chạy ở lần đầu |
| Biểu đồ cân nặng và hiệu suất | Đường vẽ dần một lần khi vào màn hình (`strokeDashoffset`, 600 ms) | Biểu đồ nằm ở file của T-005b |
| Từ danh sách sang hồ sơ võ sĩ | Chân dung trên thẻ chuyển liền sang hình trên hồ sơ (View Transitions API) | Cần thử Next 16 `unstable_ViewTransition` trước, rủi ro trước demo |
| Tabs (`components/ui/tabs.tsx`) | Gạch chân trượt sang tab mới (`transform`, 200 ms) | Tabs dùng ở mọi màn; nên làm sau buổi demo |
