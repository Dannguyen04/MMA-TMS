# Biên bản bàn giao T-057: Bảng phân loại của bác sĩ tính đình chỉ

## 1. Danh sách tệp thay đổi

- `nextjs-frontend/src/lib/services/doctor-board.ts`:
  - Thêm `BoardItemKind` mới `"suspension"`.
  - Thêm interface `SuspensionBoardInput` và map nhãn tiếng Việt `REASON_LABELS` (kế thừa từ `SUSPENSION_REASON_LABELS`).
  - Xuất khẩu hàm thuần `suspensionBoardState(suspensions, today)` để phân loại tag đỏ/vàng/null và tạo dòng việc `item: { text, date }`.
  - Cập nhật và xuất khẩu `triageOf` nhận thêm `suspensions` và `today`, ưu tiên thẻ đỏ do đình chỉ (`REHAB_TRIGGER_SUSPENSION_REASONS`), sau đó đến lý do y tế/tập luyện, thẻ vàng đình chỉ/hạn chế/việc mở, và cuối cùng là xanh.
  - Cập nhật `loadRow` gọi `suspensionBoardState` và đưa việc đình chỉ vào `items`.
  - Cập nhật `loadDoctorBoard` đọc đình chỉ qua một lần gọi `nullIfServiceFails(listSuspensions(suspensionFilter, user))` và gom theo võ sĩ.
  - Cập nhật `loadDoctorRow` đọc đình chỉ của võ sĩ qua `nullIfServiceFails(listSuspensions({ fighterIds: [fighter.id] }))`.
- `nextjs-frontend/src/app/(app)/doctor/dashboard/page.tsx`:
  - Nhập biểu tượng `Ban` từ `lucide-react` gán cho `ICON.suspension`.
  - Cập nhật khối "7 ngày tới" hiển thị chip "Hết đình chỉ" (hoặc "Hết lộ trình tập lại" khi tập lại theo bậc) ở đúng ngày `date`.
  - Bổ sung chú thích "Hết đình chỉ" vào `td-weeklegend`.
- `nextjs-frontend/src/components/doctor/doctor.css`:
  - Thêm quy tắc màu biểu tượng việc đình chỉ: `.td-items li[data-k="suspension"] svg { color: var(--red); }`.
  - Thêm quy tắc màu viền chip lịch 7 ngày: `.td-ev[data-k="suspension"] { border-left-color: var(--red); }`.
- `nextjs-frontend/src/app/(app)/doctor/dashboard/t057-doctor-board-suspensions.test.ts`:
  - Tệp kiểm thử mới chứa đầy đủ 17 ca kiểm thử theo đúng mã ca: S1–S8, B1–B5, R1–R3, K1.

---

## 2. Ánh xạ các ca kiểm thử (S1–S8, B1–B5, R1–R3, K1)

