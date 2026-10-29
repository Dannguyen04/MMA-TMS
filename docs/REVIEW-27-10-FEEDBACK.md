# Nhận xét của giảng viên, buổi review 27/10

> Ghi lại ngày 27/10 từ trí nhớ của Dan và ghi chú của nhóm. Claude đưa ra các giả thuyết, Dan đánh dấu ý nào giống lời thầy. **Ai nhớ khác hoặc nhớ thêm ý nào thì bổ sung vào mục 6**, ghi tên mình bên cạnh. Kịch bản đã trình bày: [DEMO-REVIEW-27-10.md](./DEMO-REVIEW-27-10.md).

**Mốc tiếp theo:** review sau khoảng 2 tuần, quanh **10/11** (chưa có ngày chính xác).

**Ý chính:** phần trước trận đã ổn. Phần trong và sau trận cần đi sâu hơn vào nghiệp vụ thật. Thầy muốn thấy AI tham gia nhiều hơn, và UI/UX phải cho thấy app khác Excel.

## 1. Đình chỉ phải ràng buộc chặt hơn với buổi tập

Buổi demo đã cho thấy app chặn xếp buổi đấu tập khi võ sĩ đang đình chỉ (bước 5.5). Thầy muốn đình chỉ tác động tới cả kế hoạch tập, không chỉ chặn từng buổi:

| Ý | Hiện có | Còn thiếu |
| --- | --- | --- |
| Xử lý buổi đã xếp từ trước | Backend có đề xuất đổi loại, dời hoặc huỷ (R28, T-007) | Màn xử lý lịch (T-030 B3); demo chưa cho xem |
| Tự điều chỉnh giáo án/camp | Không có | Đình chỉ có hiệu lực thì kế hoạch tập tự chuyển sang hồi phục |
| Chặn theo cường độ, không chỉ theo loại buổi | Chỉ chặn theo loại buổi | Chặn theo bài tập hoặc cường độ (có va chạm vùng đầu, RPE) |
| Lộ trình tập lại | "Cho tập lại" mở hết trong một bước | Tập lại theo bậc: nhẹ → vừa → đối kháng |

Việc đang làm: [T-035](./tickets/T-035-suspension-gate-hardening.md), gồm đổi mặc định chặn rộng hơn (quyết định 22) và đóng đường vòng API; [T-030](./tickets/T-030-frontend-suspensions-sync.md) cho các màn.

## 2. Trong trận: diễn biến giữa các hiệp phải thực tế hơn

- **Lời dặn cụ thể hơn.** Lời dặn phải nói rõ hiệp sau làm gì, không chỉ cảnh báo chung.
- **Đổi chiến thuật giữa hiệp.** HLV đổi được chiến thuật cho hiệp sau. Hiện app chỉ ghi chiến thuật hiệu quả hay không, rồi tự xếp lại thứ tự (R21).
- **Bám nghiệp vụ thực tế hơn** ở góc đài.

## 3. AI gợi ý chiến thuật, cả trước và trong trận

| Ý | Hiện có |
| --- | --- |
| Trước trận: AI gợi ý chiến thuật | AI mới gợi ý **quan sát** từ video đối thủ (T-033); chiến thuật vẫn do HLV tự viết |
| Trong trận: AI viết lời dặn giữa hiệp | Lời dặn đang sinh từ quy tắc cố định R20–R24 |
| AI xem video trận đang diễn ra | Không có. Hiện phân tích một video mất 1–3 phút ([T-034](./tickets/T-034-gemini-punch-eval.md)), nên cần đo xem có làm được không trước khi hứa |

Nguyên tắc giữ nguyên: AI chỉ đề xuất, HLV quyết.

## 4. Backend thật và độ ổn định

- **Demo phải chạy backend thật.** Hôm nay demo chạy chế độ demo, dữ liệu nằm trong bộ nhớ.
- **Các màn còn thiếu:** báo cáo sau trận và bảng sẵn sàng nhận trận mới (nghiệp vụ 14, 15). Backend đã có, chưa có màn.
- **Lưu kết quả AI vào database.** Hiện chỉ lưu tạm trên máy chủ.
- **Lỗi, chập chờn.** Ví dụ: phải khởi động lại server để diễn lại, có endpoint vòng qua các cổng kiểm tra (T-035).

## 5. UI/UX

- Thầy hỏi "Khác gì Excel?". Ý thầy: UI/UX phải tốt thì người xem mới thấy giá trị của app.
- Model 3D cơ thể võ sĩ: đánh dấu vùng chấn thương, vùng bị đánh trúng, vùng bị hạn chế.
- 3D hoặc hoạt hoạ diễn lại hiệp đấu, chiến thuật.
- Giao diện sinh động hơn: ít bảng chữ, nhiều hình và biểu đồ.

