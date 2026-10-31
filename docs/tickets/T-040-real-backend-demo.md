# T-040 · Gộp nhánh demo vào `fight-camp`, chạy mọi màn trên backend thật

| | |
| --- | --- |
| **Trạng thái** | READY (30/10) |
| **Người nhận** | A: Claude (phần git, theo [TEAM-WORKFLOW §3a](../TEAM-WORKFLOW.md#3a-cách-giao-việc) mục "Claude làm phần git trước khi giao"). B: Ken. C: cả nhóm, mỗi người kiểm màn của mình. D: người làm màn có lỗi |
| **Nhánh** | A: `feat/T-040-merge-demo-branches`, tạo từ `fight-camp`. B: `feat/T-040-demo-seed`, tạo từ `fight-camp` sau khi A merge. D: `fix/T-040-<màn>` |
| **Mốc** | A xong trước 2/11. B xong trước 5/11. C, D trong đợt 2 (6–9/11). Tổng duyệt 9/11, review 3 (cuối) ngày 10/11 |
| **Nguồn** | [Nhận xét 27/10, mục 4](../REVIEW-27-10-FEEDBACK.md#4-backend-thật-và-độ-ổn-định): "Demo phải chạy backend thật". Gộp T-008 (dữ liệu demo theo giai đoạn, [nestjs-api/docs/modules/11-demo-seed.md](../../nestjs-api/docs/modules/11-demo-seed.md)) |
| **Phụ thuộc** | Migration 023–032 đã áp lên Supabase (xong 30/10). A không chờ [T-030](./T-030-frontend-suspensions-sync.md) B. Gộp T-042/043 cần review APPROVED |

## 1. Bối cảnh

Đến 30/10, các màn trong trận và sau trận chỉ có trên một chuỗi nhánh chưa merge, tách khỏi `fight-camp` từ `35a3b76` (26/10). `fight-camp` đã đi thêm 93 commit kể từ đó.

```text
feat/T-004-bout-lifecycle-ui (T-004, T-006 B)
  ⊂ sync/T-004-fight-camp (nhánh demo 27/10, có T-010B)
      ⊂ feat/T-033-opponent-analysis-ui (T-033, sửa T-010B 88f44e8)
          ⊂ feat/T-046-embedded-youtube (T-046)          ← đầu chuỗi 1
      ⊂ feat/T-042-043-ui-3d (T-042, T-043, dịch L0–L2)  ← đầu chuỗi 2
```

Kiểm bằng `git merge-tree` ngày 30/10:

| Gộp | Số file xung đột |
| --- | --- |
| `fight-camp` + `feat/T-046-embedded-youtube` | 21 |
| `fight-camp` + `feat/T-042-043-ui-3d` | 23 |
| `feat/T-046-embedded-youtube` + `feat/T-042-043-ui-3d` | 0 |
| `feat/T-030-suspension-ui` + `feat/T-046-embedded-youtube` | 36 |

Phần lớn xung đột cùng một dạng: `fight-camp` đã dịch câu sang khoá i18n (T-015, T-016), nhánh demo còn câu tiếng Anh cũ. Ví dụ `nextjs-frontend/src/lib/actions/training.ts`: bên `fight-camp` là `t("training.schema.exerciseListReadError")`, bên nhánh demo là chuỗi `"The exercise list couldn't be read…"`. Các file khác: trang dashboard HLV và võ sĩ, `fighter/health`, trang đăng ký và đặt lại mật khẩu, `components/dashboard/*`, `components/layout/navigation.ts` (dòng import icon và nhóm menu admin), `training.en.ts`, `training.vi.ts`, `docs/SCOPE-FIGHT-CAMP.md`, `docs/tickets/README.md`.

Frontend chạy demo mode mặc định khi không phải production (`nextjs-frontend/src/lib/auth/constants.ts:24`). Đặt `APP_DATA_MODE=api` để gọi backend thật. Chưa có script dữ liệu demo nào trong repo: T-008a và T-008 chưa làm.

## 2. Phạm vi

### Phần A · Gộp nhánh (Claude)

1. **Thứ tự gộp:**
   1. Không chờ T-030 B (quyết định ở mục 6). T-030 B chạm cùng file với nhánh demo (`status-badges.tsx`, `training.demo.ts`, `mocks/db.ts`, từ điển `coach-bouts`, `training`). Sau khi phần A merge, Ken merge `fight-camp` mới vào `feat/T-030-suspension-ui` và tự giải xung đột.
   2. Tạo `feat/T-040-merge-demo-branches` từ `fight-camp`, merge `--no-ff` `origin/feat/T-046-embedded-youtube`, gồm cả chuỗi T-004 lifecycle, nhánh demo, T-010B và T-033.
   3. Merge `--no-ff` `origin/feat/T-042-043-ui-3d`, chỉ khi T-042/043 đã APPROVED. Nếu chưa, để lại cho đợt sau.
2. **Cách giải xung đột:**
   - Câu đã thành khoá i18n ở `fight-camp` thì giữ khoá.
   - Phần mới của nhánh demo (route, component, khoá từ điển mới) thì thêm vào.
   - Không đổi hành vi của bên nào.
   - Xung đột không thuộc hai dạng trên thì ghi vào handover. Nếu đổi hành vi thì dừng lại, hỏi người làm ticket gốc.
3. **Sau khi gộp:**
   - Chạy đủ lệnh ở mục 5.
   - Liệt kê các file test của từng ticket nguồn (T-004, T-006 B, T-010B, T-033, T-046, T-042, T-043) và xác nhận chúng còn nguyên, vẫn qua.
4. Trong handover, ghi từng file xung đột và bên đã giữ.

**Thử gộp ngày 30/10 (Claude), đã huỷ lại:** merge `origin/feat/T-046-embedded-youtube` vào `fight-camp` (`1423ab6`) ra 21 file xung đột, 63 đoạn. Hai bên có hai merge base (`35a3b76` ngày 26/10 và `bd1e727` ngày 16/10).
- Hai file tài liệu: giữ bản `fight-camp`.
- 19 file code: phần lớn **không phải xung đột máy móc**.
  - `fight-camp` mất tính năng của PR #22 trên `main` (ví dụ `c339693` "stop calling the first password set-up a reset", hàm `passwordContext` trong `app/(auth)/auth/reset-password/page.tsx`). Lý do: bản dịch T-014 (`1944114`, 20/10) dựng trên `fight-camp` lúc chưa có PR #22, rồi lần merge `main` của T-011 (`509b62b`) giữ bản đã dịch. Nhánh demo giữ được cả bản dịch lẫn tính năng.
  - So khoá i18n và chuỗi tiếng Anh từng file:
    - Chỉ nhánh demo có thêm: `coach/dashboard/page.tsx` (7 khoá chỉ có ở demo).
    - Chỉ `fight-camp` có thêm, nhánh demo còn chữ tiếng Anh: `(applicant)/apply/page.tsx`, `components/admissions/application-form.tsx`, `application-progress.tsx`, `reset-password-form.tsx`.
    - Mỗi bên có phần riêng, phải trộn từng đoạn: `fighter/dashboard/page.tsx` (20 khoá chỉ có ở `fight-camp`, 6 chỉ có ở demo), `reset-password/page.tsx` (4 và 8), `components/dashboard/fight-hero.tsx` (4 và 22), `lib/actions/training.ts`.
    - Nhánh demo xoá `components/dashboard/onboarding-strip.tsx`, `fight-camp` có sửa file này.
  - Giải các file này là trộn code tính năng của hai dòng phát triển, nên theo mục 2 phải hỏi người làm gốc. Hoàng Anh làm cả chuỗi nhánh demo lẫn lần merge T-011.
- **Chủ dự án quyết 30/10:** giao Codex giải xung đột. Claude chuẩn bị worktree và bắt đầu merge, Codex giải từng đoạn theo quy tắc: giữ cả bản dịch của `fight-camp` lẫn tính năng của nhánh demo. Claude review.

### Phần B · Dữ liệu demo qua API (Ken; gộp T-008)

- Script `nestjs-api/scripts/demo-seed.mjs` tạo dữ liệu **chỉ qua HTTP API** của backend, không SQL trực tiếp. Dữ liệu phải đi qua đúng quyền, kiểm tra và audit ([quyết định 9](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi): chỉ dữ liệu giả, email `@example.com`).
- 5 võ sĩ, mỗi người một giai đoạn, theo bảng ở `nestjs-api/docs/modules/11-demo-seed.md`:
  1. Đang camp, có ngày thiếu cân.
  2. Tuần thi đấu, cân gần đỏ.
  3. Vừa cân xong.
  4. Đang đình chỉ, có buổi `SCHEDULED` bị xung đột và một buổi `PENDING`.
  5. Sẵn sàng.
- Thêm võ sĩ 6: một trận đã có kết quả thua KO, có ghi theo hiệp, phân tích đối thủ, kế hoạch hiệp sau (T-037) và gợi ý AI đã lưu (T-038). Võ sĩ này dùng cho thẻ góc đài, màn ghi hiệp và báo cáo trận.
- Ngày tính theo ngày chạy script, không "tua thời gian". Chạy lại không tạo trùng: tìm theo email hoặc tên sự kiện trước khi tạo.
- Có `--dry-run`: in ra các request sẽ gửi, không gửi.
- Token và URL đọc từ biến môi trường, không ghi vào file trong git.

#### B · Thiết kế và ca kiểm thử (Claude viết trước code, 31/10)

**Ràng buộc backend đã kiểm (`fight-camp` `77a95eb`):**
- Không tạo được trận có `boutAt` trong quá khứ (`BOUT_NOT_IN_FUTURE`, `bouts.service.ts:788`).
- Chỉ ghi được kết quả khi trận đã `WEIGHED_IN` và hôm nay (ngày học viện) không trước ngày thi (`bouts.service.ts:1566–1575`).
- Vì vậy trận của võ sĩ 6 xếp thi **trong ngày chạy script**, khoảng 23:00 giờ học viện, rồi đi đủ các bước: camp → tuần thi đấu → cân → kết quả thua KO. Không tua thời gian, không SQL.
- Sau 22:30 giờ học viện thì script dừng trước mọi request ghi và báo cần chạy lại sớm hơn.

**Cấu trúc:**
- Script `nestjs-api/scripts/demo-seed.mjs` tách làm hai phần:
  - Các hàm thuần, xuất ra để test: dựng kế hoạch theo `now`, phân loại request.
  - Phần chạy: đọc biến môi trường, gọi `fetch`.
- Test là `nestjs-api/scripts/demo-seed.test.mjs`, chạy bằng `node --test`. Test dùng một API giả trong bộ nhớ, thay `fetch`, giữ trạng thái giữa hai lần chạy. Không cài thư viện mới.
- Gọi AI thật (T-038) chỉ khi có cờ `--with-ai`. Ngay cả khi có cờ, chỉ gọi nếu trận chưa có gợi ý nào đã lưu.

| Ca | Đầu vào | Kết quả mong đợi | Lớp |
| --- | --- | --- | --- |
| S1 | `--dry-run`, API giả rỗng | Không có request `POST`/`PUT`/`PATCH`/`DELETE` nào tới API giả. Stdout in từng request ghi sẽ gửi (method và đường dẫn) | node:test, API giả |
| S2 | Chạy thật hai lần liên tiếp trên cùng API giả | Lần 1 tạo > 0 bản ghi. Lần 2 tạo 0 bản ghi, không có request ghi tạo mới nào. Mỗi lần in `created=<n> existing=<m>` | node:test, API giả |
| S3 | API giả đã có sẵn user email của võ sĩ 2 và một trận cùng tên sự kiện | Không gửi `POST /users` cho email đó, không gửi `POST /bouts` cho sự kiện đó. Các bản ghi còn thiếu vẫn được tạo | node:test, API giả |
| S4 | Kế hoạch dựng ở bất kỳ `now` nào | Mọi email trong kế hoạch kết thúc bằng `@example.com` | unit hàm thuần |
| S5 | Thiếu biến URL hoặc biến token | Thoát mã khác 0, in tên biến thiếu, không gửi request nào | node:test |
| S6 | `now` = `2026-11-03T03:00:00Z` (10:00 UTC+7) | Võ sĩ 1: trận ở camp, chuỗi số cân có ít nhất một ngày bị trống trong 7 ngày gần nhất. Võ sĩ 2: hôm nay nằm trong tuần thi đấu. Võ sĩ 3: đã cân, `weighInAt` ≤ `now` < `boutAt`. Võ sĩ 5: không có trận đang chạy và không có đình chỉ. Võ sĩ 6: `boutAt` cùng ngày học viện với `now`, sau `now` | unit hàm thuần |
| S7 | `now` = `2026-11-03T15:40:00Z` (22:40 UTC+7), chạy thật | Thoát mã khác 0, câu báo nêu giờ giới hạn, **không** có request ghi nào | node:test, API giả |
| S8 | Không có `--with-ai` | Không có request nào tới đường dẫn chứa `/ai/` | node:test, API giả |
| S9 | Có `--with-ai`, API giả đã có một gợi ý cho trận của võ sĩ 6 | Không gọi `POST …/ai/…` | node:test, API giả |
| S10 | Kế hoạch của võ sĩ 4 | Có buổi tập loại bị chặn được tạo **trước** đình chỉ, nằm trong khoảng đình chỉ. Script không gọi `POST /suspensions/:id/conflicts/apply`. *(Sửa 31/10: đặc tả cũ đòi "còn một buổi `SCHEDULED` xung đột". Backend không cho làm vậy: `POST /suspensions` tự áp R28 trong cùng transaction, `suspensions.service.ts:135`, nên mọi buổi bị chặn thành `PENDING`. Chờ chủ dự án quyết nguồn `TRAINING_CONFLICTS_WITH_SUSPENSION` của tiêu chí 6.)* | node:test, API giả |
| S11 | Mọi file trong `git diff` | Không chứa token, mật khẩu thật hay URL Supabase | Claude kiểm khi review |

Kết quả trên Supabase (tiêu chí 5, 6) do Ken chạy thật ở phần C. Người thực hiện chỉ chạy `--dry-run` và test.

### Phần C · Kiểm từng màn ở API mode (cả nhóm)

Chạy backend bằng `.env` của team và frontend với `APP_DATA_MODE=api`, trên nhánh sau phần A và dữ liệu của phần B. Mỗi người kiểm các màn của mình, ở 390 px và 1440 px, cả `vi` và `en`, theo thứ tự việc của người dùng:

| Màn (route trong `nextjs-frontend/src/app/(app)/`) | Người kiểm |
| --- | --- |
| `coach/dashboard` (thẻ Việc cần làm), `coach/bouts`, `coach/bouts/new` (cảnh báo R4, khả thi cân R31), `coach/bouts/[boutId]` | Hoàng Anh |
| `coach/bouts/suspensions`, bảng Sẵn sàng (T-030 B6), `coach/sessions`, `coach/sessions/[sessionId]` (buổi "Chờ xếp lại", xếp lại, Cổng 2) | Ken |
| `coach/bouts/[boutId]/opponent-analysis` (T-033, video YouTube T-046, gợi ý AI T-038) | Dan |
| `coach/bouts/[boutId]/corner-card`, `coach/bouts/[boutId]/rounds` (ghi hiệp, lời dặn), màn ghi cân và trang trận của võ sĩ (T-005 A, T-006 C) | Fon |
| `fighter/dashboard`, `fighter/training`, `fighter/health` (trạng thái đình chỉ, model 3D T-042) | Hoàng Anh |

Mỗi lỗi ghi một dòng vào handover: màn, các bước tái hiện, kết quả mong đợi, kết quả thật, ảnh chụp nếu là lỗi giao diện. Ghi rõ lỗi do backend hay do frontend: mở Network, xem mã lỗi và body.

Đã kiểm 30/10 (Claude, `fight-camp` `5c63a1b`, `.env` của team):
- Backend khởi động được, đăng ký 152 route, có đủ các route mới của T-036, T-037, T-038, T-045.
- `/health` trả 200; `/readiness`, `/suspensions`, `/bouts` trả 401 khi chưa đăng nhập.
- Máy không chạy Redis ở `localhost:6379` thì log có `ECONNREFUSED` nhưng app vẫn chạy. Khi chạy thử, bật Redis để có thông báo.
- Chưa thử các luồng cần đăng nhập: chờ dữ liệu của phần B và tài khoản của dev.

Phải tái hiện được hai lỗi đã biết:
- "Phải khởi động lại server để diễn lại" (nhận xét 27/10 mục 4). Tìm xem do đâu: kho demo trong bộ nhớ, cache, hay mốc thời gian `lib/mocks/time.ts`.
- Test frontend chập chờn trên `fight-camp`: ngày 30/10 chạy hai lần liên tiếp thì lần 1 có 1 lỗi, lần 2 qua hết (813 qua). Tìm ra test nào.

### Phần D · Sửa lỗi tìm được

Mỗi lỗi chặn trình bày (trang lỗi, mất dữ liệu, sai nghiệp vụ, chữ tiếng Anh trong bản `vi`) là một nhánh `fix/T-040-<màn>` do người làm màn đó sửa, có test. Claude review từng nhánh. Lỗi nhỏ về giao diện gom vào một nhánh cho mỗi người.

## 3. Ngoài phạm vi

- Bỏ demo mode: việc của [T-044](./T-044-codebase-trim.md) phần B, làm sau T-040.
- `reactnative-mobile` và nhánh `feat/mobile-platform`.
- `feat/T-026-session-templates-ui` (chậm 144 commit, xung đột riêng): Hoàng Anh tự merge `fight-camp` vào nhánh đó như ticket T-026 đã ghi.
- Tính năng mới. T-037 B, T-038 B, T-041 tạo nhánh từ `fight-camp` sau khi phần A merge, không tạo từ `feat/T-033-opponent-analysis-ui` nữa.

## 4. Tiêu chí nghiệm thu

1. **A:** `feat/T-040-merge-demo-branches` chứa đầu chuỗi 1, và chuỗi 2 nếu T-042/043 đã APPROVED (`git merge-base --is-ancestor` trả 0 cho từng nhánh). Không còn dấu `<<<<<<<` (`git grep -n '^<<<<<<<'` rỗng).
2. **A:** lint, typecheck và build của frontend sạch. Typecheck 0 lỗi, bằng `fight-camp` ngày 30/10.
3. **A:** số test frontend qua ≥ tổng số test riêng của `fight-camp` cộng số test mới của các nhánh đã gộp. Không test nào của ticket nguồn bị xoá hay bị `skip`. Handover có bảng file test theo từng ticket.
4. **A:** các câu đã dịch ở `fight-camp` không quay lại tiếng Anh. Với mỗi file xung đột, handover ghi bên đã giữ. Không còn chuỗi tiếng Anh cứng nào thay chỗ một lệnh gọi `t(...)` đã có ở `fight-camp`.
5. **B:** chạy script hai lần liên tiếp thì lần 2 không tạo bản ghi mới (in ra số bản ghi đã tạo và đã có). `--dry-run` không gửi request ghi nào.
6. **B:** sau khi chạy, bảng Sẵn sàng hiện đúng giai đoạn của 6 võ sĩ. Thẻ Việc cần làm có ít nhất các nguồn: cân xám hoặc đỏ, nhắc cân, `SUSPENSION_AWAITING_CLEARANCE`, `TRAINING_CONFLICTS_WITH_SUSPENSION`.
   > **Mâu thuẫn trong tiêu chí này (Claude trên máy Ken, 31/10). Chủ dự án quyết.** Hai nguồn cuối **không tạo được qua API** nếu theo đúng ràng buộc của chính ticket ("chỉ qua API", "ngày theo ngày chạy, không tua thời gian"):
   > - `TRAINING_CONFLICTS_WITH_SUSPENSION`: từ T-036 (migration 032, đã áp 30/10), mọi đường tạo đình chỉ đều tự áp R28 trong cùng transaction: tạo tay ở `suspensions.service.ts:136`, ghi kết quả KO ở `bouts.service.ts:1823`. Các buổi bị chặn thành `PENDING` hoặc `CANCELLED` ngay lúc tạo, và Cổng 2 chặn tạo hay dời buổi vào khoảng đình chỉ (`training-session.service.ts:112`, `:194`). Vì vậy không thể còn buổi `SCHEDULED` xung đột. Đây là hành vi đúng của luật "bị đình chỉ thì không tập". Nguồn này chỉ còn sinh được từ dữ liệu có trước T-036. Code tạo nguồn (`bouts-todo.model.ts:199`) nên xem xét ở T-044.
   > - `SUSPENSION_AWAITING_CLEARANCE`: chỉ có từ ngày `endsOn + 1` của một đình chỉ cần xác nhận (`bouts-todo.model.ts:174–183`), mà đình chỉ không được bắt đầu trước hôm nay (`suspensions.model.ts:449–453`). Vì vậy không có được trong ngày chạy script.
   >
   > Script làm đúng phạm vi: có cân xám (võ sĩ 1), nhắc cân, và võ sĩ 4 đình chỉ có buổi `PENDING`. Đề nghị bỏ hai nguồn trên khỏi tiêu chí này. Ken không làm thêm bước chạy trước một ngày, vì ticket không có bước đó.
7. **C:** mọi màn trong bảng phần C đã được kiểm ở 390 px và 1440 px, `vi` và `en`, có tên người kiểm và ngày. Mọi lỗi đã ghi đều có cách tái hiện.
8. **C:** hai lỗi đã biết đã tìm ra nguyên nhân, hoặc ghi rõ đã thử những gì.
9. **D:** đến tổng duyệt 9/11, không còn lỗi mức chặn chưa sửa trên các màn trong kịch bản trình bày.

## 5. Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
pnpm --filter nextjs-frontend build
pnpm --filter nestjs-api lint
pnpm --filter nestjs-api build
pnpm --filter nestjs-api test
```

**Baseline `fight-camp` ngày 30/10 (`5c63a1b`):**
- Frontend: typecheck 0 lỗi; test `813 passed | 2 skipped (815)`, có một test chập chờn (xem phần C).
- Backend: lint 0 lỗi; build qua; test chỉ lỗi baseline B1, B2 ([BASELINE.md](./BASELINE.md)). Số lỗi dao động 13 đến 26 tuỳ lúc Redis timeout.

## 6. Quyết định của chủ dự án (30/10)

1. Gộp nhánh demo **trước** T-030 B, không chờ. T-030 B merge `fight-camp` mới vào nhánh của mình và Ken tự giải xung đột, vì Ken nắm code đình chỉ.
2. T-042/043 được review trước, khi APPROVED thì gộp vào cùng nhánh T-040 (mục A1.3).