| Ca | Lớp | Tên ca kiểm thử trong mã nguồn |
| --- | --- | --- |
| S1 | S | `S1: MEDICAL startsOn 11-05, endsOn 11-18, requiresClearance false, maxAllowedTier 1 -> tag 'red'; item.date '2026-11-18'; item.text chứa 'Y tế', '18/11' và 'bậc 1'` |
| S2 | S | `S2: KO endsOn 11-03, requiresClearance true, chưa xác nhận (AWAITING_CLEARANCE) -> tag 'red'; item.text chứa 'chờ xác nhận'` |
| S3 | S | `S3: MANDATORY_REST startsOn 11-04, endsOn 11-10 -> tag 'amber'; item khác null` |
| S4 | S | `S4: DQ đã hết hạn (endsOn 11-01, requiresClearance false) -> tag null, item null` |
| S5 | S | `S5: KO đã ENDED, gradedReturn { ceiling 3, fullReturnOn 11-07 } -> tag 'amber'; item.text chứa 'tập lại theo bậc' và 'bậc 3'` |
| S6 | S | `S6: KO đã ENDED, fullReturnOn 11-04 (đã qua) -> tag null, item null` |
| S7 | S | `S7: hai đình chỉ còn hiệu lực: MANDATORY_REST endsOn 11-20 và MEDICAL endsOn 11-12 -> tag 'red'; item.date '2026-11-12' (đình chỉ MEDICAL thuộc nhóm đỏ nên được chọn, dù MANDATORY_REST kết thúc muộn hơn)` |
| S8 | S | `S8: mảng rỗng -> tag null, item null` |
| B1 | B | `B1: Hoàng Long (f-hoang-long), seed demo, bác sĩ Thu -> row.tag 'red'; row.items có một dòng kind 'suspension'` |
| B2 | B | `B2: Sofia (f-sofia-kowalski), seed demo -> row.tag 'red'` |
| B3 | B | `B3: Linh (f-linh-pham), seed demo (KO đã xác nhận, tập lại bậc 3) -> row.tag không phải 'green'` |
| B4 | B | `B4: Emma (f-emma-lindqvist), không có đình chỉ -> row.tag như trước ticket này (không đổi); row.items không có dòng suspension` |
| B5 | B | `B5: một võ sĩ thuộc phạm vi Thu không có đình chỉ nào -> Kết quả tag đúng như triageOf cũ cho võ sĩ đó` |
| R1 | R | `R1: dashboard với một hàng đỏ có dòng suspension -> Thẻ nằm trong làn đỏ, hiện chữ dòng việc, không có data-compact='true'` |
| R2 | R | `R2: dashboard với một hàng xanh có dòng suspension (dựng bằng tay, trường hợp không xảy ra nhưng không được thu gọn) -> Không có data-compact='true'` |
| R3 | R | `R3: dashboard với dòng suspension có date trong 7 ngày -> Chip 'Hết đình chỉ' trong khối td-week ở đúng ngày` |
| K1 | B | `K1: test T-054, T-055, T-056 và integrity -> Vẫn qua` |

---

## 3. Kết quả tái hiện lỗi trước khi sửa (Fail) và sau khi sửa (Pass)

### 3.1. Kết quả chạy kiểm thử trên mã nguồn ban đầu (15 ca thất bại)

```
$ vitest run "src/app/(app)/doctor/dashboard/t057-doctor-board-suspensions.test.ts"

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend

 ❯ src/app/(app)/doctor/dashboard/t057-doctor-board-suspensions.test.ts (17 tests | 15 failed) 3605ms
   ❯ T-057: Bảng phân loại của bác sĩ phải tính đình chỉ (17)
     × S1: MEDICAL startsOn 11-05, endsOn 11-18, requiresClearance false, maxAllowedTier 1 -> tag 'red'; item.date '2026-11-18'; item.text chứa 'Y tế', '18/11' và 'bậc 1' 3ms
     × S2: KO endsOn 11-03, requiresClearance true, chưa xác nhận (AWAITING_CLEARANCE) -> tag 'red'; item.text chứa 'chờ xác nhận' 0ms
     × S3: MANDATORY_REST startsOn 11-04, endsOn 11-10 -> tag 'amber'; item khác null 0ms
     × S4: DQ đã hết hạn (endsOn 11-01, requiresClearance false) -> tag null, item null 0ms
     × S5: KO đã ENDED, gradedReturn { ceiling 3, fullReturnOn 11-07 } -> tag 'amber'; item.text chứa 'tập lại theo bậc' và 'bậc 3' 0ms
     × S6: KO đã ENDED, fullReturnOn 11-04 (đã qua) -> tag null, item null 0ms
     × S7: hai đình chỉ còn hiệu lực: MANDATORY_REST endsOn 11-20 và MEDICAL endsOn 11-12 -> tag 'red'; item.date '2026-11-12' (đình chỉ MEDICAL thuộc nhóm đỏ nên được chọn, dù MANDATORY_REST kết thúc muộn hơn) 0ms
     × S8: mảng rỗng -> tag null, item null 0ms
     × B1: Hoàng Long (f-hoang-long), seed demo, bác sĩ Thu -> row.tag 'red'; row.items có một dòng kind 'suspension' 759ms
     × B3: Linh (f-linh-pham), seed demo (KO đã xác nhận, tập lại bậc 3) -> row.tag không phải 'green' 434ms
     × B5: một võ sĩ thuộc phạm vi Thu không có đình chỉ nào -> Kết quả tag đúng như triageOf cũ cho võ sĩ đó 471ms
     × R1: dashboard với một hàng đỏ có dòng suspension -> Thẻ nằm trong làn đỏ, hiện chữ dòng việc, không có data-compact='true' 154ms
     × R2: dashboard với một hàng xanh có dòng suspension (dựng bằng tay, trường hợp không xảy ra nhưng không được thu gọn) -> Không có data-compact='true' 179ms
     × R3: dashboard với dòng suspension có date trong 7 ngày -> Chip 'Hết đình chỉ' trong khối td-week ở đúng ngày 232ms
     × K1: test T-054, T-055, T-056 và integrity -> Vẫn qua 439ms

 Test Files  1 failed (1)
      Tests  15 failed | 2 passed (17)
```

