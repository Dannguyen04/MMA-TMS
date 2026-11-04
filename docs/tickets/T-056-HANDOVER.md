# T-056 HANDOVER: Dữ liệu demo đủ các tình huống đình chỉ

- Ngày thực hiện: 04/11/2026
- Nhánh: `User_Feature`
- Trạng thái: HOÀN THÀNH

---

## 1. Các file đã thay đổi

| File | Thay đổi chính |
| --- | --- |
| `nextjs-frontend/src/lib/mocks/people.ts` | Cập nhật phân công hai chiều: thêm Hoàng Long, Bảo Nguyễn, Sofia vào HLV Rafael; thêm Sofia vào bác sĩ Thu. |
| `nextjs-frontend/src/lib/mocks/medical.ts` | Thêm phiếu khám S6 (`ex-hoang-early-end-0d`), phiếu khám H1 (`ex-marcus-early-end-111d`), và danh sách seed `mockMedicalReviewRequests` (yêu cầu khám S8 cho Sofia). |
| `nextjs-frontend/src/lib/mocks/db.ts` | Import và khởi tạo `medicalReviewRequests` từ `mockMedicalReviewRequests`. |
| `nextjs-frontend/src/lib/mocks/suspensions.ts` | Thêm 6 dòng đình chỉ S6, S7, S8, H1, H2, H3 vào `buildMockSuspensions()`, cập nhật comment mô tả các tình huống. |
| `nextjs-frontend/src/lib/mocks/t056-demo-suspensions.test.ts` | **(Mới)** 17 ca kiểm thử bao quát từ M1 đến M16 và K1. |
| `nextjs-frontend/src/app/(app)/coach/bouts/readiness/readiness-page.test.ts` | Điều chỉnh kiểm tra số lượng võ sĩ roster Rafael (8 -> 11) và sửa chú thích theo K1. |
| `nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts` | Điều chỉnh số đếm đình chỉ của Rafael (4 -> 10, đang hiệu lực = 5, đã hết = 3), cập nhật ca empty state và sửa chú thích theo K1. |

---

## 2. Chi tiết các dòng và phân công đã thêm

### 2.1. Phân công (`people.ts`)
- **HLV Rafael Costa (`c-rafael-costa`)**: Thêm 3 võ sĩ vào `fighterIds`: `f-hoang-long`, `f-bao-nguyen`, `f-sofia-kowalski`.
- **Võ sĩ**:
  - `f-hoang-long` (Hoàng Long): Thêm `c-rafael-costa` vào `coachIds`.
  - `f-bao-nguyen` (Bảo Nguyễn): Thêm `c-rafael-costa` vào `coachIds`.
  - `f-sofia-kowalski` (Sofia Kowalski): Thêm `c-rafael-costa` vào `coachIds`, thêm `d-thu-le` vào `doctorIds`.
- **Bác sĩ Thu Lê (`d-thu-le`)**: Thêm `f-sofia-kowalski` vào `fighterIds`.

### 2.2. Các đình chỉ mới (`suspensions.ts`)
Tất cả ngày tháng tính theo `TODAY_KEY` bằng `addDaysToDate`:
1. **S6: `susp-medical-club-exam`**
   - Võ sĩ: Hoàng Long (`f-hoang-long`)
   - Lý do: `MEDICAL`, Ban hành: `CLUB`
   - Thời gian: `startsOn: 0` (hôm nay), `endsOn: +13`
   - `requiresClearance: false`, `status: ACTIVE`
   - Mục đích: Bác sĩ Thu kết thúc sớm bằng phiếu khám có sẵn; HLV không có quyền kết thúc sớm.
2. **S7: `susp-medical-organizer`**
   - Võ sĩ: Bảo Nguyễn (`f-bao-nguyen`)
   - Lý do: `MEDICAL`, Ban hành: `ORGANIZER`
   - Văn bản ban hành: `issuerReference: "QĐ 12/BTC – Giải MMA mở rộng TP.HCM"`
   - Thời gian: `startsOn: 0` (hôm nay), `endsOn: +30`
   - `requiresClearance: false`, `status: ACTIVE`
   - Mục đích: HLV bấm "Gỡ theo ban tổ chức" và nhập văn bản gỡ.
3. **S8: `susp-medical-club-pending`**
   - Võ sĩ: Sofia Kowalski (`f-sofia-kowalski`)
   - Lý do: `MEDICAL`, Ban hành: `CLUB`
   - Thời gian: `startsOn: 0` (hôm nay), `endsOn: +14`
   - `requiresClearance: false`, `status: ACTIVE`
   - Mục đích: Bác sĩ chưa có phiếu sau ngày đình chỉ; có một yêu cầu khám `OPEN` do HLV Rafael gửi.
4. **H1: `susp-history-early-end`**
   - Võ sĩ: Marcus Hale (`f-marcus-hale`)
   - Lý do: `MEDICAL`, Ban hành: `CLUB`
   - Thời gian: `startsOn: -120`, `endsOn: -95`, `clearedAt: -110`
   - Người kết thúc: `u-thu-le`, `earlyEndExaminationId: "ex-marcus-early-end-111d"`
   - Ghi chú: `"Bác sĩ Thu Lê kiểm tra sau sốt siêu vi, võ sĩ hết sốt và thể trạng ổn định, cho phép kết thúc sớm đình chỉ và tập nhẹ tăng dần cường độ."`
   - `status: ENDED`
