# Kịch bản trình bày 27/10: trước, trong và sau trận

**Mục tiêu.** Ở review 2 (20/10), giảng viên nhận xét: phần trước trận ổn; phần trong và sau trận chưa rõ nghiệp vụ, người dùng tự làm hầu hết, hệ thống chủ yếu nhận dữ liệu. Buổi này cần cho thấy ở mỗi bước **người dùng làm gì (ít) và app tự làm gì (nhiều)**, nhất là trong và sau trận. Ví dụ giảng viên gợi ý là phân tích đối thủ giữa các hiệp; đây là phần trọng tâm (bước 9).

**Chế độ chạy:** demo mode (không cần backend, dữ liệu mẫu trong bộ nhớ). Mọi quy tắc nói dưới đây đã có ở backend thật và có unit test; demo mode cho thấy cùng hành vi trên giao diện.

**Thời lượng gợi ý:** 12–15 phút. Trước trận 3 phút, trong trận 6 phút, sau trận 4 phút, hỏi đáp phần còn lại.

**Người trình bày** (chủ dự án chốt 26/10): trước trận **Hoàng Anh** (màn HLV); trong trận **Dan** (phần giảng viên hỏi nhiều nhất, R20–R26); sau trận **Ken** (đình chỉ, Cổng 2, bảng sẵn sàng). Fon chạy máy và chuyển màn.

**Nhánh chạy demo:** `sync/T-004-fight-camp` (frontend của Hoàng Anh đưa lên `fight-camp`, cộng T-010 B). Chạy: `cd nextjs-frontend && APP_DATA_MODE=demo pnpm dev`, mở `http://localhost:3000`.

**Một câu mở đầu:** "App quản lý một võ sĩ qua vòng đời một trận. Người dùng chỉ nhập những gì chỉ họ biết; mọi kiểm tra, cảnh báo và hệ quả do app tự làm."

Ký hiệu màn: **Có** = đã có trên nhánh demo; **Đang làm** = Gemini/Codex làm hôm nay 26/10, Claude kiểm trước tối 26/10; **Dự phòng** = cách trình bày nếu màn chưa xong.

## 1. Trước trận (3 phút, đã duyệt ở review 2, đi nhanh)

| # | Nghiệp vụ | Người dùng làm | App tự làm | Màn |
| --- | --- | --- | --- | --- |
| 1 | Tạo trận | HLV nhập giải, bộ luật, hạng cân, ngày cân, ngày thi, đối thủ, số hiệp | Kiểm tra phạm vi HLV, ngày giờ; chụp quy định của bộ luật; sinh checklist hồ sơ; **kiểm tra khả thi về cân** (R31): vượt ngưỡng thì cảnh báo nhưng vẫn cho lưu | `/coach/bouts/new` · Có |
| 3 | Kiểm soát cân | Võ sĩ ghi một số kg mỗi sáng | Đường tham chiếu, trạng thái theo ý nghĩa (đúng tiến độ, cao hơn mục tiêu, vượt giới hạn, chưa cân); từ ngày cân không tính màu nữa | `/fighter/bout/weigh-in`, chi tiết trận · Có |
| 5 | Hồ sơ thi đấu | HLV đánh dấu giấy tờ đã có | Hạn nộp, nhãn trễ hạn, **Cổng 1** chặn vào tuần thi đấu khi thiếu hồ sơ | Chi tiết trận · Có |
| — | Việc cần làm | Không nhập | Thẻ trên dashboard HLV gom việc từ mọi trận: hồ sơ sắp hạn, cân vượt, chiến thuật chưa luyện, đủ điều kiện vào tuần thi đấu, hôm nay cân chính thức, quá ngày chưa ghi kết quả | `/coach/dashboard` · Có |

Câu chuyển: "Đến đây là phần thầy đã xem. Phần mới là trong và sau trận."

## 2. Trong trận (6 phút, trọng tâm)

