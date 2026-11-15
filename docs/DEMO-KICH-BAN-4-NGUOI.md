# Kịch bản demo 4 người (web + mobile trong trận)

Cập nhật 15/11/2026, sau nhận xét của thầy: trận demo rút còn **2 hiệp**, bỏ dòng nguồn mô hình 3D trên màn hình, bỏ chữ nhỏ thừa, xem lại giấy phép y tế. File này thay phần phân vai của [DEMO-10-11-KICH-BAN.md](./DEMO-10-11-KICH-BAN.md); nhãn nút trên web vẫn như file đó, trừ những chỗ ghi khác ở đây.

Chạy trên bản đã deploy, API mode, dữ liệu giả:

| Phần | Địa chỉ |
| --- | --- |
| Web | https://mma-tms-demo.vercel.app |
| API | https://mma-tms-api.onrender.com (mở `/health` trước 5 phút, Render ngủ sau 15 phút không dùng) |
| App điện thoại | **MMA Vision** (Android), `EXPO_PUBLIC_API_URL` trỏ tới API ở trên |

Chữ **đậm** là chữ thật trên màn.

## 1. Phân vai

| Người | Vai trong demo | Thiết bị | Phần chính |
| --- | --- | --- | --- |
| **Người 1** | Huấn luyện viên (web) | Laptop chiếu chính | Mở đầu, chuẩn bị trận, sau trận |
| **Người 2** | Võ sĩ Minh Trần (web, cỡ điện thoại) | Laptop thứ hai, F12 → 390 px | Võ sĩ trước trận và sau trận |
| **Người 3** | Huấn luyện viên ở góc đài (**app điện thoại**) | Điện thoại Android, chiếu màn hình lên máy chiếu (scrcpy qua USB, hoặc cast) | **Trong trận**: thẻ góc đài, ghi 2 hiệp, lời dặn giữa hiệp |
| **Người 4** | Bác sĩ Thu Lê, rồi Admin | Laptop thứ hai (sau khi Người 2 xong) hoặc laptop thứ ba | Phân loại y tế, giấy phép, mô hình 3D, admin |

Câu chuyện chung: một trận của **Minh Trần** từ lúc nhận trận đến sau trận. Web lo trước trận và sau trận. Điện thoại lo phần trong trận, vì HLV đứng ở góc đài chỉ có điện thoại và một phút giữa hai hiệp.

## 2. Chuẩn bị (trước giờ chiếu 30 phút)

1. Mở `https://mma-tms-api.onrender.com/health` cho tới khi ra 200, rồi mở web một lượt cho Render và Vercel thức.
2. Ba trình duyệt, **ba kho cookie riêng** (Chrome thường, Chrome ẩn danh, Edge): HLV `rafael.costa@lotus-combat.test`, võ sĩ `minh.tran@lotus-combat.test`, bác sĩ `thu.le@lotus-combat.test`. Admin `admin@gmail.com` đăng nhập sau ở cửa sổ bác sĩ. Mật khẩu là mật khẩu thật của backend, không chiếu lên màn.
3. Điện thoại: mở **MMA Vision**, đăng nhập `rafael.costa@lotus-combat.test` (cùng tài khoản HLV với web). Tắt thông báo và chế độ ngủ màn hình. Thử chiếu màn hình lên máy chiếu.
4. Cả ba trình duyệt để **Tiếng Việt**.
5. Giờ thi phải **sau giờ hiện tại**: dùng **22:00** (sau 21:30 thì **23:30**), giờ cân **08:00** cùng ngày.
6. Mở trước hồ sơ Minh ở cửa sổ bác sĩ, chắc Minh đang **Được tập** (Minh từng có yêu cầu xem xét cũ).
7. Thiếu thời gian thì tạo sẵn giáo án (bước A0) trước giờ chiếu.

## 3. Kịch bản

Thứ tự: Mở đầu (N1) → Chuẩn bị trận (N1) → Võ sĩ lần 1 (N2) → Cân chính thức (N1) → **Trong trận trên điện thoại (N3)** → Sau trận (N1) → Võ sĩ lần 2 (N2) → Bác sĩ (N4) → Admin (N4) → Kết (N1).

### 3.1 Mở đầu: Người 1, web HLV (1 phút)

