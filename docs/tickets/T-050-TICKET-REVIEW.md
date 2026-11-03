# T-050 Review ticket (đề xuất, chưa có code)

- Ngày: 02/11/2026. Người review: Claude (subagent, theo yêu cầu của chủ dự án; Ken nhờ review).
- Đối tượng: `docs/tickets/T-050-early-end-by-doctor-exam.md` (commit `f93368b0`), trên `fight-camp` tại `66c0887`.
- Cách làm: grep từng tên file, hàm, bảng, quyền, mã lỗi, route trong ticket; đối chiếu với nghiệp vụ, tech spec, quy ước migration và các ticket T-002, T-036, T-045, T-049. Không sửa ticket, không code, không database.

## Kết luận

**CHANGES REQUESTED: chưa đủ để chuyển READY.** Ý tưởng hợp lý (kết thúc sớm cần bác sĩ, không mở cho KO/TKO). Nhưng ticket đang là bản đề xuất, chưa tự đứng được. Thiết kế dựng lại một luồng "yêu cầu khám" mà module `medical` đã có. Ticket chưa tính chế độ không có bác sĩ, trong khi môi trường demo chạy đúng chế độ đó. Ticket cũng thêm trang mới vào cổng Doctor đang đóng băng.

**Đề nghị: làm sau review 3 (10/11).** Nếu chủ dự án vẫn muốn có trước 10/11, chỉ làm bản cắt nhỏ ở mục "Bản cắt nhỏ": không migration, một endpoint, một mã lỗi.

## Tên trong ticket: có thật không

