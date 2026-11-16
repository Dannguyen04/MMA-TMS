# Thay đổi API ảnh hưởng màn hình mobile: checklist kiểm thử (16/11/2026)

APK đang trỏ vào `https://mma-tms-api.onrender.com`. Render chỉ deploy nhánh `release/final-review`.
Bốn thay đổi API dưới đây **chưa có trên Render**: hai cái nằm trong commit của `feat/mobile-platform`
nhưng chưa merge sang `release/final-review`, hai cái còn chưa commit. Vì vậy với APK hiện tại, các
màn bên dưới **sẽ lỗi** cho tới khi deploy API mới.

Chạy hai lượt kiểm thử:

- **Lượt A (ngay bây giờ, API cũ trên Render):** xác nhận đúng các lỗi "dự kiến" bên dưới, để chắc
  lỗi đến từ API chưa deploy, không phải từ app.
- **Lượt B (sau khi merge vào `release/final-review` và Render deploy xong):** mọi mục phải chạy đúng.

---

## 1. `GET /bouts?order=desc`: danh sách trận, mới nhất trước

**Đã commit trên `feat/mobile-platform` (fc727354), chưa có trên Render.** API cũ kiểm tra query
nghiêm ngặt nên trả **400** khi thấy tham số `order` lạ.

| Role | Màn hình | Lượt A (API cũ) | Lượt B (API mới) |
|---|---|---|---|
| HLV | **Hôm nay**: thẻ trận đấu | "Không tải được trận đấu" + nút Thử lại | Hiện trận gần nhất |
| HLV | **Lịch** (tab Lịch): các trận trong tuần | Thiếu trận / báo lỗi | Trận hiện đúng ngày cân |
| HLV | **Trại thi đấu** (danh sách trận) | Lỗi tải danh sách | Trận mới nhất ở đầu; kéo cuối danh sách tải thêm trang, không trùng, không mất trận |
| Võ sĩ | **Trang chủ**: phần trận đấu | Không có trận | Hiện trận sắp tới |
| Võ sĩ | **Tuần này** (lịch tuần) | Thiếu trận | Trận nằm đúng ngày |
| Võ sĩ | **Giáo án**: trận gắn với giáo án | Thiếu trận | Hiện trận |

Không đổi (không gửi `order`, chạy được cả hai lượt): **Trại thi đấu của võ sĩ**, **chi tiết trận của võ sĩ**.

## 2. `GET /doctor/schedule`, `GET /doctor/review-requests`: lịch và yêu cầu khám của bác sĩ

**Chưa commit** (`nestjs-api/src/schedule/` là thư mục mới). Trên Render các route này chưa tồn tại,
nên trả **404**.

| Role | Màn hình | Lượt A | Lượt B |
|---|---|---|---|
| Bác sĩ | **Hôm nay**: lịch hôm nay | Báo lỗi / trống | Tái khám, hết hạn giấy phép, cân, trận, hết đình chỉ của võ sĩ được giao |
| Bác sĩ | **Hôm nay**: yêu cầu khám từ HLV | Báo lỗi / trống | Yêu cầu đang mở, cũ nhất trước, tối đa 50 |
| Bác sĩ | **Lịch** (tuần) | Báo lỗi | Đúng sự kiện theo từng ngày; chuyển tuần vẫn tải được |

Thử thêm ở lượt B: đăng nhập role khác (HLV/Admin) thì không thấy các mục này. API chỉ cho DOCTOR
và trả 403 cho role khác.

## 3. `POST /auth/refresh`: giữ đăng nhập

**Chưa commit.** Refresh token của Supabase hiện chỉ dài khoảng 12 ký tự. API cũ đòi tối thiểu 20 ký
tự nên **từ chối mọi lần làm mới phiên**.

| Role | Tình huống | Lượt A | Lượt B |
|---|---|---|---|
| Tất cả | Đăng nhập, để app khoảng 1 giờ (access token hết hạn), rồi mở lại / kéo làm mới | Bị đá về màn đăng nhập | Vẫn đăng nhập, dữ liệu tải bình thường |
| Tất cả | Tắt hẳn app, mở lại sau hơn 1 giờ | Phải đăng nhập lại | Vào thẳng app |

