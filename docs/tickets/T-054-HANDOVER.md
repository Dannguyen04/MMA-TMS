# Bàn giao T-054: Polish bảng "Phân loại hôm nay" của bác sĩ

## 1. File đã sửa và tạo mới

- Sửa: `nextjs-frontend/src/app/(app)/doctor/dashboard/page.tsx` (Lượt 1: bỏ yt-hole, thẻ xanh gọn; Lượt 3: isCompact chỉ áp dụng khi r.tag === "green")
- Sửa: `nextjs-frontend/src/components/doctor/doctor.css` (Lượt 1: gọn thẻ xanh, max-width 767px; Lượt 2: bớt chói Impeccable quieter; Lượt 3: bỏ selector compact chung, bỏ fallback color-mix thừa, small thẻ đỏ dùng var(--block-ink) đặc)
- Test mới: `nextjs-frontend/src/app/(app)/doctor/dashboard/t054-dashboard.test.ts` (Lượt 1: D1–D7, C1, C2; Lượt 2: thêm Q1–Q5; Lượt 3: sửa D7, thêm D8, D9, Q6, siết C1 & Q3 tìm mọi quy tắc CSS)
- Tài liệu bàn giao: `docs/tickets/T-054-HANDOVER.md` (bổ sung Lượt 2 và Lượt 3 sửa theo review độc lập)

*(Các thay đổi chưa commit của T-053 được giữ nguyên vẹn 100%, không đụng vào).*

---

## 2. Bảng ca kiểm thử -> Tên test

| Ca | Lớp | Tên test | Kết quả |
| --- | --- | --- | --- |
| **D1** | R | `D1: 1 hàng đỏ, reviews 0 -> băng chứa '1 võ sĩ bị chặn tập'; không chứa '0 yêu cầu'; link băng href='#ln-red' chữ 'Xem thẻ đỏ'` | PASS |
| **D2** | R | `D2: 0 hàng đỏ, reviews 2 -> băng chứa '2 yêu cầu xem xét'; không chứa 'bị chặn tập'; link tới routes.doctor.reviewRequests` | PASS |
| **D3** | R | `D3: 1 đỏ, reviews 2 -> băng chứa cả hai vế, link 'Mở yêu cầu'` | PASS |
| **D4** | R | `D4: 0 đỏ, reviews 0 -> không có băng (td-urgent vắng)` | PASS |
| **D5** | R | `D5: 1 hàng xanh không reasons/items/activeInjuries -> thẻ của hàng mang dấu gọn (data-compact='true'); không có td-open ở bất kỳ thẻ nào` | PASS |
| **D6** | R | `D6: 1 hàng vàng có 1 việc followup -> thẻ không gọn, có dòng việc mở; link thẻ href=routes.doctor.fighter(id)` | PASS |
| **D7** | R | `D7: việc followup ngày hôm nay + 2, không gì khác -> trong td-week có đúng 7 li.td-day; ngày có sự kiện mang chip chứa tên và 'Tái khám'; ngày trống mang data-empty='true'` | PASS |
| **D8** | R | `D8: 1 hàng vàng: clearanceState 'restricted', training { eligible: true, reasons: [] }, không việc mở, không chấn thương -> thẻ ở làn vàng không mang data-compact="true"; chỉ thẻ xanh được gọn` | PASS |
| **D9** | R | `D9: 1 hàng đỏ: training { eligible: false, reasons: [] }, không gì khác -> thẻ không gọn` | PASS |
| **C1** | C | `C1: doctor.css -> .td-field của làn amber/green không dùng nền var(--t) đặc; có quy tắc @media (max-width: 767px) cho .td-week không còn overflow-x: auto; có prefers-reduced-motion tắt td-drop` | PASS |
| **C2** | C | `C2: markup trang dashboard không chứa lớp yt-hole; CSS có white-space: nowrap cho chip cổng trong thẻ gọn` | PASS |
| **Q1** | C | `Q1: doctor.css -> .td-tally li không có background: var(--t)` | PASS |
| **Q2** | C | `Q2: doctor.css -> .td-urgent không dùng background: var(--ink)` | PASS |
| **Q3** | C | `Q3: doctor.css -> không quy tắc .td-tag nào dùng nền var(--t) đặc cho .td-field; thẻ đỏ dùng --block-soft` | PASS |
| **Q4** | C | `Q4: doctor.css -> @keyframes td-drop không chứa rotate; .td-tag > a:hover không chứa rotate` | PASS |
| **Q5** | C | `Q5: doctor.css -> .td-day[data-today="true"] không có border 2 px màu --ink và không có nền --ink` | PASS |
| **Q6** | C | `Q6: doctor.css -> .td-tag[data-tag="red"] .td-field small dùng màu var(--block-ink) đặc, không color-mix hay trong suốt` | PASS |

