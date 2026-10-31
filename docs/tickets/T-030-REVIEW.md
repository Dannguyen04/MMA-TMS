# T-030 Review (phần B, viết lại 29/10)

- Nhánh: `feat/T-030-suspension-ui` (tạo từ `User_Feature` sau T-035, T-036, T-036 A2, T-045).
- Người thực hiện: `agy` `gemini-3.8-flash-high` (argon hết quota tới khoảng 5/11).
- Ca kiểm thử Claude viết trước code, trong ticket mục "Các phần và ca kiểm thử".

## B1 (A1, A2 của ticket): APPROVED 29/10

- **Lượt 1:** đọc `details.suspensions` của 409 an toàn (bỏ phần tử sai), câu lỗi có lý do và ngày, thẻ Việc cần làm có 2 mã mới. Claude review: lý do hiện mã thô, ngày dạng `2026-12-01`, câu tập lại theo bậc nói "đang bị đình chỉ" → lượt 2 thêm nhãn `suspension.reason.*`, `formatShortDate`, câu riêng cho tập lại theo bậc (B1-7..B1-9).
- **Review độc lập lần 1** (nên sửa, hành vi): câu "chờ xác nhận" và "hôm nay tối đa bậc" so với hôm nay, trong khi Cổng 2 xét ngày của buổi khi xếp hoặc sửa → lượt 3 bỏ so sánh với hôm nay, một câu cho đình chỉ cần xác nhận, chọn đình chỉ hiện theo thứ tự (không `gradedReturn` trước, `endsOn` muộn nhất), parse `requiresClearance === true` (B1-10..B1-13).
- **Review độc lập lần 2:** code đạt cả 6 yêu cầu; hai chỗ test chưa đủ chặt, trong đó ca B1-12 do Claude viết không phân biệt được hai quy tắc chọn → lượt 4 viết lại B1-12, thêm B1-14..B1-16, kiểm `not.toContain("chờ xác nhận")`, `Record<SuspensionReason, MessageKey>` có kiểu.
- **Lệnh Claude chạy lại sau lượt 4:** `lint` sạch, `typecheck` 0 lỗi, `test` `Tests 829 passed | 2 skipped (831)` (baseline trước B1: 813 qua).
- Ghi lại: câu "chờ xác nhận" trong mô tả A2 của ticket (nhánh "đã qua endsOn") được thay bằng một câu không phụ thuộc hôm nay, theo cách backend xét ngày của buổi.

## B2 (nền dữ liệu): APPROVED 29/10

- Kiểu dữ liệu, service `suspensions` (API và demo), luật đình chỉ dùng chung `lib/domain/suspension-rules.ts`, hằng bậc `lib/domain/intensity-tiers.ts`, server action, trạng thái buổi `pending`, dữ liệu mẫu đủ 5 trường hợp, từ điển vi/en.
- 5 lượt `agy`, 4 lần review độc lập. Những lỗi review bắt được và đã sửa:
  - **Chặn:** enum trạng thái cân của bảng sẵn sàng lệch backend (response thật không parse được); dữ liệu mẫu dựng từ giờ hiện tại làm kho demo bị dựng lại mỗi khi chuyển trang sang action (mất mọi thay đổi khi demo).
  - **Nên sửa:** demo chọn chờ/huỷ chỉ theo đình chỉ mới (backend xét mọi đình chỉ); bảng sẵn sàng tính trận `SCHEDULED`, sai thứ tự trạng thái, sai cờ `ready`, không gộp đình chỉ, bỏ qua phạm vi người xem; `applyConflicts` API trả dữ liệu thô; lọc nhiều võ sĩ bị backend từ chối; code production import file demo; dữ liệu mẫu sai R28; map lỗi theo status thay vì mã; action tin `fighterId` từ form; `technical_drilling` không bị chặn khi tạo; kiểm quyền ở API mode duyệt mọi trang.
  - **Test không bắt được lỗi** (một số do Claude đặc tả chưa chặt): B2-4, B2-6, B2-7, B2-24, B2-26, B2-27, B2-31 đã viết lại.