| Tên | Có thật | Ghi chú |
| --- | --- | --- |
| `POST /suspensions/:id/clear`, `SUSPENSION_NOT_AWAITING_CLEARANCE` | Có | T-049, `suspensions.service.ts:185-188` |
| `isCoachAssignedToFighter`, `isDoctorAssignedToFighter` | Có | `suspensions.repo.ts:97, 124` |
| Bảng `doctor_fighters` | Có | `doctorFighters` dùng ở `repo.ts:131` |
| `toSuspensionResponse` | Có | `suspensions.service.ts:308` |
| `coach/bouts/suspensions/page.tsx` | Có | |
| `routes.doctor`, `/doctor/dashboard` | Có | `nextjs-frontend/src/lib/routes.ts:90-91` |
| `/doctor/suspension-exams` | Chưa có (trang mới) | Thuộc cổng Doctor, đang **đóng băng** ([Phạm vi](../SCOPE-FIGHT-CAMP.md#giữ-gộp-đóng-băng), dòng "Cổng Doctor": "Bác sĩ chỉ còn màn xác nhận hồ sơ") |
| Mục "Kết thúc đình chỉ cần xác nhận", bảng quyền mục 2 trong FIGHT-CAMP-BUSINESS-FLOWS | Có | dòng 604 và `## 2. Vai trò và quyền` (dòng 373) |
| "theo mẫu 025 và 032" | Có | `025_suspensions.sql`, `032_session_status_pending.sql` |
| Migration 033 | Còn trống | `migrations/` dừng ở 032; `manifest.json`, `scripts/migration-files.mjs`, `package.json` không có 033; không nhánh nào (local, remote) có file 033+; `db:check`: `001-032 checksums OK` |
| Quyền `suspension:exam_request`, `suspension:exam_decide` | Chưa có (mới) | Đặt tên khớp kiểu `suspension:clear` |
| 5 mã lỗi `SUSPENSION_EXAM_*`, `SUSPENSION_NO_ASSIGNED_DOCTOR` | Chưa có (mới) | Chưa nêu đặt ở `suspensions.error.ts` |
| Loại thông báo `SUSPENSION_EXAM_REQUESTED`, `SUSPENSION_EXAM_DECIDED` | Chưa có (mới) | Ticket không nêu các chỗ phải sửa theo: `nestjs-api/src/shared/contracts/notification.contract.ts`, `notificationTypeEnum` trong `src/database/schema.ts` (khoảng dòng 341), nhãn thông báo ở frontend |
| ARP "TKO 30, KO 60, KO mất ý thức 90 ngày" | Khớp nguồn | FIGHT-CAMP-BUSINESS-FLOWS:574, có link ARP ở dòng 602. Ticket không dẫn link |

**Đã có sẵn mà ticket không nhắc tới:** module `medical` có luồng yêu cầu khám đầy đủ. Bảng `medical_review_requests` (migration 011: `fighter_id`, `requested_by_id`, `requester_role` FIGHTER/COACH/DOCTOR, `reason`, `status`, `resolved_by_examination_id`). Endpoint `POST /fighters/:id/medical-review-requests` (`medical.controller.ts:202`, "FIGHTER only self, COACH/DOCTOR only currently assigned Fighters"). Loại thông báo `MEDICAL_REVIEW_REQUEST`, trang `/doctor/review-requests`. Kết luận khám đóng yêu cầu qua `reviewRequestIds` (`medical.controller.ts:425`). T-050 dựng lại gần như y hệt: bảng mới, quyền mới, thông báo mới, trang bác sĩ mới.

## Vấn đề

| # | Mức | Cỡ | Vấn đề | Đề nghị |
| --- | --- | --- | --- | --- |
| P1 | Chặn | Lớn | **Chế độ không có bác sĩ (T-002, migration 023) không được nhắc.** Ở chế độ `NONE`, nghiệp vụ §7 ghi "không tạo được yêu cầu khám mới", code ném `MEDICAL_SUPERVISION_DISABLED` (`medical.service.ts:637-639`). Quy tắc 2 của T-050 chỉ kiểm `doctor_fighters`, nên ở chế độ `NONE` mà còn dòng phân công cũ thì vẫn tạo được yêu cầu, trái §7. Môi trường demo được chuyển sang `NONE` ([SCOPE:144](../SCOPE-FIGHT-CAMP.md)), nên ở review 3 tính năng này hoặc không chạy được, hoặc chạy trái quy tắc | Thêm quy tắc: `NONE` thì 409 `MEDICAL_SUPERVISION_DISABLED` (mã có sẵn), đình chỉ chạy hết hạn như cũ. Chủ dự án xác nhận demo 10/11 chạy chế độ nào |
| P2 | Chặn | Lớn | **Ticket chưa tự đứng được** (CLAUDE.md, "Cách viết ticket"). Không có mục tiêu chí nghiệm thu đo được, không có lệnh kiểm tra bắt buộc, không có danh sách file cần sửa. Chưa định nghĩa DTO, độ dài `request_note`, phân trang của `GET /suspension-exam-requests` (tech spec §4: cursor như `GET /goals`), hình dạng phản hồi | Bổ sung các mục đó. Riêng file: migration, `manifest.json`, `scripts/migration-files.mjs`, `package.json` (`db:migrate:033`), `migrations/README.md`, `scripts/test-migrations.mjs`, `src/database/schema.ts`, `notification.contract.ts`, `suspensions.constants.ts` (quyền), `suspensions.error.ts`, controller, service, repo, spec, frontend |
| P3 | Chặn | Lớn | **Quy ước migration chưa đủ** ([migrations/README.md](../../nestjs-api/migrations/README.md)). Thiếu: preflight yêu cầu ledger nào (025? 032?); advisory lock `(20260916, 33)`; ghi `migration_history` version 33; trigger `update_updated_at()`, `audit_domain_mutation()` (quy tắc 8 "ghi nhật ký kiểm toán" cần trigger này); `REVOKE ALL … FROM PUBLIC, anon, authenticated`; ca trong `test-migrations.mjs`. Cột `fighter_id` thừa: bảng `suspensions` không có `UNIQUE (id, fighter_id)` nên không dùng được khoá ngoại ghép như `medical_review_requests`. Phải thêm trigger kiểm `fighter_id` (kiểu `check_bout_nutrition_fighter` của 026), hoặc bỏ cột | Bỏ `fighter_id`, lấy qua `suspension_id`. Ghi đủ các điểm trên |
| P4 | Chặn | Lớn | **Nghiệp vụ y tế với `MEDICAL`.** `MEDICAL` dùng cho đình chỉ do **ban tổ chức** ra sau khám trận (FLOWS:555, H5). Bác sĩ của CLB kết thúc sớm đình chỉ của ban tổ chức là vượt thẩm quyền; ticket không có nguồn nào cho việc đó. `MEDICAL` cũng có thể là chấn thương đầu ngoài trận. Đồng thuận Amsterdam 2022 (nguồn đã dẫn ở FLOWS:573) yêu cầu trở lại theo bậc cho mọi chấn động não, nhưng quy tắc 5 cho "tập được mọi bậc" ngay sau khi đồng ý, vì code T-045 chỉ có lộ trình cho `KO`/`TKO`. Câu "MEDICAL/OTHER không có lộ trình tập lại theo bậc" chỉ tả code hiện có, không phải căn cứ y khoa | Hoặc loại trừ `MEDICAL` có nguồn từ ban tổ chức (cần thêm trường, nên làm sau), hoặc bắt bác sĩ khai "không phải chấn thương đầu" khi đồng ý. Chủ dự án quyết; ghi giới hạn này vào FLOWS |
| P5 | Nên sửa | Nhỏ | **Lý do giữ đủ ngày cho KO/TKO viết chưa đúng với app.** Ticket ghi "KO, TKO giữ đủ thời gian tối thiểu (ARP 30/60/90…)". App không áp mức ARP: preset AIBA gợi ý KO lần đầu 30 ngày (FLOWS:550), HLV còn sửa được số ngày nếu ghi lý do. Kết luận (không mở cho KO/TKO) vẫn đúng, chỉ phần lý do sai | Đổi thành "giữ đủ số ngày đã đặt theo ruleset, và qua lộ trình T-045"; dẫn link nguồn |
| P6 | Nên sửa | Lớn | **Trùng luồng `medical_review_requests`** (xem trên). Hai hàng chờ khám cho cùng một bác sĩ, hai loại thông báo, hai trang | Dùng yêu cầu khám có sẵn để báo bác sĩ. T-050 chỉ thêm hành động "kết thúc sớm" cho bác sĩ (bản cắt nhỏ) |
| P7 | Nên sửa | Nhỏ | **Quy tắc 7 và E14 tự mâu thuẫn.** "Tự thành `CANCELLED` khi có người đọc" nghĩa là `GET` phải ghi dữ liệu. Ở E14, nếu ném 409 bên trong `repo.transaction` (cách `clearSuspension` đang làm) thì lệnh ghi `CANCELLED` bị rollback cùng giao dịch | Không ghi: yêu cầu `PENDING` mà đình chỉ không còn hợp lệ thì tính là "đã đóng" khi đọc, giống cách `suspensionStatusOn` tính trạng thái |
| P8 | Nên sửa | Nhỏ | **Khoá và tranh chấp chưa nêu.** Đồng ý và từ chối cùng lúc, hoặc đồng ý cùng lúc với `/clear`: ticket chỉ ghi "cùng một giao dịch". Hai yêu cầu tạo cùng lúc sẽ đụng index duy nhất (23505), nhưng ticket không nói map sang `SUSPENSION_EXAM_REQUEST_PENDING` | Ghi rõ: khoá dòng `suspensions` rồi dòng yêu cầu, theo thứ tự cố định; `UPDATE … WHERE status = 'PENDING'`; map 23505 sang mã 409 |
| P9 | Nên sửa | Nhỏ | **Cho yêu cầu khi `AWAITING_CLEARANCE` là thừa.** Lúc đó `/clear` đã làm được việc này (HLV hoặc bác sĩ). Hai đường cho cùng một việc | Quy tắc 1 chỉ cho `ACTIVE` |
| P10 | Nên sửa | Nhỏ | **E15 không chạy được như ghi.** `test:db` chỉ chạy SQL kiểm migration, không dựng service (đúng lý do T-049 bỏ C8) | Kiểm rollback bằng service với repo mock ném lỗi giữa giao dịch, hoặc bỏ |
| P11 | Nên sửa | Nhỏ | **Ý nghĩa `cleared_at` đổi lại.** Sau T-049, tài liệu module ghi xác nhận chỉ từ `ends_on + 1` (`01-suspensions-core.md:42`). T-050 lại ghi `cleared_at < ends_on` | Ghi rõ trong FLOWS và tài liệu module: `cleared_at` trước `ends_on + 1` chỉ có từ T-050, kèm yêu cầu `APPROVED` |
| P12 | Gợi ý | Nhỏ | "Việc cần chốt" số 6 (T-049 trước) đã xong; "Phụ thuộc T-030 B" cần ghi trạng thái | Cập nhật |
| P13 | Gợi ý | Nhỏ | E9 cần nói rõ medical gate (D9) được mock hoặc đặt ở chế độ nào, vì buổi tập phải qua cả hai cổng | Ghi vào ca |
| P14 | Gợi ý | Nhỏ | API cho võ sĩ gửi yêu cầu không có giao diện trước T-048 (điện thoại) | Cắt khỏi lần đầu |

## Tiêu chí nghiệm thu

Ticket chưa có mục này. Ca E1–E16 đo được ở lớp service; E17, E18 có phần "kiểm trình duyệt" không đo được trong CI. E15 không chạy được (P10).

## Rủi ro nếu làm trước review 3 (10/11, tổng duyệt 9/11, hôm nay 2/11)

- Còn 7 ngày làm việc. Bản đầy đủ gồm migration mới (chủ dự án phải tự áp lên Supabase), 5 endpoint, 5 mã lỗi, 2 quyền, 2 loại thông báo, 1 trang bác sĩ mới, phần demo. Ticket cỡ T-036 A, mà T-036 A cần 2 lượt review độc lập.
- Môi trường demo ở chế độ `NONE` (P1): tính năng không chạy được trên demo nếu làm đúng quy tắc.
- Thêm trang vào cổng Doctor đang đóng băng, đổi phạm vi sát buổi chấm.
- Đụng `suspensions.service.ts`, `toSuspensionResponse`, demo, từ điển i18n, trong khi T-048 (Fon) và T-051 đang đọc cùng contract.
- Lợi cho demo thấp: kịch bản demo (SCOPE:185) không có bước kết thúc sớm.

## Bản cắt nhỏ (nếu buộc phải có trước 10/11)

1. **Không migration, không bảng, không quyền mới.** Dùng `suspension:clear` (DOCTOR đã có) và kiểm thêm `actor.role === DOCTOR` cùng `isDoctorAssignedToFighter`.
2. **Một endpoint** `POST /suspensions/:id/end-early` `{ examNote }` (3–500). Chỉ `MEDICAL` (hoặc `MEDICAL` và `OTHER`, chủ dự án chọn), chỉ khi `ACTIVE`. Cùng khuôn với `clearSuspension`: khoá dòng, kiểm, ghi `cleared_*`.
3. **Một mã lỗi** `SUSPENSION_EARLY_END_NOT_ELIGIBLE` (409, `details: { reason, status }`). Chế độ `NONE` dùng mã có sẵn `MEDICAL_SUPERVISION_DISABLED`. Bác sĩ không được phân dùng 403 có sẵn.
4. **Báo bác sĩ** bằng yêu cầu khám có sẵn (`medical_review_requests`), hoặc báo ngoài app. Không hàng chờ mới, không thông báo mới.
5. **Giao diện**: chỉ khi chủ dự án cho mở một nút trong cổng Doctor. Nếu không mở, làm API trước, giao diện sau 10/11.
6. Cắt: phía võ sĩ, huỷ yêu cầu, từ chối có lưu lịch sử, thẻ đếm dashboard, trạng thái `AWAITING_CLEARANCE`.

Ước lượng: một ticket backend nhỏ (khoảng E3–E5, E8, E10, E11, E16 cộng một ca `NONE`).

## Câu hỏi chủ dự án cần quyết

1. Làm T-050 trước hay sau 10/11? (Claude đề nghị: sau.)
2. Demo 10/11 chạy chế độ `DOCTOR` hay `NONE`? Nếu `NONE`, tính năng này có cần ở demo không?
3. Ở chế độ `NONE`, kết thúc sớm bị tắt hẳn hay HLV làm thay (ghi "không có xác nhận y tế")? Quy tắc 2 hiện chọn "tắt"; §7 cho HLV xác nhận thay khi **hết hạn**, chưa nói gì về kết thúc **sớm**.
4. Đình chỉ `MEDICAL` do ban tổ chức ra có được bác sĩ CLB kết thúc sớm không? Có cần tách nguồn đình chỉ không?
5. `MEDICAL` là chấn thương đầu: sau khi kết thúc sớm có áp lộ trình theo bậc T-045 không?
6. `OTHER` có được kết thúc sớm không (câu 4 của ticket)?
7. Dùng lại `medical_review_requests` hay làm bảng riêng `suspension_exam_requests`?
8. Có mở một nút hoặc trang trong cổng Doctor (đang đóng băng) cho việc này không?
