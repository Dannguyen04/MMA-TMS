# T-045 · Chặn theo cường độ và tập lại theo bậc sau đình chỉ chấn thương đầu

| | |
| --- | --- |
| **Trạng thái** | Phần A: READY (29/10), làm sau khi [T-036](./T-036-suspension-plan-link.md) phần A xong. Phần B: DRAFT |
| **Phần** | A: backend (`nestjs-api`), **không migration**. B: frontend |
| **Người nhận** | A: Ken (qua `agy`). B: Hoàng Anh |
| **Nhánh** | A: `feat/T-045-graded-return`, tạo từ `feat/T-036-suspension-plan-link` |
| **Nguồn** | [Nhận xét review 27/10](../REVIEW-27-10-FEEDBACK.md) mục 1 ("chặn theo cường độ, tập lại theo bậc"); [T-036A mục 5](./T-036A-suspension-training-plan-link.md#5-phần-2-draft-chưa-code-gắn-đình-chỉ-vào-giáo-án) (L4, L5). Chủ dự án giao Claude nghiên cứu và tự quyết (29/10); tách khỏi T-036 vì lớn |
| **Lệnh kiểm tra** | `pnpm --filter nestjs-api lint`, `build`, `test` (không thêm lỗi so với [BASELINE](./BASELINE.md)) |

## 1. Căn cứ (Claude tra 29/10)

- **Đồng thuận Amsterdam 2022** về chấn động não trong thể thao (BJSM 2023): lộ trình trở lại 6 bước, **mỗi bước tối thiểu 24 giờ**; bước 1–3 là phục hồi (vận động nhẹ, aerobic, bài tập riêng của môn), bước 4–6 là trở lại (tập không va chạm, tập va chạm đầy đủ, thi đấu). Bước có va chạm chỉ bắt đầu khi đã hết triệu chứng và có bác sĩ cho phép. CDC hướng dẫn tương tự.
- **Hiệp hội Bác sĩ Võ đài (ARP)**: sau TKO do đòn vào đầu nghỉ thi đấu và **không sparring** tối thiểu 30 ngày; KO không mất ý thức 60 ngày; KO mất ý thức 90 ngày; tăng dần cường độ từ aerobic nhẹ đến bài riêng của võ, **sparring sau cùng**.
- **Hướng dẫn trở lại thi đấu của bang Victoria (Úc)**: vận động hạn chế → thể lực chung → tập không va chạm (bóng, đích, vật không đối kháng) → tập va chạm và thi đấu.

Ngoài lề: không tìm thấy quy trình riêng cho võ sĩ tách KO khỏi chấn động não; các nguồn trên viết cho chấn động não. App không thay thế quyết định của bác sĩ: bậc là **mức trần** app cho xếp lịch, không phải chỉ định y khoa.

## 2. Thiết kế (Claude quyết)

### 2.1 Bậc cường độ của loại buổi

Hằng mới `SESSION_INTENSITY_TIERS` trong `src/suspensions/suspensions.constants.ts` (cạnh `SESSION_TYPES`), kiểu `Record<SessionType, 1 | 2 | 3 | 4 | 5>`. Thêm loại buổi mới mà không gán bậc thì `build` lỗi (kiểu `Record` bắt buộc đủ khoá).

| Bậc | Ý nghĩa (theo Amsterdam / Victoria) | Loại buổi |
| --- | --- | --- |
| 1 | Hồi phục, vận động nhẹ | `RECOVERY`, `PHYSICAL_THERAPY` |
| 2 | Thể lực chung | `STRENGTH_CONDITIONING` |
| 3 | Kỹ thuật không va chạm | `SHADOW_BOXING`, `HEAVY_BAG`, `PAD_WORK` |
| 4 | Va chạm có kiểm soát | `GRAPPLING` |
| 5 | Đối kháng toàn phần | `SPARRING` |

### 2.2 Chặn theo cường độ khi tạo đình chỉ

- `POST /suspensions` nhận thêm trường tuỳ chọn `maxTier` (số nguyên 1–5). Có `maxTier` thì `blockedSessionTypes` lưu vào database = mọi loại có bậc **lớn hơn** `maxTier`. Gửi cả `maxTier` lẫn `blockedSessionTypes` thì lỗi validation có sẵn (`suspensionValidationError`). Không gửi cả hai thì giữ mặc định của T-035.
- Cột `blocked_session_types` vẫn là nguồn sự thật: **không migration**, Cổng 2 không đổi cách đọc.
- Response mỗi đình chỉ thêm `maxAllowedTier`: bậc cao nhất mà mọi loại ở bậc đó trở xuống đều không bị chặn (tính khi đọc, hàm thuần trong `suspensions.model.ts`).

### 2.3 Tập lại theo bậc sau đình chỉ chấn thương đầu

Áp cho đình chỉ có `reason` thuộc `KO`, `TKO`. Các lý do khác hết đình chỉ là tập được mọi loại như hiện nay.

- **Ngày bắt đầu lộ trình** `R`: đình chỉ cần xác nhận (`requiresClearance = true`) thì là ngày học viện (`academyDateOf`) của `clearedAt`; chưa xác nhận thì chưa có lộ trình (đình chỉ còn hiệu lực như hiện nay). Đình chỉ không cần xác nhận thì `R = endsOn + 1`.
- **Trần bậc theo ngày** (mỗi bước tối thiểu 24 giờ, theo Amsterdam): ngày `R` trần 3, ngày `R+1` trần 4, từ ngày `R+2` hết lộ trình. Bậc 1–2 không bị trần vì đình chỉ mặc định đã cho bậc 1 và lộ trình bắt đầu sau khi bác sĩ hoặc HLV xác nhận.
- Hàm thuần `gradedReturnCeiling(suspension, date): 3 | 4 | null` trong `suspensions.model.ts` (`null` = không giới hạn). Lộ trình **tính khi đọc**, không lưu.
- `SuspensionGate.blockingSuspensions` (`src/suspensions/suspension.gate.ts`) trả thêm đình chỉ KO/TKO đang trong lộ trình nếu bậc của `sessionType` lớn hơn trần ngày đó. Phần tử trả về mang thêm `gradedReturn: { ceiling, fullReturnOn }` (thêm trường, không đổi trường cũ). Mã lỗi giữ nguyên 409 `TRAINING_SUSPENSION_ACTIVE` qua `trainingSuspensionActive` (`src/training/training.error.ts:164`); **không mã lỗi mới**.
- Danh sách đình chỉ và trạng thái võ sĩ (S3, R32) trả thêm `gradedReturn` cho đình chỉ đang trong lộ trình, để màn hiện "Tập lại bậc 3/5, tập đầy đủ từ ngày …". Bảng sẵn sàng R32 coi võ sĩ trong lộ trình là **chưa sẵn sàng** cho tới `fullReturnOn`.
- Lùi bậc khi có triệu chứng (Amsterdam: quay lại bước trước) **không làm** trong ticket này: cần lưu dữ liệu mới. HLV tạo đình chỉ thủ công nếu cần dừng lại.

## 3. Ngoài phạm vi

- Lưu tiến độ từng bước, xác nhận từng bước, lùi bậc (cần migration). Ghi là việc sau nếu thầy hoặc nhóm yêu cầu.
- Đổi `default_blocked_session_types` của ruleset có sẵn.
- Frontend: Phần B.

## 4. Tiêu chí nghiệm thu (Phần A)

1. `SESSION_INTENSITY_TIERS` đúng bảng 2.1; test kiểm đủ 8 loại.
2. `POST /suspensions` với `maxTier: 3` lưu `blockedSessionTypes = ['SPARRING', 'GRAPPLING']` (thứ tự theo `SESSION_TYPES`; sửa 29/10, bản đầu ghi ngược thứ tự); gửi kèm `blockedSessionTypes` thì lỗi validation.
3. `maxAllowedTier`: mặc định T-035 → 1; chỉ chặn `SPARRING` → 4.
4. Đình chỉ `KO` 60 ngày, xác nhận ngày D: ngày D xếp `PAD_WORK` được, `GRAPPLING` 409; ngày D+1 `GRAPPLING` được, `SPARRING` 409; ngày D+2 `SPARRING` được. Lỗi 409 có `gradedReturn.ceiling` và `fullReturnOn = D+2`.
5. Đình chỉ `MANDATORY_REST` hết ngày E: ngày E+1 `SPARRING` được (không có lộ trình).
6. Đình chỉ `KO` chưa xác nhận: vẫn chặn như hiện nay, không có `gradedReturn`.
7. Bảng sẵn sàng: võ sĩ đang ở ngày D+1 của lộ trình là "Chưa sẵn sàng", có `fullReturnOn`.
8. Không migration, không mã lỗi mới, không thư viện mới; không lệnh nào thêm lỗi so với baseline.

## 5. Phần B (frontend, DRAFT)

Form đình chỉ: chọn "Mức tối đa được tập" (bậc 1–5, có mô tả) thay vì tick từng loại, vẫn cho tick chi tiết; tab Đình chỉ và trang võ sĩ hiện lộ trình tập lại theo bậc (thanh 3 bước, ngày tập đầy đủ). Viết chi tiết khi Phần A có contract.

## Nguồn

- [Amsterdam 2022 consensus, BJSM](https://orbi.uliege.be/bitstream/2268/327382/1/bjsports-2024-109188.full.pdf)
- [CDC HEADS UP: Returning to Sports](https://www.cdc.gov/heads-up/guidelines/returning-to-sports.html)
- [ARP position on suspensions and concussion management](https://mixedmartialarts.com/news/arp-issues-official-position-on-suspensions-and-concussion-management2a8b75a6-6eb2-4089-bd62-71f7b3a9a7df/)
- [Victoria: Non-fight periods and return to fight strategy](https://djsir.vic.gov.au/combat-sports/contestant-safety/non-fight-periods-and-return-to-fight-strategy)