### 3.2. Kết quả chạy kiểm thử sau khi hoàn thiện (17 ca đều đỗ)

```
$ vitest run "src/app/(app)/doctor/dashboard/t057-doctor-board-suspensions.test.ts"

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend

 Test Files  1 passed (1)
      Tests  17 passed (17)
   Start at  09:54:00
   Duration  4.37s (tests 80%, transform 11%, import 9%)
```

---

## 4. Các test hiện có thay đổi và lý do

Không có bài test hiện có nào bị sửa. Toàn bộ các bộ test hiện có (bao gồm T-054, T-055, T-056 và `integrity.test.ts`) đều vượt qua 100% mà không cần sửa đổi bất kỳ tệp hay kỳ vọng nào.

---

## 5. Sự thay đổi các làn của võ sĩ demo (phạm vi bác sĩ Thu)

Theo kết quả suy luận từ các ca kiểm thử B1–B5 trên dữ liệu demo:

- **Hoàng Long (`f-hoang-long`)**: Chuyển từ làn **Xanh · Thông** sang làn **Đỏ · Chặn** do có đình chỉ `MEDICAL` cấp CLB còn hiệu lực (`startsOn: today`, `endsOn: today + 13`). Thẻ của Hoàng Long có thêm dòng việc loại `"suspension"`: `Đình chỉ Y tế đến dd/MM · tối đa bậc 1`.
- **Sofia Kowalski (`f-sofia-kowalski`)**: Nằm ở làn **Đỏ · Chặn** do có đình chỉ `MEDICAL` cấp CLB còn hiệu lực (`startsOn: today`, `endsOn: today + 14`).
- **Linh Phạm (`f-linh-pham`)**: Chuyển từ làn **Xanh · Thông** sang làn **Vàng · Theo dõi** do có đình chỉ KO đã kết thúc nhưng đang trong lộ trình tập lại theo bậc (`gradedReturn.ceiling = 3`, `fullReturnOn = today + 2 >= today`).
- **Emma Lindqvist (`f-emma-lindqvist`)**: Giữ nguyên ở làn **Xanh · Thông** vì không có đình chỉ nào và không có việc y tế mở. Thẻ của Emma tiếp tục được thu gọn (`data-compact="true"`).

---

## 6. Kết quả chạy các lệnh nghiệm thu

Tổng số kiểm thử trước khi triển khai: **1202 passed**.
Tổng số kiểm thử sau khi triển khai: **1219 passed** (+17 tests mới).

### 6.1. `pnpm --filter nextjs-frontend lint`

```
$ eslint
(Exit code: 0 - Clean, không có lỗi hay cảnh báo)
```

### 6.2. `pnpm --filter nextjs-frontend typecheck`

```
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```

### 6.3. `pnpm --filter nextjs-frontend test` (Lần chạy 1)

```
$ vitest run

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend

 Test Files  122 passed | 1 skipped (123)
      Tests  1219 passed | 2 skipped (1221)
   Start at  09:57:31
   Duration  5.44s (import 49%, transform 25%, tests 25%, worker 1%)

     Import  440 modules were evaluated 3157 times · 32.40s total, 49% of tracked time
             ~440ms faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation
```

### 6.4. `pnpm --filter nextjs-frontend test` (Lần chạy 2)

```
$ vitest run

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend

 Test Files  122 passed | 1 skipped (123)
      Tests  1219 passed | 2 skipped (1221)
   Start at  09:57:55
   Duration  5.25s (import 49%, transform 26%, tests 24%, worker 1%)

     Import  440 modules were evaluated 3188 times · 32.15s total, 49% of tracked time
             ~452ms faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation
```

---

## 7. Câu hỏi

