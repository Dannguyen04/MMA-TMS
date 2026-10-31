# T-048 · Võ sĩ xem đình chỉ, mức được tập và buổi "Chờ xếp lại" (điện thoại)

| | |
| --- | --- |
| **Trạng thái** | READY (30/10), bắt đầu khi T-030 B đã merge vào `fight-camp` |
| **Người nhận** | Fon |
| **Nhánh** | `feat/T-048-fighter-suspension-view`, tạo từ `fight-camp` sau khi T-030 B merge |
| **Nguồn** | Phần còn lại của [T-036](./T-036-suspension-plan-link.md) B ("lịch HLV **và võ sĩ**"), [T-045](./T-045-intensity-tiers-graded-return.md) B ("trang võ sĩ hiện lộ trình tập lại"), T-007 C ("võ sĩ xem trạng thái đình chỉ"). Phía HLV đã làm ở [T-030](./T-030-frontend-suspensions-sync.md) B; T-030 B ghi màn của võ sĩ là ngoài phạm vi |
| **Phụ thuộc** | T-030 B (service `suspensions`, các component dùng chung). Migration 032 đã áp 30/10 |

## 1. Bối cảnh

Sau T-036 A, một đình chỉ mới có thể làm buổi tập của võ sĩ chuyển sang `PENDING` (frontend: `pending`, "Chờ xếp lại") hoặc bị huỷ. Sau T-045 A, đình chỉ có `maxAllowedTier` (bậc 0–5) và có thể có `gradedReturn` (`{ ceiling: 3|4, fullReturnOn }`). Phía HLV đã có giao diện cho cả hai (T-030 B). Phía võ sĩ chưa có gì:

- `nextjs-frontend/src/app/(app)/fighter/training/page.tsx:50`: danh sách sắp tới chỉ lấy `scheduled` và `in_progress`, nên buổi `pending` **biến mất**. Võ sĩ không biết buổi đó còn hay đã bị huỷ.
- `nextjs-frontend/src/app/(app)/fighter/dashboard/page.tsx:151-154`: `weekPlanned` đếm cả buổi `pending` (chỉ loại `cancelled`), nhưng `weekToGo` không đếm. Tổng tuần không khớp với các ô con.
- Không màn nào trong `fighter/` hiện đình chỉ: `git grep -n -i suspension` trong `src/app/(app)/fighter` trên nhánh T-030 B trả 0 dòng.

Có sẵn trên nhánh T-030 B, dùng lại, không viết mới:

- `lib/services/suspensions.ts` `listSuspensions` (dòng 209). Bản demo `suspensions.demo.ts:62` đã giới hạn: võ sĩ chỉ thấy đình chỉ của mình, hỏi `fighterId` khác thì 403. Backend cũng vậy (`GET /suspensions`, võ sĩ chỉ thấy của mình).
- `components/domain/intensity-ladder.tsx` `IntensityLadder` (chỉ xem, không truyền `interactive`), `components/domain/graded-return-steps.tsx` `GradedReturnSteps`, `components/domain/status-badges.tsx` `SuspensionStatusBadge` và badge `pending` của `SessionStatusBadge`.
- Bậc cường độ: `lib/domain/intensity-tiers.ts`.

## 2. Phạm vi

| File | Việc |
| --- | --- |
| `src/app/(app)/fighter/training/page.tsx` | Danh sách sắp tới có thêm buổi `pending`, kèm badge "Chờ xếp lại" và một dòng "HLV sẽ xếp lại buổi này" |
| `src/app/(app)/fighter/dashboard/page.tsx` | Tổng tuần: `pending` thành một ô riêng "Chờ xếp lại", không tính vào "đã lên kế hoạch" hay "còn phải tập". Thêm thẻ đình chỉ khi có đình chỉ đang hiệu lực (mục 2.1) |
| `src/app/(app)/fighter/health/page.tsx` | Mục "Đình chỉ" trong tab Tình trạng (mục 2.1), đặt sau khối Cấp phép y tế |
| Từ điển `vi`, `en` của các màn võ sĩ | Câu mới. Dùng lại khoá `suspension.reason.*` của T-030 B |
| Test cùng thư mục | Ca ở mục 4 |

