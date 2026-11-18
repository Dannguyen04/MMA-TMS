# T-037B Review

- Nhánh: `release/final-review`. Chủ dự án giao phần của Fon cho Claude ngày 9/11; một agent làm, Claude review.
- **Kết luận: APPROVED.**

## Phạm vi đã làm

- **Khối "Hiệp sau"** (`next-round-plan.tsx`, commit `8119523`):
  - Tối đa 3 lời dặn, lấy từ đề xuất của app hoặc tự gõ; `SAFETY_CHECK` được chọn sẵn.
  - Tối đa 2 chiến thuật trọng tâm và tối đa 2 chiến thuật mới.
  - Lưu bằng `PUT …/rounds/:roundNo` chỉ với `nextRoundPlan`.
  - Thẻ góc đài có nhãn "Trọng tâm" và "Thêm ở hiệp n".
- **Chế độ ghi giữa hiệp:**
  - Chỉ mở hiệp đang ghi. Hiệp đã ghi thu gọn thành một dòng, có nút "Sửa hiệp n".
  - Mặc định có 4 chạm: 2 chiến thuật đang dặn, 1 quan sát chính và HLV tự chấm. Phần còn lại nằm sau "Ghi thêm".
  - Phần tính toán nằm ở `src/lib/domain/rounds-view-model.ts`, có 14 test.

## Đối chiếu tiêu chí

| Tiêu chí | Kết quả |
| --- | --- |
| 1. Ca test chép từ backend qua | `round-advice.test.ts` (T-037) và `rounds-view-model.test.ts`: 42/42 qua khi Claude chạy lại |
| 2. Demo mode: kế hoạch hiệp 1 hiện đúng khi mở lại; nhãn trên thẻ góc đài; hiệp 2 chấm được chiến thuật mới | `bout-analysis.demo.test.ts` (T-037 B). Claude kiểm thêm trên trình duyệt ở 375 px |
| 3. Hiệp cuối không có khối "Hiệp sau" | `advice` là null khi đã ghi đủ số hiệp; demo store trả `BOUT_NEXT_ROUND_PLAN_LAST_ROUND` (có test) |
| 4. API mode | Contract khớp backend `bout-analysis.model.ts`. Chưa chạy màn ghi hiệp mới ở API mode |
| 5. 390 px | Không cuộn ngang. Trước khi ghi: 0,78 màn hình. Sau hiệp 1: 2,01 màn hình. Không còn chạm nào dưới 44 px |
| 6. lint, typecheck, test | Các file của ticket lint sạch; typecheck API mode sạch; UAT demo 15/15 (lượt RV1) |

## Lệch so với ticket (chấp nhận)

- `page-header.tsx` dùng chung cho mọi trang. Link "quay lại" giờ cao 44 px nhưng có lề âm, nên bố cục các trang không đổi.
- Phần "Thế trận và thứ hạng chiến thuật" được gập lại để hiệp đang ghi cùng khối "Hiệp sau" vừa khoảng 2 màn hình.
- Lượt nghỉ trước chỉ chọn 1 trọng tâm thì màn chỉ hiện 1, không tự thêm cho đủ 2.

## Vấn đề

Không có vấn đề mức chặn. Gợi ý: chạy thử màn ghi hiệp ở API mode với một trận có từ 3 hiệp trở lên.
