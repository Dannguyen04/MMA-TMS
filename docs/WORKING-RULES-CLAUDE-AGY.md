# Quy định làm việc: Claude (lead) và `agy` (người viết code)

Ghi lại ngày 25/10/2026 theo quyết định của chủ dự án trong phiên làm T-029 và T-007. Đây là quy định của **chủ dự án với Claude**, không phải của cả nhóm dev; bản chính ở máy chủ dự án là `CLAUDE.local.md` (không commit) và mục 0 của `docs/TEAM-WORKFLOW.md` (bản cục bộ). File này giữ lại để đổi máy không mất. Khi mâu thuẫn với [TEAM-WORKFLOW.md](./TEAM-WORKFLOW.md) bản commit thì theo file này, chỉ với công việc của Claude và `agy`.

## 1. Vai trò
- **Claude là lead:** nhận việc từ chủ dự án hoặc ticket, lập kế hoạch, viết ticket và tài liệu trong `docs/`, soạn prompt, giao việc cho `agy`, review diff, chạy lại kiểm tra, viết báo cáo review. Phạm vi là cả backend (`nestjs-api`), frontend (`nextjs-frontend`) và điện thoại (`reactnative-mobile`).
- **`agy` (Antigravity) viết toàn bộ code production, migration và test.** Claude không tự viết các thứ này. Phát hiện lỗi thì soạn prompt sửa cho `agy`. (T-029 là ngoại lệ do hiểu nhầm vai trò lúc đầu, handover ghi người thực hiện là Claude.)
- Chủ dự án quyết định phạm vi, duyệt tên mới, commit, push, merge và áp migration lên database thật.

## 2. Nhánh và thư mục
- Làm trên **nhánh đang checkout** (mặc định `User_Feature`), trong thư mục làm việc chính. Không tạo nhánh `feat/T-xxx-…` và không tạo git worktree, **trừ khi chủ dự án bảo tạo** (ví dụ nhánh `feat/T-030-frontend-suspensions-sync`).
- Không đổi nhánh khi chủ dự án chưa bảo.
- Không push, không merge vào `fight-camp` hay `main`, không chạy `db:migrate:*`, không chạy SQL lên Supabase, không đọc hay commit `.env`, trừ khi chủ dự án yêu cầu trực tiếp cho từng lần.
- Commit do chủ dự án làm (`Kenn0679`). Claude và `agy` không commit. Nếu HEAD đổi giữa chừng vì chủ dự án commit, kiểm tra commit chỉ chứa file đã review rồi tiếp tục.

