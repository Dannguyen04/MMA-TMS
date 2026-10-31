# T-009 · Kế hoạch ăn theo giai đoạn và câu hỏi "Hôm qua ăn theo kế hoạch?" (migration 026)

| | |
| --- | --- |
| **Trạng thái** | READY (30/10). Nằm trong danh sách cắt của Sprint 2 (chấm màu ăn uống, mục 4 của thứ tự cắt): nếu đến 5/11 phần A chưa merge thì bỏ phần B3 |
| **Người nhận** | A (backend, migration): Ken. B1 (HLV nhập kế hoạch): Hoàng Anh. B2 (võ sĩ trên điện thoại): Fon. B3 (chấm màu trên biểu đồ cân): Hoàng Anh |
| **Nhánh** | A: `feat/T-009-nutrition-backend`. B: `feat/T-009-nutrition-ui`, sau khi A merge. Tạo từ `fight-camp` |
| **Nguồn** | [Luồng nghiệp vụ E1](../FIGHT-CAMP-BUSINESS-FLOWS.md#e1-ăn-uống-đi-cùng-kiểm-soát-cân), [Tech spec §2.7](../FIGHT-CAMP-TECH-SPEC.md#27-kế-hoạch-ăn-và-câu-trả-lời-ăn-uống-migration-026), bảng API và bảng quyền trong Tech spec |
| **Migration** | 026. Số 026 còn trống: ledger trên Supabase ngày 30/10 là 3–21, 23–25, 27–32 |

## 1. Giới hạn an toàn (bắt buộc, theo E1)

App **không** tính hay đề xuất chế độ ăn, calo, lượng nước, xông hơi. App chỉ lưu chữ do HLV hoặc chuyên gia nhập, và lưu câu trả lời của võ sĩ. Không có ô theo dõi lượng nước uống. Dữ liệu sức khoẻ: chỉ dùng dữ liệu giả ([quyết định 9](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi)).

## 2. Phần A · Backend (Ken)

### A1. Migration `026_bout_nutrition.sql`

Đúng như Tech spec §2.7:
- Cột `bouts.nutrition_plan jsonb NOT NULL DEFAULT '{}'`.
- Enum `nutrition_adherence ('ON_PLAN','SLIGHTLY_OFF','WAY_OFF')`.
- Bảng `bout_nutrition_checkins` với `UNIQUE (bout_id, academy_date)` và `note` ≤ 200 ký tự.
- Quyền mới `bout:nutrition_checkin` cho FIGHTER, COACH, ADMIN (không cho DOCTOR), theo bảng quyền của Tech spec.

Theo khuôn của `025_suspensions.sql`:
- Preflight chỉ đòi ledger 024 (giống 032).
- Advisory lock `(20260916, 26)`, ghi `migration_history` version 26.
- Quyền thêm bằng `INSERT INTO public.permissions(...)` và `public.role_permissions` như dòng 88–96 của 025.
- RLS và audit như bảng `suspensions`.
- Checksum trong `manifest.json`, tên trong `scripts/migration-files.mjs`, script `db:migrate:026` trong `package.json`, mục mô tả trong `migrations/README.md`.
- `fighter_id` phải bằng `bouts.fighter_id`: kiểm trong service, thêm trigger nếu làm được theo khuôn của 024.

### A2. API

| Method | Đường dẫn | Quyền | Việc |
| --- | --- | --- | --- |
| PUT | `/bouts/:id/nutrition-plan` | `bout:update` | Ghi cả khối `{ camp?, fightWeek?, postWeighIn? }`, mỗi ô `{ text 1–2000, author 1–100 }`. Server tự gắn `updatedAt` và `updatedById`. Trận `COMPLETED` hoặc `CANCELLED` thì 409 `BOUT_INVALID_TRANSITION` |
| PUT | `/bouts/:id/nutrition-checkins/:date` | `bout:nutrition_checkin` | Body `{ adherence, note? }`. `date` không được sau hôm nay theo ngày học viện (UTC+7), không thì 422. Ghi lại cùng ngày thì cập nhật dòng cũ. Võ sĩ chỉ ghi trận của mình |
| GET | `/bouts/:id` | (như cũ) | Thêm `nutritionPlan` và `currentNutritionPhase` (`camp`, `fightWeek`, `postWeighIn` hoặc `null`, theo bảng trong §2.7) |
| GET | `/bouts/:id/weight-track` | (như cũ) | Thêm `nutrition: [{ date, adherence }]` |

Phạm vi theo bản ghi như `goals.service.ts`: võ sĩ chỉ trận của mình, HLV chỉ võ sĩ được phân công.
> **Sửa 31/10 (Claude):** `fight-camp` không có module `goals`. Phần A dùng khuôn `assertReadAccess`/`assertWriteAccess` của `bouts.service.ts`, nên người ngoài phạm vi nhận 403. Ngày trả lời sau hôm nay trả 422 `VALIDATION_ERROR`, dùng `.refine` theo khuôn `medical.model.ts:64`. Xem [T-009-REVIEW](./T-009-REVIEW.md).

### A3. Ca kiểm thử (unit test của service và model, cộng ca trong `scripts/test-migrations.mjs`)

| Ca | Kết quả mong đợi |
| --- | --- |
| N1 | Migration 026 áp được trên ledger chỉ có 024 (không có 025–032); áp lại lần hai thì bị từ chối, không đổi ledger |
| N2 | Trả lời 2 lần cùng `date` thì còn 1 dòng, là câu trả lời mới |
| N3 | `date` = ngày mai theo giờ học viện thì 422. Lúc 23:30 UTC ngày D, "hôm nay" là D+1 |
| N4 | Võ sĩ A ghi vào trận của võ sĩ B thì 403 hoặc 404 theo quy ước của module |
| N5 | DOCTOR gọi checkin thì 403 |
| N6 | `currentNutritionPhase` đúng cho cả 6 trạng thái trận |
| N7 | Ghi kế hoạch cho trận `COMPLETED` thì 409 |
| N8 | `text` 2001 ký tự, hoặc `note` 201 ký tự, thì 422 |
| N9 | Ghi số cân không kèm câu trả lời vẫn chạy như cũ (endpoint ghi cân không đổi) |

## 3. Phần B · Frontend (sau khi A merge)

- **B1. HLV (Hoàng Anh):** trên trang chi tiết trận `coach/bouts/[boutId]`, thêm khối "Kế hoạch ăn" có 3 ô (Trong camp, Tuần thi đấu, Từ lúc cân đến giờ thi). Mỗi ô có người soạn và ngày sửa. Ô của giai đoạn hiện tại được làm nổi.
- **B2. Võ sĩ (Fon):**
  - Trang `fighter/bout` hiện ô kế hoạch của `currentNutritionPhase`.
  - Màn `fighter/bout/weigh-in`: sau khi lưu số cân (`recordSelfWeightAction`, `lib/actions/weigh-in.ts:20`, gọi `recordSelfWeight` trong `lib/services/people.ts:410`), hỏi thêm một câu tùy chọn "Hôm qua ăn theo kế hoạch?" với 3 nút và ô ghi chú. Có nút "Bỏ qua".
  - Câu trả lời đi qua một action riêng, không gộp vào action ghi cân, để lỗi của câu hỏi không làm mất số cân đã lưu.
- **B3. Biểu đồ cân (Hoàng Anh):**
  - Mỗi điểm cân có chấm màu theo `adherence`.
  - Khi cảnh báo cân chuyển vàng hoặc đỏ, thẻ cảnh báo có thêm dòng "3 ngày gần nhất: {n} ngày lệch nhiều".
  - Màu không phải cách duy nhất để phân biệt: có chú thích và nhãn cho trình đọc màn hình.
- Demo mode: thêm dữ liệu mẫu kế hoạch và câu trả lời cho các trận demo đang ở `CAMP` và `FIGHT_WEEK`.

Tiêu chí phần B (theo E1):
1. Bỏ qua câu hỏi thì số cân vẫn được lưu.
2. Trận `FIGHT_WEEK` thì trang võ sĩ hiện ô "Tuần thi đấu".
3. Không màn hình nào hiện calo, lượng nước hay thời gian xông hơi.
4. Ghi cân kèm trả lời xong trong khoảng 30 giây trên điện thoại (bấm giờ khi tổng duyệt 9/11).
5. Ở 390 px không cuộn ngang. Có đủ `vi` và `en`.

## 4. Ngoài phạm vi

Nhật ký bữa ăn, chụp ảnh bữa ăn, tính calo, gợi ý chế độ ăn, thông báo nhắc trả lời.

## 5. Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nestjs-api lint
pnpm --filter nestjs-api build
pnpm --filter nestjs-api test
pnpm --filter nestjs-api test:db
pnpm --filter nestjs-api db:check
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```

Không thêm lỗi so với baseline ngày 30/10 (ghi trong [T-040](./T-040-real-backend-demo.md) mục 5). Chủ dự án áp migration 026 lên Supabase sau khi phần A APPROVED.
