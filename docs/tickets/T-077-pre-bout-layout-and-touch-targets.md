# T-077: bố cục và vùng chạm các màn Trước trận

- Trạng thái: **ĐỀ XUẤT** 18/11/2026. Làm **sau** buổi demo 19/11 (chủ dự án chọn 18/11). Không push lên `release/final-review` trước demo.
- Phạm vi: frontend `nextjs-frontend`. Không backend, không migration. Mục D cần đụng kiểu dữ liệu và bộ ánh xạ.
- Người làm: đề xuất Gemini `gemini-3.8-flash-high` cho A–C; mục D (số hiệp) giao người làm quen `bouts-contract.ts`. Claude review.
- Phụ thuộc: [T-076](./T-076-ai-text-audit-pre-bout.md) (cùng đụng `bout-analysis.vi.ts`, `bout-analysis.en.ts`; làm T-076 trước hoặc cùng người làm).
- Nhánh gốc: `origin/release/final-review` (nhánh Vercel build).

## Bối cảnh

Ghi chú review 3 của thầy, mục UI/UX, cộng một lượt rà các màn Trước trận (A1–A6, V1–V3 trong kịch bản demo) bằng bốn skill UI/UX (`design-critique`, `ux-copy`, `accessibility-review`, `ui-ux-designer`) ngày 18/11/2026. Đo trên bản deploy bằng script ở 390 px và 1280 px: không màn nào tràn ngang, không chỗ chữ nào dưới ngưỡng tương phản 4.5:1 (chỉ đo chữ trên nền đặc). Vấn đề còn lại là bố cục và kích thước vùng chạm.

Đã có **bản thử chạy ở máy Dan**: nhánh `trial/prebout-layout`, commit `3d056824`, worktree `D:/test/ai-worktrees/T-075`, **chưa push**. Ticket mô tả đầy đủ thay đổi để làm lại từ `origin/release/final-review` mà không cần bản thử.

## Số đo trước và sau (bản thử, đo ở máy)

| Mục | Trước (bản deploy) | Sau (bản thử) |
| --- | --- | --- |
| Nút "Vào tuần thi đấu" trang trận, 1280 px (khung nhìn cao 800) | y = 1049, dưới khung nhìn | y = 598, trong khung nhìn |
| Khoảng cách nút Sửa và nút Huỷ trận đấu, 1280 px | 8 px | 37 px, có vạch ngăn |
| Chiều cao ô nhập và ô chọn ở `/coach/bouts/new`, 390 px | 36 px | 44 px (1280 px giữ 36 px) |
| Vùng chạm nút thông tin "?" | 20 × 20 | 44 × 44, icon vẫn 20 px |
| Chữ chip cỡ nhỏ | 11 px | 12 px |
| A6 trên điện thoại | các mục "cần sửa" mở sẵn, đẩy hồ sơ đối thủ ra khỏi màn đầu | gấp lại, hồ sơ đối thủ ở màn đầu |

Hai trận dùng để đo khác nhau (bản deploy: trận Lotus Fight Night 14; bản thử: trận demo Asian Combat Series 9), nên con số chỉ so sánh gần đúng. Bản thử qua typecheck, lint và 1498 test frontend.

## Phạm vi

Đường dẫn dưới đây đã kiểm tra trong code của worktree T-075 (nhánh release cộng T-075).

**A. Trang trận** (`nextjs-frontend/src/app/(app)/coach/bouts/[boutId]/page.tsx`)

1. Đưa `NextStepCard` (chứa "Liên kết giáo án", "Vào tuần thi đấu" ...) ra khỏi cột trái của lưới và đặt ngay sau thẻ thông tin, trước `CampTimeline`, bọc trong `<div className="mb-6 empty:hidden">` (một số giai đoạn không có thẻ này).
2. Bọc `CancelBoutButton` trong `<span className="sm:ml-3 sm:border-l sm:border-border sm:pl-4">` để tách khỏi nút Sửa.

**B. Phân tích đối thủ** (`.../opponent-analysis/opponent-analysis-view.tsx`)

3. Thêm trạng thái `showFixes` (mặc định `false`). Thêm một nút bật tắt `lg:hidden` trên danh sách `toFix`, và danh sách có `max-lg:hidden` khi chưa mở. Từ `lg` trở lên danh sách luôn hiện. Tiêu đề thẻ vẫn ghi "N cần sửa".
4. Khoá i18n mới trong `bout-analysis.vi.ts` và `bout-analysis.en.ts`: `boutAnalysis.analysis.showFixes` ("Xem {count} mục cần sửa" / "Show {count} to fix") và `boutAnalysis.analysis.hideFixes` ("Ẩn mục cần sửa" / "Hide items to fix").

**C. Thành phần dùng chung** (rủi ro cao: ảnh hưởng mọi form)

