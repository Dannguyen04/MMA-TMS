# Kịch bản demo review 2: "Trước trận"

Nhánh `feat/T-004-bout-lifecycle-ui`, frontend chạy ở demo mode, dữ liệu giả. Giao diện tiếng Anh, người trình bày nói tiếng Việt. Thời lượng khoảng 11–12 phút, cộng 3 phút nếu chiếu thêm phần "Trong và sau trận".

| Phần | Thời gian | Nội dung |
| --- | --- | --- |
| Mở đầu | 1 phút | Phạm vi, demo mode, báo phần ăn uống mở rộng |
| Bước 1–2 | 1,5 phút | Today và danh sách trận của HLV |
| Bước 3–4 | 2 phút | Tạo trận, gắn camp |
| Bước 5 | 1 phút | HLV viết kế hoạch ăn |
| Bước 6–7 | 2 phút | Võ sĩ ghi cân và trả lời câu hỏi ăn uống, HLV thấy cảnh báo |
| Bước 8–9 | 2,5 phút | Hồ sơ y tế, Cổng 1 chặn, đủ hồ sơ thì vào tuần thi đấu |
| Kết | 0,5 phút | Việc tiếp theo |
| Phần thêm | 3 phút | Cân chính thức, kết quả, đình chỉ, Cổng 2 |

## Chuẩn bị (10 phút trước giờ demo)

1. Khởi động dev server mới để dữ liệu mẫu sạch:
   ```bash
   pnpm --filter nextjs-frontend dev
   ```
2. Mở **hai cửa sổ** để khỏi đăng xuất, đăng nhập giữa chừng. Hai cửa sổ dùng chung dữ liệu.
   - **Chrome thường:** vào `localhost:3000/login`, bấm **Rafael Costa** (HLV).
   - **Chrome ẩn danh:** vào `localhost:3000/login`, bấm **Minh Trần** (võ sĩ). Bật DevTools, chế độ điện thoại (390 px), để cho thấy võ sĩ dùng trên điện thoại.
3. Tính sẵn ngày, theo **ngày demo (D)**:
   - Cân: D+2 lúc 10:00. Thi: D+3 lúc 19:00.
   - Ví dụ demo ngày 21/10: cân 23/10 10:00, thi 24/10 19:00.
4. Lỡ tay bấm sai thì Ctrl+C rồi chạy lại lệnh ở bước 1. Dữ liệu về như ban đầu, hai cửa sổ chỉ cần tải lại trang.

Dữ liệu mẫu lúc khởi động:

| Võ sĩ | Trận | Lúc bắt đầu |
| --- | --- | --- |
| Minh Trần | Chưa có trận | Có số cân tới 4 ngày trước, sẽ tạo trận trên sân khấu |
| Kenji Morita | Pacific Invitational 4 | Cân đỏ, 2 ngày ăn lệch nhiều, đủ hồ sơ |
| Aigerim Sadykova | Asian Combat Series 9 | Cân vàng |
| Emma Lindqvist | Nordic Open 12 | Cân xám, thiếu Brain CT, hồ sơ trễ hạn |
| Linh Phạm | Saigon Amateur Night 5 | Tuần thi đấu, cân và thi hôm nay (dùng cho phần thêm) |
| Diego Alvarez | Không có | Đang bị đình chỉ sau KO khi sparring |

## Mở đầu (1 phút)

> "Phạm vi đã chốt là quản lý võ sĩ **trước, trong và sau một trận**. Hôm nay em demo phần **Trước trận**: HLV tạo trận, võ sĩ ghi cân, app cảnh báo khi cân có rủi ro, và Cổng 1 chặn trận vào tuần thi đấu khi hồ sơ y tế chưa đủ.
>
> Ngoài phạm vi đã duyệt, nhóm làm thêm phần **ăn uống đi cùng kiểm soát cân**. Phần này nhóm quyết định mở rộng sau buổi duyệt phạm vi, nên em xin báo với thầy cô hôm nay. Nguyên tắc: app **không tự kê chế độ ăn**. App chỉ lưu kế hoạch do HLV hoặc chuyên gia viết, và ghi lại võ sĩ có làm theo không.
>
> Bản demo chạy ở **demo mode** của frontend, dữ liệu hoàn toàn giả. Backend đang tích hợp. Demo cuối ngày 31/10 sẽ chạy với backend thật."

