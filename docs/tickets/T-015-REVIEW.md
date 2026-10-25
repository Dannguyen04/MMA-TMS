# T-015 Review

- Ngày review: 25/10/2026, Claude.
- Phạm vi: `feat/T-015-i18n-training`, 71 file (chỉ `nextjs-frontend/src` và handover). Gồm hai commit WIP do Claude commit sau hai lượt Gemini bị ngắt (`f597c54`, `8f56de6`), merge `fight-camp` (`cb1aeb3`) và 10 commit Gemini lượt 3 (`8514118` … `b7ad1f0`).
- **Kết luận: APPROVED.** Không có vấn đề mức "chặn".

## Lệnh đã chạy lại (tại `b7ad1f0`)

```text
typecheck     : ✓ Types generated successfully
test          : Test Files  76 passed | 1 skipped (77)
                     Tests  657 passed | 2 skipped (659)
eslint src e2e: không có lỗi
```

Khớp handover.

## Đối chiếu tiêu chí

| Tiêu chí | Kết quả | Ghi chú |
| --- | --- | --- |
| 1 | Đạt | Claude dò 59 file `.tsx` đã sửa (chữ JSX và `aria-label`/`title`/`placeholder` bắt đầu bằng chữ Anh hoa): không còn chỗ nào |
| 2 | Đạt (theo test) | Test hiện có, viết theo chữ Anh, vẫn qua |
| 3, 5, 7 | Đạt | Theo handover và test |
| 4 | Đạt | `clearance-rules.ts` không còn trả câu chữ; test cập nhật ở `ad77a9c` |
| 6 | Chưa kiểm tay | Handover chỉ suy luận từ code (`stackOnMobile`, flex-wrap) |

## Vấn đề

| # | Mức | Vị trí | Vấn đề | Xử lý |
| --- | --- | --- | --- | --- |
| 1 | Nên sửa | Tiêu chí 6 | Chưa mở thật ở 390 px | Hoàng Anh xem bảng buổi tập và lịch tuần ở 390 px sau khi merge; lỗi thì mở ticket nhỏ |
| 2 | Gợi ý | Quy trình | Lượt 3 vẫn tốn 1,45 triệu token đầu vào do vòng "Đang chạy … và chờ kết quả" | Prompt sau nhắc lại: chạy lệnh ở chế độ thường |
