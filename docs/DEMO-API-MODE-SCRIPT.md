# Kịch bản demo API mode: trước, trong và sau trận

Hai cửa sổ PowerShell, chạy backend trước.

### 1. Backend — cổng 3001

```powershell
cd nestjs-api
corepack pnpm start:dev
```

Cần `nestjs-api/.env` sẵn (của team). Không sửa file này, không chạy migration. Đợi log báo Nest đang listen ở `http://localhost:3001`.

Nếu backend vừa mở đã tắt vì Swagger / `z.date()`: máy này đã có một dòng sửa local trong `nestjs-api/src/suspensions/suspensions.model.ts`. Khởi động lại lệnh trên. Ken chưa đưa sửa này lên `main`.

### 2. Frontend API mode — cổng 3100

Cửa sổ PowerShell khác. Đặt biến **trước** khi chạy `dev`, vì Next không ghi đè biến đã có trong process bằng `.env.local`:

```powershell
cd nextjs-frontend
$env:APP_DATA_MODE='api'
corepack pnpm dev --port 3100
```

Mở `http://localhost:3100/login`.

Cổng 3100 để khỏi đụng server demo (3000). Nếu 3100 đang bận, tắt process đó rồi chạy lại.

### 3. Quay lại demo mode (không dùng cho kịch bản này)

Tắt frontend 3100, rồi:

```powershell
cd nextjs-frontend
$env:APP_DATA_MODE='demo'
corepack pnpm dev
```

Mở `http://localhost:3000`. Không cần backend.

**Tài khoản HLV**

| | |
|---|---|
| Tên | Rafael Costa |
| Email | `rafael.costa@lotus-combat.test` |

Đăng nhập ở `http://localhost:3100/login` bằng email trên. Ở API mode không dùng mật khẩu demo `mma-demo`. Mật khẩu là mật khẩu tài khoản thật trên backend.

## Trước khi bấm

Backend phải đang chạy ở cổng **3001**. Frontend API mode ở cổng **3100**.

**Không dùng** các bản thử sẵn: Dat Nguyen đang “Đã cân” ở trận `TEST API – xoá sau demo`. Dùng **Minh Trần** (đang “Sẵn sàng”). Kenji hoặc Aigerim cũng được.

**Ngày giờ là chỗ dễ sai nhất.** Backend bắt buộc:

| Ràng buộc | Hệ quả khi demo |
|---|---|
| Giờ thi **lớn hơn hiện tại** | Không đặt trận lúc 19:00 nếu lúc đó đã quá 19:00. Đặt 22:00 hoặc 23:30. |
| Giờ cân **trước** giờ thi | Ví dụ cân 08:00, thi 19:00. |
| Cân chính thức chỉ từ **ngày cân** | Ngày cân = hôm nay. |
| Ghi kết quả chỉ từ **ngày thi** | Ngày thi = hôm nay. Đặt trận ngày mai thì hết phần trong/sau trận. |
| Tuần thi đấu mở từ **ngày cân − 7 ngày** | Cân hôm nay thì vào tuần thi đấu ngay. |

**Bộ luật:** chọn **MMA – VMMAF 2021**. Hồ sơ y tế của bộ luật này để trống, Cổng 1 tự mở. **Đừng chọn AIBA** nếu muốn đi một mạch; AIBA bắt giấy khám / bảo hiểm / đăng ký liên đoàn.

## Nên nhập gì

| Ô | Giá trị |
|---|---|
| Võ sĩ | Minh Trần |
| Bộ luật | MMA – VMMAF 2021 |
| Hạng cân | **70 kg** (nếu khung xem trước báo quá hạng thì đổi 77 kg) |
| Giải | `Lotus Fight Night 18` |
| Đối thủ | `Arman Petrosyan` |
| Địa điểm | `Nhà thi đấu Phú Thọ` (tuỳ, không bắt buộc) |
| Số hiệp dự kiến | **3 hiệp** |
| Ngày + giờ cân | **hôm nay, 08:00** |
| Ngày + giờ thi | **hôm nay, 19:00** (hoặc muộn hơn “bây giờ”) |
| Cân chính thức | **69,5** (phải ≤ hạn hạng) |
| Kiểm tra nước | để trống |
| Hiệp 1 | thua nhẹ, 0 knockdown |
| Kết quả | Thua · KO · hiệp 2 · mất ý thức dưới 1 phút · **30 ngày** đình chỉ |