- Lệnh Claude chạy lại sau lượt cuối: `lint` sạch, `typecheck` 0 lỗi, `test` `Tests 872 passed | 2 skipped (874)`.
- Review độc lập lần 4: không còn lỗi chặn; 3 mục nên sửa (F1–F3) đã sửa ở lượt 5, Claude kiểm lại code và test.

## B3 (component dùng chung): APPROVED 29/10, xem lại khi gắn vào màn ở B4

- `IntensityLadder` (thang 5 bậc, chỉ xem hoặc slider), `GradedReturnSteps` (lộ trình 3 bước), `SuspensionStatusBadge`, badge buổi `pending`.
- Claude chụp app ở demo mode (dashboard, lịch tập, trận; 1440 px và 390 px; vi và en): badge "Chờ xếp lại" rõ ràng, tách khỏi "Đã huỷ"; nhãn tiếng Anh "Reschedule pending" bị cắt trong thẻ tuần → đổi thành "To reschedule". Thẻ Việc cần làm ở demo chưa sinh 2 mã đình chỉ (chuyển sang B4). Hai khái niệm "chưa có cấp phép y tế" và "đình chỉ" dễ nhầm trên dashboard (xử lý câu chữ và liên kết ở B4).
- Review độc lập: không lỗi chặn; 9 mục nên sửa (vòng viền bước hiện tại mất sau hiệu ứng, tương phản chế độ tối, số bậc dưới 4.5:1, ARIA lồng nút trong slider, độ trễ so le không tắt khi giảm chuyển động, khoá i18n không dùng, hàm thuần nằm trong module client, trạng thái bước chỉ có ở `title`, style trùng). Đã sửa ở lượt 1 cùng các gợi ý (kẹp giá trị slider, phân biệt sọc không chỉ bằng màu). Claude quyết bỏ hiệu ứng nhấp nháy của bước hiện tại (bản thiết kế đã sửa).
- Lệnh Claude chạy lại: `lint` sạch, `typecheck` 0 lỗi, `test` `Tests 891 passed | 2 skipped (893)`.
- Lượt sửa chưa có review độc lập riêng; các component sẽ được review lại cùng màn ở B4 (ảnh chụp và review độc lập).

## B4 (màn Đình chỉ): APPROVED 29/10

- Tab Trận / Đình chỉ, lọc có số đếm, danh sách dạng dòng (thang cường độ, badge, lộ trình 3 bước cho ca tập lại), panel tạo đình chỉ trượt phải, bảng tóm tắt hệ quả, form xác nhận tập lại, thẻ Việc cần làm ở demo có 2 mã đình chỉ.
- Claude chụp app chạy demo 3 lần (1440 px, 390 px, vi, en; tạo KO thật để xem bảng tóm tắt). Lần 1 thấy: mô tả in chuỗi ICU thô; thang chật, tràn số; số ngày lặp; HLV demo không có ca tập lại; bảng tóm tắt mở ra đã cuộn giữa, thiếu câu tổng, giáo án hiện mã thô. Lần 2 thấy: bảng tóm tắt vẫn cuộn giữa, câu tổng chưa nổi bật, thang của ca tập lại vẽ như đình chỉ cũ, vòng số lộ trình gây nhầm, dấu "·" thừa ở màn hẹp. Lần 3: tất cả đã đạt.
- Review độc lập (1 lần) thêm: badge "Đã hết" cho ca tập lại (chặn); test B4-1, B4-10 dùng phạm vi tự dựng nên qua dù màn thật sai (chặn); test B4-2 tự dựng HTML (chặn); B4-8 qua rỗng; lỗi trong panel bị che sau modal; chuyển động dùng class không tồn tại; nhánh admin/doctor là code chết; việc S3 của Diego ở demo không có trận nên API thật không trả; lỗi ARIA. Đã sửa hết.
- Quyết định của Claude: màn Đình chỉ chỉ cho HLV (đúng kế hoạch; mở cho bác sĩ là mở rộng phạm vi); dữ liệu mẫu thêm trận Diego thua TKO để thẻ Việc cần làm ở demo khớp API.
- Lệnh Claude chạy lại: `lint` sạch, `typecheck` 0 lỗi, `test` `Tests 910 passed | 2 skipped (912)`.
- Lượt sửa 2 kiểm bằng ảnh chụp và test; review độc lập cuối cho cả T-030 ở B7.

