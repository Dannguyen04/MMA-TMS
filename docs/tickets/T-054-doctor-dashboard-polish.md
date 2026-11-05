# T-054 Polish bảng "Phân loại hôm nay" của bác sĩ

- Trạng thái: APPROVED 04/11 ([review](./T-054-REVIEW.md)). Ngày: 03/11/2026. Chỉ `nextjs-frontend`. Không đổi dữ liệu, service hay route.
- File: `src/app/(app)/doctor/dashboard/page.tsx`, `src/components/doctor/doctor.css` (các lớp `td-*`, `yt-hole` trong `.td-field`).
- Bối cảnh: chủ dự án thấy trang "trông slop". Critique (Impeccable polish, chế độ Operate), ảnh 1440 px và 375 px chụp ở demo mode ngày 03/11.

## Giữ nguyên

Ý tưởng thẻ phân loại (đầu thẻ theo màu, rơi xuống khi tải; lỗ thẻ `yt-hole` vẫn giữ ở `hs-tag`, `ro-name` của trang khác), font tiêu đề, ba làn Đỏ/Vàng/Xanh, bộ đếm, nút "Tạo phiếu khám" và "Cấp giấy phép", khối "7 ngày tới" và "Quan sát AI", toàn bộ chữ trừ những chỗ ghi dưới đây.

## Vấn đề và cách sửa

1. **Màu nào cũng hét.** 8 thẻ đều có đầu thẻ tô đặc đỏ, vàng hay xanh, cộng thêm bộ đếm và vạch làn cùng màu. Mắt không biết nhìn đâu trước. Sửa: chỉ thẻ **đỏ** giữ đầu thẻ tô đặc. Thẻ vàng và xanh có đầu thẻ nền nhạt (`color-mix` của `--t` khoảng 16–20% với `--s`), chữ màu `--ink`, và một viền trái 4 px màu `--t` đậm. Tương phản chữ phải ≥ 4.5:1. Màu không là tín hiệu duy nhất, vì tên làn vẫn ghi chữ.
2. **Lỗ thẻ trông như nút radio chưa chọn.** `.td-field .yt-hole` là chấm trắng cạnh tên, trông như ô bấm được. Lượt 1 thử làm thành khoen nhưng vòng rỗng vẫn giống radio, nên lượt sửa 1 (03/11) **bỏ hẳn** lỗ khỏi thẻ trên trang dashboard; các trang khác giữ nguyên.
3. **Dòng "Mở hồ sơ →" ở đáy mọi thẻ là thừa.** Cả thẻ đã là link. Dòng này tốn một vạch kẻ và khoảng 40 px mỗi thẻ. Sửa: bỏ `.td-open`, đặt mũi tên nhỏ ở góc phải đầu thẻ (`aria-hidden`); hover vẫn đẩy mũi tên sang phải. Tên link vẫn là tên võ sĩ.
4. **Thẻ xanh gần như trống.** Thân thẻ chỉ có chip "Tập luyện ✓". Sửa: thẻ không có lý do chặn, việc mở hay chấn thương (`reasons`, `items`, `activeInjuries` đều rỗng) hiện **gọn**: đầu thẻ, rồi chip cổng nằm cùng hàng, không có thân thẻ riêng. Thẻ có nội dung giữ như cũ.
5. **Băng cảnh báo nói "0 yêu cầu xem xét" và nút "Mở yêu cầu" dẫn tới danh sách rỗng.** Sửa:
   - Chỉ nêu những vế có số > 0:
     - chỉ chặn: "1 võ sĩ bị chặn tập. Xử lý thẻ đỏ trước buổi tập.";
     - chỉ yêu cầu: "2 yêu cầu xem xét đang chờ.";
     - cả hai: câu nối bằng "và" như cũ.
   - Nút: có yêu cầu thì "Mở yêu cầu" như cũ. Chỉ có chặn thì "Xem thẻ đỏ", trỏ `#ln-red`.
