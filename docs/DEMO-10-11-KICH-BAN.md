# Kịch bản trình bày 10/11 (API mode)

Dành cho người trình bày. Chạy trên nhánh `release/final-review` (commit `d4f876a`), bản production ở `http://localhost:3100`, backend `3001`, Supabase thật. Cách bật máy và run-sheet đầy đủ: [DEMO-API-MODE-SCRIPT.md](./DEMO-API-MODE-SCRIPT.md). File này chỉ ghi: mở màn nào, bấm gì, khán giả thấy gì, nói gì.

Chữ trong **đậm** hoặc "ngoặc kép" là chữ thật trên màn, lấy từ từ điển `nextjs-frontend/src/lib/i18n/messages/*.vi.ts`.

## 1. Trước khi khán giả vào

1. Bật Redis → backend `3001` (đợi `/health` 200) → `next build` rồi `next start --port 3100` với `APP_DATA_MODE=api`. Không dùng `next dev`.
2. Ba cửa sổ, **ba kho cookie riêng** (ví dụ Chrome thường, Chrome ẩn danh, Edge). Hai cửa sổ ẩn danh dùng chung cookie, đăng nhập vai thứ hai sẽ đá vai thứ nhất ra.
3. Cửa sổ HLV: `rafael.costa@lotus-combat.test`. Mở trước `/coach/dashboard` một lần (lần đầu khoảng 5 giây).
4. Cửa sổ võ sĩ: Minh Trần (`minh.tran@lotus-combat.test`). Thu về 390 px (F12, chế độ điện thoại) nếu muốn khoe giao diện điện thoại.
5. Cửa sổ bác sĩ: Thu Lê (`thu.le@lotus-combat.test`). Admin (`admin@gmail.com`) đăng nhập sau trong cửa sổ bác sĩ hoặc võ sĩ.
6. Mật khẩu là mật khẩu thật trên backend, không phải `mma-demo`. Không ghi mật khẩu lên màn chiếu.
7. Cả ba cửa sổ để **Tiếng Việt** (menu tài khoản góc trên phải → **Ngôn ngữ**).
8. Xem đồng hồ: giờ thi phải **sau giờ hiện tại**. Dùng **22:00** (sau 21:30 thì dùng 23:30). Giờ cân **08:00** cùng ngày.
9. Nếu thiếu thời gian lúc trình bày: tạo sẵn giáo án ở bước 0 trước giờ chiếu.
10. Dự phòng: backend hoặc Supabase hỏng thì tắt 3100, xoá `nextjs-frontend/.next`, chạy demo mode (`APP_DATA_MODE=demo`, `NEXT_PUBLIC_VIDEO_PIPELINE=mock`, `pnpm dev`, cổng 3000, nút "Rafael Costa"). Cùng kịch bản, C4 dùng Diego Alvarez.

## 2. Kịch bản

Thứ tự chạy thật: Mở đầu → 0, A1–A3 → **V1–V3 (võ sĩ)** → A4–A6 → B1–B2 → C1–C3 → **V4–V5 (võ sĩ)** → C4 → Bác sĩ → Admin. Phần võ sĩ phải chia hai lần: sau khi ghi kết quả, trận của Minh không còn ở màn **Trận đấu** của võ sĩ.

Menu HLV: **Hôm nay**, **Trận đấu** (tab **Sắp tới** / **Đình chỉ** / **Sẵn sàng**), **Võ sĩ**, **Tập luyện** (tab **Buổi tập** / **Giáo án**), **Phòng video**, **Cấp phép**.

### 2.1 Mở đầu (cửa sổ HLV)

| # | Màn (route) | Thao tác | Khán giả thấy gì | Câu nói | Chuyển sang |
| --- | --- | --- | --- | --- | --- |
| M1 | Hôm nay `/coach/dashboard` | Không bấm, cuộn chậm | Lời chào Rafael; nút **Giáo án mới**, **Xếp buổi tập**; thẻ **Việc cần làm** chia **Trước trận** / **Tuần thi đấu và ngày thi** / **Sau trận**; hàng **Việc cần xử lý**; lịch hôm nay | "HLV mở app là thấy việc cần làm, app gom từ mọi trận và mọi võ sĩ." | Menu **Trận đấu** |
| M2 | Trận đấu `/coach/bouts` | Không bấm | Bảng **Trận đang theo dõi**: Aigerim Sadykova, trận 26/12 gặp Daria Volkova, giai đoạn **Đang chuẩn bị thi đấu**, cột **Cân nặng**, **Cổng 1** | "Hôm nay em đi trọn một trận mới cho Minh Trần, từ lúc nhận trận đến sau trận." | Bước 0 |

