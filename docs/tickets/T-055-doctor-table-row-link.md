# T-055 Bảng của cổng bác sĩ: bấm cả hàng để mở

- Trạng thái: APPROVED 04/11 ([review](./T-055-REVIEW.md)). Ngày: 03/11/2026. Chỉ `nextjs-frontend`.
- Bối cảnh: chủ dự án (03/11) nói danh sách võ sĩ chỉ cho bấm vào tên. Hàng có hover nền (`.yt-table tbody tr:hover`) nên trông như bấm được, nhưng bấm ngoài tên thì không có gì xảy ra.

## Hiện trạng (đã kiểm)

`a.yt-rowlink` trong `.yt-table` (`src/components/doctor/doctor.css`, khoảng dòng 286–296) chỉ là link trên chữ. Dùng ở:

| Trang | Link | Ghi chú |
| --- | --- | --- |
| `doctor/fighters/page.tsx` | hồ sơ võ sĩ | 1 link mỗi hàng |
| `doctor/examinations/page.tsx` | phiếu khám | 1 link |
| `doctor/injuries/page.tsx` | chấn thương | 1 link |
| `doctor/review-requests/page.tsx` | hồ sơ võ sĩ | kiểm xem hàng có nút hay link khác không |
| ~~`doctor/medical-clearance/page.tsx`~~ | | Sửa 04/11: hai chỗ dùng `yt-rowlink` ở đây nằm trong danh sách thẻ (`gp-card`, `hs-clr`), không phải `.yt-table`, nên mẫu hàng không áp dụng và L4 không phủ trang này |
| `doctor/history/page.tsx` | **2 link mỗi hàng**: sự kiện (`e.href`) và võ sĩ | link chính là sự kiện |

## Thiết kế

- Mẫu "stretched link":
  - `.yt-table tbody tr` có `position: relative`.
  - Link chính của hàng (`a.yt-rowlink`) có `::after { content: ""; position: absolute; inset: 0; }`.
  - Không bọc `<tr>` trong `<a>`, không dùng `onClick` trên `<tr>`.
- **Mỗi hàng đúng một link chính.** Hàng có thêm link hoặc nút khác (ví dụ link võ sĩ ở `history`, nút trong `medical-clearance` hay `review-requests` nếu có) thì phần tử đó có `position: relative; z-index: 1` và vẫn bấm được riêng. Link phụ không mang lớp `yt-rowlink`; nó dùng một lớp riêng, ví dụ `yt-sublink`, giữ kiểu chữ như cũ.
- Hàng có `cursor: pointer`.
- Khi link chính được focus bằng bàn phím, cả hàng hiện viền focus: `tr:has(a.yt-rowlink:focus-visible)` với `outline: 2px solid var(--focus)` và `outline-offset: -2px`.
- Vẫn chỉ một điểm Tab mỗi hàng (cộng link hoặc nút phụ nếu có). Tên link không đổi.
- Hover: giữ nền `--s2`, và gạch chân tên khi hover cả hàng (`tr:hover a.yt-rowlink`).
- Chọn được chữ trong hàng không bắt buộc; có giới hạn này cũng chấp nhận.

## Ca kiểm thử

Lớp C: đọc `doctor.css` dạng chuỗi. Lớp R: `renderToStaticMarkup` trang thật, mock session và nguồn dữ liệu theo khuôn W1 trong `src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts`.

| Ca | Lớp | Đầu vào | Kết quả mong đợi |
| --- | --- | --- | --- |
| L1 | C | `doctor.css` | có `.yt-table tbody tr` với `position: relative`; có `a.yt-rowlink::after` với `position: absolute` và `inset: 0`; có quy tắc `:has(` … `:focus-visible` cho hàng |
| L2 | R | `/doctor/fighters` với 2 võ sĩ | mỗi `<tr>` trong `tbody` có **đúng 1** `a.yt-rowlink`, `href` là `routes.doctor.fighter(id)` |
| L3 | R | `/doctor/history` với 1 sự kiện | hàng có đúng 1 `a.yt-rowlink` (`href = e.href`) và 1 link võ sĩ **không** mang lớp `yt-rowlink` |
| L4 | R | mỗi trang còn lại trong bảng hiện trạng, 1 hàng | mỗi hàng đúng 1 `a.yt-rowlink` |

## Tiêu chí nghiệm thu

1. Mọi ca qua đúng tên.
2. Trình duyệt (demo, bác sĩ Thu Lê): bấm vào cột "Khám gần nhất" của một hàng ở `/doctor/fighters` thì mở hồ sơ võ sĩ đó. Ở `/doctor/history`, bấm tên võ sĩ thì mở hồ sơ võ sĩ, bấm chỗ khác trong hàng thì mở sự kiện. Tab tới hàng thấy viền focus.
3. `lint`, `typecheck`, `test` qua.
