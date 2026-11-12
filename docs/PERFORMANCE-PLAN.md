# Kế hoạch tăng tốc web ở API mode

**Ngày:** 12/11/2026. **Nhánh khảo sát:** `release/final-review` (commit `dc83fb7`).
**Phạm vi:** frontend `nextjs-frontend` (chủ dự án tự làm), backend `nestjs-api` (giao Ken/Dan theo ticket), hạ tầng.
**Cách làm:** đọc code, đọc output `next build` có sẵn trong `nextjs-frontend/.next` (build ngày 10/11). Không chạy build, không chạy server, không đụng Supabase. Số "dự kiến" bên dưới là ước lượng từ số request và số truy vấn đếm được trong code; phải đo lại theo mục 6.

## 1. Số đo hiện tại (10/11, API mode, `next start`, NestJS chạy local, Supabase qua pooler cổng 6543)

| Màn | Thời gian | Mục tiêu |
| --- | --- | --- |
| Một lệnh gọi backend đơn lẻ | ≈100 ms | giữ nguyên |
| Trung vị tải trang (`ui:smoke`) | ≈1,5 s | **< 1 s** |
| `/coach/dashboard` | 5–6 s | **< 2 s** |
| `/coach/fighters/[id]` | 3–5 s | **< 1,5 s** |
| `/doctor/recovery`, `/doctor/injuries`, `/doctor/medical-clearance` | 3–3,8 s | **< 1,5 s** |
| `/fighter/dashboard` | 3–4 s | **< 1,5 s**, khung trang hiện **< 0,8 s** |
| `/fighter/videos/[id]` | ≈6 s | **< 2 s** (khung trang < 0,8 s) |
| `next dev` | 1–2 s mỗi lệnh gọi | chỉ dùng để code, không dùng để đo |

Đã làm trước đó: gộp GET trùng trong một lượt render bằng React `cache` (`nextjs-frontend/src/lib/api/client.ts:140`), `API_TIMING_LOG=1` in thời gian từng lệnh gọi (`client.ts:77`, `:107`), `experimental.staleTimes.dynamic: 30` (`next.config.ts`).

## 2. Nguyên nhân, xếp theo ảnh hưởng

### N1. Frontend gọi từng võ sĩ một, kể cả ở chỗ backend đã tự lọc theo phạm vi người gọi (ảnh hưởng lớn nhất)

- `readPerFighter` (`lib/services/training.ts:243`) gửi một request cho mỗi võ sĩ; `listBackendSessions` (`training.ts:636`) còn nhân thêm theo từng trạng thái. `getUpcomingSessions` (`training.ts:671`) hỏi 2 trạng thái nên mỗi võ sĩ 2 request.
- `drainList` của bouts (`lib/services/bouts.api.ts:63`) cũng chạy từng võ sĩ, mỗi võ sĩ đọc tuần tự theo cursor.
- **Nhưng backend đã hỗ trợ đọc không cần `fighterId`:**
  - Training: `TrainingAccessService.scopeListQuery` (`nestjs-api/src/training/training-access.service.ts:54`) với COACH tự gán `coachId` của chính người gọi, và `findSessions` (`training/training.repo.ts:512`) thêm điều kiện `EXISTS coach_fighters` còn hiệu lực. Vì nhánh có `fighterId` cũng bị ép `coachId` = huấn luyện viên đang gọi, **một request không `fighterId` trả đúng hợp của N request từng võ sĩ.** Plans dùng cùng hàm (`training/plans/training-plan.service.ts:45`). Chỉ DOCTOR bắt buộc `fighterId` (`training-access.service.ts:80`).
  - Bouts: `listBoutsQuerySchema` (`bouts/bouts.model.ts:892`) có `fighterId` tuỳ chọn và `status` **nhận nhiều giá trị**; `resolveListScope` (`bouts/bouts.service.ts:2059`) trả phạm vi COACH/DOCTOR theo phân công.
- Đếm cho coach dashboard (`app/(app)/coach/dashboard/page.tsx:68`) với N võ sĩ: tuần (N), bị lỡ (N), kế hoạch (N), sắp tới trong roster (2N), bouts (N), hồ sơ y tế (N), cộng khoảng 10 request cố định. Với N = 5 là khoảng 40 request, đúng với số đã đo; N = 10 thì khoảng 80.

### N2. Mỗi request backend tốn nhiều truy vấn nối tiếp, trong khi pool chỉ có 10 kết nối