5. **H2: `susp-history-no-medical`**
   - Võ sĩ: Tariq Haddad (`f-tariq-haddad`)
   - Lý do: `TKO`, Ban hành: `CLUB`
   - Thời gian: `startsOn: -200`, `endsOn: -171`, `clearedAt: -169`
   - Người xác nhận: `u-rafael-costa`, `requiresClearance: true`
   - Ghi chú: `"HLV xác nhận, không có xác nhận y tế"`
   - `status: ENDED`
6. **H3: `susp-history-dq`**
   - Võ sĩ: Tariq Haddad (`f-tariq-haddad`)
   - Lý do: `DQ`, Ban hành: `CLUB`
   - Thời gian: `startsOn: -90`, `endsOn: -84`
   - `requiresClearance: false`, `clearedAt: null` (tự động hết hạn)
   - `status: ENDED`

### 2.3. Phiếu khám (`medical.ts`)
- **Phiếu khám cho S6**: `ex-hoang-early-end-0d` (Hoàng Long, Bác sĩ Thu Lê `d-thu-le`, ngày hôm nay lúc 08:00, `scope: "TRAINING"`, `outcome: "fit"`, `validUntil: +30`). Tóm tắt: khám lại trong thời gian đình chỉ y tế, đủ điều kiện tập luyện trở lại.
- **Phiếu khám cho H1**: `ex-marcus-early-end-111d` (Marcus Hale, Bác sĩ Thu Lê `d-thu-le`, ngày `-111`, `scope: "TRAINING"`, `outcome: "fit_with_restrictions"`, đánh giá sau sốt siêu vi, không nhắc đến xương hay bàn tay).

### 2.4. Yêu cầu xem xét y tế (`medical.ts` & `db.ts`)
- Seed `mockMedicalReviewRequests` có 1 yêu cầu:
  - Id: `rev-sofia-suspension`
  - Võ sĩ: `f-sofia-kowalski`
  - Người yêu cầu: `u-rafael-costa`, vai trò: `COACH`
  - Trạng thái: `OPEN`
  - Ngày yêu cầu: hôm nay
  - Lý do: `"Đau vai trái sau buổi grappling, cần khám và đánh giá chức năng trước khi cho tập lại."`

---

## 3. Ánh xạ các ca kiểm thử M1-M16 và K1 tới test

Tất cả các ca kiểm thử được triển khai trong file [t056-demo-suspensions.test.ts](../../nextjs-frontend/src/lib/mocks/t056-demo-suspensions.test.ts):

| Mã ca | Tiêu đề test trong file `t056-demo-suspensions.test.ts` | Kết quả |
| --- | --- | --- |
| **M1** | `it("M1 suspensionStatusOn cho từng id S6, S7, S8, H1, H2, H3 -> S6, S7, S8: ACTIVE, H1, H2, H3: ENDED")` | PASS |
| **M2** | `it("M2 Năm tình huống cũ -> Trạng thái không đổi: Marcus susp-active-ko ACTIVE, Diego AWAITING_CLEARANCE, Linh ENDED có gradedReturn.ceiling 3, Tariq susp-mandatory-rest ACTIVE, Emma không có đình chỉ nào")` | PASS |
| **M3** | `it("M3 filterEarlyEndExaminations(exams, S6, { doctorId: 'd-thu-le', now }) -> Đúng 1 phiếu, là phiếu S6")` | PASS |
| **M4** | `it("M4 Như M3 cho S8 -> Mảng rỗng")` | PASS |
| **M5** | `it("M5 S7 -> reason 'MEDICAL', issuedBy 'ORGANIZER', issuerReference khác rỗng")` | PASS |
| **M6** | `it("M6 accessibleFighterIds của HLV Rafael và bác sĩ Thu (đúng cách suspensions-page.test.ts dựng user) -> Rafael có Hoàng Long, Bảo, Sofia; Thu có Hoàng Long, Sofia, Marcus")` | PASS |
| **M7** | `it("M7 endSuspensionEarly(S6, { examinationId: <phiếu S6>, note }, bác sĩ Thu) trên db demo -> Trả về status 'ENDED', gradedReturn.ceiling 3, earlyEndExaminationId là phiếu S6")` | PASS |
| **M8** | `it("M8 endSuspensionEarly(S6, { examinationId, note }, HLV Rafael) -> Lỗi 403 FORBIDDEN")` | PASS |
| **M9** | `it("M9 endSuspensionEarly(S7, { liftReference: 'CV 30/BTC', note }, HLV Rafael) -> status 'ENDED', liftReference 'CV 30/BTC'")` | PASS |
| **M10** | `it("M10 H1 -> earlyEndExaminationId trỏ tới một phiếu có trong seed: Marcus, d-thu-le, scope 'TRAINING', kết luận fit hoặc fit_with_restrictions, ngày khám nằm giữa startsOn và clearedAt")` | PASS |
| **M11** | `it("M11 H2 -> requiresClearance true, clearedById 'u-rafael-costa', clearanceNote chứa 'không có xác nhận y tế'")` | PASS |
| **M12** | `it("M12 H3 -> reason 'DQ', requiresClearance false, clearedAt null")` | PASS |
| **M13** | `it("M13 medicalReviewRequests của seed -> Đúng một dòng OPEN cho Sofia, người gửi u-rafael-costa, vai trò COACH")` | PASS |
| **M14** | `it("M14 Gọi createExamination của medical.demo.ts cho Sofia bằng bác sĩ Thu (scope 'TRAINING', outcome 'fit', ngày hôm nay), rồi chạy filterEarlyEndExaminations cho S8 -> Trước: 0 phiếu, Sau: 1 phiếu, Yêu cầu khám M13 chuyển RESOLVED")` | PASS |
| **M15** | `it("M15 Buổi tập trong seed (db().trainingSessions) của Hoàng Long, Bảo, Sofia: không có buổi nào status 'completed' có ngày từ startsOn của S6, S7, S8 tương ứng")` | PASS |
| **M16** | `it("M16 Phiếu H1 (summary, recommendations, các note của assessments) và clearanceNote của H1: không chứa 'gãy', 'xương' hay 'bàn tay'")` | PASS |
| **K1** | `it("K1 Toàn bộ test hiện có và kịch bản demo giữ nguyên tính toàn vẹn")` | PASS |