## B5 (lịch tập): APPROVED 30/10

- Buổi "Chờ xếp lại" ở tuần, danh sách, chi tiết: badge, ngày giờ cũ gạch mờ, nút "Xếp lại" và "Huỷ buổi", không có "Bắt đầu"/"Vắng"; dialog xếp lại có gợi ý ngày sau đình chỉ (nút "Dùng ngày …"); thẻ giải thích 409 dùng chung (lý do, ngày, thang bậc khi có, link "Xem đình chỉ"); lọc "Chờ xếp lại"; thống kê tuần không đếm buổi chờ xếp lại là đã huỷ.
- Claude chạy app demo và xếp lại thật buổi chờ xếp lại của Tariq, 3 lần:
  - Lần 1 (**chặn, mất dữ liệu**): xếp lại làm mất hết bài tập của buổi, vì dialog dùng action sửa buổi đầy đủ; để chữa, `updateSession` bị đổi sang "trường trống thì lấy giá trị cũ", làm hỏng luôn form sửa buổi (xoá ghi chú không được). Cùng lúc: câu lỗi 409 hiện hai lần. Sửa: action riêng `rescheduleSession` chỉ gửi `scheduledAt`, trả `updateSession` về như cũ (B5-10..B5-14).
  - Lần 2 (**chặn**): xếp vào ngày hợp lệ bị kẹt ở cảnh báo cấp phép y tế tiếng Anh, không có cách xác nhận. Sửa: dialog hiện cảnh báo cấp phép và ô "Vẫn xếp lịch", câu qua i18n (B5-15..B5-17).
  - Lần 3: xếp lại thành công, buổi về "Đã lên lịch", bài tập còn nguyên.
- Test tự động không bắt được cả hai lỗi chặn (không có ca xếp lại buổi có bài tập, không có ca vướng cảnh báo cấp phép); chúng được thêm sau khi Claude thấy lỗi trên app.
- Lệnh Claude chạy lại: `lint` sạch, `typecheck` 0 lỗi, `test` `Tests 927 passed | 2 skipped (929)`.
- Review độc lập cuối cho cả T-030 ở B7.

## Kiểm lại 30/10 tối (Claude trên máy Dan): CHANGES REQUESTED cho B5-15, B5-16

Chạy lại trên `6b253fd` (B6) lúc 22:50 ngày 30/10 (UTC+7): `lint` sạch, `typecheck` 0 lỗi, `test` **`Tests 2 failed | 934 passed | 2 skipped (938)`**. Ở `e198870` (B5) cũng lỗi đúng hai ca này, nên lỗi có từ B5, không do B6.

| # | Mức | Chỗ | Vấn đề |
| --- | --- | --- | --- |
| R1 | chặn | `nextjs-frontend/src/components/training/session-suspension-b5.test.ts:680`, `:723` | B5-15 và B5-16 lấy buổi bằng `find(... status === "pending")`, không theo id như tên ca (`s-tariq-sc-in5d`). Dữ liệu mẫu xếp buổi theo thứ trong tuần tính từ hôm nay (`lib/mocks/time.ts`, mốc `Date.now()`), nên buổi `pending` đầu tiên của Tariq đổi theo ngày chạy. Tối 30/10 Tariq có 3 buổi `pending`: `s-tariq-pads-in3d` (`pad_work`), `s-tariq-sc-in4d`, `s-tariq-bag-in5d`. `find` trả `s-tariq-pads-in3d`, buổi này không vướng hạn chế nào của cấp phép hiện tại (`cl-tariq-current`: chặn `sparring`, không chặn kỹ thuật hay vùng cơ thể của bài pad), nên `getSessionClearanceConflicts` trả `[]` và bước "không xác nhận thì lỗi" nhận `success`. Lúc Ken chạy (00:13 cùng ngày) buổi đầu tiên là buổi khác nên qua. |

**Tái hiện:** `pnpm --filter nextjs-frontend exec vitest run src/components/training/session-suspension-b5.test.ts` vào tối 30/10 cho `2 failed | 15 passed (17)`; đổi `TZ` (UTC, Asia/Ho_Chi_Minh, America/Los_Angeles) vẫn lỗi.

