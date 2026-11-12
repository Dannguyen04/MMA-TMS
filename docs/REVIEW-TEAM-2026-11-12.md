# Review công việc của team, 12/11/2026

- Người review: Claude (chỉ đọc, không sửa code, không đổi nhánh).
- Cơ sở: `git fetch origin` lúc 12/11; mọi nhánh remote có commit từ 25/10. Nhánh gốc để so: `origin/release/final-review` (`dc83fb7`) và `origin/fight-camp` (`1befea2`). `fight-camp` đã nằm trọn trong `release/final-review`.
- Kiểm chạy lại trong worktree tạm (đã xoá sau khi chạy): `C:/test/ai-worktrees/review-ken` (`User_Feature`), `C:/test/ai-worktrees/review-fon` (`feat/mobile-platform`). Không chép `.env`, không chạy `db:migrate`, không kết nối Supabase.
- Lưu ý: commit của Codex, Gemini và Claude mang tên người chạy agent (phần lớn 125 commit của Dan là tài liệu do Claude viết trên máy Dan). Báo cáo này chấm theo người chịu trách nhiệm nhánh, không tách được phần agent viết.

## Tổng quan nhánh (commit từ 25/10)

| Nhánh | Tác giả cuối | Ngày | Chưa có trong release | Chưa có trong fight-camp | Ghi chú |
| --- | --- | --- | --- | --- | --- |
| `User_Feature` | Ken | 10/11 | 2 | 2 | T-062 (dashboard HLV), T-064, script khởi động. Xung đột 1 file với release |
| `feat/mobile-platform` | Fon | 10/11 | 1 | 3 | App React Native (đóng băng) và tham số `order` ở backend. Merge sạch vào release |
| `feat/website-platform` | Fon | 10/11 | 0 | 2 | Đã gộp vào release (`4c7892c`, `1752cbb`). Lịch sử nhánh bị viết lại (xem mục Fon) |
| `feat/T-026-session-templates-ui` | Hoàng Anh | 25/10 | 5 | 5 | Mang migration 028, 029 đã áp lên Supabase nhưng chưa có trên nhánh nào khác |
| `feat/T-030-frontend-suspensions-sync` | Ken | 25/10 | 2 | 2 | Hai commit tài liệu cũ, gồm `docs/WORKING-RULES-CLAUDE-AGY.md` (nay không còn theo dõi trong git). Không nên merge |
| `main` | Fon | 31/10 | 2 | 2 | Merge PR #28 rồi revert (`cb6722b`). Bẫy revert khi đưa release lên main |
| `feat/ui-p1-p3`, `feat/ui-foundation`, `feat/T-009-nutrition-ui` | Hoàng Anh | 3/11 | 0 | — | Đã gộp vào release |
| `feat/T-040-merge-demo-branches`, `feat/T-030-suspension-ui`, `feat/T-033-…`, `feat/T-046-…` | Dan | 29/10–2/11 | 0 | 0 | Đã merge |
| `fix/T-035-…`, `feat/T-036-…`, `fix/T-036-a2-…`, `feat/T-045-…` | Ken | 29/10 | 0 | 0 | Đã merge |

Số commit không phải merge từ 25/10 (mọi nhánh remote): Dan 125, Hoàng Anh 76, Ken 65, Fon 19.

---

## Ken (Kenn0679), backend, kiêm frontend phần đình chỉ và bác sĩ

### Đã làm

