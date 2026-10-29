# T-045 Review (phần A)

- Nhánh: `feat/T-045-graded-return` (tạo từ `User_Feature` sau khi merge T-036).
- Người thực hiện: `agy`, `gemini-4-argon-high`, 1 lượt (khoảng 33 phút).
- Ngày: 29/10/2026.

## Kết luận

**APPROVED.** Không migration. Không có vấn đề mức chặn.

## Lệnh Claude chạy lại

| Lệnh | Kết quả |
| --- | --- |
| `pnpm --filter nestjs-api lint` | Thoát 0 |
| `pnpm --filter nestjs-api build` | Thoát 0 |
| `pnpm --filter nestjs-api db:check` | `001-032 checksums OK. No database connection was opened.` |
| `npx vitest run src/suspensions src/training src/coaching src/bouts` | `Test Files 24 passed (24)`, `Tests 598 passed (598)` |
| `pnpm --filter nestjs-api test` | `Test Files 6 failed | 59 passed (65)`, `Tests 26 failed | 1043 passed (1069)`: 26 lỗi đúng [baseline](./BASELINE.md) B1, B2; tăng 9 test so với sau T-036 (1034) |
| `grep "from '../(training|bouts)" src/suspensions/` (không tính spec) | 0 dòng |

## Đối chiếu tiêu chí

| # | Kết quả | Ghi chú |
| --- | --- | --- |
| 1. Bảng bậc | Đạt | `SESSION_INTENSITY_TIERS` (`suspensions.constants.ts`) là `Record<SessionType, …>`: thêm loại buổi mà không gán bậc thì `build` lỗi |
| 2. `maxTier: 3` → `['SPARRING', 'GRAPPLING']`; gửi kèm `blockedSessionTypes` lỗi validation | Đạt | `blockedTypesForMaxTier` lọc theo thứ tự `SESSION_TYPES` |
| 3. `maxAllowedTier`: mặc định T-035 → 1; chỉ `SPARRING` → 4 | Đạt | Trả 0 khi bậc 1 bị chặn |
| 4. Lộ trình D, D+1, D+2 và `gradedReturn` trong 409 | Đạt | `gradedReturnFor` (`suspensions.model.ts:193`); `SuspensionGate` giữ nguyên logic khi đình chỉ còn hiệu lực, chỉ thêm nhánh lộ trình khi đã hết |
| 5. `MANDATORY_REST` hết ngày E: E+1 `SPARRING` được | Đạt | Chỉ `KO`, `TKO` có lộ trình |
| 6. `KO` chưa xác nhận: chặn như cũ, không `gradedReturn` | Đạt | |
| 7. Bảng sẵn sàng: ngày D+1 "Chưa sẵn sàng", có `fullReturnOn` | Đạt | `classifyReadiness` (`bouts.model.ts:1301`); `getReadiness` đọc mọi đình chỉ chưa xoá (`findSuspensionsByFighterIds`), nên đình chỉ KO đã hết vẫn được tính lộ trình ở dữ liệu thật |
| 8. Không migration, không mã lỗi mới, không thư viện | Đạt | |

## Gợi ý và việc còn mở

- **Việc còn mở (đã nêu trong handover).** Buổi đã xếp vào hai ngày lộ trình không tự xử lý khi xác nhận tập lại; chúng bị chặn ở Cổng 2 khi bắt đầu. Nếu cần, ticket sau nối `clearSuspension` vào `SuspensionEffects` của T-036.
- **Giới hạn đã biết.** Lộ trình tính theo ngày, không lưu tiến độ, không lùi bậc khi có triệu chứng (Amsterdam yêu cầu lùi về bước trước). Đã ghi ở ticket mục 3; bậc là mức trần xếp lịch, không phải chỉ định y khoa.

## Review độc lập (29/10)

Subagent không mang ngữ cảnh review chỉ đọc trên `2130c70`: tiêu chí 1–8 đạt; kết luận "OK to merge", sau khi sửa T-036. Ghi nhận: tiêu chí 2 của ticket ghi ngược thứ tự (đã sửa trong ticket, code đúng); `maxAllowedTier` trả 0 khi bậc 1 bị chặn (chủ ý, nay đã ghi). Lần review thứ hai kiểm T-045 sau khi merge lượt sửa 2 của T-036: xem [T-036-REVIEW](./T-036-REVIEW.md#review-độc-lập-2910).
