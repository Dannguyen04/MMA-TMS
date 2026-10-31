# T-009 phần A · Review (Claude trên máy Ken, 31/10)

- **Nhánh:** `feat/T-009-nutrition-backend`, tạo từ `fight-camp` `5899d0c`.
- **Người làm:** `agy`, model `gemini-3.8-flash-high`, 3 lượt cùng phiên. `gemini-4-argon-high` hết quota (429, mở lại sau khoảng 115 giờ).
- **Kết luận: APPROVED.** Migration 026 chờ chủ dự án áp lên Supabase.

## Điều chỉnh so với ticket (Claude kiểm trong code trước khi giao)

- **Phạm vi theo bản ghi:** ticket ghi "như `goals.service.ts`", nhưng `fight-camp` không có module `goals` (module này chỉ có trên `wip/goals`). Đã dùng khuôn `assertReadAccess`/`assertWriteAccess` của `bouts.service.ts`: người ngoài phạm vi nhận 403. Vì vậy ca N4 kỳ vọng 403.
- **Ngày trả lời sau hôm nay** (ngày học viện, UTC+7): trả 422 `VALIDATION_ERROR`. Kiểm bằng `.refine` trên tham số `date`, theo khuôn `medical.model.ts:64`. Không thêm mã lỗi mới.

## Lệnh Claude chạy lại

- `lint`: 0 lỗi (chỉ còn các cảnh báo có sẵn).
- `build`: qua.
- `vitest src/bouts src/fighters`: `456 passed (456)`.
- `test`: `26 failed | 1159 passed (1185)`. Cả 26 lỗi thuộc baseline B1 và B2 ([BASELINE.md](./BASELINE.md)); không lỗi nào ở `bouts`.
- `test:db`: `Migration checks passed: 49`, gồm N1 (026 áp được khi ledger chỉ có 024, từ chối áp lại, kiểm `fighter_id` khớp trận, upsert trên PostgreSQL thật).
- `db:check`: `001-032 checksums OK`, không mở kết nối database.

## Review (Claude, ponytail-review, review độc lập)

**Review độc lập lần 1: KHÔNG ĐẠT**

| # | Mức | Vấn đề | Xử lý |
| --- | --- | --- | --- |
| 1 | chặn | `run_sql.mjs` mất dòng `--apply-025`, làm hỏng `db:migrate:025` | Khôi phục |
| 2 | nên sửa | Hàm trigger kiểm `fighter_id` lệch khuôn: nằm ở `public`, thiếu `search_path`, thiếu `REVOKE`, dùng `OR REPLACE` | Đưa vào `mma_private`, thêm `SET search_path = ''`, `REVOKE`, ERRCODE `23514`; preflight kiểm va chạm tên |
| 3 | nên sửa | N2 chỉ test trên mock | Test SQL Drizzle sinh ra (`ON CONFLICT (bout_id, academy_date) DO UPDATE`) và upsert thật trong `test:db` |
| 4 | nên sửa | N9 không có test | Không file nào trong `src/fighters/` bị sửa, và test ghi cân của `fighters` vẫn qua. Test N9 thêm ở lượt 1 qua bất kể code (kiểm mock không liên quan), nên đã bỏ ở lượt 2 |

**Ponytail-review: có thể bớt khoảng 55 dòng.** Đã làm:
- Service không tự `safeParse` nữa, vì pipe của controller đã kiểm.
- Lỗi "ngày ở tương lai" tự dựng được thay bằng `.refine`. Thay đổi này cũng làm `message` khớp với pipe.
- `nutritionPlanPhaseEntrySchema` dùng `.extend`.
- Vòng lặp dùng `NUTRITION_PHASES`.
- Bỏ lần kiểm `isFinalStatus` trước transaction, vì trong transaction đã khoá bản ghi rồi kiểm lại.
- Bỏ `updatedAt: sql\`now()\``, vì trigger đã cập nhật.
- Bỏ các ép kiểu thừa (`as any`, `as NutritionAdherence`).
- Lượt 2 thêm: bỏ index trùng với `UNIQUE`, bỏ test N2 ở lớp service vì tự khớp mock, bỏ tham số thừa trong test, dời khối import lên đầu file.

**Review độc lập lần 2: ĐẠT.**

## Ca kiểm thử

| Ca | Ở đâu |
| --- | --- |
| N1 | `scripts/test-migrations.mjs` |
| N2 | `src/bouts/bouts.repo.spec.ts` (SQL ON CONFLICT) và `test:db` (upsert thật) |
| N3 | `bouts.model.spec.ts` (23:30Z ngày D: ngày D+1 hợp lệ, D+2 lỗi) |
| N4, N5 | `bouts.service.spec.ts` (403; DOCTOR bị 403 kể cả khi được cấp quyền lẻ) |
| N6 | `bouts.model.spec.ts` (đủ 6 trạng thái) |
| N7 | `bouts.service.spec.ts` (COMPLETED, CANCELLED trả 409 `BOUT_INVALID_TRANSITION`) |
| N8 | `bouts.model.spec.ts` (text 2001, author 101, note 201, cùng các giá trị biên) |
| N9 | Không có test riêng. Bảo đảm bằng việc `src/fighters/` không đổi và test ghi cân của `fighters` vẫn qua |

## Câu hỏi cho chủ dự án

- Trận `COMPLETED` hoặc `CANCELLED` vẫn ghi được câu trả lời "ăn theo kế hoạch?". Đặc tả không cấm nên code giữ như vậy.
- Áp migration 026 lên Supabase: chủ dự án làm (`db:migrate:026`).