- **T-030 B1–B7** (29–31/10, `User_Feature` → `fight-camp`): lớp dữ liệu đình chỉ và sẵn sàng, thang cường độ, màn đình chỉ của HLV, xếp lại buổi `PENDING`, bảng sẵn sàng; hai lượt dọn code ("ponytail cuts") bớt khoảng 1.200 dòng.
- **T-035 A, B; T-036 A, A2; T-045 A** (29/10): đình chỉ chặn buổi tập theo loại và cường độ, đóng đường vòng `POST /coaching/assignments`, buổi bị chặn chuyển `PENDING` hoặc huỷ, tập lại theo bậc sau KO/TKO; migration 032.
- **T-009 A** (31/10): kế hoạch ăn theo giai đoạn, migration 026.
- **T-040 B** (31/10): script dữ liệu demo qua HTTP API, võ sĩ 7, `--only clearance`.
- **T-049** (31/10): chỉ xác nhận tập lại khi đình chỉ đang chờ xác nhận, mã lỗi `SUSPENSION_NOT_AWAITING_CLEARANCE`.
- **T-050 A, B** (3/11): kết thúc sớm đình chỉ `MEDICAL` có căn cứ, migration 033.
- **T-053 đến T-057** (4–5/11): hộp thoại kết thúc sớm, polish bảng phân loại bác sĩ, bấm cả hàng, dữ liệu demo đình chỉ, làn Đỏ/Vàng theo đình chỉ.
- **Chưa merge:** T-062 và T-064 trên `User_Feature` (10/11): dashboard HLV hiện đình chỉ đang hiệu lực, gộp việc theo giai đoạn trận, hero camp. Thêm `start_all.bat` hỏi chế độ demo (3000) hay API (3100).

### Kiểm chạy lại (`User_Feature`, `8c901ab`)

| Lệnh | Kết quả |
| --- | --- |
| `pnpm --filter nextjs-frontend lint` | exit 0 |
| `pnpm --filter nextjs-frontend typecheck` (với `APP_DATA_MODE=api`) | exit 0 |
| `vitest run` của `nextjs-frontend` (demo mode) | 124 file qua, 1 bỏ qua; **1258 test qua, 2 bỏ qua**, khớp handover T-064 |

### Đánh giá: **Tốt**

Khối lượng lớn nhất team trong hai tuần, mỗi phần có ticket, handover, review và test theo ca. Nghiệp vụ đình chỉ có cơ sở (quyết định 22–25). Vấn đề chủ yếu ở quy trình và một vài ca biên.

### Vấn đề