### 2.2 Chuẩn bị trận (cửa sổ HLV)

| # | Màn (route) | Thao tác | Khán giả thấy gì | Câu nói | Chuyển sang |
| --- | --- | --- | --- | --- | --- |
| 0 | **Tập luyện** → tab **Giáo án** → **Giáo án mới** (`/coach/training-plans/new`) | Bước 1 chọn mẫu **Trại thi đấu** → **Tiếp**. Bước 2: Võ sĩ **Minh Trần**, tiêu đề `Lotus Fight Night 18 – Minh`; giai đoạn tự là `fight_camp`. Có ô trọng tâm thì chọn một ô. **Tiếp** tới bước cuối → **Tạo giáo án** | Trang giáo án mới có tiêu đề vừa nhập | "Trận cần một giáo án trại thi đấu của đúng võ sĩ. Mẫu điền sẵn phần lớn." | Menu **Trận đấu** → **Trận đấu mới** |
| A1 | Trận đấu mới `/coach/bouts/new` | **Võ sĩ** Minh Trần · **Bộ luật thi đấu** `MMA – VMMAF 2021` · **Hạng cân** 70 kg · **Giải đấu** `Lotus Fight Night 18` · **Đối thủ** `Arman Petrosyan` · **Địa điểm** `Nhà thi đấu Phú Thọ` · **Số hiệp dự kiến** 3 hiệp · **Giờ cân** hôm nay 08:00 · **Giờ thi đấu** hôm nay 22:00. Đợi khung **Kiểm tra cân nặng** → **Tạo trận đấu** | Khung **Kiểm tra cân nặng** (xanh "Trong tầm với", hoặc "Có rủi ro"); trang trận mới, nhãn **Đã lên lịch** | "Chọn bộ luật là app tự lấy hạng cân, hạn hồ sơ, ngưỡng giảm cân cấp tính, và tính ngay võ sĩ có kịp đạt cân không." | Khung **Bắt đầu camp** trên cùng trang |
| A2 | Trang trận `/coach/bouts/<id>` | **Liên kết giáo án** → chọn `Lotus Fight Night 18 – Minh (…)` → **Bắt đầu camp** | Thông báo "Đã bắt đầu đợt chuẩn bị"; nhãn **Đang chuẩn bị thi đấu**; ô **Giáo án** là link tới giáo án | "Camp gắn với trận. Biểu đồ cân của camp tính từ ngày đầu giáo án." | Thẻ **Kế hoạch ăn** cùng trang |
| A3 | Trang trận, thẻ **Kế hoạch ăn** | Ô **Trong camp**: `Cơm, thịt nạc, rau. Cắt tinh bột sau 18h.` Ô **Tuần thi đấu**: `Giảm nước từ D−2. Không sauna nếu chóng mặt.` → **Lưu kế hoạch** | "Đã lưu kế hoạch ăn"; giai đoạn đang áp dụng được tô nổi | "Ba giai đoạn ăn. Võ sĩ chỉ thấy ô đang áp dụng." | **V1** (cửa sổ võ sĩ) |
| A4 | Trang trận | **Vào tuần thi đấu** | Nhãn **Tuần thi đấu**; thẻ Cổng 1 **Chưa có hồ sơ nào** (VMMAF không bắt hồ sơ); hồ sơ y tế bị khoá | "Cổng 1: thiếu hồ sơ bắt buộc thì app chặn ở đây. Bộ luật này không bắt hồ sơ nên đi thẳng." | **Ghi cân chính thức** |
| A5 | Trang trận | **Ghi cân chính thức** → **Cân nặng** `69,5` → hiện **Đạt cân.** → **Lưu kết quả cân** | "Đạt cân"; nhãn **Đã cân**; hiện khối **Góc đài & diễn biến hiệp** với **Thẻ góc đài**, **Ghi hiệp & lời dặn** | "HLV nhập một số. Quá hạn thì app chỉ hỏi: thi ở mức cân thỏa thuận hay huỷ trận." | **Phân tích đối thủ** |
| A6 | Phân tích đối thủ `/coach/bouts/<id>/opponent-analysis` | Chỉ cuộn | **Quan sát (…)**, **Chiến thuật (…)**: 4 chiến thuật mẫu, mỗi chiến thuật có **Căn cứ (quan sát)** | "Mỗi chiến thuật bắt buộc dựa trên một quan sát có bằng chứng. Từ đây app dựng thẻ góc đài." | **B1**, hoặc **Thẻ góc đài** (B2) |

