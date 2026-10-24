# T-006 Review (phần A, backend)

- Ngày review: 22/10/2026, Claude.
- Phạm vi: `feat/T-006-weigh-in-and-result`. Gemini làm 4 commit code và handover (`810ac26` … `5ea5c53`); Claude thêm 1 commit sửa `79ebae1` (xem bên dưới). Nhánh tạo từ `fight-camp` tại `31fb332`; `fight-camp` đã có thêm commit tài liệu `44c1dd1`, không đụng file code nên merge không xung đột.
- **Kết luận: APPROVED** sau khi Claude sửa 2 lỗi mức "chặn" bên dưới (đã sửa, có test hồi quy). Không còn vấn đề mức "chặn".

## Hạn chế của lần review này

- Không độc lập hoàn toàn: ticket do Claude viết, và hai lỗi dưới đây một phần do ticket (lỗi 2). Nên để Ken đọc chéo `recordWeighIn`, `recordCatchweight`, `recordResult` trong `bouts.service.ts` trước khi T-007 xây tiếp lên.
- Chưa chạy với Supabase. T-006 không có migration; `test:db` và `db:check` chỉ xác nhận không làm hỏng chuỗi migration.

## Lệnh đã chạy lại

Chạy trong `D:/test/ai-worktrees/T-006`:

```text
$ pnpm --filter nestjs-api lint
exit 0; chỉ cảnh báo cũ, không có cảnh báo nào trong src/bouts

$ pnpm --filter nestjs-api build
exit 0

$ pnpm --filter nestjs-api test          (tại 79ebae1, sau khi sửa)
 Test Files  6 failed | 47 passed (53)
      Tests  26 failed | 798 passed (824)

$ npx vitest run src/bouts               (trong nestjs-api)
 Test Files  3 passed (3)
      Tests  149 passed (149)

$ pnpm --filter nestjs-api test:db
Migration checks passed: 41.

$ pnpm --filter nestjs-api db:check
001-024 checksums OK. No database connection was opened.
```

26 test lỗi đúng bằng baseline B1; 6 file lỗi gồm 2 file của B1 và 4 file spec rỗng của B2. Không thêm lỗi. Handover của Gemini ghi số liệu trước khi Claude sửa; sau sửa thêm 2 test (tổng 798 qua).

## Vấn đề đã tự sửa (commit `79ebae1`)

| # | Mức | Vị trí | Vấn đề | Cách tái hiện | Xử lý |
| --- | --- | --- | --- | --- | --- |
| 1 | Chặn | `nestjs-api/src/bouts/bouts.service.ts` `recordWeighIn` (khối `repo.transaction`) | `if (!updated) throw boutStateConflict()` nằm **ngoài** giao dịch. Hai request cân đồng thời: request thua vẫn commit dòng `fighter_measurements` loại `WEIGH_IN`, rồi mới báo 409. Để lại số cân chính thức mồ côi, và dòng đó lọt vào biểu đồ cân | Mock `updateBout` trả `undefined` ở lần gọi thứ hai; kiểm tra promise của `repo.transaction` | Ném `boutStateConflict()` ngay trong callback để rollback. Test mới `a lost race fails inside the transaction…` (fail trên bản cũ, qua sau sửa) |
| 2 | Chặn | `bouts.service.ts` `recordCatchweight` | Điều kiện `targetKg <= weightLimit` làm lựa chọn `CATCHWEIGHT` vô dụng khi cân đạt nhưng kiểm tra nước `FAILED` (cân 59,8, giới hạn 60): mọi giá trị ≥ 59,8 và > 60 không thể bằng mặc định 59,8. API vẫn trả `options: ['CATCHWEIGHT','CANCEL']` cho ca này. **Nguyên nhân gốc là ticket của Claude ghi "> `weight_limit_kg`"** | Trận `FIGHT_WEEK`, `officialWeightKg 59.80`, `hydrationCheck FAILED`, gọi `catchweight` không body → 422 | Bỏ điều kiện thừa; chỉ cần `catchweightKg ≥ officialWeightKg` (khi vượt cân thì số cân chính thức đã lớn hơn giới hạn). Test mới `accepts a catchweight when only the hydration check failed…` |
| 3 | Nên sửa | `bouts.service.ts` `addRequirement`, `updateRequirement`, `removeRequirement` | Khi mở khoá hồ sơ, kết quả của `repo.updateBout` (ghi `REQUIREMENT_UNLOCK` vào history, có `expectedStatus`) bị bỏ qua. Trận vừa đổi trạng thái vẫn cho sửa hồ sơ mà không có dấu vết | — | Thêm `if (!unlocked) throw boutStateConflict()` trong giao dịch ở cả ba chỗ |

