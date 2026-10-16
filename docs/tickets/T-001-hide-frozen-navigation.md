# T-001 · Ẩn các khu vực đóng băng khỏi menu

| | |
| --- | --- |
| **Trạng thái** | READY |
| **Phần** | Frontend (`nextjs-frontend`) |
| **Nhánh** | `feat/T-001-hide-frozen-navigation` từ `fight-camp` |
| **Ước lượng** | 2–3 giờ |
| **Tài liệu dẫn chiếu** | [Phạm vi – Giữ, gộp, đóng băng](../SCOPE-FIGHT-CAMP.md#giữ-gộp-đóng-băng) |

## Bối cảnh

Đồ án thu hẹp về Fight Camp. Một số khu vực của app bị đóng băng: không phát triển thêm và **ẩn khỏi menu**, nhưng **không xoá** trang, route hay code. Người dùng vẫn mở được bằng URL, phục vụ test và tham khảo.

## Phạm vi

Chỉ sửa `NAVIGATION` trong `nextjs-frontend/src/components/layout/navigation.ts` và test tương ứng `navigation.test.ts`.

| Vai trò | Bỏ khỏi menu | Giữ |
| --- | --- | --- |
| fighter | Hub "Progress" (cả hai tab Performance và Goals) | Today, Training, Film, Health |
| coach | Ba tab Performance, Goals, Applicants trong hub "Roster" | Today, Roster (chỉ còn Fighters), Training, Film room, Clearance |
| doctor | Tab Records trong "Patients"; tab Examinations và Recovery trong "Clinical"; mục "Observations" | Triage, Patients (chỉ còn Fighters), Clinical (còn Injuries và Clearance) |
| admin | "Admissions" trong nhóm Access; "AI models" trong nhóm AI platform | Mọi mục còn lại |

Quy tắc:

- Hub chỉ còn **một** tab thì bỏ thuộc tính `tabs`. Mục đó thành mục thường trỏ tới tab còn lại, ví dụ Roster → `routes.coach.fighters`.
- Hub còn từ hai tab trở lên thì `href` của hub là tab đầu tiên còn lại. Ví dụ "Clinical" có `href` là `routes.doctor.injuries`.
- Bỏ các import icon không còn dùng.
- `mobilePrimaryItems` của admin vẫn phải trả về 4 mục (dashboard, users, aiJobs, auditLogs); các mục này đều còn.

## Ngoài phạm vi

- Không xoá hay sửa trang trong `src/app/`, không sửa `src/lib/routes.ts`, không thêm redirect.
- Không thêm feature flag hay biến môi trường.
- Không đổi nhãn hay thứ tự các mục được giữ.

## Tiêu chí nghiệm thu

1. Không mục hay tab nào trong `NAVIGATION` trỏ tới: `routes.fighter.performance`, `routes.fighter.goals`, `routes.coach.performance`, `routes.coach.goals`, `routes.coach.admissions`, `routes.doctor.records`, `routes.doctor.examinations`, `routes.doctor.recovery`, `routes.doctor.aiAlerts`, `routes.admin.admissions`, `routes.admin.aiModels`.
2. Mọi mục được giữ ở bảng trên vẫn có mặt, đúng thứ tự.
3. Không hub nào có đúng một tab.
4. `navigation.test.ts` có test cho tiêu chí 1 và 3; các test cũ vẫn qua hoặc được cập nhật cho đúng cấu hình mới, ghi rõ trong handover test nào đổi và vì sao.
5. Mở trực tiếp URL của một trang bị ẩn (ví dụ `/coach/performance`) vẫn hiển thị trang như trước.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```

Tiêu chí 5 kiểm tra bằng tay (`pnpm --filter nextjs-frontend dev`, demo mode); ghi kết quả vào handover.