6. **"7 ngày tới":**
   - Ô "Hôm nay" là một khối đen to và trống. Sửa: ô hôm nay nền `--s` với viền 2 px `--ink`, ngày in đậm, không tô đen cả ô.
   - Chip sự kiện vỡ chữ (mỗi dòng một, hai từ). Sửa: chữ chip tối đa 2 dòng (`line-clamp`), có `title` đủ chữ.
   - Ở ≤ 767 px lưới 7 cột bị cắt ngang. Sửa: chuyển thành danh sách dọc; mỗi ngày một hàng (thứ, ngày, rồi các chip). Các ngày không có sự kiện **không** hiện; nếu cả 7 ngày trống thì hiện "Không có lịch trong 7 ngày tới".

Áp `prefers-reduced-motion` cho `td-drop` nếu file chưa có.

## Ca kiểm thử

Lớp R: render trang bằng `renderToStaticMarkup`, mock `requireRole`, `loadDoctorBoard`, `listRecoveryPlans`, theo khuôn W1 trong `src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts`. Lớp C: đọc `doctor.css` dạng chuỗi.

| Ca | Lớp | Đầu vào | Kết quả mong đợi |
| --- | --- | --- | --- |
| D1 | R | 1 hàng đỏ, `reviews 0` | băng chứa "1 võ sĩ bị chặn tập"; **không** chứa "0 yêu cầu"; link băng `href="#ln-red"` chữ "Xem thẻ đỏ" |
| D2 | R | 0 hàng đỏ, `reviews 2` | băng chứa "2 yêu cầu xem xét"; **không** chứa "bị chặn tập"; link tới `routes.doctor.reviewRequests` |
| D3 | R | 1 đỏ, `reviews 2` | băng chứa cả hai vế, link "Mở yêu cầu" |
| D4 | R | 0 đỏ, `reviews 0` | không có băng (`td-urgent` vắng) |
| D5 | R | 1 hàng xanh không `reasons`/`items`/`activeInjuries` | thẻ của hàng mang dấu gọn (ví dụ `data-compact="true"`); không có `td-open` ở bất kỳ thẻ nào |
| D6 | R | 1 hàng vàng có 1 việc `followup` | thẻ không gọn, có dòng việc mở; link thẻ `href=routes.doctor.fighter(id)` |
| D7 | R | việc `followup` ngày hôm nay + 2, không gì khác | trong `td-week` có đúng 7 `li.td-day`; ngày có sự kiện mang chip chứa tên và "Tái khám"; ngày trống mang `data-empty="true"` (CSS ẩn ở màn nhỏ) |
| C1 | C | `doctor.css` | `.td-field` của làn `amber`/`green` không dùng nền `var(--t)` đặc; có quy tắc `@media (max-width: 767px)` cho `.td-week` không còn `overflow-x: auto`; có `prefers-reduced-motion` tắt `td-drop` |
| C2 | C | trang + `doctor.css` | markup dashboard không chứa lớp `yt-hole`; chip cổng trong thẻ gọn có `white-space: nowrap` |

## Tiêu chí nghiệm thu

1. Mọi ca qua đúng tên.
2. Ảnh trước và sau ở 1440 px và 375 px (demo, bác sĩ Thu Lê, `/doctor/dashboard`): không cuộn ngang ở 375 px, thẻ đỏ nổi nhất, thẻ xanh gọn.
3. `lint`, `typecheck`, `test` của `nextjs-frontend` qua. Số test không giảm.

## Lượt 2: bớt chói (Impeccable `quieter`, 03/11)

Chủ dự án thấy trang "vẫn chói". Nguồn gây chói đo được trên ảnh 1440 px: ba khối đếm tô đặc ba màu ở góc phải, đầu thẻ đỏ tô đặc, băng cảnh báo đen kín bề ngang, tiêu đề 72 px, vạch làn 3 px, thẻ xanh tô nền xanh cả thẻ, ô hôm nay viền đen 2 px, chip sự kiện viền ba màu, bóng đổ và hiệu ứng rơi có xoay.

Hướng sửa: chế độ Operate, công cụ phải lùi lại. Nền trung tính làm phần lớn việc; màu chỉ là điểm nhấn, khoảng 10% diện tích. Chỉ thẻ đỏ được đậm nhất. Áp cho cả nền sáng lẫn nền tối, chỉ qua token có sẵn. Chỉ đổi lớp `td-*` và `.td-head`.