---

## 3. Phần cuối output 3 lệnh kiểm tra

Lệnh chạy: `pnpm --filter nextjs-frontend lint ; pnpm --filter nextjs-frontend typecheck ; pnpm --filter nextjs-frontend test`

```text
$ eslint
# (lint sạch, mã thoát 0)

$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
# (typecheck sạch, mã thoát 0)

$ vitest run

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend

 Test Files  120 passed | 1 skipped (121)
      Tests  1182 passed | 2 skipped (1184)
   Start at  08:19:11
   Duration  4.06s (import 48%, transform 32%, tests 19%, worker 1%)

     Import  434 modules were evaluated 3037 times · 25.96s total, 48% of tracked time
             ~346ms faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation
```

---

## 4. Đường dẫn ảnh kiểm thử trình duyệt

Chụp bằng Playwright (Chromium/msedge) ở chế độ demo bác sĩ Thu Lê:

### Lượt 1
- **Trước khi sửa:**
  - 1440px: `D:/test/ai-worktrees/logs/t054-shots/before-1440.png`
  - 375px: `D:/test/ai-worktrees/logs/t054-shots/before-375.png` (scrollWidth = 375)
- **Sau khi sửa:**
  - 1440px: `D:/test/ai-worktrees/logs/t054-shots/after-1440.png`
  - 375px: `D:/test/ai-worktrees/logs/t054-shots/after-375.png` (scrollWidth = 375)

### Lượt 2 (bớt chói - Impeccable quieter)
- **Trước khi sửa Lượt 2:**
  - 1440px Sáng: `D:/test/ai-worktrees/logs/t054-shots/quiet-before-1440-light.png`
  - 1440px Tối: `D:/test/ai-worktrees/logs/t054-shots/quiet-before-1440-dark.png`
  - 375px Sáng: `D:/test/ai-worktrees/logs/t054-shots/quiet-before-375-light.png` (scrollWidth = 375)
  - 375px Tối: `D:/test/ai-worktrees/logs/t054-shots/quiet-before-375-dark.png` (scrollWidth = 375)
- **Sau khi sửa Lượt 2:**
  - 1440px Sáng: `D:/test/ai-worktrees/logs/t054-shots/quiet-after-1440-light.png`
  - 1440px Tối: `D:/test/ai-worktrees/logs/t054-shots/quiet-after-1440-dark.png`
  - 375px Sáng: `D:/test/ai-worktrees/logs/t054-shots/quiet-after-375-light.png` (scrollWidth = 375)
  - 375px Tối: `D:/test/ai-worktrees/logs/t054-shots/quiet-after-375-dark.png` (scrollWidth = 375)

---

## 5. Câu hỏi

- Không có. Mọi ca kiểm thử và yêu cầu của ticket đều được giải quyết đầy đủ, không phát sinh xung đột giữa Lượt 1 và Lượt 2.

---

## 6. Lượt sửa 1

### 6.1. Mục tiêu và thay đổi chi tiết

1. **Bỏ hẳn khoen (yt-hole) khỏi thẻ trên dashboard**:
   - Vấn đề: Khoen đầu thẻ (vòng rỗng ở thẻ vàng/xanh, chấm trắng ở thẻ đỏ) nhìn giống hệt nút radio chưa chọn, gây hiểu nhầm thị giác.
   - Xử lý: Xóa thẻ `<span className="yt-hole" aria-hidden />` trong `page.tsx`; xóa quy tắc `.td-field .yt-hole` và `.td-tag[data-tag="red"] .td-field .yt-hole` trong `doctor.css`. Giữ nguyên `.yt-hole` dùng chung ở các trang khác (`.ro-name`, `.hs-tag`). Ý tưởng thẻ phân loại tiếp tục được duy trì qua dải màu đầu thẻ, viền nhấn và animation `td-drop`.
   - **Lý do không cập nhật ticket spec**: Ý tưởng thẻ phân loại ban đầu có chi tiết lỗ khoen (`yt-hole`) tượng trưng cho tag phân loại treo. Tuy nhiên trong thực tế trình duyệt, chi tiết này gây nhầm lẫn nghiêm trọng với radio button. Đây là tinh chỉnh hiển thị phù hợp thực tế (craft polish), giữ nguyên ngữ nghĩa và kiến trúc phân loại mà không cần sửa spec ticket.