Không có


---

# Lượt sửa 1 (05/11/2026, sau review độc lập lượt 1)

## 1. Nội dung thay đổi trong Lượt sửa 1

1. **Thêm cờ `graded?: true` vào `BoardItem` và dùng cờ thay vì dò chuỗi:**
   - Trong `nextjs-frontend/src/lib/services/doctor-board.ts`: bổ sung thuộc tính tùy chọn `graded?: true` vào `BoardItem`. Trong hàm `suspensionBoardState`, khi xử lý lộ trình tập lại theo bậc (`gradedAmber`), trả về `{ ..., graded: true }`. Trong `loadRow`, sao chép cờ này vào dòng việc `kind: "suspension"`.
   - Trong `nextjs-frontend/src/app/(app)/doctor/dashboard/page.tsx`: khối 7 ngày đọc trực tiếp `x.graded ? "Hết lộ trình tập lại" : "Hết đình chỉ"` thay vì dùng chuỗi dò `x.text.includes("tập lại")`.
2. **Dọn dẹp code thừa (Ponytail review):**
   - Xóa thuộc tính thừa `status` khỏi interface `SuspensionBoardInput` (không dùng).
   - Xóa nhánh thừa `susp.tag === "amber"` trong `triageOf` vì sự hiện diện của dòng việc `suspension` trong `items` đã tự động đưa trạng thái về vàng qua điều kiện `items.length > 0`. `triageOf` chỉ cần kiểm tra xem đình chỉ có kích hoạt thẻ đỏ hay không (`suspensionBoardState(...).tag === "red"`).
3. **Cập nhật và bổ sung đầy đủ các ca kiểm thử tái hiện đột biến (tổng 24 ca):**
   - **B2 (sửa):** Kiểm tra `row.tag === "red"` và `row.items` phải có dòng `kind === "suspension"` chứa `"Y tế"`.
   - **B3 (sửa):** Kiểm tra `row.tag !== "green"` và phải có dòng `kind === "suspension"` chứa `"tập lại theo bậc"`.
   - **S5 (sửa):** Bổ sung kiểm tra `item.date === "2026-11-06"` (lùi 1 ngày so với `fullReturnOn: 2026-11-07`).
   - **S9:** Hai đình chỉ còn hiệu lực nhóm đỏ (`endsOn: 11-12` và `11-20`) -> chọn `endsOn` muộn nhất (`2026-11-20`).
   - **S10:** Hai đình chỉ còn hiệu lực nhóm vàng (`endsOn: 11-10` và `11-15`) -> chọn `endsOn` muộn nhất (`2026-11-15`).
   - **S11:** Lý do `TKO` kích hoạt thẻ đỏ (`tag: "red"`).
   - **S12:** Biên `fullReturnOn === today` (`2026-11-05`) -> `tag: "amber"`, `item.date: "2026-11-04"`.
   - **S13:** Lấy bậc từ dữ liệu: kiểm tra bậc 2 cho cả đình chỉ đang hiệu lực và lộ trình tập lại theo bậc (không bị hardcode bậc 3 hay mặc định sai).
   - **B6:** Mô phỏng `listSuspensions` ném `ApiError` 503 trong `loadDoctorBoard` -> bảng vẫn hoạt động bình thường, trả đủ hàng, không dòng nào có `kind === "suspension"`, không sập trang.
   - **R4:** Render dashboard kiểm tra dòng `suspension` có `graded: true` hiện đúng chip "Hết lộ trình tập lại", và dòng không có `graded` hiện đúng chip "Hết đình chỉ".
   - **K2:** Đổi mã ca kiểm thử `loadDoctorRow` Hoàng Long từ K1 thành K2 (giữ K1 để biểu thị toàn bộ test suite cũ đều pass).

---

## 2. Kết quả tái hiện trước khi sửa và sau khi sửa

