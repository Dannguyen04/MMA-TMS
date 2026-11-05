# T-057 Bảng phân loại của bác sĩ phải tính đình chỉ

- Trạng thái: APPROVED 05/11 (review độc lập trước commit, không lỗi hành vi; hai đột biến sót đã vá bằng test). Ngày: 04/11/2026. Phụ thuộc: T-054, T-056 (đã commit trên `User_Feature`).
- Phạm vi: chỉ `nextjs-frontend`. Không đổi backend, API, mã lỗi, migration. Chạy được ở cả chế độ demo và chế độ API, vì chỉ dùng `listSuspensions` có sẵn.

## Bối cảnh

Chủ dự án thử demo (04/11): bác sĩ Thu không thấy Hoàng Long "bị gì". Trên `/doctor/dashboard`, Hoàng Long nằm ở làn **Xanh · Thông** ("Đủ điều kiện, không việc mở"), dù đang có đình chỉ `MEDICAL` còn hiệu lực (S6 của T-056).

Nguyên nhân (đã đọc code, chưa chạy trình duyệt): [doctor-board.ts](../../nextjs-frontend/src/lib/services/doctor-board.ts) dựng thẻ chỉ từ hồ sơ y tế (`getFighterHealthSummary`, `getClearanceStatus`, `getClinicalDossier`). `triageOf` và `itemsFor` không đọc đình chỉ. Đình chỉ chỉ hiện ở trang hồ sơ võ sĩ, mục "Đình chỉ" (`doctor/fighters/[fighterId]/page.tsx`), nên bác sĩ nhìn dashboard không biết võ sĩ đang bị chặn, và không thấy việc "kết thúc sớm" hay "xác nhận tập lại" đang chờ mình. Lỗ hổng có từ T-050 và T-054 không kiểm tới. Cùng nguyên nhân khiến thẻ võ sĩ ở trang hồ sơ (`loadDoctorRow`) thiếu đình chỉ.

## Thiết kế

Quy tắc (Claude đề xuất, theo F7 trong [FLOWS](../FIGHT-CAMP-BUSINESS-FLOWS.md) §Tập lại theo bậc):

- Đình chỉ **còn hiệu lực** là đình chỉ có `isInForceOn(s, today) === true` (gồm `ACTIVE` và `AWAITING_CLEARANCE`), `today = academyDateOf(now)`.
- Đình chỉ còn hiệu lực có lý do `MEDICAL`, `KO` hoặc `TKO` (`REHAB_TRIGGER_SUSPENSION_REASONS`, những loại cần bác sĩ hoặc HLV xác nhận) làm thẻ **Đỏ**.
- Đình chỉ còn hiệu lực với lý do khác (`DQ`, `MANDATORY_REST`, `OTHER`) làm thẻ **Vàng** (nếu thẻ chưa đỏ): thông tin, không phải việc của bác sĩ.
- Đình chỉ đã `ENDED` mà còn trong lộ trình tập lại theo bậc (`gradedReturn` khác null và `fullReturnOn >= today`) làm thẻ **Vàng**.
- Mỗi trường hợp trên thêm một dòng việc (`BoardItem` loại mới `"suspension"`, có `date`) vào thẻ:
  - còn hiệu lực, `ACTIVE`: "Đình chỉ <lý do> đến dd/MM · tối đa bậc N" (chỉ lý do, hạn, bậc; không thêm hướng dẫn thao tác);
  - `AWAITING_CLEARANCE`: "Đình chỉ <lý do> đã hết hạn, chờ xác nhận tập lại";
  - tập lại theo bậc: "Đang tập lại theo bậc: tối đa bậc N đến dd/MM" (ngày = ngày trước `fullReturnOn`).
  Nhãn lý do dùng `SUSPENSION_REASON_LABELS` ([labels.ts](../../nextjs-frontend/src/lib/domain/labels.ts)); định dạng ngày dùng hàm định dạng có sẵn của repo như `itemsFor` đang làm.