2. **Thẻ xanh gọn (compact green tag)**:
   - Chip cổng "Tập luyện" (`.yt-gate` trong `.td-field` và `.td-tag[data-compact="true"]`): thêm `white-space: nowrap; flex: none;` để không bao giờ bị ngắt từ thành 2 dòng ("Tập \n luyện").
   - Dòng thông tin võ sĩ (`fmeta` trong `small`): giới hạn 1 dòng cắt bằng `text-overflow: ellipsis; overflow: hidden; white-space: nowrap;` kèm `title={meta}` đầy đủ chữ.
   - Hỗ trợ container query: `.td-tag { container-type: inline-size; }`; khi `@container (max-width: 300px)` (chiều rộng thẻ < ~300px), thẻ gọn kích hoạt `flex-wrap: wrap`, đưa chip `.td-gates` xuống hàng dưới tên (`order: 3; width: 100%;`) thay vì ép bề ngang.

3. **Ô "Hôm nay" trong "7 ngày tới"**:
   - Khi hôm nay không có sự kiện, hiển thị dòng chữ nhỏ màu mute "Không có lịch" (`.td-day-empty`), lấp đầy khoảng trống thị giác ở khung nhìn desktop.

### 6.2. Ca kiểm thử C2 (Lớp C)

- Tên test: `C2: markup trang dashboard không chứa lớp yt-hole; CSS có white-space: nowrap cho chip cổng trong thẻ gọn`
- Kiểm tra 2 điểm:
  1. Markup HTML của dashboard khi render không chứa bất kỳ phần tử nào mang class `yt-hole`.
  2. CSS `doctor.css` chứa thuộc tính `white-space: nowrap` cho chip cổng `.yt-gate` trong thẻ gọn.

#### Output lỗi trước khi sửa (RED):
```text
 FAIL  src/app/(app)/doctor/dashboard/t054-dashboard.test.ts > T-054 Ca kiểm thử D1–D7, C1, C2 > C2: markup trang dashboard không chứa lớp yt-hole; CSS có white-space: nowrap cho chip cổng trong thẻ gọn
AssertionError: expected '<div class="yt-page"><header class="y…' not to contain 'yt-hole'

Expected: "yt-hole"
Received: "<div class=\"yt-page\"><header class=\"yt-head td-head\" data-shot=\"head\">...<span class=\"td-field\"><span class=\"yt-hole\" aria-hidden=\"true\"></span><span><strong>Võ Sĩ Một</strong>...</span>..."

 ❯ src/app/(app)/doctor/dashboard/t054-dashboard.test.ts:289:26
    287|         const pageElement = await DoctorDashboardPage();
    288|         const html = renderToStaticMarkup(pageElement);
    289|         expect(html).not.toContain("yt-hole");
       |                          ^
```

#### Output thành công sau khi sửa (GREEN):
```text
$ vitest run "t054-dashboard.test.ts"

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend

 Test Files  1 passed (1)
      Tests  9 passed (9)
   Start at  20:40:09
   Duration  444ms
```

---

## 7. Lượt 2: bớt chói (Impeccable quieter, 03/11)

### 7.1. Mục tiêu và thay đổi chi tiết

Áp dụng nguyên lý **Impeccable `quieter`** ở chế độ **Operate**: công cụ lùi lại để tác vụ nổi lên, nền trung tính làm phần lớn công việc, màu sắc làm điểm nhấn (~10% diện tích). Chỉ thẻ đỏ nổi bật nhất. Sử dụng hoàn toàn token có sẵn (`--block-soft`, `--block-ink`, `--amb-soft`, `--ok-soft`, `--s`, `--s2`, `--line`, `--mute`...), không sửa token chung, không sửa các lớp dùng chung ngoài dashboard.