### 2.1. Ca B2 (sửa) trên code cũ trước T-057 (Thất bại do thiếu dòng việc đình chỉ)
Trên code cũ trước T-057, Sofia vốn có yêu cầu khám mở nên thẻ đã đỏ sẵn, nhưng không có dòng việc `suspension`:
```
FAIL src/app/(app)/doctor/dashboard/t057-doctor-board-suspensions.test.ts > T-057: Bảng phân loại của bác sĩ phải tính đình chỉ > B2 (sửa): Sofia (f-sofia-kowalski), seed demo -> row.tag 'red' và row.items có dòng kind 'suspension' chứa 'Y tế'
AssertionError: expected undefined to be defined
 ❯ src/app/(app)/doctor/dashboard/t057-doctor-board-suspensions.test.ts:382:31
    380|         const suspItem = sofiaRow.items.find((x) => x.kind === "suspension");
    381|         expect(suspItem).toBeDefined();
```

### 2.2. Ca R4 khi chưa dùng cờ `graded` (Thất bại do sai nhãn chip)
Khi chưa có cờ `graded` hoặc chip bị đổi thành "Hết đình chỉ" cho mọi dòng:
```
FAIL src/app/(app)/doctor/dashboard/t057-doctor-board-suspensions.test.ts > T-057: Bảng phân loại của bác sĩ phải tính đình chỉ > R4: dashboard với dòng suspension có graded true và date trong 7 ngày -> khối td-week chứa 'Hết lộ trình tập lại' tại ngày đó; dòng không có graded thì chứa 'Hết đình chỉ'
AssertionError: expected '<li class="td-day" data-today="false"…' to contain 'Hết lộ trình tập lại'

Expected: "Hết lộ trình tập lại"
Received: "<li class="td-day" data-today="false"><header><span>Th 6</span><b>06</b></header><span class="td-ev" data-k="suspension" title="Phạm · Hết đình chỉ"><b>Phạm</b><span class="td-ev-text">Hết đình chỉ</span></span><span class="td-ev" data-k="milestone" title=" · Vận động ưa khí nhẹ"><b></b><span class="td-ev-text">Vận động ưa khí nhẹ</span></span></li>"
 ❯ src/app/(app)/doctor/dashboard/t057-doctor-board-suspensions.test.ts:527:22
```

### 2.3. Toàn bộ 24 ca kiểm thử sau khi hoàn thiện Lượt sửa 1 (Đều đỗ)
```
$ vitest run "src/app/(app)/doctor/dashboard/t057-doctor-board-suspensions.test.ts"

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  1 passed (1)
      Tests  24 passed (24)
   Start at  10:27:23
   Duration  5.06s (tests 84%, transform 10%, import 6%)
```

---

## 3. Bảng kết quả kiểm tra 7 đột biến (a)–(g)

Mỗi đột biến đã được áp dụng tạm thời trên bản sao/code, chạy kiểm thử để xác định ca bắt được, sau đó hoàn nguyên hoàn toàn:

| Đột biến | Nội dung đột biến | Ca kiểm thử bắt được | Chi tiết lỗi quan sát được khi áp đột biến |
| --- | --- | --- | --- |
| **(a)** | Sắp xếp `endsOn` sớm nhất thay vì muộn nhất | **S9, S10** | S9: mong đợi `'2026-11-20'`, nhận `'2026-11-12'`.<br>S10: mong đợi `'2026-11-15'`, nhận `'2026-11-10'`. |
| **(b)** | `fullReturnOn > today` thay vì `>=` | **S12** | S12: khi `fullReturnOn === today`, trả về `tag: null` thay vì `tag: "amber"`. |
| **(c)** | Bỏ `-1` ở ngày lộ trình (`untilDate = fullReturnOn`) | **S5 (sửa), S12, S13** | S5 (sửa): mong đợi `'2026-11-06'`, nhận `'2026-11-07'`.<br>S12: mong đợi `'2026-11-04'`, nhận `'2026-11-05'`.<br>S13: mong đợi `'2026-11-06'`, nhận `'2026-11-07'`. |
| **(d)** | TKO không đỏ (bỏ `TKO` khỏi danh sách kích hoạt đỏ) | **S11** | S11: mong đợi `'red'`, nhận `'amber'`. |
| **(e)** | Bỏ `nullIfServiceFails` ở `loadDoctorBoard` | **B6** | B6: `loadDoctorBoard` văng ngoại lệ `ApiError: Service unavailable` thay vì trả về danh sách hàng an toàn. |
| **(f)** | Chữ chip lộ trình đổi thành "Hết đình chỉ" | **R4** | R4: mong đợi khối ngày chứa `'Hết lộ trình tập lại'`, nhận `'Hết đình chỉ'`. |
| **(g)** | Hardcode "bậc 3" hoặc mặc định bậc 2 | **S13, S5 (sửa)** | - Hardcode "bậc 3": **S13** bắt được (mong đợi chứa `'bậc 2'`, nhận `'bậc 3'`).<br>- Hardcode/mặc định "bậc 2": **S5 (sửa)** bắt được (mong đợi chứa `'bậc 3'`, nhận `'bậc 2'`). |