| # | Màn | Thao tác | Câu nói |
| --- | --- | --- | --- |
| M1 | **Hôm nay** `/coach/dashboard` | Cuộn chậm qua **Cảnh báo cân**, **Việc cần xử lý**, **Việc cần làm** | "HLV mở app là thấy việc cần làm của cả đội: ai vượt cân, hồ sơ nào sắp trễ, ai chưa được tập." |
| M2 | **Trận đấu** `/coach/bouts` | Không bấm | "Hôm nay nhóm em đi trọn một trận mới cho Minh Trần. Bốn người là bốn vai: HLV, võ sĩ, HLV ở góc đài trên điện thoại, và bác sĩ." |

### 3.2 Chuẩn bị trận: Người 1, web HLV (5 phút)

| # | Màn | Thao tác | Câu nói |
| --- | --- | --- | --- |
| A0 | **Tập luyện** → tab **Giáo án** → **Giáo án mới** | Mẫu **Trại thi đấu** → **Tiếp** → Võ sĩ **Minh Trần**, tiêu đề `Lotus Fight Night 18 – Minh` → **Tiếp** → **Tạo giáo án** | "Trận cần một giáo án trại thi đấu. Mẫu điền sẵn phần lớn." |
| A1 | **Trận đấu mới** `/coach/bouts/new` | **Võ sĩ** Minh Trần · **Bộ luật thi đấu** `MMA – VMMAF 2021` · **Hạng cân** 70 kg · **Giải đấu** `Lotus Fight Night 18` · **Đối thủ** `Arman Petrosyan` · **Số hiệp dự kiến** **2 hiệp** · **Giờ cân** hôm nay 08:00 · **Giờ thi đấu** hôm nay 22:00 → đợi khung **Kiểm tra cân nặng** → **Tạo trận đấu** | "Chọn bộ luật là app tự lấy hạng cân, hạn hồ sơ, ngưỡng giảm cân cấp tính. Trận demo để 2 hiệp cho gọn." |
| A2 | Trang trận | **Liên kết giáo án** → chọn giáo án vừa tạo → **Bắt đầu camp** | "Camp gắn với trận, biểu đồ cân tính từ ngày đầu giáo án." |
| A3 | Trang trận, thẻ **Kế hoạch ăn** | Ô **Trong camp** `Cơm, thịt nạc, rau. Cắt tinh bột sau 18h.` → **Lưu kế hoạch** | "Ba giai đoạn ăn, võ sĩ chỉ thấy ô đang áp dụng." |
| | | **Chuyển cho Người 2** | |

### 3.3 Võ sĩ lần 1: Người 2, web cỡ điện thoại (2 phút)

| # | Màn | Thao tác | Câu nói |
| --- | --- | --- | --- |
| V1 | **Hôm nay** `/fighter/dashboard` | Không bấm | "Võ sĩ mở app thấy hôm nay tập gì, còn bao nhiêu ngày đến trận, đã được bác sĩ cho tập chưa." |
| V2 | **Trận đấu** `/fighter/bout` | Không bấm | "HLV vừa lưu kế hoạch ăn là võ sĩ thấy, chỉ phần của giai đoạn hiện tại." |
| V3 | **Ghi cân** | Chỉ cho xem form, **không lưu** | "Mỗi sáng võ sĩ ghi một số cân, app so với lộ trình giảm cân an toàn." |
| | | **Trả lại Người 1** | |

### 3.4 Cân chính thức: Người 1, web HLV (2 phút)

| # | Màn | Thao tác | Câu nói |
| --- | --- | --- | --- |
| A4 | Trang trận | **Vào tuần thi đấu** | "Cổng 1: thiếu hồ sơ y tế bắt buộc thì app chặn ở đây. Bộ luật này không bắt hồ sơ nên đi thẳng." |
| A5 | Trang trận | **Ghi cân chính thức** → **Cân nặng** `69,5` → **Đạt cân.** → **Lưu kết quả cân** | "Đạt cân là mở phần góc đài. Từ đây HLV cầm điện thoại ra góc đài." |
| A6 | **Phân tích đối thủ** | Chỉ cuộn | "Mỗi chiến thuật phải dựa trên một quan sát có bằng chứng. App dựng thẻ góc đài từ đây." |
| | | **Chuyển máy chiếu sang điện thoại, Người 3** | |

### 3.5 Trong trận: Người 3, app điện thoại MMA Vision (4 phút)

Trận chỉ 2 hiệp: ghi hiệp 1, đọc lời dặn trước hiệp 2, ghi hiệp 2 là xong.

