# 04. Hàm khả thi về cân (R31): ngưỡng chặt dần theo ngày còn lại

- Ticket: T-029A (dùng cho bảng sẵn sàng 05 và form tạo trận 06). Người làm: Ken. Phụ thuộc: T-003. Hạn: làm sớm vì 05 cần nó.
- Trạng thái: chưa lập plan. Việc thêm hàm mới đã được Ken quyết, ghi vào handover (mẫu ở [README](./README.md)).
- Tài liệu: [Luồng nghiệp vụ R31, R32](../../../docs/FIGHT-CAMP-BUSINESS-FLOWS.md), [Tech spec §5](../../../docs/FIGHT-CAMP-TECH-SPEC.md).

## Mục tiêu

Khi HLV chọn võ sĩ, hạng cân, giờ cân: cho biết có khả thi về cân không dựa trên cân gần nhất. Chỉ cảnh báo, không chặn lưu. Hàm thuần đặt cạnh `computeWeightTrack` trong `bouts.model.ts`.

## Vì sao không dùng lại `computeWeightTrack`

Đã đọc code ([bouts.model.ts](../../src/bouts/bouts.model.ts) dòng 307–429):

1. `buildReferencePath` bắt đầu từ cân đầu camp. Lúc tạo trận chưa có camp, `loadWeightTrack` lấy `campStart` là ngày tạo trận hoặc `plan.startDate`, nên đường tham chiếu bắt đầu đúng tại cân gần nhất. Nhánh VÀNG (`latest.kg > reference + WEIGHT_TOLERANCE_KG`) không bao giờ chạy; trận còn xa luôn ra XANH dù võ sĩ cách hạng cân rất xa.
2. XÁM khi `daysBetweenDates(latest.date, today) >= WEIGHT_STALE_DAYS` (= 3), mâu thuẫn với R31 cho dùng cân trong 7 ngày.

Không sửa `computeWeightTrack` (R7 đã merge ở T-003, thuộc phạm vi Dan).

## Thiết kế

Đầu vào: `limitKg`, `L` (snapshot `acute_loss_limit_pct` của trận hoặc `acuteLossLimitPctFor(weighInAt, boutAt, limits)` khi trận chưa tồn tại), `A` (`acute_window_days` của ruleset), `D` (số ngày học viện từ hôm nay đến ngày cân), cân mới nhất `W` và ngày đo.

- `remainingPct = max(0, (W - limitKg) / W * 100)`, cùng mẫu số với `computeWeightTrack` để R7 và R31 nhất quán.
- Không có cân trong 7 ngày gần nhất: kết quả `INSUFFICIENT_DATA` (form hiện "Chưa đủ dữ liệu cân", không hiện màu).
- `D <= A`: giữ luật của R7 (`remainingPct > L` là ĐỎ, ngược lại XANH).
- `D > A`: ngưỡng trượt theo số tuần còn lại ngoài cửa sổ cấp tính, `w = (D - A) / 7`:
  - `capGreen = min(L + 1.0 * w, 15)`
  - `capYellow = L + 1.5 * w` (không chặn trần)
  - `remainingPct <= capGreen` là XANH; `<= capYellow` là VÀNG; còn lại ĐỎ.

Ghi chú: đây là mô hình **suy ra** (xem bảng nguồn). Hệ số 1.0 và 1.5 %/tuần, trần 15% và tham số 7 ngày là hằng số đặt tên trong code (`FEASIBILITY_*`), không hard-code rải rác; chỉnh sau không tốn công.

### Bảng giá trị để viết test (tính tay, %)

| D (ngày) | w | L = 8: xanh ≤ | L = 8: vàng ≤ | L = 5: xanh ≤ | L = 5: vàng ≤ |
| --- | --- | --- | --- | --- | --- |
| 56 | 7 | 15.0 | 18.5 | 12.0 | 15.5 |
| 42 | 5 | 13.0 | 15.5 | 10.0 | 12.5 |
| 28 | 3 | 11.0 | 12.5 | 8.0 | 9.5 |
| 21 | 2 | 10.0 | 11.0 | 7.0 | 8.0 |
| 14 | 1 | 9.0 | 9.5 | 6.0 | 6.5 |
| 10 | 3/7 | 8.43 | 8.64 | 5.43 | 5.64 |
| 7 | 0 | 8.0 | 8.0 | 5.0 | 5.0 |