- Pool `max: 10` (`nestjs-api/src/database/database.module.ts:29`). Khi 40 request đến cùng lúc, truy vấn phải xếp hàng chờ kết nối.
- Danh sách session cho COACH: `findActiveCoachIdByUserId` → `isCoachAssignedToFighter` → `findSessions` (data + count): **4 truy vấn, 3 bước nối tiếp** (`training-access.service.ts:31-89`).
- Hồ sơ y tế `GET /fighters/:id/medical` (`medical/medical.service.ts:436`): `requireFighter` → kiểm tra phân công → **INSERT audit** (`medical/medical-access.service.ts:65-85`) → 8 truy vấn song song → tối đa 3 truy vấn nữa (`listClearancesForExamination`, `findExaminationDetails`). Tổng **khoảng 14 truy vấn, 5 bước nối tiếp, có 1 lệnh ghi**. Riêng 10 hồ sơ chạy song song đã cần khoảng 140 truy vấn qua 10 kết nối.
- `GET /fighters/:id/medical/history` cũng ghi audit **cho mỗi trang** (`medical.service.ts`, hàm `listHistory` gọi `authorizeClinicalRead`).

### N3. Xác thực khi cache nguội: mỗi request song song tự gọi Supabase Auth

- `AuthService.authenticate` (`auth/auth.service.ts:446`) có cache 15 giây (`auth/auth-cache.ts:8`) nhưng **không gộp các lệnh đang chạy dở**. Trang đầu tiên sau 15 giây im lặng bắn 40 request cùng lúc thì cả 40 đều miss cache, mỗi cái gọi `supabase.auth.getUser` (HTTP ra Supabase, thường 100–300 ms) rồi đọc `users`. Quyền (`hasPermissions`, `auth.service.ts:470`) cũng vậy.
- TTL 15 giây ngắn hơn khoảng cách giữa hai lần chuyển trang khi demo, nên hầu như trang nào cũng trả phí này.

### N4. Thác nước (waterfall) trên frontend

- Mọi trang: `/users/me` rồi mới đến roster phân công (`lib/auth/session.ts:69` `withAssignmentScope`, gọi `drainNumberedPages(fighterRosterPath)`), rồi mới đến dữ liệu trang. Tức là có 2 vòng nối tiếp trước khi bắt đầu đọc dữ liệu.
- Layout `(app)` (`app/(app)/layout.tsx:16-21`): `getNavBadgeCounts` **xong rồi mới** chạy `doctorShellCounts`. `doctorShellCounts` dựng lại cả bảng phân loại (`lib/services/doctor-board.ts:233` → `loadDoctorBoard` :208): danh sách võ sĩ, rồi với mỗi võ sĩ `loadRow` đọc `getFighterHealthSummary` + `getClearanceStatus` + `getClinicalDossier`. `healthSummary` (`lib/services/medical.api.ts:455`) đọc lại `/fighters/:id` dù danh sách võ sĩ đã có sẵn, nên mất thêm N request.
- Layout không có Suspense, nên khi tải cứng (F5, mở link, `router.refresh()`, sau server action) cả khung trang phải chờ huy hiệu bác sĩ. `loading.tsx` của trang (đã có ở 94 route) nằm **bên trong** layout, nên không hiện ra được trước khi layout xong. Lưu ý: khi chuyển trang mềm bằng `<Link>`, layout dùng chung không render lại, nên chi phí này chủ yếu rơi vào lần tải cứng và lần refresh sau khi ghi.
- Cảnh báo cân (`lib/services/bouts.ts:156`): bouts → `getWeightTrack` → `getFighter` → `wayOffForBout`, **4 vòng nối tiếp** cho mỗi bout đang chạy, và coach dashboard phải chờ cả chuỗi này.
- Chi tiết video (`lib/services/videos.ts:200`): `getVideo` → `getFighter` → `getJobProgress` → `/jobs/:id/result` → `readReviewState`, **5 vòng nối tiếp**. Bước `result` tải file JSON kết quả từ Supabase Storage mỗi lần (`nestjs-api/src/jobs/jobs.service.ts:184-200`), không có cache dù kết quả đã xong thì không đổi nữa.
- Fighter dashboard (`app/(app)/fighter/dashboard/page.tsx:81`) cho `latestAnalysis` (gọi `getVideoDetail`, xem dòng 421) vào cùng một `Promise.all` với 12 lệnh đọc khác, nên **cả trang chờ chuỗi video 5 vòng**.

### N5. Gói JavaScript phía client