**Cách sửa đề nghị (không đổi kết quả mong đợi):** chọn buổi theo đặc điểm cần thử, không theo thứ tự: lấy buổi `pending` của Tariq mà `getSessionClearanceConflicts` tại ngày xếp lại có ít nhất một cảnh báo `warn` và không có `block` (hoặc dựng riêng một buổi `pending` có bài tập vướng hạn chế trong `beforeEach`), và kiểm điều kiện đó bằng `expect` trước bước chính để ca không âm thầm đổi ý nghĩa. Nếu cố định thời gian bằng `vi.setSystemTime` thì phải đặt trước khi nạp `lib/mocks/time.ts`, vì mốc được giữ trên `globalThis` lúc nạp module. Sau khi sửa, chạy file này ở hai thời điểm khác ngày (hoặc với hai giá trị `setSystemTime`) để chắc ca không phụ thuộc ngày.

## Sửa R1 (31/10, Claude trên máy Ken): APPROVED

- Người thực hiện: `agy` `gemini-3.8-flash-high`, 4 lượt cùng phiên. Chỉ sửa `session-suspension-b5.test.ts` (và handover); không đổi code production hay dữ liệu mẫu.
- **Cách sửa:** helper `seedTariqPendingWarnSession` dựng riêng một buổi `pending` của Tariq (id cố định, 3 bài, có `notes`) có bài vướng cấp phép. B5-10, B5-15, B5-16 dùng buổi này. Trước bước chính, B5-15 và B5-16 kiểm có `warn` và không có `block`, tại đúng thời điểm action kiểm (15:00 `+07:00`). Kết quả mong đợi giữ nguyên. Tên B5-15 bỏ id `s-tariq-sc-in5d`.
- **Cách kiểm không phụ thuộc ngày:** chỉ đặt `globalThis.__mmaMockAnchorMs` là chưa đủ, vì `Date.now()` vẫn là ngày thật; thử như vậy thì 6–8 test khác lỗi giả. Claude dời cả đồng hồ (`Date` và mốc mock) bằng một file `--require` ngoài repo (`shift-clock.cjs`, qua `NODE_OPTIONS`) rồi chạy cả bộ test.
- **Lỗi thêm tìm được trong lúc kiểm, đã sửa:**
  - B5-10 (chặn): cùng lỗi gốc với R1. Lỗi khi chạy vào 3/11, 4/11: `expected [...] to have a length of 3 but got 2`.
  - B5-12 (nên sửa, review độc lập lần 1): ngày cứng `2026-11-15`, action chặn ngày đã qua, nên ca lỗi từ 16/11. Nay là `TODAY_KEY` + 15 ngày.
  - B5-15 (nên sửa, review độc lập lần 2): dòng kiểm `scheduledAt` so object với chính nó (helper trả đúng object nằm trong kho mock). Nay chụp `originalScheduledAt` trước khi gọi action.
- **Lệnh Claude chạy lại:** `lint` sạch, `typecheck` 0 lỗi. `test` ra `Tests 936 passed | 2 skipped (938)` cả khi chạy thường lẫn khi dời đồng hồ sang từng ngày 31/10–6/11 và 25/12. Trước khi sửa, các ngày 3/11, 4/11 có B5-10 lỗi.
- **Review độc lập (3 lần, không mang ngữ cảnh):**
  - Lần 1: R1 đạt, có thêm B5-12.
  - Lần 2: B5-12 đạt, có thêm dòng `scheduledAt` tự so với chính nó.
  - Lần 3: đạt, không còn mục chặn hay nên sửa.
  - Gợi ý chưa làm: dòng 759 dựa vào giờ gốc của helper (10:00) khác giờ đích (15:00).
- **Còn lại của phần B:** chụp màn kiểm B6, rồi B7.

## B6 (bảng Sẵn sàng) và B7 (kiểm tra cuối): APPROVED 31/10

