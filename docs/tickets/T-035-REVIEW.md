# T-035 Review

- Nhánh: `fix/T-035-suspension-gate`, commit `e811562` (phần B), `9880936` (phần A). Merge vào `User_Feature` ở `a887004` cho Ken review.
- Người thực hiện: `agy` (`gemini-3.8-flash-high`; `gemini-4-argon-high` hết quota ngày 29/10).
- Ngày: 29/10/2026.

## Kết luận

**APPROVED cho phần A và B.** Phần C (tái hiện "sparring vẫn xếp được" ở API mode) chưa làm: cần dev có `.env`. Tiêu chí 6 còn mở, nên chưa đóng ticket.

## Lệnh Claude chạy lại

| Lệnh | Kết quả |
| --- | --- |
| `pnpm --filter nestjs-api lint` | Thoát 0, chỉ có warning có sẵn |
| `pnpm --filter nestjs-api build` | Thoát 0 |
| `npx vitest run src/suspensions src/training src/coaching src/bouts` | `Test Files 24 passed (24)`, `Tests 583 passed (583)` |
| `pnpm --filter nestjs-api test` | `Test Files 6 failed | 59 passed (65)`, `Tests 26 failed | 1028 passed (1054)`. 26 lỗi nằm ở `test/coaching-loop-persistence.spec.ts`, `test/dataset-export-trust-boundary.spec.ts` và 4 file spec rỗng của `src/notifications/`, đúng [baseline](./BASELINE.md) B1, B2. Khớp số trong handover |

## Đối chiếu tiêu chí

| # | Kết quả | Ghi chú |
| --- | --- | --- |
| 1 | Đạt | `DEFAULT_MANUAL_BLOCKED_SESSION_TYPES` lọc từ `SESSION_TYPES` (`suspensions.model.ts:45`), không chép tay; test ở `suspensions.service.spec.ts` |
| 2 | Đạt | Test `PAD_WORK` 409, `RECOVERY`/`PHYSICAL_THERAPY` tạo được, ở `training-session.service.spec.ts` |
| 3 | Đạt | Test gửi `['SPARRING']` |
| 4 | Đạt | Không test `suggestSuspensions` nào phải sửa kỳ vọng: ca không có ruleset dùng `expect.objectContaining` không xét `blockedSessionTypes` |
| 5, 5b | Đạt | Cổng 2 gọi trong cùng `tx`, **trước** khi chèn plan (`coaching.service.ts:205-217`), nên khi bị chặn không có insert nào; 3 test ở `coaching.service.spec.ts` |
| 6 | Chưa làm | Cần dev có `.env` |
| 7 | Đạt | Xem bảng lệnh |

## Vấn đề

- **Gợi ý.** Ca 5b chỉ kiểm việc gate được gọi với `scheduledAt` và gate trả rỗng (mock); logic ngày nằm ở `suspension.gate.spec.ts` có sẵn. Chấp nhận được với unit test.
- **Việc còn mở (ngoài phạm vi).** `POST /coaching/assignments` chưa có cổng y tế (`evaluateTrainingEligibility`). Ghi lại để chủ dự án quyết.
- Không có vấn đề mức chặn.

## Review độc lập (29/10)

Subagent không mang ngữ cảnh review chỉ đọc trên `2130c70`: tiêu chí 1–5, 5b, 7 đạt; kết luận "OK to merge". Gợi ý: test 5b chỉ kiểm việc truyền ngày vào gate (gate trả rỗng bằng mock); luật ngày nằm ở `suspension.gate.spec.ts`. Lượt sửa 2 của T-036 trả lại cách lọc mặc định từ `SESSION_TYPES` mà T-036 lượt 1 đã chép tay.
