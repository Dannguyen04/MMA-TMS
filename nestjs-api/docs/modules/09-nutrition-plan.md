# 09. Kế hoạch ăn theo giai đoạn và câu trả lời "ăn theo kế hoạch?" (migration 026)

- Ticket: T-009A (mobile: Fon). Người làm: Ken. Phụ thuộc: T-003, T-005. Hạn merge: 26/10.
- Trạng thái: chưa lập plan.
- Tài liệu: [Tech spec §2.7, §4](../../../docs/FIGHT-CAMP-TECH-SPEC.md), [Luồng nghiệp vụ E1](../../../docs/FIGHT-CAMP-BUSINESS-FLOWS.md).

## Mục tiêu

Lưu và hiển thị chữ do HLV hoặc chuyên gia nhập; ghi lại việc võ sĩ có làm theo hay không. **App không tính hay sinh chế độ ăn.**

## Giới hạn an toàn (không được vượt)

- Không có số calo, lượng nước, thời gian xông hơi do app tính ở bất kỳ màn hình hoặc field nào.
- Không có ô theo dõi lượng nước uống (E1 mục 5), để app không thành công cụ hỗ trợ ép nước.

## Dữ liệu (migration 026)

- `bouts.nutrition_plan jsonb NOT NULL DEFAULT '{}'`: ba khoá `camp`, `fightWeek`, `postWeighIn`, mỗi khoá `{ text, author, updatedAt, updatedById }`; `text` 1–2000 ký tự, `author` 1–100 ký tự; khoá có thể vắng.
- Enum `nutrition_adherence`: `ON_PLAN`, `SLIGHTLY_OFF`, `WAY_OFF`.
- Bảng `bout_nutrition_checkins`: `UNIQUE (bout_id, academy_date)`; `note` tối đa 200 ký tự; trả lời lại thì cập nhật dòng cũ. `fighter_id` phải bằng `bouts.fighter_id` (kiểm tra trong service, thêm trigger nếu dễ theo khuôn 024).
- Quyền `bout:nutrition_checkin`: FIGHTER (trận của mình), COACH, ADMIN.
- Preflight: ledger đã có 024, chưa có 026; **không** yêu cầu 025 (T-009 không chờ T-007). Cách làm này giữ số migration cố định.

## API

| Method | Path | Quyền | Ghi chú |
| --- | --- | --- | --- |
| PUT | `/bouts/:id/nutrition-plan` | `bout:update` | Ghi cả khối; trận chưa `COMPLETED`, `CANCELLED` |
| PUT | `/bouts/:id/nutrition-checkins/:date` | `bout:nutrition_checkin` | `date` ≤ hôm nay theo ngày học viện; ghi lại thì cập nhật |
| GET | `/bouts/:id/weight-track` | `bout:read` | Trả thêm `nutrition: [{ date, adherence }]` |

Giá trị tính khi đọc `currentNutritionPhase`: `SCHEDULED`, `CAMP` → `camp`; `FIGHT_WEEK` → `fightWeek`; `WEIGHED_IN` → `postWeighIn`; `COMPLETED`, `CANCELLED` → `null`.

Mã lỗi: theo khuôn `bouts.error.ts`.

## Tiêu chí nghiệm thu

- Bỏ qua câu hỏi ăn uống thì vẫn lưu được số cân.
- Trả lời hai lần cùng một ngày học viện thì chỉ còn câu mới nhất.
- Trận `FIGHT_WEEK` thì trang võ sĩ hiện kế hoạch "Tuần thi đấu".
- Võ sĩ chỉ ghi câu trả lời cho trận của mình; ngày tương lai bị từ chối.
- Ca migration mới trong `scripts/test-migrations.mjs`.

## Lệnh bắt buộc

`lint`, `build`, `test`, `test:db`, `db:check`.