## Bước 1. Today của HLV (cửa sổ Rafael)

**Màn hình:** "Weight alerts" có Kenji đỏ, Aigerim vàng, Emma xám. "Documents due" có Emma thiếu Brain CT.

> "Mở app, HLV thấy ngay ai cần chú ý. **Đỏ** nghĩa là trong 7 ngày cuối, phần cân còn phải giảm vượt ngưỡng giảm cấp tốc an toàn. **Vàng** là cân đang cao hơn đường tham chiếu quá 1 kg. **Xám** là 3 ngày không ghi cân. Bên phải là hồ sơ sắp tới hạn nộp mà còn thiếu."

Chỉ vào dòng của Kenji: "Last 3 days: 2 way off."

> "Cảnh báo cân đi kèm tóm tắt ăn uống: 3 ngày gần nhất Kenji có 2 ngày lệch kế hoạch ăn nhiều."

## Bước 2. Danh sách trận

**Bấm:** **Bouts** ở menu trái.

> "Mỗi dòng là một trận, xếp theo ngày cân. HLV thấy luôn ba thứ: trận đang ở giai đoạn nào, cân xanh hay đỏ, và hồ sơ đủ chưa, gọi là Cổng 1."

## Bước 3. Tạo trận cho Minh

**Bấm:** **New bout**.

1. Fighter: **Minh Trần**.
2. Ruleset: chọn **Boxing nghiệp dư – AIBA** trước.
   > "Bộ luật nào chưa đối chiếu được với ban tổ chức thì app ghi rõ là chỉ để tham khảo."
3. Đổi Ruleset sang **MMA – VMMAF 2021**, Weight class **60 kg**.
   > "Luật VMMAF 2021 là văn bản công khai, đã đối chiếu."
4. Event: `Lotus Fight Night 18`. Opponent: `Arman Petrosyan`.
5. Điền giờ cân (D+2 10:00) và giờ thi (D+3 19:00).
   > "App tính sẵn: còn 2 ngày tới cân, cân trước thi 33 giờ, nên ngưỡng giảm cấp tốc là 8%. Nếu cân cách thi dưới 12 giờ thì ngưỡng hạ xuống 5%."
6. *(Tuỳ chọn)* Đặt giờ thi sớm hơn giờ cân rồi bấm Create để cho thấy lỗi báo ngay tại ô. Sửa lại.
7. Bấm **Create bout**.
   > "Trận được tạo ở trạng thái Scheduled."

## Bước 4. Gắn camp

**Bấm:** **Link camp plan** → **Start camp**.

> "Camp là kế hoạch tập đã có sẵn của võ sĩ. Gắn vào thì trận chuyển sang Camp. Biểu đồ cân tính từ ngày camp bắt đầu, nên thấy được cả quá trình giảm cân trước đó."

## Bước 5. HLV viết kế hoạch ăn

Trong trang trận của Minh, kéo xuống **Meal plan**:

- **Camp:** `Cơm, ức gà, rau, trái cây. Không đồ chiên.`
- **Fight week:** `Giữ bữa như camp, giảm khẩu phần ngày trước cân.`
- **Written by:** để tên Rafael. Có thể gõ tên một chuyên gia để cho thấy HLV dán kế hoạch từ chuyên gia vào.
- Bấm **Save plan**.

> "Kế hoạch chia theo giai đoạn của trận: camp, tuần thi đấu, và từ lúc cân tới giờ thi. Mỗi ô ghi ai viết và sửa lúc nào. App chỉ lưu chữ, không tính calo, không có ô theo dõi nước uống. Nhóm cố ý không làm, để app không thành công cụ hỗ trợ ép cân sai cách."

## Bước 6. Võ sĩ xem kế hoạch, ghi cân (cửa sổ Minh)

1. Tải lại, mở **Bout**. Chỉ vào thẻ **Camp** có đúng nội dung HLV vừa viết.
   > "Võ sĩ không phải đi tìm, trang trận tự hiện kế hoạch của giai đoạn hiện tại."
