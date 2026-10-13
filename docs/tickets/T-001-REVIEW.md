# T-001 Review

- Người review: Claude · Ngày: 2026-10-13
- Nhánh: `feat/T-001-hide-frozen-navigation` · Commit được review: `4f96b2b`, `8d28142`
- **Kết luận: APPROVED**

## Lệnh đã chạy lại

| Lệnh | Kết quả | So với baseline |
| --- | --- | --- |
| `pnpm --filter nextjs-frontend lint` | Qua (exit 0) | Như baseline |
| `pnpm --filter nextjs-frontend typecheck` | Qua (exit 0) | Như baseline |
| `pnpm --filter nextjs-frontend test` | 69 file qua, 1 skip; 581 test qua, 1 skip | Baseline 578 qua; thêm 3 test mới, không test nào lỗi |

Output khớp với handover.

## Đối chiếu tiêu chí nghiệm thu

| # | Kết quả | Ghi chú |
| --- | --- | --- |
| 1 | Đạt | Diff bỏ đúng 11 đích; test `criterion 1` duyệt toàn bộ `NAVIGATION` |
| 2 | Đạt | Thứ tự và nhãn giữ nguyên; `Clinical` trỏ `injuries`, còn 2 tab |
| 3 | Đạt | Roster và Patients bỏ `tabs`; test `criterion 3` |
| 4 | Đạt | Handover giải thích từng test cũ đã đổi và lý do |
| 5 | Đạt (theo handover) | Gemini kiểm tra `/coach/performance` qua dev server demo mode; trang không bị xoá hay sửa trong diff |

Kiểm tra thêm: không push lên remote; dev server dùng để kiểm tra đã được tắt; không còn trang nào ngoài khu vực đóng băng liên kết tới trang bị ẩn.

## Vấn đề

| Mức | Vị trí | Nội dung |
| --- | --- | --- |
| Gợi ý | `navigation.test.ts`, test `criterion 3` | `not.toBe(1)` thừa sau `toBeGreaterThanOrEqual(2)` |
| Gợi ý | `src/lib/services/shell.ts:38` | Badge `newAlerts` vẫn được tính dù mục Observations đã ẩn. Không ảnh hưởng hành vi; để nguyên trong đợt này |

Không có vấn đề mức "chặn" hay "nên sửa".