### 2.1 Thẻ đình chỉ (chỉ xem, không có nút sửa)

Lấy `listSuspensions({ active: true }, actor)`. Không có đình chỉ thì không hiện gì. Có thì hiện, theo thứ tự:

1. **Câu chính**, một trong ba câu:
   - "Đang đình chỉ đến {ngày}" (có `endsOn`, chưa qua).
   - "Chờ bác sĩ xác nhận được tập lại" (cần xác nhận, đã qua `endsOn`).
   - "Đang tập lại theo bậc, tập đầy đủ từ {fullReturnOn}" (có `gradedReturn`).
2. Lý do: nhãn `suspension.reason.*`, không hiện mã thô.
3. `IntensityLadder` với `maxAllowedTier`, cùng câu "Được tập: {các loại bậc ≤ mức}" (ví dụ "Được tập: hồi phục, vật lý trị liệu").
4. `GradedReturnSteps` khi có `gradedReturn`.

Có nhiều đình chỉ cùng lúc thì chọn theo cùng quy tắc với câu lỗi 409 của T-030 B1: đình chỉ không có `gradedReturn` trước, sau đó `endsOn` muộn nhất. Hiện thêm "và {n} đình chỉ khác".

## 3. Ngoài phạm vi

- Võ sĩ tự xếp lại hoặc huỷ buổi (chỉ HLV làm).
- Thông báo đẩy khi có đình chỉ (backend chưa gửi).
- Màn của HLV và bác sĩ.
- Viết component mới thay cho các component của T-030 B.

## 4. Tiêu chí nghiệm thu và ca kiểm thử

Demo mode, đăng nhập là võ sĩ có đình chỉ trong dữ liệu mẫu của T-030 B (ví dụ Tariq Haddad: `MANDATORY_REST`, 3 buổi `pending`).

| Ca | Đầu vào | Kết quả mong đợi |
| --- | --- | --- |
| F1 | Võ sĩ có 3 buổi `pending` trong 7 ngày tới | `fighter/training` hiện cả 3, có badge "Chờ xếp lại"; không có nút bắt đầu |
| F2 | Như F1 | Dashboard: ô "Chờ xếp lại" = 3; tổng các ô con bằng số buổi không bị huỷ trong tuần |
| F3 | Đình chỉ `MANDATORY_REST` còn hiệu lực, `maxAllowedTier = 1` | Thẻ có "Đang đình chỉ đến {ngày theo `formatShortDate`}", nhãn "Nghỉ bắt buộc", thang 5 bậc với 1 bậc được tập |
| F4 | Đình chỉ `KO` có `gradedReturn: { ceiling: 3, fullReturnOn }` | Câu "Đang tập lại theo bậc…", có `GradedReturnSteps` |
| F5 | Đình chỉ cần xác nhận, đã qua `endsOn`, chưa xác nhận | Câu "Chờ bác sĩ xác nhận được tập lại" |
| F6 | Võ sĩ không có đình chỉ đang hiệu lực | Không có thẻ nào; dashboard không đổi so với trước |
| F7 | Hai đình chỉ: `KO` có `gradedReturn` và `OTHER` không có | Thẻ là của `OTHER`, kèm "và 1 đình chỉ khác" |
| F8 | Locale `vi` | Không còn chữ tiếng Anh, mã lý do thô hay ngày dạng `YYYY-MM-DD` trên thẻ |
| F9 | 390 px | Không cuộn ngang; thẻ đình chỉ nằm trong màn hình đầu của dashboard, trước các thẻ thống kê |

Ca phụ thuộc ngày phải cố định thời gian, hoặc chọn dữ liệu theo đặc điểm cần thử thay vì theo thứ tự (xem lỗi B5-15, B5-16 trong [T-030-REVIEW](./T-030-REVIEW.md) trên nhánh T-030).

## 5. Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```

Không thêm lỗi so với `fight-camp` lúc tạo nhánh. Chụp `fighter/dashboard`, `fighter/training`, `fighter/health` ở 390 px và 1440 px, `vi` và `en`, đưa vào handover.
