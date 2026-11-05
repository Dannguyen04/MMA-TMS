# T-053 Hộp thoại "Kết thúc sớm" cho thấy đình chỉ, căn cứ và hệ quả

- Trạng thái: APPROVED 04/11 ([review](./T-053-REVIEW.md)). Ngày: 03/11/2026. Phụ thuộc: T-050 (DONE).
- Phạm vi: chỉ `nextjs-frontend`. Không đổi backend, API, mã lỗi, migration.

## Bối cảnh

Chủ dự án thử T-050 trên trình duyệt (03/11) và thấy hộp thoại kết thúc sớm "thiếu thông tin, chỉ hiện một ô nhập". Critique (Impeccable, chế độ Operate):

1. Hộp thoại không nhắc lại **đình chỉ nào** đang bị kết thúc: lý do, khoảng ngày, nguồn, còn bao nhiêu ngày. Người bấm phải nhớ từ trang phía sau (đã bị làm mờ).
2. Nguồn ban tổ chức: không hiện văn bản đình chỉ gốc (`issuerReference`), nên HLV không đối chiếu được văn bản gỡ với quyết định gốc.
3. Không nói **hệ quả** (nguyên tắc 1 của PRODUCT.md: app nói rõ đã làm gì, vì sao). Hệ quả có thật: võ sĩ tập lại theo bậc (hôm nay tối đa bậc 3, ngày mai bậc 4, từ ngày kia mọi bậc), chỉ nằm trong một dòng gợi ý dưới ô chọn phiếu, và không có ở nhánh ban tổ chức.
4. Phiếu khám nằm trong `<select>`, mỗi dòng chỉ có ngày và tóm tắt. Không thấy kết luận (đủ điều kiện hay có hạn chế) hay hạn hiệu lực trước khi chọn.
5. Khi bác sĩ chưa có phiếu hợp lệ, ô "Ghi chú" và nút xác nhận (bị vô hiệu) vẫn hiện. Đó là form chết, gây hiểu nhầm.
6. Nhãn "Ghi chú" và "Xác nhận kết thúc" chung chung cho một hành động không hoàn tác.

## Thiết kế

Giữ thế giới giao diện hiện có (`Dialog`, `Field`, token màu, `GradedReturnSteps`). Hộp thoại `size="md"`, ba khối theo thứ tự, ngăn bằng khoảng trắng và tiêu đề nhỏ (không lồng card trong card):

1. **Đình chỉ đang kết thúc** (danh sách `dl` gọn):
   - Lý do (`MEDICAL` → "Y tế").
   - Khoảng ngày `startsOn – endsOn`.
   - Nguồn: "Do CLB" hoặc "Do ban tổ chức", kèm `issuerReference` nguyên văn nếu có.
   - Dòng "Rút ngắn N ngày so với hạn gốc dd/MM". N lấy từ `earlyEndPreview` (dưới đây). Khi N = 0 thì hiện "Hôm nay là ngày cuối của hạn gốc".
2. **Căn cứ**:
   - Nguồn ban tổ chức: ô "Văn bản gỡ của ban tổ chức" như cũ. Gợi ý dưới ô là "Đối chiếu với văn bản đình chỉ gốc: <issuerReference>".
   - Nguồn CLB: thay `<select>` bằng nhóm radio (`fieldset` + `legend` "Phiếu khám căn cứ", `name="examinationId"`). Mỗi lựa chọn hiện:
     - ngày khám;
     - kết luận ("Đủ điều kiện" hoặc "Đủ điều kiện, có hạn chế");
     - "Hiệu lực đến dd/MM" nếu có `validUntil`;
     - `summary` nếu có, tối đa 2 dòng.
   - Có đúng một phiếu hợp lệ thì chọn sẵn phiếu đó.
   - Không có phiếu hợp lệ: chỉ hiện khối cảnh báo hiện có, link "Ghi phiếu khám" và một nút "Đóng". **Không** render ô ghi chú, khối hệ quả hay nút kết thúc.
3. **Sau khi kết thúc**: một câu ("Võ sĩ không về thẳng cường độ đầy đủ mà tập lại theo bậc") và `GradedReturnSteps` với `gradedReturn` lấy từ `earlyEndPreview`. Khối này hiện ở cả hai nguồn.

Ô ghi chú: nhãn "Ghi chú kết thúc", placeholder ví dụ cụ thể, giữ giới hạn 3–500 và bộ đếm ký tự. Nút chính: "Kết thúc đình chỉ".

Hàm thuần mới trong `src/lib/domain/suspension-rules.ts`:

```ts
earlyEndPreview(suspension: { endsOn: string }, today: string): { daysCut: number; gradedReturn: GradedReturn }
// daysCut = max(0, daysBetweenDates(today, endsOn)); gradedReturn = { ceiling: 3, fullReturnOn: addDaysToDate(today, 2) }
```