### 2.3 Trong trận (cửa sổ HLV)

| # | Màn (route) | Thao tác | Khán giả thấy gì | Câu nói | Chuyển sang |
| --- | --- | --- | --- | --- | --- |
| B2 | Thẻ góc đài `/coach/bouts/<id>/corner-card` | **Lọc theo hiệp** → **Hiệp 1**, rồi **Tất cả hiệp** | 4 chiến thuật, nhãn **Mọi hiệp**/**Hiệp n**, **Căn cứ lặp lại**/**Quan sát 1 lần**, **Đã luyện**/**Chưa luyện**; nút **In thẻ A4** | "Thẻ góc đài tự dựng từ phân tích đối thủ. **Chưa luyện** là rủi ro HLV cần thấy trước trận." | **Ghi hiệp & lời dặn** |
| B1a | Ghi hiệp `/coach/bouts/<id>/rounds` | Hiệp 1 (**Đang ghi**): chiến thuật thứ nhất **Hiệu quả**, thứ hai **Không hiệu quả** · **HLV tự chấm** → **Thua hiệp** · **Ghi thêm** → bật **Mệt**, knockdown `0` · **Lưu hiệp 1** | Hiệp 1 thu thành một dòng: **Đã lưu** · Thua hiệp · 0 knockdown · Mệt; phía trên hiện **Lời dặn giữa hiệp (trước hiệp 2)** và **Hiệp 2: làm gì** (**App đề xuất**) | "Giữa hiệp chỉ có một phút: bốn chạm, không gõ chữ. Lưu xong là có lời dặn cho hiệp sau." | Hiệp 2 |
| B1b | Cùng màn | Hiệp 2: y như hiệp 1 (cùng hai chiến thuật, Thua hiệp, Mệt, knockdown 0) → **Lưu hiệp 2** | **Lời dặn giữa hiệp (trước hiệp 3)**: "Khó thắng điểm — số hiệp còn lại không đủ bù (HLV tự chấm)"; chiến thuật thứ hai "Tạm bỏ (không hiệu quả 2 hiệp liền)"; dòng "Chỉ mang tính gợi ý — HLV là người quyết định tại góc đài." | "Thua hai hiệp, còn một: app nói thẳng. Không hiệu quả hai hiệp liền thì app tạm bỏ chiến thuật đó. HLV vẫn là người quyết." | Về trang trận (link đầu trang) |

### 2.4 Sau trận (cửa sổ HLV)

| # | Màn (route) | Thao tác | Khán giả thấy gì | Câu nói | Chuyển sang |
| --- | --- | --- | --- | --- | --- |
| C1 | Trang trận | **Ghi kết quả** → **Kết quả** Thua · **Cách kết thúc** KO · **Hiệp** 2 · **Có mất ý thức không?** Dưới 1 phút · **Số ngày đình chỉ** 30 · còn lại để trống → **Lưu kết quả** | "Đã ghi kết quả"; nhãn **Đã thi đấu**; thẻ **Đình chỉ** có dòng "KO: … Đang đình chỉ"; nút **Báo cáo sau trận** | "Thua KO là app tạo đình chỉ ngay trong cùng lần lưu, chặn đấu tập và vật, cần xác nhận mới được tập lại." | **Báo cáo sau trận** |
| R | Báo cáo `/coach/bouts/<id>/report` | Chỉ thẻ **Điểm cần luyện cho camp sau** → khối **Chiến thuật**: đổi **Kết luận** chiến thuật thứ nhất sang **Không hiệu quả**, ghi chú ngắn → **Lưu đánh giá** | Dòng kết quả "Thua · KO, hiệp 2"; **Điểm cần luyện**: "Chiến thuật không hiệu quả: …", "Đuối sức từ hiệp 1"; nhãn **App điền sẵn**; sau khi lưu: "Đã lưu đánh giá.", chiến thuật vừa sửa mất nhãn **App điền sẵn**; khối **Quan sát về đối thủ** | "Đây là màn báo cáo sau trận thầy hỏi lần trước. App tự chấm từng chiến thuật từ phần ghi hiệp, HLV chỉ sửa chỗ thấy khác. Bài học đi sang camp sau." | Menu **Trận đấu** → tab **Đình chỉ** |
| C2 | Đình chỉ `/coach/bouts/suspensions` | Không bấm | Dòng Minh Trần · **KO** · `Lotus Fight Night 18` · "Đang đình chỉ · ngày 1/30"; dòng của Kenji, Aigerim | "Trang đình chỉ của cả CLB: ai, vì sao, đến ngày nào, bị chặn loại buổi nào." | Tab **Sẵn sàng** |
| C2b | Sẵn sàng thi đấu `/coach/bouts/readiness` | Tuỳ chọn: **Bộ luật** VMMAF → **Áp dụng** | Mỗi võ sĩ một thẻ: **Sẵn sàng** / **Đình chỉ** / **Chờ xác nhận** / **Đang có trận**; Minh "Đang đình chỉ đến ngày …" | "Nghiệp vụ cuối vòng đời: ai nhận được trận mới. Lần trước chỉ có backend, nay đã có màn." | **Tập luyện** → **Buổi tập** → **Lên lịch buổi tập** |
| C3 | Buổi tập mới `/coach/sessions/new` | Võ sĩ Minh Trần · loại **Đấu tập** · ngày hôm nay · giờ bất kỳ · tiêu đề `Đấu tập thử` → **Lên lịch buổi tập** | Không lưu được, câu báo "Võ sĩ đang bị đình chỉ (KO): buổi tập loại này bị chặn đến ngày …, sau đó chờ xác nhận được tập lại." | "Cổng 2: lịch tập nguy hiểm bị chặn tự động. Bao cát, thể lực vẫn xếp được." | **V4** (cửa sổ võ sĩ) |
| C4 | Đình chỉ | Chỉ vào dòng Minh, **không có** nút **Xác nhận được tập lại** | Dòng KO vẫn "Đang đình chỉ" | "Hết 30 ngày, đình chỉ chuyển **Chờ xác nhận**, HLV hoặc bác sĩ bấm **Xác nhận được tập lại** kèm căn cứ. Sau đó võ sĩ tập lại theo 5 bậc, mỗi bậc ít nhất 24 giờ. Hôm nay trên dữ liệu thật không còn ai chờ xác nhận nên em chỉ nói quy tắc." | Cửa sổ bác sĩ |

### 2.5 Góc nhìn võ sĩ (cửa sổ Minh Trần)

Chiếu hai lần: V1–V3 ngay sau A3 (trận đang trong camp), V4–V5 sau C3.

| # | Màn (route) | Thao tác | Khán giả thấy gì | Câu nói | Chuyển sang |
| --- | --- | --- | --- | --- | --- |
| V1 | Hôm nay `/fighter/dashboard` | Không bấm | **Sẵn sàng**, **Cấp phép y tế**, **Tuần này** (các buổi tập), **Cân nặng** | "Võ sĩ mở app thấy hôm nay tập gì, đã được cấp phép chưa." | Menu **Trận đấu** |
| V2 | Trận đấu `/fighter/bout` | Không bấm | `Lotus Fight Night 18`, đối thủ Arman Petrosyan, **Giới hạn cân**, **Buổi cân**, **Đếm ngược**; kế hoạch ăn chỉ hiện ô **Trong camp** HLV vừa viết; **Hồ sơ y tế** | "HLV vừa lưu là võ sĩ thấy. Võ sĩ chỉ thấy phần ăn của giai đoạn hiện tại." | **Ghi cân** |
| V3 | Cân nặng hôm nay `/fighter/bout/weigh-in` | Chỉ cho xem ô **Cân nặng** và câu hỏi "Hôm qua bạn có theo đúng kế hoạch ăn không?". Muốn lưu thì nhập số gần số cân gần nhất của Minh → **Lưu** | Form ghi cân; nếu lưu: thông báo đã lưu kèm trạng thái cân | "Mỗi sáng võ sĩ ghi một số, dưới 30 giây. App so với lộ trình giảm cân an toàn." | Cửa sổ HLV, **A4** |
| V4 | Hôm nay `/fighter/dashboard` (tải lại) | Không bấm | Thẻ **Đình chỉ** đứng đầu: "Đang đình chỉ đến …", loại buổi bị chặn | "Võ sĩ cũng thấy ngay mình bị đình chỉ và còn tập được gì." | Menu **Sức khỏe** |
| V5 | Sức khỏe `/fighter/health` | Xoay hình 3D ở **Sơ đồ cơ thể** | **Sức khỏe & Cấp phép y tế**; tab **Tình trạng** / **Chấn thương & hồi phục** / **Lịch sử**; hình 3D đánh dấu vùng chấn thương cổ chân đã khỏi | "Chấn thương hiện và cũ trong 12 tháng hiện trên cơ thể 3D. Võ sĩ chỉ xem, bác sĩ ghi." | **C4** (cửa sổ HLV) |

### 2.6 Góc nhìn bác sĩ (cửa sổ Thu Lê)

Menu bác sĩ: nhóm **Hằng ngày** (**Hôm nay**, **Võ sĩ**, **Yêu cầu xem xét**, **Quan sát AI**) và nhóm **Hồ sơ y tế** (**Phiếu khám**, **Chấn thương**, **Kế hoạch phục hồi**, **Giấy phép**, **Lịch sử y tế**). **Bệnh án** bị ẩn ở API mode.

| # | Màn (route) | Thao tác | Khán giả thấy gì | Câu nói | Chuyển sang |
| --- | --- | --- | --- | --- | --- |
| D1 | Phân loại hôm nay `/doctor/dashboard` | Tải lại trang | Ba cột **Chặn** / **Theo dõi** / **Thông qua**; mỗi thẻ có cổng **Tập luyện**, **Thi đấu**; Minh nằm ở **Chặn** sau KO | "Bác sĩ mở app thấy ngay ai bị chặn, ai cần theo dõi. Minh vừa thua KO đã sang cột Chặn." | **Phiếu khám** |
| D2 | Phiếu khám `/doctor/examinations` | Mở phiếu khám ban đầu của Minh | Danh sách **Phiếu khám**, nút **Tạo phiếu khám**; chi tiết phiếu | "Phiếu khám là căn cứ để cấp phép tập." | **Giấy phép** |
| D3 | Giấy phép `/doctor/medical-clearance` | Không bấm | Danh sách **Giấy phép**, nút **Cấp giấy phép**; giấy phép tập của Minh, Aigerim, Kenji | "Giấy phép tập và thi đấu tách riêng, có hạn. App cảnh báo trước khi hết hạn." | Menu tài khoản |
| D4 | Đang ở Giấy phép | Menu tài khoản (avatar góc trên phải) → **Ngôn ngữ** → **English**; xem lại D1. Xong đổi lại **Tiếng Việt** | Menu và nội dung màn bác sĩ chuyển tiếng Anh | "App song ngữ. Màn bác sĩ cũng dịch theo người dùng." | Admin |

### 2.7 Admin (ngắn)

Đăng nhập `admin@gmail.com` ở cửa sổ bác sĩ (đăng xuất Thu Lê trước) hoặc cửa sổ võ sĩ.

| # | Màn (route) | Thao tác | Khán giả thấy gì | Câu nói | Chuyển sang |
| --- | --- | --- | --- | --- | --- |
| AD1 | Hôm nay `/admin/dashboard` | Không bấm | Tổng quan hệ thống | "Admin không làm nghiệp vụ trận, chỉ quản lý người dùng và hệ thống." | **Người dùng** |
| AD2 | Người dùng `/admin/users` → tab **Vai trò và quyền** `/admin/roles` | Không bấm | Danh sách tài khoản; bảng quyền theo vai | "Mỗi vai có quyền riêng. HLV chỉ thấy võ sĩ mình phụ trách." | **Hệ thống** → **Nhật ký hệ thống** |
| AD3 | Nhật ký hệ thống `/admin/audit-logs` | Không bấm | Nhật ký thao tác | "Thao tác quan trọng đều được ghi lại." | Kết, hỏi đáp |

**Câu kết:** "Trước trận app chặn đúng lúc. Trong trận app gợi ý lời dặn từ phân tích đối thủ. Sau trận app tự tạo đình chỉ, chặn lịch tập nguy hiểm, và chuyển bài học sang camp sau. Người dùng chỉ nhập điều họ biết."

## 3. Thời gian

| Phần | Phút |
| --- | --- |
| Mở đầu (M1–M2) | 1,5 |
| Chuẩn bị trận (0, A1–A6) | 6 |
| Võ sĩ lần 1 (V1–V3) | 2 |
| Trong trận (B2, B1a, B1b) | 4 |
| Sau trận (C1, R, C2, C2b, C3, C4) | 5 |
| Võ sĩ lần 2 (V4–V5) | 1,5 |
| Bác sĩ (D1–D4) | 3 |
| Admin (AD1–AD3) | 1 |
| **Tổng** | **24** |

Thiếu giờ thì cắt theo thứ tự:
1. Admin: chỉ nói một câu, không mở màn.
2. Bước 0: tạo giáo án trước giờ chiếu, khi chiếu chỉ nói "đã tạo sẵn".
3. A3 và V3: bỏ kế hoạch ăn và form ghi cân.
4. B1b: ghi hiệp 2 nhanh, không đọc từng dòng lời dặn.
5. C2b và D2.

Không cắt: A1, A5, B1a, C1, **R (báo cáo sau trận)**, C2, C3, D1.

## 4. Sự cố hay gặp ở API mode

| Sự cố | Làm gì, nói gì |
| --- | --- |
| **Hôm nay** của HLV chậm khoảng 5 giây | Mở trước một lượt. Nếu chậm khi chiếu: "Màn này đọc riêng từng võ sĩ; backend sẽ có endpoint đọc theo cả đội." |
| Tạo trận báo giờ thi đã qua | Giờ thi phải sau giờ hiện tại. Đổi 22:00 hoặc 23:30, giờ cân 08:00 cùng ngày. Không tạo trận ngày mai: sẽ không ghi được kết quả hôm nay. |
| Khung **Kiểm tra cân nặng** báo "Có rủi ro" ở 70 kg | Không chặn tạo trận. Muốn đẹp thì đổi 77 kg; cân 69,5 vẫn đạt. |
| A2 báo không có giáo án / võ sĩ đã có trận khác | Giáo án phải của Minh và là `fight_camp`. Minh còn trận chưa xong thì backend từ chối: dùng trận đó hoặc chọn võ sĩ khác. |
| Không thấy **Ghi kết quả** | Chỉ hiện đúng ngày thi và sau khi **Đã cân**. |
| Lưu kết quả bị từ chối | Thua KO phải có **Hiệp**, **Có mất ý thức không?** và **Số ngày đình chỉ** (VMMAF không gợi ý số ngày). |
| Thẻ góc đài trống | Tải lại trang. Trận mới ở API mode có sẵn 4 chiến thuật mẫu. |
| C4 không có nút **Xác nhận được tập lại** | Đúng quy tắc: chỉ có khi đình chỉ đã hết hạn và **Chờ xác nhận**. Hôm nay không còn ai chờ trên Supabase. Muốn bấm thật thì chuyển demo mode, Diego Alvarez. |
| Kenji, Aigerim bị đình chỉ | Có thật: Kenji KO tới 8/12, Aigerim KO tới 9/12 (trận 26/12 của Aigerim đã có cảnh báo đình chỉ). Không dùng hai người này cho phần chính. |
| Thấy trận và đình chỉ tên `UAT …`, `TEST API …` | Dữ liệu chạy thử trên database thật, sẽ xoá sau buổi demo. Không mở. Không dùng Dat Nguyen. |
| Hỏi về giới tính của hình 3D | Backend chưa có trường giới tính. Khi không rõ, mọi màn (HLV, võ sĩ, bác sĩ) dùng cùng một mô hình cơ thể; võ sĩ nữ có ghi giới tính dùng hình trung tính, chờ mô hình nữ. |
| **Trận đấu** của võ sĩ báo "Chưa có trận sắp tới" | Trận đã ghi kết quả thì rời màn này. Vì vậy V2 chiếu trước C1. |
| V3: võ sĩ ghi cân sau A5 | Đừng làm: số ghi trong ngày thay số cân chính thức 69,5 đã lưu làm cân hôm nay. |
| Đổi ngôn ngữ ở một cửa sổ, cửa sổ khác cũng đổi | Ngôn ngữ lưu bằng cookie của trình duyệt. Đổi lại **Tiếng Việt** sau D4. |
| Vài câu kiểm lỗi SCAT6 vẫn tiếng Việt khi chọn English | Đã biết, còn khoảng 76 câu. Không mở form SCAT6 lúc ở tiếng Anh. |
| Minh không có trên bảng của bác sĩ | Dùng Aigerim hoặc Kenji (cũng ở cột **Chặn**). |
| **Gợi ý từ video (AI)** ở Phân tích đối thủ | Không bấm khi chiếu ở API mode: gọi AI thật, mất 1–3 phút. |
| Trang báo lỗi, `/login` 404 | Tải lại. `/login` 404 thì `.next` cũ: tắt, xoá `nextjs-frontend/.next`, build lại. Hỏng hẳn thì sang demo mode (mục 1, dòng 10). |

## 5. Khác với kịch bản cũ

So với [DEMO-API-MODE-SCRIPT.md](./DEMO-API-MODE-SCRIPT.md); file này làm theo code.

| Kịch bản cũ | Code hiện tại |
| --- | --- |
| Menu **Giáo án** → **Tạo mới** | Menu **Tập luyện** → tab **Giáo án** → **Giáo án mới** (hoặc nút **Giáo án mới** ở Hôm nay) |
| Template **Fight camp**, nút **Next** | Mẫu **Trại thi đấu**, nút **Tiếp**, lưu bằng **Tạo giáo án** |
| Menu **Trận đấu** → **Tạo trận**; bấm "tạo" | Nút **Trận đấu mới**; lưu bằng **Tạo trận đấu** |
| Bảng giá trị: giờ thi "hôm nay, 19:00" | Phải sau giờ hiện tại; script UAT dùng 22:00. File này dùng 22:00 |
| A2: chọn giáo án rồi **Lưu**; trạng thái **Trại tập** | **Liên kết giáo án** → **Bắt đầu camp**; nhãn **Đang chuẩn bị thi đấu** |
| A3: ba ô "trại tập / tuần thi đấu / sau cân", bấm lưu | Ô **Trong camp** / **Tuần thi đấu** / **Từ lúc cân đến giờ thi**, nút **Lưu kế hoạch** |
| A5: phải hiện "đạt hạng" | Hiện **Đạt cân.**; nút **Lưu kết quả cân** |
| Trận xong: trạng thái **Đã xong** | Nhãn **Đã thi đấu** |
| C2: `KO · hôm nay – +29 ngày (30 ngày)` · **Đang đình chỉ** | Nhãn "Đang đình chỉ · ngày 1/30" |
| C3: Menu **Buổi tập** → tạo mới, bấm lưu | **Tập luyện** → **Buổi tập** → **Lên lịch buổi tập**; câu từ chối "Võ sĩ đang bị đình chỉ (KO): …" |
| C4: nút **Cho tập lại** | Nút **Xác nhận được tập lại**, hộp thoại **Căn cứ cho tập lại** → **Xác nhận** |
| C4 "chuẩn bị từ hôm trước": tạo đình chỉ 1 ngày cho võ sĩ phụ | Đình chỉ Y tế của Aigerim đã được xác nhận tối 9/11; hôm nay không còn ai chờ. C4 chỉ nói quy tắc |
| Không có màn **Sẵn sàng** | Có tab **Trận đấu** → **Sẵn sàng** (`/coach/bouts/readiness`), trả lời nghiệp vụ 15 mà review 27/10 ghi "màn chưa có" |
| Mục "Nên nhập gì": dòng Hiệp 1 "0 knockdown", không nói **Mệt** | Báo cáo chỉ có "Đuối sức từ hiệp 1" khi cả hai hiệp bật **Mệt**; file này bật **Mệt** ở cả hai hiệp như script UAT |
| Không có phần võ sĩ, bác sĩ, admin | Thêm V1–V5, D1–D4, AD1–AD3 theo route của `uat-demo.mjs` và menu trong `navigation.ts` |

Rủi ro còn lại, chưa kiểm được từ code:
- Không chạy thử trên máy thật hôm nay; nhãn lấy từ từ điển và script UAT (lượt API mode 10/11: 17/17).
- Thu Lê đang phụ trách Minh, Aigerim, Kenji, Lucas trên Supabase (kiểm 10/11).
- Minh có 2 yêu cầu xem xét cũ làm Minh hiện "Chưa được tập"; bác sĩ Thu trả lời bằng phiếu khám ngày 10/11 trước giờ demo. Mở hồ sơ Minh trước để chắc đã về "Được tập".
- Nội dung thẻ **Việc cần làm** lúc mở đầu tuỳ dữ liệu hôm nay; không hứa trước dòng nào sẽ hiện.
