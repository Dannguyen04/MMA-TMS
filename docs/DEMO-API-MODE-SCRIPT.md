# Kịch bản demo API mode: trước, trong và sau trận

Chạy trên nhánh `release/final-review` (cập nhật 9/11 cho buổi review cuối 10/11). Hai cửa sổ PowerShell, chạy backend trước.

### 1. Backend — cổng 3001

```powershell
cd nestjs-api
corepack pnpm start:dev
```

Cần `nestjs-api/.env` sẵn (của team). Không sửa file này, không chạy migration. Đợi log báo Nest đang listen ở `http://localhost:3001`.

Lỗi Swagger / `z.date()` làm backend tắt ngay khi mở đã được sửa trên `fight-camp`, nên không cần dòng sửa local nào nữa. Dòng sửa cũ ngày 30/10 được cất trong `git stash` của máy chủ dự án.

### 2. Frontend API mode — cổng 3100, **bản production**

Cửa sổ PowerShell khác. Đặt biến **trước** khi build, vì Next không ghi đè biến đã có trong process bằng `.env.local`. Dùng bản production, không dùng `dev`: ngày 10/11 cùng màn, cùng dữ liệu, mỗi lời gọi API mất khoảng 100 ms ở production và 1–2 giây ở `next dev`; trang tải trung vị 1,5 giây. `next dev` còn biên dịch từng trang lần đầu và từng tự crash (Turbopack panic).

```powershell
cd nextjs-frontend
Remove-Item -Recurse -Force .next
$env:APP_DATA_MODE='api'
corepack pnpm build
corepack pnpm exec next start --port 3100
```

Build mất vài phút, làm trước giờ trình bày. Sửa code sau khi build thì phải build lại.

Mở `http://localhost:3100/login`.

Cổng 3100 để khỏi đụng server demo (3000). Nếu 3100 đang bận, tắt process đó rồi chạy lại.

### 3. Phương án dự phòng: demo mode, không cần backend

Nếu backend hoặc Supabase có sự cố khi trình bày: tắt frontend 3100, rồi chạy

```powershell
cd nextjs-frontend
$env:APP_DATA_MODE='demo'; $env:NEXT_PUBLIC_VIDEO_PIPELINE='mock'
corepack pnpm dev
```

Mở `http://localhost:3000`, đăng nhập bằng nút "Rafael Costa". Phải đặt `NEXT_PUBLIC_VIDEO_PIPELINE=mock`: `.env.local` đang để `api`, nên khi backend tắt thì các màn video sẽ báo lỗi. Ở demo mode, luồng này đã đạt UAT 3/3 ngày 9/11. Riêng bước C4, dùng Diego Alvarez (TKO, đang chờ xác nhận).

### Run-sheet sáng 10/11

1. `git pull` nhánh `release/final-review`, rồi `corepack pnpm install`.
2. **Không** chạy `next build` khi `next dev` đang chạy trong cùng thư mục: build xoá `.next` và server dev sẽ crash.
3. **Đổi giữa demo mode và API mode thì xoá `nextjs-frontend/.next` trước khi bật lại** (`Remove-Item -Recurse -Force nextjs-frontend\.next`). `.next` cũ từng làm `/login` trả 404 ở API mode (9/11).
4. **`DATABASE_URL` trong `nestjs-api/.env` phải dùng cổng `6543`** (pooler transaction mode), không dùng `5432`. Cổng 5432 là session mode, tối đa 15 kết nối cho cả team. Ngày 9/11 dashboard admin trả 500 với lỗi `max clients reached in session mode`. Máy chủ dự án đã đổi; máy nào khác dùng để demo cũng phải đổi.
5. **Bật Redis** trước backend: `redis-server --port 6379` (máy chủ dự án đã cài). Thiếu Redis, thông báo và hàng đợi AI sẽ báo lỗi kết nối liên tục.
6. Bật backend (mục 1), đợi `/health` trả 200, rồi build và bật frontend 3100 (mục 2). Mở trước một lượt các màn sẽ chiếu. Màn tổng quan HLV vẫn mất khoảng 5 giây: nó đọc riêng từng võ sĩ (khoảng 40 request) qua pool 10 kết nối của backend.
7. Đăng nhập Rafael Costa. Mở **Đình chỉ** để chắc trang tải được (migration 033 đã áp 9/11). Từ 10/11 **không còn võ sĩ nào "Chờ xác nhận"** trên Supabase: đình chỉ y tế của Aigerim đã được xác nhận tối 9/11, và cô đang có đình chỉ KO tới 9/12. C4 ở API mode chỉ nói quy tắc; muốn chiếu nút "Cho tập lại" thì dùng demo mode (Diego Alvarez).
8. Võ sĩ cho phần chính: **Minh Trần**, đang "Sẵn sàng". Kenji đã dùng cho lượt thử ngày 9/11, đang bị đình chỉ KO.
9. Đặt giờ thi **sau giờ hiện tại** (ví dụ 22:00), cân 08:00 cùng ngày.

