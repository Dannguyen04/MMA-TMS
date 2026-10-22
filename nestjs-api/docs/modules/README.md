# Module của Ken (Sprint 2): T-007A, T-009A, T-029A, T-008

Mỗi file trong thư mục này là một module để lập plan riêng. Nội dung đã đối chiếu với code ngày 22/10/2026. Chỗ nào chưa kiểm tra được thì ghi "chưa kiểm tra" hoặc "đề xuất".

Hạn: T-007A merge trước 25/10; T-009A 26/10; T-029A 27/10; T-008 28–29/10; demo 31/10.

## Thứ tự làm

| # | File | Ticket | Phụ thuộc |
| --- | --- | --- | --- |
| 01 | [01-suspensions-core.md](./01-suspensions-core.md) | T-007A | T-003 (đã merge) |
| 02 | [02-training-gate2.md](./02-training-gate2.md) | T-007A | 01 |
| 03 | [03-schedule-conflicts-r28.md](./03-schedule-conflicts-r28.md) | T-007A | 01, 02 |
| 04 | [04-weight-feasibility.md](./04-weight-feasibility.md) | T-029A (dùng cho 05, 06) | T-003 |
| 05 | [05-readiness-r32.md](./05-readiness-r32.md) | T-007A | 01, 04 |
| 06 | [06-bout-create-warnings.md](./06-bout-create-warnings.md) | T-007A (R4) + T-029A (R31) | 01, 04. Không đụng `updateBout`, `resolveWeightClass` (của Dan) |
| 07 | [07-weight-reminder.md](./07-weight-reminder.md) | T-029A | 04. Phạm vi mới (Ken đã quyết) |
| 08 | [08-todo-card.md](./08-todo-card.md) | T-029A | 01, 07; nguồn T-006, T-010 là tùy chọn |
| 09 | [09-nutrition-plan.md](./09-nutrition-plan.md) | T-009A | T-003, T-005 |
| 10 | [10-result-wiring-r27.md](./10-result-wiring-r27.md) | T-007A | 01 và T-006 A của Dan đã merge |
| 11 | [11-demo-seed.md](./11-demo-seed.md) | T-008 | 01, 09 và T-010 |

Lý do thứ tự: Dan chốt Ken làm đình chỉ thủ công, Cổng 2, cho tập lại và bảng sẵn sàng trước; nối đình chỉ vào kết quả trận chỉ sau khi T-006 A merge. Bảng sẵn sàng cần hàm khả thi về cân (04), nên 04 là hàm thuần làm sớm.

## Quy tắc chung (từ TEAM-WORKFLOW và tin nhắn của Dan)

- Nhánh `feat/T-007-...` tạo từ `fight-camp` mới nhất. Không merge. Push nhánh rồi báo Claude review.
- Migration chỉ chạy bằng `pnpm --filter nestjs-api test:db`. Không chạy `db:migrate:*`, không chạy SQL lên Supabase (Dan áp). Không commit `.env`.
- Lệnh bắt buộc: `pnpm --filter nestjs-api lint`, `build`, `test`, `test:db`, `db:check`. Không thêm lỗi so với [BASELINE](../../../docs/tickets/BASELINE.md).
- Viết `docs/tickets/T-007-HANDOVER.md`, dán nguyên văn output các lệnh.
- Khuôn migration (xem [migrations/README.md](../../migrations/README.md)): preflight ledger, advisory lock, ghi `migration_history`, checksum trong `manifest.json`, tên trong `scripts/migration-files.mjs`, script `db:migrate:0xx` trong `package.json`, mục mô tả trong README của migrations, ca mới trong `scripts/test-migrations.mjs`.
- Mọi quy tắc nghiệp vụ mới có unit test.
- Ticket thiếu hoặc mâu thuẫn code thì ghi vào mục "Câu hỏi" của handover và hỏi trong nhóm, không tự đoán.

## Quyết định đã chốt (Ken, 22/10)