| # | Màn trên điện thoại | Thao tác | Câu nói |
| --- | --- | --- | --- |
| B0 | Tab **Võ sĩ** | Bấm **Trận thi đấu · Fight Camp** → thẻ trận `Lotus Fight Night 18` → **Mở chi tiết trận** | "Ở góc đài HLV chỉ cầm điện thoại. Trận vừa tạo trên web đã có ở đây." |
| B1 | **Thẻ góc đài** | **Mở thẻ góc đài**, cuộn | "Thẻ góc đài là các chiến thuật đã lập, ghi rõ chiến thuật nào đã luyện, chiến thuật nào chưa." |
| B2 | **Ghi chú và ghi hiệp** → **Ghi hiệp 1** | Chiến thuật thứ nhất **Hiệu quả**, thứ hai **Không hiệu quả** · quan sát chính **Có thấy** · **HLV tự chấm** **Thua** · **Ghi thêm** → bật **Mệt** · **Chốt hiệp 1** | "Một phút giữa hiệp: chỉ bấm, không gõ chữ." |
| B3 | **Lời dặn trước hiệp 2** (hiện ngay sau khi chốt) | Đọc 2–3 dòng lời dặn; chỉ dòng "Chỉ mang tính gợi ý — HLV là người quyết định tại góc đài." Tuỳ chọn: chọn tối đa 3 lời dặn trong **Hiệp 2: làm gì** | "Chốt hiệp là có lời dặn cho hiệp sau, dựa trên phần vừa ghi và phân tích đối thủ. HLV vẫn là người quyết." |
| B4 | **Hiệp 2** | Chiến thuật thứ hai lại **Không hiệu quả** · **HLV tự chấm** **Thua** · **Ghi thêm** → **Số lần bị đánh ngã** 1 · bật **Choáng** · **Chốt hiệp 2** (hiện **Hiệp cuối — chỉ lưu diễn biến hiệp.**) | "Hiệp cuối chỉ lưu diễn biến. Dữ liệu này đi thẳng về web cho báo cáo sau trận." |
| | | **Chuyển máy chiếu về laptop, Người 1** | |

Không bấm **AI dặn** khi chiếu: gọi AI thật, có thể chờ tới 12 giây hoặc báo lỗi hết lượt.

### 3.6 Sau trận: Người 1, web HLV (4 phút)

| # | Màn | Thao tác | Câu nói |
| --- | --- | --- | --- |
| C1 | Trang trận | **Ghi kết quả** → **Kết quả** Thua · **Cách kết thúc** KO · **Hiệp** 2 · **Có mất ý thức không?** Dưới 1 phút · **Số ngày đình chỉ** 30 → **Lưu kết quả** | "Thua KO là app tạo đình chỉ ngay trong cùng lần lưu." |
| R | **Báo cáo sau trận** | Cuộn **Điểm cần luyện cho camp sau**; đổi **Kết luận** một chiến thuật → **Lưu đánh giá** | "Hai hiệp vừa ghi trên điện thoại đã thành báo cáo. App tự chấm từng chiến thuật, HLV chỉ sửa chỗ thấy khác." |
| C2 | **Trận đấu** → tab **Đình chỉ** | Không bấm | "Đình chỉ của cả CLB: ai, vì sao, đến ngày nào, bị chặn loại buổi nào." |
| C3 | **Tập luyện** → **Buổi tập** → **Lên lịch buổi tập** | Minh Trần · loại **Đấu tập** · hôm nay → **Lên lịch buổi tập** | "Cổng 2: lịch tập nguy hiểm bị chặn tự động trong thời gian đình chỉ." |
| | | **Chuyển cho Người 2** | |

### 3.7 Võ sĩ lần 2: Người 2 (1 phút)

| # | Màn | Thao tác | Câu nói |
| --- | --- | --- | --- |
| V4 | **Hôm nay** (tải lại) | Không bấm | "Võ sĩ thấy ngay mình bị đình chỉ và còn tập được gì." |
| V5 | **Sức khỏe** | Xoay hình 3D ở **Sơ đồ cơ thể** | "Chấn thương hiện tại và cũ hiện trên cơ thể 3D. Võ sĩ chỉ xem, bác sĩ ghi." |
| | | **Chuyển cho Người 4** | |

### 3.8 Bác sĩ: Người 4, web (3 phút)

