# Review: seed demo API mode cho bốn vai trò (Ken, "T-066" trên `User_Feature`)

- Người review: Claude. Ngày: 14/11/2026.
- Commit: `bf65913` trên `origin/User_Feature` (Ken push 12/11 22:11). Commit cha là `8c901ab`, tức dashboard HLV đang CHANGES REQUESTED ([review](./REVIEW-KEN-COACH-DASHBOARD.md)).
- Phạm vi commit: `nestjs-api/scripts/demo-seed.mjs`, `nestjs-api/scripts/demo-seed.test.mjs`, `docs/DEMO-API-MODE-SCRIPT.md`, `docs/tickets/README.md` và bốn file `docs/tickets/T-066-*`. Không đụng code app, API, migration hay frontend, đúng như ticket.

## Kết luận: CHANGES REQUESTED

Phần code đạt. Mọi request ghi của script khớp với DTO, quyền và quy tắc trạng thái của backend (đối chiếu ở mục 3). Test qua cả trên nền `release/final-review`. Có hai việc phải làm trước khi merge, đều nằm ở giấy tờ:

1. Ticket đang trùng số T-066 với nhóm ticket hiệu năng.
2. Ticket tự ghi APPROVED.

Ngoài ra có một việc cần chủ dự án quyết: file SQL dọn dữ liệu chạy thẳng lên Supabase.

## 1. Lệnh đã chạy lại

Chạy trong worktree `C:/test/ai-worktrees/review-ken-dashboard` ở `bf65913`. Không có `.env`, không nối Supabase.

| Lệnh | Kết quả |
| --- | --- |
| `corepack pnpm --filter nestjs-api test:seed` | `tests 46, pass 46, fail 0` |
| `corepack pnpm --filter nestjs-api lint` | 0 lỗi; cảnh báo đều có sẵn trong `src/` (vd. `notification-stream.service.ts:319`) |
| `node_modules/.bin/oxlint scripts/demo-seed.mjs scripts/demo-seed.test.mjs` | exit 0, không cảnh báo (xem vấn đề 5: lệnh `lint` của ticket không quét `scripts/`) |
| `node scripts/demo-seed.mjs --dry-run` (19:4x giờ học viện, ngày 14/11) | exit 0, 258 dòng. Đủ f1–f17. Mọi dòng ghi có nhãn: `[admin]` 148, `[coach]` 51, `[doctor]` 57 |
| Cherry-pick `bf65913` lên `release/final-review` (`d50314d`) trong worktree tạm, rồi `node --test scripts/demo-seed.test.mjs` | Áp sạch, git tự gộp README. `tests 46, pass 46` |

Số ca trong handover (mục 2: "38/38") cũ hơn số ca thật (46, gồm R1–R4 và Q1–Q5 thêm ở các lượt sửa).

## 2. Đối chiếu tiêu chí nghiệm thu

| Tiêu chí | Kết quả |
| --- | --- |
| 1. Đủ các ca S1–S18, T1–T19 | Đạt. Có thêm R1–R4 và Q1–Q5. S11 không có ở bản cũ lẫn bản mới, nên không phải bị mất |
| 2. `test:seed` qua; `--dry-run` in đủ plan | Đạt (mục 1) |
| 3. `lint` qua | Đạt theo đúng lệnh ticket ghi, nhưng lệnh này không lint file đã sửa (vấn đề 5) |
| 4. Không sửa file ngoài phạm vi | Đạt. Có sửa thêm `docs/tickets/README.md` và thêm các file ticket, review, SQL; đều là giấy tờ |
| 5. Không chạy seed thật, không gọi database thật | Phần seed: đạt. Phần SQL dọn dữ liệu do Ken tự chạy trên Supabase: xem vấn đề 3 |

## 3. Đối chiếu với backend

Đọc ở `bf65913`. Backend trên `release/final-review` chỉ thêm endpoint (`GET /medical/history`, T-072) và không đổi các schema dưới đây.

| Script gọi | Backend | Khớp |
| --- | --- | --- |
| `POST /suspensions` với `KO` + `requiresClearance: true`, `DQ` + `false`, `MEDICAL` + `ORGANIZER` + `issuerReference`, `startsOn` = hôm nay | `deriveRequiresClearance` (`suspensions.model.ts:245`), refine `issuerReference` (`:417-431`) | Có |
| `POST /suspensions/:id/clear { clearanceNote }` cho f8 bằng token HLV | `clearSuspensionSchema` (`:479`). HLV được gỡ nếu được phân; chỉ gỡ khi `AWAITING_CLEARANCE` (`suspensions.service.ts:181-196`). KO 1 ngày từ D−1 thì sang ngày D là `AWAITING_CLEARANCE` | Có |
| `POST /suspensions/:id/end-early { examinationId, note }` cho f9 bằng token bác sĩ | Đình chỉ CLB phải có `examinationId`, người gọi là DOCTOR, phiếu của chính bác sĩ, TRAINING, không `NOT_ELIGIBLE`, ngày khám ≥ `startsOn`, chưa bị thay thế (`suspensions.service.ts:240-300`). Script ghi phiếu `now − 60 s` cùng ngày `startsOn` | Có |
| Khám BASELINE: `vitals`, `assessments`, `scat6 NOT_ADMINISTERED` | `createExaminationSchema` (`medical.model.ts:296-350`), `examinationVitalsSchema` (`:270`), `notAdministeredScat6Schema` (`scat6.model.ts:422`), `FORM_VERSION = 'SCAT6-2023-EN'` | Có |
| `POST .../medical-clearances { examinationId, clearanceType: 'TRAINING' }` | `issueClearanceSchema` (`medical.model.ts:409`) | Có |
| Đọc `currentExaminations.training`, `activeClearances[].examinationId` | `medicalDossierSchema` (`medical.model.ts:590`) | Có |
| `POST .../medical-review-requests { reason }` bằng token HLV | `createReviewRequestSchema` (`:108`); COACH có quyền `fighter.medical_review_request:create` (migration 011, dòng 694) | Có |
| `weigh-in 71.2` rồi `catchweight 72` (f16) | Cân vượt hạn thì trận ở `FIGHT_WEEK` với `madeWeight = false`; catchweight cần đúng trạng thái đó và `≥` cân chính thức (`bouts.service.ts:1505-1560`) | Có |
| `cancel { reason }`, AIBA hạng `71` | `cancelBoutSchema` (`bouts.model.ts:959`); `71` có trong ruleset AIBA của migration 024 | Có |
| `?limit=100` trên khám và đình chỉ | Cả hai schema cho tối đa 100 | Có |

