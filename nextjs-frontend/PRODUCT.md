# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Huấn luyện viên (HLV), người dùng chính.** Làm việc trên máy tính ở câu lạc bộ, ngay sau trận hoặc đầu tuần: tạo trận, theo dõi cân và hồ sơ, ghi kết quả, tạo đình chỉ, xếp lịch tập, xem ai sẵn sàng nhận trận mới.
- **Võ sĩ.** Ghi cân hằng ngày, xem lịch, trận và trạng thái đình chỉ của mình trên điện thoại (màn điện thoại do nhóm mobile làm riêng).
- **Bác sĩ (không bắt buộc).** Xác nhận hồ sơ, chấn thương, cho phép tập lại sau đình chỉ. Khi CLB không có bác sĩ, HLV làm thay và app ghi rõ "không có xác nhận y tế".
- **Admin.** Quản lý người dùng, bộ luật giải, chế độ có hoặc không có bác sĩ.

## Product Purpose

MMA-TMS là đồ án: nền tảng quản lý huấn luyện võ sĩ cho câu lạc bộ võ thuật, đang thu hẹp về **Fight Camp**, đưa một võ sĩ từ lúc nhận trận đến lúc được tập lại sau trận. Phải đúng hạng cân, đủ hồ sơ y tế, và không tập khi đang bị đình chỉ. Thành công là HLV chỉ nhập những điều chỉ họ biết, còn app tự kiểm tra, tự cảnh báo và tự tạo hệ quả.

## Positioning

Trả lời câu hỏi của giảng viên "khác gì Excel": app **tự xử lý hệ quả** của từng quyết định theo bộ luật giải và quy tắc y khoa có nguồn. Ví dụ: ghi kết quả thua KO thì đình chỉ tự tạo theo quy tắc nặng nhất của bộ luật; lịch tập tự đổi (buổi chờ xếp lại, buổi huỷ); giáo án camp tự sang hồi phục; võ sĩ tập lại theo bậc cường độ; bảng sẵn sàng toàn CLB tự tính.

## Operating Context

- Vòng đời một trận: trước trận (camp, cân hằng ngày, hồ sơ, Cổng 1), trong trận (thẻ góc đài, ghi theo hiệp, lời dặn giữa hiệp), sau trận (cân chính thức, kết quả, đình chỉ, Cổng 2, cho tập lại, sẵn sàng nhận trận mới).
- Bộ luật giải (ruleset) quyết định hạng cân, hạn nộp hồ sơ, số ngày đình chỉ; ví dụ VMMAF 2021, AIBA (tham khảo).
- Quy tắc đình chỉ và tập lại theo bậc dựa trên đồng thuận Amsterdam 2022, Hiệp hội Bác sĩ Võ đài (ARP), hướng dẫn bang Victoria (Úc): `docs/FIGHT-CAMP-BUSINESS-FLOWS.md`, mục F7.
- Demo trước giảng viên chạy cả demo mode (dữ liệu trong bộ nhớ) lẫn API mode (backend thật trên Supabase).

## Capabilities and Constraints

- Next.js 16, React 19, Tailwind 4, `lucide-react`; component dùng chung ở `src/components/ui` và `src/components/domain`; token màu ở `src/app/globals.css`.
- Giao diện tiếng Việt mặc định, có tiếng Anh, qua từ điển i18n; mọi chữ mới phải có cả hai.
- Không cài thư viện mới khi chưa được chủ dự án đồng ý; thư viện 3D phải hỏi Dan. Chuyển động dùng CSS có sẵn và phải tôn trọng chế độ giảm chuyển động.
- Phải chạy được ở cả demo mode và API mode.
- Thuật ngữ: Đình chỉ, Cổng 1 (hồ sơ y tế trước tuần thi đấu), Cổng 2 (chặn buổi tập khi đình chỉ), Chờ xếp lại (`PENDING`), bậc cường độ 1–5, tập lại theo bậc, sẵn sàng nhận trận mới.

## Evidence on Hand

- Dữ liệu demo là võ sĩ giả (ví dụ Diego Alvarez, Linh Phạm, Kenji Morita, Emma Lindqvist), trong `src/lib/mocks/`. Không có khách hàng, lời chứng thực hay số liệu thật; không được bịa.

## Product Principles

1. Người dùng chỉ nhập điều chỉ họ biết; app suy ra phần còn lại và nói rõ đã làm gì, vì sao.
2. An toàn võ sĩ đứng trước tiện lợi: khi thiếu chắc chắn, app chặn và giải thích, không đoán.
3. Mỗi quy tắc nghiệp vụ có nguồn; giao diện cho thấy căn cứ khi cần.
4. HLV vẫn là người quyết; app đề xuất, cảnh báo và cho sửa kèm lý do.

## Accessibility & Inclusion

Tôn trọng `prefers-reduced-motion`; điều khiển có nhãn và dùng được bằng bàn phím; không dựa vào màu đơn lẻ để báo trạng thái.