1. **Bộ đếm `td-tally`:** nền `--s`, viền `1px var(--line)`. Số in `--ink`, cỡ khoảng 24 px. Màu chỉ ở một chấm 8 px (hoặc vạch 3 px) màu `--t` trước chữ.
2. **Tiêu đề trang** `.td-head h1`: khoảng `clamp(32px, 3.6vw, 48px)`.
3. **Tiêu đề làn** `.td-lane h2`: khoảng 20 px. Vạch dưới làn 2 px.
4. **Thẻ:**
   - Mọi thẻ nền `--s`, viền `1px var(--line)`, bóng nhẹ hoặc không có bóng. Hover chỉ đổi viền hoặc nền `--s2`, không nhấc, không xoay.
   - Đầu thẻ đỏ: nền `--block-soft`, chữ tên `--block-ink`, viền trái 4 px `--red`.
   - Đầu thẻ vàng: nền `--amb-soft`, chữ `--ink`, viền trái 4 px `--amb`.
   - Thẻ xanh gọn: nền `--s`, viền trái 3 px `--grn`, không tô nền.
5. **Băng cảnh báo `td-urgent`:** nền `--block-soft`, chữ `--block-ink`, icon `--red`. Nút là link chữ hoặc nút viền, không có khối nền đặc.
6. **"7 ngày tới":**
   - Ô hôm nay: nền `--s2`, ngày in `--ink` đậm, viền `1px var(--line)`, không viền đen.
   - Chip sự kiện: nền `--s2`, không viền; màu loại chỉ là vạch trái 3 px.
   - Chú thích dùng cùng vạch đó.
7. **Quan sát AI `td-rom`:** vòng mảnh hơn (lõi `inset: 4px`), không đổi màu.
8. **Chuyển động:** `td-drop` thành fade và trượt nhẹ (`translateY(-6px)`), bỏ `rotate`. Giữ `prefers-reduced-motion`.

Tương phản chữ ≥ 4.5:1 ở cả hai theme.

| Ca | Lớp | Đầu vào | Kết quả mong đợi |
| --- | --- | --- | --- |
| Q1 | C | `doctor.css` | `.td-tally li` không có `background: var(--t)` |
| Q2 | C | `doctor.css` | `.td-urgent` không dùng `background: var(--ink)` |
| Q3 | C | `doctor.css` | không quy tắc `.td-tag` nào dùng nền `var(--t)` đặc cho `.td-field`; thẻ đỏ dùng `--block-soft` |
| Q4 | C | `doctor.css` | `@keyframes td-drop` không chứa `rotate`; `.td-tag > a:hover` không chứa `rotate` |
| Q5 | C | `doctor.css` | `.td-day[data-today="true"]` không có `border` 2 px màu `--ink` và không có nền `--ink` |

Ca D1–D7, C1, C2 vẫn phải qua.


## Lượt 3: sửa theo review độc lập (04/11)

| Ca | Lớp | Đầu vào | Kết quả mong đợi |
| --- | --- | --- | --- |
| D8 | R | 1 hàng vàng: `clearanceState 'restricted'`, `training { eligible: true, reasons: [] }`, không việc mở, không chấn thương | thẻ ở làn vàng **không** mang `data-compact="true"`; chỉ thẻ xanh được gọn. Phải lỗi trên code trước lượt 3 |
| D9 | R | 1 hàng đỏ: `training { eligible: false, reasons: [] }`, không gì khác | thẻ **không** gọn |
| C1, Q3 (siết lại) | C | `doctor.css` | không quy tắc `.td-tag[data-tag=...] .td-field` nào có `background: var(--t)`; nền vàng là `var(--amb-soft)`, xanh là `var(--ok-soft)`, không còn fallback `color-mix` thừa |
| Q6 | C | `doctor.css` | `.td-tag[data-tag="red"] .td-field small` dùng màu `var(--block-ink)` đặc, không `color-mix` hay trong suốt (tương phản ≥ 4.5:1 ở theme sáng) |
