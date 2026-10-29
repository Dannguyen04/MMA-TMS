# Thiết kế giao diện đình chỉ cho HLV (T-030 phần B, mở rộng theo T-036, T-045)

Brief theo bước `shape` của Impeccable. Chế độ **Operate** (HLV làm việc trên máy tính ở CLB). Bám hệ thiết kế đang có của `/coach/bouts` và `/coach/sessions`: `PageHeader`, `Card`, `Table`, `Badge` (tone), `StatCard`, `EmptyState`, `Avatar` hình bát giác, token `corner-red`, `corner-blue`, `belt-gold`, các tông `success/warning/danger/info/neutral`. Không đổi hệ màu, không thêm font, không thêm thư viện.

## 1. Người dùng và việc cần làm

HLV, máy tính, ngay sau trận hoặc đầu tuần. Ba việc: tạo đình chỉ thủ công; thấy app vừa làm gì với lịch và giáo án; biết ai được tập gì hôm nay và ai sẵn sàng nhận trận mới.

## 2. Điều phải thấy ngay khi demo ("khác gì Excel")

1. **App tự xử lý hệ quả**: sau khi tạo đình chỉ, một bảng tóm tắt hiện từng buổi đã chuyển "Chờ xếp lại" hoặc đã huỷ, và giáo án đã sang hồi phục, kèm lý do.
2. **Lộ trình tập lại theo bậc**: thang 5 bậc và 3 bước sau KO nhìn một lần là hiểu.
3. **Bảng sẵn sàng toàn CLB**: ai nhận được trận mới, ai còn đình chỉ, ai đang tập lại.

## 3. Hướng thiết kế (một ý xuyên suốt)

**"Thang cường độ" là hình ảnh chủ đạo.** Năm bậc vẽ thành một thanh 5 đoạn tăng dần độ cao (giống thanh tín hiệu), mỗi đoạn mang icon loại buổi (`training-type-icon.tsx` có sẵn). Đoạn được phép tô màu đặc, đoạn bị chặn là sọc chéo xám. Cùng một component dùng ở bốn chỗ: form tạo đình chỉ (chọn), dòng đình chỉ (chỉ xem), lộ trình tập lại (động theo ngày), bảng sẵn sàng (thu nhỏ). HLV học một lần, đọc được mọi nơi.

Màu theo nghĩa, không trang trí: đang đình chỉ dùng `danger`; chờ xác nhận dùng `warning`; đang tập lại theo bậc dùng `info`; được tập và sẵn sàng dùng `success`; "Chờ xếp lại" dùng `warning` dạng viền (outline) để khác "Chờ xác nhận". Trạng thái luôn có chữ và icon, không chỉ màu.

Sinh động nằm ở **chuyển động có nghĩa** (150–250 ms, CSS, tắt khi `prefers-reduced-motion`):
- Thang bậc: khi đổi bậc trong form, các đoạn lấp đầy lần lượt từ trái sang phải (so le 40 ms).
- Bảng tóm tắt hệ quả: từng dòng trượt vào theo thứ tự, buổi bị huỷ có gạch ngang chạy qua tên buổi, buổi "Chờ xếp lại" có icon đồng hồ.
- Lộ trình 3 bước: bước hôm nay có vòng sáng nhẹ (pulse 2 lần rồi dừng), bước đã qua có dấu tích.
- Số đếm trên thẻ thống kê của bảng sẵn sàng đếm lên khi tải lần đầu.
Không có chuyển động lặp vô hạn, không hiệu ứng khi tải trang ngoài những chỗ trên.

## 4. Các màn và thành phần

### 4.1 Component dùng chung (mới, `src/components/domain/`)

- **`IntensityLadder`**: props `maxAllowedTier` (0–5), `ceiling?` (bậc trần của lộ trình hôm nay), `size` (`sm` cho bảng, `md` cho dòng, `lg` cho form), `interactive?` + `onChange` (form). Mỗi đoạn có nhãn ẩn cho trình đọc màn hình ("Bậc 3, kỹ thuật không va chạm: được tập"). Bàn phím: mũi tên trái/phải đổi bậc khi `interactive`. Hiện chú thích bậc dưới thanh ở `lg`.
- **`SuspensionStatusBadge`**: `ACTIVE` (Đang đình chỉ, ngày x/y), `AWAITING_CLEARANCE` (Chờ xác nhận), `GRADED_RETURN` (Tập lại bậc n/5), `ENDED` (Đã hết). Thêm vào `status-badges.tsx` theo mẫu các badge có sẵn.
- **`GradedReturnSteps`**: 3 bước ngang (Bậc 3 · Bậc 4 · Tập đầy đủ) với ngày dưới mỗi bước, bước hiện tại nổi bật; câu tóm tắt "Sparring được từ {ngày}".
- **`SessionStatusBadge`**: thêm trạng thái `pending` ("Chờ xếp lại", icon đồng hồ, `warning` outline).

### 4.2 `/coach/bouts/suspensions`: danh sách đình chỉ (màn mới, tab trong hub "Trận")