5. `nextjs-frontend/src/components/ui/form.tsx`: `Input` (cả nhánh có `suffix`) và `Select` từ `h-9` thành `h-11 sm:h-9`. Không đổi `Textarea`.
6. `nextjs-frontend/src/components/domain/term-hint.tsx`, `InfoHint`: thêm `relative` và `after:absolute after:-inset-3 after:content-['']` vào nút để vùng chạm thành 44 × 44; icon vẫn `size-5`.
7. `nextjs-frontend/src/components/ui/badge.tsx`: kích thước `sm` từ `text-[11px]` thành `text-xs`.

**D. Số hiệp trên trang trận** (không có trong bản thử)

8. Trang trận không hiện số hiệp ở đâu, nên trận 2 hiệp tạo ở form không "thấy" được trên màn HLV. Thêm dòng "Số hiệp" vào `DescriptionList` của thẻ thông tin ở `page.tsx`. Việc này cần: thêm `scheduledRounds: number | null` vào `CampBout` (`nextjs-frontend/src/lib/domain/bout.ts:177`, hiện không có trường này), đọc trường từ API trong bộ ánh xạ ở `nextjs-frontend/src/lib/domain/bouts-contract.ts` (API trả `scheduledRounds`, xem `nestjs-api/src/bouts/bouts.model.ts:1103`; người làm xác nhận đây đúng là schema trả về của bout), và gán trong demo store `nextjs-frontend/src/lib/services/bouts.demo.ts`. Khoá i18n mới `boutDetail.summary.rounds` cho cả `bout-detail.vi.ts` và `bout-detail.en.ts` ("Số hiệp" / "Rounds"). Giá trị `null` hiện "—".

## Ngoài phạm vi

- Thẻ phân tích AI dẫn đầu ở Hôm nay của võ sĩ (V1): `fighter/dashboard/page.tsx:136` chỉ cho nó dẫn đầu khi võ sĩ chưa có trận, nên khi Dan tạo trận ở A1 thì thẻ trận dẫn đầu. Chưa kiểm được bằng chạy thật vì demo mode không có trận cho Minh. Không sửa.
- Video "Đánh bóng — 18/11/2026" lặp 3 lần ở V1, nhãn "LC25" không giải thích, dải nội dung hở giữa thanh "Lưu phân tích" và thanh tab dưới (cách nhau 23 px ở A6), các chữ 11 px khác (ví dụ `components/domain/camp-timeline.tsx`, `suspension-early-end-dialog.tsx`). Ghi lại, chưa làm.
- Các chỗ chữ "gợi ý" và ô Mục tiêu giữ chỗ: thuộc T-076.

## Ca kiểm thử và tiêu chí nghiệm thu

1. Ở 1280 px (khung nhìn 1280 × 800), trên trang trận giai đoạn `SCHEDULED` và `FIGHT_WEEK` của demo mode, nút hành động chính của `NextStepCard` có `top` nhỏ hơn 800. Ghi số đo vào handover.
2. Ở 390 px, ô nhập, ô chọn của `/coach/bouts/new` cao 44 px; ở 1280 px cao 36 px.
3. **Rà các form dùng chung trước khi merge** (mục C ảnh hưởng mọi form): ít nhất `/coach/sessions/new`, form ghi cân, form tạo trận, form kết quả, hộp thoại sửa trận, ở 390 px và 1280 px. Chụp màn, ghi bất kỳ chỗ nào lệch lưới hoặc tràn ngang vào handover.
4. Nút "?" có `::after` 44 × 44; icon vẫn 20 px; không đổi vị trí chữ xung quanh.
5. Ở 390 px, thẻ "Kế hoạch" ở A6 mặc định gấp lại, nút mở có `aria-expanded`, hồ sơ đối thủ nằm trong khung nhìn đầu tiên; ở 1280 px danh sách vẫn hiện và nút mở bị ẩn.
6. Mục D: test cho bộ ánh xạ (`bouts-contract.test.ts`) và demo mode: trận tạo với 2 hiệp hiện "2" trên trang trận; trận không có số hiệp hiện "—".
7. Không có thay đổi hành vi nào ngoài nêu trên. Không test hiện có nào bị đổi kết quả mong đợi; test nào ghim chiều cao hoặc chữ cũ thì sửa giá trị và ghi tên test vào handover.

## Lệnh kiểm tra bắt buộc

```text
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```

## Thời điểm và nhánh

- Làm sau buổi demo 19/11. Nhánh `feat/T-077-pre-bout-layout` tạo từ `origin/release/final-review` mới nhất; không merge, không push lên `release/final-review` trước khi Claude APPROVED.
- Mục C đụng thành phần dùng chung nên nên tách commit riêng để dễ hoàn lại nếu form nào bị lệch.