2. Về **Today** → **Log today's weight** → gõ `66,5` → chọn **Way off** → **Save**.
   > "Võ sĩ ghi cân trên điện thoại, mục tiêu dưới 30 giây. Ô số tự mở bàn phím, gõ dấu phẩy hay dấu chấm đều được. Sau số cân, app hỏi thêm một câu tuỳ chọn: hôm qua có ăn theo kế hoạch không. Chỉ một chạm, không bắt chụp từng bữa, vì như vậy khó duy trì suốt camp 6–8 tuần và HLV cũng không có thời gian đọc. Bỏ qua câu này thì số cân vẫn lưu."

**Màn hình:** "Saved 66.5 kg. Status: Red" và câu khuyến nghị màu đỏ.

> "66,5 kg so với 60 kg là còn gần 10% phải giảm trong 2 ngày, vượt ngưỡng 8%, nên chuyển đỏ. App **không** kê chế độ ăn, không tính calo, không hướng dẫn ép nước. App chỉ khuyên trao đổi với bác sĩ hoặc chuyên gia dinh dưỡng và cân nhắc đổi hạng."

3. Kéo xuống biểu đồ.
   > "Điểm cân hôm nay có chấm đỏ, tức là 'lệch nhiều'. Cân và ăn uống nằm trên cùng một biểu đồ. Bấm 'Show data table' thì có bảng ghi rõ câu trả lời bằng chữ."

## Bước 7. HLV thấy cảnh báo (cửa sổ Rafael)

**Bấm:** **Today**.

> "Minh đỏ, đứng đầu danh sách, kèm dòng '3 ngày gần nhất có 1 ngày lệch nhiều'. HLV đọc được hai tín hiệu cùng lúc: cân đang rủi ro, và võ sĩ không theo kế hoạch ăn. Từ đó HLV quyết định nên nhắc võ sĩ, đổi kế hoạch, hay cân nhắc đổi hạng."

*(Tuỳ chọn)* Mở trận **Kenji** để có ví dụ rõ hơn: đỏ, "Last 3 days: 2 way off", biểu đồ có nhiều chấm màu.

## Bước 8. Hồ sơ y tế và Cổng 1 chặn

Trong trang trận của Minh, phần **Medical checklist**:

1. **Add item:** `Health certificate`, `Blood test`, `Brain CT`.
2. **Edit** Health certificate → **Provided**, nhập ngày cấp.
   > "Hạn hiệu lực được gợi ý tự động."

   Bấm Save. Làm tương tự với Blood test.
3. Để **Brain CT** ở Missing.
4. Kéo lên, bấm **Enter fight week**.

**Màn hình:** "Gate 1 is not met. The bout stays in camp. Brain CT: missing".

> "Đây là Cổng 1: thiếu hồ sơ bắt buộc thì trận không vào được tuần thi đấu. App liệt kê đúng mục còn thiếu."

Màn hình cũng có khung đỏ "Documents late":

> "Hạn nộp là 7 ngày trước ngày cân. Trận này nhận sát ngày, nên app đánh dấu hồ sơ trễ hạn."

*(Tuỳ chọn)* Đặt Brain CT là Provided với hạn **trước** ngày thi, rồi bấm lại.

> "Có giấy nhưng hết hạn trước ngày thi thì vẫn bị chặn, và dòng hạn hiện màu đỏ."

## Bước 9. Đủ hồ sơ, vào tuần thi đấu

**Bấm:** Edit Brain CT → **Provided**, hạn sau ngày thi → Save → **Enter fight week**.

**Màn hình:** trạng thái **Fight week**, mục History thêm dòng "Camp → Fight week".

> "Đủ hồ sơ thì trận đi tiếp. Mọi lần chuyển trạng thái đều được ghi lại: ai làm, lúc nào. Checklist tự khoá trong tuần thi đấu; muốn sửa phải mở khoá và ghi lý do."

Sang cửa sổ Minh, tải lại **Bout**.

> "Trận vừa sang tuần thi đấu, nên võ sĩ tự thấy kế hoạch **Fight week** thay cho Camp, không ai phải báo."

## Kết (30 giây)