- Nhiều đình chỉ: mỗi võ sĩ chỉ có một dòng việc `suspension`. Chọn theo thứ tự ưu tiên: (1) còn hiệu lực thuộc nhóm đỏ, (2) còn hiệu lực thuộc nhóm vàng, (3) đang tập lại theo bậc. Trong cùng nhóm lấy `endsOn` muộn nhất (nhóm 3: `fullReturnOn` muộn nhất).
- Thẻ trên trang hồ sơ (`loadDoctorRow`) dùng cùng logic.
- Dashboard: dòng việc loại `suspension` hiện cùng danh sách việc của thẻ với biểu tượng riêng; trên khối "7 ngày tới" chip hiện ở ngày của `date` với chữ "Hết đình chỉ" (hoặc "Hết lộ trình tập lại"). `counts.blocked` (banner khẩn và huy hiệu thanh bên) tự đếm theo thẻ đỏ.
- Đọc đình chỉ bằng một lần gọi `listSuspensions({ fighterIds: scope }, user)` bọc `nullIfServiceFails`; khi lỗi, bảng vẫn hiện như hiện tại (không đình chỉ).
- Thẻ **xanh thu gọn** (T-054) chỉ áp dụng khi không có dòng việc nào, nên võ sĩ có đình chỉ không bao giờ bị thu gọn.

Hàm thuần xuất khẩu từ `doctor-board.ts`, tên cố định để test: `suspensionBoardState(suspensions, today)` trả `{ tag: "red" | "amber" | null; item: { text: string; date: string } | null }` cho các đình chỉ của một võ sĩ. `triageOf` gọi nó.

## Ngoài phạm vi

- Backend, trang hồ sơ võ sĩ, trang đình chỉ của HLV, từ điển i18n (chuỗi tiếng Việt trong `doctor-board.ts` như `itemsFor` đang làm).
- Nút thao tác trên thẻ dashboard.

## Ca kiểm thử

Lớp: unit hàm thuần `suspensionBoardState` (S), unit `triageOf`/`loadRow` qua service demo thật (B), render tĩnh trang dashboard (R). `today = 2026-11-05`.

| Ca | Lớp | Đầu vào | Kết quả mong đợi |
| --- | --- | --- | --- |
| S1 | S | `MEDICAL` `startsOn 11-05`, `endsOn 11-18`, `requiresClearance false`, `maxAllowedTier 1` | `tag "red"`; `item.date "2026-11-18"`; `item.text` chứa "Y tế", "18/11" và "bậc 1" |
| S2 | S | `KO` `endsOn 11-03`, `requiresClearance true`, chưa xác nhận (`AWAITING_CLEARANCE`) | `tag "red"`; `item.text` chứa "chờ xác nhận" |
| S3 | S | `MANDATORY_REST` `startsOn 11-04`, `endsOn 11-10` | `tag "amber"`; `item` khác null |
| S4 | S | `DQ` đã hết hạn (`endsOn 11-01`, `requiresClearance false`) | `tag null`, `item null` |
| S5 | S | `KO` đã `ENDED`, `gradedReturn { ceiling 3, fullReturnOn 11-07 }` | `tag "amber"`; `item.text` chứa "tập lại theo bậc" và "bậc 3" |
| S6 | S | `KO` đã `ENDED`, `fullReturnOn 11-04` (đã qua) | `tag null`, `item null` |
| S7 | S | hai đình chỉ còn hiệu lực: `MANDATORY_REST` `endsOn 11-20` và `MEDICAL` `endsOn 11-12` | `tag "red"`; `item.date "2026-11-12"` (đình chỉ `MEDICAL` thuộc nhóm đỏ nên được chọn, dù `MANDATORY_REST` kết thúc muộn hơn) |
| S8 | S | mảng rỗng | `tag null`, `item null` |
| B1 | B | Hoàng Long (`f-hoang-long`), seed demo, bác sĩ Thu | `row.tag "red"`; `row.items` có một dòng `kind "suspension"` |
| B2 | B | Sofia (`f-sofia-kowalski`), seed demo | `row.tag "red"` |
| B3 | B | Linh (`f-linh-pham`), seed demo (KO đã xác nhận, tập lại bậc 3) | `row.tag` không phải `"green"` |
| B4 | B | Emma (`f-emma-lindqvist`), không có đình chỉ | `row.tag` như trước ticket này (không đổi); `row.items` không có dòng `suspension` |
| B5 | B | một võ sĩ thuộc phạm vi Thu không có đình chỉ nào | Kết quả `tag` đúng như `triageOf` cũ cho võ sĩ đó |
| R1 | R | dashboard với một hàng đỏ có dòng `suspension` | Thẻ nằm trong làn đỏ, hiện chữ dòng việc, không có `data-compact="true"` |
| R2 | R | dashboard với một hàng xanh có dòng `suspension` (dựng bằng tay, trường hợp không xảy ra nhưng không được thu gọn) | Không có `data-compact="true"` |
| R3 | R | dashboard với dòng `suspension` có `date` trong 7 ngày | Chip "Hết đình chỉ" trong khối `td-week` ở đúng ngày |
| K1 | B | test T-054, T-055, T-056 và `integrity` | Vẫn qua. Ca nào phụ thuộc số thẻ đỏ/vàng/xanh của seed thì sửa kỳ vọng theo dữ liệu mới, giữ tên ca, ghi lý do vào handover |