**Chụp màn** `/coach/bouts/readiness`, demo, Rafael Costa, ở 1440 px và 390 px, cả vi lẫn en.
- Đạt: dịch đủ, không cuộn ngang, ba cột đúng (1 / 1 / 6), lý do có màu riêng, ô hạng cân khoá khi chưa chọn bộ luật.
- Lượt UX của Claude (`agy`) sửa hai điểm:
  - U1: thang 5 vạch không có chữ, nên thêm dòng "Cường độ tối đa: Bậc N".
  - U2: cột "Chưa sẵn sàng" xếp theo tên, nên đổi sang đình chỉ → chờ xác nhận → đang có trận.

**`impeccable detect`:** quét 17 file UI bằng regex, không báo gì. Các luật cần trang đã render (tương phản, chữ nhỏ) chưa chạy, vì trang phải đăng nhập. Phần đó Claude kiểm bằng mắt qua ảnh chụp.

**Review độc lập cuối cho cả phần B: KHÔNG ĐẠT, 6 mục nên sửa.** Đã sửa qua 4 lượt `agy`:

| # | Vấn đề | Xử lý |
| --- | --- | --- |
| 1 | Thẻ 409 vẽ thang từ `maxAllowedTier`, mà 409 thật (`suspension.gate.ts:39-58`) không gửi trường này; demo thêm trường ngoài contract | Chỉ vẽ thang khi có `gradedReturn`; demo trả đúng contract (B5-18, B5-19) |
| 2a | Bậc 0 in khoá thô `intensityTier.0.label` | Dùng câu "bị chặn hoàn toàn" (B6-12) |
| 2b | Dòng có `gradedReturn` luôn vào cột "Đang tập lại", kể cả khi còn một đình chỉ khác | `isGradedReturnOnly` suy từ nhánh tập-lại-theo-bậc của backend (`bouts.model.ts:1388-1407`) (B6-13a..e, B6-15) |
| 2c | `?weightLimitKg=abc` đẩy trang vào trang lỗi | Bỏ qua số không hữu hạn (B6-14) |
| 3 | Chữ cứng "Huỷ buổi" | Đưa qua i18n (I18N-1) |
| 4 | B6-9 qua bất kể trang in gì | Kiểm nguyên dòng trong đúng thẻ |
| 5 | Tên ca B4 lệch ticket | Đổi tên cho khớp |

Lỗi phát sinh trong lúc sửa, đã sửa:
- **Chặn, gốc ở đặc tả của Claude:** Claude viết quy tắc "`suspension` rỗng" cho mục 2b. Backend vẫn dựng `suspension` cho trường hợp chỉ tập lại theo bậc, nên `agy` làm theo quy tắc đó đã xoá luôn nhánh demo tương ứng, làm demo lệch backend. Lượt 2 khôi phục nhánh này.
- **Nên sửa (review lần 2):** dòng "Cường độ tối đa" bỏ qua `ceiling` khi thẻ nằm ngoài cột tập lại. Lượt 3 thêm `readinessMaxTier` (B6-16..18).
- **Hồi quy hiển thị, Claude thấy qua ảnh chụp:** sau lượt 3, bậc 4–5 của Linh vẽ thành "bị cấm" thay vì "trần tập lại". Lượt 4 sửa (B6-19..21).

**Lệnh Claude chạy lại sau lượt 4:** `lint` sạch, `typecheck` 0 lỗi, `test` `Tests 956 passed | 2 skipped (958)`. Ảnh chụp lại: thang và chữ khớp ở mọi thẻ.

**Review độc lập lượt 3–4:** ĐẠT, không còn mục chặn hay nên sửa. Gợi ý chưa làm:
- `isGradedReturnOnly` có thể nhận nhầm khi có đình chỉ ACTIVE kết thúc đúng ngày `fullReturnOn − 1` và chặn đúng bộ của `ceiling`. Thêm điều kiện `suspension.endsOn < today` thì chắc hơn.
- B6-17 và B6-21 chưa kiểm trạng thái từng đoạn của thang.

**Chờ chủ dự án:** ticket ghi bảng Sẵn sàng (B6) và màn Đình chỉ (B4-6) cho "HLV và ADMIN". Code hiện chỉ cho HLV (`requireRole("coach")`); ADMIN bị chuyển về `/admin/dashboard`. Claude đề nghị giữ chỉ HLV và sửa ticket cho khớp.

**Còn lại:** merge vào `User_Feature`, rồi merge `fight-camp` mới vào nhánh (T-040 A) khi phần A đã merge.