- Chunk lớn nhất `.next/static/chunks/3o5eyjqyzqs2b.js`: **1,26 MB, gzip 289 KB**, chứa **cả hai từ điển `en` và `vi`**. Lý do: `lib/i18n/translate.ts:2-3` import cả hai, và 68 file `"use client"` import `@/lib/i18n/translate`. Người dùng nào cũng tải và parse cả hai thứ tiếng ở lần vào đầu.
- three.js (chunk `0qhiyb7mkap3q.js`, 364 KB) được import tĩnh: `components/fighter-3d/fighter-portrait.tsx:11` import `portrait-studio.ts`, file này import `three` và `GLTFLoader`. `FighterCard` (`components/domain/fighter-card.tsx:11`) dùng portrait, nên mọi trang có thẻ võ sĩ đều kéo three vào gói chính. Việc vẽ đã chờ `IntersectionObserver` (`fighter-portrait.tsx:96`) nhưng việc tải mã thì không. Body map đã dùng `dynamic(..., { ssr: false })` (`components/fighter-3d/body/body-stage.tsx:20`), có thể chép cách làm này.
- Model `.glb`: `fighter-body.glb` 714 KB, `muscular-v6e-meshopt.glb` 189 KB. Cần kiểm tra file 714 KB có còn được dùng không; nếu còn thì nén meshopt như file kia.

### N6. Hạ tầng

- Pool 10 so với pooler transaction mode (cổng 6543): Supavisor ở transaction mode cho phép nhiều kết nối client hơn hẳn session mode (15). Pool 10 đang là nút thắt khi một trang bắn 40–80 request.
- Backend không có nén HTTP (`main.ts` không dùng `compression`). Frontend gọi backend qua localhost nên không đáng kể; chỉ có ý nghĩa nếu trình duyệt gọi thẳng backend.
- Fetch của Next (undici) mặc định đã giữ kết nối (keep-alive) tới localhost, không cần đổi.
- Redis đã có trong dependency (`ioredis`) và cấu hình (`shared/config/redis.config.ts`), nhưng chỉ dùng cho notifications và nonce. Ở quy mô một server thì cache trong bộ nhớ là đủ; Redis chỉ cần khi chạy nhiều instance.

### Chỉ số index (đã kiểm tra, không phải nguyên nhân chính)

Các bảng danh sách đã có index đúng cột lọc: `idx_session_fighter_schedule (fighter_id, scheduled_at DESC)`, `idx_session_coach_schedule (coach_id, scheduled_at)` (migration 005), `idx_bouts_fighter_weigh_in`, `idx_bouts_status_weigh_in` (024), `uq_coach_fighter_open`, `uq_doctor_fighter_open` (003), `idx_injury_fighter_status`, `idx_clearance_fighter_valid`, `idx_medical_review_request_fighter_status`, `idx_suspensions_fighter_active`. Dữ liệu demo nhỏ, nên chi phí nằm ở **số vòng gọi**, không nằm ở tốc độ từng truy vấn. Index cho `training_sessions (coach_id, status, scheduled_at)` chỉ cần khi dữ liệu lớn, chưa nằm trong kế hoạch này.

## 3. (A) Frontend: chủ dự án làm được ngay

Thứ tự là thứ tự nên làm. Kích cỡ: S < nửa ngày, M khoảng 1 ngày, L trên 1 ngày.

### A1. Coach đọc session, plan, bout một lần thay vì theo từng võ sĩ — **M**

- **File:** `lib/services/training.ts` (`readPerFighter` :243, `listBackendPlans` :394, `listBackendSessions` :636), `lib/services/bouts.api.ts` (`drainList` :63), `lib/auth/access.ts` (`accessibleFighterIds`).
- **Cách làm:** khi người gọi là coach và danh sách võ sĩ cần đọc chứa **toàn bộ** phạm vi phân công (`user.assignmentScope.fighterIds`) hoặc có nhiều hơn 1 võ sĩ, gọi một lần **không có `fighterId`**, rồi lọc lại phía client bằng `Set(fighterIds)`. Giữ cách cũ cho doctor (training bắt buộc `fighterId`) và cho trường hợp chỉ có 1 võ sĩ. Bouts: gọi `drainList(target, schema, "all")`, lọc theo id, và truyền nhiều `status` nếu màn chỉ cần trạng thái đang chạy. Sessions nhiều trạng thái: đọc một lần không có `status` trong khoảng `from`/`to` rồi lọc client, cho tới khi có T-063.
- **Dự kiến:** coach dashboard từ khoảng 7N+10 xuống khoảng 2N+12 request (N = 5: 40 → khoảng 22; N = 10: 80 → khoảng 32), **giảm khoảng 1,5–2,5 s**. Roster và `/coach/sessions`, `/coach/training-plans`, `/coach/bouts` cũng nhanh theo.
- **Rủi ro:** thấp. Backend đã giới hạn theo phân công (xem N1). Phải test rằng kết quả trùng với cách cũ: chạy cả hai cách trong một unit test với mock. Danh sách lớn sẽ có nhiều trang (100 mục/trang), nhưng vẫn ít request hơn.
- **Kiểm tra:** `API_TIMING_LOG=1`, mở `/coach/dashboard`, đếm dòng `[api] GET /training-sessions` (trước: 4N, sau: ≤ 3). `pnpm --filter nextjs-frontend test`.

