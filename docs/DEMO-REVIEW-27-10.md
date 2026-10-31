# Kịch bản trình bày 27/10: trước, trong và sau trận

> Đọc hết một lượt trước buổi review. Mỗi bước ghi **mở gì → bấm gì → trên màn thấy gì → nói gì**. Chữ trong ngoặc kép là chữ thật trên màn (Claude chạy thử bằng Playwright ngày 26/10 trên nhánh demo). Chỗ nào khác với màn thật thì làm theo màn và báo lại để sửa tài liệu.

## 0. Tóm tắt

**Vì sao có buổi này.** Ở review 2 (20/10), giảng viên nhận xét: phần trước trận ổn; phần trong và sau trận chưa rõ nghiệp vụ, người dùng tự làm hầu hết, hệ thống chủ yếu nhận dữ liệu. Thầy gợi ý một ví dụ: phân tích đối thủ giữa các hiệp.

**Thông điệp cần thầy nhớ:** người dùng chỉ nhập điều chỉ họ biết (vài chạm); app tự kiểm tra, tự cảnh báo, tự tạo hệ quả. Trong trận, app gợi ý lời dặn giữa hiệp; HLV vẫn là người quyết.

| Phần | Người nói | Thời gian | Trọng tâm |
| --- | --- | --- | --- |
| Mở đầu | Dan | 1 phút | Vòng đời một trận, thông điệp chính |
| 1. Trước trận | Hoàng Anh | 3 phút | Đi nhanh, thầy đã duyệt |
| 2. Phân tích đối thủ và trong trận | Dan | 7,5 phút | **Phần thầy quan tâm nhất** |
| 3. Sau trận | Ken | 4 phút | Cân, kết quả, đình chỉ, Cổng 2, cho tập lại |
| Kết | Dan | 30 giây | Quay lại vòng đời |
| Hỏi đáp | Cả nhóm | phần còn lại | Xem mục 7 |

Fon chạy máy và chuyển màn theo lời người nói. Người nói đọc to tên nút trước khi Fon bấm.

## 1. Chuẩn bị

### Tối 26/10 (mỗi người, 15 phút)

```bash
git fetch origin && git checkout sync/T-004-fight-camp && git pull
pnpm install
cd nextjs-frontend && APP_DATA_MODE=demo pnpm dev
```

Mở <http://localhost:3000> → trang đăng nhập → bấm nút demo **"Rafael Costa"** (HLV). Tập phần của mình một lần từ đầu đến cuối.

### 15 phút trước giờ trình bày (máy của Dan, chủ dự án chốt sáng 27/10)

Demo chạy trên máy Dan, từ worktree `D:/test/ai-worktrees/T-033` (nhánh `feat/T-033-opponent-analysis-ui`, tạo từ đỉnh nhánh demo, có thêm màn soạn phân tích đối thủ). Server ở cổng **3002**; cổng 3000 trên máy này là bản khác, đừng mở nhầm. Worktree đã có `nextjs-frontend/.env.local` với `APP_DATA_MODE=demo` và `GEMINI_API_KEY`.

1. **Tắt server cũ và chạy lại.** Dữ liệu demo nằm trong bộ nhớ server: các hiệp đã ghi và đình chỉ đã tạo lúc tập vẫn còn. Đủ 3/3 hiệp thì lời dặn không hiện nữa; Linh đã cân hoặc đã bị đình chỉ thì phần sau trận không diễn lại được.

   ```powershell
   # tắt tiến trình đang giữ cổng 3002 (Ctrl+C ở terminal đang chạy, hoặc:)
   Stop-Process -Id (Get-NetTCPConnection -LocalPort 3002 -State Listen).OwningProcess -Force
   cd D:/test/ai-worktrees/T-033/nextjs-frontend; pnpm exec next dev -p 3002
   ```

2. Mở <http://localhost:3002>, đăng nhập "Rafael Costa", mở sẵn các tab theo thứ tự:
   1. `/coach/dashboard`
   2. `/coach/bouts`
   3. `/coach/bouts/bout-weighed-in/opponent-analysis`
   4. `/coach/bouts/bout-weighed-in/corner-card`
   5. `/coach/bouts/bout-weighed-in/rounds`
   6. `/coach/bouts/b-linh-saigon`
   7. `/coach/bouts/suspensions`