Ca B1–B5 chạy trên seed demo và phải độc lập với giờ chạy: dùng cách cô lập db như `t056-demo-suspensions.test.ts`, và không gõ cứng số thẻ.

## Tiêu chí nghiệm thu

1. Có đủ các ca trên, đúng tên và đúng kết quả mong đợi.
2. Các ca S1–S8, B1, B2, B3 phải **lỗi trên code hiện tại**; handover dán output lỗi trước khi sửa và output qua sau khi sửa.
3. `lint`, `typecheck`, `test` của `nextjs-frontend` qua; số test không giảm.
4. Chỉ sửa `lib/services/doctor-board.ts`, `app/(app)/doctor/dashboard/page.tsx`, có thể `components/doctor/doctor.css` (chip và biểu tượng), file test mới, và test hiện có buộc phải đổi theo K1.

## Lệnh bắt buộc

`pnpm --filter nextjs-frontend lint` ; `pnpm --filter nextjs-frontend typecheck` ; `pnpm --filter nextjs-frontend test`

Không chạy dev server (chủ dự án, 04/11).

## Lượt sửa 1 (05/11, sau review độc lập lượt 1)

Review độc lập lượt 1: CHANGES REQUESTED, không có lỗi hành vi chặn; test yếu. Thử đột biến cho thấy nhiều thay đổi sai vẫn qua test.

Việc cần làm:

1. **B2 không chứng minh gì:** Sofia đã đỏ sẵn trên code cũ vì có yêu cầu khám đang mở. Sửa B2 như bảng dưới.
2. **Các nhánh chưa có ca bắt:** sắp xếp `endsOn` muộn nhất trong cùng nhóm, biên `fullReturnOn == today`, TKO, ngày của dòng lộ trình, bậc lấy từ dữ liệu, chip "Hết lộ trình tập lại", dịch vụ đình chỉ lỗi.
3. **Chuỗi dò:** `page.tsx` chọn chữ chip bằng `x.text.includes("tập lại")`. Thay bằng cờ trong `BoardItem`: thêm `graded?: true`, đặt khi dòng thuộc lộ trình tập lại theo bậc; `page.tsx` đọc cờ này.
4. **Dọn code thừa:** xoá `SuspensionBoardInput.status` (không dùng); xoá nhánh `susp.tag === "amber"` trong `triageOf` (dòng việc `suspension` đã làm `items.length > 0`); `triageOf` chỉ còn dùng `suspensions` để quyết định đỏ.
5. **Đổi tên K1 trong file test:** ca hiện có (kiểm `loadDoctorRow`) đổi mã thành `K2`. `K1` của ticket nghĩa là cả bộ test cũ vẫn qua, do `pnpm test` kiểm; ghi trong handover.

Quyết định đã chốt (Claude, 05/11): thẻ đỏ vì đình chỉ vẫn hiện cổng "Tập luyện" theo giấy phép y tế. Cổng này nói về giấy phép y tế, đình chỉ là cổng khác (F7, Cổng 2); dòng việc `suspension` màu đỏ ở thẻ giải thích lý do. Không đổi `Gate`.

Ca thêm hoặc sửa (`today = 2026-11-05`):