### A2. Đưa huy hiệu bác sĩ ra khỏi đường chờ của layout — **S/M**

- **File:** `app/(app)/layout.tsx`, `components/layout/app-shell.tsx` / `sidebar-nav.tsx`, `lib/services/doctor-board.ts:233`.
- **Cách làm:** (1) Chạy `getNavBadgeCounts` và `doctorShellCounts` song song, không nối tiếp. (2) Tốt hơn: render khung trang ngay với `counts` cơ bản, còn huy hiệu bác sĩ đặt trong một `<Suspense fallback={null}>` riêng (server component con, nhận promise) để layout không bị chặn. Hoặc (3) chuyển huy hiệu bác sĩ sang client: một route handler `/api/nav-counts` gọi `doctorShellCounts`, sidebar fetch sau khi hydrate.
- **Dự kiến:** tải cứng mọi trang bác sĩ **giảm 1–2 s**, đủ để `loading.tsx` hiện ngay.
- **Rủi ro:** thấp. Huy hiệu hiện chậm khoảng nửa giây.
- **Kiểm tra:** `ui:smoke` với vai doctor, so `page load: median`. `API_TIMING_LOG=1`: các request `/fighters/:id/medical` của layout không còn đứng trước request đầu tiên của trang.

### A3. Bảng phân loại bác sĩ dùng lại hồ sơ võ sĩ đã có — **S**

- **File:** `lib/services/medical.api.ts:455` (`healthSummary`), `lib/services/medical.ts:286`, `lib/services/doctor-board.ts` (`loadRow`).
- **Cách làm:** thêm biến thể `healthSummaryFor(fighter: Fighter, now)` nhận object `Fighter` sẵn có; `loadRow` truyền `fighter` thay vì id. `fightersWithDossiers` (`medical.api.ts:602`) đã làm đúng kiểu này, chỉ cần chép theo.
- **Dự kiến:** bớt N request `/fighters/:id` trên mọi màn bác sĩ và trong layout, **khoảng 0,3–0,6 s**.
- **Rủi ro:** rất thấp.
- **Kiểm tra:** `API_TIMING_LOG=1`: không còn `GET /fighters/<uuid>` lặp lại khi mở `/doctor/dashboard`.

### A4. Tách widget chậm thành Suspense riêng (stream) — **M**

- **File:** `app/(app)/fighter/dashboard/page.tsx:81` (`latestAnalysis`), `app/(app)/coach/dashboard/page.tsx:68` (`listWeightAlerts`, `getCoachTodo`, `listCampBouts`), `components/video/video-detail-view.tsx:49`.
- **Cách làm:** đưa các lệnh đọc dài hoặc dễ lỗi ra khỏi `Promise.all` chính, mỗi lệnh thành một server component con bọc `<Suspense fallback={<Skeleton/>}>`. Fighter: thẻ "AI phân tích mới nhất". Coach: thẻ cảnh báo cân và giấy tờ, thẻ to-do. Video: phần header (video + fighter) render trước, workspace phân tích (job → result → review) nằm sau Suspense.
- **Dự kiến:** khung trang và nội dung chính hiện **< 1 s**. Tổng thời gian không giảm nhưng người dùng thấy trang ngay: fighter dashboard từ 3–4 s xuống khoảng 1 s cho phần đầu, video từ 6 s xuống < 1 s cho header.
- **Rủi ro:** trung bình. Bố cục nhảy khi widget đến sau, nên skeleton phải giữ đúng chiều cao. `notFound()` phải nằm ở phần render trước.
- **Kiểm tra:** `ui:smoke` đo `load`. Thêm đo "first contentful" bằng DevTools Performance. `API_TIMING_LOG` cho thấy chuỗi `/jobs/*` vẫn chạy nhưng HTML đầu đã gửi đi.

### A5. Bỏ thác nước trong cảnh báo cân và chi tiết video — **S**

- **File:** `lib/services/bouts.ts:156-170`, `lib/services/videos.ts:200-230`.
- **Cách làm:** cảnh báo cân: chạy `getWeightTrack`, `getFighter` (hoặc lấy tên từ danh sách võ sĩ đã có), `wayOffForBout` **song song** cho từng bout. Video: `getFighter(video.fighterId)` và `getJobProgress(video.jobId)` song song sau `getVideo`; `readReviewState(job.id)` song song với `/jobs/:id/result`.
- **Dự kiến:** cảnh báo cân từ 4 vòng xuống 2; video từ 5 vòng xuống 3, **khoảng 0,3–1 s mỗi màn** (tuỳ thời gian tải Storage).
- **Rủi ro:** thấp.
- **Kiểm tra:** `API_TIMING_LOG=1`: các dòng `[api]` của cùng một bout hoặc video bắt đầu cùng lúc.