---

## 4. Các test hiện có đã điều chỉnh theo K1 và lý do

Theo quy tắc K1 ("Existing tests may be changed only when the new seed forces it (case K1): keep the case name and record the reason in the handover"), có 2 file test hiện có được điều chỉnh:

1. **`nextjs-frontend/src/app/(app)/coach/bouts/readiness/readiness-page.test.ts`**:
   - `B6-6`: Cập nhật `totalFighters` trong roster của HLV Rafael từ 8 lên 11 (do thêm 3 võ sĩ Hoàng Long, Bảo Nguyễn, Sofia Kowalski). Cột `not-ready` tăng từ 6 lên 9 vì cả 3 võ sĩ mới đều đang có đình chỉ y tế hiệu lực (S6, S7, S8). Giữ nguyên tên ca test.
   - `B6-9`: Cập nhật số lần xuất hiện nhãn "Cường độ tối đa:" từ 8 lên 11 tương ứng với 11 thẻ võ sĩ được render cho roster của Rafael. Cập nhật chú thích và tên ca test theo số đếm mới.

2. **`nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspensions-page.test.ts`**:
   - `B4-1`: Cập nhật tổng số đình chỉ trong roster của Rafael từ 4 lên 10 (4 đình chỉ cũ + S6, S7, S8, H1, H2, H3). Số đếm trên nút lọc: Tất cả = 10, Đang đình chỉ = 5, Đã hết = 3, text mô tả = "5 đang hiệu lực". Cập nhật chú thích số đếm tương ứng.
   - `B4-7`: Ban đầu test kiểm tra empty state bằng cách filter `status: "ENDED"` do dữ liệu cũ có 0 dòng đã hết. Seed mới có 3 dòng lịch sử H1, H2, H3 nên `status: "ENDED"` không còn rỗng; cập nhật ca test để kiểm tra empty state khi HLV có roster không có đình chỉ nào (`f-emma-lindqvist`). Giữ nguyên tên ca test.

---

## 5. Kết quả kiểm tra (Command Outputs)

### 5.1. `pnpm --filter nextjs-frontend lint`
```
$ eslint
```
(Exit code: 0, không có cảnh báo hay lỗi lint).

### 5.2. `pnpm --filter nextjs-frontend typecheck`
```
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```
(Exit code: 0, 0 lỗi TypeScript).

### 5.3. `pnpm --filter nextjs-frontend test`
```
$ vitest run

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  121 passed | 1 skipped (122)
      Tests  1199 passed | 2 skipped (1201)
   Start at  10:38:58
   Duration  4.30s (import 45%, transform 31%, tests 22%, worker 1%)

     Import  436 modules were evaluated 3026 times · 26.27s total, 45% of tracked time
             ~355ms faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation
```

---

## 6. Lượt sửa 1 (04/11, sau review độc lập)

### 6.1. Nội dung đã thay đổi (Mục 1–6)
1. **Câu chuyện của Marcus (H1)**:
   - Sửa phiếu khám H1 (`ex-marcus-early-end-111d`) và `clearanceNote` của H1 từ việc gãy xương bàn tay thành đợt sốt siêu vi đã khỏi.
   - Toàn bộ nội dung (`summary`, `recommendations`, `assessments.note`, `clearanceNote`) không còn chứa các từ "gãy", "xương", "bàn tay".
2. **Buổi tập completed và thời gian đình chỉ S6, S7, S8**:
   - Chuyển `startsOn` của S6, S7, S8 về **hôm nay** (`startsOn: 0`).
   - Giữ nguyên độ dài: S6 tới `+13`, S7 tới `+30`, S8 tới `+14`.
   - Phiếu S6 dời về hôm nay (`dayOffset: 0`, 08:00, id `ex-hoang-early-end-0d`).
   - Yêu cầu khám S8 dời về hôm nay (`requestedAt: 08:30`).
3. **Phiếu S6 ghi đúng thời điểm**:
   - Sửa tóm tắt thành `"Khám lại trong thời gian đình chỉ y tế. Lưng dưới hồi phục tốt, không còn triệu chứng, đủ điều kiện tập luyện trở lại."`
4. **Bối cảnh lâm sàng của Sofia**:
   - Cập nhật lý do yêu cầu khám S8: `"Đau vai trái sau buổi grappling, cần khám và đánh giá chức năng trước khi cho tập lại."`