**Tài khoản HLV**

| | |
|---|---|
| Tên | Rafael Costa |
| Email | `rafael.costa@lotus-combat.test` |

Đăng nhập ở `http://localhost:3100/login` bằng email trên. Ở API mode không dùng mật khẩu demo `mma-demo`. Mật khẩu là mật khẩu tài khoản thật trên backend.

## Chuẩn bị dữ liệu

### Hai lệnh chạy seed

Chạy trong thư mục `nestjs-api`:

1. **Hôm trước buổi demo (chính xác ngày D−1, đúng 1 ngày trước demo):**
   ```powershell
   node scripts/demo-seed.mjs --stage early
   ```
   (hoặc bí danh `--only clearance`). Tạo các võ sĩ giai đoạn sớm (f7, f8, f9, f10). Lưu ý: phải chạy đúng ngày D−1 (không chạy sớm hơn) vì quy tắc trở lại tập luyện theo bậc (`gradedReturnFor`) chỉ áp trần cường độ ở ngày R và R+1. Không chạy `--stage early` trong khoảng 00:00 đến 00:01 giờ học viện.

2. **Sáng ngày demo (trước 22:30 giờ học viện):**
   ```powershell
   node scripts/demo-seed.mjs
   ```
   Lần chạy chính. Tạo tất cả các võ sĩ còn lại và hoàn tất dữ liệu ngày demo. Thêm `--with-ai` nếu muốn tạo sẵn gợi ý chiến thuật AI cho võ sĩ 6.

### Biến môi trường

Cần thiết lập trước khi chạy seed thật (không áp dụng khi `--dry-run`):

| Biến | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| `DEMO_SEED_API_URL` | Địa chỉ backend API | `http://localhost:3001` |
| `DEMO_SEED_TOKEN` | Bearer token của Admin (tuỳ chọn thay cho email/password admin) | |
| `DEMO_SEED_ADMIN_EMAIL` | Email Admin | `admin@gmail.com` |
| `DEMO_SEED_ADMIN_PASSWORD` | Mật khẩu Admin | |
| `DEMO_SEED_COACH_EMAIL` | Email HLV Rafael Costa (tài khoản có sẵn) | `rafael.costa@lotus-combat.test` |
| `DEMO_SEED_COACH_PASSWORD` | Mật khẩu HLV Rafael Costa | |
| `DEMO_SEED_DOCTOR_EMAIL` | Email Bác sĩ Thu Lê (tài khoản có sẵn) | `thu.le@lotus-combat.test` |
| `DEMO_SEED_DOCTOR_PASSWORD` | Mật khẩu Bác sĩ Thu Lê | |
| `DEMO_SEED_USER_PASSWORD` | Mật khẩu khởi tạo cho các tài khoản võ sĩ demo | |

### Bảng võ sĩ → Tình huống → Vai trò bấm