## Lượt cắt ponytail và sửa R2 (31/10)

- Cắt ponytail hai lượt: `3f8b7e2` (dữ liệu, service, domain: xoá luồng "áp dụng xung đột" và `getSuspension` không ai gọi, 4 test của chúng xoá theo) và `2ccd5a3` (trang và component). Màn Sẵn sàng chụp lại giống hệt trước khi cắt; màn Đình chỉ, bộ lọc, `?status` sai và form tạo đình chỉ hiển thị đúng.
- Review độc lập (subagent không mang ngữ cảnh) cho cả hai lượt: APPROVED. Nó tìm thêm một lỗi có từ B5 (`e198870`):
  - **R2 (nên sửa):** hộp thoại "Xếp lại" chỉ xem trước xung đột cấp phép một lần; đổi ngày hay giờ không xem lại, nút xác nhận bật/tắt theo ngày cũ. Nguyên nhân: `previewConflicts` có giá trị thì `propConflicts !== undefined` và effect thoát sớm.
  - Ca R2-1 (trình duyệt, demo, Rafael Costa, `/coach/sessions/s-tariq-pads-in5d`, đổi ngày 06/11 → 03/11 → 12/11): code cũ số request xem trước đứng ở 2, 2, 2; sau sửa `8d7ffeb` là 2, 3, 4, và ở 12/11 hiện chặn "Cấp phép y tế đã hết hạn vào 9 thg 11" (đúng: cấp phép Tariq hết hạn 9/11), nút xác nhận tắt.
  - Repo không có môi trường DOM (vitest `environment: node`), nên R2-1 là kiểm tra trình duyệt, không phải test tự động. B5-13, B5-14, B5-17 vẫn qua.
- Review độc lập lần hai cho `8d7ffeb`: APPROVED. Gợi ý không chặn: trong ~350 ms chờ xem trước, nút còn dùng kết quả của ngày cũ (server vẫn từ chối nếu sai, không mất dữ liệu).
- Kiểm cuối: lint, typecheck sạch; test 952 passed | 2 skipped (954).

**Kết luận: APPROVED tại `8d7ffeb`.**

## R3, R4: ô Số ngày và ô Ngày bắt đầu trong form Tạo đình chỉ (31/10)

- **R3 (Ken báo):** ô "Số ngày" giữ state kiểu số (`setDays(Number(value))`), nên xoá hết hiện "0", gõ tiếp ra "010"; min 1 mà vẫn hiện 0. Sửa `e11e4ef`: giữ chuỗi người dùng gõ; rời ô thì chuẩn hoá về số nguyên 1–365 (`normalizeDaysInput`, khớp `createSuspensionSchema` của backend); submit với giá trị sai thì báo `suspensions.action.daysRange`, không tự đổi số; dòng "Dự kiến kết thúc" ẩn khi số ngày sai. Ca D1–D8 (unit, hàm thuần). Kiểm trình duyệt: xoá → trống; gõ 1, 0 → 10; trống/010/400 rời ô → 1/10/365; Enter với trống, 0, 7.5, 400 → trình duyệt chặn, 0 request.
- **R4 (review độc lập tìm ra):** xoá ô "Ngày bắt đầu" làm `endsOnFor("")` ném `RangeError: Invalid time value` lúc render, hộp thoại mất, trang hiện màn lỗi. Có từ B4. Sửa `70c7ba1`: chỉ tính `endsOn` khi `isDateKey(startsOn)`. Ca tái hiện là kiểm trình duyệt (vitest chạy `environment: node`, không có DOM để đổi ô ngày; form luôn khởi đầu bằng hôm nay nên render tĩnh không tái hiện được): trước sửa thì crash, sau sửa hộp thoại vẫn mở, 0 lỗi, chọn lại 10/11 thì hiện "Dự kiến kết thúc: 9 thg 12".
- Review độc lập cho cả hai: APPROVED. Gợi ý chưa làm: `handleSubmit` chưa chặn `startsOn` sai (hiện chỉ trình duyệt chặn bằng `required`).
- Kiểm cuối: frontend lint, typecheck sạch; test 962 passed | 2 skipped.