`today` lấy bằng `academyDateOf()` lúc render. Mọi chữ mới có ở cả `coach-bouts.vi.ts` và `coach-bouts.en.ts`; xoá khoá cũ không còn dùng (`examHint`, `examSelectPlaceholder`, `examOption` nếu bỏ).

Repo không có thư viện mô phỏng DOM, và `Dialog` có thể dùng portal. Vì vậy tách phần thân hộp thoại thành component trình bày (ví dụ `SuspensionEarlyEndBody`) nhận props thuần, render được bằng `renderToStaticMarkup`. `SuspensionEarlyEndDialog` chỉ giữ state, submit và `Dialog`.

## Ngoài phạm vi

- Hộp thoại `/clear` (`suspension-clearance-dialog.tsx`).
- Kiểm phiếu bị thay (backend vẫn trả `SUPERSEDED`).
- Dữ liệu demo bác sĩ (T-052).

## Ca kiểm thử

Lớp: unit hàm thuần (P) hoặc render tĩnh `renderToStaticMarkup` component thân (R). Ngày học viện giả định `today = 2026-11-05`.

| Ca | Lớp | Đầu vào | Kết quả mong đợi |
| --- | --- | --- | --- |
| P1 | P | `endsOn 2026-11-16`, `today 2026-11-05` | `daysCut 11`, `gradedReturn { ceiling: 3, fullReturnOn: '2026-11-07' }` |
| P2 | P | `endsOn 2026-11-05`, `today 2026-11-05` | `daysCut 0`, `fullReturnOn '2026-11-07'` |
| P3 | P | `endsOn 2026-11-04`, `today 2026-11-05` (không xảy ra vì backend chặn, nhưng hàm phải an toàn) | `daysCut 0` |
| R1 | R | CLB, `MEDICAL`, `03/11–16/11`, một phiếu hợp lệ | markup chứa "Y tế", "03/11", "16/11", "Do CLB", "Rút ngắn 11 ngày" và vùng `GradedReturnSteps` (nhãn vùng của `gradedReturn.regionLabel`) |
| R2 | R | ban tổ chức, `issuerReference "QĐ 12/BTC ngày 31/10"` | markup chứa "Do ban tổ chức", chứa "QĐ 12/BTC ngày 31/10" ở khối đình chỉ **và** trong gợi ý của ô văn bản gỡ; có ô `lift-reference-input`; có vùng `GradedReturnSteps` |
| R3 | R | CLB, 0 phiếu hợp lệ | có link tới `clinicalLinks.newExaminationFor(fighterId)`; **không** có `early-end-note-textarea`, **không** có nút `type="submit"`, **không** có vùng `GradedReturnSteps` |
| R4 | R | CLB, 2 phiếu hợp lệ: A (`fit`, `validUntil 2026-12-01`), B (`fit_with_restrictions`, không `validUntil`) | 2 `input type="radio" name="examinationId"`, không radio nào `checked`; markup chứa "Đủ điều kiện", "Đủ điều kiện, có hạn chế", "Hiệu lực đến 01/12"; không còn `<select id="examination-select">` |
| R5 | R | CLB, đúng 1 phiếu hợp lệ | radio duy nhất có `checked` |
| R6 | R | CLB, 1 phiếu hợp lệ và 1 phiếu `scope COMPETITION` | chỉ 1 radio (bộ lọc `filterEarlyEndExaminations` vẫn áp) |
| R7 | R | ban tổ chức và CLB có phiếu | nút submit có chữ "Kết thúc đình chỉ"; nhãn ô ghi chú là "Ghi chú kết thúc" |
| I1 | P | từ điển vi và en | mọi khoá `suspensions.earlyEndDialog.*` có ở cả hai; không còn khoá nào trong nhóm này mà code không dùng |
| K1 | P | test T-050 hiện có (W1–W11, W2b, W2c) | vẫn qua. Ca nào khẳng định `examination-select` hay chữ cũ thì sửa theo thiết kế mới, giữ tên ca, ghi vào handover |

## Tiêu chí nghiệm thu

1. Mọi ca trên có test đúng tên và đúng kết quả mong đợi.
2. Ảnh chụp ở 1440 px và 375 px cho hộp thoại ban tổ chức và hộp thoại bác sĩ không có phiếu (demo mode; demo chưa có phiếu hợp lệ cho bác sĩ, đó là việc của T-052, nên nhánh có phiếu được kiểm bằng R4, R5). Ở 375 px không cuộn ngang, nút không tràn.
3. Tab đi được qua radio, ô nhập, nút; radio có nhãn bấm được cả dòng.
4. `lint`, `typecheck`, `test` của `nextjs-frontend` qua. Số test không giảm.

## Lệnh bắt buộc

`pnpm --filter nextjs-frontend lint` ; `pnpm --filter nextjs-frontend typecheck` ; `pnpm --filter nextjs-frontend test`
