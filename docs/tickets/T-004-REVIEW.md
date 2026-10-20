# T-004 Review

- Nhánh: `feat/T-004-coach-bouts-ui`, commit đã review: `4f02543` (code ở `600101a`)
- Người review: Claude, 19/10/2026
- **Kết luận: APPROVED**, kèm 3 vấn đề mức "nên sửa". Nên sửa trước buổi review 20/10 nếu kịp, nhưng không chặn merge.

## Lệnh đã chạy lại (worktree `D:/test/ai-worktrees/T-004`, working tree sạch)

```text
$ pnpm --filter nextjs-frontend lint
$ eslint
lint exit 0

$ pnpm --filter nextjs-frontend typecheck
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully

$ pnpm --filter nextjs-frontend test
 Test Files  71 passed | 1 skipped (72)
      Tests  612 passed | 1 skipped (613)
```

Kết quả khớp với output trong handover.

## Đối chiếu tiêu chí nghiệm thu

Kiểm tra tay ở demo mode bằng Playwright, chạy trên Edge, với tài khoản HLV `u-rafael-costa`. Script nằm trong scratchpad của Claude, không commit. Dev server chạy từ nhánh T-005, nhánh này chứa toàn bộ code T-004 đến `600101a`.

| # | Tiêu chí | Kết quả | Bằng chứng |
| --- | --- | --- | --- |
| 1 | Menu có "Bouts"; danh sách có đủ 3 trận seed, đúng badge cân và Cổng 1 | Đạt | Có 3 trận của Rafael. Trận của Anna Volkova không hiện. Badge: Saigon Warriors "Exceeds cut limit" + "Gate 1: Passed"; National Boxing Cup "On track" + "Gate 1: Missing 1"; Lotus "On track" + "Gate 1: Passed" |
| 2 | Tạo trận VMMAF 60 kg; "Tự nhập" 63,5 kg lưu đúng 63,5 | Đạt | Hai trận "Review Cup VMMAF" (Emma Lindqvist) và "Review Cup Custom" (Linh Phạm) có trong danh sách; trận sau hiện 63.5 |
| 3 | Cân sau giờ thi → lỗi tại trường, không gửi | Đạt | Vẫn ở `/coach/bouts/new`, lỗi tại trường: "Weigh-in must be before the bout." |
| 4 | Thiếu hồ sơ → Enter fight week hiện mục thiếu, trạng thái không đổi; đủ hồ sơ → vào được | Đạt | Dialog liệt kê "Pre-bout Medical Certificate"; xác nhận khi còn thiếu thì trạng thái vẫn Camp. Sửa mục thành PROVIDED, hạn 01/03/2027, thì vào được Fight week |
| 5 | Trận của võ sĩ ngoài roster → 404 | Đạt | `/coach/bouts/bout-unassigned-lucas` render trang 404. HTTP vẫn 200 vì streaming của Next, giống các trang khác trong app |
| 6 | `bout-rules.test.ts` có ví dụ T-003 tiêu chí 1, 2, 4 | Đạt | Có các nhóm Criterion 1, 2, 3, 4, 12b; nằm trong 612 test đã qua |
| 7 | 390 px không cuộn ngang | Đạt | `scrollWidth = innerWidth = 390` ở `/coach/bouts`, `/coach/bouts/new`, `/coach/bouts/bout-red-weight` |
| 8 | Bảng trường adapter API và nguồn T-003 | Đạt | Có trong handover. Chưa đối chiếu với backend thật vì T-003 chưa có nhánh |

## Vấn đề

| # | Mức độ | Vị trí | Vấn đề | Cách tái hiện |
| --- | --- | --- | --- | --- |
| 1 | Nên sửa | `src/components/layout/mobile-nav.tsx:81` | Thêm "Bouts" làm menu HLV có 6 mục, nhưng `GRID_COLS` chỉ có 4 và 5. Thanh menu dưới rơi về `grid-cols-4`, gãy thành 2 hàng và che nội dung (Film, Clearance nằm hàng 2). Đây là hồi quy do ticket gây ra: trước T-004 HLV có 5 mục | Mở bất kỳ trang HLV nào ở bề rộng 390 px |
| 2 | Nên sửa | `src/app/(app)/coach/bouts/[boutId]/bout-checklist-card.tsx`, phần `CardHeader` của "Medical checklist" | Ở 390 px, badge "Gate 1" và nút "Add item" chiếm hết chỗ, mô tả bị ép còn một chữ một dòng ("Gate / 1 / eligibility / …") | `/coach/bouts/bout-red-weight` ở 390 px |
| 3 | Gợi ý | `src/app/(app)/coach/bouts/[boutId]/page.tsx`, thẻ "Fight camp" | Trận đã ở `CAMP` mà chưa gắn plan (cả 3 trận seed) vẫn hiện "Link a fight_camp training plan to transition this bout to CAMP status". Câu này sai với trạng thái hiện tại, và `fight_camp` là mã kỹ thuật | Mở `/coach/bouts/bout-red-weight` |

Ghi chú, không phải lỗi của ticket: theo dữ liệu seed, ba trận đều đang ở `CAMP` mà `trainingPlanId = null`. Vì vậy ngày bắt đầu camp lấy theo ngày tạo trận, đúng như T-003 §3.

## Vòng 2 (19/10)

Gemini sửa cả 3 vấn đề ở `253dc17` (handover cập nhật ở `34bb30b`). Claude đã đọc diff và kiểm tra ở 390 px trên nhánh T-005, nhánh này đã merge `34bb30b`:

1. `mobile-nav.tsx`: thêm `6: "grid-cols-6"`. Thanh menu dưới của HLV nằm trên một hàng, cao 57 px. **Đã sửa.**
2. `bout-checklist-card.tsx`: header xếp dọc trên màn hẹp, badge và nút xuống dòng riêng. **Đã sửa.**
3. `page.tsx`, thẻ "Fight camp": câu hiển thị theo trạng thái, không còn mã `fight_camp`; phase hiển thị bằng `TRAINING_PHASE_LABELS`. **Đã sửa.**

Lint, typecheck và test chạy lại trên nhánh T-005 sau khi merge đều qua (73 file test, 629 test).

**Kết luận: APPROVED.** Thứ tự merge vào `fight-camp`: T-004 trước, rồi T-005.