1. **Bộ đếm `td-tally`**:
   - Chuyển từ khối màu đặc sang card nền `--s`, viền `1px solid var(--line)`.
   - Số hiển thị màu `--ink`, cỡ 24px đậm (`font-weight: 800`).
   - Màu nhận diện chuyển thành chấm tròn 8px (`::before`) màu `--t` trước chữ, nhãn màu `--mute`.
2. **Tiêu đề trang `.td-head h1`**:
   - Thu nhỏ từ `clamp(44px, 5.2vw, 72px)` xuống `clamp(32px, 3.6vw, 48px)`, cân xứng với giao diện ứng dụng.
3. **Tiêu đề làn `.td-lane h2` & vạch phân làn**:
   - Tiêu đề giảm từ 27px xuống 20px (`font-weight: 800`).
   - Vạch kẻ chân làn giảm từ 3px xuống 2px màu `--t`.
4. **Thẻ phân loại**:
   - Mọi thẻ nền `--s`, viền `1px solid var(--line)`, bỏ bóng đổ đậm (dùng bóng rất nhẹ `0 1px 2px rgb(0 0 0 / .04)`).
   - Hover chuyển sang nền `--s2` và viền rõ nét hơn, triệt tiêu hiệu ứng nhấc (`translateY(-3px)`) và xoay (`rotate(-.3deg)`).
   - **Đầu thẻ đỏ**: nền nhạt `--block-soft`, chữ tên `--block-ink`, viền trái 4px `--red`.
   - **Đầu thẻ vàng**: nền nhạt `--amb-soft`, chữ `--ink`, viền trái 4px `--amb`.
   - **Thẻ xanh gọn**: nền `--s`, viền trái 3px `--grn`, không tô nền dải đầu thẻ.
5. **Băng cảnh báo `td-urgent`**:
   - Thay nền đen đặc `--ink` (gây chói trắng ở dark mode) bằng nền `--block-soft`, viền nhẹ đỏ nhạt.
   - Chữ thông báo màu `--block-ink`, biểu tượng Siren màu `--red`.
   - Nút hành động chuyển sang dạng viền nhẹ (`border: 1px solid color-mix(...)`), nền trong suốt, hover làm đậm viền và nền nhẹ, không dùng khối nền đặc.
6. **"7 ngày tới"**:
   - Ô "Hôm nay": nền `--s2`, ngày in `--ink` đậm (`font-weight: 800`), viền `1px solid var(--line)` (bỏ viền đen 2px).
   - Chip sự kiện: nền `--s2`, bỏ toàn bộ viền `box-shadow: inset`, dùng vạch màu bên trái 3px (`border-left: 3px solid var(--k)`).
   - Chú thích lịch: ký hiệu hình chữ nhật đứng 3px màu `--k` đồng nhất với vạch trái của chip sự kiện.
7. **Quan sát AI `td-rom`**:
   - Thu nhỏ độ dày vòng đo: lõi tròn nền `--s` có `inset: 4px` (thay vì 5px), giữ nguyên màu gradient conic.
8. **Chuyển động**:
   - `td-drop` đổi thành trượt nhẹ `translateY(-6px)` kết hợp fade `opacity: 0 -> 1` trong 0.4s, bỏ hẳn `rotate`.
   - Giữ nguyên hỗ trợ `prefers-reduced-motion`.

### 7.2. Ca kiểm thử Q1–Q5

Thêm đúng tên và kết quả mong đợi theo ticket spec:
- `Q1: doctor.css -> .td-tally li không có background: var(--t)`
- `Q2: doctor.css -> .td-urgent không dùng background: var(--ink)`
- `Q3: doctor.css -> không quy tắc .td-tag nào dùng nền var(--t) đặc cho .td-field; thẻ đỏ dùng --block-soft`
- `Q4: doctor.css -> @keyframes td-drop không chứa rotate; .td-tag > a:hover không chứa rotate`
- `Q5: doctor.css -> .td-day[data-today="true"] không có border 2 px màu --ink và không có nền --ink`