| # | Mức | Chỗ | Vấn đề | Tái hiện / cách sửa |
| --- | --- | --- | --- | --- |
| K1 | nên sửa | `docs/tickets/README.md` trên `User_Feature`; `docs/tickets/T-062-*.md` | **Trùng mã T-062.** Release đã có T-062 của Dan (`T-062-persistence-spec-off-shared-db.md`). Merge sẽ tự gộp README thành hai dòng T-062, hai ticket khác nhau cùng mã, và `T-062-HANDOVER.md`, `T-062-REVIEW.md` gắn nhầm ticket | `git merge-tree origin/release/final-review origin/User_Feature` không báo xung đột README, nên lỗi lọt qua lặng lẽ. Đổi mã ticket của Ken (ví dụ T-063, nếu chưa ai dùng) trước khi merge |
| K2 | nên sửa | `nextjs-frontend/src/app/(app)/coach/dashboard/page.tsx` | **Xung đột với release và trái hướng thiết kế.** Release bọc trang trong `workspace-editorial coach-editorial` (từ `40ec9fb` của Fon, chủ dự án đã gộp 9/11). T-062 của Ken bỏ style "editorial" theo chỉ đạo "giữ style cũ", và test `coach-dashboard-visual.test.ts:80` cấm chữ `editorial` trong hero | Chủ dự án chọn một hướng trước khi giải xung đột. Test của Ken render component, không render trang, nên dù chọn hướng nào test vẫn qua |
| K3 | nên sửa | `coach-hero.tsx:36`, `:62-64` | Võ sĩ lỡ ngày cân (ngày cân là hôm qua, trận hôm nay, chưa `WEIGHED_IN`): `Math.max(0, …)` cho ra `0` và nhãn "hôm nay cân", che mất việc chưa ghi cân chính thức. Reviewer của Ken đã nêu, chưa sửa | Bout `FIGHT_WEEK`, `weighInAt` = hôm qua, `boutAt` = hôm nay |
| K4 | nên sửa | `page.tsx:72` (User_Feature) | `nullIfServiceFails(listSuspensions(...))`: quá 500 đình chỉ thì `PAGINATION_LIMIT_EXCEEDED` bị nuốt, khối đình chỉ và số "đang đình chỉ" ở hero về 0 mà không báo. Tương tự K3, khi dịch vụ trận lỗi, hero hiện "Chưa có trận nào" như trạng thái trống | Lọc `active` ở backend, hoặc hiện câu "không tải được" khi kết quả là `null` |
| K5 | gợi ý | `start_all.bat:90` | `choice` chặn chờ bàn phím, nên chạy không tương tác (script, lịch) sẽ treo. Supabase redirect allowlist có thể chưa có `localhost:3100` cho luồng đặt lại mật khẩu | Thêm tham số `demo`/`api` để bỏ qua câu hỏi |
| K6 | nên sửa (quy trình) | `fight-camp` `1befea2`, `a4aad3b`, `2ab1e97`, `86b26ac`, `e80d671`, `a40c499` | Ken tự merge `User_Feature` vào `fight-camp` 6 lần (31/10–5/11). TEAM-WORKFLOW §1 và §3a: dev không merge vào nhánh tích hợp | Từ nay để chủ dự án hoặc Dan merge |
| K7 | nên sửa (quy trình) | T-050, README dòng T-050 | Ticket ghi "Ken áp migration 033 lên Supabase", nhưng ngày 9/11 phát hiện 033 chưa có trên Supabase (Claude áp lại). Dev không được chạy `db:migrate:*` (§3a, §4.5). Ghi "đã áp" khi chưa áp làm sai lệch trạng thái database | Áp migration chỉ do chủ dự án hoặc người được giao từng lần, và ghi lại output |
| K8 | gợi ý | T-053 đến T-064 | Review là "Claude (lead) tự kiểm" trên máy Ken, cùng phiên với người giao việc. Có subagent review độc lập, nhưng chưa có review của phiên Claude điều phối team | Nhánh chưa merge (`User_Feature`) nên có một lượt review từ phiên điều phối trước khi vào release |

### Việc tiếp theo nên giao

1. Đổi mã ticket T-062 trên `User_Feature`, sửa K3, K4, rồi chờ chủ dự án chốt K2 để merge vào release.
2. T-052 (dữ liệu demo có bác sĩ) đang DRAFT; T-031 (tách `suggestSuspensions`) trong backlog.
3. Phần C của T-035 (tái hiện ở API mode) vẫn chờ người có `.env`; Ken có `.env`, nên nhận phần này.

---

## Dan (Dannguyen04), backend, merge và áp migration

### Đã làm

- **T-010B, T-004 sync** (26/10): thẻ góc đài, ghi hiệp, lời dặn giữa hiệp, đồng bộ hợp đồng demo.
- **T-033** (27/10): màn soạn phân tích đối thủ, gợi ý quan sát từ video bằng Gemini.
- **T-037 A** (28/10, migration 030), **T-038 A** (28/10, migration 031, AI chiến thuật và lời dặn, có timeout theo loại ở `bout-ai.client.ts`), **T-039** (đo AI xem video trực tiếp, kết quả âm tính), **T-044 A** (xoá 18 file thừa), **T-046** (nhúng YouTube trên tên miền `youtube-nocookie`, có test cho `youtubeVideoId`).
- **T-012, T-015, T-016, T-022** (25/10): demo worker, dịch training, health, clearance.
- **T-040 A** (2/11): gộp chuỗi nhánh demo vào `fight-camp` (`cd14511`), sửa C1, C2 (`98a266c`).
- Merge, ghi trạng thái và áp migration 023–032 lên Supabase.

### Đánh giá: **Tốt ở phần đã giao; hai tuần cuối hầu như không có code**

Commit code cuối là 2/11 (`98a266c`, 7 dòng). Sau đó chỉ có tài liệu và merge. Phần code 26–29/10 có test đủ (T-038 có 511 dòng spec service, 225 dòng spec client).