| Ca | Lớp | Đầu vào | Kết quả mong đợi |
| --- | --- | --- | --- |
| B2 (sửa) | B | Sofia, seed demo | `row.tag "red"` **và** `row.items` có dòng `kind "suspension"` chứa "Y tế". Phải lỗi trên code cũ |
| B3 (sửa) | B | Linh, seed demo | `row.tag` không phải `"green"` **và** có dòng `kind "suspension"` chứa "tập lại theo bậc" |
| S9 | S | hai đình chỉ còn hiệu lực nhóm đỏ: `MEDICAL` `endsOn 11-12`, `KO` `endsOn 11-20` `requiresClearance true` | `tag "red"`; `item.date "2026-11-20"` |
| S10 | S | hai đình chỉ còn hiệu lực nhóm vàng: `MANDATORY_REST` `endsOn 11-10`, `DQ` `endsOn 11-15` | `tag "amber"`; `item.date "2026-11-15"` |
| S11 | S | `TKO` `startsOn 11-04`, `endsOn 11-12`, `requiresClearance true` | `tag "red"` |
| S12 | S | `KO` đã `ENDED`, `gradedReturn { ceiling 3, fullReturnOn 11-05 }` (đúng hôm nay) | `tag "amber"`; `item.date "2026-11-04"` |
| S13 | S | `MEDICAL` còn hiệu lực `maxAllowedTier 2`; và `KO` đã `ENDED` `gradedReturn { ceiling 2, fullReturnOn 11-07 }` | dòng thứ nhất chứa "bậc 2"; dòng thứ hai chứa "bậc 2" và `item.date "2026-11-06"` |
| S5 (sửa) | S | như cũ | thêm: `item.date "2026-11-06"` |
| B6 | B | `listSuspensions` bị làm lỗi (ném lỗi) trong lúc `loadDoctorBoard` chạy trên seed demo | bảng vẫn trả đủ hàng, không dòng nào có `kind "suspension"`, không ném lỗi |
| R4 | R | dashboard với dòng `suspension` có `graded true` và `date` trong 7 ngày | khối `td-week` chứa "Hết lộ trình tập lại" tại ngày đó; dòng không có `graded` thì chứa "Hết đình chỉ" |
| K2 | B | `loadDoctorRow` của Hoàng Long (ca K1 cũ đổi mã) | như cũ |

S9–S13, B6, R4 và các phần sửa B2, B3, S5 là ca tái hiện đột biến: handover liệt kê, cho từng đột biến dưới đây, ca nào bắt được: (a) sắp xếp `endsOn` sớm nhất; (b) `fullReturnOn > today` thay vì `>=`; (c) bỏ `-1` ở ngày lộ trình; (d) TKO không đỏ; (e) bỏ `nullIfServiceFails` ở `loadDoctorBoard`; (f) chữ chip lộ trình đổi thành "Hết đình chỉ"; (g) hardcode "bậc 3" hoặc mặc định bậc 2. Agy tự áp từng đột biến trên bản sao hoặc tạm thời và ghi kết quả, không để lại trong repo.

## Lượt sửa 2 (05/11, review độc lập trước commit)

Review độc lập: APPROVED, không lỗi hành vi. Hai đột biến vẫn qua test, cần vá chỉ bằng test (không đổi code production):

1. `loadRow` đặt `graded: true` cho mọi dòng `suspension` thì vẫn qua. Hậu quả thật: đình chỉ đang hiệu lực sẽ hiện chip "Hết lộ trình tập lại" sai.
2. Bỏ `nullIfServiceFails` trong `loadDoctorRow` thì vẫn qua (B6 chỉ phủ `loadDoctorBoard`): trang hồ sơ võ sĩ sẽ sập khi dịch vụ đình chỉ lỗi.

| Ca | Lớp | Đầu vào | Kết quả mong đợi |
| --- | --- | --- | --- |
| S1 (thêm kiểm) | S | như cũ | `item.graded` là `undefined` |
| S5 (thêm kiểm) | S | như cũ | `item.graded` là `true` |
| B1 (thêm kiểm) | B | như cũ | dòng `suspension` của Hoàng Long có `graded` là `undefined` |
| B3 (thêm kiểm) | B | như cũ | dòng `suspension` của Linh có `graded` là `true` |
| B7 | B | `listSuspensions` bị làm lỗi (ném `ApiError` 503) trong lúc gọi `loadDoctorRow` cho Hoàng Long, seed demo | không ném lỗi; trả về hàng không có dòng `kind "suspension"` |

Hai đột biến trên phải bị bắt bởi các ca này; handover ghi ca nào bắt đột biến nào.
