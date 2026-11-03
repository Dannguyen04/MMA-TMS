# T-049 Review lần 2 (độc lập)

- Ngày: 02/11/2026. Người review: Claude (subagent, không mang ngữ cảnh phiên trước), theo yêu cầu của chủ dự án.
- Code: commit `b234537` (Ken), đã vào `fight-camp` qua merge `86b26aca` ("Merge branch 'User_Feature' into fight-camp"). Kiểm trên `fight-camp` tại `66c0887`.
- Cách làm: đọc diff, đọc lại `clearSuspension`, repo, model, demo, action; grep mọi nơi gọi `/clear` và mọi nơi ghi `cleared_at`; chạy lại test liên quan. Không sửa code, không chạy database.

## Kết luận

**APPROVED, giữ kết luận của review lần 1.** Logic đúng ticket, không có vấn đề mức chặn. Có 2 việc **nên sửa**, đều ở tài liệu và đều nhỏ, cùng vài gợi ý về test.

## Lệnh Claude chạy lại

Chỉ chạy test liên quan (một agent khác có thể đang chạy bộ backend đầy đủ trong cùng thư mục).

| Lệnh | Kết quả |
| --- | --- |
| `pnpm --filter nestjs-api exec vitest run src/suspensions` | `Test Files 5 passed (5)`, `Tests 79 passed (79)` |
| `pnpm --filter nextjs-frontend exec vitest run src/lib/services/suspensions.test.ts` | `Test Files 1 passed (1)`, `Tests 37 passed (37)` (có C9, C10) |
| `pnpm --filter nestjs-api db:check` | `001-032 checksums OK. No database connection was opened.` |

Không chạy lại `src/bouts`, lint, build, bộ frontend đầy đủ: review lần 1 đã chạy (`470/470`, frontend `954 passed | 2 skipped`) và commit không đổi file nào ngoài các file trong diff.

## Kiểm từng điểm

| Điểm | Kết quả | Căn cứ |
| --- | --- | --- |
| Chỉ xác nhận được khi `AWAITING_CLEARANCE` | Đạt | `suspensions.service.ts:185-188`: `suspensionStatusOn(locked, academyDateOf(new Date()))`, khác `AWAITING_CLEARANCE` thì ném lỗi mới. `suspensionStatusOn` (`suspensions.model.ts:114-122`) chỉ trả `AWAITING_CLEARANCE` khi `d > endsOn`, `requiresClearance`, chưa xác nhận |
| 409 `SUSPENSION_NOT_AWAITING_CLEARANCE` ở mọi trạng thái khác | Đạt | `UPCOMING` (C4), `ACTIVE` (C1, C2, C5), `ENDED` do không cần xác nhận (C6). Đã xác nhận thì vẫn `SUSPENSION_ALREADY_CLEARED` (C7), vì kiểm `clearedAt` trước (`service.ts:184`) |
| Thứ tự kiểm | Đạt | 422 (schema), 403 vai trò, 404, 403 phân công, `ALREADY_CLEARED`, mã mới. Đúng như review lần 1 ghi. Ticket ghi "404, 403" là chưa chính xác (403 vai trò đứng trước 404) nhưng thứ tự này có từ trước T-049, không đổi |
| Tranh chấp (race) | Đạt | Kiểm và ghi trong cùng giao dịch, trên dòng đã khoá `SELECT … FOR UPDATE` (`suspensions.repo.ts:302-311`); câu `UPDATE` còn có điều kiện `cleared_at IS NULL` (`repo.ts:447-453`), không ghi được thì `ALREADY_CLEARED`. Hai lần xác nhận cùng lúc: lần sau chờ khoá rồi thấy `clearedAt` khác null. "Hết hạn" không phải một lần ghi (trạng thái tính khi đọc, không lưu cột trạng thái), và `clearSuspension` là đường ghi duy nhất vào bảng `suspensions` sau khi tạo (grep `update(suspensions)`: chỉ `repo.ts:440`), nên không có thay đổi `ends_on`/`requires_clearance` nào chen vào giữa |
| Biên thời gian | Đạt | `academyDateOf` cộng cố định UTC+7 (`suspensions.constants.ts:79`), Việt Nam không đổi giờ mùa hè. 23:59:59 ngày `endsOn` giờ VN là `ACTIVE`, 00:00 ngày `endsOn + 1` là `AWAITING_CLEARANCE`. `clearedAt` lấy `new Date()` **sau** lúc kiểm nên không thể rơi vào ngày trước `endsOn + 1`. Hàm `academyDateOf` có test biên riêng (`bouts.model.spec.ts:301-302`) |
| Đình chỉ tạo tay và tự động | Đạt | Cùng một bảng, cùng một hàm; không có nhánh riêng theo `bout_id` |
| Lộ trình theo bậc (T-045) | Đạt, tốt hơn trước | `gradedReturnFor` lấy ngày bắt đầu `R = academyDateOf(clearedAt)`. Trước T-049, xác nhận sớm khiến `R` rơi vào giữa đình chỉ. Nay `R >= endsOn + 1` luôn đúng với bản ghi mới. Bản ghi cũ đã bị xác nhận sớm (nếu có) vẫn hiển thị `ENDED`; ticket để chủ dự án tự kiểm |
| Buổi `PENDING` (T-036 A2) | Không ảnh hưởng | T-036 A2 chỉ chạy khi **tạo** đình chỉ. Xác nhận không đụng buổi `PENDING`, trước và sau T-049 như nhau |
| Frontend xử lý mã mới | Đạt | `actions/suspensions.ts:51-53` map sang `suspensions.action.notAwaitingClearance`, có ở `coach-bouts.vi.ts` và `.en.ts`. Demo (`suspensions.demo.ts:199-208`) ném cùng mã, cùng `details.status`, sau kiểm `clearedAt` |
| Điện thoại | Không cần sửa | `reactnative-mobile` không gọi `/clear` (git grep 0 dòng); T-051 đã ghi mã này "để biết" |
| Nơi khác gọi `/clear` | Không có | Chỉ `suspension-clearance-dialog.tsx` → `clearSuspensionAction`. Script seed không gọi; `test-migrations.mjs:1025, 1035` ghi `cleared_at` bằng SQL để kiểm ràng buộc, không qua service |
| Mã lỗi đăng ký đúng chỗ | Đạt | `suspensions.error.ts:29-39` theo mẫu `suspensionAlreadyCleared`; Swagger ghi trong `description` của `@ApiConflictEnvelope` (`controller.ts:137-141`), vì một status chỉ có một envelope; tài liệu module `01-suspensions-core.md:42, 62`. Tech spec §4 không liệt kê mã lỗi của module suspensions (kể cả `SUSPENSION_ALREADY_CLEARED`), nên không thiếu so với quy ước hiện có |
| Test phủ từng nhánh | Đạt, còn khe nhỏ | Xem gợi ý G1–G3 |

