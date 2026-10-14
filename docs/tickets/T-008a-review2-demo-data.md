# T-008a · Dữ liệu demo cho review 2 và chạy frontend với backend thật

| | |
| --- | --- |
| **Trạng thái** | READY. Phần A viết được ngay; chạy thật cần T-002, T-003 đã merge và migration 023, 024 đã áp lên Supabase |
| **Phần** | A: script dữ liệu demo (backend). B: đối chiếu frontend ở API mode |
| **Người nhận (đề xuất)** | A: BE2. B: FE |
| **Nhánh** | A: `feat/T-008a-demo-seed`. B: `fix/T-008a-api-mode` (chỉ khi cần sửa adapter). Tạo từ `fight-camp` |
| **Hạn** | Script chạy xong trên Supabase trước tối **19/10**; review 2 ngày **20/10** |
| **Ước lượng** | A: 1 ngày. B: 0,5–1 ngày (tuỳ số chỗ lệch) |
| **Tài liệu dẫn chiếu** | [Phạm vi – Kế hoạch](../SCOPE-FIGHT-CAMP.md#kế-hoạch-triển-khai) (kịch bản demo review 2), [quyết định 9, 14](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi), [T-002](./T-002-no-doctor-mode.md), [T-003](./T-003-bouts-core.md), [T-004](./T-004-coach-bouts-ui.md), [T-005](./T-005-weigh-in-and-weight-chart.md) |

## Bối cảnh

Review 2 demo phần trước trận **với backend thật trên Supabase hiện có** (quyết định 14). Kịch bản trình diễn trực tiếp: HLV tạo trận → võ sĩ ghi cân → cân chuyển đỏ → HLV thêm mục hồ sơ → Cổng 1 chặn vì thiếu hồ sơ → đủ hồ sơ thì vào tuần thi đấu. Cần dữ liệu dựng sẵn để kịch bản chạy được và danh sách trận không trống.

Ràng buộc:

- **Chỉ dữ liệu giả** (quyết định 9): tên giả, email `@example.com`, không có giấy tờ y tế thật.
- **Không ghi thẳng vào database.** Mọi dữ liệu đi qua API của backend, nên đi qua đúng quyền, kiểm tra và audit.
- **Không ai ngoài chủ dự án áp migration** lên Supabase. Script này không chạy migration.
- Script ghi vào Supabase thật. **Chủ dự án chạy**, hoặc giao cho một người có `.env` của team. Người viết script kiểm tra bằng chế độ `--dry-run`.

## Phần A · Script dữ liệu demo (BE2)

Tạo `nestjs-api/scripts/seed-demo.mjs`: Node ESM, dùng `fetch` có sẵn, **không thêm thư viện**.

**Đầu vào** (biến môi trường, không đọc file `.env`): `SEED_API_URL`, `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `SEED_ACCOUNT_PASSWORD` (mật khẩu chung cho các tài khoản demo), `SEED_DEMO_DATE` (mặc định `2026-10-20`, ngày diễn ra demo). Cờ `--dry-run`: in ra danh sách request sẽ gửi, không gọi mạng.

**Tách phần tính toán khỏi phần gọi mạng:** hàm thuần `buildDemoPlan(demoDate)` (trong cùng file hoặc `scripts/seed-demo-plan.mjs`) trả danh sách bước kèm payload và ngày giờ đã tính sẵn. Test bằng `scripts/seed-demo.test.mjs`, chạy với `node --test`.

**Các bước**, theo thứ tự, mọi ngày giờ theo `Asia/Ho_Chi_Minh` và tính từ `SEED_DEMO_DATE` (gọi là D):

1. Đăng nhập admin: `POST /auth/login`.
2. Chuyển chế độ không có bác sĩ: `PATCH /academy-settings` `{ medicalSupervision: "NONE", changeReason: "Demo environment: club has no doctor" }` (endpoint của T-002).
3. Tạo tài khoản bằng `POST /users` (body `{ user: { email, password, role, profile } }`, schema `createUserSchema` trong `src/users/users.model.ts`):
    - HLV `coach.demo@example.com`, "Demo Coach".
    - Võ sĩ F1 `fighter.live@example.com` (dùng cho phần trình diễn trực tiếp), F2 `fighter.red@example.com`, F3 `fighter.docs@example.com`. Ngày sinh để võ sĩ từ 18 tuổi trở lên; `weightClass` bắt buộc theo enum cũ, dùng `LIGHTWEIGHT`.
    - Tài khoản đã tồn tại (lỗi trùng email): không tạo lại. Đăng nhập bằng tài khoản đó và lấy id hồ sơ từ `GET /users/me`.
4. Phân công HLV cho cả ba võ sĩ: `POST /fighters/:id/coaches` `{ coachId }`. Đã có phân công thì bỏ qua.
5. Đăng nhập HLV. Tạo cho mỗi võ sĩ một training plan phase `fight_camp` bằng `POST /training-plans` (schema `createTrainingPlanSchema` trong `src/training/training.model.ts`), `startDate` = D − 21.
6. Số cân (đăng nhập từng võ sĩ, `POST /fighters/:id/measurements`, `measurementContext: "SELF_REPORTED"`, `measuredAt` lúc 07:00 mỗi ngày):
    - F1: từ D − 14 đến **D − 4**, giảm đều từ 68,5 xuống 67,2 kg. Không có số trong 3 ngày trước demo, nên trạng thái là **xám**; khi võ sĩ ghi 66,5 trên sân khấu, trạng thái chuyển **đỏ**.
    - F2: từ D − 14 đến D − 1, giảm đều từ 69,0 xuống 66,4 kg.
    - F3: từ D − 14 đến D − 1, giảm đều từ 66,0 xuống 65,0 kg.
7. Trận (HLV, `POST /bouts` của T-003), gắn plan bằng `POST /bouts/:id/camp`:
    - F2 · "LION Championship Demo": preset "MMA – VMMAF 2021", hạng 60 kg, cân D + 2 lúc 10:00, thi D + 3 lúc 19:00. Kết quả mong đợi vào ngày D: `CAMP`, cân **đỏ** (66,4 kg, còn 9,6% > 8%).
    - F3 · "Club Fight Night Demo": preset "Tự nhập", 63,5 kg, cân D + 5 lúc 09:00, thi D + 6 lúc 19:00. Ba mục hồ sơ do HLV thêm: "Health certificate" và "Blood test" ở `PROVIDED` (hạn D + 180), "Brain CT" ở `MISSING`. Kết quả mong đợi: `CAMP`, cân **xanh**, Cổng 1 **chặn** vì thiếu "Brain CT".
    - F1: **không** tạo trận. HLV tạo trực tiếp khi demo (preset MMA, 60 kg, cân D + 2), gắn plan có sẵn, rồi thêm mục hồ sơ.
    - Võ sĩ đã có trận đang chạy (409 `BOUT_ACTIVE_EXISTS`): bỏ qua và ghi vào kết quả.
8. In bảng kết quả: email từng tài khoản, vai trò, id hồ sơ, id trận, trạng thái cân và Cổng 1 đọc lại từ `GET /bouts/:id`. **Không** in mật khẩu hay token.

**Chạy lại được:** chạy lần hai không tạo thêm tài khoản, phân công hay trận. Số cân của các ngày đã có thì không ghi thêm (đọc `GET /fighters/:id/measurements` trước khi ghi).

**Hướng dẫn chạy:** thêm mục "Dữ liệu demo" vào `nestjs-api/README.md`, gồm lệnh chạy, biến môi trường, và tài khoản nào dùng cho bước nào của kịch bản.

## Phần B · Frontend ở API mode (FE)

Sau khi migration 023, 024 đã áp và script đã chạy:

1. Chạy backend bằng `.env` của team và frontend với `APP_DATA_MODE=api`.
2. Đi hết kịch bản review 2 bằng tài khoản HLV và F1, rồi mở danh sách và chi tiết trận của F2, F3.
3. Mọi chỗ lệch giữa adapter (`src/lib/services/bouts.ts`, `recordSelfWeight` của T-005) và response thật thì sửa trên nhánh `fix/T-008a-api-mode`, kèm test service.
4. Ghi vào handover: từng bước của kịch bản (qua hay lỗi), từng chỗ đã sửa, ảnh chụp màn hình ở bề rộng 390 px của trang ghi cân và trang trận của võ sĩ.

## Ngoài phạm vi

Dữ liệu cho kịch bản 3, 4 (đình chỉ, chế độ không có bác sĩ khi tập; làm ở T-008); áp migration; thêm endpoint backend; dữ liệu thật.

## Tiêu chí nghiệm thu

Phần A:

1. `node --test scripts/seed-demo.test.mjs` qua, gồm các ca: với D = 2026-10-20, F2 có số cuối 66,4 kg ngày 19/10, giờ cân của F2 là `2026-10-22T03:00:00.000Z`; số cân cuối của F1 là ngày 16/10; ba mục hồ sơ của F3 đúng trạng thái và hạn.
2. `node scripts/seed-demo.mjs --dry-run` in đủ các bước 1–8, không gọi mạng, không cần biến môi trường mật khẩu.
3. Chạy thật lần một trên Supabase (chủ dự án chạy): bảng kết quả có F2 `RED`, F3 `GREEN` và Cổng 1 thiếu "Brain CT", F1 không có trận; `GET /academy-settings` trả `NONE`.
4. Chạy lần hai: không có tài khoản, phân công, trận hay số cân mới; bảng kết quả giống lần một.

Phần B:

5. Kịch bản review 2 chạy hết ở API mode bằng tài khoản HLV và F1, không có lỗi trên giao diện hay trong console.
6. Thử Cổng 1 trên trận của F3: lỗi 409 liệt kê đúng "Brain CT".

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nestjs-api lint
node --test nestjs-api/scripts/seed-demo.test.mjs
node nestjs-api/scripts/seed-demo.mjs --dry-run
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```

Lệnh lint của backend chỉ áp dụng nếu cấu hình lint có quét thư mục `scripts/`; nếu không, ghi rõ vào handover.