Cân nhận `69,5` hoặc `69.5`, một số thập phân, khoảng 30–200 kg.

## 0. Tạo giáo án trại tập trước

Không có giáo án `fight_camp` của đúng võ sĩ thì không gắn camp được.

1. Menu **Giáo án** → **Tạo mới** (`/coach/training-plans/new`).
2. Bước đầu: chọn template **Fight camp** (không phải Fight week taper).
3. Võ sĩ: **Minh Trần**.
4. Đổi tiêu đề thành `Lotus Fight Night 18 – Minh`.
5. Phase phải là **fight_camp**. Draft hay Active đều gắn được.
6. Bấm Next qua các bước còn lại (API mode không bắt focus area / bài tập). Rồi lưu.

Form này còn nhiều chữ tiếng Anh, cứ bấm tiếp.

## A. Trước trận

### A1. Tạo trận

1. Menu **Trận đấu** → **Tạo trận**.
2. Điền đúng bảng ở trên.
3. Đợi khung xem trước khả năng nhận trận hiện (xanh / vàng / đỏ / chưa cân). Cảnh báo này **không chặn** lưu.
4. Bấm tạo. Trạng thái: **Đã lên lịch**.

**Hay sai:** giờ thi ≤ giờ cân; giờ thi đã qua; quên số hiệp (mặc định là 3, đừng xoá); chọn AIBA.

Võ sĩ đang có trận chưa xong chỉ bị **cảnh báo**, không chặn tạo. Vẫn đừng dùng Dat.

### A2. Gắn camp

Trên trang trận, khung “Bắt đầu trại tập”:

1. Chọn giáo án vừa tạo.
2. Lưu. Trạng thái: **Trại tập**.

Giáo án phải cùng võ sĩ và phase `fight_camp`. Võ sĩ đang có trận active khác thì backend từ chối.

### A3. Kế hoạch ăn *(mock, mất khi restart server)*

Ba ô chữ trên trang trận: trại tập / tuần thi đấu / sau cân. Gõ ví dụ:

- Trại tập: `Cơm, thịt nạc, rau. Cắt tinh bột sau 18h.`
- Tuần thi đấu: `Giảm nước từ D−2. Không sauna nếu chóng mặt.`

Bấm lưu. Phần này **không** đi backend.

### A4. Vào tuần thi đấu (Cổng 1)

Với VMMAF và cân hôm nay: Cổng 1 mở, cửa sổ 7 ngày đã tới.

Bấm **Vào tuần thi đấu**. Trạng thái: **Tuần thi đấu**. Checklist hồ sơ bị khoá.

### A5. Cân chính thức

1. **Ghi cân chính thức**.
2. Nhập `69,5`. Kiểm tra nước để trống.
3. Phải hiện “đạt hạng”. Lưu. Trạng thái: **Đã cân**.

**Nếu nhập quá hạn** (ví dụ 71 khi hạng 70): phải chọn

- **Thi tiếp (catchweight):** số catchweight **> cân vừa ghi** và **> hạn hạng**, kèm ghi chú; hoặc
- **Huỷ trận** vì trượt cân.

Muốn demo một mạch thì nhập dưới hạn.

Hai nút **Ghi hiệp** và **Thẻ góc đài** chỉ hiện từ lúc **Đã cân**.

## B. Trong trận (trên web)

### B1. Ghi hiệp 1

Mở **Ghi hiệp**.

1. Tự chấm: chọn **Thua hiệp** (hoặc tương đương trên UI).
2. Knockdown: `0`.
3. Có thể bật **Mệt**.
4. Đánh dấu vài quan sát / chiến thuật nếu có (không bắt buộc).
5. Lưu. Phải hiện badge đã ghi và **gợi ý cho hiệp sau**.

Sửa lại thì bấm **Cập nhật hiệp 1**, không tạo hiệp mới.

**Hay sai:** mở trang này khi trận chưa cân → báo chưa ghi được. Tạo trận không có số hiệp → báo “chưa được thiết lập số hiệp dự kiến”.

### B2. Thẻ góc đài

Mở **Thẻ góc đài**. Thẻ hiện **chiến thuật đã soạn trước trận**, không phải 5 hiệp vừa ghi.

Trận tạo mới trên API mode được gắn sẵn 4 chiến thuật mẫu. Chỉ xem, không ghi thêm.