### A6. Mỗi trình duyệt chỉ tải từ điển của ngôn ngữ đang dùng — **M**

- **File:** `lib/i18n/translate.ts`, 68 file client import `@/lib/i18n/translate`, provider ngôn ngữ ở `components/layout/app-shell.tsx`.
- **Cách làm:** client component không import `createTranslator` trực tiếp, mà dùng hook `useT()` đọc từ một `I18nProvider`. Layout server truyền vào provider **chỉ từ điển của locale hiện tại** (object thuần, serializable). Giữ `createTranslator` cho server. Có thể làm từng bước: tạo `translate-client.ts` không import `en`/`vi`, rồi sửa dần các file client.
- **Dự kiến:** gói client bớt khoảng 0,6 MB raw / 145 KB gzip ở lần vào đầu (một nửa chunk 1,26 MB), parse JS nhanh hơn khoảng 100–200 ms trên laptop, nhiều hơn trên điện thoại. Lợi ích lớn với web mobile.
- **Rủi ro:** trung bình (đụng nhiều file). Kiểm tra `hardcoded-english.test.ts` và `translate.test.ts` vẫn qua.
- **Kiểm tra:** sau `next build`, `ls -S .next/static/chunks | head`, không còn chunk nào chứa cả `"Võ sĩ"` lẫn `"Fighter"` cho cùng một key.

### A7. Tải three.js khi thẻ võ sĩ thật sự hiện ra — **S**

- **File:** `components/fighter-3d/fighter-portrait.tsx`, `components/fighter-3d/portrait-studio.ts`.
- **Cách làm:** bỏ import tĩnh `portraitStudio, queuePaint` và `bodyModelFor`. Trong callback của `IntersectionObserver` gọi `await import("./portrait-studio")` (hoặc bọc cả `FighterPortrait` bằng `next/dynamic` `{ ssr: false }` như `body-stage.tsx:20`). Giữ chỗ trống cùng kích thước khi chưa có WebGL.
- **Dự kiến:** trang roster/dashboard có thẻ võ sĩ bớt 364 KB JS (khoảng 90 KB gzip) khỏi gói ban đầu; hydrate nhanh hơn khoảng 100–300 ms.
- **Rủi ro:** thấp, đã có fallback khi không có WebGL.
- **Kiểm tra:** DevTools Network: chunk chứa `WebGLRenderer` chỉ tải sau khi thẻ vào khung nhìn.

### A8. Gộp `/users/me` và roster phân công thành một vòng — **S, phụ thuộc T-066**

- **File:** `lib/auth/session.ts:69`.
- **Cách làm:** khi backend trả `assignmentScope` trong `/users/me` (T-066), `withAssignmentScope` đã tự bỏ qua bước đọc roster (`if (user.assignmentScope ...) return user`). Trước khi có T-066 có thể bắt đầu đọc danh sách võ sĩ song song với `/users/me`, nhưng chỉ đáng làm nếu T-066 trễ.
- **Dự kiến:** **khoảng 100–200 ms cho mọi trang** của coach và doctor.

### A9. Cache ngắn cho dữ liệu dùng chung và không đổi — **S**

- **File:** `lib/services/admin.ts:314` (`getSettings`), `lib/services/bouts.api.ts:50` (`withRulesets` → `listApiRulesets`), `lib/services/videos.ts` (`/jobs/:id/result` của job đã `completed`).
- **Cách làm:** cache trong bộ nhớ của process Next, theo khoá (settings: chung; rulesets: chung; kết quả job: `jobId`), TTL 60 s cho settings và rulesets, 10 phút cho kết quả job. Không cache theo token. Chỉ cache dữ liệu không thuộc quyền riêng của người xem; kết quả job vẫn phải qua kiểm tra quyền (`getVideo`) trước khi trả ra.
- **Dự kiến:** mỗi trang bớt 1–3 request; video bớt một lần tải Storage (0,3–1 s).
- **Rủi ro:** trung bình nếu cache sai chỗ (lộ dữ liệu giữa người dùng). Chỉ cache 3 thứ nêu trên.

## 4. (B) Backend: ticket cho Ken/Dan

Số ticket dưới đây là số đề xuất; đối chiếu `docs/tickets/README.md` trước khi tạo file. Mỗi ticket chạy tối thiểu `pnpm --filter nestjs-api lint`, `pnpm --filter nestjs-api build`, `pnpm --filter nestjs-api test`; ticket có migration chạy thêm `pnpm --filter nestjs-api test:db` và `pnpm --filter nestjs-api db:check`. Không thêm lỗi so với `docs/tickets/BASELINE.md`.

