# Kịch bản demo 4 người (30 phút, web + điện thoại trong trận)

Cập nhật 18/11/2026: chia lại theo người, tổng **30 phút gồm cả slide**. Trận demo **2 hiệp**. Nhãn nút trên web lấy từ bản đã deploy; chi tiết từng màn xem thêm [DEMO-10-11-KICH-BAN.md](./DEMO-10-11-KICH-BAN.md).

Chạy trên bản đã deploy, API mode, dữ liệu giả:

| Phần | Địa chỉ |
| --- | --- |
| Web | https://mma-tms-demo.vercel.app |
| API | https://mma-tms-api.onrender.com (mở `/health` trước 5 phút, Render ngủ sau 15 phút không dùng) |
| App điện thoại | **MMA Vision** (Android), `EXPO_PUBLIC_API_URL` trỏ tới API ở trên |
| Slide | Artifact slide trên claude.ai (12 slide) |

Chữ **đậm** là chữ thật trên màn.

## 1. Phân vai

| Người | Ai | Phần | Màn dùng | Thời gian |
| --- | --- | --- | --- | --- |
| **Người 1** | Hoàng Anh | Slide mở đầu, **Hôm nay**, **Tập luyện** (giáo án, buổi tập), **Phòng video** (HLV duyệt video AI, võ sĩ xem video và tự kiểm tra kỹ thuật), câu kết | Slide + web HLV + web võ sĩ | 11 phút |
| **Người 2** | Dan | **Trước trận**: tạo trận, bắt đầu camp, kế hoạch ăn, võ sĩ xem trận, cân chính thức, phân tích đối thủ | Web HLV + web võ sĩ | 7 phút |
| **Người 3** | Fon | **Trong trận**: thẻ góc đài, ghi 2 hiệp, lời dặn giữa hiệp | App điện thoại MMA Vision, chiếu lên máy chiếu | 4 phút |
| **Người 4** | Ken | **Sau trận**: kết quả, báo cáo, đình chỉ, chặn lịch tập, võ sĩ xem đình chỉ; **Bác sĩ** | Web HLV + web võ sĩ + web bác sĩ | 7 phút |
| | | Chuyển người, chuyển máy chiếu, dự phòng | | 1 phút |
| | | **Tổng** | | **30 phút** |

Câu chuyện chung: một trận của **Minh Trần**. Người 1 cho thấy CLB tập luyện hằng ngày ra sao và tạo giáo án trại thi đấu cho Minh. Người 2 nhận giáo án đó, tạo trận và đưa Minh tới lúc đạt cân. Người 3 cầm điện thoại ra góc đài. Người 4 nhận kết quả, xử lý đình chỉ và chuyển sang bác sĩ.

## 2. Thiết bị và chuẩn bị (trước giờ chiếu 30 phút)

**Một laptop chiếu**, ba trình duyệt với **ba kho cookie riêng**, người nào tới lượt thì đứng ở laptop:

| Trình duyệt | Tài khoản | Ai dùng |
| --- | --- | --- |
| Chrome thường | HLV `rafael.costa@lotus-combat.test` | Người 1, 2, 4 |
| Chrome ẩn danh, F12 → 390 px | Võ sĩ `minh.tran@lotus-combat.test` | Người 1, 2, 4 |
| Edge | Bác sĩ `thu.le@lotus-combat.test` | Người 4 |

Điện thoại Android của **Người 3**: mở **MMA Vision**, đăng nhập Rafael (cùng tài khoản HLV với web). Tắt thông báo và chế độ ngủ màn hình. Thử chiếu màn hình lên máy chiếu (scrcpy qua USB hoặc cast).

