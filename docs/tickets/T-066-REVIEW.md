# T-066 Review

- Kết luận: **APPROVED** 12/11/2026, sau ba lượt review độc lập (subagent không mang ngữ cảnh hội thoại). Lượt cuối đạt.
- Phạm vi: `nestjs-api/scripts/demo-seed.mjs`, `nestjs-api/scripts/demo-seed.test.mjs`, `docs/DEMO-API-MODE-SCRIPT.md`, `docs/tickets/T-066-cleanup.sql`.
- Kiểm tra cuối (Claude chạy lại): `test:seed` 46/46 qua; `lint` exit 0; `--dry-run` exit 0, in đủ f1–f17.

## Tự kiểm của Claude (sau lượt code đầu)

API giả làm theo code thay vì backend, nên bốn lỗi qua test. Sửa ở lượt 1, mỗi lỗi có ca tái hiện lỗi trước khi sửa:

| Ca | Lỗi | Mức |
| --- | --- | --- |
| R1 | Đọc `currentTrainingExamination` thay vì `currentExaminations.training`: chạy lại ghi khám trùng | Chặn |
| R2 | `examinedAt` cố định 15:00/17:00 giờ học viện: chạy buổi sáng bị 400 | Chặn |
| R3 | f8 không có đình chỉ KO thì TypeError | Nên sửa |
| R4 | Cân trượt hạng: backend giữ `FIGHT_WEEK`, chạy lại gọi cân lần nữa | Nên sửa |

## Review độc lập lần 1: không đạt

| Ca | Lỗi | Mức | Xử lý |
| --- | --- | --- | --- |
| Q1 | Phiếu khám kết thúc sớm (f9) và sau đình chỉ (f11) không có clearance: võ sĩ `CLEARANCE_REQUIRED` | Nên sửa | Cấp clearance từ phiếu đó (lượt 2) |
| Q2 | Tài liệu ghi early "ít nhất 1 ngày trước"; lộ trình theo bậc chỉ áp R, R+1 nên phải đúng D−1 | Nên sửa | Sửa ticket, kịch bản, đầu script |
| Q3 | Early và chạy chính cùng ngày: `/clear` f8 bị 409, script dừng | Nên sửa | Cảnh báo, bỏ qua f8, chạy tiếp |
| Q4 | Khám dở dang không được sửa khi chạy lại | Nên sửa | Kiểm theo clearance của phiếu hiện hành |
| Q5 | `examinedAt` theo đồng hồ máy chạy; f11 chỉ khớp ngày hôm nay | Gợi ý | `now − 60 s`; khớp theo `startsOn` |

`T-066-cleanup.sql`: đạt (chỉ xoá mềm, cột đúng schema, kiểm số dòng và rollback).

## Review độc lập lần 2: không đạt

- **B1 (chặn):** backend trả loại phiếu ở `details.examinationType`, script đọc cấp ngoài; clearance chỉ cấp từ phiếu hiện hành (`medical.service.ts:1010-1013`). Chạy lại sau lần khám dở dang ghi thêm BASELINE rồi lỗi. API giả lưu phiếu khác backend nên Q4 qua bất kể code. Sửa ở lượt 3; API giả lưu `details` và từ chối clearance của phiếu không hiện hành.
- **N1 (nên sửa):** API giả không kiểm vai trò ở `/clear`, `/end-early`. Sửa ở lượt 3.
- G1–G4 (gợi ý): sửa ở lượt 3 (f11 so với `startsOn` thật, lưu ý 00:00–00:01, T7 tính trạng thái theo ngày, trả khối "Tài khoản HLV" về chỗ cũ).

## Review độc lập lần 3: đạt

Không còn chặn hay nên sửa. Ba gợi ý để lại, không ảnh hưởng demo:

1. Chạy lại sau khi phiếu TRAINING lỗi thì clearance cấp từ BASELINE (backend chấp nhận, võ sĩ tập được), nhưng không có phiếu TRAINING riêng.
2. API giả gán mọi phiếu cho bác sĩ Thu, nên nhánh `OTHER_DOCTOR` không bao giờ chạy; vai trò được giữ bằng kiểm token ở T4.
3. `--stage early` lỗi ở bước kết thúc sớm rồi chạy lại cùng ngày thì f9 có thêm một phiếu và clearance.

## Chưa làm

- Seed chưa chạy lên Supabase. Ken chạy `T-066-cleanup.sql` trước, rồi `--stage early` đúng D−1 và chạy chính sáng ngày D.
- Test e2e `test/coaching-loop-persistence.spec.ts` ghi user `@test.invalid` vào database thật: cần ticket riêng.