5. **Cập nhật các chú thích cũ**:
   - Cập nhật các chú thích số lượng cũ trong `suspensions-page.test.ts` (10 tổng, 5 hiệu lực, 3 đã hết) và `readiness-page.test.ts` (11 thẻ).
6. **Tác dụng phụ đã biết theo F7**:
   - Hai giáo án `tp-sofia-camp` và `tp-hoang-camp` được tự động chuyển sang phase `rehab` khi seed khởi tạo đình chỉ `MEDICAL`.
   - Các buổi tập đã xếp trong thời gian đình chỉ của ba võ sĩ chuyển sang trạng thái `pending`:
     - **Hoàng Long (`f-hoang-long`)**: 10 buổi sang `pending`.
     - **Bảo Nguyễn (`f-bao-nguyen`)**: 8 buổi sang `pending`.
     - **Sofia Kowalski (`f-sofia-kowalski`)**: 11 buổi sang `pending`.
     - **Tổng cộng**: 29 buổi tập chuyển sang `pending`.

### 6.2. Kết quả chạy M15 và M16 trước khi sửa seed (Tái hiện lỗi - FAILED)
```
 FAIL  src/lib/mocks/t056-demo-suspensions.test.ts > T-056: Dữ liệu demo đủ các tình huống đình chỉ > M15 Buổi tập trong seed (db().trainingSessions) của Hoàng Long, Bảo, Sofia: không có buổi nào status 'completed' có ngày từ startsOn của S6, S7, S8 tương ứng
AssertionError: expected [ …(3) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "f-hoang-long có 2 buổi completed từ startsOn 2026-11-01: s-hoang-pads-2d, s-hoang-sc-1d",
+   "f-bao-nguyen có 3 buổi completed từ startsOn 2026-10-30: s-bao-grappling-4d, s-bao-grappling-2d, s-bao-drill-1d",
+   "f-sofia-kowalski có 2 buổi completed từ startsOn 2026-11-02: s-sofia-grappling-2d, s-sofia-pads-1d",
+ ]

 ❯ src/lib/mocks/t056-demo-suspensions.test.ts:283:28
    281|         }
    282|
    283|         expect(violations).toEqual([]);
       |                            ^

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/2]⎯

 FAIL  src/lib/mocks/t056-demo-suspensions.test.ts > T-056: Dữ liệu demo đủ các tình huống đình chỉ > M16 Phiếu H1 (summary, recommendations, các note của assessments) và clearanceNote của H1: không chứa 'gãy', 'xương' hay 'bàn tay'
AssertionError: expected [ …(5) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "Tìm thấy \"gãy\" trong text: \"Đánh giá lại chấn thương gãy xương bàn tay sau điều trị bảo tồn. Can xương tốt.\"",
+   "Tìm thấy \"xương\" trong text: \"Đánh giá lại chấn thương gãy xương bàn tay sau điều trị bảo tồn. Can xương tốt.\"",
+   "Tìm thấy \"bàn tay\" trong text: \"Đánh giá lại chấn thương gãy xương bàn tay sau điều trị bảo tồn. Can xương tốt.\"",
+   "Tìm thấy \"bàn tay\" trong text: \"Cho phép kết thúc sớm đình chỉ và trở lại tập có bảo vệ bàn tay.\"",
+   "Tìm thấy \"xương\" trong text: \"X-quang can xương tốt, vững, ấn không đau.\"",
+ ]

 ❯ src/lib/mocks/t056-demo-suspensions.test.ts:308:28
    306|         }
    307|
    308|         expect(violations).toEqual([]);
       |                            ^

⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[2/2]⎯

 Test Files  1 failed (1)
      Tests  2 failed | 15 passed (17)
```

### 6.3. Kết quả chạy M15 và M16 sau khi sửa seed (PASSED)
```
$ vitest run "src/lib/mocks/t056-demo-suspensions.test.ts"

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  1 passed (1)
      Tests  17 passed (17)
   Start at  10:36:09
   Duration  1.04s (transform 51%, import 29%, tests 20%)
```
Cả hai ca M15 và M16 cùng toàn bộ 15 ca trước đó đều PASS.

### 6.4. Thống kê số lượng test:
- **Ban đầu**: 1182 passed | 2 skipped (120 test files passed | 1 skipped).
- **Sau đợt 1**: 1197 passed | 2 skipped (121 test files passed | 1 skipped).
- **Sau lượt sửa 1**: 1199 passed | 2 skipped (121 test files passed | 1 skipped) (+2 tests cho M15, M16).

---

## 7. Đánh giá Ponytail Review (Lượt ban đầu & Lượt 1)
- Thừa mã / trừu tượng hóa: Không có.
- Chỉnh sửa đúng phạm vi: mock data, file test T-056, và cập nhật chú thích trong 2 file test.
- Nhận định: **Lean already. Ship.**

---

## 8. Lượt sửa 2 (04/11, xử lý phụ thuộc giờ chạy - Claude 13:23)

### 8.1. Nguyên nhân gốc (Root Cause)
1. **Trạng thái buổi tập phụ thuộc đồng hồ neo (`time.ts` & `training.ts`)**:
   - `generateSessions()` trong `training.ts` xác định `isPast = day < 0 || (day === 0 && Date.parse(authoredStart) + blueprint.durationMin * MINUTE_MS <= MOCK_ANCHOR_MS)`.
   - Sofia Kowalski (`f-sofia-kowalski`) có buổi tập grappling vào thứ Tư lúc 10:00 - 11:30.
   - Khi chạy buổi sáng (10:36), buổi tập này chưa kết thúc (`isPast = false`), nên mang trạng thái `scheduled`.
   - Khi Claude chạy lúc 13:23, thời điểm neo đã vượt qua 11:30 (`isPast = true`), buổi tập tự động được gán trạng thái `completed`.
