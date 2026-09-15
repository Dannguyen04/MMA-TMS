# Migration 003 — Backend & Database

## Áp dụng cho Supabase dev hiện tại

Trạng thái đầu vào đã được chủ dự án xác nhận: **001 và 002 đã chạy; 003 chưa chạy**. Chưa kết nối hoặc kiểm chứng trực tiếp database Supabase trong đợt sửa này.

**Điểm đang chờ chốt trước khi áp dụng:** bản hiện tại giữ nguyên quyền truy cập của `analysis_jobs` từ baseline. Bảng này vẫn chứa JSON `health_alerts`/`joint_states`; nếu Supabase đang cấp quyền đọc trực tiếp cho client thì policy trên các bảng y tế mới không bảo vệ phần JSON legacy. Đã đề xuất thu hồi quyền trực tiếp của `anon`/`authenticated` và giữ truy cập qua backend, nhưng chưa áp dụng thay đổi quyền này khi chưa nhận trả lời của chủ dự án.

1. Giữ một bản backup/snapshot của database dev trước khi nâng cấp.
2. Kiểm tra file tại thư mục `nestjs-api`:

   ```sh
   npm run db:check
   ```

   Lệnh này chỉ kiểm tra checksum file, không mở kết nối database.

3. Mở Supabase SQL Editor bằng tài khoản quản trị database, chạy **toàn bộ `003_mma_tms_complete_schema.sql` một lần**. Không chạy lại 001 hoặc 002. File đã có `BEGIN`/`COMMIT`; không chạy từng đoạn riêng lẻ.
4. Nếu có thông báo `Baseline ... drift`, object đã tồn tại hoặc lock timeout: giữ nguyên database, lưu thông báo lỗi để đối chiếu. Không bỏ qua preflight, không xóa bảng, không sửa 001–002 để vượt lỗi.
5. Kiểm tra sau khi chạy:

   ```sql
   SELECT version, name, source_sha256, applied_at
   FROM mma_private.migration_history WHERE version = 3;

   SELECT count(*) AS legacy_job_count FROM public.analysis_jobs;

   SELECT column_name, data_type, is_nullable
   FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'analysis_jobs'
   ORDER BY ordinal_position;

   SELECT tablename, policyname, roles, cmd
   FROM pg_policies WHERE schemaname = 'public'
   ORDER BY tablename, policyname;
   ```

`source_sha256` là NULL khi chạy bằng SQL Editor. Nếu dùng runner, checksum nguồn được ghi vào lịch sử migration.

### Runner tùy chọn

Sau khi cài dependencies và cung cấp `DATABASE_URL` qua môi trường an toàn:

```sh
npm run db:migrate:003
```

Runner chỉ chạy 003, kiểm tra checksum 001–003, bật xác minh chứng chỉ TLS cho kết nối remote, không tự đọc `.env`, không chứa thông tin đăng nhập trong source và không tự retry. Dùng direct connection hoặc session pooler của Supabase cho migration. Không đưa password vào câu lệnh được lưu trong shell history. Nếu cần CA riêng, cấu hình CA tin cậy cho Node; không tắt xác minh TLS.

`run_sql.mjs` trước đây có credential ghi trực tiếp trong source; phiên bản mới đã loại bỏ. Nếu credential cũ còn hiệu lực, chủ dự án cần thay credential đó vì sửa file hiện tại không loại bỏ nó khỏi lịch sử Git.

## Những thay đổi trong 003