1. Mở `https://mma-tms-api.onrender.com/health` cho tới khi ra 200, rồi mở web một lượt ở cả ba trình duyệt.
2. Mật khẩu là mật khẩu thật của backend, không chiếu lên màn. Cả ba trình duyệt để **Tiếng Việt**.
3. Giờ thi phải **sau giờ hiện tại**: dùng **22:00** (sau 21:30 thì **23:30**), giờ cân **08:00** cùng ngày.
4. Ở cửa sổ bác sĩ, mở hồ sơ Minh, chắc Minh đang **Được tập**.
5. Ở **Phòng video**, chắc video **Bao cát — 19/11/2026** của Kenji Morita còn nhãn **AI đã xong** (Người 1 mở video này ở P3).
6. Thử webcam của laptop chiếu ở màn **Video** của võ sĩ (P3d), cho phép trình duyệt dùng camera.
7. Mở sẵn slide ở một tab riêng trên laptop chiếu.

## 3. Kịch bản

Thứ tự: **Người 1** (slide → Hôm nay → Tập luyện → Phòng video) → **Người 2** (trước trận) → **Người 3** (trong trận, điện thoại) → **Người 4** (sau trận → bác sĩ) → **Người 1** (câu kết).

### 3.1 Người 1 (Hoàng Anh): slide (4 phút)

| # | Nội dung | Câu nói |
| --- | --- | --- |
| S1 | Vấn đề | "CLB võ hiện quản lý trận đấu bằng giấy và nhóm chat: quên hạn hồ sơ y tế, võ sĩ giảm cân nguy hiểm, bị KO xong vẫn vào đấu tập." |
| S2 | Bốn vai và vòng đời một trận | "Có bốn vai: HLV, võ sĩ, bác sĩ, admin. Một trận đi qua trước trận, trong trận và sau trận." |
| S3 | Ba cổng an toàn | "App chặn đúng ba chỗ: thiếu hồ sơ y tế thì không vào tuần thi đấu, bị đình chỉ thì không xếp được buổi tập nguy hiểm, chưa được bác sĩ xác nhận thì không tập lại." |
| S4 | Kiến trúc ngắn | "Web Next.js, API NestJS, database Supabase, app điện thoại cho góc đài, AI phân tích video chạy riêng." |
| | **Chuyển sang tab web HLV** | "Giờ nhóm em đi trọn một trận của võ sĩ Minh Trần." |

Slide còn lại để dành cho phần hỏi đáp, không chiếu hết.

### 3.2 Người 1: Hôm nay và Tập luyện (3 phút), web HLV

| # | Màn | Thao tác | Câu nói |
| --- | --- | --- | --- |
| P1 | **Hôm nay** `/coach/dashboard` | Cuộn chậm qua **Cảnh báo cân**, **Việc cần xử lý**, **Việc cần làm** | "HLV mở app là thấy việc của cả đội: ai vượt cân, hồ sơ nào sắp trễ, ai chưa được tập." |
| P2a | **Tập luyện** → tab **Buổi tập** | Chỉ lịch **Theo tuần**, bấm qua **Danh sách** rồi về lại | "Lịch tập của cả CLB theo tuần. Mỗi ô là một buổi của một võ sĩ." |
| P2b | **Lên lịch buổi tập** | **Võ sĩ** Minh Trần → khung **Cấp phép y tế** bên phải hiện giới hạn của Minh · **Tiêu đề buổi tập** `Bao cát sáng` · **Loại hình tập luyện** **Bao cát** · ngày hôm nay, giờ 17:00, 60 phút, địa điểm bất kỳ → **Lên lịch buổi tập** | "Chọn võ sĩ là thấy ngay cấp phép y tế và giới hạn. Một số loại hình bị chặn nếu võ sĩ không đủ điều kiện, lát nữa sau trận anh Ken sẽ cho thấy." |
| P2c | Buổi tập vừa tạo | Chỉ nút **Bắt đầu buổi tập**, không bấm | "Tới giờ HLV bấm bắt đầu, app kiểm tra cấp phép lần nữa. Xong buổi HLV ghi RPE và số hiệp, võ sĩ thấy phần tổng kết." |
| P2d | Tab **Giáo án** → **Giáo án mới** | Mẫu **Trại thi đấu** → **Tiếp** → Võ sĩ **Minh Trần**, tiêu đề `Lotus Fight Night 18 – Minh` → **Tiếp** → **Tạo giáo án** | "Minh sắp có trận, nên em tạo giáo án trại thi đấu từ mẫu. Bạn Dan sẽ gắn giáo án này vào trận." |

