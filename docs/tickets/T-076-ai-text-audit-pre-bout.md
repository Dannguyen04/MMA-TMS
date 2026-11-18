# T-076: rà soát chữ do AI sinh trên các màn Trước trận

- Trạng thái: **ĐỀ XUẤT** 18/11/2026, chờ chủ dự án chọn làm trước hay sau buổi demo 19/11 (xem "Thời điểm")
- Phạm vi: frontend `nextjs-frontend`, chỉ chữ trong i18n và một ô trên dashboard võ sĩ. Không backend, không migration, không đổi logic.
- Người làm: đề xuất Gemini `gemini-3.8-flash-high` (việc theo khuôn). Claude review.
- Phụ thuộc: không. Nhánh gốc `origin/release/final-review` (nhánh Vercel build).

## Bối cảnh

Ghi chú của thầy ở review 3, mục UI/UX: "Rà soát các thông tin không cần thiết do AI gen trên UI". Ticket này chỉ rà **phần Trước trận** của Dan (bước A1–A6 và V1–V3 trong kịch bản demo `DEMO-KICH-BAN-4-NGUOI (1).md`). Các phần Trong trận, Sau trận, Phòng video, Bác sĩ do người khác rà.

Cách rà: mở bản deploy `mma-tms-demo.vercel.app` ngày 18/11/2026 bằng tài khoản HLV (Rafael) và võ sĩ (Minh), đọc toàn bộ chữ trong `<main>` của từng màn, lọc các dòng nhắc AI, "gợi ý", "ước tính", "tự động". Trận của Aigerim (`Lotus Fight Night 14`) dùng làm mẫu cho màn trận và phân tích đối thủ vì Minh chưa có trận mới.

## Kết quả rà

| Màn | Chữ nhắc AI hoặc chữ thừa | Quyết định |
| --- | --- | --- |
| A1 Trận đấu mới, A2–A5 trang trận | Không có chữ nào nhắc AI | Không đổi |
| V2 Trận đấu, V3 Ghi cân (võ sĩ) | Không có chữ nào nhắc AI | Không đổi |
| A6 Phân tích đối thủ | "Kế hoạch: 2 cần sửa · 4 gợi ý", "Cập nhật ngay khi nhập, trước khi lưu. Chỉ là gợi ý; HLV quyết định.", "Xem 4 gợi ý". Đây là **kiểm tra theo quy tắc**, không phải AI, nhưng dùng chữ "gợi ý" giống nút AI "Gợi ý từ video (AI)" ngay bên dưới | **Sửa** (S1) |
| A6 | Nút "Gợi ý từ video (AI)", ghi chú "AI gợi ý từ video, HLV đã duyệt" | Giữ: cho biết nguồn và việc HLV duyệt |
| V1 Hôm nay (võ sĩ) | Ô **Mục tiêu**: "Chưa có" kèm "Mục tiêu sẽ có ở bản sau" | **Bỏ** (B1): chữ giữ chỗ cho tính năng chưa làm |
| V1 | Thẻ "Phân tích AI mới nhất" có "Do AI tạo", "Chờ HLV duyệt"; chân danh sách "Kết quả AI ước tính từ video của bạn. HLV sẽ duyệt lại." | Giữ: là lời công khai AI và bước duyệt của HLV |
| V1 | Video "Đánh bóng — 18/11/2026" xuất hiện **ba lần**: thẻ "Phân tích AI mới nhất" và hai dòng trùng tên, trùng giờ trong danh sách "Từ góc đài" | **Kiểm** (K1) |
| V1 | Video "Heavy bag — 25 Oct 2026 (Reanalysis)", đang chờ 3 tuần, tên tiếng Anh | Dữ liệu test, chủ dự án xử lý (K2) |

Nguyên tắc giữ: mọi chỗ nói rõ "do AI tạo", "AI ước tính" hoặc "HLV sẽ duyệt" là lời công khai về AI và vai trò quyết định của HLV, không bỏ. Chỉ bỏ chữ giữ chỗ và chữ gọi nhầm một kiểm tra quy tắc là AI.

## Phạm vi

**S1. Tách chữ "gợi ý" của kiểm tra quy tắc khỏi AI.** Ở cả `vi` và `en`, trong `nextjs-frontend/src/lib/i18n/messages/bout-analysis.vi.ts` và `bout-analysis.en.ts` (tên khoá đã kiểm tra, dùng ở `src/app/(app)/coach/bouts/[boutId]/opponent-analysis/opponent-analysis-view.tsx`):

