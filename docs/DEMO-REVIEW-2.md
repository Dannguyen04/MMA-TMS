# Kịch bản demo review 2 (20/10/2026)

Dành cho người trình bày. Demo chạy ở **demo mode** của frontend (dữ liệu mẫu trong bộ nhớ), vì backend lõi trận (T-003) chưa có. Theo [Phạm vi, mốc chốt Sprint 1](./SCOPE-FIGHT-CAMP.md#sprint-1--trước-trận-1410--1910-demo-ở-review-2-ngày-2010), dùng demo mode cần chủ dự án đồng ý, và khi trình bày phải nói rõ backend đang tích hợp.

## Chuẩn bị (trước giờ demo 15 phút)

1. Lấy nhánh đã gộp. Trước khi chủ dự án merge vào `fight-camp`, dùng `feat/T-013-i18n-vi`: nhánh này đã chứa T-004, T-005 và phần tiếng Việt.
2. Chạy frontend ở demo mode: không đặt `APP_DATA_MODE=api`, không cần `.env`.

    ```bash
    pnpm --filter nextjs-frontend dev
    ```

3. Mở `http://localhost:3000/login`. Ngôn ngữ mặc định là tiếng Việt; nút đổi ngôn ngữ nằm góc trên bên phải.
4. **Dữ liệu demo nằm trong bộ nhớ.** Muốn bắt đầu lại từ đầu thì tắt và chạy lại dev server. Nhớ khởi động lại sau khi tập dượt, vì lúc tập đã ghi cân và tạo trận.
5. Mở sẵn hai cửa sổ trình duyệt, một cửa sổ thường và một cửa sổ ẩn danh, để đăng nhập HLV và võ sĩ cùng lúc. Nếu có thể, để cửa sổ võ sĩ ở bề rộng điện thoại (F12, chế độ thiết bị 390 px).

## Tài khoản

| Vai | Đăng nhập | Dùng cho |
| --- | --- | --- |
| HLV Rafael Costa | Nút "HLV trưởng" trong mục Tài khoản demo | Tạo trận, theo dõi cân, Cổng 1 |
| Võ sĩ Minh Trần | Nút "Võ sĩ" | Trận đang đỏ có sẵn (Saigon Warriors MMA 04) |
| Võ sĩ Tariq Haddad | Email `tariq.haddad@lotus-combat.test`, mật khẩu `mma-demo` | Võ sĩ của trận tạo trực tiếp trong buổi demo |

## Luồng trình bày (khoảng 8 phút)

Theo đúng luồng review 2 trong Phạm vi: tạo trận → võ sĩ ghi cân → cân chuyển đỏ → thêm mục hồ sơ → Cổng 1 chặn vì thiếu hồ sơ → đủ hồ sơ thì vào tuần thi đấu.

### 1. HLV tạo trận (1,5 phút)

1. Đăng nhập HLV. Trang **Hôm nay** có thẻ **Cảnh báo cân**, trong đó Minh Trần đang "Vượt ngưỡng giảm cân". Nói: cảnh báo này tính từ số cân võ sĩ tự ghi, so với lộ trình giảm cân an toàn.
2. Menu **Trận đấu** → **Tạo trận mới**.
3. Điền form:
    - Võ sĩ: Tariq Haddad.
    - Luật thi đấu: MMA – VMMAF 2021.
    - Hạng cân: 93 kg.
    - Tên giải: "Lotus Fight Night 19".
    - Đối thủ: để trống.
    - Thời gian cân: **5 ngày sau hôm nay**, 09:00.
    - Thời gian thi đấu: ngày hôm sau, 19:00.
4. (Tùy chọn) Đặt giờ cân sau giờ thi đấu → form báo lỗi ngay tại ô, không gửi đi.
5. Bấm **Tạo trận đấu**. Trận mới xuất hiện trong danh sách với trạng thái cân "Chưa cân gần đây".

### 2. Võ sĩ ghi cân, cân chuyển đỏ (2 phút)

1. Ở cửa sổ ẩn danh, đăng nhập Tariq Haddad (bằng email). Trang **Hôm nay** hiện trận Lotus Fight Night 19, đếm ngược và ô **Cân nặng** có nút **Ghi cân**.
2. Bấm **Ghi cân**, gõ `103,5` (dấu phẩy cũng được), bấm **Lưu**. Thao tác dưới 30 giây.
3. Trang **Trận đấu** của võ sĩ hiện thông báo "Đã lưu 103.5 kg · Trạng thái: Vượt ngưỡng giảm cân". Giải thích cho hội đồng:
    - Còn phải giảm 10,1% trong 5 ngày, vượt ngưỡng giảm cấp tốc 8% của bộ luật.
    - Câu khuyến nghị cho võ sĩ: "Hãy trao đổi với HLV và bác sĩ ngay hôm nay".
    - App không gợi ý cách giảm cân.
4. Quay lại cửa sổ HLV, tải lại trang **Hôm nay**: Tariq Haddad xuất hiện trong thẻ Cảnh báo cân. Bấm vào để mở chi tiết trận, cho xem biểu đồ: đường cân, lộ trình tham chiếu và đường giới hạn. Dùng phím mũi tên để đọc giá trị từng ngày.

### 3. Cổng 1: thiếu hồ sơ thì chặn, đủ thì vào tuần thi đấu (3 phút)

Dùng trận có sẵn **National Boxing Cup 2026** (võ sĩ Aigerim Sadykova). Trận này đang ở trạng thái "Đang tập camp" và còn thiếu giấy khám sức khỏe.

1. Menu **Trận đấu** → National Boxing Cup 2026. Thẻ **Hồ sơ y tế** có badge "Cổng 1: Thiếu 1".
2. (Thêm mục hồ sơ.) Bấm **Thêm mục**, nhập mã `BRAIN_MRI`, tên "Chụp MRI não", giữ ô "Bắt buộc để qua Cổng 1", để trống thời hạn hiệu lực, rồi bấm **Thêm mục**. Mục mới mang nhãn "HLV nhập, chưa xác thực". Nói: app chỉ ghi nhận trạng thái hồ sơ, không lưu file, và mục do HLV nhập luôn được đánh dấu là chưa xác minh.
3. Bấm **Vào tuần thi đấu**. Hộp thoại liệt kê các mục còn thiếu ("Hồ sơ Cổng 1 còn thiếu các mục sau"); bấm **Xác nhận vào tuần thi đấu** thì bị chặn, trạng thái trận vẫn là "Đang tập camp".
4. Sửa từng mục thiếu (nút bút chì **Sửa**): trạng thái "Đã nộp", ngày cấp hôm nay, hiệu lực đến **sau ngày thi đấu** (ví dụ 3 tháng sau). Badge chuyển "Cổng 1: Đạt".
5. Bấm **Vào tuần thi đấu** → **Xác nhận vào tuần thi đấu** → trận chuyển "Tuần thi đấu".

### 4. Kết (1 phút)

- Đổi ngôn ngữ sang English trong menu tài khoản để cho thấy app song ngữ, rồi đổi lại.
- Nói rõ phần còn lại:
  - Backend lõi trận (T-003) đang tích hợp; demo cuối ngày 31/10 chạy trên backend thật.
  - Sprint 2: tuần thi đấu và cân chính thức, kết quả trận, đình chỉ và Cổng 2, kế hoạch ăn, phân tích đối thủ.

## Lưu ý khi trình bày

- Những chữ còn tiếng Anh là **dữ liệu mẫu**: tên buổi tập, nhận xét của HLV, ghi chú hạn chế của bác sĩ, tên kỹ thuật (Jab, Hook). Chúng không phải giao diện.
- Các khu vực ngoài luồng demo (Training, Health, Film, Admin) vẫn hiện tiếng Anh khi chọn tiếng Việt; việc dịch phần này nằm trong T-013 phần 3.
- Đừng mở trận của Lucas Ferreira (thuộc HLV khác): HLV Rafael Costa sẽ thấy trang 404. Nếu được hỏi về phân quyền thì dùng đúng ví dụ này.
- Ngày tháng trong dữ liệu mẫu tính theo ngày chạy server, nên demo đúng vào bất kỳ ngày nào.