### 3.3 Người 1: Phòng video (3,5 phút), web HLV rồi web võ sĩ

| # | Màn | Thao tác | Câu nói |
| --- | --- | --- | --- |
| P3a | **Phòng video** `/coach/video-analysis` | Chỉ **Hàng chờ duyệt** và danh sách **Đang xử lý hoặc cần kiểm tra** | "Võ sĩ hoặc HLV tải video tập lên, AI phân tích xong thì video vào hàng chờ HLV duyệt." |
| P3b | Mở **Bao cát — 19/11/2026** (Kenji Morita, **AI đã xong**, **Chờ HLV duyệt**) | Bấm phát; bật **Khung xương** và **Nhãn đòn**; chỉ **Tóm tắt của AI** (**Đòn nhận diện** 5, **Độ tin cậy tư thế** 90%) và **Chỉ số thi đấu** (**Số đòn mỗi phút**) | "AI dựng khung xương, đánh dấu từng đòn trên dòng thời gian, tính số đòn mỗi phút." |
| P3c | Cùng màn | Chỉ dòng **Kết quả AI là gợi ý. Hãy xác nhận hoặc sửa trước khi chia sẻ.** | "AI chỉ gợi ý. HLV xác nhận, sửa hoặc bác bỏ từng đòn trước khi võ sĩ thấy." |
| P3d | **Cửa sổ võ sĩ** (Minh): menu **Video** `/fighter/videos` | Chỉ nút **Tải video lên để AI phân tích** và danh sách video của Minh. Thẻ **Kiểm tra kỹ thuật trực tiếp** (**Thử nghiệm**) → **Bắt đầu kiểm tra**, đứng trước webcam đá vòng cầu 2–3 lần | "Phía võ sĩ: tự quay video tập gửi lên cho AI và HLV. Muốn sửa đòn ngay thì bật camera: app đo độ co gối, độ duỗi chân và tốc độ ngay trên máy, không ghi hình, không tải lên." |
| | | **Chuyển cho Người 2 (Dan)** | "Giờ tới phần trước trận." |

Không tải video mới khi chiếu: phân tích chạy trên worker Colab, mất từ 1 phút (GPU) tới vài phút (CPU).

### 3.4 Người 2 (Dan): Trước trận (7 phút)

Web HLV, trừ V1–V3 ở cửa sổ võ sĩ.

