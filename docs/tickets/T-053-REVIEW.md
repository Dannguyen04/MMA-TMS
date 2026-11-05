# T-053 Review

- Ngày: 03–04/11/2026. Người review: Claude (lead), cùng một subagent review độc lập không mang ngữ cảnh (1 lượt).
- Ticket: [T-053](./T-053-early-end-dialog-context.md). Handover: [T-053-HANDOVER.md](./T-053-HANDOVER.md). Nhánh `User_Feature`, chưa commit.
- Code: `agy`, model `gemini-3.8-flash-high`, 1 lượt.

## Kết luận

**APPROVED.** Không có vấn đề chặn hay nên sửa về hành vi. Còn các gợi ý ở mục cuối, chưa làm.

## Lệnh đã chạy lại (Claude)

| Lệnh | Kết quả |
| --- | --- |
| `pnpm --filter nextjs-frontend lint` / `typecheck` | exit 0 / exit 0 |
| `vitest run` (nextjs-frontend) | `Tests 1161 passed, 2 skipped`, trước T-053 là 1149 |

## Review độc lập

APPROVED. Reviewer đã kiểm những điểm sau:

- **Ca kiểm thử:** P1–P3, R1–R7, I1, K1 có đủ và đúng tên. Các ca R render component thân thật, không mock.
- **Dữ liệu gửi đi:** giống trước. Khác duy nhất là `effectiveExamId`, cần cho việc chọn sẵn khi chỉ có một phiếu hợp lệ.
- **Nối xử lý lỗi:** `handleEarlyEndActionResult` và `SuspensionEarlyEndAlert` vẫn nối đúng.
- **Chỗ gọi hộp thoại:** ba chỗ gọi không đổi.
- **Từ điển:** vi và en có cùng bộ khóa; các khóa cũ đã xóa.

## Kiểm bằng trình duyệt

Ảnh 1440 px và 375 px ở `D:/test/ai-worktrees/logs/t053-shots/`. Hai trường hợp có ảnh:

- hộp thoại ban tổ chức;
- hộp thoại bác sĩ khi chưa có phiếu khám.

Chưa xem được nhánh bác sĩ có phiếu khám, vì demo chưa có phiếu hợp lệ (việc của T-052); nhánh này chỉ có R4 và R5 kiểm. Chủ dự án chưa thử tay.

## Gợi ý chưa làm

1. R4 kiểm chữ "Đủ điều kiện" hơi lỏng, vì chữ này cũng nằm trong "Đủ điều kiện, có hạn chế".
2. W3 kiểm chữ "Đóng" khớp cả nhãn nút X "Đóng hộp thoại".
3. Bộ lọc phiếu và phần chọn sẵn đang tính hai lần (thân hộp thoại và `Dialog`); prop `fighterName` của thân không dùng.
4. Nhấn Huỷ rồi mở lại thì chữ đã nhập vẫn còn. Hành vi này có từ trước T-053.
5. Lỗi "chưa chọn phiếu" chưa gắn `aria-describedby` với nhóm radio.
6. Câu tiếng Anh `cutDays` ghi "1 days" khi n = 1.
7. Dòng mô tả dưới tiêu đề lặp ý với các khối bên dưới.