2. **Quy tắc tác dụng phụ F7 bỏ qua buổi `completed` (`suspension-rules.ts` & `db.ts`)**:
   - Hàm `applySuspensionSideEffects` chỉ xử lý các buổi có trạng thái `scheduled` hoặc `SCHEDULED`. Do buổi của Sofia đã thành `completed`, nó bị bỏ qua và giữ nguyên trạng thái `completed`.
   - Hậu quả:
     - **M15 thất bại**: Sofia có 1 buổi `completed` diễn ra trong thời gian đình chỉ bắt đầu từ hôm nay (`startsOn: TODAY_KEY`).
     - **K1 thất bại**: Số buổi `pending` của Sofia chỉ còn 10 thay vì 11 (`expected [ …(10) ] to have a length of 11 but got 10`).
   - Tương tự, nếu bộ test chạy sau 18:30 (hoặc 23:30), buổi tập lúc 17:00 của Hoàng Long cũng sẽ gặp lỗi y hệt.
3. **Cơ chế neo mock không động**:
   - `MOCK_ANCHOR_MS`, `MOCK_ANCHOR_ISO`, `TODAY_KEY` ban đầu là hằng số khởi tạo một lần khi module `time.ts` được load.
   - `mockTrainingSessions` trong `training.ts` cũng là một mảng hằng số tạo một lần, và `db.ts` chỉ shallow-copy mảng này, khiến việc đổi `globalThis.__mmaMockAnchorMs` trong test không tạo lại buổi tập theo giờ neo mới.

---

### 8.2. Giải pháp khắc phục (Fix)
1. **Đồng bộ hóa neo mock trong `time.ts`**:
   - Chuyển `MOCK_ANCHOR_MS`, `MOCK_ANCHOR_ISO`, `TODAY_KEY` thành các biến xuất khẩu bằng `export let` và cài đặt `Object.defineProperty(globalThis, "__mmaMockAnchorMs", ...)` với getter/setter để mọi thay đổi đối với `__mmaMockAnchorMs` đều tự động đồng bộ lại các biến mốc thời gian.
   - Chuyển `isToday` thành hàm kiểm tra động dựa trên `todayStartMs()`.
2. **Tái tạo buổi tập động trong `training.ts`**:
   - Thêm và xuất khẩu hàm `buildMockTrainingSessions(): SeedSession[]` để sinh mới danh sách buổi tập theo đúng mốc `MOCK_ANCHOR_MS` tại thời điểm gọi.
3. **Đảm bảo tính toàn vẹn nghiệp vụ trong `db.ts`**:
   - Sử dụng `trainingSessions: buildMockTrainingSessions()` trong `seedData()`.
   - Trước khi gọi `applySuspensionSideEffects`: đối với các võ sĩ có đình chỉ đang hiệu lực trong ngày hôm nay, mọi buổi tập hôm nay nếu đã bị đồng hồ gán `completed` hay `missed` đều được đưa về `scheduled` (vì võ sĩ đang chịu đình chỉ không thể hoàn thành buổi tập trong ngày). Khi đó, `applySuspensionSideEffects` sẽ tiếp quản và chuyển chúng sang `pending` đúng chuẩn nghiệp vụ F7.
   - Trong `db()`, cập nhật logic để khi `__mmaMockDb` bị xóa, dữ liệu được tạo mới ngay lập tức mà không phụ thuộc vào biến `seedFingerprint` tĩnh.
4. **Cập nhật ca kiểm thử trong `t056-demo-suspensions.test.ts`**:
   - Cập nhật K1 kiểm tra rõ ràng cả `buildMockSuspensions()` và `db().suspensions`.
   - Bổ sung ca kiểm thử `M17` dựng seed với ba mốc neo giả định trong ngày học viện: `00:30`, `12:00`, và `23:30`, chứng minh M15 và K1 luôn luôn PASS tại mọi thời điểm trong ngày.

---

### 8.3. Kết quả chạy M17 trước khi sửa (Tái hiện lỗi - FAILED)
```
 FAIL  src/lib/mocks/t056-demo-suspensions.test.ts > T-056: Dữ liệu demo đủ các tình huống đình chỉ > M17 Dựng seed với thời điểm neo giả lần lượt là 00:30, 12:00 và 23:30 giờ học viện của cùng một ngày -> Ở cả ba giờ, M15 và K1 đều qua
AssertionError: expected [ Array(1) ] to deeply equal []

- Expected
+ Received

- []
+ [
+   "[00:30] f-sofia-kowalski có 1 buổi completed từ startsOn 2026-11-04: s-sofia-grappling-today",
+ ]

 ❯ src/lib/mocks/t056-demo-suspensions.test.ts:386:36
    384|                     }
    385|                 }
    386|                 expect(violations).toEqual([]);
       |                                    ^
    387|
    388|                 // Kiểm tra K1: 10 đình chỉ trong seed và side effects…

 Test Files  1 failed (1)
      Tests  3 failed | 15 passed (18)
```

---