## 6. Bổ sung của thành viên

| Ai | Nhớ thêm hoặc nhớ khác |
| --- | --- |
| | |

## 7. Chia việc

Làm song song theo người, đổi việc linh hoạt khi cần (Dan chốt 27/10). Ai xong sớm thì nhận tiếp việc của người đang quá tải, báo trong nhóm trước khi nhận. Claude viết ticket chi tiết cho từng mã DRAFT bên dưới, theo thứ tự ở cột "Đợt".

**Lịch:**

- **Đợt 0 (28–29/10):** xong việc đang dở, gồm T-006C, T-010B đợt 1 và T-035. Trong đợt này cả nhóm xác nhận mục 1–6.
- **Đợt 1 (30/10–5/11):** làm nghiệp vụ mới.
- **Đợt 2 (6–9/11):** chạy toàn bộ trên backend thật và làm phần UI. Tổng duyệt ngày 9/11.
- **Review:** khoảng 10/11.

| Mã | Việc | Mục | Người nhận | Hỗ trợ | Đợt |
| --- | --- | --- | --- | --- | --- |
| [T-035](./tickets/T-035-suspension-gate-hardening.md) | Đình chỉ: mặc định chặn rộng, đóng đường vòng `/coaching/assignments`, tái hiện lỗi sparring | 1, 4 | Ken | — | 0 |
| [T-030](./tickets/T-030-frontend-suspensions-sync.md) | Màn đình chỉ, xử lý buổi đã xếp (R28), tab Sẵn sàng, câu lỗi 409 | 1, 4 | Gemini | Hoàng Anh duyệt UI | 0–1 |
| T-036 | Đình chỉ gắn với giáo án: camp tự chuyển sang hồi phục, chặn theo cường độ, lộ trình tập lại theo bậc. Phần A backend (có migration), phần B màn HLV | 1 | A: Ken. B: Hoàng Anh | Codex | 1 |
| T-037 | Đổi chiến thuật giữa hiệp, lời dặn nói rõ hiệp sau làm gì. Phần A backend, phần B màn ghi hiệp trên điện thoại | 2 | A: Dan. B: Fon | — | 1 |
| T-038 | AI gợi ý chiến thuật trước trận (từ quan sát và hồ sơ hai bên) và lời dặn giữa hiệp; lưu kết quả AI vào database | 3, 4 | Dan | Codex | 1 |
| [T-039](./tickets/T-039-RESULT.md) | Đo xem AI có xem được video trận đang diễn ra không. Chỉ đo, chưa làm tính năng | 3 | Codex | Dan duyệt | 1, kết luận trước 3/11 |
| T-040 | Demo trên backend thật: merge nhánh demo, kiểm từng màn ở API mode, dữ liệu demo (gộp T-008), sửa chỗ chập chờn | 4 | Ken | Cả nhóm thử màn của mình | 2 |
| T-041 | Màn báo cáo sau trận (nghiệp vụ 14); bảng sẵn sàng đã nằm ở T-030 | 4 | Fon | — | 1–2 |
| T-042 | Model 3D cơ thể võ sĩ: vùng chấn thương, vùng bị đánh trúng, vùng bị hạn chế | 5 | Hoàng Anh | Gemini | 2 |
| T-043 | UI sinh động hơn, hoạt hoạ diễn lại hiệp và chiến thuật (2D trước, 3D nếu kịp) | 5 | Hoàng Anh | Gemini, Fon | 2 |
| [T-044](./tickets/T-044-codebase-trim.md) | Tinh gọn source: xoá file không dùng (A), bỏ demo mode sau T-040 (B) | 4 | A: Gemini flash. B: người làm T-040 | — | A: 0–1. B: sau 2 |

**Lưu ý:**

- Làm 3D cần cài thư viện mới (ví dụ `three`). Phải được Dan duyệt trước khi cài, theo [quy trình §4.7](./TEAM-WORKFLOW.md#4-quy-tắc-cho-người-thực-hiện-dev-và-gemini).
- T-039 kết luận ngày 28/10, Dan duyệt 29/10: **AI xem video trận trực tiếp không làm được trong 2 tuần.** Lần nhanh nhất mất 140 s mỗi hiệp, trong khi chỉ có khoảng 40 s dùng được trong 60 s nghỉ; 13/18 lần gọi lỗi (503, 429). Nhóm báo thầy kèm [số liệu](./tickets/T-039-RESULT.md). Hướng thay thế: AI viết lời dặn từ dữ liệu HLV ghi (T-038) và xem video sau trận ([T-045](./tickets/T-045-post-bout-video-analysis.md)).
- Ý nào ở mục 1–6 bị nhóm gạch đi thì Claude bỏ hoặc sửa ticket tương ứng.
