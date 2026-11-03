# T-050: yêu cầu bác sĩ khám để kết thúc đình chỉ sớm

- Trạng thái: **ĐỀ XUẤT, chờ buổi review tới** (Ken 31/10: không merge, chỉ ghi ticket, cập nhật sau review). Chưa có code.
- Phạm vi đề xuất: backend `nestjs-api` (migration 033) + frontend `nextjs-frontend`. Điện thoại để sang [T-048](./T-048-fighter-suspension-view.md).
- Người làm: Ken (Claude lead, `agy` code)
- Phụ thuộc: T-007, T-030 B, [T-049](./T-049-clear-only-when-awaiting.md)

## Bối cảnh

Hiện tại một đình chỉ chỉ kết thúc khi hết số ngày (và được xác nhận nếu cần xác nhận). Không có đường nào cho võ sĩ đã khỏi trước hạn quay lại tập. API `POST /suspensions/:id/clear` đang cho kết thúc sớm bất kỳ lúc nào, nhưng đó là lỗi (T-049), không phải tính năng: không có bác sĩ khám, không giới hạn lý do.

Ken đề xuất 31/10: HLV hoặc võ sĩ **yêu cầu khám**; bác sĩ được phân cho võ sĩ **khám**; khám ổn thì bác sĩ **kết thúc đình chỉ sớm**.

## Quyết định đã có (Ken, 31/10)

| Câu hỏi | Chọn |
| --- | --- |
| Lý do nào được kết thúc sớm | Chỉ `MEDICAL` và `OTHER`. `KO`, `TKO` giữ đủ thời gian tối thiểu (ARP: TKO đòn vào đầu 30 ngày, KO 60 ngày, KO mất ý thức 90 ngày; AIBA cũng có mức tối thiểu), hết hạn rồi xác nhận như cũ. `DQ`, `MANDATORY_REST` là kỷ luật hoặc lịch nghỉ, không phải chấn thương, không kết thúc sớm |
| Màn hình | Web trước: HLV yêu cầu, bác sĩ duyệt trên web. API cho cả võ sĩ gửi yêu cầu; nút cho võ sĩ trên điện thoại làm ở T-048 |
| Lưu yêu cầu | Bảng riêng `suspension_exam_requests` (giữ lịch sử khi bị từ chối rồi yêu cầu lại), migration 033 |

## Luồng nghiệp vụ đề xuất

Sau buổi review, đoạn này thay mục "Kết thúc đình chỉ cần xác nhận" và bảng quyền ở mục 2 của [FIGHT-CAMP-BUSINESS-FLOWS.md](../FIGHT-CAMP-BUSINESS-FLOWS.md). **Chưa sửa file nghiệp vụ.**

```
Đình chỉ MEDICAL/OTHER đang chạy (hoặc đang chờ xác nhận)
  → HLV được phân hoặc chính võ sĩ bấm "Yêu cầu khám để kết thúc sớm", ghi lý do (tùy chọn)
  → Yêu cầu ở trạng thái Chờ khám; bác sĩ được phân cho võ sĩ nhận thông báo
  → Bác sĩ khám ngoài app, rồi vào app:
       Đồng ý: ghi kết quả khám (bắt buộc) → đình chỉ kết thúc ngay hôm nay
       Từ chối: ghi kết quả khám (bắt buộc) → đình chỉ giữ nguyên, có thể yêu cầu lại sau
  → HLV và võ sĩ nhận thông báo kết quả
Người yêu cầu hoặc HLV huỷ được yêu cầu khi còn Chờ khám.
```

Quy tắc:

1. Chỉ đình chỉ lý do `MEDICAL` hoặc `OTHER`, trạng thái `ACTIVE` hoặc `AWAITING_CLEARANCE`, chưa xác nhận, chưa xoá.
2. Võ sĩ phải có **ít nhất một bác sĩ được phân** (`doctor_fighters`). Không có bác sĩ thì không yêu cầu được; đình chỉ chạy hết hạn như cũ. (Khác với xác nhận sau KO: chỗ đó HLV làm thay được khi không có bác sĩ; kết thúc **sớm** thì bắt buộc bác sĩ.)
3. Mỗi đình chỉ có tối đa **một** yêu cầu đang Chờ khám.
4. Chỉ bác sĩ được phân cho võ sĩ mới đồng ý hoặc từ chối. HLV không tự kết thúc sớm.
5. Đồng ý: trong cùng một giao dịch, yêu cầu thành `APPROVED`; đình chỉ được ghi `cleared_at` = lúc đồng ý, `cleared_by` = bác sĩ, `clearance_note` = kết quả khám. Đình chỉ chuyển `ENDED` ngay. `MEDICAL`/`OTHER` không có lộ trình tập lại theo bậc, nên tập được mọi bậc.
6. Các buổi "Chờ xếp lại" do đình chỉ này **không tự quay lại** lịch; HLV xếp lại như hiện nay (Cổng 2 ở ngày mới).
7. Đình chỉ hết hạn tự nhiên hoặc bị xác nhận bằng đường khác trong lúc còn yêu cầu Chờ khám: yêu cầu tự thành `CANCELLED` khi có người đọc hoặc khi bác sĩ bấm (không cần job chạy nền).
8. Mọi bước ghi nhật ký kiểm toán như các thao tác đình chỉ khác.

