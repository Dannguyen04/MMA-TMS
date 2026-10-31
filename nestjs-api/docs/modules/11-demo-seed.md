# 11. Dữ liệu demo theo giai đoạn

- Ticket: T-008. Người làm: Ken. Phụ thuộc: 01, 09, T-010 (và T-007, T-009 đã merge). Làm 28–29/10; demo 31/10, tổng duyệt 30/10.
- Trạng thái: chưa lập plan. Chưa có file ticket T-008 (chỉ có [T-008a](../../../docs/tickets/T-008a-review2-demo-data.md)); kế thừa cách làm của T-008a.
- Tài liệu: [Luồng nghiệp vụ, Bổ sung 21/10](../../../docs/FIGHT-CAMP-BUSINESS-FLOWS.md).

## Mục tiêu

5 võ sĩ giả, mỗi người đứng ở một giai đoạn, để demo không phải chờ đến ngày cân hay ngày hết đình chỉ. **Không dùng "ngày giả lập"** (tua thời gian) vì phải sửa mọi phép tính theo ngày.

| # | Giai đoạn | Cần dữ liệu |
| --- | --- | --- |
| 1 | Đang camp | Trận `CAMP`, lịch sử cân nhiều tuần; một ngày thiếu cân gần đây để demo nhắc cân (07) |
| 2 | Tuần thi đấu | Trận `FIGHT_WEEK`, cân gần đỏ để demo cảnh báo |
| 3 | Vừa cân xong | Trận `WEIGHED_IN` |
| 4 | Đang đình chỉ | Đình chỉ còn hiệu lực, có buổi `SCHEDULED` bị xung đột để demo R28 |
| 5 | Sẵn sàng | Không trận đang chạy, không đình chỉ, để lên bảng sẵn sàng (05) |

## Ràng buộc

- Chỉ dữ liệu giả (Phạm vi, quyết định 9). Dùng API của backend, không SQL trực tiếp.
- Chủ dự án (Dan) áp migration 025–027 lên Supabase trước khi chạy.
- Script phải chạy lại được (idempotent) hoặc có bước dọn dữ liệu demo, theo cách của T-008a. Chưa kiểm tra chi tiết script T-008a; đọc khi lập plan.
- Nếu T-010 chưa merge, bỏ phần phân tích đối thủ khỏi seed và ghi vào handover.

## Tiêu chí nghiệm thu

- Chạy script xong, mỗi trong 5 võ sĩ hiện đúng giai đoạn trên bảng sẵn sàng và trang trận.
- Hiện đủ các nguồn của thẻ Việc cần làm cho ít nhất: cân xám/đỏ, chờ xác nhận tập lại, buổi tập xung đột đình chỉ, nhắc cân.
- Chạy lại hai lần không tạo trùng.

> **Lệch với T-036 (Claude trên máy Ken, 31/10, chờ Dan xử lý):** dòng 4 ("có buổi `SCHEDULED` bị xung đột"), cùng hai nguồn "chờ xác nhận tập lại" và "buổi tập xung đột đình chỉ" ở trên, không tạo được qua API. Lý do và dòng code ghi dưới tiêu chí 6 của [T-040](../../../docs/tickets/T-040-real-backend-demo.md). Từ T-036, tạo đình chỉ là các buổi bị chặn thành `PENDING` ngay, nên võ sĩ 4 có buổi "Chờ xếp lại" thay vì buổi xung đột. Script T-040 B (`nestjs-api/scripts/demo-seed.mjs`) làm theo hành vi này.

## Lệnh bắt buộc

Theo ticket và [README](./README.md).