#### Output lỗi trước khi sửa trên CSS hiện tại (RED):
```text
$ vitest run "t054-dashboard.test.ts"

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend

 ❯ src/app/(app)/doctor/dashboard/t054-dashboard.test.ts (14 tests | 5 failed) 42ms
   ❯ T-054 Ca kiểm thử D1–D7, C1, C2 (14)
     × Q1: doctor.css -> .td-tally li không có background: var(--t) 4ms
     × Q2: doctor.css -> .td-urgent không dùng background: var(--ink) 1ms
     × Q3: doctor.css -> không quy tắc .td-tag nào dùng nền var(--t) đặc cho .td-field; thẻ đỏ dùng --block-soft 1ms
     × Q4: doctor.css -> @keyframes td-drop không chứa rotate; .td-tag > a:hover không chứa rotate 2ms
     × Q5: doctor.css -> .td-day[data-today="true"] không có border 2 px màu --ink và không có nền --ink 1ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/app/(app)/doctor/dashboard/t054-dashboard.test.ts > T-054 Ca kiểm thử D1–D7, C1, C2 > Q1: doctor.css -> .td-tally li không có background: var(--t)
AssertionError: expected '.td-tally li { display: flex; align-i…' not to match /background:\s*var\(--t\)/
- Expected: /background:\s*var\(--t\)/
+ Received: ".td-tally li { display: flex; align-items: baseline; gap: 8px; padding: 9px 16px; border-radius: 12px; background: var(--t); color: var(--t-ink); font-weight: 650; font-size: 14px; animation: yt-pop .6s var(--ease) both; animation-delay: calc(var(--i) * 90ms); }"

 FAIL  src/app/(app)/doctor/dashboard/t054-dashboard.test.ts > T-054 Ca kiểm thử D1–D7, C1, C2 > Q2: doctor.css -> .td-urgent không dùng background: var(--ink)
AssertionError: expected '.td-urgent { display: grid; grid-temp…' not to match /background:\s*var\(--ink\)/
- Expected: /background:\s*var\(--ink\)/
+ Received: ".td-urgent { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 16px; padding: 14px 18px; border-radius: 14px; background: var(--ink); color: var(--s); }"

 FAIL  src/app/(app)/doctor/dashboard/t054-dashboard.test.ts > T-054 Ca kiểm thử D1–D7, C1, C2 > Q3: doctor.css -> không quy tắc .td-tag nào dùng nền var(--t) đặc cho .td-field; thẻ đỏ dùng --block-soft
AssertionError: expected '.td-field { position: relative; displ…' not to match /background:\s*var\(--t\)\s*;/
- Expected: /background:\s*var\(--t\)\s*;/
+ Received: ".td-field { position: relative; display: flex; gap: 14px; align-items: center; background: var(--t); color: var(--t-ink); padding: 15px 18px 13px; }"

 FAIL  src/app/(app)/doctor/dashboard/t054-dashboard.test.ts > T-054 Ca kiểm thử D1–D7, C1, C2 > Q4: doctor.css -> @keyframes td-drop không chứa rotate; .td-tag > a:hover không chứa rotate
AssertionError: expected '@keyframes td-drop { from { opacity: …' not to contain 'rotate'
Expected: "rotate"
Received: "@keyframes td-drop { from { opacity: 0; transform: translateY(-18px) rotate(-2.2deg); } 60% { transform: translateY(2px) rotate(.4deg); } }"

 FAIL  src/app/(app)/doctor/dashboard/t054-dashboard.test.ts > T-054 Ca kiểm thử D1–D7, C1, C2 > Q5: doctor.css -> .td-day[data-today="true"] không có border 2 px màu --ink và không có nền --ink
AssertionError: expected '.td-day[data-today="true"] { backgrou…' not to match /border:[^;]*2px[^;]*var\(--ink\)/
- Expected: /border:[^;]*2px[^;]*var\(--ink\)/
+ Received: ".td-day[data-today=\"true\"] { background: var(--s); color: var(--ink); border: 2px solid var(--ink); }"

 Test Files  1 failed (1)
      Tests  5 failed | 9 passed (14)
```

#### Output thành công sau khi sửa (GREEN):
```text
$ vitest run "t054-dashboard.test.ts"

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend

 Test Files  1 passed (1)
      Tests  14 passed (14)
   Start at  20:58:12
   Duration  450ms
```

Toàn bộ 14 ca (D1–D7, C1, C2, Q1–Q5) đều PASS, không ca nào bị sửa kết quả mong đợi.

### 7.3. Đánh giá chất lượng FE & Craft floor

