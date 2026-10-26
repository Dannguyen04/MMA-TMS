# 08. Thẻ "Việc cần làm" của HLV

- Ticket: T-029A. Người làm: Ken (frontend: Hoàng Anh). Phụ thuộc: 01, 07; nguồn của T-006 và T-010 là tùy chọn. Hạn: 27/10.
- Trạng thái: chưa lập plan.
- Tài liệu: [Luồng nghiệp vụ, "Việc cần làm của HLV"](../../../docs/FIGHT-CAMP-BUSINESS-FLOWS.md).

## Mục tiêu

Một thẻ trên dashboard HLV gom việc của cả ba giai đoạn. **Tính khi đọc, không job nền, không gửi thông báo.** Thẻ "Cảnh báo cân" của T-005 phần B trở thành một nhóm của thẻ này.

## Nguồn (9 nguồn đã duyệt + 1 nguồn mới)

| Giai đoạn | Việc | Quy tắc | Nguồn dữ liệu / ticket | Có sẵn? |
| --- | --- | --- | --- | --- |
| Trước | Hồ sơ còn thiếu (≤ 14 ngày đến hạn nộp), hồ sơ trễ hạn | R11 | T-003 | Có |
| Trước | Cân vàng, đỏ, xám | R7 | T-003 (`computeWeightTrack`) | Có |
| Trước | Chiến thuật chưa có buổi tập | R14 | T-010 (cần migration 027 `bouts.opponent_analysis`) | Chưa |
| Trước | Đủ điều kiện vào tuần thi đấu | R16 | T-003 (`canEnterFightWeek`) | Có |
| Trong | Hôm nay cân chính thức | R17 | T-006 | Chưa |
| Trong | Đã qua ngày thi mà chưa có kết quả | R26 | T-006 | Chưa |
| Sau | Buổi tập xung đột với đình chỉ chưa xử lý | R28 | 01, 03 | Làm |
| Sau | Đình chỉ chờ xác nhận được tập lại | S3 | 01 | Làm |
| Sau | Cân nhắc đình chỉ thủ công | R27 | T-006 / 10 | Phụ thuộc |
| Trước, trong | **Chưa nhập cân hôm nay (mới)** | | 07 | Làm |

## Thiết kế

- Mỗi nguồn là một provider độc lập trả danh sách `{ source, phase, fighterId, boutId?, ... }`. Nguồn chưa có (T-006, T-010 chưa merge) trả mảng rỗng. Thẻ không bị chặn bởi ticket của người khác; bật nguồn khi dữ liệu có.
- Phạm vi: HLV chỉ thấy việc của võ sĩ được phân công; Admin thấy toàn CLB.
- Nguồn nhắc cân (07): chỉ đưa vào thẻ HLV các trường hợp `YESTERDAY_MISSING` trở lên và `STALE`; nhắc từng ngày cho võ sĩ nằm ở app võ sĩ.
- Tên endpoint chưa có trong Tech spec §4. Ken chốt khi lập plan (ví dụ `GET /coach/todo`) và ghi vào handover.
- Nút "Đã trao đổi" (ẩn dòng tới khi trạng thái gốc đổi) là ý "nếu còn thời gian", cần chỗ lưu mới; không làm trừ khi còn thời gian.

## Tiêu chí nghiệm thu

- Trận ở `CAMP`, Cổng 1 đạt, hôm nay đúng ngày cân − 7: có dòng "Đủ điều kiện vào tuần thi đấu".
- Đình chỉ KO kết thúc ngày D: dòng "Chờ xác nhận được tập lại" xuất hiện ngày D + 1, không phải ngày D.
- Thiếu nguồn T-010: thẻ vẫn trả kết quả, không lỗi.
- HLV không thấy việc của võ sĩ không được phân công.
- Mỗi nguồn có test độc lập.

## Lệnh bắt buộc

`lint`, `build`, `test`.
