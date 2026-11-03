# 10. Nối đình chỉ tự áp dụng vào ghi kết quả trận (R27)

- Ticket: T-007A (phần phụ thuộc). Người làm: Ken. Phụ thuộc: 01 và **T-006 A của Dan đã merge**. Làm sau khi Dan merge.
- Trạng thái: chưa lập plan. Không làm trước khi endpoint `POST /bouts/:id/result` tồn tại.
- Tài liệu: [Luồng nghiệp vụ F6, F7, R27, H3, H4, H6](../../../docs/FIGHT-CAMP-BUSINESS-FLOWS.md), [Tech spec §2.2](../../../docs/FIGHT-CAMP-TECH-SPEC.md).

## Mục tiêu

Khi ghi kết quả, tạo đình chỉ **trong cùng giao dịch** với việc chuyển trận sang `COMPLETED`, theo quy tắc nặng nhất của bộ luật.

## Quy tắc R27

- Chọn quy tắc nặng nhất khớp trong `suspension_rules` theo lý do (KO/TKO), số lần KO trước đó trong `withinDays` (tính cả đình chỉ tạo thủ công) và mức mất ý thức (`loc`); luôn áp thêm `rest_days_after_bout`.
- Đình chỉ có hiệu lực ngay, kèm câu giải thích, ví dụ "KO lần 2 trong 90 ngày, preset AIBA: 90 ngày".
- Bộ luật không có quy tắc (ví dụ VMMAF) mà thua KO, hoặc thua TKO do đòn vào đầu: HLV nhập số ngày trong form kết quả.
- Trường hợp theo F7 / H3 / H4 / H6:
  - Thua KO, hoặc TKO "trận dừng vì đòn vào đầu": quy tắc nặng nhất; cần xác nhận để kết thúc.
  - Thua TKO không do đòn vào đầu: không đình chỉ lý do `TKO`, chỉ áp nghỉ bắt buộc.
  - Bị truất quyền: theo `suspension_rules` nếu có; không cần xác nhận.
  - Huỷ trận (kể cả ở `WEIGHED_IN`): không tạo đình chỉ hay nghỉ bắt buộc (H4).
  - Thắng nhưng bị đánh ngã: không tự tạo (H6); tạo việc "Cân nhắc đình chỉ thủ công" nếu có cảnh báo R24.

## Phần thiếu của Tech spec

Tên enum cho "bị truất quyền" và cột/field cho "trận dừng vì đòn vào đầu" chốt sau khi đọc code T-006 đã merge (câu hỏi mở số 3 trong README) (H3 nói không cần cột mới; câu trả lời quyết định có tạo đình chỉ lý do `TKO` hay không).

## Thiết kế gợi ý

Hàm thuần `suggestSuspension({ ruleset, result, method, lossOfConsciousness, priorKoCount, ... })` tách khỏi service để test không cần DB; service gọi trong transaction của Dan và chỉ thêm một dòng vào cuối. Báo Dan trước khi sửa vì chạm vào `bouts.service.ts` phần ghi kết quả.

## Tiêu chí nghiệm thu

- Preset AIBA, võ sĩ có đình chỉ KO thủ công 40 ngày trước, nay thua KO: đình chỉ 90 ngày được tạo, có hiệu lực ngay, kèm quy tắc đã áp dụng.
- Preset AIBA, thua TKO trả lời "không do đòn vào đầu": không có đình chỉ `TKO`.
- Preset AIBA, thua TKO trả lời "có": 30 ngày như KO lần đầu.
- VMMAF thua KO: HLV phải nhập số ngày, thiếu thì lỗi.
- Huỷ ở `WEIGHED_IN`: không có đình chỉ.
- Lỗi khi tạo đình chỉ thì kết quả trận cũng không được lưu (cùng giao dịch).

## Lệnh bắt buộc

`lint`, `build`, `test`, `test:db`, `db:check`.