## Đối chiếu tiêu chí nghiệm thu

| # | Kết quả | Căn cứ của tôi |
| --- | --- | --- |
| 1 | Đạt | `BOUT_TRANSITIONS` mở đúng hai bước; `COMPLETED → CANCELLED` vẫn bị từ chối |
| 2 | Đạt | `resolveWeightClass` so với giới hạn lớn nhất của các hạng còn lại |
| 3 | Đạt | `computeAcuteLoss`: loại `WEIGH_IN`, chọn số cân sớm nhất trong cửa sổ, `NO_DATA` khi trống. Lưu ý nhỏ: `lossPct` làm tròn 1 chữ số trước khi so với ngưỡng, nên 8,04% coi là `WITHIN` |
| 4–6 | Đạt | `recordWeighIn`; so kg bằng số nguyên theo trăm; nước `FAILED` giữ `FIGHT_WEEK`, `made_weight = true` |
| 7 | Đạt sau sửa | Xem vấn đề 2 |
| 8–9 | Đạt | Cân lại được khi còn `FIGHT_WEEK`; chặn trước ngày cân và sai trạng thái |
| 10 | Đạt | Điểm cân chính thức nằm trong `points` (`findWeightMeasurements` không lọc theo context) |
| 11–13 | Đạt | `recordResult`: `BOUT_NOT_STARTED`, điều kiện hiệp, mất ý thức, đòn vào đầu; chỉ `history` giữ ba trường, không chạm `injury_records` |
| 14 | Đạt | Huỷ từ `WEIGHED_IN` giữ hành vi cũ |
| 15 | Đạt sau sửa | Khoá hồ sơ và ghi `REQUIREMENT_UNLOCK`; xem vấn đề 3 |
| 16 | Đạt | `reason` bắt buộc khi đổi hạng; gửi lại đúng hạng cũ thì bỏ qua |
| 17 | Đạt | Quyền `bout:update` / `bout:result` ở controller; `assertWriteAccess` trong service |
| 18 | Đạt sau sửa | Xem vấn đề 1. Test cũ chỉ kiểm tra mã lỗi, không kiểm tra rollback; test mới bổ sung |

## Gợi ý (không chặn)

- `bouts.service.ts` `recordResult`: khối kiểm tra điều kiện viết thẳng trong service; có thể tách hàm thuần `validateResultInput` vào `bouts.model.ts` để T-010 mục 7 (R26) mở rộng dễ hơn.
- Handover trích số dòng trước khi Claude sửa; lệch vài dòng ở `bouts.service.ts`.

## Ghi chú khi merge

- T-010 (Codex) sửa cùng các file `bouts.model.ts`, `bouts.service.ts`, `bouts.controller.ts`, `bouts.dto.ts`, `bouts.error.ts`, `bouts.repo.ts`, `bouts.service.spec.ts`, `schema.ts`. Đề xuất **merge T-006 trước**; T-010 sau đó merge `fight-camp` vào nhánh của mình (không rebase), giữ cả hai bên, rồi làm tiếp mục 6, 7 của T-010.
- T-006 không có migration; không cần áp gì lên Supabase.