### Đối chiếu khẳng định của review lần 1

| Khẳng định | Kiểm lại |
| --- | --- |
| Tính trạng thái trên dòng đã khoá | Đúng (`locked`, không phải `current`) |
| Thứ tự 422, 403, 404, 403 phân công, `ALREADY_CLEARED`, mã mới | Đúng |
| Không caller nào dựa vào xác nhận sớm | Đúng (grep backend, frontend, điện thoại, script) |
| C3 kiểm audit context chặt hơn test cũ | Đúng (`service.spec.ts:827-836`: gọi đúng 1 lần, đúng tham số, trước `lockSuspensionById`) |
| Gợi ý 3: `expect(ko.clearedAt).toBeNull()` không thể lỗi | Đúng; chặn thật là `repo.clearSuspension` không được gọi (`spec.ts:806`) |
| C8 bỏ vì `test:db` chỉ chạy SQL | Đúng, `scripts/test-migrations.mjs` không dựng service |

## Vấn đề

| # | Mức | Cỡ | Vị trí | Vấn đề | Cách sửa |
| --- | --- | --- | --- | --- | --- |
| N1 | Nên sửa | Nhỏ | `docs/tickets/T-049-clear-only-when-awaiting.md`, mục "Ghi chú 31/10 (trạng thái hiện tại)" | Dòng trạng thái ghi DONE, nhưng mục "trạng thái hiện tại" vẫn nói code "được cất tạm (chưa commit)" trong `git stash` trên máy Ken. Người đọc sau sẽ không biết code đã ở `b234537` | Đổi mục đó thành "Code ở `b234537`, vào `fight-camp` qua `86b26aca`"; bỏ hai dòng stash/patch |
| N2 | Nên sửa | Nhỏ | `docs/tickets/T-049-HANDOVER.md:3` | Handover ghi "Nhánh: `User_Feature` (không commit, không push, không tạo nhánh)" và không có hash commit, trái mẫu §6. Thực tế code được commit trên `User_Feature` rồi merge thẳng vào `fight-camp`, không qua nhánh `feat/T-049-…` (§3) | Ghi `Commit: b234537`, ghi rõ nhánh thật. Lần sau tạo nhánh ticket riêng |
| G1 | Gợi ý | Nhỏ | `suspensions.service.spec.ts:781` | Mọi ca dùng 10:00 giờ VN (`T03:00Z`), lúc đó ngày UTC và ngày học viện trùng nhau. Nếu ai đó thay `academyDateOf(new Date())` bằng ngày UTC thì C1–C7 vẫn qua | Thêm 2 ca: `2026-11-30T16:59:59Z` (23:59:59 VN ngày `endsOn`) → 409 `ACTIVE`; `2026-11-30T17:00:00Z` (00:00 VN ngày `endsOn + 1`) → 200 |
| G2 | Gợi ý | Nhỏ | `suspensions.service.spec.ts:779-783` | `findSuspensionById` và `lockSuspensionById` trả cùng một dòng, nên không test nào chứng minh trạng thái được tính trên dòng đã khoá. Đổi `locked` thành `current` thì test vẫn qua | Một ca: lúc đọc chưa xác nhận, lúc khoá đã có `clearedAt` → 409 `ALREADY_CLEARED`, `repo.clearSuspension` không được gọi |
| G3 | Gợi ý | Nhỏ | spec T-049 | Không có ca `DQ`, và không có ca `OTHER`/`MEDICAL` với `requiresClearance = false`. Cùng nhánh với C5, C6 nên rủi ro thấp | Thêm nếu sửa file này lần nữa |
| G4 | Gợi ý | Nhỏ | `service.ts:185, 192, 200` | Gọi `new Date()` ba lần (kiểm, ghi `clearedAt`, tính phản hồi). Đúng về logic, nhưng một biến `now` dễ đọc và dễ test hơn | Không bắt buộc |
| G5 | Gợi ý | Nhỏ | Supabase (ngoài phạm vi ticket) | Ticket để chủ dự án tự kiểm bản ghi đã bị xác nhận sớm | Câu chỉ đọc để Dan chạy: `SELECT id, reason, ends_on, cleared_at FROM public.suspensions WHERE deleted_at IS NULL AND cleared_at IS NOT NULL AND (cleared_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date <= ends_on;` |

Không có vấn đề mức chặn, không có vấn đề mức "lớn".

**Kết luận: APPROVED.** N1, N2 là sửa tài liệu, Claude làm được trong `docs/` mà không đụng code.