| # | Màn | Thao tác | Câu nói |
| --- | --- | --- | --- |
| A1 | **Trận đấu** → **Trận đấu mới** `/coach/bouts/new` | **Võ sĩ** Minh Trần · **Bộ luật thi đấu** `MMA – VMMAF 2021` · **Hạng cân** 70 kg · **Giải đấu** `Lotus Fight Night 18` · **Đối thủ** `Arman Petrosyan` · **Số hiệp dự kiến** **2 hiệp** · **Giờ cân** hôm nay 08:00 · **Giờ thi đấu** hôm nay 22:00 → đợi khung **Kiểm tra cân nặng** → **Tạo trận đấu** | "Minh nhận trận. Chọn bộ luật là app tự lấy hạng cân, hạn hồ sơ, ngưỡng giảm cân cấp tính, và tính ngay Minh có kịp đạt cân không." |
| A2 | Trang trận | **Liên kết giáo án** → chọn giáo án anh Hoàng Anh vừa tạo → **Bắt đầu camp** | "Camp gắn với trận, biểu đồ cân tính từ ngày đầu giáo án." |
| A3 | Thẻ **Kế hoạch ăn** | Ô **Trong camp** `Cơm, thịt nạc, rau. Cắt tinh bột sau 18h.` → **Lưu kế hoạch** | "Ba giai đoạn ăn: trong camp, tuần thi đấu, sau cân." |
| V1 | **Cửa sổ võ sĩ**: **Hôm nay** `/fighter/dashboard` (tải lại) | Không bấm | "Phía võ sĩ: hôm nay tập gì, còn bao nhiêu ngày đến trận, đã được bác sĩ cho tập chưa." |
| V2 | **Trận đấu** `/fighter/bout` | Không bấm | "Kế hoạch ăn HLV vừa lưu đã tới, võ sĩ chỉ thấy giai đoạn hiện tại." |
| V3 | **Ghi cân** | Chỉ cho xem form, **không lưu** | "Mỗi sáng võ sĩ ghi một số cân, app so với lộ trình giảm cân an toàn." |
| A4 | **Về cửa sổ HLV**, trang trận | **Vào tuần thi đấu** | "Cổng 1: thiếu hồ sơ y tế bắt buộc thì app chặn ở đây. Bộ luật này không bắt hồ sơ nên đi thẳng." |
| A5 | Trang trận | **Ghi cân chính thức** → **Cân nặng** `69,5` → **Đạt cân.** → **Lưu kết quả cân** | "Đạt cân thì mở phần góc đài. Quá cân thì app chỉ hỏi: thi ở mức cân thoả thuận hay huỷ trận." |
| A6 | **Phân tích đối thủ** | Chỉ cuộn | "Mỗi chiến thuật phải dựa trên một quan sát có bằng chứng. App dựng thẻ góc đài từ đây." |
| | | **Chuyển máy chiếu sang điện thoại, Người 3 (Fon)** | "Tới giờ thi đấu, HLV cầm điện thoại ra góc đài." |

### 3.5 Người 3 (Fon): Trong trận, app điện thoại MMA Vision (4 phút)

Trận chỉ 2 hiệp: ghi hiệp 1, đọc lời dặn trước hiệp 2, ghi hiệp 2 là xong.

| # | Màn trên điện thoại | Thao tác | Câu nói |
| --- | --- | --- | --- |
| B0 | Tab **Võ sĩ** | **Trận thi đấu · Fight Camp** → thẻ trận `Lotus Fight Night 18` → **Mở chi tiết trận** | "Ở góc đài HLV chỉ cầm điện thoại. Trận Dan vừa tạo trên web đã có ở đây." |
| B1 | **Thẻ góc đài** | **Mở thẻ góc đài**, cuộn | "Thẻ góc đài là các chiến thuật đã lập, ghi rõ chiến thuật nào đã luyện, chiến thuật nào chưa." |
| B2 | **Ghi chú và ghi hiệp** → **Ghi hiệp 1** | Chiến thuật thứ nhất **Hiệu quả**, thứ hai **Không hiệu quả** · quan sát chính **Có thấy** · **HLV tự chấm** **Thua** · **Ghi thêm** → bật **Mệt** · **Chốt hiệp 1** | "Một phút giữa hiệp: chỉ bấm, không gõ chữ." |
| B3 | **Lời dặn trước hiệp 2** (hiện ngay sau khi chốt) | Đọc 2–3 dòng; chỉ dòng "Chỉ mang tính gợi ý — HLV là người quyết định tại góc đài." | "Chốt hiệp là có lời dặn cho hiệp sau, dựa trên phần vừa ghi và phân tích đối thủ. HLV vẫn là người quyết." |
| B4 | **Hiệp 2** | Chiến thuật thứ hai lại **Không hiệu quả** · **HLV tự chấm** **Thua** · **Ghi thêm** → **Số lần bị đánh ngã** 1 · bật **Choáng** · **Chốt hiệp 2** (hiện **Hiệp cuối — chỉ lưu diễn biến hiệp.**) | "Minh bị đánh ngã ở hiệp 2. Dữ liệu hai hiệp đi thẳng về web cho báo cáo sau trận." |
| | | **Chuyển máy chiếu về laptop, Người 4 (Ken)** | |