| # | Nghiệp vụ | Người dùng làm | App tự làm | Màn |
| --- | --- | --- | --- | --- |
| 7 | Tuần thi đấu | Bấm "Vào tuần thi đấu" | Chỉ cho vào khi Cổng 1 đạt; khoá hồ sơ; nhắc võ sĩ ghi cân mỗi ngày (hôm nay chưa cân, hôm qua thiếu cân) | Chi tiết trận · Có |
| 8 | Cân chính thức | HLV nhập số cân và kết quả kiểm tra nước | Đạt: tự sang "Đã cân". Không đạt: **chỉ hỏi một câu**, catchweight hay huỷ. Giảm cân cấp tốc vượt ngưỡng: gắn cờ đỏ | Chi tiết trận · Có (nhánh Hoàng Anh, Codex đang đưa lên nền mới) |
| 9a | Thẻ góc đài | Xem trên điện thoại hoặc in A4 | Dựng từ phân tích đối thủ: chiến thuật có căn cứ lặp lại xếp trước, chiến thuật đã luyện xếp trước; nhãn "Chưa luyện"; cờ giảm cân cấp tốc | `/coach/bouts/[id]/corner-card` · Có (chạy thử 26/10) |
| 9b | **Giữa các hiệp** | Trợ lý ghi mỗi hiệp: chiến thuật hiệu quả hay không, quan sát có thấy lại không, HLV tự chấm hiệp, bị ngã, choáng | **Xếp lại chiến thuật cho hiệp sau** (R21): chiến thuật không hiệu quả 2 hiệp liền bị đưa xuống; chiến thuật chưa dùng cùng căn cứ với chiến thuật đang hiệu quả được đẩy lên. **Cảnh báo đối thủ đã đổi lối đánh** (R22) khi quan sát không thấy lại 2 hiệp. **Thế trận** (R23): đang dẫn, cần thắng N hiệp, hay khó thắng điểm. **Cảnh báo an toàn** (R24): bị ngã 2 lần hoặc choáng 2 hiệp liền thì báo đỏ "Cân nhắc dừng trận, báo bác sĩ của giải" | `/coach/bouts/[id]/rounds` · Có (chạy thử 26/10) |
| 10 | Ghi kết quả | HLV 2 chạm: kết quả, cách kết thúc; thua KO/TKO thêm 2 câu | **Điền sẵn** hiệp kết thúc và việc bị ngã từ bản ghi các hiệp (R25); kiểm tra mâu thuẫn (hiệp kết thúc vượt số hiệp; thắng điểm mà mới ghi 2/3 hiệp thì hỏi lại) (R26); trận sang "Đã xong" | Chi tiết trận · Có (nhánh Hoàng Anh) |

**Cách diễn bước 9b** (dữ liệu demo: đăng nhập bằng nút demo **HLV Rafael Costa** ở `/login`; trận `bout-weighed-in`, võ sĩ Diego Alvarez gặp Lê Hoàng Nam, 3 hiệp, đã cân 64,8 kg; mở `/coach/bouts/bout-weighed-in/corner-card` và `/coach/bouts/bout-weighed-in/rounds`). Claude chạy thử bằng Playwright ở 390 px ngày 26/10: hai màn dựng đúng, không cuộn ngang, không lỗi; lời dặn hiện sau khi lưu hiệp 1.

**Trước khi trình bày, khởi động lại server demo:** dữ liệu demo nằm trong bộ nhớ server, các hiệp đã ghi lúc tập sẽ còn lại (đủ 3/3 hiệp thì lời dặn không hiện nữa, đúng thiết kế).