| Phần | Thiết kế hiện tại |
| --- | --- |
| Baseline | Giữ nguyên 12 cột của `analysis_jobs`, enum `job_status`, 4 index và trigger cập nhật timestamp từ 001–002. Chỉ thêm 5 FK nullable và các ràng buộc cho liên kết mới. Không backfill JSON/score hoặc thay `user_id TEXT`. |
| Identity | `users.auth_user_id` unique, FK đến `auth.users.id`. Role `FIGHTER / COACH / DOCTOR / ADMIN`; profile và role phải khớp bằng composite FK. Email được lưu lowercase, trim và unique. Không lưu mật khẩu ứng dụng. |
| Phân công | `coach_fighters`, `doctor_fighters` lưu từng đợt với người giao/kết thúc và lý do. Một cặp chỉ có một đợt chưa kết thúc; đợt đã đóng không sửa/xóa. Không tự mở lại record cũ. |
| Kế hoạch tập | Bổ sung `training_plan_exercises`; session exercises giữ tên/hướng dẫn tại thời điểm giao bài. Session phải cùng Fighter với plan; có kiểm tra trạng thái và timestamp. |
| Hiệp và video | `session_rounds` thuộc buổi tập; `video_round_segments` giữ mốc milliseconds của hiệp trong từng video, có FK đảm bảo cùng session. |
| Upload/phân tích | Mỗi upload có video riêng; mỗi video tối đa một job liên kết và một `ai_analyses`. Analysis bắt buộc tham chiếu job cùng video. Upload tiếp theo tạo record mới, kể cả cùng buổi tập. |
| Kết quả | Liên kết Fighter/session/config nhất quán; summary khóa theo analysis để hai upload cùng session không ghi đè nhau. Review của coach lưu revision, giữ kết quả AI gốc. Không tạo pipeline xử lý mới. |
| Provenance | Không seed model/config/baseline. Config đã công bố hoặc được sử dụng không sửa tham số. Baseline có nguồn, người và thời điểm phê duyệt; baseline đã duyệt không sửa số liệu. |
| Y tế | Clearance, injury, treatment, recovery có FK, kiểm tra mốc thời gian và người phụ trách. Injury dẫn về source alert bằng một chiều FK; không tự suy ra chẩn đoán. |
| Số đo | Thêm `fighter_measurements` để lưu lịch sử thể trạng và đính chính, chi tiết bên dưới. |
| Audit | Ghi metadata thay đổi của identity/permission, phân công, y tế, config/baseline và coach review. Audit, lịch sử khớp, review và số đo có trigger chặn UPDATE/DELETE/TRUNCATE. |
| Vận hành | Transaction, advisory lock, lock timeout, preflight baseline, ledger riêng `mma_private`, checksum file và kiểm thử PostgreSQL cô lập. |

Database sau 001–003 có **35 bảng public, 26 enum public**, cộng bảng lịch sử migration trong `mma_private`. SQL là nguồn quản lý cấu trúc; `schema.ts` ánh xạ đầy đủ bảng/cột/default/check/FK/key/index cho Drizzle. `auth.users` chỉ là tham chiếu ngoài, không thuộc quyền quản lý của migration.

## Hồ sơ thể trạng phù hợp với dữ liệu MMA

`fighter_measurements` lưu:

- `weight_kg`: cân nặng bắt buộc, số thập phân 2 chữ số; không dùng số thực dấu phẩy động cho cân nặng.
- `height_cm`, `reach_cm`: chiều cao và sải tay tùy chọn, đơn vị cm.
- `measured_at`, `recorded_by_id`: thời điểm đo thực tế và người ghi nhận.
- `measurement_context`: `TRAINING`, `CHECKUP`, `WEIGH_IN`, `SELF_REPORTED` để phân biệt nguồn/ngữ cảnh; không đồng nghĩa với kết quả kiểm định đủ điều kiện thi đấu.
- `supersedes_id`: bản đo được đính chính; bản mới phải thuộc cùng Fighter, mỗi bản cũ chỉ có một bản kế tiếp.

Các giá trị phải dương và hữu hạn. Đây là kiểm tra tính hợp lệ của dữ liệu, không phải ngưỡng đánh giá sức khỏe. Không tự thêm chẩn đoán, ngưỡng sinh tồn hoặc khuyến nghị giảm cân.

`fighters.weight_class` là **hạng cân đăng ký**, độc lập với cân nặng đo từng ngày. Migration chưa có domain giải đấu/ruleset/giới tính/loại cân chính thức để tự xếp hạng cân. Không áp một bảng ngưỡng duy nhất cho mọi giải MMA. `fighters.height_cm` và `reach_cm` là snapshot profile; không có cơ chế tự đồng bộ từ measurement.

Ví dụ lấy bản đo mới nhất còn hiệu lực sau đính chính:

```sql
SELECT m.*
FROM public.fighter_measurements m
WHERE m.fighter_id = $1
  AND NOT EXISTS (
    SELECT 1 FROM public.fighter_measurements correction
    WHERE correction.supersedes_id = m.id
  )
ORDER BY m.measured_at DESC, m.created_at DESC, m.id DESC
LIMIT 1;
```

Backend cần quy định ai được ghi số đo, xác thực thời điểm/nguồn đo và cung cấp ngữ cảnh phù hợp khi xếp hạng cân. Các quyền ghi này không được suy ra từ quyền đọc.

## Quyền đọc y tế đã chốt

Theo yêu cầu cập nhật của chủ dự án, thay thế phần quyền đọc y tế mâu thuẫn trong spec; quyền Admin lấy từ spec V3 §13.3.

| Vai trò ứng dụng | Hồ sơ/số đo y tế | Audit logs |
| --- | --- | --- |
| Fighter | Chỉ Fighter gắn với tài khoản đang hoạt động của mình | Không |
| Coach | Tất cả Fighter, không giới hạn assignment | Không |
| Doctor / Medical Staff | Tất cả Fighter, không giới hạn assignment | Không |
| Admin | Tất cả Fighter | Đọc |
| Anonymous, unmapped, inactive, deleted user | Không | Không |

RLS SELECT áp dụng cho `medical_clearances`, `injury_records`, `treatments`, `recovery_plans`, `fighter_measurements`, `health_alerts`, `fighter_joint_states`, `joint_health_history`, `fighter_baselines`. Role Doctor sử dụng identifier `DOCTOR`; hồ sơ chuyên môn vẫn ở `sports_doctors`.

- Authenticated clients không được ghi trực tiếp vào các bảng domain mới; không thể tự sửa role hoặc tự nhận danh tính người ghi.
- Quyền ghi của Admin/Doctor và các vai trò khác phải đi qua backend có kiểm tra quyền. V3 cho Admin quản lý dữ liệu nhưng không cho phép phá tính append-only của audit/history.
- Các bảng domain ngoài nhóm trên bật RLS và chưa mở policy client. Backend sẽ cung cấp API theo scope nghiệp vụ tiếp theo.
- **Kết nối owner/superuser/service role có thể bypass RLS**; migration không thay thế kiểm tra quyền ở NestJS. Không cung cấp credential này cho client. Giữ `mma_private` ngoài danh sách schema expose của Supabase.
- Audit trigger ghi `SYSTEM` nếu request không mang Supabase subject. Khi backend sử dụng pooled connection, đặt subject đã xác thực và `mma.request_id` trong transaction bằng `SET LOCAL`/`set_config(..., true)`; không lấy actor từ body người dùng.
- **RLS không ghi log SELECT.** Backend cần ghi audit truy cập y tế (actor, target, request, timestamp) trong đường xử lý request; tính năng API này chưa được triển khai trong đợt migration. Trigger không sao chép toàn bộ nội dung sức khỏe vào audit.