3. Mở Notepad, để sẵn hai dòng để dán ở bước 4.0 (phải đúng từng chữ thì mới lấy kết quả đã lưu, không gọi lại AI):

   ```text
   https://www.youtube.com/watch?v=dKw5POIXlsI
   Đối thủ của Caio Borralho
   ```

4. Phóng to trình duyệt 125% để thầy đọc được chữ. Phần trong trận có thể bật chế độ điện thoại (F12 → biểu tượng điện thoại, 390 px) để cho thấy dùng ở góc đài.
5. Mở sẵn một terminal ở thư mục `D:/test/ai-worktrees/T-033/nestjs-api` cho lệnh dự phòng (mục 8).

## 2. Mở đầu (Dan, 1 phút)

**Nói:** "Lần trước thầy nhận xét phần trong và sau trận người dùng phải tự làm nhiều. Hôm nay nhóm em đi qua một trận từ đầu đến cuối. Ở mỗi bước, em chỉ rõ người dùng bấm gì và app tự làm gì. Phần trong trận em làm theo gợi ý của thầy: phân tích đối thủ giữa các hiệp."

## 3. Trước trận (Hoàng Anh, 3 phút)

| # | Mở | Bấm | Trên màn thấy | Nói |
| --- | --- | --- | --- | --- |
| 1.1 | Tab `/coach/dashboard` | Cuộn tới thẻ "Việc cần làm" | Mục "TRƯỚC TRẬN": "Kenji Morita · Cân vượt ngưỡng giảm cân" và "Kenji Morita · Đủ điều kiện vào tuần thi đấu" (giải Pacific Invitational 4) | "HLV không phải đi tìm việc. App gom việc từ mọi trận: ai cân vượt ngưỡng, ai đủ điều kiện vào tuần thi đấu, hồ sơ nào sắp hết hạn." |
| 1.2 | Tab `/coach/bouts` | Không bấm | Bảng trận, mỗi dòng có giai đoạn, cân nặng, Cổng 1. Kenji: "Vượt giới hạn giảm cân". Emma Lindqvist: "Thiếu 1 · quá hạn". Linh Phạm: "Hôm nay là buổi cân" | "Trạng thái cân và Cổng 1 do app tính sẵn, từ số cân võ sĩ ghi mỗi sáng và hồ sơ đã nộp." |
| 1.3 | Bấm dòng **Emma Lindqvist** | Cuộn tới phần hồ sơ | "Brain CT · Bắt buộc · Còn thiếu"; phần "Tuần thi đấu": "Thiếu 1 · quá hạn" | "Cổng 1: thiếu một giấy bắt buộc là chưa được vào tuần thi đấu. Hạn nộp do bộ luật quy định, app tự tính." |
| 1.4 | Cùng trang | Bấm **"Vào tuần thi đấu"** | "Chưa qua Cổng 1. Trận đấu vẫn ở giai đoạn chuẩn bị thi đấu." (chạy thử 26/10) | "HLV không cần nhớ quy định. App chặn đúng lúc và nói rõ thiếu gì." |
| 1.5 | `/coach/bouts/new` | Chỉ vào các ô, không cần tạo | "Võ sĩ", "Bộ luật thi đấu" (MMA – VMMAF 2021; Boxing nghiệp dư – AIBA (tham khảo); Tự nhập), "Hạng cân" (đổi theo bộ luật), "Giờ cân", "Giờ thi đấu" | "Tạo trận chỉ vài ô. Chọn bộ luật là app tự lấy hạng cân, hạn nộp hồ sơ, giới hạn giảm cân cấp tính, và sinh danh sách hồ sơ cần nộp." |

**Chuyển:** "Đó là phần thầy đã xem. Giờ Dan trình bày phần mới: trong trận."

## 4. Phân tích đối thủ và trong trận (Dan, 7,5 phút, trọng tâm)

Trận dùng xuyên suốt: **Diego Alvarez gặp Lê Hoàng Nam**, giải Vietnam MMA Open 2026, 65 kg, 3 hiệp, đã cân chính thức 64,8 kg.