| Võ sĩ | Tình huống | Vai trò bấm |
| --- | --- | --- |
| f1 An | Đang camp, cân cách quãng | HLV |
| f2 Bình | Tuần thi đấu, cân hằng ngày | HLV |
| f3 Cường | Vừa cân chính thức đạt hạn | HLV |
| f4 Dũng | Đình chỉ MANDATORY_REST, có buổi tập bị dời | HLV |
| f5 Em | Sẵn sàng, chưa có trận | HLV |
| f6 Phong | Báo cáo sau trận, thua KO hiệp 2, phân tích hiệp và AI | HLV |
| f7 Giang | Chờ xác nhận tập lại (đình chỉ MEDICAL 1 ngày) | HLV hoặc Bác sĩ |
| f8 Hải | Lịch sử HLV xác nhận khi không có giấy; ngày demo xếp được PAD_WORK | HLV |
| f9 Khoa | Lịch sử kết thúc sớm có phiếu khám; ngày demo xếp được GRAPPLING | Bác sĩ |
| f10 Lâm | Đình chỉ DQ 1 ngày, tự hết hạn không cần xác nhận | Hệ thống |
| f11 Mai | Bác sĩ Thu kết thúc sớm trực tiếp (HLV không thấy nút kết thúc sớm) | Bác sĩ |
| f12 Nam | Đình chỉ MEDICAL do Ban tổ chức ban hành, gỡ theo văn bản BTC | HLV |
| f13 Oanh | Yêu cầu khám OPEN từ HLV, bảng triage của bác sĩ có yêu cầu mở | Bác sĩ |
| f14 Phúc | Trận AIBA hạng 71, hồ sơ MISSING; Cổng 1 chặn vào tuần thi đấu | HLV |
| f15 Quân | Trận VMMAF hạng 70, cân mới nhất 77 kg; cảnh báo cân đỏ | HLV |
| f16 Sơn | Trượt cân 71,2 kg, thi tiếp catchweight 72 kg | HLV |
| f17 Tùng | Huỷ trận vì đối thủ rút | HLV |

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

### A3. Kế hoạch ăn

Ba ô chữ trên trang trận: trại tập / tuần thi đấu / sau cân. Gõ ví dụ:

- Trại tập: `Cơm, thịt nạc, rau. Cắt tinh bột sau 18h.`
- Tuần thi đấu: `Giảm nước từ D−2. Không sauna nếu chóng mặt.`

Bấm lưu. Từ 9/11 phần này lưu qua backend (`PUT /bouts/:id/nutrition-plan`, T-009) nên không mất khi khởi động lại. Giai đoạn đang chạy được tô nổi. Phần võ sĩ trả lời "ăn theo kế hoạch?" vẫn là dữ liệu giả.

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

Mở **Ghi hiệp**. Màn chỉ mở **hiệp đang ghi** (lúc đầu là hiệp 1, nhãn **Đang ghi**); các hiệp sau chỉ là một dòng **Chưa tới**. Mặc định hiệp đang ghi có 4 chạm: hai **chiến thuật đang dặn**, một **quan sát chính** và **HLV tự chấm hiệp**.

1. Chiến thuật thứ nhất: **Hiệu quả**; chiến thuật thứ hai: **Không hiệu quả**.
2. Tự chấm: chọn **Thua hiệp**.
3. Bấm **Ghi thêm** để mở tình trạng võ sĩ, knockdown, các chiến thuật và quan sát khác, ghi chú. Bật **Mệt**, knockdown `0`.
4. Bấm **Lưu hiệp 1**. Hiệp 1 thu gọn thành một dòng (Đã lưu · Thua hiệp · 0 knockdown · Mệt · số đánh dấu). Phía trên hiện **lời dặn giữa hiệp** và khối **Hiệp 2: làm gì**; hiệp 2 thành hiệp đang ghi.
5. Ghi hiệp 2 giống vậy (cùng hai chiến thuật; nếu chiến thuật không nằm trong 2 chạm mặc định thì tìm trong **Ghi thêm**).

Sửa lại thì bấm **Sửa hiệp 1** trên dòng tóm tắt rồi **Cập nhật hiệp 1**, không tạo hiệp mới.

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

### C1b. Báo cáo sau trận (mới, nghiệp vụ 14)

Trên trang trận (hoặc màn ghi hiệp), bấm **Báo cáo sau trận**. Nút chỉ hiện khi trận đã **Đã xong**.

1. Khối **Điểm cần luyện cho camp sau** đứng đầu: chiến thuật không hiệu quả, giảm cân cấp tốc vượt ngưỡng, đuối sức từ hiệp nào (cần 2 hiệp liền có **Mệt**).
2. Khối **Chiến thuật**: mỗi chiến thuật có số hiệp hiệu quả / không hiệu quả. Nhãn **App điền sẵn** nghĩa là kết luận do app tính từ phần ghi hiệp lúc ghi kết quả.
3. Đổi kết luận một chiến thuật, ghi chú (≤ 300 ký tự), **Lưu đánh giá**. Chiến thuật đó mất nhãn **App điền sẵn**. Mỗi lần lưu, mọi chiến thuật đang hiện được tính là HLV đã đánh giá.
4. Khối **Quan sát về đối thủ**: quan sát mà mọi hiệp đều đánh "không thấy" có nhãn "Không thấy lại ở trận ngày …".

