# 03. Xử lý lịch xung đột với đình chỉ (R28)

- Ticket: T-007A. Người làm: Ken. Phụ thuộc: 01, 02. Hạn merge: trước 25/10.
- Trạng thái: chưa lập plan.
- Tài liệu: [Luồng nghiệp vụ, nghiệp vụ 12, R28](../../../docs/FIGHT-CAMP-BUSINESS-FLOWS.md).

## Mục tiêu

Khi võ sĩ có đình chỉ, tìm các buổi `SCHEDULED` đã xếp trước đó mà loại bị chặn, đề xuất đổi, dời hoặc huỷ; HLV một chạm "Áp dụng tất cả" hoặc bỏ chọn từng buổi.

## Quy tắc R28 (nguyên văn tài liệu)

Với từng buổi `SCHEDULED` của võ sĩ nằm trong khoảng đình chỉ và có loại bị chặn:
1. Đổi sang `RECOVERY` nếu loại này không bị chặn.
2. Nếu không đổi được và đình chỉ không cần xác nhận: dời sang ngày đầu tiên sau ngày kết thúc muộn nhất của các đình chỉ còn hiệu lực.
3. Còn lại: huỷ.

Buổi xếp mới vẫn bị chặn bằng 409 `TRAINING_SUSPENSION_ACTIVE` (02).

## Thiết kế đề xuất (Tech spec chưa có endpoint cho phần này)

- Một hàm thuần: nhận danh sách buổi và danh sách đình chỉ còn hiệu lực, trả đề xuất `{ sessionId, action: 'CHANGE_TYPE' | 'RESCHEDULE' | 'CANCEL', ... }`. Dễ test không cần DB.
- Đọc: `GET /suspensions/:id/conflicts` (đề xuất tên) trả danh sách đề xuất. Tính khi đọc, không lưu.
- Áp dụng: `POST /suspensions/:id/conflicts/apply` (đề xuất tên) nhận danh sách `sessionId` được chọn, thực hiện trong một transaction, đi qua các đường sửa buổi tập hiện có để nhận thông báo `TRAINING_SESSION_RESCHEDULED` / `CANCELLED` như bình thường. Tên đường dẫn do Ken chốt khi lập plan và ghi vào handover.
- Đình chỉ cần xác nhận mà chưa xác nhận có ngày kết thúc mở: không có "ngày đầu tiên sau đó" để dời, nên rơi vào nhánh huỷ.
- Cùng một buổi nằm trong nhiều đình chỉ chồng nhau: dùng ngày kết thúc muộn nhất của các đình chỉ còn hiệu lực chặn loại đó.

## Tiêu chí nghiệm thu

- Buổi `SPARRING` đã xếp vào ngày thứ 5 của đình chỉ: nằm trong danh sách đề xuất đổi sang `RECOVERY`; sau khi áp dụng, loại buổi đã đổi.
- Bỏ chọn một buổi thì buổi đó không bị đụng.
- Buổi `RECOVERY` bị chặn bởi bộ luật chặn mọi loại: rơi vào dời hoặc huỷ theo quy tắc, có test.
- Áp dụng thất bại giữa chừng thì không buổi nào bị đổi (một transaction).
- Thêm ca vào `training-session.service.spec.ts` hoặc spec của hàm thuần.

## Lệnh bắt buộc

`lint`, `build`, `test`, `test:db`, `db:check`.