Không bấm **AI dặn** khi chiếu: gọi AI thật, có thể chờ tới 12 giây hoặc báo lỗi hết lượt.

### 3.6 Người 4 (Ken): Sau trận (4,5 phút)

Web HLV, trừ V4–V5 ở cửa sổ võ sĩ.

| # | Màn | Thao tác | Câu nói |
| --- | --- | --- | --- |
| C1 | Trang trận | **Ghi kết quả** → **Kết quả** Thua · **Cách kết thúc** KO · **Hiệp** 2 · **Có mất ý thức không?** Dưới 1 phút · **Số ngày đình chỉ** 30 → **Lưu kết quả** | "Minh thua KO ở hiệp 2. Lưu kết quả là app tạo đình chỉ ngay trong cùng lần lưu." |
| R | **Báo cáo sau trận** | Cuộn **Điểm cần luyện cho camp sau**; đổi **Kết luận** một chiến thuật → **Lưu đánh giá** | "Hai hiệp Fon ghi trên điện thoại đã thành báo cáo. App tự chấm từng chiến thuật, HLV chỉ sửa chỗ thấy khác. Bài học đi sang camp sau." |
| C2 | **Trận đấu** → tab **Đình chỉ** | Không bấm | "Đình chỉ của cả CLB: ai, vì sao, đến ngày nào, bị chặn loại buổi nào." |
| C3 | **Tập luyện** → **Buổi tập** → **Lên lịch buổi tập** | Minh Trần · loại **Đấu tập** · hôm nay → **Lên lịch buổi tập** → app báo bị chặn | "Cổng 2: buổi Bao cát anh Hoàng Anh xếp lúc nãy vẫn giữ, nhưng Đấu tập thì bị chặn tự động trong thời gian đình chỉ." |
| V4 | **Cửa sổ võ sĩ**: **Hôm nay** (tải lại) | Không bấm | "Võ sĩ thấy ngay mình bị đình chỉ và còn tập được gì." |
| V5 | **Sức khỏe** | Xoay hình 3D ở **Sơ đồ cơ thể** | "Chấn thương hiện tại và cũ hiện trên cơ thể 3D. Võ sĩ chỉ xem, bác sĩ ghi." |

### 3.7 Người 4 (Ken): Bác sĩ (2,5 phút), cửa sổ Edge

| # | Màn | Thao tác | Câu nói |
| --- | --- | --- | --- |
| D1 | **Hôm nay** `/doctor/dashboard` | Tải lại | "Ba cột **Chặn**, **Theo dõi**, **Thông qua**. Minh vừa thua KO đã sang cột Chặn, cổng **Tập luyện** gạch chéo." |
| D2 | **Võ sĩ** → hồ sơ Minh | Kéo xoay **Bản đồ cơ thể** | "Bác sĩ thấy chấn thương trên cơ thể 3D, kéo để xoay ra mặt sau." |
| D3 | **Giấy phép** | Không bấm | "Giấy phép tập và thi đấu tách riêng, có hạn. Hết 30 ngày đình chỉ, bác sĩ khám và xác nhận thì Minh mới tập lại, theo từng bậc." |
| | | **Trả lời cho Người 1** | "App còn có admin phân quyền và nhật ký thao tác, và chạy song ngữ Việt – Anh." |

### 3.8 Người 1: câu kết (0,5 phút)

"Trước trận app chặn đúng lúc. Trong trận, HLV ở góc đài chỉ cần điện thoại để ghi hiệp và nhận lời dặn. Sau trận app tự tạo đình chỉ, chặn lịch tập nguy hiểm, chuyển bài học sang camp sau, và bác sĩ quyết định khi nào võ sĩ được tập lại. Nhóm em xin hết."