## Thiết kế kỹ thuật đề xuất

**Migration 033** (`nestjs-api/migrations/033_suspension_exam_requests.sql`, theo mẫu 025 và 032: preflight, ledger, manifest checksum):

- Enum `suspension_exam_request_status`: `PENDING`, `APPROVED`, `REJECTED`, `CANCELLED`.
- Bảng `suspension_exam_requests`: `id`, `suspension_id` (FK `suspensions`), `fighter_id` (FK `fighters`), `requested_by_id` (FK `users`), `request_note` (≤ 500, có thể null), `status`, `decided_by_id` (FK `users`, null khi chưa quyết), `decided_at`, `exam_note` (3–500 khi `APPROVED`/`REJECTED`), `created_at`, `updated_at`, RLS bật như bảng `suspensions`.
- Index duy nhất một phần: `(suspension_id) WHERE status = 'PENDING'` (quy tắc 3 ở tầng database).
- Quyền mới: `suspension:exam_request` (FIGHTER, COACH), `suspension:exam_decide` (DOCTOR).
- Loại thông báo mới: `SUSPENSION_EXAM_REQUESTED` (tới bác sĩ được phân), `SUSPENSION_EXAM_DECIDED` (tới HLV được phân và võ sĩ).

**API** (module `suspensions`, kiểm quyền bằng `isCoachAssignedToFighter`, `isDoctorAssignedToFighter` có sẵn trong `suspensions.repo.ts`):

| Endpoint | Ai | Việc |
| --- | --- | --- |
| `POST /suspensions/:id/exam-requests` | võ sĩ (của mình), HLV được phân | Tạo yêu cầu |
| `GET /suspension-exam-requests?status=PENDING` | bác sĩ (võ sĩ được phân), HLV (võ sĩ được phân) | Hàng chờ |
| `POST /suspension-exam-requests/:id/approve` | bác sĩ được phân | Đồng ý, kết thúc đình chỉ |
| `POST /suspension-exam-requests/:id/reject` | bác sĩ được phân | Từ chối |
| `POST /suspension-exam-requests/:id/cancel` | người yêu cầu, HLV được phân | Huỷ |

Phản hồi đình chỉ (`toSuspensionResponse`) thêm `pendingExamRequest: { id, requestedAt, requestedById } | null` để frontend hiện trạng thái mà không gọi thêm API.

**Mã lỗi mới (cần chủ dự án duyệt ở buổi review):**

| Mã | HTTP | Khi nào |
| --- | --- | --- |
| `SUSPENSION_EXAM_NOT_ELIGIBLE` | 409 | Lý do không phải `MEDICAL`/`OTHER`, hoặc trạng thái không phải `ACTIVE`/`AWAITING_CLEARANCE`; `details: { reason, status }` |
| `SUSPENSION_NO_ASSIGNED_DOCTOR` | 409 | Võ sĩ không có bác sĩ được phân |
| `SUSPENSION_EXAM_REQUEST_PENDING` | 409 | Đã có yêu cầu Chờ khám |
| `SUSPENSION_EXAM_REQUEST_NOT_FOUND` | 404 | Không thấy yêu cầu |
| `SUSPENSION_EXAM_REQUEST_CLOSED` | 409 | Yêu cầu không còn `PENDING` (đã quyết, đã huỷ, hoặc đình chỉ đã kết thúc) |

**Frontend (web):**

- HLV, màn Đình chỉ (`coach/bouts/suspensions/page.tsx`): dòng `MEDICAL`/`OTHER` đang chạy có nút "Yêu cầu khám để kết thúc sớm"; có yêu cầu thì hiện nhãn "Chờ bác sĩ khám" và nút huỷ. Võ sĩ chưa có bác sĩ: nút tắt, dòng giải thích.
- Bác sĩ: trang mới `/doctor/suspension-exams` (thêm vào `routes.doctor`), danh sách yêu cầu Chờ khám; mỗi dòng có Đồng ý / Từ chối, hộp thoại bắt buộc ghi kết quả khám. Thẻ đếm trên `/doctor/dashboard`.
- Demo mode: dữ liệu mẫu có một đình chỉ `MEDICAL` đang chạy của một võ sĩ có bác sĩ được phân.
- i18n `vi` và `en`.

## Ngoài phạm vi

- Kết thúc sớm đình chỉ `KO`, `TKO`, `DQ`, `MANDATORY_REST`.
- Đặt lịch khám, đính kèm giấy tờ, ảnh kết quả.
- Nút yêu cầu cho võ sĩ trên điện thoại (T-048).
- Rút ngắn số ngày đình chỉ (chỉ có kết thúc hẳn).