| # | Màn | Thao tác | Câu nói |
| --- | --- | --- | --- |
| D1 | **Hôm nay** `/doctor/dashboard` | Tải lại | "Ba cột **Chặn**, **Theo dõi**, **Thông qua**. Minh vừa thua KO đã sang cột Chặn, cổng **Tập luyện** gạch chéo vì đang đình chỉ." |
| D2 | **Võ sĩ** → hồ sơ Minh | Kéo xoay **Bản đồ cơ thể** | "Bác sĩ thấy chấn thương trên cơ thể 3D, kéo để xoay ra mặt sau." |
| D3 | **Giấy phép** | Không bấm | "Giấy phép tập và thi đấu tách riêng, có hạn. Cột **Sắp hết hạn** cảnh báo trước. Giấy phép cấp với ngày bắt đầu sau hôm nay hiện **Bắt đầu hiệu lực …**, không bị tính là hết hạn." |
| D4 | Menu tài khoản → **Ngôn ngữ** → **English**, xem lại D1, rồi đổi lại **Tiếng Việt** | | "App song ngữ." |

### 3.9 Admin: Người 4 (1 phút)

Đăng xuất bác sĩ, đăng nhập `admin@gmail.com`.

| # | Màn | Câu nói |
| --- | --- | --- |
| AD1 | **Người dùng** → **Vai trò và quyền** | "Mỗi vai có quyền riêng. HLV chỉ thấy võ sĩ mình phụ trách." |
| AD2 | **Nhật ký hệ thống** | "Thao tác quan trọng đều được ghi lại: ai làm, lúc nào." |

**Câu kết (Người 1):** "Trước trận app chặn đúng lúc. Trong trận, HLV ở góc đài chỉ cần điện thoại để ghi hiệp và nhận lời dặn. Sau trận app tự tạo đình chỉ, chặn lịch tập nguy hiểm và chuyển bài học sang camp sau."

## 4. Thời gian

| Phần | Người | Phút |
| --- | --- | --- |
| Mở đầu | 1 | 1 |
| Chuẩn bị trận | 1 | 5 |
| Võ sĩ lần 1 | 2 | 2 |
| Cân chính thức | 1 | 2 |
| Trong trận (điện thoại, 2 hiệp) | 3 | 4 |
| Sau trận | 1 | 4 |
| Võ sĩ lần 2 | 2 | 1 |
| Bác sĩ | 4 | 3 |
| Admin | 4 | 1 |
| **Tổng** | | **23** |

Thiếu giờ thì cắt theo thứ tự: Admin (chỉ nói một câu), A0 (tạo sẵn), A3 và V3, D4, C2. Không cắt: A1, A5, B2–B4, C1, R, C3, D1.

## 5. Sự cố hay gặp

| Sự cố | Làm gì |
| --- | --- |
| Web hoặc app báo lỗi mạng ở lần mở đầu | Render đang thức dậy (khoảng 50 giây). Mở `/health` trước giờ chiếu. |
| App điện thoại không thấy trận vừa tạo | Kéo xuống để tải lại, hoặc **Tải lại danh sách**. Kiểm tra app đăng nhập đúng tài khoản Rafael. |
| Không thấy **Mở thẻ góc đài** trên điện thoại | Chỉ mở sau khi **Đạt cân** ở A5. Tải lại chi tiết trận. |
| Tạo trận báo giờ thi đã qua | Đổi 23:30, giờ cân 08:00 cùng ngày. Không tạo trận ngày mai: sẽ không ghi được kết quả hôm nay. |
| Chiếu màn hình điện thoại bị đứt | Người 3 đọc to từng bước, Người 1 mở **Ghi hiệp & lời dặn** trên web cho khán giả thấy cùng dữ liệu. |
| Lưu kết quả bị từ chối | Thua KO phải có **Hiệp**, **Có mất ý thức không?** và **Số ngày đình chỉ**. Hiệp không được lớn hơn 2. |
| Hỏi vì sao mô hình 3D toàn nam | Backend chưa có trường giới tính, nên API mode dùng mô hình nam cho mọi người. Ở demo mode (dữ liệu mẫu) võ sĩ nữ như Sofia Kowalski dùng mô hình nữ, cả màn bác sĩ. |
| Hỏi nguồn mô hình 3D | Nguồn và giấy phép ghi trong `nextjs-frontend/public/models/ATTRIBUTION.md`, không hiện trên màn hình. |
| Backend hỏng hẳn | Chuyển demo mode trên máy (`APP_DATA_MODE=demo`, `pnpm dev`, cổng 3000). Phần điện thoại chuyển sang **Xem bản mẫu giao diện** trong màn Trận thi đấu của app. |