### 8.4. Kết quả chạy M17 sau khi sửa (PASSED)
```
$ vitest run "t056-demo-suspensions.test.ts"

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  1 passed (1)
      Tests  18 passed (18)
   Start at  13:35:45
   Duration  981ms (transform 49%, import 27%, tests 24%)
```
Toàn bộ 18/18 ca test (M1 đến M17 và K1) đều PASS.

---

### 8.5. Thống kê số lượng test:
- **Ban đầu**: 1182 passed | 2 skipped (120 test files passed | 1 skipped).
- **Sau đợt 1**: 1197 passed | 2 skipped (121 test files passed | 1 skipped).
- **Sau lượt sửa 1**: 1199 passed | 2 skipped (121 test files passed | 1 skipped).
- **Sau lượt sửa 2**: 1200 passed | 2 skipped (121 test files passed | 1 skipped) (+1 test case M17).

---

### 8.6. Kết quả xác minh toàn diện (Command Outputs Lượt 2)

#### `pnpm --filter nextjs-frontend lint`
```
$ eslint
```
(Exit code: 0, không có warning, không có error).

#### `pnpm --filter nextjs-frontend typecheck`
```
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```
(Exit code: 0, 0 lỗi TypeScript).

#### `pnpm --filter nextjs-frontend test`
```
$ vitest run

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  121 passed | 1 skipped (122)
      Tests  1200 passed | 2 skipped (1202)
   Start at  13:38:32
   Duration  4.30s (import 46%, transform 33%, tests 19%, worker 1%)

     Import  436 modules were evaluated 3078 times · 27.02s total, 46% of tracked time
             ~354ms faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation
```

---

### 8.7. Đánh giá Ponytail Review (Lượt sửa 2)
- Chỉ can thiệp tối thiểu vào logic đồng bộ hóa neo thời gian (`time.ts`), khởi tạo phiên tập theo neo (`training.ts`), và xử lý bảo vệ phiên tập của võ sĩ bị đình chỉ trước khi kích hoạt side effects (`db.ts`).
- Không tạo lớp trừu tượng mới, không sửa UI hay domain services.
- Nhận định: **Lean. Clean. Ship.**

---

## 9. Lượt sửa 3 (04/11, hoàn tác hạ tầng & cô lập module test)

### 9.1. Các nội dung đã thay đổi
1. **Hoàn tác hoàn toàn `mocks/time.ts` về HEAD**:
   - Khôi phục lại mốc neo là hằng số (`const MOCK_ANCHOR_MS`, `const MOCK_ANCHOR_ISO`, `const TODAY_KEY`).
   - Xóa bỏ `Object.defineProperty(globalThis, "__mmaMockAnchorMs")` và `export let`. `git diff` của `time.ts` hoàn toàn rỗng.
2. **Khôi phục `db()` trong `mocks/db.ts` về bản HEAD**:
   - Giữ lại `seedFingerprint`, cơ chế so sánh fingerprint và `structuredClone(seedData())` để đảm bảo khi dữ liệu demo bị sửa ở runtime, các hằng số của module (như `mockSystemSettings`, `mockCoachFeedback`) không bị đột biến theo.
3. **Hoàn tác `mocks/training.ts` về HEAD**:
   - Bỏ hàm `buildMockTrainingSessions()`.
   - Trong `seedData()`, quay lại dùng `mockTrainingSessions.map(...)`, đồng thời sao chép sâu cả mảng `exercises` (`exercises: s.exercises.map((e) => ({ ...e }))`) để vòng lặp reset trạng thái buổi tập hôm nay chỉ can thiệp trên bản sao độc lập. `git diff` của `training.ts` hoàn toàn rỗng.
4. **Viết lại M17 theo đúng cơ chế neo sẵn có của Vitest**:
   - Với mỗi mốc neo (`00:30`, `12:00`, `23:30`): gọi `vi.resetModules()`, `delete globalThis.__mmaMockDb`, gán `globalThis.__mmaMockAnchorMs = anchorMs`, rồi `await import()` lại các module mock và domain rules.
   - Khôi phục lại giá trị `__mmaMockAnchorMs` và gọi `vi.resetModules()` trong khối `finally`.
5. **Bổ sung ca kiểm thử M18**:
   - Kiểm tra việc sửa `db().settings` hoặc `db().trainingSessions` không làm biến đổi các hằng số module `mockSystemSettings` hay `mockTrainingSessions`.

---

### 9.2. `git diff --stat` cho `time.ts` và `training.ts`
```
$ git diff --stat nextjs-frontend/src/lib/mocks/time.ts nextjs-frontend/src/lib/mocks/training.ts
(rỗng - không có thay đổi nào so với HEAD)
```

---

### 9.3. Kết quả chạy M18 trước khi sửa (Tái hiện lỗi - FAILED trên bản lượt 2)
```
 FAIL  src/lib/mocks/t056-demo-suspensions.test.ts > T-056: Dữ liệu demo đủ các tình huống đình chỉ > M18 Sửa db().settings hoặc một buổi trong db().trainingSessions (ví dụ đổi status), rồi đọc hằng tương ứng của module (mockSystemSettings, mockTrainingSessions) -> Hằng của module không đổi
AssertionError: expected 'Modified Org Name For Test' to be 'Lotus Combat Academy' // Object.is equality

Expected: "Lotus Combat Academy"
Received: "Modified Org Name For Test"

 ❯ src/lib/mocks/t056-demo-suspensions.test.ts:434:57
    432|
    433|         try {
    434|             expect(mockSystemSettings.organizationName).toBe(originalOrgName);
       |                                                         ^
    435|             expect(targetSession.status).toBe(originalStatus);
    436|         } finally {

 Test Files  1 failed (1)
      Tests  1 failed | 18 passed (19)
```