Trận không ghi hiệp nào: báo cáo chỉ có kết quả, kèm câu nhắc ghi hiệp. Phần đánh giá chiến thuật bị ẩn.

### C2. Xem đình chỉ

Menu **Trận đấu** → **Đình chỉ**. Dòng Minh Trần: `KO · hôm nay – +29 ngày (30 ngày)` · **Đang đình chỉ**.

### C3. Cổng 2: chặn buổi tập

1. Menu **Buổi tập** → tạo mới.
2. Võ sĩ: Minh Trần. Loại: **Đấu tập** (hoặc **Vật**). Ngày: hôm nay. Giờ bất kỳ.
3. Bấm lưu.

API mode **không** hiện cảnh báo trên form xem trước. Chặn lúc lưu, kèm câu tiếng Việt (đình chỉ đang hiệu lực).

Đấm đích / bao cát / thể lực **không** bị chặn với VMMAF.

### C4. Cho tập lại

**Không làm được trên Minh ngay sau trận.** Từ T-049, "Cho tập lại" chỉ mở khi đình chỉ **đã hết hạn và đang chờ xác nhận**. Đình chỉ KO 30 ngày vừa tạo vẫn đang chạy, nên API trả 409 `SUSPENSION_NOT_AWAITING_CLEARANCE`, và nút không hiện. Khi trình bày, nói rõ: "30 ngày sau, HLV hoặc bác sĩ xác nhận ở đây". Sau đó chiếu C4 trên một võ sĩ đang chờ xác nhận:

- **Chuẩn bị từ hôm trước (9/11):** tạo đình chỉ tay cho một võ sĩ phụ của Rafael: lý do **Y tế**, **1 ngày**, bắt đầu hôm nay, cần xác nhận. Sang ngày 10/11, võ sĩ đó ở trạng thái **Chờ xác nhận tập lại**, và thẻ Việc cần làm có nguồn này.
- **Khi demo:** vào **Đình chỉ**, dòng đang chờ xác nhận → **Cho tập lại**. Ghi chú bắt buộc, ví dụ `Bác sĩ thần kinh cho phép, CT bình thường`. Lưu, phải thấy "Rafael Costa xác nhận được tập lại, …".
- Sau KO/TKO, võ sĩ còn **tập lại theo bậc** (T-045, mỗi bậc tối thiểu 24 giờ). Đấu tập có thể vẫn bị chặn tới bậc cuối; không hứa "tạo lại buổi đấu tập là lưu được".

Ở demo mode, Diego Alvarez có sẵn một đình chỉ TKO đang chờ xác nhận.

## Nếu muốn chiếu thêm, không bắt buộc

- **Trượt cân:** cân `71` hạng 70 → chọn thi tiếp, catchweight `72`, ghi chú `BTC chấp nhận 72 kg`.
- **Cổng 1 chặn:** tạo trận AIBA. Thiếu giấy khám / bảo hiểm / đăng ký thì không vào tuần thi đấu. Muốn đi tiếp phải đánh dấu đủ hồ sơ, hạn còn hiệu lực tới ngày thi.
- **Thêm đình chỉ tay:** võ sĩ + lý do Y tế + 7 ngày + tick Đấu tập.
- **Võ sĩ ghi cân hàng ngày:** đăng nhập Minh trên cửa sổ khác. Phần trả lời ăn uống là mock.

## Thứ tự không được đảo

`Tạo giáo án fight_camp` → `Tạo trận (hôm nay, 3 hiệp)` → `Gắn camp` → `Tuần thi đấu` → `Cân chính thức` → `Ghi hiệp / thẻ góc đài` → `Ghi kết quả` → `Báo cáo sau trận` → `Đình chỉ / Cổng 2` → `Cho tập lại`.

Mobile **không** có màn trận. Phần trong trận chiếu trên web.
