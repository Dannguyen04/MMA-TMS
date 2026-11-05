# T-053 Handover: Thiết kế lại hộp thoại "Kết thúc sớm" đình chỉ

- Ngày: 03/11/2026
- Nhánh: `User_Feature`
- Trạng thái: Hoàn thành đầy đủ theo thiết kế và tiêu chí nghiệm thu của [T-053-early-end-dialog-context.md](file:///D:/MMA-TMS/docs/tickets/T-053-early-end-dialog-context.md).

---

## 1. File đã sửa

1. [`nextjs-frontend/src/lib/domain/suspension-rules.ts`](file:///D:/MMA-TMS/nextjs-frontend/src/lib/domain/suspension-rules.ts)
   - Bổ sung hàm thuần `earlyEndPreview(suspension: { endsOn: string }, today: string): { daysCut: number; gradedReturn: GradedReturn }`.
2. [`nextjs-frontend/src/lib/i18n/messages/coach-bouts.vi.ts`](file:///D:/MMA-TMS/nextjs-frontend/src/lib/i18n/messages/coach-bouts.vi.ts)
   - Cập nhật nhóm khoá `suspensions.earlyEndDialog.*`: loại bỏ các khoá cũ không còn dùng (`examHint`, `examSelectPlaceholder`, `examOption`), bổ sung các khoá mới theo đúng thiết kế 3 khối (`sectionSuspension`, `reasonLabel`, `periodLabel`, `sourceLabel`, `sourceClub`, `sourceOrganizer`, `originalReference`, `cutDays`, `lastDay`, `sectionBasis`, `liftReferenceHint`, `outcomeFit`, `outcomeFitWithRestrictions`, `validUntil`, `sectionConsequence`, `afterEndDesc`, `close`, đổi nhãn `confirm` thành "Kết thúc đình chỉ", nhãn `noteLabel` thành "Ghi chú kết thúc").
3. [`nextjs-frontend/src/lib/i18n/messages/coach-bouts.en.ts`](file:///D:/MMA-TMS/nextjs-frontend/src/lib/i18n/messages/coach-bouts.en.ts)
   - Đồng bộ đầy đủ 33 khoá `suspensions.earlyEndDialog.*` sang tiếng Anh tương ứng.
4. [`nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspension-early-end-dialog.tsx`](file:///D:/MMA-TMS/nextjs-frontend/src/app/(app)/coach/bouts/suspensions/suspension-early-end-dialog.tsx)
   - Tách component trình bày `SuspensionEarlyEndBody` nhận props thuần, render được qua `renderToStaticMarkup`.
   - Bố cục 3 khối rõ ràng:
     - Khối 1: Đình chỉ đang kết thúc (danh sách `dl` gọn, lý do, khoảng ngày, nguồn, văn bản gốc, dòng rút ngắn N ngày).
     - Khối 2: Căn cứ kết thúc (Ban tổ chức: ô nhập văn bản kèm gợi ý đối chiếu văn bản gốc; CLB: nhóm radio `fieldset` + `legend`, mỗi radio bấm được cả dòng, có focus ring, ngày khám, kết luận, hạn hiệu lực, tóm tắt; tự chọn sẵn khi có đúng 1 phiếu; nếu không có phiếu hợp lệ chỉ hiện cảnh báo, link ghi phiếu khám và nút "Đóng").
     - Khối 3: Sau khi kết thúc (câu giải thích và `GradedReturnSteps` với lộ trình tập lại theo bậc từ `earlyEndPreview`).
   - Ô ghi chú có placeholder cụ thể, đếm ký tự 3–500; nút chính "Kết thúc đình chỉ".
5. [`nextjs-frontend/src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts`](file:///D:/MMA-TMS/nextjs-frontend/src/app/(app)/coach/bouts/suspensions/t050-early-end.test.ts)
   - Cập nhật ca W3 (không còn render nút submit và ô ghi chú khi 0 phiếu, chỉ có nút "Đóng") và W9 (danh sách khoá i18n mới) theo tiêu chí K1.
6. [`nextjs-frontend/src/app/(app)/coach/bouts/suspensions/t053-early-end-dialog.test.ts`](file:///D:/MMA-TMS/nextjs-frontend/src/app/(app)/coach/bouts/suspensions/t053-early-end-dialog.test.ts) (File mới)
   - Hiện thực toàn bộ các ca kiểm thử P1–P3, R1–R7, I1, K1.

---

## 2. Bảng ca kiểm thử -> Tên test

| Ca | Lớp | Tên test | Kết quả |
| --- | --- | --- | --- |
| **P1** | P | `P1: endsOn 2026-11-16, today 2026-11-05 -> daysCut 11, gradedReturn { ceiling: 3, fullReturnOn: '2026-11-07' }` | **PASS** |
| **P2** | P | `P2: endsOn 2026-11-05, today 2026-11-05 -> daysCut 0, fullReturnOn '2026-11-07'` | **PASS** |
| **P3** | P | `P3: endsOn 2026-11-04, today 2026-11-05 (không xảy ra vì backend chặn, nhưng hàm phải an toàn) -> daysCut 0` | **PASS** |
| **R1** | R | `R1: CLB, MEDICAL, 03/11–16/11, một phiếu hợp lệ -> markup chứa 'Y tế', '03/11', '16/11', 'Do CLB', 'Rút ngắn 11 ngày' và vùng GradedReturnSteps` | **PASS** |
| **R2** | R | `R2: ban tổ chức, issuerReference 'QĐ 12/BTC ngày 31/10' -> markup chứa 'Do ban tổ chức', chứa 'QĐ 12/BTC ngày 31/10' ở khối đình chỉ và trong gợi ý của ô văn bản gỡ; có ô lift-reference-input; có vùng GradedReturnSteps` | **PASS** |
| **R3** | R | `R3: CLB, 0 phiếu hợp lệ -> có link tới clinicalLinks.newExaminationFor(fighterId); không có early-end-note-textarea, không có nút type='submit', không có vùng GradedReturnSteps` | **PASS** |
| **R4** | R | `R4: CLB, 2 phiếu hợp lệ: A (fit, validUntil 2026-12-01), B (fit_with_restrictions, không validUntil) -> 2 input type='radio' name='examinationId', không radio nào checked; markup chứa 'Đủ điều kiện', 'Đủ điều kiện, có hạn chế', 'Hiệu lực đến 01/12'; không còn <select id='examination-select'>` | **PASS** |
| **R5** | R | `R5: CLB, đúng 1 phiếu hợp lệ -> radio duy nhất có checked` | **PASS** |
| **R6** | R | `R6: CLB, 1 phiếu hợp lệ và 1 phiếu scope COMPETITION -> chỉ 1 radio (bộ lọc filterEarlyEndExaminations vẫn áp)` | **PASS** |
| **R7** | R | `R7: ban tổ chức và CLB có phiếu -> nút submit có chữ 'Kết thúc đình chỉ'; nhãn ô ghi chú là 'Ghi chú kết thúc'` | **PASS** |
| **I1** | P | `I1: từ điển vi và en -> mọi khoá suspensions.earlyEndDialog.* có ở cả hai; không còn khoá nào trong nhóm này mà code không dùng` | **PASS** |
| **K1** | P | `K1: test T-050 hiện có (W1–W11, W2b, W2c) -> vẫn qua. Ca nào khẳng định examination-select hay chữ cũ thì sửa theo thiết kế mới, giữ tên ca, ghi vào handover` | **PASS** |

---

## 3. Phần cuối output 3 lệnh

Lệnh thực hiện:
`pnpm --filter nextjs-frontend lint ; pnpm --filter nextjs-frontend typecheck ; pnpm --filter nextjs-frontend test`

### 1. `lint`
```
$ eslint
(exit code 0 - không có lỗi hoặc cảnh báo)
```

### 2. `typecheck`
```
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```

### 3. `test`
```
$ vitest run

 RUN  v5.0.2 D:/MMA-TMS/nextjs-frontend

 Test Files  118 passed | 1 skipped (119)
      Tests  1161 passed | 2 skipped (1163)
   Start at  19:58:39
   Duration  3.98s (import 47%, transform 33%, tests 19%, worker 1%)

     Import  424 modules were evaluated 3096 times · 24.79s total, 47% of tracked time
             ~361ms faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation
```

---

## 4. Đường dẫn ảnh chụp kiểm tra giao diện

Chụp bằng Playwright (kênh Microsoft Edge) trên server demo `http://localhost:3100`:

1. Hộp thoại ban tổ chức đã gỡ (HLV Rafael Costa):
   - Desktop 1440px: `D:/test/ai-worktrees/logs/t053-shots/coach-organizer-1440.png`
   - Mobile 375px: `D:/test/ai-worktrees/logs/t053-shots/coach-organizer-375.png`
2. Hộp thoại bác sĩ chưa có phiếu hợp lệ (Bác sĩ Thu Lê):
   - Desktop 1440px: `D:/test/ai-worktrees/logs/t053-shots/doctor-early-end-1440.png`
   - Mobile 375px: `D:/test/ai-worktrees/logs/t053-shots/doctor-early-end-375.png`

Kết quả kiểm tra trực quan:
- Phân cấp 3 khối rõ ràng, khoảng cách theo thang 4px, không lồng card trong card.
- Tôn trọng token màu (`surface`, `surface-muted`, `border`, `info-fg`, `warning-soft`, `primary`).
- Ở 375px không cuộn ngang, nút không tràn, hỗ trợ cuộn dọc nội dung khi hộp thoại dài.
- Radio căn cứ bấm được cả dòng, có focus ring và hỗ trợ bàn phím.

---

## 5. Câu hỏi / Điểm cần lưu ý

- Không có mâu thuẫn giữa ticket và code hiện hữu.
- Toàn bộ ca kiểm thử P1–P3, R1–R7, I1, K1 cùng toàn bộ suite test của `nextjs-frontend` đều vượt qua 100%.
