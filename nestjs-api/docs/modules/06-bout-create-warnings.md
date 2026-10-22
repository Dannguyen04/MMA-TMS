# 06. Cảnh báo khi tạo trận: R4 (đình chỉ, trận đang chạy) và R31 (cân)

- Ticket: R4 thuộc T-007A, R31 thuộc T-029A. Người làm: Ken. Phụ thuộc: 01, 04.
- Trạng thái: chưa lập plan.
- Tài liệu: [Luồng nghiệp vụ R4, R31](../../../docs/FIGHT-CAMP-BUSINESS-FLOWS.md).

## Quy ước với Dan

Dan sửa `updateBout` và `resolveWeightClass` (T-006). Ken chỉ thêm cảnh báo vào `createBout` và **không đụng hai hàm đó**. Cần thông báo Dan trước khi sửa `bouts.service.ts` để tránh xung đột.

## Hiện trạng

`createBout` ([bouts.service.ts](../../src/bouts/bouts.service.ts) dòng 135–207, đã đọc) kiểm tra quyền, lịch (giờ cân trước giờ thi, giờ thi ở tương lai), võ sĩ active, HLV, ruleset, hạng cân, tính `acute_loss_limit_pct`, rồi insert trong một transaction. Chưa có kiểm tra R4 hay R31.

## Quy tắc

- **R4** (cảnh báo, không chặn): võ sĩ còn đình chỉ kéo dài quá ngày thi, hoặc đang có trận khác ở `CAMP`/`FIGHT_WEEK`/`WEIGHED_IN`.
- **R31** (cảnh báo, không chặn): lấy cân gần nhất của võ sĩ trong 7 ngày, tính bằng hàm ở [04](./04-weight-feasibility.md). Không có cân: "Chưa đủ dữ liệu cân".
- Đình chỉ "kéo dài quá ngày thi": dùng định nghĩa còn hiệu lực ở 01 tại ngày thi.
- App không gợi ý cách giảm cân.

## Thiết kế đề xuất

Hai đường:

1. **Xem trước trên form (R31, và R4 nếu muốn)**: tài liệu yêu cầu form hiện trạng thái đỏ **trước khi lưu**. Cần một endpoint đọc, không ghi (ví dụ `GET /bouts/feasibility?fighterId&weightClassCode&weighInAt&boutAt&rulesetId`; tên do Ken chốt). Quyền `bout:create`.
2. **Khi lưu**: `createBout` vẫn lưu được và trả thêm `warnings: [{ code, ... }]` để UI hiện lại. Contract thay đổi cần báo Hoàng Anh (T-029 B, T-004).

Mã cảnh báo đề xuất: `FIGHTER_ACTIVE_BOUT`, `FIGHTER_SUSPENDED_PAST_BOUT_DATE`, `WEIGHT_AT_RISK`, `WEIGHT_INSUFFICIENT_DATA`. Chốt khi lập plan.

## Tiêu chí nghiệm thu

- Giới hạn 60 kg, ngưỡng 8%, cân sau 2 ngày, cân gần nhất 66 kg ghi hôm qua: form hiện đỏ và phần phải giảm 9,1% trước khi lưu; HLV vẫn lưu được.
- Võ sĩ không có cân trong 7 ngày: "Chưa đủ dữ liệu cân", không hiện màu.
- Võ sĩ có đình chỉ còn hiệu lực đến sau ngày thi: cảnh báo, vẫn lưu được.
- Võ sĩ đang có trận ở `CAMP`: cảnh báo R4, và tạo trận `SCHEDULED` mới vẫn được (chỉ mục chỉ cản `CAMP`/`FIGHT_WEEK`/`WEIGHED_IN`).
- Test `bouts.service.spec.ts`: các nhánh trên. `updateBout`, `resolveWeightClass` không đổi.

## Lệnh bắt buộc

`lint`, `build`, `test`.