> "Tóm lại hôm nay em demo trọn phần Trước trận: tạo trận, cảnh báo cân, kế hoạch ăn theo giai đoạn, và Cổng 1. Tiếp theo là nối backend thật, làm phần Trong và Sau trận, và demo cuối ngày 31/10 với 4 kịch bản trên backend thật."

## Phần thêm nếu còn thời gian (3 phút): Trong và sau trận

> "Phần này thuộc Sprint 2, em cho xem trước bản demo."

Mở **Bouts** → trận của **Linh Phạm** (cân hôm nay):

1. **Record official weigh-in:** gõ `60,6` → app báo vượt 0,6 kg → chọn **Go on at a catchweight**, nhập 61 kèm ghi chú.
2. **Record result:** **Loss**, **KO**, mất ý thức **Under 1 minute** → Save.
   > "Theo luật AIBA, app gợi ý đình chỉ 90 ngày. HLV xác nhận, hoặc đổi số ngày nhưng phải ghi lý do."
3. **Confirm suspension** → **Save suspension**.
4. Vào **Training** → **Schedule session** cho Linh, loại **Sparring** → bị từ chối "Linh Phạm is suspended…".
   > "Đây là Cổng 2: còn đình chỉ thì không xếp được buổi tập bị cấm."

## Câu hỏi có thể gặp

- **Sao ngưỡng là 8% với 5%?** Theo nghiên cứu về giảm cân cấp tốc: cân trước thi từ 12 giờ trở lên thì 8%, dưới 12 giờ thì 5% cho thận trọng.
- **Xám khác đỏ chỗ nào?** Xám là thiếu dữ liệu (3 ngày không ghi cân), không phải "ổn". App nhắc võ sĩ ghi cân.
- **App có chặn được võ sĩ ra thi ngoài đời không?** Không. Cổng chỉ chặn trận đi tiếp trong app và làm thiếu sót hiện ra rõ ràng.
- **Hồ sơ có lưu ảnh giấy tờ không?** Không, chỉ lưu trạng thái và hạn hiệu lực. Không nhập giấy tờ y tế thật (quyết định 9).
- **Không có bác sĩ thì sao?** HLV đánh dấu Provided là đủ cho Cổng 1. Bác sĩ không bắt buộc.
- **Sao trên Today của Minh, thẻ lớn ghi 41 ngày mà trận chỉ còn 2–3 ngày?** Thẻ lớn đếm tới trận ghi trên hồ sơ, thẻ cân đếm tới trận vừa tạo. Hai số này cố ý tách riêng, chưa gộp trong đợt này.
- **Trận "Tự nhập" là gì?** Giải có quy định riêng thì HLV tự nhập giới hạn kg, ví dụ 63,5. App gắn nhãn "HLV nhập, chưa xác minh".
- **Sao không làm nhật ký calo hay chụp ảnh bữa ăn?** Mỗi bữa đều phải thao tác, khó duy trì, và phá mục tiêu ghi cân dưới 30 giây. Nhóm cũng không có chuyên môn dinh dưỡng để tự kê.
- **App có gợi ý ăn gì khi cân đỏ không?** Không. App chỉ khuyên trao đổi với bác sĩ hoặc chuyên gia dinh dưỡng và cân nhắc đổi hạng cân.
- **Trả lời hai lần trong một ngày thì sao?** Chỉ giữ câu trả lời mới nhất, giống cách lưu số cân.

## Dễ hỏng, cần nhớ

- **Thêm hồ sơ trước, rồi mới bấm "Enter fight week".** Checklist rỗng thì Cổng 1 coi như đạt, và trận sẽ vào tuần thi đấu luôn.
- **Viết kế hoạch ăn (bước 5) trước khi Minh ghi cân.** Bỏ bước này thì thẻ Camp của Minh ghi "No plan for this phase yet" và mất phần kết của bước 9.
- Khung đỏ "Documents late" là đúng nghiệp vụ. Muốn tránh thì bấm **Edit**, đặt "Documents due, days before weigh-in" = 0 trước khi thêm hồ sơ.
- Đừng tắt server giữa chừng, tắt là mất dữ liệu đã nhập.
- Ngày cân và ngày thi phải tính theo ngày demo thật (D+2, D+3), không dùng ngày trong ví dụ.