- `boutAnalysis.analysis.checkDesc` (vi dòng 83): bỏ vế "Chỉ là gợi ý; ", còn "Cập nhật ngay khi nhập, trước khi lưu. HLV quyết định." Bản en dòng 81: "Updates as you type, before saving. The coach decides."
- `boutAnalysis.analysis.healthTitle` (vi dòng 105): "Kế hoạch: {fix} cần sửa · {tips} lưu ý". Bản en dòng 103: "Plan: {fix} to fix · {tips} notes".
- `boutAnalysis.analysis.showTips` (vi dòng 107): "Xem {count} lưu ý". `boutAnalysis.analysis.hideTips` (vi dòng 108): "Ẩn lưu ý". Sửa bản en tương ứng ("notes" thay cho "tips" nếu bản en đang dùng chữ đó).
- **Không** đổi `boutAnalysis.analysis.ai.open` ("Gợi ý từ video (AI)"), `boutAnalysis.analysis.ai.note`, `boutAnalysis.advice.coachDecisionNote`: những chữ này đúng là AI.

**B1. Bỏ chữ giữ chỗ "Mục tiêu sẽ có ở bản sau".** Trong `src/app/(app)/fighter/dashboard/page.tsx` (ô `ReadinessCell` mục tiêu quanh dòng 256–276, khoá `fighterToday.goalsLater` ở dòng 267): khi `goalsAvailable` là `false` thì **không hiển thị cả ô Mục tiêu**, thay vì hiện "Chưa có / Mục tiêu sẽ có ở bản sau". Ô dùng `className="sm:col-span-3 lg:col-span-1"` nên kiểm lưới còn đều ở 390 px và 1280 px khi thiếu một ô. Khoá `fighterToday.goalsLater` có thể xoá khỏi `fighter-today.vi.ts` (dòng 19) và `fighter-today.en.ts` (dòng 17) nếu không còn chỗ nào dùng; kiểm bằng grep trước khi xoá. Khi `goalsAvailable` là `true`, giữ nguyên.

**K1. Tìm nguyên nhân video lặp ở V1.** Danh sách "Từ góc đài" nằm ở `src/components/dashboard/corner-feed.tsx` (tiêu đề `feed.title`). Xác định "Đánh bóng — 18/11/2026" xuất hiện hai lần là hai video thật cùng tên hay lỗi hiển thị (render lặp). Nếu là lỗi hiển thị, sửa và thêm test. Nếu là dữ liệu, **không sửa code**, ghi vào handover cho chủ dự án.

## Ngoài phạm vi

- Không đổi chữ ở Trong trận, Sau trận, Phòng video, Bác sĩ, admin.
- Không bỏ lời công khai AI ("Do AI tạo", "Chờ HLV duyệt", "Kết quả AI ước tính…").
- Không đổi logic kiểm tra kế hoạch, không đổi API, không thêm khoá i18n ngoài việc đổi nội dung các khoá nêu trên.
- K2 (video test "Heavy bag — 25 Oct 2026 (Reanalysis)") là dữ liệu trên Supabase, người làm không đụng tới.

## Tiêu chí nghiệm thu

1. Trên màn Phân tích đối thủ, không còn chữ "gợi ý" nào cho kiểm tra quy tắc; nút "Gợi ý từ video (AI)" giữ nguyên. Cả `vi` và `en` đều đổi.
2. Trên Hôm nay của võ sĩ, khi mục tiêu chưa có (`goalsAvailable` là `false`), không còn ô Mục tiêu và không còn chữ "Mục tiêu sẽ có ở bản sau". Lưới không lệch ở 390 px và 1280 px (chụp màn, đính kèm handover).
3. K1: handover nói rõ kết luận (dữ liệu hay lỗi hiển thị) và việc đã làm.
4. Không test hiện có nào bị đổi kết quả mong đợi; test nào ghim chữ cũ thì sửa **chữ**, ghi tên test vào handover.
5. Hai file i18n vi và en luôn có đủ cùng bộ khoá.

## Lệnh kiểm tra bắt buộc

```text
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```

## Thời điểm

Buổi demo là 19/11. Mỗi lần push lên `release/final-review` làm Vercel build lại và Render khởi động lại backend (xem `docs/DEPLOY-DEMO.md` trên nhánh `release/final-review`). Vì vậy đề xuất **làm và push sau buổi demo**, trừ khi chủ dự án chọn làm trước và push chậm nhất vài giờ trước giờ chiếu. S1 và B1 là đổi chữ nên rủi ro thấp; K1 có thể kéo dài nếu là lỗi hiển thị.