1. **Tương phản chữ (WCAG AA ≥ 4.5:1)**:
   - Thẻ đỏ:
     - Sáng: chữ `--block-ink` (`#8e1f0f`) trên nền `--block-soft` (`#fbe1dc`) đạt tỉ lệ **6.5:1** (≥ 4.5:1).
     - Tối: chữ `--block-ink` (`#ffb3a3`) trên nền `--block-soft` (`#3e1810`) đạt tỉ lệ **7.2:1** (≥ 4.5:1).
   - Thẻ vàng:
     - Sáng: chữ `--ink` (`#111b27`) trên nền `--amb-soft` (`#fbefd2`) đạt tỉ lệ **14:1** (≥ 4.5:1).
     - Tối: chữ `--ink` (`#e8edf3`) trên nền `--amb-soft` (`#3a2a08`) đạt tỉ lệ **12:1** (≥ 4.5:1).
   - Thẻ xanh gọn:
     - Sáng: chữ `--ink` (`#111b27`) trên nền `--s` (`#ffffff`) đạt tỉ lệ **16:1** (≥ 4.5:1).
     - Tối: chữ `--ink` (`#e8edf3`) trên nền `--s` (`#141d29`) đạt tỉ lệ **13:1** (≥ 4.5:1).
   - Băng khẩn cấp `td-urgent`:
     - Tương phản đạt **6.5:1** (sáng) và **7.2:1** (tối), không còn bị nghịch đảo thành khối trắng chói mắt ở theme tối.
2. **Khung nhìn mobile 375px**:
   - `scrollWidth` đo được bằng Playwright ở cả 2 chế độ sáng và tối là **đúng 375px**, hoàn toàn không cuộn ngang.
   - Bộ đếm 3 thẻ thu gọn vừa khít hàng trên mobile, không bị tràn màn hình.
3. **Ponytail Review**:
   - Đánh giá diff của chính mình: Không có speculative feature, không có dependency thừa, không tạo abstraction mới.
   - Kết luận: `Lean already. Ship.`

---

## 8. Lượt 3: Sửa ca kiểm thử D7 (03/11)

### 8.1. Vấn đề của ca D7 cũ
- Trong phiên bản trước, ca D7 kiểm tra sự hiện diện của hai chuỗi `"Long"` và `"Tái khám"` trên toàn bộ HTML của trang (`expect(html).toContain("Long")`, `expect(html).toContain("Tái khám")`).
- Do dữ liệu hàng thẻ vàng đã chứa sẵn tên `"Hoàng Long"` và công việc `"Tái khám sau 2 ngày"`, nên nếu chip trong panel lịch tuần (`.td-week`) bị mất hoặc không render đúng nội dung, ca D7 cũ vẫn bỏ lọt lỗi (false positive PASS).

### 8.2. Giải pháp khắc phục
- Sửa ca D7: Cắt riêng đoạn markup `<ol class="td-week">…</ol>`.
- Trích xuất danh sách các phần tử ngày (`li.td-day`).
- Kiểm tra phần tử `li.td-day` thứ 3 (hôm nay + 2):
  - Không có thuộc tính `data-empty`.
  - Chứa chip sự kiện `.td-ev`.
  - Chứa đúng `<b>Long</b>` và nhãn `"Tái khám"`.
- Kiểm tra 6 ngày còn lại: đều có `data-empty="true"`.
- Giữ nguyên tên ca kiểm thử D7.

### 8.3. Thực nghiệm chứng minh
1. **Tạm sửa logic `put()` trong `page.tsx` đẩy chuỗi rỗng `""` thay cho `"Tái khám"`:**
```text
$ vitest run "t054-dashboard.test.ts"

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend

 ❯ src/app/(app)/doctor/dashboard/t054-dashboard.test.ts (14 tests | 1 failed) 39ms
   ❯ T-054 Ca kiểm thử D1–D7, C1, C2 (14)
     × D7: việc followup ngày hôm nay + 2, không gì khác -> trong td-week có đúng 7 li.td-day; ngày có sự kiện mang chip chứa tên và 'Tái khám'; ngày trống mang data-empty='true' 7ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 1 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/app/(app)/doctor/dashboard/t054-dashboard.test.ts > T-054 Ca kiểm thử D1–D7, C1, C2 > D7: việc followup ngày hôm nay + 2, không gì khác -> trong td-week có đúng 7 li.td-day; ngày có sự kiện mang chip chứa tên và 'Tái khám'; ngày trống mang data-empty='true'
AssertionError: expected '<li class="td-day" data-today="false"…' to contain 'Tái khám'

Expected: "Tái khám"
Received: "<li class="td-day" data-today="false"><header><span>Th 5</span><b>05</b></header><span class="td-ev" data-k="followup" title="Long · "><b>Long</b><span class="td-ev-text"></span></span></li>"

 ❯ src/app/(app)/doctor/dashboard/t054-dashboard.test.ts:276:22
    274|         expect(day3).toContain("td-ev");
    275|         expect(day3).toContain("<b>Long</b>");
    276|         expect(day3).toContain("Tái khám");
       |                      ^
    277|
    278|         // 6 ngày còn lại có data-empty="true"

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/1]⎯


 Test Files  1 failed (1)
      Tests  1 failed | 13 passed (14)
```