---

### 9.4. Kết quả chạy sau khi sửa (PASSED)
```
$ vitest run "t056-demo-suspensions.test.ts"

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  1 passed (1)
      Tests  19 passed (19)
   Start at  13:43:22
   Duration  1.14s (transform 42%, tests 35%, import 23%)
```
Toàn bộ 19/19 ca test (M1 đến M18 và K1) đều PASS.

---

### 9.5. Thống kê số lượng test:
- **Ban đầu**: 1182 passed | 2 skipped (120 test files passed | 1 skipped).
- **Sau đợt 1**: 1197 passed | 2 skipped (121 test files passed | 1 skipped).
- **Sau lượt sửa 1**: 1199 passed | 2 skipped (121 test files passed | 1 skipped).
- **Sau lượt sửa 2**: 1200 passed | 2 skipped (121 test files passed | 1 skipped).
- **Sau lượt sửa 3**: 1201 passed | 2 skipped (121 test files passed | 1 skipped) (+1 test case M18; tổng cộng +19 tests cho vé T-056).

---

### 9.6. Kết quả xác minh toàn diện (Command Outputs Lượt 3)

#### `pnpm --filter nextjs-frontend lint`
```
$ eslint
```
(Exit code: 0, 0 warning, 0 error).

#### `pnpm --filter nextjs-frontend typecheck`
```
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```
(Exit code: 0, 0 lỗi TypeScript).

#### `pnpm --filter nextjs-frontend test`
```
$ vitest run

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  121 passed | 1 skipped (122)
      Tests  1201 passed | 2 skipped (1203)
   Start at  13:44:36
   Duration  4.37s (import 45%, transform 33%, tests 21%, worker 1%)

     Import  436 modules were evaluated 3116 times · 26.24s total, 45% of tracked time
             ~361ms faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation
```

---

### 9.7. Đánh giá Ponytail Review (Lượt sửa 3)
- Hoàn tác toàn bộ các can thiệp hạ tầng thừa tại `time.ts` và `training.ts`.
- Giữ vững giải pháp cốt lõi đúng phạm vi tại `seedData()` trong `db.ts` với việc clone sâu bản sao session và bảo vệ session của võ sĩ bị đình chỉ.
- Tận dụng `vi.resetModules()` cùng `import()` động tiêu chuẩn của Vitest cho ca kiểm thử neo thời gian M17.
- Nhận định: **Lean. Robust. Ship.**

---

## 10. Lượt sửa 4 (04/11, sau review độc lập lượt 2)

### 10.1. Các thay đổi đã thực hiện (Mục 1–5)
1. **Xóa số gõ cứng trong K1 và M17, thay bằng bất biến (Mục 1)**:
   - Thay vì kiểm tra độ dài cứng (10, 8, 11) - vốn sẽ thay đổi theo thứ trong tuần do lịch tập chỉ sinh tới `LAST_DAY = 14` - chuyển sang kiểm tra bất biến logic: Trong khung đình chỉ đang hiệu lực của S6, S7, S8, với mọi buổi tập mà `isSessionBlockedBySuspension` trả về `true`:
     - (a) Không có buổi nào có trạng thái `scheduled` hay `completed`.
     - (b) Có ít nhất một buổi mang trạng thái `pending`.
2. **Sửa vòng lặp đặt lại trong `seedData()` (`db.ts`) (Mục 2)**:
   - Thêm điều kiện `if (!isSessionBlockedBySuspension(session, susp)) continue;` vào vòng lặp đặt lại trạng thái buổi tập hôm nay.
   - Nhờ đó, các buổi tập thuộc loại võ sĩ vẫn được phép tham gia (ví dụ: buổi `recovery_mobility` của Marcus Hale dưới đình chỉ `susp-active-ko`) không bị reset nhầm từ `completed` về `scheduled`.
3. **Đồng bộ thứ tự thời gian tạo S6, S7, S8 (`suspensions.ts`) (Mục 3)**:
   - Thay đổi `createdAt` và `updatedAt` của S6, S7, S8 thành 07:00 giờ học viện hôm nay bằng hàm `pastToday(7, 0)`.
   - Giờ tạo này hợp lý và diễn ra trước thời điểm lập phiếu khám S6 (08:00) và gửi yêu cầu khám S8 (08:30).
4. **Cập nhật các chú thích số lượng cũ còn sót (Mục 4)**:
   - Sửa mô tả ca và chú thích trong `suspensions-page.test.ts` (B4-1) và chú thích tổng số đếm 3 cột trong `readiness-page.test.ts:220` (1 ready + 1 graded + 9 not ready = 11).
5. **Ghi nhận các tác dụng phụ của vòng lặp đặt lại (Mục 5)**:
   - Các buổi tập hôm nay bị chặn bởi đình chỉ KO của Marcus chuyển thành `cancelled` (vì `requiresClearance: true`).
   - Các buổi tập hôm nay bị chặn bởi đình chỉ nghỉ bắt buộc của Tariq chuyển thành `pending` (vì `requiresClearance: false`).

