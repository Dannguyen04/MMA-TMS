# T-042, T-043 Review

- Nhánh: `feat/T-042-043-ui-3d` (`d62aeae`, 30/10 21:50), tạo từ nhánh demo `sync/T-004-fight-camp`. Người làm: Hoàng Anh (cùng Claude trên máy Hoàng Anh).
- Người review: Claude trên máy Dan, 30/10.
- **Kết luận: CHANGES REQUESTED.** Code và lệnh kiểm tra đạt. Còn thiếu handover (mức chặn về quy trình) và hai điểm nên sửa ở giao diện điện thoại.

## Phạm vi đã review

T-042 và T-043 chưa có file ticket (README ghi DRAFT 27/10). Em đối chiếu với [nhận xét 27/10, mục 5](../REVIEW-27-10-FEEDBACK.md#5-uiux) và các plan trên nhánh: `docs/PLAN-POLISH-3D-I18N.md`, `docs/UI-LAB-PLAN.md`, `docs/UI-MOTION-AUDIT.md`.

Khác với nhánh demo, nhánh này có 47 commit (163 file, +10.093/−2.659 dòng):

- **3D:** model cơ thể quét sẵn `public/models/fighter-body.glb` (CC BY 4.0, có `ATTRIBUTION.md`, tên tác giả hiện ở `ModelCredit`); body map 3D; hình võ sĩ trên hồ sơ và thẻ võ sĩ của HLV; chế độ đồ hoạ `lite`.
- **Chuyển động (T-043):** diễn lại hiệp trên màn ghi hiệp; hiệu ứng nhấn nút, mở dialog và toast.
- **Dịch (L0–L2):** màn HLV và võ sĩ, bảng thuật ngữ, dữ liệu demo tiếng Việt.

Thư viện: không thêm gì mới. `three`, `@react-three/fiber`, `gsap`, `@gsap/react` đều đã có trên `fight-camp`.

## Lệnh Claude chạy lại (worktree `verify`, `d62aeae`)

| Lệnh | Kết quả |
| --- | --- |
| `pnpm --filter nextjs-frontend lint` | sạch |
| `pnpm --filter nextjs-frontend typecheck` | 0 lỗi |
| `pnpm --filter nextjs-frontend test` | `Test Files 107 passed \| 1 skipped (108)`, `Tests 958 passed \| 2 skipped (960)` |
| `pnpm --filter nextjs-frontend build` | `✓ Compiled successfully`, thoát 0 |

## Kiểm bằng mắt (`next dev`, demo mode, `vi`, Playwright)

| Màn | 390 px | 1440 px |
| --- | --- | --- |
| `/coach/dashboard` | không cuộn ngang, không lỗi console | như 390 |
| `/coach/fighters` (thẻ võ sĩ 3D) | 8 canvas WebGL, không cuộn ngang | như 390 |
| `/coach/fighters/f-aigerim-sadykova` | 1 canvas; xem N1 | đạt |
| `/coach/bouts/{bout-weighed-in, b-linh-saigon, b-kenji-pacific}` và `/rounds` | không cuộn ngang | đạt |
| `/coach/bouts/bout-weighed-in/rounds` sau khi ghi hiệp 1 | có khối "Diễn lại trận", không lỗi trang | có khối, xem G1 |
| `/fighter/dashboard`, `/fighter/health` | đạt | đạt |

Chưa kiểm: body map 3D trên `/fighter/health`, vì võ sĩ demo Minh Trần không có chấn thương nên màn không vẽ body map. Cần kiểm lại bằng một võ sĩ có chấn thương (trang `fighter/health/injuries/[injuryId]`).

## Vấn đề

| # | Mức | Chỗ | Vấn đề | Tái hiện |
| --- | --- | --- | --- | --- |
| H1 | chặn (quy trình) | `docs/tickets/` | Không có `T-042-HANDOVER.md`. [TEAM-WORKFLOW §6](../TEAM-WORKFLOW.md#6-handover-bắt-buộc-docsticketst-xxx-handovermd) bắt buộc handover: danh sách thay đổi, đối chiếu tiêu chí, output lệnh, lệch so với ticket. Vì T-042 và T-043 chưa có ticket, handover cần thêm mục "phạm vi đã làm" để chủ dự án duyệt phạm vi sau khi đã làm. | — |
| N1 | nên sửa | `src/app/(app)/coach/fighters/[fighterId]/layout.tsx:34` (`FighterFigure`) | Ở 390 px, hình 3D chiếm gần nửa màn hình đầu của hồ sơ võ sĩ. Tên, trạng thái cấp phép, trận sắp tới và nút "Lên lịch buổi tập" bị đẩy xuống dưới, phải cuộn mới thấy. Việc chính của HLV ở màn này là xem trạng thái rồi hành động, nên trên điện thoại hình nên nhỏ lại hoặc đặt sau khối thông tin. | Mở `/coach/fighters/f-aigerim-sadykova` ở 390×844: khối tên bắt đầu khoảng y = 520 px |
| N2 | nên sửa | `/coach/fighters` (thẻ võ sĩ) | Mỗi thẻ có một canvas WebGL riêng (8 canvas với 8 võ sĩ), hình cao khoảng 250 px mỗi thẻ ở 390 px. Danh sách dài ra và nặng trên điện thoại yếu. Đề nghị đo FPS hoặc thời gian vẽ ở chế độ `lite` trên điện thoại thật; nếu chậm thì dùng một canvas dùng chung hoặc ảnh tĩnh render sẵn cho thẻ. | Mở `/coach/fighters` ở 390 px, đếm `document.querySelectorAll("canvas").length` = 8 |
| G1 | gợi ý | `/coach/bouts/[boutId]/rounds` ở 1440 px | Có khoảng trống lớn giữa phụ đề trang và nút "Thẻ góc đài". | Ảnh chụp 1440 px sau khi ghi hiệp 1 |
| G2 | gợi ý | Gộp vào `fight-camp` | Nhánh tạo từ nhánh demo, xung đột 23 file với `fight-camp` (đo bằng `git merge-tree`, 30/10), không xung đột với `feat/T-046-embedded-youtube`. Việc gộp làm ở [T-040](./T-040-real-backend-demo.md) phần A sau khi review này APPROVED. | — |

## Để APPROVED

H1 xong (handover có output lệnh chạy lại trên commit cuối). N1 và N2 sửa, hoặc ghi lý do giữ nguyên trong handover. Claude kiểm lại ảnh ở 390 px.
