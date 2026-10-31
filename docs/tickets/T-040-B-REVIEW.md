# T-040 phần B · Review (Claude trên máy Ken, 31/10)

- **Nhánh:** `feat/T-040-demo-seed`, tạo từ `fight-camp` `77a95eb`.
- **Người làm:**
  - Bản đầu: subagent Claude, theo yêu cầu của Ken. Quy tắc: `agy` không gọi được thì giao subagent.
  - Lượt sửa 1: `agy` `gemini-3.8-flash-high`.
- **Ca kiểm thử:** Claude viết trước code, ở ticket mục "B · Thiết kế và ca kiểm thử", gồm S1–S11. Lượt sửa thêm S12–S14.
- **Kết luận: APPROVED** cho phần script. Tiêu chí 6 còn hai nguồn chờ chủ dự án quyết, xem dưới.

## Lệnh Claude chạy lại

- `node --test nestjs-api/scripts/demo-seed.test.mjs`: `pass 14`, `fail 0`.
- `node nestjs-api/scripts/demo-seed.mjs --dry-run` (env giả, URL `http://127.0.0.1:9`): exit 0, `created=120 existing=0`, không gửi request nào.
- `pnpm --filter nestjs-api build`: exit 0.
- Subagent báo `lint` của backend 0 lỗi, 37 cảnh báo có sẵn; Claude chưa tự chạy lại lệnh này. Thư mục `scripts/` không nằm trong phạm vi quét của lint.
- S11: không có token, mật khẩu thật hay URL thật trong hai file script. Test chỉ dùng `http://fake.invalid`.

## Review độc lập (2 lần, không mang ngữ cảnh)

**Lần 1: KHÔNG ĐẠT.** Request, body, quyền và guard thời gian đều khớp backend. Các vấn đề:

| # | Mức | Vấn đề | Xử lý |
| --- | --- | --- | --- |
| 1 | chặn | Võ sĩ 4 không còn buổi `SCHEDULED` xung đột, vì `POST /suspensions` tự áp R28 (`suspensions.service.ts:136`). Test S10 qua vì API giả không mô phỏng R28. Lỗi nằm ở đặc tả: ticket, và ca S10 do Claude chép theo ticket mà không đối chiếu T-036 | Sửa S10 trong ticket. Ghi mâu thuẫn dưới tiêu chí 6 |
| 2 | chặn | `SUSPENSION_AWAITING_CLEARANCE` không tạo được trong ngày chạy script | Ghi dưới tiêu chí 6. Ken không làm bước chạy trước một ngày, vì ngoài phạm vi ticket |
| 3 | nên sửa | Gợi ý AI chỉ tạo được ở lần chạy đầu. Chạy lại với `--with-ai` thì bỏ qua mà không báo gì | Lượt sửa 1: in cảnh báo (S12) |
| 4 | nên sửa | Gợi ý `FAILED` bị tính là "đã có", nên không bao giờ thử lại | Lượt sửa 1: chỉ tính gợi ý `OK` (S13, S14) |
| 5 | gợi ý | Coach demo đăng nhập bị 401 thì cả lượt chạy dừng mà không nói lý do | Lượt sửa 1: báo rõ lý do rồi dừng |

**Lần 2 (cho lượt sửa 1): ĐẠT.** Script đọc đúng field `status` của gợi ý, theo `bout-analysis.model.ts:29`. S12–S14 không qua bất kể code. Còn các gợi ý chưa làm:
- Đổi tên S12 thành "không POST /ai/" cho khớp assertion.
- Tra gợi ý nên lọc `?kind=PRE_BOUT_TACTICS`.
- Nhánh 401 của coach chưa có test.
- API giả chưa trả 409 khi POST AI lên trận đã `COMPLETED`.

## Chờ chủ dự án

Tiêu chí 6 đòi hai nguồn không tạo được qua API với ràng buộc của chính ticket. Chi tiết và dòng code ghi ngay dưới tiêu chí 6 trong [T-040](./T-040-real-backend-demo.md). Đề nghị bỏ hai nguồn này khỏi tiêu chí.

Kết quả trên Supabase (tiêu chí 5, 6) do Ken kiểm khi chạy thật ở phần C.