### 4.0 Soạn phân tích đối thủ, gợi ý từ video bằng AI (1,5 phút)

**Mở:** tab `/coach/bouts/bout-weighed-in/opponent-analysis`. (Lối vào: trang trận có link "Phân tích đối thủ".)

**Trên màn thấy** (chạy thử 27/10):

- Đầu trang: "Kế hoạch: 2 cần sửa · 4 gợi ý", dưới là "Cập nhật ngay khi nhập, trước khi lưu. Chỉ là gợi ý; HLV quyết định." và hai dòng "Chiến thuật chưa có buổi tập: …" có nút "Mở chiến thuật".
- Hồ sơ đối thủ "Lê Hoàng Nam · 6-2-0 · Nghịch (tay trái) · Đứng đòn" và bảng "So số đo": "Sải tay (cm) 176 / 185 / −9", "(Chênh lệch đáng chú ý)".
- "Quan sát (4/6)": QS1–QS4, mỗi dòng có loại (Thói quen / Sơ hở / Điểm mạnh), "Lặp lại nhiều lần" hoặc "Thấy 1 lần", "Có link" / "Có ghi chú", "Căn cứ của chiến thuật #n".
- "Chiến thuật (4/5)": mỗi chiến thuật có căn cứ QSn, hiệp, "Chưa luyện" hoặc "Đã xếp lịch, chưa tập", "Thứ n trên thẻ góc đài".

**Nói:** "Đây là chỗ HLV soạn phân tích đối thủ. Mỗi chiến thuật bắt buộc dựa trên ít nhất một quan sát có bằng chứng. App so số đo, và kiểm tra kế hoạch ngay khi nhập: ở đây hai chiến thuật chưa có buổi tập nào để luyện."

**Bấm:** **"Gợi ý từ video (AI)"** → dán dòng 1 vào ô "Link video YouTube", dòng 2 vào ô "Đối thủ trong video là ai" → **"Phân tích video"**.

**Trên màn thấy** ngay: "AI đề xuất 3 quan sát. Phân tích lúc 12:36 27 thg 10, 2026 (kết quả đã lưu, không gọi lại AI)", "AI có thể sai. Mở mốc thời gian để kiểm tra trước khi nhận." Gợi ý đầu: "Lao người về phía trước khi ra đòn tay phải, để hở cằm cao và không lắc đầu tránh né · Sơ hở · Lặp lại nhiều lần · Xem ở 02:08", có nút "Nhận" / "Bỏ".

**Nói:** "HLV dán link video trận cũ của đối thủ. Gemini xem video và đề xuất quan sát kèm mốc thời gian. Đây là video công khai của một trận UFC, nhóm dùng làm mẫu; thật thì HLV dán video của chính đối thủ. Video dài thì AI mất 1–3 phút, nên em đã chạy trước và app lưu kết quả lại. AI có thể sai, nên HLV bấm mốc thời gian để xem lại rồi mới nhận."

**Bấm:** **"Nhận"** ở gợi ý đầu.

**Trên màn thấy:** quan sát mới QS5 "Có link", "Chưa chiến thuật nào dùng"; đầu trang đổi thành "Kế hoạch: 3 cần sửa", dòng mới **"Sơ hở chưa có chiến thuật khai thác: "Lao người về phía trước…""** có nút "Tạo chiến thuật".

**Nói:** "Nhận xong là app thấy ngay: có sơ hở mà chưa có chiến thuật nào khai thác. Bấm 'Tạo chiến thuật' là app tạo sẵn chiến thuật đã gắn quan sát làm căn cứ, HLV chỉ viết nốt cách làm. Lưu thì thẻ góc đài cập nhật theo."

**Không bấm "Lưu phân tích"** (để thẻ góc đài và lời dặn ở 4.1–4.3 đúng như kịch bản). Bấm link **"Thẻ góc đài"** ở đầu trang; rời trang không bị hỏi.

### 4.1 Thẻ góc đài (1,5 phút)

**Mở:** tab `/coach/bouts/bout-weighed-in/corner-card`.

**Trên màn thấy:** đầu thẻ có võ sĩ, đối thủ, hạng cân, "Số hiệp dự kiến 3", nút "In thẻ A4". Bốn chiến thuật đã xếp sẵn:

1. "Bước chéo sang trái, phản đòn móc trái ngay khi đối thủ thu chân đá thấp": "Mọi hiệp", "Căn cứ lặp lại", "Đã luyện"
2. "Ép góc bằng chuỗi jab - đấm thẳng rồi cắt góc ngang…": "Hiệp 1", "Căn cứ lặp lại", "Chưa luyện"
3. "Giữ tay phải cao che hàm khi thoát áp sát…": "Hiệp 2", "Quan sát 1 lần", "Đã luyện"
4. "Tăng nhịp đòn vào vùng bụng và đổi tầng vật từ giữa hiệp 2": "Mọi hiệp", "Quan sát 1 lần", "Chưa luyện"

Mỗi chiến thuật có dòng "Mô tả tình huống" cho bạn tập.

**Nói:** "Trước trận, HLV phân tích đối thủ; mỗi chiến thuật phải dựa trên quan sát có bằng chứng. App tự dựng thẻ góc đài: chiến thuật có căn cứ lặp lại lên trước, chiến thuật đã luyện lên trước, chiến thuật chưa luyện được gắn nhãn 'Chưa luyện' để HLV thấy rủi ro. Thẻ in A4, hoặc mở trên điện thoại ở góc đài."

Bấm "Lọc theo hiệp" → "Hiệp 1" để cho thấy thẻ lọc theo hiệp. Rồi bấm **"Ghi hiệp & lời dặn"**.

### 4.2 Ghi hiệp 1 (1,5 phút)

**Mở:** `/coach/bouts/bout-weighed-in/rounds`. Ba thẻ "Hiệp 1", "Hiệp 2", "Hiệp 3", đều "Chưa ghi".

**Nói trước khi bấm:** "Giữa hai hiệp có khoảng một phút. Trợ lý ghi bằng vài chạm, không gõ chữ."

Trong thẻ **Hiệp 1**, bấm lần lượt:

1. "HLV tự chấm" → **"Thua hiệp"**
2. "Số lần bị đánh ngã (0–10)" → nhập **1**
3. "Đánh dấu chiến thuật", chiến thuật đầu tiên ("Bước chéo sang trái…") → **"Không hiệu quả"**
4. "Đánh dấu quan sát đối thủ", quan sát đầu tiên ("Hạ tay phải sau khi tung đòn đá thấp chân sau") → **"Không thấy"**
5. **"Lưu hiệp 1"**

**Trên màn thấy:** thẻ Hiệp 1 chuyển "Đã lưu"; đầu trang hiện khung **"Lời dặn giữa hiệp (trước hiệp 2)"**, ngay dưới là "Chỉ mang tính gợi ý — HLV là người quyết định tại góc đài."

**Nói:** "Lưu xong là có lời dặn cho hiệp sau. Chiến thuật mới không hiệu quả một lần thì app chưa bỏ, chỉ hạ điểm."

### 4.3 Ghi hiệp 2, đọc lời dặn trước hiệp 3 (2,5 phút)

Trong thẻ **Hiệp 2**, bấm y như hiệp 1: "Thua hiệp", số lần bị ngã **1**, chiến thuật đầu "Không hiệu quả", quan sát đầu "Không thấy", **"Lưu hiệp 2"**.

**Trên màn thấy** khung **"Lời dặn giữa hiệp (trước hiệp 3)"**. Chỉ lần lượt từng phần, mỗi phần một câu:

| Trên màn | Quy tắc | Nói |
| --- | --- | --- |
| "Khó thắng điểm — số hiệp còn lại không đủ bù (HLV tự chấm)" | R23 | "Thua hai hiệp, còn một hiệp: thắng điểm gần như không thể. App nói thẳng để HLV đổi chiến lược. Đây là HLV tự chấm, không phải điểm trọng tài." |
| Chiến thuật đầu bị gạch, ghi "Tạm bỏ (không hiệu quả 2 hiệp liền)", nằm cuối danh sách | R21 | "Không hiệu quả hai hiệp liền thì app gạch và đưa xuống cuối. Chiến thuật chưa dùng mà cùng căn cứ với chiến thuật đang dùng được đẩy lên." |
| "Đối thủ có thể đã đổi lối đánh (không thấy quan sát căn cứ 2 hiệp liền)" | R22 | "Thói quen của đối thủ hai hiệp không thấy lại: có thể đối thủ đã đổi. Chiến thuật chỉ dựa trên thói quen đó bị đánh dấu." |
| Khung đỏ "Cân nhắc dừng trận, báo bác sĩ của giải" | R24 | "Bị ngã tổng hai lần thì app cảnh báo đỏ. App không tự dừng trận; quyết định là của HLV và bác sĩ giải." |