Hai ví dụ có sẵn trong tài liệu: giới hạn 60 kg, L = 8, còn 2 ngày, 66 kg: `remainingPct` = 9,09 thì ĐỎ nhưng vẫn lưu được; 64,5 kg thì 6,98 là XANH. Võ sĩ không có cân trong 7 ngày: không hiện trạng thái.

### Ngưỡng nhắc cân (liên quan 07)

XÁM 3 ngày khi `D > A`, 2 ngày khi `D <= A` được quy định ở [07](./07-weight-reminder.md), không đưa vào hàm này.

## Nguồn của các hằng số

Phân loại: [CÔNG BỐ] có trong tài liệu chính thức; [THỰC HÀNH] phổ biến nhưng không có tài liệu chuẩn; [SUY RA] tự suy từ số khác.

| Hằng số | Giá trị | Loại | Nguồn |
| --- | --- | --- | --- |
| Trần giảm mỡ xanh | 1.0 %/tuần | [CÔNG BỐ] một phần | Helms et al. 2014, 0.5–1%/tuần để giữ cơ: https://doi.org/10.1186/1550-2783-11-20. Garthe et al. 2011: nhóm giảm 0.7%/tuần giữ và tăng khối nạc, nhóm 1.4%/tuần thì không: https://pubmed.ncbi.nlm.nih.gov/21558571/ |
| Trần vàng | 1.5 %/tuần | [CÔNG BỐ] | NCAA wrestling, tối đa 1.5% cân nặng mỗi tuần: https://www.ncaa.org/news/2017/7/14/stiffer-penalties-approved-in-wrestling.aspx (tìm thấy qua tìm kiếm, chưa mở bài) |
| Trần ngoài camp | 15% | [CÔNG BỐ] | ISSN Position Stand 2025 (Ricci et al.), cân ngoài camp cao hơn hạng cân khoảng 12–15%: https://doi.org/10.1080/15502783.2025.2467909 |
| L giảm cấp tính | 8% / 5% | [THỰC HÀNH] theo tài liệu dự án | Ruleset mặc định (`acute_loss_limit_pct_long` 8.0 khi cân trước thi ≥ 12 giờ, `_short` 5.0 khi dưới 12 giờ). Tham khảo: ISSN 2025 nêu mức giảm hợp lý 6,7% ở 72 giờ, 5,7% ở 48 giờ, 4,4% ở 24 giờ trước cân |
| Công thức trượt `L + r × (D − A) / 7` | | [SUY RA] | Không có tài liệu nào công bố mốc theo từng tuần; đây là quy ước của CLB, phải ghi như vậy trong tài liệu và handover |
| Cửa sổ cân 7 ngày | 7 | [THỰC HÀNH] | R31 trong Luồng nghiệp vụ, ghi "(đề xuất)" |

So sánh với quyền Anh (WBC Weight Management Program 2.0, https://wbcboxing.com/en/wbc-weight-management-program-2-0/): cân an toàn ở 30, 14, 7 ngày trước trận với trần 10%, 5%, 3%. Đường cong trên khớp ở khoảng 28–30 ngày (L = 5 cho 8% so với 10%) nhưng **lỏng hơn** WBC ở 14 và 7 ngày (6% và 5% so với 5% và 3%). WBC là luật quyền Anh, chặt hơn MMA. Có siết hơn không: câu hỏi mở số 4 trong README.

### Không dùng các nguồn sau

- PMID 12974650: agy dẫn làm Oppliger 2003, nhưng đường dẫn thực ra là một bài hoá học không liên quan. Mọi con số gắn với trích dẫn này bị bỏ.
- Hai câu agy trích từ Burke 2021 ("không giảm quá 5% trong tuần cuối") và Reale 2017 ("tối đa 8% khi có hơn 12 giờ hồi phục"): chỉ xác nhận bài có thật, chưa đọc toàn văn.
- Mốc "8% khi check-in đầu tuần" của UFC Performance Institute, ngưỡng USG 1.0250 của ONE, các ca tử vong (Jordan Coe, Jessica Lindsay): chưa xác minh.

## Tiêu chí nghiệm thu

- Bảng trên được kiểm trong `bouts.model.spec.ts` (cả L = 8 và L = 5), gồm ranh giới `D = A`, `D = A + 1`, `D = 56` và `D > 56` (trần 15%).
- Không có cân trong 7 ngày (hoặc cân 8 ngày trước): `INSUFFICIENT_DATA`.
- Cân dưới hạng cân: `remainingPct` = 0, XANH.
- `computeWeightTrack` và các test hiện có không đổi.

## Lệnh bắt buộc

`lint`, `build`, `test` (đặc biệt `bouts.model.spec.ts`).