Không có mật khẩu hay token thật trong diff. Test dùng `not-a-real-password`, dry-run dùng `dry-run`.

## 4. Vấn đề

| # | Mức | Ở đâu | Vấn đề | Cách tái hiện / sửa |
| --- | --- | --- | --- | --- |
| 1 | **Chặn** | `docs/tickets/README.md:57`, cả bốn file `T-066-*` | Số T-066 đã thuộc nhóm hiệu năng T-063 đến T-069 trên `release/final-review` (`README.md:123`, [T-063-069-performance.md](./T-063-069-performance.md)). Review dashboard ngày 12/11 đã nêu đúng lỗi này và dành T-070, T-071 cho Ken. Merge vào thì git **tự gộp không báo xung đột**, và README có hai mục T-066 mang hai nghĩa khác nhau | Cherry-pick `bf65913` lên release rồi `grep -n "T-066\|T-063 đến" docs/tickets/README.md`: ra dòng 57 và dòng 123. Sửa: đổi sang **T-073** (đã ghi chỗ trong README), đổi tên cả bốn file và mọi tham chiếu, kể cả comment đầu `demo-seed.mjs` |
| 2 | **Chặn** | `T-066-REVIEW.md:3`, `T-066-demo-seed-all-roles.md:3`, `README.md:57` | Ticket tự ghi APPROVED dựa trên review của subagent bên Ken. Theo [quy trình §2 và §7](../TEAM-WORKFLOW.md), người review là Claude của dự án và chủ dự án mới merge. Nội dung file review của Ken vẫn có ích (các lỗi R1–R4, Q1–Q5 đã sửa) | Đổi trạng thái thành `IN REVIEW`, rồi `CHANGES REQUESTED` theo báo cáo này. Đổi tên file review của Ken thành `T-073-SELF-REVIEW.md` để không lẫn với báo cáo review chính thức |
| 3 | Cần chủ dự án quyết | `docs/tickets/T-066-cleanup.sql` | Script SQL xoá mềm 14 trận, 10 đình chỉ và 44 tài khoản `@test.invalid`, ghi là "Ken chạy tay trong Supabase SQL editor". [Quy trình §3a](../TEAM-WORKFLOW.md) không cho dev chạy SQL trực tiếp lên Supabase. Về kỹ thuật thì script cẩn thận: có transaction, đếm số dòng, rollback khi lệch. Nhưng script bỏ qua API và audit context, và trong 10 đình chỉ có đình chỉ của Kenji và Aigerim, hai võ sĩ dự phòng dùng khi chạy thử API mode | Chủ dự án xác nhận script đã chạy chưa, và có cho phép lần này không. Nếu chưa chạy, nên để chủ dự án chạy |
| 4 | Nên sửa | `demo-seed.mjs`, các dòng 120, 165, 568, 714 và khối f7 | Diff xoá khoảng 10 comment giải thích "vì sao", ticket không yêu cầu. Ví dụ: trận lúc 23:00 vì backend từ chối kết quả trước ngày thi; ruleset MMA không có quy tắc đình chỉ nên phải gửi `suspensionDays`; R28 đã dời buổi tập khi tạo đình chỉ; AI chỉ chạy khi trận còn mở; `AWAITING_CLEARANCE` bắt đầu từ `endsOn + 1` | `git diff 8c901ab bf65913 -- nestjs-api/scripts/demo-seed.mjs \| grep "^-\s*//"`. Khôi phục các comment này; comment của f7 thì sửa lại cho khớp `--stage early` |
| 5 | Gợi ý | `nestjs-api/package.json:17` | Lệnh `lint` là `oxlint src/ test/`, nên tiêu chí 3 không lint `scripts/`, tức hai file ticket sửa. Mình đã chạy oxlint trực tiếp: sạch | Lần sau ticket script nên ghi lệnh lint cho `scripts/` |
| 6 | Gợi ý | `demo-seed.test.mjs:600` | Tên ca S15 nói "a normal run on an empty API creates fighter 7", nhưng ca giờ chạy `--stage early` trước. Riêng lần chạy chính trên API rỗng thì bỏ qua f7 (đúng T2) | Đổi tên ca cho khớp hành vi mới, ghi lý do trong handover như ticket yêu cầu |
| 7 | Gợi ý | `T-066-HANDOVER.md:46`, `:209` | Handover còn ghi "38/38", trong khi số ca thật là 46 | Cập nhật con số |

## 5. Cách merge

Commit này nằm ngay trên dashboard HLV, mà dashboard chưa đạt. Merge cả nhánh `User_Feature` sẽ kéo dashboard theo. Sau khi sửa vấn đề 1 và 2, nên cherry-pick riêng commit seed lên `release/final-review`; bản thử đã áp sạch và test qua. Lịch chạy seed: `--stage early` đúng ngày D−1, lần chạy chính sáng ngày D, trước 22:30 giờ học viện.