**Nói chốt:** "Đây là ví dụ thầy gợi ý. Người dùng chạm bốn, năm lần mỗi hiệp; phần phân tích và gợi ý do app làm, dựa trên phân tích đối thủ soạn trước trận."

**Chuyển:** "Trận đã cân và đã thi xong. Ken trình bày phần cân, kết quả và những gì app làm sau trận."

## 5. Sau trận (Ken, 4 phút)

Trận dùng: **Linh Phạm gặp Vũ Mai Anh**, Saigon Amateur Night 5, 60 kg, bộ luật "Boxing nghiệp dư – AIBA (tham khảo)", hôm nay là buổi cân.

| # | Mở | Bấm | Trên màn thấy | Nói |
| --- | --- | --- | --- | --- |
| 5.1 | Tab `/coach/bouts/b-linh-saigon` | **"Ghi cân chính thức"** → ô "Cân chính thức" nhập **59.6** → **"Lưu kết quả cân"** | "Đạt cân"; trận sang "Đã cân" | "HLV nhập một số. Đạt thì app tự chuyển trạng thái. Không đạt thì app chỉ hỏi một câu: thi ở mức cân thoả thuận hay huỷ trận." |
| 5.2 | Cùng trang | **"Ghi kết quả"** → "Kết quả": **Thua** → "Cách kết thúc": **KO** → "Hiệp": **2** → "Có mất ý thức không?": chọn một đáp án → **"Lưu kết quả"** | "Thua · KO, hiệp 2"; ngay dưới: "Đề xuất: 30 ngày (KO hoặc TKO: 30 ngày)." và nút "Xác nhận đình chỉ" | "Thua KO là app đề xuất đình chỉ ngay theo bộ luật, kèm lý do. HLV không phải tra luật." |
| 5.3 | Cùng trang | **"Xác nhận đình chỉ"** (mở hộp thoại; sửa số ngày thì phải ghi lý do) → **"Lưu đình chỉ"** | "Đã lưu đình chỉ", "Đang đình chỉ" | "Một chạm là đình chỉ có hiệu lực. Ở backend thật, đình chỉ được tạo ngay trong cùng giao dịch ghi kết quả; KO lần hai trong thời hạn thì 90 ngày." |
| 5.4 | Tab `/coach/bouts/suspensions` | Không bấm | "Linh Phạm · KO · 26 thg 10, 2026 – 25 thg 11, 2026 (30 ngày) · Đang đình chỉ"; "Chặn đánh bóng, đấm đích, bao cát, đấu tập, luyện kỹ thuật, vật, thể lực. Cần cấp phép để tập lại" (ngày đổi theo ngày chạy) | "Trang Đình chỉ của cả CLB: ai đang bị đình chỉ, đến ngày nào, bị chặn những loại buổi nào." |
| 5.5 | `/coach/sessions/new` | "Võ sĩ": **Linh Phạm**; loại buổi **"Đấu tập"**; nhập tiêu đề, ngày mai, giờ bất kỳ → **"Lên lịch buổi tập"** | Không tạo được; dòng báo: "Linh Phạm đang bị đình chỉ: buổi đấu tập bị chặn đến hết ngày 25 thg 11, 2026." (Trước khi bấm, form hiện "Không có xung đột với cấp phép y tế"; đừng chỉ vào dòng này, lỗi đình chỉ chỉ hiện sau khi bấm.) | "Đây là Cổng 2. Võ sĩ đang đình chỉ thì app không cho xếp, cũng không cho bắt đầu loại buổi bị cấm. Không ai phải nhớ." |
| 5.6 | Tab `/coach/bouts/suspensions` | Nút **"Cho tập lại"** ở **đúng dòng Linh Phạm** (trang có sẵn đình chỉ của võ sĩ khác, đừng bấm nhầm) → ô "Căn cứ" nhập "Bác sĩ CLB khám lại, cho tập nhẹ" → xác nhận | "Rafael Costa xác nhận được tập lại, <giờ>: Bác sĩ CLB khám lại, cho tập nhẹ"; võ sĩ "Sẵn sàng nhận trận mới" | "Đình chỉ cần cấp phép thì chỉ HLV hoặc bác sĩ được cho tập lại, và phải ghi căn cứ. Xong là võ sĩ quay lại danh sách sẵn sàng nhận trận mới." |

