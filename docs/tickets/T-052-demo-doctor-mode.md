# T-052: dữ liệu demo có bác sĩ (chế độ `DOCTOR`)

- Trạng thái: **DRAFT, chờ Ken chọn cách demo hai chế độ** (mục "Cần chốt"). Ghi 03/11 theo yêu cầu của Ken: "demo chưa có doctor thì log ticket thêm để làm".
- Phạm vi: `nestjs-api/scripts/demo-seed.mjs` và test của nó. Không đổi code app, không migration.
- Người làm: Ken (Claude lead, `agy` code). Ken chạy script trên Supabase.
- Phụ thuộc: T-040 B (script demo hiện có). Dùng cho T-050.

## Bối cảnh

- Script demo hiện chỉ tạo HLV và võ sĩ (`ensureUser('COACH', …)`, `demo-seed.mjs:311`). Không có tài khoản bác sĩ, không có dòng phân công `doctor_fighters`.
- Kế hoạch cũ chuyển học viện sang chế độ `NONE` để demo kịch bản 4 "võ sĩ chưa khám vẫn tập được" ([SCOPE:144, Thước đo](../SCOPE-FIGHT-CAMP.md#thước-đo)). Ở `NONE`, bác sĩ không nhận được yêu cầu khám (`MEDICAL_SUPERVISION_DISABLED`), nên T-050 không demo được.
- Chế độ là **một cài đặt chung cho cả học viện** (`academy_settings`), không theo từng võ sĩ.
- Ở chế độ `DOCTOR`, võ sĩ chưa có khám BASELINE và kết luận TRAINING bị chặn **mọi** buổi tập (`EXAMINATION_REQUIRED`, FLOWS §7). Chuyển demo sang `DOCTOR` mà không ghi khám cho các võ sĩ demo thì kịch bản 1–5 hỏng.

## Cần chốt (Ken)

Chọn một:

- **A (Claude đề xuất):** demo chạy `DOCTOR`. Script tạo bác sĩ, phân cho mọi võ sĩ demo, ghi khám BASELINE và kết luận TRAINING cho từng người qua API. Kịch bản 4 (`NONE`) trình bày bằng cách Admin gọi `PATCH /academy-settings` ngay trong buổi demo rồi chuyển lại.
- **B:** demo chạy `NONE` như kế hoạch cũ; bỏ phần bác sĩ của T-050 khỏi demo.

## Việc (theo phương án A)

1. Tạo user `DOCTOR` `@example.com` (khuôn `ensureUser`).
2. Admin phân bác sĩ cho mọi võ sĩ demo: `POST /fighters/:id/doctors` (`medical-assignment.controller.ts:59`), chạy lại không trùng.
3. Bác sĩ ghi khám BASELINE và kết luận TRAINING `ELIGIBLE` cho từng võ sĩ: `POST /fighters/:id/medical-examinations`. Bỏ qua nếu đã có.
4. Thêm võ sĩ 8 cho T-050: đình chỉ `MEDICAL` 14 ngày bắt đầu hôm nay, `requiresClearance false`, có một yêu cầu khám đang mở do HLV gửi.
5. Đặt chế độ `DOCTOR` bằng `PATCH /academy-settings` (Admin, có lý do) ở cuối script, chỉ khi đang là `NONE`.

Ca kiểm thử và tiêu chí nghiệm thu viết sau khi Ken chọn phương án (cần kiểm hình dạng body của hai endpoint khám trước).