## 4. Trạng thái sức khỏe tóm tắt của võ sĩ (`current_medical_status`)

**Chưa commit.** Trước đây không có gì cập nhật trường này, nên võ sĩ bị chấn thương / chưa được
phép tập vẫn có thể hiện **"Khỏe mạnh"** trong các danh sách. Giờ API tự tính lại sau mỗi thao tác y
tế, và mỗi giờ một lần (lúc khởi động cũng chạy một lượt, sửa luôn dữ liệu cũ):

1. Có chấn thương ACTIVE: **Chấn thương**
2. Không đủ điều kiện tập: **Chưa được phép**
3. Chấn thương đang hồi phục, hoặc có kế hoạch hồi phục: **Hồi phục**
4. Được tập nhưng có giới hạn: **Theo dõi**
5. Còn lại: **Khỏe mạnh**

Màn hình đọc trạng thái này:

| Role | Màn hình |
|---|---|
| HLV | Hôm nay ("Võ sĩ cần chú ý"), danh sách Võ sĩ + bộ lọc, chi tiết võ sĩ, buổi tập (session) |
| Bác sĩ | Danh sách võ sĩ, chi tiết võ sĩ, Hôm nay |
| Admin | Tổng quan (số liệu sức khỏe) |

- **Lượt A:** có thể thấy trạng thái sai, ví dụ Anh Le đang đình chỉ hoặc chấn thương nhưng vẫn ghi "Khỏe mạnh".
- **Lượt B:** trạng thái khớp hồ sơ y tế. Đặc biệt, tài khoản demo **Minh** ("Chưa được tập luyện" ở
  trang chủ võ sĩ) phải hiện **Chưa được phép** trong danh sách của HLV và bác sĩ.

> Không bấm Lưu / Gửi trên dữ liệu thật để "tạo" tình huống: API ghi thẳng vào Supabase dùng chung.
> Chỉ kiểm tra bằng dữ liệu demo đã có sẵn.

---

## Không phải thay đổi API, nhưng cần test lại trên APK mới

- **Giao diện vỡ (mọi role):** hàng danh sách, thanh tab, nút lọc và hộp thoại Đăng xuất phải nằm
  ngang, có viền như bản web. Đã sửa chung ở `src/utils/pressable-style-fix.ts`.
- **Intro lửa:** luôn chạy khi mở app; không còn bản đơn giản.
- **Bàn phím che ô nhập (mọi role):** khi chạm vào một ô, ô đó phải tự cuộn lên trên bàn phím, và nút lưu
  ở đáy màn (ví dụ "Lưu thay đổi" ở Sửa giáo án) phải nằm ngay trên bàn phím. Thử: Sửa giáo án (ô Mục
  tiêu), Trại thi đấu (nhập cân), Tải video lên, các form của võ sĩ. Dùng `react-native-keyboard-controller`,
  bọc ở gốc app và trong các khung màn dùng chung (`src/components/keyboard-aware.tsx`).
  Các sheet trượt lên (SlideSheet, BottomSheet) co lại trên bàn phím và cuộn ô đang nhập lên đầu sheet
  (`src/components/ui/reveal-focused-field.ts`). Thử: Gửi yêu cầu khám (võ sĩ), sửa tiêu chí nhập học
  (HLV), lý do từ chối nhập học (Admin), ghi chú trong sheet xem lại video. Chỉ gõ thử, không bấm Gửi/Lưu.
  Màn đăng nhập / đăng ký / quên mật khẩu tự xử lý bàn phím từ trước.
- **Tab Cơ thể (võ sĩ) văng app:** đã sửa (three 0.186 gọi `process.emitWarning`, RN không có). Nếu
  còn văng, gửi kết quả của `adb logcat -d -b crash`.

## Để lượt B chạy được

1. Commit các thay đổi `nestjs-api` còn dở (mục 2, 3, 4).
2. Merge `feat/mobile-platform` vào `release/final-review` và push; Render tự deploy.
3. Không cần build lại APK: app đã gửi đúng request, chỉ chờ API mới.