**Nói thêm (không cần màn):** "Sau trận app còn tự đánh giá từng chiến thuật từ bản ghi các hiệp, và lập điểm cần luyện cho camp sau, ví dụ 'đuối sức từ hiệp 2'. Backend đã có và có test; màn báo cáo đang làm. Thầy muốn xem thì em chạy test ngay." (Lệnh ở mục 8.)

## 6. Kết (Dan, 30 giây)

**Nói:** "Tóm lại: trước trận app chặn đúng lúc; trong trận app gợi ý lời dặn giữa hiệp từ phân tích đối thủ; sau trận app tự đề xuất đình chỉ, tự chặn lịch tập nguy hiểm và chuyển bài học sang camp sau. Người dùng chỉ nhập điều họ biết. Vòng đời quay lại bước tạo trận mới."

## 7. Câu hỏi thầy có thể hỏi

| Câu hỏi | Trả lời gợi ý |
| --- | --- |
| Giữa hiệp chỉ có một phút, có kịp ghi không? | Mỗi hiệp 4–5 chạm, không gõ chữ. Không kịp thì ghi sau trận trên cùng màn; lời dặn chỉ có ý nghĩa khi ghi trước hiệp cuối. Giải không cho dùng điện thoại ở góc đài thì vẫn dùng thẻ in A4. |
| App có tự dừng trận không? | Không. App chỉ cảnh báo đỏ và ghi rõ "Chỉ mang tính gợi ý — HLV là người quyết định tại góc đài." Dừng trận là việc của HLV và bác sĩ giải. |
| Ngưỡng "2 hiệp liền", "bị ngã 2 lần" lấy ở đâu? | Đề xuất của nhóm, đặt thành hằng số có tên trong code để đổi một chỗ; đang chờ HLV có chuyên môn duyệt. |
| Số ngày đình chỉ theo luật nào? | Theo bộ luật gắn với trận. AIBA trong demo ghi rõ "Chỉ để tham khảo, chưa xác minh với ban tổ chức". Bộ luật không có quy tắc thì HLV nhập số ngày. |
| AI xem video có đáng tin không? Tốn bao lâu? | Gemini (Google) xem video YouTube công khai, trả quan sát có mốc thời gian. AI chỉ đề xuất: HLV mở mốc để kiểm và tự bấm "Nhận"; không có gì tự vào kế hoạch. Video vài phút mất 1–3 phút (lượt chạy sáng 27/10: 191 giây), nên app lưu kết quả theo video để không gọi lại. Bản hiện tại lưu tạm trên máy chủ, bản thật sẽ lưu vào database theo trận. |
| Đây là demo giả hay chạy thật? | Màn hôm nay chạy chế độ demo cho nhanh và ổn định. Backend thật đã có đủ các quy tắc này: hơn 1.000 test backend qua, migration đình chỉ đã áp lên database. AI nhận diện đòn đã chạy thật qua backend ngày 25/10. |
| Khác gì ghi vào Excel? | Excel chỉ lưu. App kiểm tra và tạo hệ quả: chặn vào tuần thi đấu khi thiếu hồ sơ, tự đề xuất đình chỉ, chặn xếp buổi tập bị cấm, xếp lại chiến thuật giữa hiệp. |

## 8. Sự cố và dự phòng