---

## 4. Tự đánh giá theo nguyên tắc Ponytail (Lean code review)

- **Độ tinh giản của trừu tượng hóa:** Chỉ có đúng một hàm thuần duy nhất được xuất khẩu là `suspensionBoardState(suspensions, today)`. Không tạo thêm class, helper layer hay wrapper không cần thiết.
- **Tái sử dụng domain logic hiện có:** Tái sử dụng `isInForceOn`, `academyDateOf`, `addDaysToDate`, `REHAB_TRIGGER_SUSPENSION_REASONS`, `SUSPENSION_REASON_LABELS`, `formatShortDate`.
- **Cắt giảm mã dư thừa:**
  - Xóa trường `status` thừa trong `SuspensionBoardInput`.
  - Loại bỏ điều kiện rẽ nhánh dư thừa `susp.tag === "amber"` trong `triageOf`.
  - Thay thế chuỗi dò bằng cờ boolean `graded?: true` chuẩn xác và tường minh.
- **Khả năng cách ly lỗi:** Bọc lệnh đọc `listSuspensions` bằng `nullIfServiceFails` đảm bảo doctor board không bao giờ sập khi dịch vụ đình chỉ gặp sự cố.

---

## 5. Kết quả chạy các lệnh nghiệm thu

Tổng số kiểm thử trước T-057: **1202 passed**.
Tổng số kiểm thử sau Lượt 0: **1219 passed**.
Tổng số kiểm thử sau Lượt sửa 1: **1226 passed** (+7 tests so với Lượt 0; tổng cộng 24 tests trong tệp `t057-doctor-board-suspensions.test.ts`).

### 5.1. `pnpm --filter nextjs-frontend lint`
```
$ eslint
(Exit code: 0 - Clean, không có lỗi hay cảnh báo)
```

### 5.2. `pnpm --filter nextjs-frontend typecheck`
```
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```

### 5.3. `pnpm --filter nextjs-frontend test` (Lần chạy 1)
```
$ vitest run

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  122 passed | 1 skipped (123)
      Tests  1226 passed | 2 skipped (1228)
   Start at  10:28:24
   Duration  6.52s (import 43%, transform 29%, tests 27%, worker 1%)
```

### 5.4. `pnpm --filter nextjs-frontend test` (Lần chạy 2)
```
$ vitest run

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  122 passed | 1 skipped (123)
      Tests  1226 passed | 2 skipped (1228)
   Start at  10:28:36
   Duration  6.17s (import 44%, transform 28%, tests 27%, worker 1%)
```

---

## 6. Câu hỏi

Không có.


---

# Lượt sửa 2 (05/11/2026, test-only vá đột biến)

## 1. Nội dung thay đổi trong Lượt sửa 2

Chỉ sửa duy nhất tệp kiểm thử `nextjs-frontend/src/app/(app)/doctor/dashboard/t057-doctor-board-suspensions.test.ts` (không sửa bất kỳ dòng mã production nào):

1. **Thêm các điểm kiểm tra cờ `graded` vào các ca có sẵn:**
   - **S1 (thêm kiểm):** `expect(res.item?.graded).toBeUndefined()` — kiểm tra đình chỉ y tế đang hiệu lực không được gắn cờ `graded`.
   - **S5 (thêm kiểm):** `expect(res.item?.graded).toBe(true)` — kiểm tra lộ trình tập lại theo bậc bắt buộc phải có `graded: true`.
   - **B1 (thêm kiểm):** `expect(suspItems[0]?.graded).toBeUndefined()` — kiểm tra dòng việc đình chỉ của Hoàng Long trên dữ liệu thật không có `graded`.
   - **B3 (thêm kiểm):** `expect(suspItem?.graded).toBe(true)` — kiểm tra dòng việc của Linh trên dữ liệu thật (đang trong lộ trình tập lại theo bậc) có `graded: true`.