- `PageHeader`: tiêu đề "Đình chỉ", mô tả đếm số đang hiệu lực, nút chính "Tạo đình chỉ".
- Hàng `StatCard`: Đang đình chỉ · Chờ xác nhận · Đang tập lại theo bậc · Chờ xếp lại (số buổi). Bấm thẻ thì lọc danh sách.
- Danh sách dạng thẻ dòng (không phải bảng dày), mỗi đình chỉ: avatar bát giác + tên võ sĩ; lý do (KO, TKO, MEDICAL…) và trận gắn kèm nếu có; khoảng ngày và thanh tiến độ ngày (x/y); `IntensityLadder` cỡ `md`; badge trạng thái; hành động: "Xác nhận được tập lại" (chỉ khi `AWAITING_CLEARANCE`, mở form ghi căn cứ), "Xem lịch tập".
- Dòng đang trong lộ trình tập lại có thêm `GradedReturnSteps` ngay dưới.
- Trạng thái: rỗng (dạy cách dùng: "Đình chỉ tự tạo khi ghi kết quả trận thua KO; tạo thủ công cho KO khi sparring"), đang tải (skeleton theo hình dòng), lỗi (thông báo kèm thử lại), không có quyền.

### 4.3 Tạo đình chỉ (panel trượt từ phải, không phải modal giữa màn)

Trường theo thứ tự: Võ sĩ → Lý do (nhóm chọn, có mô tả ngắn từng lý do) → Ngày bắt đầu, số ngày (hiện ngày kết thúc tính sẵn) → **Mức tối đa được tập** (`IntensityLadder lg interactive`, mặc định theo lý do: 1) → "Chọn từng loại buổi" (mở rộng, tick từng loại; dùng một trong hai, không cả hai) → Cần xác nhận mới được tập lại (bật sẵn và khoá với KO/TKO, kèm câu vì sao).

Không xem trước hệ quả trước khi lưu: muốn vậy frontend phải chép lại quy tắc R28 của backend, hai nơi dễ lệch nhau. Thay vào đó, ngay dưới nút lưu có một dòng nói trước điều sẽ xảy ra: "Buổi đã xếp trong khoảng này sẽ tự chuyển 'Chờ xếp lại' hoặc huỷ; giáo án camp sẽ sang hồi phục nếu là chấn thương."

Sau khi lưu: panel chuyển sang **bảng tóm tắt hệ quả** đọc từ `affectedSessions`, `affectedPlans` của response (mục 3, chuyển động). Nút "Xem lịch" và "Xong".

### 4.4 Lịch tập `/coach/sessions` và chi tiết buổi

- Buổi `pending`: badge "Chờ xếp lại", ngày cũ hiện mờ có gạch, nút chính "Xếp lại" mở chọn ngày (gợi ý ngày đầu tiên sau khi hết đình chỉ). Không có nút "Bắt đầu".
- Lỗi 409 `TRAINING_SUSPENSION_ACTIVE` khi xếp hoặc bắt đầu: thay câu lỗi chung bằng thẻ giải thích: lý do đình chỉ, đến ngày nào, `IntensityLadder sm` với bậc trần; với lộ trình tập lại thì "Hôm nay tối đa bậc 3, tập đầy đủ từ {ngày}".
- Bộ lọc trạng thái thêm "Chờ xếp lại".

### 4.5 `/coach/bouts/readiness`: bảng sẵn sàng (màn mới, tab trong hub "Trận")

- Bộ lọc: hạng cân (kg), ngày thi dự kiến.
- Ba cột kiểu bảng Kanban, mỗi cột một trạng thái: **Sẵn sàng** (`success`), **Đang tập lại** (`info`, kèm ngày tập đầy đủ), **Chưa sẵn sàng** (`danger`/`warning`: đình chỉ, chờ xác nhận, đang có trận). Mỗi thẻ: avatar, tên, cân gần nhất, khả thi về cân với hạng đang lọc, `IntensityLadder sm`, lý do chưa sẵn sàng.
- Màn hình hẹp (dưới 1024 px): ba cột thành ba nhóm dọc có tiêu đề dính.

### 4.6 Bảng điều khiển HLV

Thẻ "Việc cần làm" (T-030 A) có thêm "Buổi chờ xếp lại" dẫn tới lịch đã lọc.

## 5. Phạm vi và ngoài phạm vi

- Trong phạm vi: các màn ở mục 4, tiếng Việt và tiếng Anh, demo mode và API mode.
- Ngoài phạm vi: màn điện thoại của võ sĩ (Fon), 3D, đổi hệ màu hay font, thư viện mới, đổi backend.
- Ghi chú phối hợp: nhánh `feat/T-004-bout-lifecycle-ui` của Hoàng Anh có `suspensions/page.tsx`, `suspension-dialogs.tsx` riêng; khi merge sẽ phải chọn một bản. T-030 đang giao cho Dan: cần báo.

## 6. Dữ liệu và trạng thái

- Đình chỉ: 0 đến khoảng 30 dòng; 1 võ sĩ có thể có 2–3 đình chỉ chồng nhau (KO cộng nghỉ bắt buộc).
- Hệ quả sau khi tạo: 0 đến khoảng 10 buổi, 0–2 giáo án.
- Bảng sẵn sàng: 5 đến khoảng 60 võ sĩ.
- Mọi màn có: tải (skeleton), rỗng (có hướng dẫn), lỗi (thử lại), không có quyền; nút có trạng thái hover, focus, disabled, loading.

## 7. Câu hỏi thiết kế đã tự chốt

- Panel trượt thay vì modal: form dài và có phần xem trước hệ quả.
- Bảng sẵn sàng dạng ba cột thay vì bảng: câu hỏi của HLV là "ai nhận được trận", cột trả lời ngay.
- Thang 5 đoạn tăng độ cao thay vì thanh phần trăm: bậc là rời rạc, và càng cao càng nguy hiểm.