## 3. Chạy `agy`
- Một phiên `agy` tại một thời điểm. Trong lúc nó chạy, Claude không sửa file.
- Lệnh (từ `D:/MMA-TMS`): `agy -p "<prompt>" --dangerously-skip-permissions --model <model>`. Lấy danh sách model bằng `agy models`.
- **Model:** việc nặng (migration, module mới, nhiều file) dùng `gemini-4-argon-high` (chủ dự án muốn `high`, không phải `medium`) với prompt viết kỹ. Việc nhỏ dùng `gemini-3.8-flash-high`. Ngày 25/10 `argon` hết quota (HTTP 429, "resets in 88h"), chủ dự án chọn `gemini-3.8-flash-high` cho phần còn lại của T-007. Mô hình `claude-sonnet-5-5-high` cũng chạy được qua `agy` nhưng chưa dùng.
- **Chạy ẩn**, không mở cửa sổ terminal (chủ dự án không muốn): chạy lệnh nền, đầu ra ghi ra file log trong `D:\test\ai-worktrees\logs\`, mã thoát ghi vào file `T-007-<lượt>-exit.txt`. Đừng đóng cửa sổ khi `agy` đang chạy: đóng là ngắt lượt (`error: interrupted`).
- Chế độ `--output-format text` không in mã hội thoại, nên lượt sửa là phiên **mới** với prompt sửa đầy đủ. Chế độ `json` có `conversation_id` để nối phiên bằng `agy --conversation <id> -p "..."`.
- Tiến trình `agy.exe --hub` (daemon của Antigravity, chạy cả ngày) **không phải** lượt chạy; không kill.
- Sau mỗi lượt kiểm tra: nhánh còn đúng, HEAD không đổi ngoài ý muốn, không có nhánh mới, remote không có nhánh hay commit mới (`git ls-remote --heads origin | wc -l` cùng số trước đó).

## 4. Quy trình một ticket nặng (đã dùng cho T-007)
1. Lập spec (file cần sửa, giao diện, luồng nghiệp vụ), chủ dự án duyệt trước khi viết prompt.
2. Chia **lượt** theo thứ tự phụ thuộc (T-007: A migration và module đình chỉ, B Cổng 2, C xử lý lịch xung đột, D bảng sẵn sàng và cảnh báo R4 và nguồn thẻ việc, E R27, F và G sửa lỗi). Mỗi lượt có prompt gồm: bối cảnh, mục tiêu, phạm vi được sửa (scope lock), phạm vi cấm, test bắt buộc, lệnh kiểm tra, điều kiện dừng và hỏi.
3. Sau mỗi lượt, một **cổng kiểm tra**: nhánh và HEAD, file đổi nằm trong scope lock (so dấu vân tay sha256 trước và sau), `lint`, `build`, `test`, `test:db`, `db:check`, đọc phần handover, so đầu ra dán trong handover với lần chạy lại.
4. Lỗi ngoài baseline: tối đa 2 lần gửi `agy` sửa mỗi lượt, rồi dừng và báo.
5. Cuối cùng một reviewer độc lập (subagent chỉ đọc) soát diff, Claude tự kiểm chứng từng phát hiện trong code rồi mới giao lượt sửa. Claude đọc kỹ phần dễ sai nhất (logic nghiệp vụ, giao dịch, phân quyền theo bản ghi) thay vì chỉ tin test.
6. Có thể giao một **manager** (subagent) chạy tuần tự các lượt B đến cuối theo brief, nhưng nó chỉ chạy, kiểm tra và báo; mọi quyết định (đổi model, nhận commit lạ, sửa phạm vi) thuộc về Claude và chủ dự án.

**Baseline ngày 25/10 (không tính là lỗi mới):** `pnpm --filter nestjs-api test` có đúng 26 test lỗi (5 ở `test/coaching-loop-persistence.spec.ts`, 21 ở `test/dataset-export-trust-boundary.spec.ts`, cần Redis và Supabase) cộng 4 file `src/notifications/*.spec.ts` rỗng báo "0 test" (6 file lỗi). Sau T-007 backend: 999 test qua; `test:db` 45 nhóm; `db:check` "001-027 checksums OK". Frontend trên `User_Feature`: typecheck 52 lỗi có sẵn và 10 test lỗi ở `lib/actions/medical-contract.test.ts`, không thuộc T-007, T-029.

## 5. Stop-and-ask
Hỏi chủ dự án **trước khi** viết vào prompt hay code: mã lỗi mới, mã trạng thái, endpoint, tên trường, tham số truy vấn, giá trị enum, thay đổi cơ sở dữ liệu hoặc số liệu nghiệp vụ mà tài liệu chưa có. Nói rõ tên nào do Claude đề xuất. Prompt cho `agy` liệt kê chính xác các tên được phép; `agy` thấy thiếu thì ghi câu hỏi vào handover và dừng.

**Tên đã được chủ dự án duyệt (T-007 và T-029):**
- Mã lỗi: `SUSPENSION_NOT_FOUND`, `SUSPENSION_ALREADY_CLEARED`, `SUSPENSION_DAYS_REQUIRED`, `SUSPENSION_OVERRIDE_REASON_REQUIRED`, `TRAINING_SUSPENSION_ACTIVE`.
- Endpoint: `GET /suspensions`, `POST /suspensions`, `POST /suspensions/:id/clear`, `GET /suspensions/:id/conflicts`, `POST /suspensions/:id/conflicts/apply`, `GET /readiness`, `GET /bouts/feasibility`, `GET /coach/todo`.
- Cảnh báo tạo trận: `WEIGHT_AT_RISK`, `WEIGHT_INSUFFICIENT_DATA`, `FIGHTER_ACTIVE_BOUT`, `FIGHTER_SUSPENDED_PAST_BOUT_DATE`.
- Nhắc cân: `weightReminder` với `ASK_TODAY`, `YESTERDAY_MISSING`.
- Trạng thái cân: `ON_TRACK`, `ABOVE_TARGET`, `OVER_LIMIT`, `NOT_WEIGHED`, `NEUTRAL`.
- `GET /readiness`: tham số `weightLimitKg`, `rulesetId`, `boutOn`; trường `ready`, `status`, `notReadyReasons`, `latestWeightKg`, `activeBout`, `suspension`, `feasibility`. Mã nguồn việc `SUSPENSION_AWAITING_CLEARANCE`, `TRAINING_CONFLICTS_WITH_SUSPENSION`. `recordResult`: `suspensionDays`, `suspensionOverrideReason`, mảng `suspensions` trong phản hồi.

**Quyết định nghiệp vụ đã chốt:** đình chỉ tạo thủ công nhận `days` và `startsOn` (không trước hôm nay); `ends_on = starts_on + days - 1`; kết thúc sớm cho mọi lý do, HLV hoặc bác sĩ, bắt buộc ghi căn cứ, `ends_on` giữ nguyên; `requires_clearance` suy từ lý do (KO, TKO luôn cần); đình chỉ tự tạo từ kết quả bắt đầu từ ngày ghi kết quả; khi cả hai cổng chặn thì giữ mã y tế và thêm `details.suspensions`; module `SuspensionsModule` riêng; từ `WEIGHED_IN` trạng thái cân là `NEUTRAL`; nhắc cân chỉ trong `FIGHT_WEEK`; khả thi cân chỉ tô màu khi còn từ 7 ngày trở xuống đến buổi cân; không có nút "hôm nay không cân".

## 6. Bài học từ phiên 25/10
- Đọc phần dễ sai của code `agy` viết, đừng chỉ tin test: ca "võ sĩ thắng do đối thủ bị truất quyền vẫn bị đình chỉ" và các chỗ `typeof ... === 'function'` chiều theo mock chỉ lộ ra khi đọc code.
- Cấm `agy` viết các nhánh `@Optional()`, `?.` hay `typeof` chỉ để vừa với mock: lỗi cấu hình sẽ im lặng, đặc biệt ở đường ghi kết quả trận.
- Ghi dấu vân tay file trước mỗi lượt để biết lượt đó chạm file nào (nhất là khi lượt trước làm dở).
- Đừng kill PID chỉ vì nó là `agy.exe`; kiểm tra dòng lệnh (`--hub`).
- `git stash` nhầm sẽ cuốn đi thay đổi chưa commit: không dùng khi không cần.

## 7. File rules cục bộ và đổi máy
- `CLAUDE.md` và `nestjs-api/CLAUDE.md` đã commit là bản cũ ("fullstack" hoặc "Claude không viết code"). Bản đúng nằm ở `CLAUDE.local.md` (gốc repo) và `nestjs-api/CLAUDE.local.md`, được git bỏ qua bằng `.git/info/exclude`, với dòng đầu ghi rõ nó thay thế bản commit.
- `docs/TEAM-WORKFLOW.md` có bản sửa cục bộ (mục 0 và dòng Claude trong bảng vai trò, cùng dòng `agy --model <model>`), đang bật `skip-worktree` nên không bị commit.
- Bản sao nằm ở `E:\MMA` (xem `E:\MMA\README-RESTORE.md`). Trên máy mới:
```bash
cd /d/MMA-TMS
cp /e/MMA/CLAUDE.local.md CLAUDE.local.md
cp /e/MMA/nestjs-api/CLAUDE.local.md nestjs-api/CLAUDE.local.md
echo "CLAUDE.local.md" >> .git/info/exclude
cp /e/MMA/docs/TEAM-WORKFLOW.md docs/TEAM-WORKFLOW.md
git update-index --skip-worktree docs/TEAM-WORKFLOW.md
```
- Phiên Claude kế tiếp nên kiểm tra mình có thấy nội dung `CLAUDE.local.md` hay không. Nếu không, Claude Code của máy đó không đọc file này: hỏi chủ dự án rồi dùng cách `skip-worktree` cũ trên hai file `CLAUDE.md`.
- Prompt, launcher và brief manager của T-007 nằm ở `E:\MMA\agy-prompts\` để chạy lại khi cần.
