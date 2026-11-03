# T-050 Review

- Ngày: 03/11/2026. Người review: Claude (lead) và subagent review độc lập không mang ngữ cảnh (5 lượt).
- Ticket: [T-050](./T-050-early-end-by-doctor-exam.md). Handover: [T-050-HANDOVER.md](./T-050-HANDOVER.md).
- Nhánh `User_Feature`. Phần A: commit `dbc4d05`. Phần B: commit kế tiếp (frontend + tài liệu).

## Kết luận

**APPROVED** cả phần A và phần B. Không còn vấn đề chặn hay nên sửa về hành vi. Còn một giới hạn ở test (mục "Giới hạn"), ghi nhận, không chặn.

Ken áp migration 033 lên Supabase trước khi demo luồng này ở API mode.

## Ai code

- Phần A: subagent Claude (lúc đó `agy` bị chặn quyền), lượt sửa 1 subagent, lượt sửa 2 (lỗi kiểu ở spec) `agy` `gemini-3.8-flash-high`.
- Phần B: `agy` `gemini-3.8-flash-high` (`gemini-4-argon-high` hết quota), 3 lượt.

## Lệnh đã chạy lại (Claude)

| Lệnh | Kết quả |
| --- | --- |
| `pnpm --filter nestjs-api lint` | exit 0, 38 cảnh báo có sẵn, không cái nào trong `src/suspensions` |
| `pnpm --filter nestjs-api build` | exit 0 |
| `pnpm --filter nestjs-api test` | `Tests 26 failed / 1205 passed (1231)`; 26 lỗi đúng 6 file baseline B1, B2 |
| `pnpm --filter nestjs-api test:db` | `Migration checks passed: 50`, có M1–M6 |
| `pnpm --filter nestjs-api db:check` | `001-033 checksums OK` |
| `vitest run src/suspensions src/bouts src/training src/medical` (sau sửa A) | 840/840 |
| `vitest run src/training src/suspensions` (sau sửa A lượt 2) | 323/323; `tsc --noEmit` cả spec từ 85 xuống 79 lỗi, không còn lỗi do T-050 |
| `pnpm --filter nextjs-frontend lint` / `typecheck` / `test` (sau sửa B lượt 2) | exit 0 / exit 0 / `Tests 1149 passed, 2 skipped (1151)` |

## Review độc lập và cách xử lý

| Lượt | Phạm vi | Kết luận | Vấn đề tìm thấy | Xử lý |
| --- | --- | --- | --- | --- |
| 1 | Phần A | APPROVED | Nên sửa (test): thiếu ca CLB chỉ gửi `liftReference`. Gợi ý: kiểm vai trò DOCTOR không có test riêng | Thêm E15b, E8b (lỗi trước, qua sau), cùng 3 chỗ gọn của ponytail-review |
| 2 | Phần A lượt sửa 1 | APPROVED | Gợi ý: `tsc` cả spec lỗi ở `training-suspension-conflicts.service.spec.ts` (constructor 3 tham số, 4 cột mới) | `agy` sửa, 6 lỗi biến mất |
| 3 | Phần B | CHANGES REQUESTED | **Chặn:** trang bác sĩ lọc phiếu khám theo `user.id` thay vì id hồ sơ bác sĩ, bác sĩ không bao giờ chọn được phiếu. **Chặn:** W1 tự dựng lại logic. Nên sửa: W4, W6, W7 thiếu ý; câu ngày trên trang HLV gọi ngày kết thúc là ngày khám; trang bác sĩ đoán ngày; link "→" không có tên; lỗi server không hiện trong hộp thoại; trang bác sĩ sập khi không tải được đình chỉ; bộ lọc đoán trường | Lượt sửa 1: dùng `user.profileId` (ca W2b lỗi trên code cũ), viết lại W1 render trang thật, thêm W10, W11, sửa câu W8 trong ticket, bỏ trường đoán mò và khóa i18n chết |
| 4 | Phần B lượt sửa 1 | APPROVED | Nên sửa (test): W10 bơm lỗi qua prop chỉ-test. Gợi ý: so `validUntil` bằng chuỗi | Lượt sửa 2: bỏ prop chỉ-test, W10 qua hàm xử lý kết quả thật; so theo thời điểm, ca W2c lỗi trên code cũ |
| 5 | Phần B lượt sửa 2 | Nên sửa (test) | W10 không chứng minh được hộp thoại nối `handleEarlyEndActionResult` và render alert | Ghi nhận ở "Giới hạn"; review đọc tay xác nhận nối đúng (`suspension-early-end-dialog.tsx` dòng ~141-159, ~184) |

Lỗi chặn ở lượt 3 do Claude bỏ sót khi tự review; mục tự review Impeccable/Ponytail của `agy` cũng báo "đạt". Review độc lập là bước bắt được.

## Đối chiếu tiêu chí nghiệm thu

1. Mọi ca có test đúng tên: C1–C5, E1–E15, E8b, E15b, X2–X11, O1–O5, G1–G6, M1–M6, W1–W11, W2b, W2c. G1, E8b, E15b, W2b, W2c có output lỗi trên code cũ trong handover. Đạt.
2. `test:db` M1–M6 qua; `db:check` `001-033 checksums OK`. Đạt.
3. `/clear` không đổi (E12, test T-049 qua). Đạt.
4. Phản hồi có 4 trường mới; client không gửi `issuedBy` vẫn tạo được (C4); frontend parse phản hồi cũ bằng `.default`. Đạt.
5. Không thêm lỗi so với baseline. Đạt.

## Giới hạn

- Repo frontend không có thư viện mô phỏng DOM, nên phần nối dây trong hộp thoại (submit gọi `handleEarlyEndActionResult`, render `SuspensionEarlyEndAlert`) chỉ được kiểm bằng đọc code, không có test.
- Frontend không biết phiếu đã bị thay; backend trả `SUPERSEDED` và hộp thoại hiện câu lỗi.
- `endSuspensionEarly` bản demo không kiểm phân công và phiếu khám (dữ liệu demo thuộc T-052).
- `/clear` với đình chỉ ban tổ chức đã quá hạn chưa đòi văn bản gỡ; mọi `MEDICAL` đều đi lộ trình theo bậc (đã ghi ở FLOWS F7).

## Tài liệu đã cập nhật

- `docs/FIGHT-CAMP-BUSINESS-FLOWS.md` F7: lộ trình theo bậc có `MEDICAL`; mục "Kết thúc đình chỉ sớm, phải có căn cứ".
- `docs/SCOPE-FIGHT-CAMP.md`: dòng "Cổng Doctor" thành "Giữ một phần".
- `nestjs-api/docs/modules/01-suspensions-core.md`: endpoint end-early, cột mới, mã lỗi.
- Ticket: câu W8 và đoạn bộ lọc phiếu khám (03/11).