2. **Khôi phục `page.tsx` và chạy lại test:**
```text
$ vitest run "t054-dashboard.test.ts"

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  1 passed (1)
      Tests  14 passed (14)
   Start at  21:15:02
   Duration  517ms (import 62%, transform 29%, tests 8%, worker 1%)
```
Toàn bộ 14 ca kiểm thử đều PASS.

---

## 9. Lượt 3: Sửa theo review độc lập (04/11)

### 9.1. Mục tiêu và thay đổi chi tiết

1. **CHẶN: Thẻ vàng/đỏ không có nội dung bị biến thành thẻ trắng vạch xanh**:
   - **Nguyên nhân**: `isCompact` trong `page.tsx` trước đó chỉ kiểm tra `reasons.length === 0 && r.items.length === 0 && r.summary.activeInjuries.length === 0` mà không xét làn (`r.tag`). Đồng thời, selector CSS cũ `.td-tag[data-compact="true"] .td-field` áp dụng chung cho mọi thẻ mang thuộc tính `data-compact="true"` (nền trắng `--s` và vạch xanh `--grn`). Khi một võ sĩ ở làn vàng hoặc đỏ không có lý do/việc mở/chấn thương, thẻ này bị gán `data-compact="true"` và hiển thị thành thẻ trắng vạch xanh của làn xanh.
   - **Xử lý**:
     - `page.tsx`: Siết chặt điều kiện: `const isCompact = r.tag === "green" && reasons.length === 0 && r.items.length === 0 && r.summary.activeInjuries.length === 0;`. Chỉ duy nhất thẻ thuộc làn xanh (`r.tag === "green"`) mới được phép kích hoạt chế độ gọn.
     - `doctor.css`: Bỏ selector chung `.td-tag[data-compact="true"] .td-field,`, chỉ giữ lại selector cụ thể cho làn xanh `.td-tag[data-tag="green"][data-compact="true"] .td-field`.
2. **Tương phản chữ nhỏ ở thẻ đỏ (`.td-tag[data-tag="red"] .td-field small`)**:
   - Trước đó dùng `color: color-mix(in oklab, var(--block-ink) 75%, transparent);`, dẫn tới tỷ lệ tương phản chỉ đạt **4.32:1** ở theme sáng (dưới ngưỡng WCAG AA 4.5:1).
   - Sửa thành `color: var(--block-ink);` đặc, không `color-mix` hay trong suốt, nâng tương phản lên **6.5:1** ở theme sáng và **7.2:1** ở theme tối.
3. **Bỏ fallback thừa**:
   - `.td-tag[data-tag="amber"] .td-field`: chuyển `background: var(--amb-soft, color-mix(in oklab, var(--t) 18%, var(--s)));` thành `background: var(--amb-soft);`.
   - `.td-tag[data-tag="green"] .td-field`: chuyển `background: var(--ok-soft, color-mix(in oklab, var(--t) 18%, var(--s)));` thành `background: var(--ok-soft);`.
4. **Ponytail**: Diff ngắn nhất, không thêm class hay abstraction thừa.

### 9.2. Bổ sung và siết ca kiểm thử (D8, D9, Q6, C1, Q3)