### T-063 — Danh sách session/plan nhận nhiều võ sĩ và nhiều trạng thái

- **Bối cảnh:** frontend phải gọi từng võ sĩ (DOCTOR bắt buộc `fighterId`) và từng trạng thái (`status` chỉ nhận một giá trị). Coach dashboard tốn khoảng 4N request chỉ cho sessions.
- **Phạm vi:** `GET /training-sessions` và `GET /training-plans` nhận `fighterIds` (lặp tham số hoặc phân cách bằng dấu phẩy, tối đa 100 uuid) và `status` nhiều giá trị (chép cách tiền xử lý của `listBoutsQuerySchema`, `bouts/bouts.model.ts:892-899`). DOCTOR được gọi với `fighterIds`; mỗi id phải qua kiểm tra phân công. **Kiểm tra bằng một truy vấn** (`doctor_fighters ... fighter_id = ANY($1)`), không lặp từng id. `fighterId` cũ vẫn chạy.
- **Ngoài phạm vi:** đổi quy tắc phạm vi của COACH/FIGHTER; đổi định dạng response.
- **File:** `nestjs-api/src/training/training.model.ts:174-202` (`paginationSchema`, `listSessionsQuerySchema`, schema list plans), `training/training-access.service.ts:54` (`scopeListQuery`), `training/training.repo.ts:499` (`findSessions`, `inArray`), repo plans tương ứng, `training/sessions/training-session.controller.ts:55`, spec cùng thư mục.
- **Tiêu chí nghiệm thu:**
  1. `GET /training-sessions?fighterIds=a,b&status=SCHEDULED&status=IN_PROGRESS` trả đúng hợp của 4 lệnh gọi đơn lẻ (unit test so sánh với repo mock và ca trong `test:db` nếu có).
  2. DOCTOR có một id không được phân công → 403, không lộ dữ liệu của id khác.
  3. Số truy vấn kiểm tra quyền của DOCTOR là 1 bất kể số id (test đếm lời gọi repo).
  4. Các lệnh gọi cũ (`fighterId`, một `status`) vẫn qua toàn bộ test hiện có.
- **Lệnh:** lint, build, test như trên.

### T-064 — Endpoint tóm tắt y tế theo lô cho bảng bác sĩ và roster

- **Bối cảnh:** mỗi võ sĩ một lệnh `GET /fighters/:id/medical`, mỗi lệnh khoảng 14 truy vấn qua 5 bước nối tiếp, kèm 1 INSERT audit (`medical/medical.service.ts:436`, `medical/medical-access.service.ts:65`). Bảng bác sĩ, roster coach và layout đều đọc N hồ sơ.
- **Phạm vi:** thêm `GET /medical/dossiers?fighterIds=…` (tối đa 100 id; bỏ trống thì lấy toàn bộ phạm vi người gọi) trả mảng `MedicalDossier` cùng định dạng với endpoint đơn. Mỗi bảng con đọc **một truy vấn cho cả lô** (`fighter_id = ANY($1)`, nhóm theo `fighter_id` trong code): injuries, recovery plans, clearances, review requests mở, khám hiện hành (TRAINING/COMPETITION, dùng `DISTINCT ON (fighter_id, scope)`), baseline, chi tiết khám. Kiểm tra phạm vi một truy vấn. Audit: **một INSERT nhiều dòng** cho cả lô (giữ đúng quy định ghi metadata, view `DOSSIER`).
- **Ngoài phạm vi:** sửa logic `eligibilityFrom`; bỏ audit; đổi endpoint đơn.
- **File:** `nestjs-api/src/medical/medical.controller.ts`, `medical.service.ts` (tách phần tính từ dữ liệu ra hàm thuần để endpoint đơn và endpoint lô dùng chung), `medical.repo.ts`, `medical-access.service.ts`, `medical.model.ts`/`medical.dto.ts`, spec.
- **Tiêu chí nghiệm thu:**
  1. Với cùng dữ liệu, mỗi phần tử của `/medical/dossiers` bằng đúng (deep equal) kết quả `/fighters/:id/medical` (test).
  2. Số truy vấn của một lô 20 võ sĩ ≤ 15 và không phụ thuộc số võ sĩ (test đếm lời gọi repo).
  3. Id ngoài phạm vi → 403 cho cả lệnh, có test cho COACH, DOCTOR, FIGHTER.
  4. `medical_read_audit` có đúng một dòng cho mỗi võ sĩ trong lô.
  5. Swagger mô tả endpoint mới.
