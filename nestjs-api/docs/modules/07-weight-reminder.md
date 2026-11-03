# 07. Nhắc nhập cân hôm nay (tính khi đọc)

- Ticket: T-029A. Người làm: Ken. Phụ thuộc: 04. Hạn: 27/10.
- Trạng thái: chưa lập plan. **Phạm vi mới do Ken quyết ngày 22/10**; câu hỏi còn mở: số 1 và 5 trong [README](./README.md).
- Tài liệu: [Luồng nghiệp vụ nghiệp vụ 7, F3](../../../docs/FIGHT-CAMP-BUSINESS-FLOWS.md), ý của Ken ngày 22/10.

> **Đã bị thay thế một phần (24/10), xem [T-029](../../../docs/tickets/T-029-coach-todo-and-weight-feasibility.md):** nhắc cân **chỉ áp trong `FIGHT_WEEK`** (không phải `CAMP` tới hết ngày thi); **không** nhắc ở ngày thi hay `WEIGHED_IN`; **bỏ** mức `STALE` và ngưỡng "XÁM 2 ngày trong cửa sổ cấp tính" (`WEIGHT_STALE_DAYS = 3` giữ nguyên). Màu cân từ `WEIGHED_IN` trở đi bị tắt. Các đoạn dưới đây chưa sửa; khi mâu thuẫn thì theo T-029.

## Mục tiêu

Võ sĩ phải nhập cân mỗi sáng. Nếu hôm nay chưa có số cân thì nhắc **nhập cân hôm nay ngay**; không bắt nhập bù ngày cũ. Nhắc kéo dài từ lúc trận ở `CAMP` tới hết ngày thi.

## Khác gì so với tài liệu đã duyệt

Tài liệu chỉ có: `FIGHT_WEEK` "nhắc võ sĩ khi hôm nay chưa ghi cân" (Luồng nghiệp vụ dòng 137, 287) và trạng thái XÁM 3 ngày (F3). Module này mở rộng ra `CAMP` và tới hết ngày thi, nên ghi rõ vào mục "Lệch so với ticket" của handover.

## Quyết định đã chốt

- Cửa sổ nhắc: trận ở `CAMP`, `FIGHT_WEEK`, `WEIGHED_IN` và hôm nay (ngày học viện) ≤ ngày của `bout_at`. Không nhắc ở `SCHEDULED`, `COMPLETED`, `CANCELLED`. Quá ngày thi mà chưa có kết quả thì việc của R26.
- Vì sao tới hết ngày thi: nhiều giải cân cùng ngày thi hoặc cân nhiều lần. Tra cứu ngày 22/10 (kết quả tìm kiếm, chưa đọc toàn văn từng tài liệu):
  - IMMAF (MMA nghiệp dư): cân vào ngày thi, cách giờ thi từ 1 đến 8 giờ; giải nhiều ngày cho kiểm cân không giới hạn số lần trong 24 giờ trước cân chính thức: https://immaf.org/wp-content/uploads/2021/10/2021-IMMAF_Weigh-in-rules-0f18e010712af0a1ca98049d5c4837fe.pdf
  - USA Boxing (nghiệp dư): có cân chung trước giải và cân hằng ngày vào sáng mỗi ngày thi đấu: https://usaboxing.webpoint.us/Files/UploadFiles/USA%20Boxing%20Rule%20Book%202022.pdf
  - ONE Championship: nhiều lần cân và kiểm tra trong tuần thi đấu, gồm 3 giờ trước khi sự kiện bắt đầu (Sherdog): https://www.sherdog.com/news/news/One-Championship-Adopts-New-WeighIn-Policy-Following-Recent-Fighter-Death-97649
  - Quyền Anh chuyên nghiệp: có thể cân trong ngày thi nếu không ai giảm cân sau khi cân (tìm kiếm tóm tắt từ bộ luật Unified; chưa mở).