Nhãn **Đã luyện** / **Chưa luyện** không liên quan hiệp vừa ghi. **Đã luyện** = chiến thuật đã gắn với buổi tập của đúng võ sĩ. Nếu võ sĩ chưa có buổi tập, cả 4 dòng sẽ là **Chưa luyện**. Có buổi tập thì dòng 1 và 3 hiện **Đã luyện**, dòng 2 và 4 vẫn **Chưa luyện**.

Nếu thẻ vẫn trống: tải lại trang. Backend không có chiến thuật mặc định; frontend mới tự điền mẫu khi phân tích đối thủ còn trống.

## C. Sau trận

### C1. Ghi kết quả (thua KO để ra đình chỉ)

Nút **Ghi kết quả** chỉ hiện **đúng ngày thi**.

Nhập đúng bộ này:

| Ô | Chọn |
|---|---|
| Kết quả | **Thua** |
| Cách thắng/thua | **KO** |
| Hiệp | **2** (KO / TKO / khoá siết **bắt buộc** có hiệp) |
| Mất ý thức | **Dưới 1 phút** (thua KO/TKO bắt buộc) |
| Số ngày đình chỉ | **30** (số nguyên 1–365) |
| Bị đánh ngã / chấn thương / ghi chú | bỏ trống |

Bấm lưu. Trận **Đã xong**. Đình chỉ KO tự tạo: chặn **đấu tập** và **vật**, cần cấp phép để tập lại.

**Đừng nhập:**

- Thua KO mà để trống số ngày → backend 422, câu tiếng Việt bảo nhập theo điều lệ giải (VMMAF không gợi ý sẵn).
- Thắng / tính điểm mà điền hiệp → bị từ chối.
- Thua TKO: phải trả lời “có bị dừng vì đòn vào đầu không”. Chỉ khi **Có** mới được nhập số ngày đình chỉ. Khi **Không** thì **không** được điền ô đó.
- KO thì **không** có ô đòn vào đầu.

### C2. Xem đình chỉ

Menu **Trận đấu** → **Đình chỉ**. Dòng Minh Trần: `KO · hôm nay – +29 ngày (30 ngày)` · **Đang đình chỉ**.

### C3. Cổng 2: chặn buổi tập

1. Menu **Buổi tập** → tạo mới.
2. Võ sĩ: Minh Trần. Loại: **Đấu tập** (hoặc **Vật**). Ngày: hôm nay. Giờ bất kỳ.
3. Bấm lưu.

API mode **không** hiện cảnh báo trên form xem trước. Chặn lúc lưu, kèm câu tiếng Việt (đình chỉ đang hiệu lực).

Đấm đích / bao cát / thể lực **không** bị chặn với VMMAF.

### C4. Cho tập lại

Vào lại **Đình chỉ** → **Cho tập lại**.

Ghi chú bắt buộc, ví dụ: `Bác sĩ thần kinh cho phép, CT bình thường`.

Lưu. Phải thấy “Rafael Costa xác nhận được tập lại, …”. Minh về **Sẵn sàng**. Tạo lại buổi đấu tập lúc này thì lưu được.

## Nếu muốn chiếu thêm, không bắt buộc

- **Trượt cân:** cân `71` hạng 70 → chọn thi tiếp, catchweight `72`, ghi chú `BTC chấp nhận 72 kg`.
- **Cổng 1 chặn:** tạo trận AIBA. Thiếu giấy khám / bảo hiểm / đăng ký thì không vào tuần thi đấu. Muốn đi tiếp phải đánh dấu đủ hồ sơ, hạn còn hiệu lực tới ngày thi.
- **Thêm đình chỉ tay:** võ sĩ + lý do Y tế + 7 ngày + tick Đấu tập.
- **Võ sĩ ghi cân hàng ngày:** đăng nhập Minh trên cửa sổ khác. Phần trả lời ăn uống là mock.

## Thứ tự không được đảo

`Tạo giáo án fight_camp` → `Tạo trận (hôm nay, 3 hiệp)` → `Gắn camp` → `Tuần thi đấu` → `Cân chính thức` → `Ghi hiệp / thẻ góc đài` → `Ghi kết quả` → `Đình chỉ / Cổng 2` → `Cho tập lại`.

Mobile **không** có màn trận. Phần trong trận chiếu trên web.
