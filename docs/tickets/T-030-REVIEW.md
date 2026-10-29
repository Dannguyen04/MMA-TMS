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