- Không có nút "hôm nay không cân" (Ken: fight camp thì võ sĩ phải luôn đi tập; ốm thì thuộc module medical). Nhắc chỉ đòi nhập một con số.
- Không nhập bù: nhắc luôn hướng tới hôm nay. (Việc API hiện cho `measuredAt` tùy chọn — `fighters.model.ts:154` — là chuyện ngoài phạm vi, không thay đổi.)
- Tính khi đọc, không job nền, không gửi thông báo (đúng nguyên tắc thẻ Việc cần làm). `BOUT_WEIGHT_MISSING` đã có trong danh sách `notification_type` của 01 cho khi làm job sau.

## Thiết kế đề xuất

Hàm thuần `computeWeighInReminder` cạnh `computeWeightTrack` trong `bouts.model.ts`:

Đầu vào: `status` của trận, `today` (ngày học viện), ngày của `boutAt`, ngày của `weighInAt`, `A`, điểm cân theo ngày (dùng `buildDailyWeightPoints`), ngày bắt đầu camp (nếu có).

Gọi `g = daysBetweenDates(ngày cân gần nhất, today)`; chưa có cân nào thì `g` tính từ ngày bắt đầu camp.

| `g` | Mức | Nội dung (mã, text do frontend dịch) |
| --- | --- | --- |
| 0 | Không nhắc | Hôm nay đã có cân |
| 1 | `ASK_TODAY` | "Hôm nay bạn chưa cập nhật số cân, hãy cập nhật ngay" |
| ≥ 2 | `YESTERDAY_MISSING` | "HÔM QUA BẠN CHƯA CẬP NHẬT SỐ CÂN, HÃY CẬP NHẬT NGÀY HÔM NAY ĐỂ TRACKING" |
| ≥ ngưỡng XÁM | `STALE` (HLV thấy) | Ngưỡng 3 ngày khi còn xa ngày cân; 2 ngày khi `D <= A` |

Gợi ý nội dung: trong cửa sổ cấp tính (`D <= A`), câu cảnh báo nhấn mạnh hơn vì mỗi ngày thiếu cân là mỗi ngày không biết có đang theo đường giảm không.

Đầu ra thêm vào response trận (`GET /bouts/:id` và bản võ sĩ xem): ví dụ `weightReminder: { active, level, daysSinceLastWeight, messageCode }`. Contract thay đổi, báo Dan, Hoàng Anh, Fon. Dan có thể dùng cùng field cho nhắc `FIGHT_WEEK` ở app võ sĩ (T-006).

## Điểm chưa chốt

- Sau khi trận sang `WEIGHED_IN`: vẫn nhắc nhập cân sáng ngày thi, nhưng trạng thái đỏ/vàng so với hạng cân cần tắt (võ sĩ đang bù nước). Chưa đọc cách `computeWeightTrack` xử lý trận `WEIGHED_IN`; kiểm tra khi lập plan.
- XÁM 2 ngày trong cửa sổ cấp tính: chỉ áp cho `weightReminder.STALE` hay cũng đổi trạng thái XÁM của R7 (sửa `WEIGHT_STALE_DAYS`)? Đề xuất không đổi R7 của T-003 lúc này.
- Có thống kê tuân thủ "X/Y ngày" cho HLV không: chưa hỏi Ken, mặc định không làm.

## Tiêu chí nghiệm thu

- Camp, cân hôm qua có, hôm nay chưa: mức `ASK_TODAY`.
- Cân gần nhất cách 2 ngày: mức `YESTERDAY_MISSING`.
- Ngoài cửa sổ cấp tính, cách 3 ngày: `STALE`. Trong cửa sổ cấp tính, cách 2 ngày: `STALE`.
- Nhập cân hôm nay: `active` còn nhưng mức `none` (hoặc `active = false`; chốt khi lập plan).
- Ngày thi: vẫn nhắc nếu chưa có cân. Ngày sau ngày thi: không nhắc.
- Trận `SCHEDULED`, `COMPLETED`, `CANCELLED`: không nhắc.
- Ranh giới nửa đêm theo `Asia/Ho_Chi_Minh` (dùng `academyDateOf`).

## Lệnh bắt buộc

`lint`, `build`, `test`.
