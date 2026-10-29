# T-030 Handover

- Nhánh: `feat/T-030-suspension-ui` (chưa commit theo yêu cầu của ticket)
- Trạng thái: IN REVIEW

## Phần B1, lượt sửa 3: Siết chặt kiểm thử và kiểu dữ liệu nhãn lý do đình chỉ

### Thay đổi
1. **Kiểu dữ liệu cho nhãn lý do đình chỉ (`Record<SuspensionReason, MessageKey>`)**:
   - Khai báo kiểu `export type SuspensionReason = "KO" | "TKO" | "DQ" | "MANDATORY_REST" | "MEDICAL" | "OTHER";`
   - Khai báo bảng tra cứu có kiểu `const SUSPENSION_REASON_MESSAGE_KEYS: Record<SuspensionReason, MessageKey>` thay cho việc ép kiểu chuỗi template `` `suspension.reason.${code}` as MessageKey ``. Nhờ đó, nếu thiếu khoá hoặc khoá i18n không tồn tại trong `MessageKey`, typecheck sẽ báo lỗi ngay khi biên dịch.
2. **Siết kiểm thử B1-6, B1-7, B1-9**:
   - B1-6: Kiểm tra chính xác chuỗi thông báo lỗi khi dữ liệu `details.suspensions` bị sai bằng đúng chuỗi tiếng Việt của khoá `training.error.suspensionActiveGeneral` (`"Võ sĩ đang có lệnh đình chỉ thi đấu chặn buổi tập này."`).
   - B1-7: Bổ sung kiểm tra `not.toContain("chờ xác nhận")`.
   - B1-9: Bổ sung kiểm tra `not.toContain("chờ xác nhận")`.
3. **Viết lại B1-12 và bổ sung các ca kiểm thử B1-14, B1-15, B1-16**:
   - B1-12 (viết lại): `details.suspensions` có KO có `gradedReturn` và `endsOn: "2026-12-15"`, MANDATORY_REST không `gradedReturn` và `endsOn: "2026-12-03"` → câu thông báo chọn MANDATORY_REST (đang hiệu lực) dù KO có `endsOn` muộn hơn.
   - B1-14: Hai đình chỉ đều không có `gradedReturn` (OTHER `endsOn: "2026-12-03"` và MEDICAL `endsOn: "2026-12-10"`) → chọn MEDICAL do có `endsOn` muộn hơn.
   - B1-15: Lỗi 409 `TRAINING_MEDICAL_ELIGIBILITY_REQUIRED` có `reasons` và danh sách suspensions như B1-12 → phần câu đình chỉ được chọn chính xác là của MANDATORY_REST.
   - B1-16: `requiresClearance` truyền chuỗi `"true"` và số `1` → parse ra boolean `false` (`candidate.requiresClearance === true`), câu thông báo không chứa cụm "chờ xác nhận".

---

## Đối chiếu tiêu chí nghiệm thu (Phần B1: B1-1 đến B1-16)