1. Mở thẻ góc đài: chỉ cho thầy thứ tự chiến thuật và nhãn "Chưa luyện".
2. Ghi hiệp 1: bấm "Thua hiệp"; chiến thuật đầu tiên "Không hiệu quả"; quan sát đầu tiên "Không thấy"; số lần bị ngã 1; "Lưu hiệp 1". Lời dặn trước hiệp 2 hiện ngay ở đầu trang.
3. Ghi hiệp 2: lại "Thua hiệp"; chiến thuật đầu tiên "Không hiệu quả"; quan sát đầu tiên "Không thấy"; số lần bị ngã 1; "Lưu hiệp 2".
4. Lời dặn trước hiệp 3 (đã thấy khi chạy thử): chiến thuật đầu bị gạch, ghi "Tạm bỏ (không hiệu quả 2 hiệp liền)", xuống cuối (R21); thế trận "Khó thắng điểm, số hiệp còn lại không đủ bù (HLV tự chấm)" (R23). Với các thao tác ở bước 2–3 còn có: chiến thuật chỉ dựa trên quan sát đầu tiên kèm cảnh báo đối thủ có thể đã đổi lối đánh (R22), và cảnh báo đỏ "Cân nhắc dừng trận, báo bác sĩ của giải" vì bị ngã 2 lần (R24).
5. Nhấn mạnh câu trên màn: "Chỉ mang tính gợi ý, HLV là người quyết định." App không tự dừng trận.

**Dự phòng nếu 9a/9b chưa xong:** chạy test backend trước mặt thầy, mỗi ca test là một tình huống trên:
`pnpm --filter nestjs-api exec vitest run src/bouts/bout-analysis.model.spec.ts` (các ca R20–R24), rồi giải thích từng ca bằng bảng ở trên.

## 3. Sau trận (4 phút)

| # | Nghiệp vụ | Người dùng làm | App tự làm | Màn |
| --- | --- | --- | --- | --- |
| 11 | Đình chỉ | Không nhập (trừ khi bộ luật không có quy tắc) | Ghi kết quả thua KO là **tự tạo đình chỉ** theo bộ luật, trong cùng giao dịch: AIBA KO đầu 30 ngày, KO lặp lại trong thời hạn 90 ngày; TKO đánh đầu 30 ngày; DQ theo quy tắc. Sửa số ngày phải ghi lý do | Trang Đình chỉ · Có (nhánh Hoàng Anh, demo mode) |
| 12 | Điều chỉnh lịch tập | Một chạm "Áp dụng tất cả" | **Cổng 2** chặn xếp buổi sparring khi đang đình chỉ; tìm buổi đã xếp bị xung đột, đề xuất dời hoặc huỷ | Trang Đình chỉ · Có (demo); backend có |
| 13 | Cho tập lại | HLV hoặc bác sĩ ghi căn cứ | Đình chỉ cần xác nhận thì tạo việc "Chờ xác nhận được tập lại" trên thẻ Việc cần làm | Trang Đình chỉ, dashboard · Có (demo) |
| 14 | Đánh giá trận | Sửa nếu không đồng ý | **Tự đánh giá từng chiến thuật** từ bản ghi các hiệp (R29); lập **điểm cần luyện cho camp sau** (R30): chiến thuật không hiệu quả, giảm cân cấp tốc vượt ngưỡng, "đuối sức từ hiệp 2" | Backend có; màn báo cáo chưa có. Dự phòng: test `buildImprovementPoints` |
| 15 | Sẵn sàng nhận trận mới | Không | Bảng sẵn sàng toàn CLB: võ sĩ không có trận đang chạy và không có đình chỉ còn hiệu lực; khi tạo trận tiếp theo, hiện điểm cần luyện từ trận trước | Backend có (`GET /readiness`); màn chưa có |

Câu kết: "Sau trận, HLV gần như không nhập gì: app tự tạo đình chỉ, tự chặn lịch tập nguy hiểm, tự đánh giá chiến thuật và chuyển bài học sang camp sau. Vòng đời quay lại bước 1."

## 4. Chuẩn bị (tối 26/10, Claude kiểm và cập nhật bảng trạng thái)

- [ ] Nhánh demo đã có: T-004/T-006 B của Hoàng Anh trên nền `fight-camp` (Codex), T-010 B (Gemini).
- [ ] Chạy thử toàn bộ kịch bản ở demo mode, 390 px cho bước 9.
- [ ] Mở sẵn terminal cho các lệnh dự phòng.
- [ ] Số liệu nói được: backend 1021 test qua; 15 nghiệp vụ; quy tắc R1–R32 nằm ở [Luồng nghiệp vụ](./FIGHT-CAMP-BUSINESS-FLOWS.md).
