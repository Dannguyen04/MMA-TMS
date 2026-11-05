# T-057 Review

- Ngày: 05/11/2026. Người review: Claude (lead) tự kiểm giữa các lượt, và một lượt subagent review độc lập không mang ngữ cảnh ngay trước commit (theo quy tắc từ 05/11).
- Ticket: [T-057](./T-057-doctor-board-suspensions.md). Handover: [T-057-HANDOVER.md](./T-057-HANDOVER.md). Nhánh `User_Feature`.
- Code: `agy` `gemini-3.8-flash-high`, 3 lượt: làm, sửa 1 (vá test yếu và dọn code thừa), sửa 2 (vá hai đột biến, chỉ test).

## Kết luận

**APPROVED.** Review độc lập trước commit không có lỗi chặn hay nên sửa về hành vi.

## Lệnh đã chạy lại (Claude, sau lượt sửa 2)

| Lệnh | Kết quả |
| --- | --- |
| `pnpm --filter nextjs-frontend lint` / `typecheck` | exit 0 / exit 0 |
| `pnpm --filter nextjs-frontend test`, chạy 2 lần | `Tests 1227 passed, 2 skipped` cả 2 lần. Trước ticket: 1202 |

## Tự kiểm và review độc lập

| Bước | Phát hiện | Xử lý |
| --- | --- | --- |
| Claude, sau lượt 1 | B2 (Sofia) qua trên code cũ vì Sofia đã đỏ sẵn do yêu cầu khám đang mở, nên không chứng minh gì về đình chỉ | Lượt sửa 1: B2 kiểm thêm dòng việc "Y tế" |
| Review độc lập (lượt thử đột biến trước đó, chạy trước khi quy tắc đổi) | Nhiều đột biến sống sót: sắp xếp `endsOn`, biên `fullReturnOn`, ngày lộ trình, TKO, bậc từ dữ liệu, chip lộ trình, lỗi dịch vụ | Lượt sửa 1: thêm S9–S13, B6, R4; thay chuỗi dò "tập lại" bằng cờ `graded`; xoá trường và nhánh thừa |
| Review độc lập trước commit | APPROVED. 36 đột biến, 30 bị bắt. Sống sót đáng kể: `graded` luôn `true`; bỏ `nullIfServiceFails` ở `loadDoctorRow`. Giả lập 7 mốc ngày giờ: qua | Lượt sửa 2: thêm kiểm `graded` ở S1, S5, B1, B3 và ca B7; `agy` chứng minh hai đột biến giờ bị bắt (B1 và B7) rồi hoàn lại |

## Kiểm bằng trình duyệt

Chưa kiểm (không chạy server, MCP trình duyệt chưa nạp). Hành vi được kiểm bằng test trên seed demo thật và render tĩnh.

## Thay đổi lane của demo (bác sĩ Thu)

Hoàng Long: Xanh → Đỏ. Marcus: Vàng → Đỏ. Linh: Xanh → Vàng. Sofia và Diego vẫn Đỏ, thêm dòng đình chỉ. Emma và Minh vẫn Xanh. `counts.blocked` = 4.

## Gợi ý chưa làm

1. `loadRow` gọi `suspensionBoardState` hai lần cho mỗi võ sĩ (một lần trong `triageOf`).
2. `REASON_LABELS` dựng riêng trong `doctor-board.ts` (tiếng Việt) thay vì dùng thẳng `SUSPENSION_REASON_LABELS` (tiếng Anh); đã có nhãn tiếng Việt ở nơi khác, nay là bản sao thứ ba.
3. Trang hồ sơ võ sĩ tự gọi `listSuspensions` thêm một lần dù `loadDoctorRow` đã gọi.
4. Ở chế độ API, `listSuspensions` không lọc `active` phía server và có trần 500 bản ghi; CLB lớn có thể thiếu đình chỉ, và `nullIfServiceFails` nuốt lỗi nên không báo.
5. Chưa có ca cho: hai đình chỉ tập lại cùng lúc, thứ tự vàng-còn-hiệu-lực trước tập-lại, mặc định bậc khi `maxAllowedTier` null, chữ "đến".
6. Thẻ đỏ vì đình chỉ vẫn hiện cổng "Tập luyện" xanh (giấy phép y tế là cổng khác với đình chỉ). Quyết định có chủ ý, đã ghi trong ticket.