## 4. Thời gian

| Phần | Người | Phút | Đồng hồ |
| --- | --- | --- | --- |
| Slide | Hoàng Anh | 4 | 0:00–4:00 |
| Hôm nay, Tập luyện | Hoàng Anh | 3 | 4:00–7:00 |
| Phòng video (HLV và võ sĩ) | Hoàng Anh | 3,5 | 7:00–10:30 |
| Trước trận | Dan | 7 | 10:30–17:30 |
| Trong trận (điện thoại) | Fon | 4 | 17:30–21:30 |
| Sau trận | Ken | 4,5 | 21:30–26:00 |
| Bác sĩ | Ken | 2,5 | 26:00–28:30 |
| Câu kết | Hoàng Anh | 0,5 | 28:30–29:00 |
| Dự phòng (chuyển người, mạng chậm) | | 1 | 29:00–30:00 |
| **Tổng** | | **30** | |

Trễ giờ thì cắt theo thứ tự: slide S4 (nói một câu), P2c, phần webcam ở P3d (chỉ nói), P3a (mở thẳng video), A3 và V3, D3, C2. Không cắt: P2b, P2d, A1, A2, A5, B2–B4, C1, R, C3, D1.

Lúc 17:30 chưa tới phần điện thoại thì Dan bỏ A6 và V3. Lúc 26:00 Ken chưa sang bác sĩ thì bỏ V5 và D2.

## 5. Sự cố hay gặp

| Sự cố | Làm gì |
| --- | --- |
| Web hoặc app báo lỗi mạng ở lần mở đầu | Render đang thức dậy (khoảng 50 giây). Mở `/health` trước giờ chiếu. |
| P2d không tạo được giáo án | Tạo sẵn giáo án `Lotus Fight Night 18 – Minh` trước giờ chiếu, khi chiếu chỉ mở ra. |
| A2 báo không có giáo án / võ sĩ đã có trận khác | Giáo án phải của Minh và là trại thi đấu. Minh còn trận chưa xong thì backend từ chối: dùng trận đó. |
| Webcam không bật hoặc không nhận chân ở P3d | Bỏ phần đá trước camera, chỉ đọc mô tả trên thẻ **Kiểm tra kỹ thuật trực tiếp**. |
| Video Kenji không phát được | Chỉ phần **Tóm tắt của AI** và **Chỉ số thi đấu**, nói phần khung xương bằng lời. |
| App điện thoại không thấy trận vừa tạo | Kéo xuống để tải lại, hoặc **Tải lại danh sách**. Kiểm tra app đăng nhập đúng tài khoản Rafael. |
| Không thấy **Mở thẻ góc đài** trên điện thoại | Chỉ mở sau khi **Đạt cân** ở A5. Tải lại chi tiết trận. |
| Tạo trận báo giờ thi đã qua | Đổi 23:30, giờ cân 08:00 cùng ngày. Không tạo trận ngày mai: sẽ không ghi được kết quả hôm nay. |
| Chiếu màn hình điện thoại bị đứt | Fon đọc to từng bước, Ken mở **Ghi hiệp & lời dặn** trên web HLV cho khán giả thấy cùng dữ liệu. |
| Lưu kết quả bị từ chối | Thua KO phải có **Hiệp**, **Có mất ý thức không?** và **Số ngày đình chỉ**. Hiệp không được lớn hơn 2. |
| Hỏi về mô hình 3D nữ | Admin đặt **Giới tính: Nữ** cho võ sĩ nữ thì mọi màn dùng mô hình nữ. Mô hình do nhóm tự làm. |
| Backend hỏng hẳn | Chuyển demo mode trên máy (`APP_DATA_MODE=demo`, `pnpm dev`, cổng 3000). Phần điện thoại chuyển sang **Xem bản mẫu giao diện** trong màn Trận thi đấu của app. |
