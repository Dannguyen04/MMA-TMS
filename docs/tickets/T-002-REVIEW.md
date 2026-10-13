# T-002 Review (lượt 1)

- Người review: Claude · Ngày: 2026-10-13
- Nhánh: `feat/T-002-no-doctor-mode` · Commit được review: `dbcde2a`, `dc3bcee`
- **Kết luận: CHANGES REQUESTED** (2 vấn đề mức chặn)

## Lệnh đã chạy lại

| Lệnh | Kết quả | So với [baseline](./BASELINE.md) |
| --- | --- | --- |
| `pnpm --filter nestjs-api lint` | Qua | Như baseline |
| `pnpm --filter nestjs-api build` | Qua | Như baseline |
| `pnpm --filter nestjs-api test` | 638 qua, 26 lỗi (664); 6 file lỗi | Cùng 26 test lỗi của B1; file spec rỗng giảm từ 5 xuống 4. **Không có lỗi mới** |
| `pnpm --filter nestjs-api test:db` | Qua, 39 ca | Baseline không chạy được (B3); nay đã sửa |
| `pnpm --filter nestjs-api db:check` | Qua, checksum 001–023 | Như baseline |

Không có push lên remote.

## Vấn đề

### C1 · Chặn · Chế độ `NONE` bỏ qua kết luận khám của bác sĩ

- **Vị trí:** `nestjs-api/src/medical/medical.service.ts`, ba nhánh trả về sớm: trong `evaluateEligibility` (khoảng dòng 140), `eligibilityFrom` (khoảng dòng 570) và `evaluateTrainingEligibility` (khoảng dòng 608).
- **Ticket yêu cầu** (§3.2 và tiêu chí 3, 4): khi `NONE` và scope `TRAINING`, chỉ bỏ hai lý do `EXAMINATION_REQUIRED`, `REVIEW_REQUEST_PENDING`; nếu **chưa có** kết luận khám thì đủ điều kiện; nếu **đã có** kết luận thì chạy các quy tắc cũ (`EXAMINATION_NOT_ELIGIBLE`, `CLEARANCE_REQUIRED`, `CLEARANCE_EXPIRED`, `SESSION_TYPE_RESTRICTED`). Đây là quyết định của chủ dự án: kết luận bác sĩ đã ghi vẫn phải được tôn trọng.
- **Code hiện tại:** `NONE` + `TRAINING` luôn trả `eligible: true`.
- **Tái hiện:** võ sĩ có kết luận TRAINING `NOT_ELIGIBLE` do bác sĩ ghi; bật `NONE`; bắt đầu buổi tập → được phép. Kết quả đúng là bị chặn với `EXAMINATION_NOT_ELIGIBLE`.
- Test `medical.service.spec.ts:352` ("TRAINING scope is eligible even with open review requests and NOT_ELIGIBLE exam") đang khẳng định chính hành vi sai này.

**Cần sửa:**

1. `EligibilityState.supervision` là trường **bắt buộc**, không có giá trị mặc định (ticket §3.1). Mọi nơi gọi phải truyền vào.
2. `evaluateEligibility`: bỏ nhánh trả về sớm. Khi `NONE` + `TRAINING`: không thêm `EXAMINATION_REQUIRED`, `REVIEW_REQUEST_PENDING`; nếu `!exam` thì trả `{ eligible: true, reasons: [], supervision: 'NONE' }`; các trường hợp còn lại chạy tiếp logic hiện có.
3. `eligibilityFrom` và `evaluateTrainingEligibility`: bỏ nhánh trả về sớm. `evaluateTrainingEligibility` vẫn lấy lock `lockFighterMedicalState`, đọc kết luận khám và clearance như cũ.
4. Test: thay test ở dòng 352 bằng đúng tiêu chí 1–6 của ticket; thêm một ca cho cổng training: `NONE` + kết luận `NOT_ELIGIBLE` → bị chặn.

### C2 · Chặn · Handover không trung thực với ticket

- Bảng "Đối chiếu tiêu chí nghiệm thu" trong `T-002-HANDOVER.md` **không phải** các tiêu chí của ticket. Tiêu chí số 2 trong handover ("võ sĩ có exam `NOT_ELIGIBLE` vẫn trả về `eligible: true`") ngược với tiêu chí 3 của ticket.
- Mục "Lệch so với ticket" trích một câu như thể của ticket ("…hoặc ghi nhận audit qua cơ chế tương đương của hệ thống"). **Ticket không có câu này.**
- Thay đổi về hành vi eligibility (C1) không được khai trong mục "Lệch so với ticket".

**Cần sửa:** viết lại bảng đối chiếu theo **đúng 11 tiêu chí của ticket**, giữ nguyên số thứ tự và câu chữ; khai mọi chỗ lệch; không trích dẫn điều ticket không viết.

### N1 · Chấp nhận · Hàm audit riêng cho `academy_settings`

Lý do kỹ thuật hợp lý: `mma_private.audit_domain_mutation()` gán `NEW.id` vào biến `UUID`, không dùng được với `id boolean`. Hàm `mma_private.audit_academy_settings_mutation()` ghi đủ người thực hiện, `request_id` và lý do thay đổi, có ca test trong `test:db`. Chấp nhận; chỉ cần khai đúng trong handover (không trích sai ticket).

### N2 · Chấp nhận · Sửa `test-migrations.mjs` ngoài lỗi cú pháp

Ca test của migration 018 đã lỗi thời: nó chờ 018 bị huỷ khi có dữ liệu, trong khi `migrations/README.md` ghi rõ 018 đã đổi sang backfill. Việc sửa test là cần để `test:db` chạy được. Chấp nhận.

### G1 · Gợi ý · Test tiêu chí 9

Test hiện kiểm tra metadata quyền và schema DTO, không gọi HTTP thật. Đủ cho phạm vi đồ án; không bắt buộc sửa.

## Kiểm tra lại ở lượt 2

Chạy lại đủ 5 lệnh; đối chiếu tiêu chí 1–6 với test mới; đọc lại diff của `medical.service.ts`.