- **Lệnh:** lint, build, test.
- **Việc của frontend sau ticket:** `dossierFor` (`lib/services/medical.api.ts:230`) đọc theo lô cho bảng bác sĩ, roster và layout.

### T-065 — Gộp các lệnh xác thực đang chạy và nới TTL cache

- **Bối cảnh:** `AuthService.authenticate` (`auth/auth.service.ts:446`) và `hasPermissions` (`:470`) không gộp lệnh đang chạy dở; trang mở 40 request lúc cache nguội tạo ra 40 lệnh `supabase.auth.getUser`. TTL 15 giây (`auth/auth-cache.ts:8`).
- **Phạm vi:** (1) Thêm map promise đang chạy theo `cacheKey` cho identity và permission (một lần gọi Supabase cho mỗi token, các request khác chờ cùng promise; lỗi thì xoá khỏi map). (2) TTL identity lên 60 giây, vẫn giới hạn bởi `exp` của JWT và `invalidateAuthCache()` như hiện tại. (3) Tuỳ chọn, tách ticket riêng nếu cần: xác minh JWT tại chỗ bằng JWKS của Supabase (`jose`), chỉ gọi `getUser` khi xác minh thất bại. Phần này cần chủ dự án cho phép thêm thư viện.
- **Ngoài phạm vi:** đổi luồng đăng nhập hay refresh.
- **File:** `nestjs-api/src/auth/auth.service.ts`, `auth/auth-cache.ts`, `auth/auth-cache.spec.ts`, `auth/auth.service.spec.ts`.
- **Tiêu chí nghiệm thu:**
  1. 50 lệnh `authenticate` song song cùng token khi cache rỗng → `supabase.auth.getUser` được gọi đúng 1 lần (test).
  2. Lệnh đầu lỗi thì lệnh sau thử lại, không giữ lỗi trong cache (test).
  3. Người dùng bị khoá vẫn bị chặn trong ≤ 60 s, hoặc ngay lập tức khi có `invalidateAuthCache()` (test hiện có vẫn qua).
- **Lệnh:** lint, build, test.

### T-066 — `/users/me` trả phạm vi phân công

- **Bối cảnh:** frontend phải đọc thêm roster sau `/users/me` cho coach/doctor (`nextjs-frontend/src/lib/auth/session.ts:69`), thêm một vòng nối tiếp cho mọi trang. Frontend đã sẵn sàng nhận trường `assignmentScope`.
- **Phạm vi:** `GET /users/me` thêm `assignmentScope: { fighterIds: string[] }` cho COACH (phân công `coach_fighters` còn hiệu lực, coach active, võ sĩ chưa xoá) và DOCTOR (`doctor_fighters` còn hiệu lực), cùng điều kiện với `/fighters` và `/doctors/:id/fighters`. Một truy vấn.
- **File:** `nestjs-api/src/users/users.controller.ts:105`, service/repo của users, spec.
- **Tiêu chí nghiệm thu:** danh sách id trùng với `/fighters` (COACH) và `/doctors/:id/fighters` (DOCTOR) trên cùng dữ liệu (test); FIGHTER/ADMIN không có trường này hoặc là `null`; tăng tối đa 1 truy vấn.
- **Lệnh:** lint, build, test.

### T-067 — Kiểm tra phạm vi một lần cho mỗi request, gộp count

- **Bối cảnh:** danh sách training cho COACH chạy `findActiveCoachIdByUserId` → `isCoachAssignedToFighter` → `findSessions` (data + count) nối tiếp (`training/training-access.service.ts:54-89`, `training/training.repo.ts:499`). Bouts có `assertReadAccess` riêng (`bouts/bouts.service.ts:2084`).
- **Phạm vi:** (1) Cache `userId → coachId/doctorId/fighterId` trong `TtlCache` 60 s (xoá cùng `invalidateAuthCache`). (2) Khi có `fighterId`, gộp kiểm tra phân công vào truy vấn danh sách (điều kiện `EXISTS` đã có sẵn cho COACH ở `training.repo.ts:512`), không chạy riêng. (3) Lấy `total` bằng `count(*) OVER()` trong cùng truy vấn, hoặc chạy data và count song song.
- **Tiêu chí nghiệm thu:** danh sách session của COACH có `fighterId` chạy ≤ 2 truy vấn khi cache ấm (test đếm repo); vẫn 403 khi võ sĩ không được phân công (test hiện có qua).
- **Lệnh:** lint, build, test.

### T-068 — Cache kết quả phân tích video đã xong