### Vấn đề

| # | Mức | Chỗ | Vấn đề | Cách sửa |
| --- | --- | --- | --- | --- |
| D1 | **chặn** | `nestjs-api/src/**/coaching-loop-persistence.spec.ts` ([T-062 của Dan](tickets/T-062-persistence-spec-off-shared-db.md), READY) | Spec backend ghi dữ liệu rác vào Supabase mỗi khi ai đó chạy `pnpm --filter nestjs-api test` có `.env`. Ngày 9/11 phải xoá 984 tài khoản rác. Definition of Done (§5) bắt mọi người chạy lệnh này, nên lỗi tái phát ở mỗi ticket backend | Làm T-062 ngay: spec chỉ chạy trên PostgreSQL tạm như `test:db` |
| D2 | nên sửa | T-047 bước 0 | Chờ Dan chấm tay hiệp 1 và đặt video từ 29/10, chưa có tiến triển | Quyết định làm hay đóng ticket sau review cuối |
| D3 | gợi ý | `fight-camp` | Release đi trước `fight-camp` 64 commit, 507 file. Dan là người merge release vào `fight-camp` theo kế hoạch 9/11 | Xem thứ tự ở mục cuối |

### Việc tiếp theo nên giao

1. T-062 (persistence spec), mức chặn.
2. Merge release vào `fight-camp` theo thứ tự ở mục cuối, gồm xử lý migration 028, 029 (O1).
3. T-044 B (bỏ demo mode) nếu dự án còn tiếp sau review cuối.

---

## Fon (fogit-hd, phong.huynhdung), mobile web, màn bác sĩ

### Đã làm

- **T-032** (27/10): hotfix backend không khởi động vì `Date` trong JSON Schema, đổi tên `AssignCoachDto`. Đã duyệt, merge.
- **App React Native** (27/10, 7 commit khoảng 30.000 dòng; 1/11 `8c41af9`, 341 file): vào `fight-camp` qua **PR #29** (`66c0887`, Fon tự merge trên GitHub ngày 1/11). Commit `8c41af9` còn đổi toàn bộ cổng bác sĩ trên web (dashboard, examinations, fighters, ai-alerts…) và thêm `.github/hooks/impeccable.json`.
- **Màn bác sĩ trên web** (`feat/website-platform`, 9–10/11: `2727090` 117 file, `59d7661` 25 file; `40ec9fb` 169 file dịch giao diện): chủ dự án đã gộp vào release (`4c7892c`, `1752cbb`) sau khi giải 54 file xung đột.
- **Chưa merge:** `fc72735` trên `feat/mobile-platform` (10/11): màn soạn phân tích đối thủ trên app React Native, tham số `order=desc` cho `GET /bouts`, hai file HTML xem trước.
- **Revert trên `main`** (31/10): `cb6722b` revert PR #28.
- Ticket được giao nhưng không làm: T-006 C (cân chính thức trên điện thoại, hạn 29/10), T-009 B, T-037 B, T-041, T-048. Claude và chủ dự án đã làm thay trên release (9/11).

### Kiểm chạy lại (`feat/mobile-platform`, `fc72735`)

| Lệnh | Kết quả |
| --- | --- |
| `vitest run src/bouts/bouts.model.spec.ts src/bouts/bouts.repo.spec.ts` (nestjs-api) | 2 file, 93 test qua |
| `pnpm --filter nestjs-api lint` / `build` | exit 0 (chỉ cảnh báo có sẵn) / exit 0 |
| `jest src/screens/fight-camp src/theme/splash.test.ts` (reactnative-mobile) | 18/19 suite qua, **1 test lỗi** ở `camp-columns.test.tsx` khi chạy chung; chạy riêng thì 13/13 qua (test không ổn định khi máy tải nặng) |
| `tsc --noEmit` (reactnative-mobile) | 41 lỗi, phần lớn là lỗi môi trường có sẵn (`fs`, `__dirname`, `global.css`), chưa có baseline để so |

### Đánh giá: **Cần cải thiện**