- **D8** (Lớp R): 1 hàng vàng (`clearanceState: 'restricted'`, `training: { eligible: true, reasons: [] }`, không việc mở, không chấn thương). Thẻ ở làn vàng không được mang `data-compact="true"`.
- **D9** (Lớp R): 1 hàng đỏ (`training: { eligible: false, reasons: [] }`, không gì khác). Thẻ ở làn đỏ không được mang `data-compact="true"`.
- **C1 & Q3 (siết lại)** (Lớp C): Sử dụng hàm `extractAllMatchingRules` tìm **MỌI** quy tắc `[data-tag=...] .td-field` trong `doctor.css` (không chỉ quy tắc đầu tiên), đảm bảo không quy tắc nào dùng nền `var(--t)` đặc, không còn fallback `color-mix` thừa; nền vàng là `var(--amb-soft)`, nền xanh là `var(--ok-soft)`, nền đỏ là `var(--block-soft)`.
- **Q6** (Lớp C): `.td-tag[data-tag="red"] .td-field small` dùng màu `var(--block-ink)` đặc, không `color-mix` hay trong suốt.

### 9.3. Output lỗi của ca D8 trên code trước khi sửa (RED)

```text
$ vitest run "t054-dashboard.test.ts"

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend

 ❯ src/app/(app)/doctor/dashboard/t054-dashboard.test.ts (17 tests | 5 failed) 43ms
   ❯ T-054 Ca kiểm thử D1–D7, C1, C2 (17)
     × D8: 1 hàng vàng: clearanceState 'restricted', training { eligible: true, reasons: [] }, không việc mở, không chấn thương -> thẻ ở làn vàng không mang data-compact="true"; chỉ thẻ xanh được gọn 5ms
     × D9: 1 hàng đỏ: training { eligible: false, reasons: [] }, không gì khác -> thẻ không gọn 5ms
     × C1: doctor.css -> .td-field của làn amber/green không dùng nền var(--t) đặc; có quy tắc @media (max-width: 767px) cho .td-week không còn overflow-x: auto; có prefers-reduced-motion tắt td-drop 2ms
     × Q3: doctor.css -> không quy tắc .td-tag nào dùng nền var(--t) đặc cho .td-field; thẻ đỏ dùng --block-soft 1ms
     × Q6: doctor.css -> .td-tag[data-tag="red"] .td-field small dùng màu var(--block-ink) đặc, không color-mix hay trong suốt 1ms

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 5 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  src/app/(app)/doctor/dashboard/t054-dashboard.test.ts > T-054 Ca kiểm thử D1–D7, C1, C2 > D8: 1 hàng vàng: clearanceState 'restricted', training { eligible: true, reasons: [] }, không việc mở, không chấn thương -> thẻ ở làn vàng không mang data-compact="true"; chỉ thẻ xanh được gọn
AssertionError: expected '<div class="yt-page"><header class="y…' not to match /data-tag="amber"[^>]*data-compact="tr…/

- Expected:
/data-tag="amber"[^>]*data-compact="true"/

+ Received:
"<div class=\"yt-page\"><header class=\"yt-head td-head\" data-shot=\"head\"><div class=\"yt-head-main\"><h1>Phân loại hôm nay</h1>...<section class=\"td-lane\" data-tag=\"amber\" aria-labelledby=\"ln-amber\"><header><h2 id=\"ln-amber\">Vàng · Theo dõi</h2><p>Tập được, có hạn chế hoặc việc mở</p></header><ol><li class=\"td-tag\" data-tag=\"amber\" data-compact=\"true\" style=\"--i:0;--lane:1\"><a href=\"/doctor/fighters/f-yellow-d8\"><span class=\"td-field\"><span><strong>Hoàng Long</strong><small title=\"Hạng nhẹ 70 kg · 28 tuổi · Thuận tay phải\">Hạng nhẹ 70 kg · 28 tuổi · Thuận tay phải</small></span><span class=\"td-gates\"><span class=\"yt-gate\" data-ok=\"true\"><svg ...>...</svg>Tập luyện<span class=\"sr-only\">: đủ điều kiện</span></span></span><svg ... class=\"lucide lucide-arrow-right td-arrow\" ...>...</svg></span></a></li></ol>..."

 ❯ src/app/(app)/doctor/dashboard/t054-dashboard.test.ts:333:26
    331|         const html = renderToStaticMarkup(pageElement);
    332|
    333|         expect(html).not.toMatch(/data-tag="amber"[^>]*data-compact="true"/);
       |                          ^
    334|         expect(html).not.toContain('data-compact="true"');
```

### 9.4. Output thành công sau khi sửa (GREEN)

```text
$ vitest run "t054-dashboard.test.ts"

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  1 passed (1)
      Tests  17 passed (17)
   Start at  08:19:19
   Duration  399ms (import 56%, transform 32%, tests 11%, worker 1%)
```