| Sự cố | Xử lý |
| --- | --- |
| Lời dặn không hiện sau khi lưu hiệp | Dữ liệu cũ còn trong bộ nhớ (đã đủ 3/3 hiệp). Khởi động lại server, đăng nhập lại, làm lại từ 4.2. Hết giờ thì dùng lệnh dự phòng phần trong trận. |
| Không thấy nút "Ghi cân chính thức" | Trận Linh đã cân lúc tập. Khởi động lại server. |
| Bấm "Phân tích video" mà hiện "Đang phân tích video…" quá vài giây | Link hoặc tên gõ khác dòng đã lưu, app đang gọi Gemini thật (1–3 phút). Không chờ: nói "video dài thì AI mất 1–3 phút", tải lại trang và dán lại đúng hai dòng trong Notepad. |
| Trang báo lỗi hoặc trắng | Tải lại trang; vẫn lỗi thì chạy lệnh dự phòng của phần đó và nói tiếp. |

**Lệnh dự phòng** (terminal ở `nestjs-api`; mỗi ca test là một tình huống trong kịch bản):

```bash
# Trong trận: thẻ góc đài và lời dặn giữa hiệp (R20–R24); Claude chạy thử 26/10: 5 test qua
npx vitest run src/bouts/bout-analysis.model.spec.ts -t "R20|R21|R22|R23|R24"

# Sau trận: đánh giá chiến thuật, điểm cần luyện, bảng sẵn sàng (R29, R30, R32); Claude chạy thử 26/10: 8 test qua
npx vitest run src/bouts/bout-analysis.model.spec.ts src/bouts/bouts.model.spec.ts -t "R29|R30|classifyReadiness"
```

Giải thích nhanh các ca của lệnh thứ hai:

- *R29*: app tự chấm từng chiến thuật sau trận. Hiệu quả 2 hiệp, không dùng hiệp 3 thì "Hiệu quả"; hiệu quả 1, không hiệu quả 1 thì vẫn "Hiệu quả"; không hiệp nào dùng thì "Chưa dùng".
- *R30*: điểm cần luyện cho camp sau, gồm chiến thuật không hiệu quả, giảm cân cấp tốc vượt ngưỡng, "đuối sức từ hiệp 2" khi mệt liên tiếp tới hiệp cuối. Hiện ra khi tạo trận tiếp theo cho võ sĩ.
- *classifyReadiness*: bảng sẵn sàng toàn CLB, ưu tiên: đang đình chỉ, chờ xác nhận tập lại, đang có trận, sẵn sàng.

## 9. Phụ lục: 15 nghiệp vụ và màn tương ứng

| # | Nghiệp vụ | Giai đoạn | Màn hôm nay | Bước |
| --- | --- | --- | --- | --- |
| 1 | Tạo trận | Trước | Có | 1.5 |
| 2 | Lập camp và giáo án | Trước | Có, không diễn | — |
| 3 | Kiểm soát cân | Trước | Có | 1.1, 1.2 |
| 4 | Ăn uống | Trước | Có một phần, không diễn | — |
| 5 | Hồ sơ thi đấu, Cổng 1 | Trước | Có | 1.3, 1.4 |
| 6 | Phân tích đối thủ | Trước | Có: màn soạn phân tích, kiểm tra kế hoạch, gợi ý từ video bằng AI (T-033, chưa merge), thẻ góc đài | 4.0, 4.1 |
| 7 | Tuần thi đấu | Trong | Có | 1.4 |
| 8 | Cân chính thức | Trong | Có | 5.1 |
| 9 | Thi đấu: thẻ góc đài, ghi hiệp, lời dặn | Trong | Có | 4.1–4.3 |
| 10 | Ghi kết quả | Trong | Có | 5.2 |
| 11 | Đình chỉ | Sau | Có | 5.2–5.4 |
| 12 | Điều chỉnh lịch tập, Cổng 2 | Sau | Có | 5.5 |
| 13 | Cho tập lại | Sau | Có | 5.6 |
| 14 | Đánh giá trận, điểm cần luyện | Sau | Backend có, màn chưa có | Lệnh dự phòng |
| 15 | Sẵn sàng nhận trận mới | Sau | Backend có, màn chưa có | 5.6, lệnh dự phòng |

Quy tắc chi tiết R1–R32: [Luồng nghiệp vụ](./FIGHT-CAMP-BUSINESS-FLOWS.md#nghiệp-vụ-hệ-thống-trước-trong-và-sau-trận-đề-xuất-2010-chờ-duyệt).
