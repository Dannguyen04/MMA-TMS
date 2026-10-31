# T-049 review

- Ngày: 31/10/2026. Người review: Claude (lead) + review độc lập (subagent không mang ngữ cảnh).
- Code: subagent viết thay `agy` (lệnh gọi `agy` bị chặn trong phiên này).

## Kết quả

- Backend: `clearSuspension` tính `suspensionStatusOn` trên dòng đã khoá, theo ngày học viện; khác `AWAITING_CLEARANCE` thì 409 `SUSPENSION_NOT_AWAITING_CLEARANCE`, `details: { status }`. Thứ tự: 422, 403, 404, 403 phân công, `SUSPENSION_ALREADY_CLEARED`, rồi mã mới.
- Frontend: demo mode chặn cùng mã; action trả câu vi/en riêng.
- Ca C1, C2, C4, C5, C6 lỗi trên code cũ, qua sau khi sửa; C3 là ca đối chứng; C7 giữ `SUSPENSION_ALREADY_CLEARED`; C8 bỏ (`test:db` chỉ chạy SQL kiểm migration, không có ca service thật); C9, C10 qua.
- Quyết định của lead (chủ dự án đã coi xác nhận sớm là lỗi): xoá test `allows early clear before ends_on ...`; bỏ nửa `MANDATORY_REST` của `allows clearing when in AWAITING_CLEARANCE`. Kiểm nhật ký kiểm toán chuyển vào C3, chặt hơn (đúng authSubject, requestId, trước khi khoá dòng); đã thử bỏ `setAuditContext` thì C3 lỗi.
- Kiểm cuối (Claude chạy lại): `vitest src/suspensions src/bouts` 470/470, build backend OK, frontend lint/typecheck sạch, test 954 passed | 2 skipped.

## Review độc lập

APPROVED, không có vấn đề chặn hay nên sửa. Không caller nào (backend, frontend, điện thoại, script seed) dựa vào việc xác nhận sớm. Gợi ý, để lượt sau:

1. C3 dùng ghi chú không có khoảng trắng hai đầu, nên không còn test nào ở tầng service kiểm việc lưu ghi chú đã cắt khoảng trắng (schema vẫn cắt, `suspensions.model.spec.ts`).
2. Không test nào kiểm `clearedById`, `clearanceNote` trong phản hồi sau khi xác nhận.
3. `expect(ko.clearedAt).toBeNull()` trong C1 không thể lỗi (repo mock không đổi dữ liệu); chặn thật là "không gọi `repo.clearSuspension`", đã có.

## Báo Dan

Mã lỗi mới `SUSPENSION_NOT_AWAITING_CLEARANCE` (409, `details.status`) trên `POST /suspensions/:id/clear`. Ai gọi API này trực tiếp (điện thoại, script) cần xử lý mã này. Không migration.

**Kết luận: APPROVED.**
