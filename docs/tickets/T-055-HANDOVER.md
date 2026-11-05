# Bàn giao T-055: Bảng của cổng bác sĩ - Bấm cả hàng để mở

## 1. File đã sửa và tạo mới

- Sửa: `nextjs-frontend/src/components/doctor/doctor.css` (thêm mẫu stretched link cho `.yt-table tbody tr`, quy tắc `:has(:focus-visible)`, và lớp phụ `.yt-sublink`)
- Sửa: `nextjs-frontend/src/app/(app)/doctor/history/page.tsx` (đổi link võ sĩ thành `.yt-sublink`)
- Sửa: `nextjs-frontend/src/app/(app)/doctor/examinations/page.tsx` (gán `.yt-sublink` cho link võ sĩ phụ trong hàng)
- Sửa: `nextjs-frontend/src/app/(app)/doctor/injuries/page.tsx` (gán `.yt-sublink` cho link võ sĩ phụ trong hàng)
- Test mới: `nextjs-frontend/src/app/(app)/doctor/t055-row-link.test.ts` (Ca L1–L4)
- Tài liệu bàn giao: `docs/tickets/T-055-HANDOVER.md`

*(Giữ nguyên 100% các file của T-053; không commit/push/stash).*

---

## 2. Bảng ca kiểm thử -> Tên test

| Ca | Lớp | Tên test | Kết quả |
| --- | --- | --- | --- |
| **L1** | C | `L1: doctor.css -> có .yt-table tbody tr với position: relative; có a.yt-rowlink::after với position: absolute và inset: 0; có quy tắc :has( … :focus-visible cho hàng` | PASS |
| **L2** | R | `L2: /doctor/fighters với 2 võ sĩ -> mỗi <tr> trong tbody có đúng 1 a.yt-rowlink, href là routes.doctor.fighter(id)` | PASS |
| **L3** | R | `L3: /doctor/history với 1 sự kiện -> hàng có đúng 1 a.yt-rowlink (href = e.href) và 1 link võ sĩ không mang lớp yt-rowlink` | PASS |
| **L4** | R | `L4: mỗi trang còn lại trong bảng hiện trạng, 1 hàng -> mỗi hàng đúng 1 a.yt-rowlink` | PASS |

---

## 3. Khảo sát các trang trong bảng "Hiện trạng"

| Trang | Link chính (`yt-rowlink`) | Link/nút phụ trong hàng | Xử lý |
| --- | --- | --- | --- |
| `doctor/fighters/page.tsx` | Hồ sơ võ sĩ (`r.fighter.id`) | Không có | Bấm bất kỳ ô nào trong hàng (kể cả "Khám gần nhất") đều mở hồ sơ võ sĩ. |
| `doctor/history/page.tsx` | Sự kiện y tế (`e.href`) | Link võ sĩ | Đổi từ `yt-rowlink` sang `yt-sublink` để nổi lên `z-index: 1`, bấm riêng được. |
| `doctor/examinations/page.tsx` | Phiếu khám (`e.id`) | Link võ sĩ | Thêm `yt-sublink` để nổi lên `z-index: 1`, bấm mở võ sĩ; bấm chỗ khác mở phiếu khám. |
| `doctor/injuries/page.tsx` | Chấn thương (`i.id`) | Link võ sĩ | Thêm `yt-sublink` để nổi lên `z-index: 1`, bấm mở võ sĩ; bấm chỗ khác mở chấn thương. |
| `doctor/review-requests/page.tsx` | Hồ sơ võ sĩ (`r.fighterId`) | Nút `Khám` (`.yt-btn`) | `.yt-table .yt-btn` đã có `position: relative; z-index: 1`, nút khám hoạt động độc lập. |
| `doctor/medical-clearance/page.tsx` | Hồ sơ võ sĩ | Nút thu hồi / link cấp | Trang này sử dụng danh sách `ul.hs-clr` và thẻ card `ol > .gp-card`, không dùng `table.yt-table`. |

---

## 4. Kết quả kiểm thử trình duyệt (Playwright msedge, demo port 3100)

Đã chạy kịch bản tự động trên trình duyệt thật Microsoft Edge qua Playwright (`chromium.launch({ channel: 'msedge' })`):
1. **Đăng nhập**: Mở `http://localhost:3100/login`, bấm nút "Thu Lê", chuyển hướng vào hệ thống bác sĩ thành công.
2. **Kiểm tra `/doctor/fighters`**:
   - Bấm bằng chuột (`page.mouse.click`) vào ô thuộc cột **"Khám gần nhất"** của hàng đầu tiên (tọa độ cell: `x=1321.2, y=287.9`).
   - URL chuyển hướng thành: `http://localhost:3100/doctor/fighters/f-diego-alvarez` (đạt yêu cầu).
3. **Kiểm tra `/doctor/history`**:
   - Bấm vào tên võ sĩ (`.yt-sublink`): URL chuyển hướng đến hồ sơ võ sĩ `http://localhost:3100/doctor/fighters/f-diego-alvarez`.
   - Quay lại `/doctor/history`, bấm vào vị trí khác trong hàng (ô loại sự kiện đầu tiên): URL chuyển hướng đến chi tiết sự kiện `http://localhost:3100/doctor/examinations/ex-diego-concussion-3d`.
4. **Kiểm tra bàn phím và chụp ảnh focus outline**:
   - Dùng phím `Tab` duyệt tới hàng: activeElement là `a.yt-rowlink`.
   - Cả hàng hiện viền focus `2px solid var(--focus)` với `outline-offset: -2px` qua bộ chọn `:has(a.yt-rowlink:focus-visible)`.
   - Ảnh chụp đã lưu:
     - Viền focus hàng: `D:/test/ai-worktrees/logs/t055-shots/focus-row.png`
     - Hover hàng: `D:/test/ai-worktrees/logs/t055-shots/hover-row.png`

---

## 5. Chất lượng: Impeccable (craft-floor) & Ponytail Review

### 5.1. Impeccable Craft Floor
- **Hover**: Nền chuyển sang `--s2`, link chính gạch chân `text-decoration: underline; text-underline-offset: 3px`. Hàng có `cursor: pointer` tạo affordance bấm rõ ràng.
- **Focus ring**: Áp dụng `:has(a.yt-rowlink:focus-visible)` cho toàn bộ `<tr>` với `outline: 2px solid var(--focus)` và `outline-offset: -2px`. Ẩn outline riêng lẻ trên chữ của `a.yt-rowlink` để tránh viền kép lộn xộn. Link/nút phụ (`.yt-sublink`, `.yt-btn`) vẫn giữ focus ring độc lập khi Tab tới.
- **Tương tác**: Không dùng JavaScript `onClick` hay can thiệp DOM ngoài CSS stretched link chuẩn WCAG.

### 5.2. Ponytail Review
- **speculative feature / dead code**: Không có.
- **dependency**: Không cài thêm bất kỳ thư viện ngoài nào, dùng CSS thuần chuẩn Web Platform (`:has`, `::after`).
- **abstraction**: Không thêm component hay hook trừu tượng thừa.
- **Kết luận**: `Lean already. Ship.`

---

## 6. Câu hỏi

- Không có. Mọi ca kiểm thử và yêu cầu của ticket đều được giải quyết đầy đủ, không có xung đột.