## Ca kiểm thử (đề xuất, chốt lại sau review)

Hôm nay = 2026-11-05 (UTC+7) trừ khi ghi khác. Võ sĩ F có HLV C và bác sĩ D được phân; bác sĩ D2 không được phân.

| Ca | Đầu vào | Hành động | Kết quả mong đợi | Lớp |
| --- | --- | --- | --- | --- |
| E1 | `MEDICAL` 2026-11-01, 14 ngày, `ACTIVE` | C yêu cầu khám | 201, yêu cầu `PENDING`; D nhận `SUSPENSION_EXAM_REQUESTED` | service |
| E2 | như E1 | F (võ sĩ) yêu cầu | 201 | service |
| E3 | `KO` 2026-11-01, 30 ngày | C yêu cầu | 409 `SUSPENSION_EXAM_NOT_ELIGIBLE`, `details.reason = 'KO'` | service |
| E4 | `MANDATORY_REST` 7 ngày | C yêu cầu | 409 `SUSPENSION_EXAM_NOT_ELIGIBLE` | service |
| E5 | `MEDICAL` đã hết (`ENDED`) | C yêu cầu | 409 `SUSPENSION_EXAM_NOT_ELIGIBLE`, `details.status = 'ENDED'` | service |
| E6 | như E1, F không có bác sĩ được phân | C yêu cầu | 409 `SUSPENSION_NO_ASSIGNED_DOCTOR` | service |
| E7 | như E1, đã có yêu cầu `PENDING` | C yêu cầu lần 2 | 409 `SUSPENSION_EXAM_REQUEST_PENDING` | service + `test:db` (index duy nhất) |
| E8 | yêu cầu `PENDING` của E1 | D đồng ý, ghi "Khám ổn, hết đau" | 200; yêu cầu `APPROVED`; đình chỉ `cleared_at` có giá trị, `cleared_by = D`, `status = 'ENDED'`; C và F nhận `SUSPENSION_EXAM_DECIDED` | service |
| E9 | như E8 | buổi `SPARRING` của F xếp ngày 2026-11-06 | Cổng 2 cho qua (trước khi đồng ý thì 409) | service training |
| E10 | yêu cầu `PENDING` | D2 (không được phân) đồng ý | 403; đình chỉ không đổi | service |
| E11 | yêu cầu `PENDING` | C (HLV) đồng ý | 403 | service |
| E12 | yêu cầu `PENDING` | D từ chối, ghi "Còn chóng mặt" | 200; yêu cầu `REJECTED`; đình chỉ vẫn `ACTIVE`; C yêu cầu lại được (201) | service |
| E13 | yêu cầu `APPROVED` | D đồng ý lần 2 | 409 `SUSPENSION_EXAM_REQUEST_CLOSED` | service |
| E14 | yêu cầu `PENDING`, đình chỉ `MEDICAL` 3 ngày đã hết hạn (`ENDED`, không cần xác nhận) | D đồng ý | 409 `SUSPENSION_EXAM_REQUEST_CLOSED`; yêu cầu thành `CANCELLED` | service |
| E15 | đồng ý thất bại giữa giao dịch (ghi đình chỉ lỗi) | D đồng ý | yêu cầu vẫn `PENDING`, đình chỉ không đổi (không mock giao dịch tự khôi phục; chạy bằng `test:db` hoặc repo thật) | `test:db` |
| E16 | `POST /suspensions/:id/clear` trên đình chỉ `MEDICAL` đang `ACTIVE` | C gọi clear | vẫn 409 `SUSPENSION_NOT_AWAITING_CLEARANCE` (T-049): kết thúc sớm chỉ qua yêu cầu khám | service |
| E17 | Web HLV, demo | Mở màn Đình chỉ, dòng `MEDICAL` | Có nút "Yêu cầu khám để kết thúc sớm"; bấm xong hiện "Chờ bác sĩ khám" | vitest (render) + kiểm trình duyệt |
| E18 | Web bác sĩ, demo | `/doctor/suspension-exams`, đồng ý | Dòng biến mất; màn Đình chỉ của HLV hiện đình chỉ đã hết | vitest + kiểm trình duyệt |

## Việc cần chốt ở buổi review

1. Duyệt luồng nghiệp vụ trên và cho sửa FIGHT-CAMP-BUSINESS-FLOWS.
2. Duyệt migration 033 (bảng, enum, 2 quyền, 2 loại thông báo). Dan áp lên Supabase.
3. Duyệt 5 mã lỗi mới.
4. `OTHER` không cần xác nhận (`requiresClearance = false`) có cho kết thúc sớm không, hay chỉ `OTHER` cần xác nhận.
5. ADMIN có được xem hàng chờ khám không (hiện đề xuất: không).
6. Thứ tự làm: T-049 trước, T-050 sau (T-050 dựa vào việc `clear` không còn cho kết thúc sớm).