2. **Bổ sung ca kiểm thử B7:**
   - **B7:** `listSuspensions bị làm lỗi (ném ApiError 503) trong lúc gọi loadDoctorRow cho Hoàng Long, seed demo -> không ném lỗi; trả về hàng không có dòng kind 'suspension'`. Đảm bảo trang chi tiết hồ sơ võ sĩ không bao giờ sập khi dịch vụ đình chỉ gặp sự cố.

---

## 2. Bằng chứng đột biến (Mutation proof)

Đã áp dụng từng đột biến tạm thời trên `doctor-board.ts`, xác nhận kiểm thử thất bại, sau đó hoàn nguyên hoàn toàn bằng bản sao lưu (xác minh bằng lệnh so sánh `fc.exe` không có sai khác):

### 2.1. Đột biến 1: `loadRow` thay `...(susp.item.graded ? { graded: true } : {})` bằng `graded: true`
- **Ca bắt được:** **B1** (Hoàng Long)
- **Kết quả thất bại:**
```
FAIL src/app/(app)/doctor/dashboard/t057-doctor-board-suspensions.test.ts > T-057: Bảng phân loại của bác sĩ phải tính đình chỉ > B1: Hoàng Long (f-hoang-long), seed demo, bác sĩ Thu -> row.tag 'red'; row.items có một dòng kind 'suspension'
AssertionError: expected true to be undefined

- Expected:
undefined

+ Received:
true

 ❯ src/app/(app)/doctor/dashboard/t057-doctor-board-suspensions.test.ts:369:38
    367|         const suspItems = hoangRow.items.filter((item) => item.kind ==…
    368|         expect(suspItems).toHaveLength(1);
    369|         expect(suspItems[0]?.graded).toBeUndefined();
```

### 2.2. Đột biến 2: Bỏ `nullIfServiceFails` trong `loadDoctorRow`
- **Ca bắt được:** **B7**
- **Kết quả thất bại:**
```
FAIL src/app/(app)/doctor/dashboard/t057-doctor-board-suspensions.test.ts > T-057: Bảng phân loại của bác sĩ phải tính đình chỉ > B7: listSuspensions bị làm lỗi (ném ApiError 503) trong lúc gọi loadDoctorRow cho Hoàng Long, seed demo -> không ném lỗi; trả về hàng không có dòng kind 'suspension'
ApiError: Service unavailable
 ❯ src/app/(app)/doctor/dashboard/t057-doctor-board-suspensions.test.ts:430:13
    428|         const suspensionsModule = await import("@/lib/services/suspens…
    429|         const spy = vi.spyOn(suspensionsModule, "listSuspensions").moc…
    430|             new ApiError({ message: "Service unavailable", kind: "http…
```

---

## 3. Kết quả chạy các lệnh nghiệm thu

Tổng số kiểm thử trước T-057: **1202 passed**.
Tổng số kiểm thử sau Lượt 0: **1219 passed**.
Tổng số kiểm thử sau Lượt sửa 1: **1226 passed**.
Tổng số kiểm thử sau Lượt sửa 2: **1227 passed** (+1 test B7; tổng cộng 25 tests trong tệp `t057-doctor-board-suspensions.test.ts`).

### 3.1. `pnpm --filter nextjs-frontend lint`
```
$ eslint
(Exit code: 0 - Clean, không có lỗi hay cảnh báo)
```

### 3.2. `pnpm --filter nextjs-frontend typecheck`
```
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```

### 3.3. `pnpm --filter nextjs-frontend test` (Lần chạy 1)
```
$ vitest run

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  122 passed | 1 skipped (123)
      Tests  1227 passed | 2 skipped (1229)
   Start at  10:55:49
   Duration  6.67s (import 43%, transform 28%, tests 28%, worker 1%)
```

### 3.4. `pnpm --filter nextjs-frontend test` (Lần chạy 2)
```
$ vitest run

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  122 passed | 1 skipped (123)
      Tests  1227 passed | 2 skipped (1229)
   Start at  10:56:00
   Duration  6.38s (import 43%, transform 29%, tests 27%, worker 1%)
```

---

## 4. Câu hỏi

Không có.