- **Bối cảnh:** `JobsService.getResult` (`nestjs-api/src/jobs/jobs.service.ts:184`) tải JSON kết quả từ Supabase Storage ở mọi lần xem, dù kết quả của job đã `COMPLETED` không đổi.
- **Phạm vi:** cache LRU trong bộ nhớ theo `jobId` (tối đa 50 mục hoặc 50 MB, TTL 10 phút); kiểm tra quyền vẫn chạy trước khi trả. Xoá mục khi job bị retry.
- **Tiêu chí nghiệm thu:** lần đọc thứ hai cùng job không gọi `storage.download` (test); actor không có quyền vẫn bị 403 dù kết quả đã nằm trong cache (test).
- **Lệnh:** lint, build, test.

### T-069 — Pool cấu hình được và đo được

- **Phạm vi:** `max` của pool đọc từ `DATABASE_POOL_MAX` (mặc định 20), ghi vào `.env.example`. Log cảnh báo khi `pool.waitingCount > 0` quá 1 s (bật bằng biến môi trường). Kèm thời gian xử lý mỗi request trong log khi `API_TIMING_LOG=1` (interceptor).
- **File:** `nestjs-api/src/database/database.module.ts:29`, `.env.example`, `src/shared/interceptors/`.
- **Tiêu chí nghiệm thu:** chạy được với `DATABASE_POOL_MAX` 10 và 30; test module đọc đúng biến.
- **Lệnh:** lint, build, test.

## 5. (C) Hạ tầng

| Việc | Ai | Ghi chú |
| --- | --- | --- |
| Nâng pool lên 20–30 (sau T-069) | Chủ dự án | Cổng 6543 (transaction mode) chịu được; tổng `max` của mọi máy chạy cùng lúc không vượt giới hạn của gói Supabase (xem Dashboard → Database → Connection pooling). Không dùng lại cổng 5432 (session mode, 15 kết nối, `docs/DEMO-API-MODE-SCRIPT.md:51`). |
| Chạy backend gần Supabase | Chủ dự án | Mỗi truy vấn qua mạng mất khoảng 20–40 ms. Nếu demo trên máy ở Việt Nam mà Supabase ở Singapore thì vẫn ổn; nếu ở US/EU thì đây là nguyên nhân gốc và nên đổi region hoặc deploy backend cùng region. Cần xác nhận region của project. |
| Luôn đo bằng `next start` | Mọi người | `next dev` chậm gấp 10 lần. |
| Nén HTTP backend | Không cần lúc này | Frontend gọi qua localhost. |
| Redis cache | Không cần lúc này | Một instance thì cache bộ nhớ là đủ; dùng Redis khi chạy nhiều instance. |
| Nén `public/models/fighter-body.glb` (714 KB) bằng meshopt, hoặc xoá nếu không còn dùng | Chủ dự án | `muscular-v6e-meshopt.glb` chỉ 189 KB. |

## 6. Cách đo lại

1. Build và chạy production: `pnpm --filter nextjs-frontend build` rồi `next start`, backend ở chế độ thường. Ghi rõ commit.
2. `API_TIMING_LOG=1` cho frontend: đếm số dòng `[api]` của mỗi trang và dòng chậm nhất. Ghi vào bảng: trang | số request | request chậm nhất | tổng.
3. `pnpm --filter nextjs-frontend ui:smoke` (`scripts/ui-smoke.mjs:167-170` in `page load: median … ms, slowest … ms`; `--shots` ghi `report-<locale>.json`). Chạy 3 lần, lấy trung vị; lần đầu tiên chạy để làm ấm cache xác thực.
4. Đo hai trường hợp: **ấm** (vừa mở trang khác dưới 15 s) và **nguội** (chờ hơn 60 s sau T-065). T-065 chủ yếu cải thiện trường hợp nguội.
5. Đạt mục tiêu khi: trung vị < 1 s, coach dashboard < 2 s, các màn bác sĩ < 1,5 s, fighter dashboard < 1,5 s, video header < 1 s, ở cả 3 lần chạy.

## 7. Lộ trình gợi ý

| Đợt | Việc | Kết quả dự kiến |
| --- | --- | --- |
| 1 (frontend, 1–2 ngày) | A1, A2, A3, A5 | Coach dashboard khoảng 3 s; tải cứng màn bác sĩ khoảng 2 s |
| 2 (backend song song) | T-065, T-069 + nâng pool, T-066 | Bớt phí xác thực khi cache nguội và hàng chờ pool; trung vị khoảng 1 s |
| 3 | T-063, T-064 rồi frontend dùng endpoint lô; A4 | Coach dashboard < 2 s; màn bác sĩ < 1,5 s; trang hiện nội dung chính < 1 s |
| 4 | A6, A7, A9, T-067, T-068 | Lần vào đầu nhẹ hơn khoảng 235 KB gzip; video < 2 s |
