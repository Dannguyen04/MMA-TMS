# T-056 Review

- Ngày: 04/11/2026. Người review: Claude (lead) và subagent review độc lập không mang ngữ cảnh, 3 lượt.
- Ticket: [T-056](./T-056-demo-suspension-scenarios.md). Handover: [T-056-HANDOVER.md](./T-056-HANDOVER.md). Nhánh `User_Feature`, chưa commit.
- Code do `agy` viết, model `gemini-3.8-flash-high`, 5 lượt trong cùng một phiên: làm lần đầu và 4 lượt sửa.

## Kết luận

**APPROVED.** Lượt review độc lập gần nhất (lượt 3) không còn vấn đề chặn hay nên sửa. Bốn gợi ý của lượt này ghi ở mục cuối, chưa làm.

## Lệnh đã chạy lại (Claude, sau lượt sửa 4)

| Lệnh | Kết quả |
| --- | --- |
| `pnpm --filter nextjs-frontend lint` / `typecheck` | exit 0 / exit 0 |
| `pnpm --filter nextjs-frontend test`, chạy 2 lần | `Tests 1202 passed, 2 skipped` cả 2 lần. Trước ticket: 1182 |
| `git diff --stat` của `mocks/time.ts` và `mocks/training.ts` | rỗng |

## Các lượt và cách xử lý

| Lượt | Ai phát hiện | Vấn đề | Xử lý |
| --- | --- | --- | --- |
| Review độc lập 1 | Subagent | Nên sửa: phiếu H1 của Marcus nói về ca gãy xương bàn tay, nhưng ca đó mới xảy ra 11 ngày trước. Handover không ghi tác dụng phụ: hai giáo án chuyển sang `rehab`, buổi tập chuyển `pending`. Gợi ý: có buổi "đã hoàn thành" nằm trong thời gian đình chỉ, Sofia thiếu bối cảnh lâm sàng | Lượt sửa 1: H1 đổi thành đợt sốt siêu vi; S6, S7, S8 bắt đầu hôm nay; nêu lý do khám cho Sofia; ghi tác dụng phụ vào handover; thêm M15, M16 (cả hai lỗi trên code cũ) |
| Claude chạy lại lúc 13:23 | Claude | M15 và K1 lỗi theo giờ chạy: buổi tập hôm nay của Sofia tự thành `completed` khi đồng hồ qua giờ tập | Lượt sửa 2: đưa buổi hôm nay của võ sĩ đang bị đình chỉ về `scheduled` trước khi áp side effect; thêm M17 |
| Claude review lượt 2 | Claude | Lượt 2 sửa cả hạ tầng: `db()` bỏ `structuredClone` và bỏ kiểm fingerprint; `time.ts` thành mốc thời gian thay đổi được | Lượt sửa 3: hoàn tác `time.ts`, `training.ts` và `db()`; M17 dùng cơ chế neo sẵn có; thêm M18 (lỗi trên bản lượt 2) |
| Review độc lập 2 | Subagent | **Chặn:** K1 và M17 gõ cứng số buổi `pending`, chỉ đúng vào thứ Tư. Nên sửa: bước đặt lại trạng thái đụng cả buổi phục hồi được phép tập của Marcus | Lượt sửa 4: dùng bất biến thay số gõ cứng; M17 chạy qua 7 ngày trong tuần; bước đặt lại chỉ áp cho buổi mà `isSessionBlockedBySuspension` trả `true`; thêm M19 (lỗi trên bản lượt 3); giờ tạo đình chỉ 07:00 |
| Review độc lập 3 | Subagent | APPROVED. Chạy với giờ giả ở 12 mốc khác nhau, kể cả các ngày khác trong tuần và năm 2027: 145/145 qua. Thử bằng bản đột biến (bỏ điều kiện chặn → M19 lỗi; bỏ clone → M18 lỗi; bỏ bước đặt lại → M15, K1, M17 lỗi) | — |

## Kiểm bằng trình duyệt

Chưa kiểm. Chủ dự án quyết định không chạy server (04/11). Reviewer đã đối chiếu dữ liệu với code của trang HLV và trang võ sĩ của bác sĩ:
- trang HLV: S7 có nút "Gỡ theo ban tổ chức"; S6 và S8 chỉ có gợi ý;
- trang võ sĩ của bác sĩ: S6 có một phiếu để chọn; S8 chỉ hiện cảnh báo và link "Ghi phiếu khám".

## Tác dụng phụ đã biết

Đây là hành vi đúng của F7 và đã ghi trong handover:
- giáo án `tp-sofia-camp` và `tp-hoang-camp` chuyển sang `rehab`;
- buổi đã xếp của Hoàng Long, Bảo và Sofia trong thời gian đình chỉ chuyển `pending`;
- buổi bị chặn hôm nay của Marcus chuyển `cancelled`, của Tariq chuyển `pending`;
- lịch HLV Rafael có thêm 3 võ sĩ.

## Gợi ý chưa làm

1. `mocks/db.ts:149-150`: điều kiện hiệu lực tự viết hẹp hơn `isInForceOn`, nên bỏ qua đình chỉ đã quá hạn mà chưa được xác nhận. Hiện chưa có tác động. Có thể bỏ hai dòng này.
2. `mocks/db.ts:116`: sao chép sâu `exercises` là thừa nhưng vô hại.
3. `mocks/db.ts:158`: `session.notes = null` xoá luôn ghi chú của giai đoạn tập (Tariq, Bảo).
4. H2 (TKO) và H3 (DQ) của Tariq không có trận tương ứng. Phiếu khám định kỳ ngày −190 rơi vào giữa đình chỉ TKO mà không nhắc tới. Bảo mới vào CLB 12 ngày mà đã có đình chỉ của ban tổ chức. Không sai quy tắc, chỉ hơi khó tin khi trình bày.