---

### 10.2. `git diff --stat` cho `time.ts` và `training.ts`
```
$ git diff --stat nextjs-frontend/src/lib/mocks/time.ts nextjs-frontend/src/lib/mocks/training.ts
(rỗng - không có thay đổi nào)
```

---

### 10.3. Kết quả chạy tái hiện lỗi trước khi sửa (FAILED trên bản lượt 3)

#### M17 (Thất bại do số lượng gõ cứng lệch khi chạy qua các ngày trong tuần)
```
 FAIL  src/lib/mocks/t056-demo-suspensions.test.ts > T-056: Dữ liệu demo đủ các tình huống đình chỉ > M17 Mốc neo giả lúc 12:00 giờ học viện của bảy ngày liên tiếp (thứ Hai tới Chủ nhật), cộng thêm 00:30 và 23:30 của một ngày -> Ở mọi mốc, M15 và K1 đều qua
AssertionError: expected [ { …(16) }, …(8) ] to have a length of 8 but got 9

- Expected
+ Received

- 8
+ 9

 ❯ src/lib/mocks/t056-demo-suspensions.test.ts:433:36
    431|                 );
    432|                 expect(hoangPending).toHaveLength(10);
    433|                 expect(baoPending).toHaveLength(8);
       |                                    ^
    434|                 expect(sofiaPending).toHaveLength(11);
```

#### M19 (Thất bại do buổi `recovery_mobility` của Marcus bị reset nhầm về `scheduled`)
```
 FAIL  src/lib/mocks/t056-demo-suspensions.test.ts > T-056: Dữ liệu demo đủ các tình huống đình chỉ > M19 Mốc neo giả mà buổi recovery_mobility hôm nay của Marcus (s-marcus-recovery-today) đã completed trong mockTrainingSessions (ví dụ 07/11 lúc 23:30) -> Trong db(), buổi đó vẫn completed
AssertionError: expected 'scheduled' to be 'completed' // Object.is equality

Expected: "completed"
Received: "scheduled"

 ❯ src/lib/mocks/t056-demo-suspensions.test.ts:483:38
    481|                 (s) => s.fighterId === "f-marcus-hale" && s.id === "s-…
    482|             );
    483|             expect(dbMarcus?.status).toBe("completed");
       |                                      ^
```

---

### 10.4. Kết quả chạy sau khi sửa (PASSED)
```
$ vitest run "t056-demo-suspensions.test.ts"

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  1 passed (1)
      Tests  20 passed (20)
   Start at  14:02:54
   Duration  1.56s (tests 53%, transform 30%, import 17%)
```
Toàn bộ 20/20 ca test (M1 đến M19 và K1) đều PASS.

---

### 10.5. Thống kê số lượng test:
- **Ban đầu**: 1182 passed | 2 skipped (120 test files passed | 1 skipped).
- **Sau đợt 1**: 1197 passed | 2 skipped (121 test files passed | 1 skipped).
- **Sau lượt sửa 1**: 1199 passed | 2 skipped (121 test files passed | 1 skipped).
- **Sau lượt sửa 2**: 1200 passed | 2 skipped (121 test files passed | 1 skipped).
- **Sau lượt sửa 3**: 1201 passed | 2 skipped (121 test files passed | 1 skipped).
- **Sau lượt sửa 4**: 1202 passed | 2 skipped (121 test files passed | 1 skipped) (+1 test case M19; tổng cộng +20 tests cho vé T-056).

---

### 10.6. Kết quả xác minh toàn diện (Command Outputs Lượt 4)

#### `pnpm --filter nextjs-frontend lint`
```
$ eslint
```
(Exit code: 0, 0 warning, 0 error).

#### `pnpm --filter nextjs-frontend typecheck`
```
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```
(Exit code: 0, 0 lỗi TypeScript).

#### `pnpm --filter nextjs-frontend test` (Lần chạy 1)
```
$ vitest run

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  121 passed | 1 skipped (122)
      Tests  1202 passed | 2 skipped (1204)
   Start at  14:03:39
   Duration  5.18s (import 44%, transform 37%, tests 19%, worker 1%)

     Import  436 modules were evaluated 3126 times · 31.40s total, 44% of tracked time
             ~434ms faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation
```

#### `pnpm --filter nextjs-frontend test` (Lần chạy 2)
```
$ vitest run

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend


 Test Files  121 passed | 1 skipped (122)
      Tests  1202 passed | 2 skipped (1204)
   Start at  14:03:51
   Duration  4.63s (import 44%, transform 34%, tests 21%, worker 1%)

     Import  436 modules were evaluated 3113 times · 27.22s total, 44% of tracked time
             ~368ms faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation
```

---

### 10.7. Đánh giá Ponytail Review (Lượt sửa 4)
- Thay thế các assertion kiểm tra số lượng cứng bằng kiểm tra bất biến logic vững chắc, giải quyết triệt để vấn đề phụ thuộc vào thứ trong tuần.
- Tinh chỉnh điều kiện đặt lại session trong `db.ts` bằng đúng hàm `isSessionBlockedBySuspension` từ domain rules, không tạo logic thừa hay trừu tượng hóa mới.
- Giữ nguyên vẹn tính toàn vẹn của `time.ts` và `training.ts`.
- Nhận định: **Lean. Invariant-tested. Ship.**

---

## 11. Câu hỏi
Không có.