| Tiêu chí | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| **B1-1**: `coachTodoSchema` parse item `source: 'TRAINING_CONFLICTS_WITH_SUSPENSION', count: 3` → Parse được; thẻ hiện "3 buổi tập xung đột với đình chỉ" (vi) | `nextjs-frontend/src/lib/domain/coach-todo.test.ts:135` (`it("B1-1: coachTodoSchema parse item source: 'TRAINING_CONFLICTS_WITH_SUSPENSION', count: 3 -> parse được; thẻ hiện '3 buổi tập xung đột với đình chỉ' (vi)")`) |
| **B1-2**: Item `source: 'SUSPENSION_AWAITING_CLEARANCE'` → Parse được; thẻ hiện "Đình chỉ chờ xác nhận được tập lại" | `nextjs-frontend/src/lib/domain/coach-todo.test.ts:159` (`it("B1-2: Item source: 'SUSPENSION_AWAITING_CLEARANCE' -> parse được; thẻ hiện 'Đình chỉ chờ xác nhận được tập lại'")`) |
| **B1-3**: Lỗi 409 `TRAINING_SUSPENSION_ACTIVE`, `details.suspensions = [{ reason:'KO', endsOn:'2026-12-01', requiresClearance:true }]` → Đọc được 1 đình chỉ; câu lỗi có lý do và ngày, thông báo chờ xác nhận được tập lại | `nextjs-frontend/src/lib/services/training-errors.test.ts:47` (`it("B1-3: Lỗi 409 TRAINING_SUSPENSION_ACTIVE, details.suspensions = [{ reason:'KO', endsOn:'2026-12-01', requiresClearance:true }] -> đọc được 1 đình chỉ; câu lỗi có lý do và ngày, không phải câu lỗi chung")`) |
| **B1-4**: Như B1-3 nhưng phần tử có `gradedReturn: { ceiling: 3, fullReturnOn: '2026-12-04' }` → Đọc được trần bậc 3 và ngày tập đầy đủ, dùng "ngày này tối đa bậc" | `nextjs-frontend/src/lib/services/training-errors.test.ts:74` (`it("B1-4: Như B1-3 nhưng phần tử có gradedReturn: { ceiling: 3, fullReturnOn: '2026-12-04' } -> đọc được trần bậc 3 và ngày tập đầy đủ")`) |
| **B1-5**: 409 `TRAINING_MEDICAL_ELIGIBILITY_REQUIRED` có cả `reasons` và `suspensions` → Hiện cả lý do y tế lẫn đình chỉ | `nextjs-frontend/src/lib/services/training-errors.test.ts:104` (`it("B1-5: 409 TRAINING_MEDICAL_ELIGIBILITY_REQUIRED có cả reasons và suspensions -> hiện cả lý do y tế lẫn đình chỉ")`) |
| **B1-6**: `details` sai hình dạng (`suspensions: 'x'`, phần tử thiếu `endsOn`) → Không ném lỗi; bỏ phần tử sai; câu đúng bằng chuỗi vi của khoá `training.error.suspensionActiveGeneral` | `nextjs-frontend/src/lib/services/training-errors.test.ts:130` (`it("B1-6: details sai hình dạng (suspensions: 'x', phần tử thiếu endsOn) -> không ném lỗi; bỏ phần tử sai; câu đúng bằng chuỗi vi của khoá training.error.suspensionActiveGeneral")`) |
| **B1-7**: 409 với reason `'MANDATORY_REST'`, endsOn `'2026-12-01'`, requiresClearance false → câu chứa "Nghỉ bắt buộc" và ngày đúng định dạng `formatShortDate('2026-12-01','vi')`, KHÔNG chứa "MANDATORY_REST", "2026-12-01", hay "chờ xác nhận" | `nextjs-frontend/src/lib/services/training-errors.test.ts:153` (`it("B1-7: 409 với reason 'MANDATORY_REST', endsOn '2026-12-01', requiresClearance false -> câu chứa 'Nghỉ bắt buộc' và ngày đúng định dạng formatShortDate('2026-12-01','vi'), KHÔNG chứa 'MANDATORY_REST' hay '2026-12-01'")`) |
| **B1-8**: phần tử có gradedReturn `{ceiling:3, fullReturnOn:'2026-12-04'}`, reason `'KO'` → câu chứa "tập lại theo bậc", "bậc 3", ngày `formatShortDate('2026-12-04','vi')`; KHÔNG chứa "đang bị đình chỉ" | `nextjs-frontend/src/lib/services/training-errors.test.ts:166` (`it("B1-8: phần tử có gradedReturn {ceiling:3, fullReturnOn:'2026-12-04'}, reason 'KO' -> câu chứa 'tập lại theo bậc', 'bậc 3', ngày formatShortDate('2026-12-04','vi'); KHÔNG chứa 'đang bị đình chỉ'")`) |
| **B1-9**: reason lạ `'XYZ'` → dùng nhãn "Khác", câu KHÔNG chứa "chờ xác nhận" | `nextjs-frontend/src/lib/services/training-errors.test.ts:184` (`it("B1-9: reason lạ 'XYZ' -> dùng nhãn 'Khác'")`) |
| **B1-10**: `requiresClearance: true`, endsOn `'2026-12-01'`, không gradedReturn → câu chứa "chờ xác nhận được tập lại" và ngày `formatShortDate('2026-12-01','vi')`; kết quả giống nhau bất kể giờ máy (fake timers) | `nextjs-frontend/src/lib/services/training-errors.test.ts:194` (`it("B1-10: requiresClearance true, endsOn '2026-12-01', không gradedReturn -> câu chứa 'chờ xác nhận được tập lại' và ngày formatShortDate('2026-12-01','vi'); kết quả giống nhau bất kể giờ máy")`) |
| **B1-11**: gradedReturn → câu không chứa "hôm nay" (vi) và không chứa "today" (en) | `nextjs-frontend/src/lib/services/training-errors.test.ts:218` (`it("B1-11: gradedReturn -> câu không chứa 'hôm nay' (vi) và không chứa 'today' (en)")`) |
| **B1-12** (viết lại): `details.suspensions` = [KO có gradedReturn {ceiling:3, fullReturnOn:'2026-12-20'} và endsOn '2026-12-15', MANDATORY_REST không gradedReturn endsOn '2026-12-03'] → câu là của MANDATORY_REST (dù KO có endsOn muộn hơn) | `nextjs-frontend/src/lib/services/training-errors.test.ts:236` (`it("B1-12: details.suspensions = [KO có gradedReturn {ceiling:3, fullReturnOn:'2026-12-20'} và endsOn '2026-12-15', MANDATORY_REST không gradedReturn endsOn '2026-12-03'] -> câu là của MANDATORY_REST (dù KO có endsOn muộn hơn)")`) |
| **B1-13**: `details.suspensions = [hợp lệ, thiếu endsOn, 'x']` → giữ đúng 1 phần tử hợp lệ | `nextjs-frontend/src/lib/services/training-errors.test.ts:257` (`it("B1-13: details.suspensions = [hợp lệ, thiếu endsOn, 'x'] -> giữ đúng 1 phần tử hợp lệ")`) |
| **B1-14**: Hai đình chỉ không gradedReturn: OTHER endsOn '2026-12-03' và MEDICAL endsOn '2026-12-10' → câu là của MEDICAL (endsOn muộn hơn) | `nextjs-frontend/src/lib/services/training-errors.test.ts:270` (`it("B1-14: hai đình chỉ không gradedReturn: OTHER endsOn '2026-12-03' và MEDICAL endsOn '2026-12-10' -> câu là của MEDICAL (endsOn muộn hơn)")`) |
| **B1-15**: 409 `TRAINING_MEDICAL_ELIGIBILITY_REQUIRED` có reasons và cùng danh sách như B1-12 → phần đình chỉ trong câu là của MANDATORY_REST | `nextjs-frontend/src/lib/services/training-errors.test.ts:282` (`it("B1-15: 409 TRAINING_MEDICAL_ELIGIBILITY_REQUIRED có reasons và cùng danh sách như B1-12 -> phần đình chỉ trong câu là của MANDATORY_REST")`) |
| **B1-16**: `requiresClearance` là chuỗi "true" và số 1 → parse ra requiresClearance false (câu không chứa "chờ xác nhận") | `nextjs-frontend/src/lib/services/training-errors.test.ts:304` (`it("B1-16: requiresClearance là chuỗi 'true' và số 1 -> parse ra requiresClearance false (câu không chứa 'chờ xác nhận')")`) |

---

## Lệnh đã chạy

### pnpm --filter nextjs-frontend lint
```text
$ eslint
```

### pnpm --filter nextjs-frontend typecheck
```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```

### pnpm --filter nextjs-frontend test
```text
$ vitest run

 RUN  v5.0.1 D:/MMA-TMS/nextjs-frontend


 Test Files  93 passed | 1 skipped (94)
      Tests  829 passed | 2 skipped (831)
   Start at  17:16:41
   Duration  3.30s (import 47%, transform 36%, tests 15%, worker 1%)

  Transform  transforming modules took 12.38s · 36% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns
```

## Lệch so với ticket
Không có. Toàn bộ các tiêu chí và ca kiểm thử B1-1 đến B1-16 đã được siết chặt và nghiệm thu thành công.

## Câu hỏi / việc còn mở
Không có. Sẵn sàng nghiệm thu phần B1 và chuyển sang phần B2.