Tham khảo cơ chế: [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Supabase Auth user data](https://supabase.com/docs/guides/auth/managing-user-data), [PostgreSQL constraints](https://www.postgresql.org/docs/18/ddl-constraints.html).

## Tương thích và giới hạn triển khai

- Python worker, processing jobs, queue, frontend và mobile không nằm trong thay đổi. Các bảng mới chưa được pipeline hiện tại tự điền dữ liệu.
- Writer cũ vẫn có thể insert/update các cột từ 001–002; chưa tự chuyển legacy job thành domain analysis. FK mới để NULL cho tới khi có mapping được xác thực.
- Vì Drizzle SELECT mặc định chọn toàn bộ cột đã khai báo, **chạy 003 trước khi chạy backend dùng schema.ts mới**. Các insert cũ không cần thêm field.
- Liên kết context của video/analysis và record lịch sử được giữ cố định; sửa sai context bằng record mới. Các FK lịch sử dùng RESTRICT để tránh xóa dây chuyền; chưa thực hiện purge hoặc chính sách lưu trữ tự động.
- Unique assignment áp dụng cho đợt chưa kết thúc; không phải exclusion constraint cấm mọi khoảng thời gian quá khứ chồng lấn. Backend cần kiểm tra lịch sử nhập/bổ sung theo nghiệp vụ.
- Segment kiểm tra mốc dương, end > start và cùng session. Kiểm tra duration thực tế, segment chồng lấn hoặc phân đoạn từ video thuộc trách nhiệm validation dữ liệu media; migration không đọc video.
- Chưa có baseline dữ liệu lớn để benchmark index, phân vùng hoặc cam kết latency. Chỉ thêm index theo truy vấn và các key cần cho ràng buộc nhất quán.
- Preflight đối chiếu cột/default/enum/PK/trigger và 4 index baseline; collision domain làm rollback. Đây không phải công cụ phát hiện mọi thay đổi thủ công về privilege hoặc nội dung function trên Supabase.

## Kiểm thử và thay đổi tiếp theo

```sh
# Không cần npm dependencies: chỉ cần Node và PostgreSQL binaries.
# Windows mặc định tìm C:/Program Files/PostgreSQL/18/bin.
# Dùng PG_TEST_BIN nếu PostgreSQL cài nơi khác.
npm run test:db
```

Test tạo cluster PostgreSQL mới trong thư mục tạm, listen localhost ở port tạm, dựng fixture Supabase Auth tối thiểu, rồi dừng cluster trong `finally`. Không đọc `.env` hoặc `DATABASE_URL`, không kết nối Supabase, không dùng database PostgreSQL đang có. Fixture auth không thay thế một bài integration test trên Supabase thật. Dữ liệu thử nghiệm nằm trong thư mục tạm in ở cuối test để điều tra khi cần.

Phạm vi kiểm thử: chạy mới 001→002→003, nâng cấp baseline có dữ liệu khác shape, hợp đồng insert/update legacy, chạy lại 003, schema drift và partial collision rollback, FK/check/domain history, quyền đọc y tế và privilege dưới role thật của PostgreSQL.

Đối chiếu SQL/Drizzle sau khi build:

```sh
node scripts/test-migrations.mjs --export-catalog
node scripts/check-drizzle-catalog.mjs dist/database/schema.js ../tmp/schema-catalog.json
```

`--export-catalog` ghi vào `../tmp`; đây là output phục vụ test, không phải snapshot Supabase. Checker đối chiếu 35 bảng, 26 enum, type/nullability/default, checks, FK/actions, keys và indexes. RLS/functions/grants được kiểm tra qua bài SQL, không sinh từ Drizzle.

`db:push` và `db:generate` được chặn để tránh để schema diff tự quản lý thiếu trigger, RLS, grants và ledger. Sau khi 003 đã áp dụng, mọi thay đổi tiếp theo phải tạo migration **004 trở đi**; không sửa rồi chạy lại 003. Manifest dùng SHA-256 của nội dung UTF-8 đã chuẩn hóa CRLF→LF để kiểm tra giống nhau giữa Windows/Linux.

Rollback: lỗi trong lúc 003 chạy làm rollback toàn transaction. Sau khi đã COMMIT và phát sinh dữ liệu domain, không có down script xóa schema; sửa bằng migration kế tiếp hoặc phục hồi từ backup đã xác nhận.

### Kết quả kiểm tra trong workspace ngày 2026-09-15

- PostgreSQL 18.4 cô lập: 7 nhóm kiểm thử đã qua, gồm nâng cấp có dữ liệu, rollback và ma trận quyền đọc y tế.
- TypeScript 6.0.2 + Drizzle 0.45.2: schema compile thành công bằng bộ dependencies kiểm tra riêng trong `tmp`.
- Metadata PostgreSQL/Drizzle: khớp 35 bảng public, 26 enum và các cột/default/check/FK/key/index.
- Checksum xác nhận 001–002 giữ nguyên byte; kiểm tra manifest và `git diff --check` đã qua.
- Chưa chạy full build NestJS: `npm ci --offline` bị thiếu dependency trong cache. Chưa thực thi trên Supabase hoặc thay đổi dữ liệu dự án.