1. Được viết hàm mới cho R31 thay vì chỉ gọi lại `computeWeightTrack`. Phải ghi vào mục "Lệch so với ticket" của handover (mẫu bên dưới).
2. Nhắc cân hằng ngày: bắt đầu khi trận ở `CAMP`, kéo dài tới hết ngày thi (không dừng ở cân chính thức, vì nhiều giải cân cùng ngày thi hoặc cân nhiều lần).
3. Nhắc là "nhập cân HÔM NAY ngay", không nhập bù ngày cũ.
4. Không có nút "hôm nay không cân". Fight camp thì võ sĩ phải luôn đi tập; ốm đau là việc của module medical.
5. Trạng thái XÁM: 3 ngày không có cân khi còn xa ngày cân; 2 ngày khi vào cửa sổ cấp tính (A ngày cuối).
6. Ngưỡng L lấy từ snapshot `bouts.acute_loss_limit_pct`, không hard-code (xem 04).
7. Ken làm nguồn "nhắc cân" trên thẻ Việc cần làm của HLV (T-029A). Nhắc trên app võ sĩ do Dan làm (T-006), dùng chung hàm của Ken.

## Câu hỏi nghiệp vụ còn mở (Ken chưa chốt)

Các việc đã quyết ở trên (nhắc cân từ `CAMP` tới hết ngày thi, thêm hàm R31 mới, không có nút nghỉ) không cần ai duyệt thêm; chỉ cần ghi vào handover.

| # | Câu hỏi | Gợi ý của Claude | Ảnh hưởng |
| --- | --- | --- | --- |
| 1 | Sau khi trận sang `WEIGHED_IN`, có tắt trạng thái cân đỏ/vàng so với hạng cân không? Võ sĩ bù nước nên cân tăng là bình thường | Tắt màu, vẫn nhắc nhập cân ngày thi. Phải đọc cách `computeWeightTrack` xử lý `WEIGHED_IN` trước khi quyết | 07 |
| 2 | Đình chỉ thủ công không gắn trận: `blocked_session_types` và `requires_clearance` mặc định lấy ở đâu? | Nhận từ request; vắng thì `{SPARRING}`. `requires_clearance` suy từ lý do (KO, TKO, MEDICAL = có) | 01 |
| 3 | Tên lý do đình chỉ cho "bị truất quyền", và field "trận dừng vì đòn vào đầu" | Chưa quyết được; đọc code T-006 của Dan sau khi merge rồi chốt | 01, 10 |
| 4 | Ngưỡng cân chặt dần có cần siết hơn không? Ở 14 và 7 ngày trước trận, mức hiện tại lỏng hơn WBC (6% và 5% so với 5% và 3%) | Giữ như bảng ở 04 cho demo; hệ số là hằng số nên chỉnh sau không tốn công | 04 |
| 5 | XÁM 2 ngày trong cửa sổ cấp tính: chỉ áp cho nhắc cân, hay đổi cả `WEIGHT_STALE_DAYS` của R7? | Chỉ áp cho nhắc cân, không đụng R7 của T-003 | 07 |
| 6 | `createSession` không có transaction: có bọc transaction cho Cổng 2 không? | Không bọc, ghi lý do vào handover (đình chỉ tính theo ngày, rủi ro thấp) | 02 |

Việc báo cho Dan (thông tin, không phải xin duyệt): dùng chung field `weightReminder` cho nhắc `FIGHT_WEEK` ở app võ sĩ; Ken chỉ thêm vào `createBout`, không đụng `updateBout` và `resolveWeightClass`.

## Mẫu "Lệch so với ticket" cho handover

> **R31 (T-029A):** thêm hàm thuần mới trong `nestjs-api/src/bouts/bouts.model.ts`, cạnh `computeWeightTrack`, thay vì chỉ gọi lại `computeWeightTrack` như chỉ dẫn giao việc. Lý do: `computeWeightTrack` dựng đường tham chiếu từ cân đầu camp. Lúc tạo trận chưa có camp, đường này bắt đầu tại cân gần nhất nên nhánh VÀNG không bao giờ chạy và trận còn xa luôn ra XANH. Ngoài ra XÁM sau 3 ngày mâu thuẫn với cửa sổ 7 ngày của R31. Người quyết định: Ken, ngày 22/10/2026. Hàm mới không thay đổi `computeWeightTrack`; các ngưỡng và nguồn xem [04-weight-feasibility.md](./04-weight-feasibility.md).