Có năng lực UI và viết test cho phần mình làm, nhưng phần lớn công sức hai tuần nằm ngoài phạm vi (app React Native đang đóng băng, các trang bác sĩ đóng băng), commit không theo quy ước, và hai lần thay đổi lịch sử hoặc merge không qua review.

### Vấn đề

| # | Mức | Chỗ | Vấn đề | Tái hiện / cách sửa |
| --- | --- | --- | --- | --- |
| F1 | **chặn** (cho merge lên `main`) | `main` `cb6722b` | **Bẫy revert.** `main` có merge PR #28 rồi revert. Các commit của PR #28 cũng nằm trong release, nên khi merge release vào `main`, git coi chúng đã có và giữ nguyên bản revert | `git merge-tree --write-tree origin/main origin/release/final-review` cho 159 xung đột, và cây kết quả xoá 212.045 dòng so với release (ví dụ `reactnative-mobile/src/screens/video-ai` còn 4/9 file). Trước khi merge: `git revert cb6722b` trên `main` (revert lại bản revert), hoặc merge `main` vào release rồi giữ phía release |
| F2 | nên sửa (phạm vi) | `reactnative-mobile/**` (PR #29, `fc72735`) | App React Native **đóng băng** ([Phạm vi, dòng Mobile](SCOPE-FIGHT-CAMP.md#giữ-gộp-đóng-băng); quyết định 18: "app React Native vẫn đóng băng"). Khoảng 40.000 dòng mới không có ticket | Chủ dự án quyết giữ hay để ngoài release. Nếu giữ, cần ticket ghi nhận ngoại lệ |
| F3 | nên sửa (quy trình) | `fight-camp` `66c0887` | Fon tự merge PR #29 (657 file, +46.869 / −10.029) vào nhánh tích hợp ngày 1/11, không qua review (§1, §3a). T-040 A sau đó phải xử lý hậu quả ("changes requested after merging fight-camp 66c0887") | Dev không bấm merge PR vào `fight-camp` hay `main` |
| F4 | nên sửa (quy trình) | `feat/website-platform` | **Nhánh bị viết lại sau khi đã được merge.** `40ec9fb` và `2727090` cùng cha `1befea2`; `40ec9fb` đã vào release (`4c7892c`) nhưng không còn trên nhánh. §3 cấm force push | So `git log origin/feat/website-platform` với `git branch -r --contains 40ec9fb`. Nếu muốn bỏ một commit, dùng `git revert` |
| F5 | nên sửa | `fc72735`: `nestjs-api/src/bouts/bouts.model.ts:907`, `bouts.repo.ts:322-338`, `bouts.service.ts:375` | Fon sửa backend (`order` cho `GET /bouts`) trong commit app mobile, không ticket, không qua Ken hoặc Dan. Code đúng: con trỏ đảo chiều khi `desc`, có test SQL và schema, mặc định giữ `asc` nên không phá caller cũ | Tách thành commit riêng có mã ticket; nhờ backend duyệt |
| F6 | nên sửa | `59d7661`: `coach/bouts/suspensions/t050-early-end.test.ts:753` | Sửa kỳ vọng test của Ken (`"Fighter One"` thành `"Bản đồ cơ thể"`) để khớp layout mới. Ca W9 vốn kiểm tên võ sĩ vẫn hiện khi đình chỉ lỗi; nay không còn kiểm điều đó | Kiểm tên võ sĩ ở header layout, hoặc hỏi Ken trước khi đổi kỳ vọng |
| F7 | gợi ý | Commit `59d7661`, `2727090`, `40ec9fb`, `fc72735`, `8c41af9` | Message chung chung ("Refactor code structure for improved readability…"), không có mã ticket (§3); một commit gộp nhiều việc (dịch, UI bác sĩ, sửa panel đình chỉ của Ken) | Một commit một việc, kèm `T-xxx` |
| F8 | gợi ý | `design-previews/phan-tich-doi-thu.html`, `phan-tich-doi-thu-v2.html`, `cap-giay-phep.html`; `.github/hooks/impeccable.json` | File nháp thiết kế và cấu hình hook cá nhân bị commit vào nhánh chung | Để ngoài git, hoặc một thư mục có README nói rõ mục đích |
| F9 | gợi ý | `reactnative-mobile/src/screens/fight-camp/camp-columns.test.tsx` | Lỗi khi chạy chung bộ, qua khi chạy riêng (ca đầu mất 1,3 s) | Tăng timeout hoặc tách phần render nặng |

### Việc tiếp theo nên giao

1. Xử lý F1 cùng chủ dự án (revert bản revert trên `main`) trước khi ai đưa release lên `main`.
2. Nếu còn làm tiếp: một ticket web cho điện thoại trong phạm vi (ví dụ T-047 phần màn hình, hoặc kiểm T-041 và T-048 trên điện thoại thật), không phải React Native.
3. Tách phần backend của `fc72735` thành commit riêng có ticket nếu chủ dự án muốn giữ `order=desc`.

---

## Hoàng Anh (chủ dự án, frontend)

### Đã làm

- **T-042, T-043** (30–31/10): model 3D cơ thể võ sĩ, UI sinh động, hoạt hoạ. APPROVED lần 2.
- **T-006 B, T-030 phần còn lại, T-032, T-049 phía UI, T-058 đến T-061** (lệnh đọc phụ không làm sập trang, phiếu khám chịu được lỗi một phần).
- **UI P0–P3, ui-foundation, T-009 B1, B3** (3/11), gộp vào release.
- **`release/final-review`** (9–10/11): gộp các nhánh UI, nhánh của Fon (giải 54 file xung đột, ghi lý do trong message merge), UAT ở API mode 17/17 cho bốn vai trò, run-sheet cho buổi 10/11, sửa 3D, roster.
- Kiểm lại release (`dc83fb7`): `vitest run` của `nextjs-frontend` 138 file qua, 1 bỏ qua; **1368 test qua, 2 bỏ qua**.

### Đánh giá: **Tốt**

Release có tài liệu đi kèm (RELEASE-FINAL-REVIEW, UAT), message merge giải thích từng nhóm xung đột, test xanh. Còn hai việc treo.

### Vấn đề

| # | Mức | Chỗ | Vấn đề | Cách sửa |
| --- | --- | --- | --- | --- |
| O1 | **chặn** (cho database và cho người dựng môi trường mới) | `feat/T-026-session-templates-ui`; `nestjs-api/migrations/` trên release | **Migration 028, 029 đã áp lên Supabase (20/10) nhưng file chỉ nằm trên nhánh T-026, chưa merge từ 25/10.** Release có 025–027 rồi nhảy sang 030–033. Supabase và repo lệch nhau: ai dựng database mới từ repo sẽ thiếu bảng mẫu giáo án và loại buổi `tactical_analysis`, còn `migration_history` trên Supabase có hai bản ghi không có file | `git ls-tree origin/release/final-review nestjs-api/migrations/` không có `028_*`, `029_*`. Merge T-026 sẽ xung đột ở `migrations/README.md`, `manifest.json`, `package.json`, `run_sql.mjs`, `migration-files.mjs`, `test-migrations.mjs`, `training.*` và 7 file frontend; nên giao một người giải xung đột rồi chạy `test:db` |
| O2 | nên sửa | `release/final-review` | Release đi trước `fight-camp` 507 file. Ken và Fon vẫn tạo nhánh từ `fight-camp`, nên mỗi ngày chưa đồng bộ là thêm xung đột (K2 là ví dụ) | Đưa release vào `fight-camp` sớm, theo thứ tự ở mục cuối |
| O3 | gợi ý | `docs/tickets/README.md` (dòng "Người nhận") | README ghi "Dan (chủ dự án, backend…)", trong khi quy trình coi Hoàng Anh là chủ dự án. Dễ gây hiểu nhầm ai được merge, ai được áp migration | Ghi rõ ai giữ quyền merge và áp migration |

### Việc tiếp theo nên giao (cho chính mình hoặc giao lại)

1. Giải O1: merge T-026 (sau khi merge release vào nhánh) hoặc ít nhất đưa file 028, 029 cùng manifest vào release.
2. Chốt K2 (giữ hay bỏ style editorial trên dashboard HLV) để Ken merge.
3. Chốt F2 (app React Native có vào release không).

---

## Toàn team: thứ tự merge và xung đột dự kiến

### Thứ tự đề xuất

1. **Trước mọi merge:** Dan làm T-062 (persistence spec, D1), để không ai ghi rác vào Supabase khi chạy test sau merge.
2. **`feat/T-026-session-templates-ui` vào `release/final-review`** (O1). Merge release vào nhánh T-026 trước, giải xung đột migration (giữ số 028, 029; thêm vào `manifest.json`, `migration-files.mjs`, script `db:migrate:028/029`, ca trong `test-migrations.mjs`), chạy `test:db`, `db:check`, lint, typecheck, test frontend. Không áp lại 028, 029 lên Supabase (đã áp).
3. **`User_Feature` vào release** sau khi Ken đổi mã T-062 (K1) và chủ dự án chốt K2. Xung đột dự kiến: chỉ `coach/dashboard/page.tsx` (release đổi 4 dòng wrapper editorial; Ken viết lại cả trang). `en.ts`, `vi.ts`, `docs/tickets/README.md` tự gộp được.
4. **`feat/mobile-platform` (`fc72735`)** chỉ khi chủ dự án giữ app React Native (F2). Merge sạch vào release (không xung đột). Nếu không giữ: chỉ lấy phần backend `order=desc` qua một commit riêng, hoặc bỏ.
5. **Release vào `fight-camp`.** `fight-camp` hiện là tổ tiên của release, nên nếu không ai đẩy thêm vào `fight-camp` trước bước này, có thể fast-forward. Sau đó mọi nhánh ticket tạo lại từ `fight-camp`.
6. **`fight-camp` vào `main`** chỉ sau khi xử lý bẫy revert F1 (`git revert cb6722b` trên `main`, chạy lại test). Không xử lý thì `main` mất khoảng 212.000 dòng của app mobile và gặp 159 xung đột.

### Không merge, đề nghị xoá sau khi chủ dự án đồng ý

- `feat/T-030-frontend-suspensions-sync` (2 commit tài liệu cũ, gồm file rule agent nay không còn theo dõi trong git).
- Các nhánh đã merge hết: `feat/T-040-merge-demo-branches`, `feat/T-030-suspension-ui`, `feat/T-033-opponent-analysis-ui`, `feat/T-046-embedded-youtube`, `fix/T-035-suspension-gate`, `feat/T-036-suspension-plan-link`, `fix/T-036-a2-pending-on-clearance`, `feat/T-045-graded-return`, `feat/ui-p1-p3`, `feat/ui-foundation`, `feat/T-009-nutrition-ui`.

### Rủi ro chung

- **Không có secret bị commit.** Quét các commit từ 25/10 tìm khoá Google, JWT, chuỗi kết nối Postgres có mật khẩu, `service_role`: không thấy. Chỉ có `nestjs-api/.env.example` (mẫu) và script đọc `SUPABASE_SERVICE_KEY` từ biến môi trường (`scripts/create_buckets.mjs` trên `main`).
- **Các file hay đụng nhau** (`en.ts`, `vi.ts`, `labels.ts`, `docs/tickets/README.md`) vẫn là nguồn xung đột; merge `User_Feature` và T-026 nối tiếp nhau, không song song.
- **Ba người đã tự merge vào nhánh chung** (Ken vào `fight-camp`, Fon qua PR #29 vào `fight-camp` và PR #28 vào `main`). Đề nghị bật bảo vệ nhánh `fight-camp`, `main` và `release/final-review` trên GitHub (yêu cầu PR và một người duyệt). Chủ dự án tự bật trong cài đặt repo.
