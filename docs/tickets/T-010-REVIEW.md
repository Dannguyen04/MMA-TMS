# T-010 Review (phần A, backend, giai đoạn 1: mục 1–5)

- Ngày review: 22/10/2026, Claude.
- Phạm vi: `feat/T-010-opponent-analysis-and-rounds`, 10 commit của Codex (`999c881` … `78dfc92`), handover trong `78dfc92`. Nhánh tạo từ `fight-camp` tại `31fb332`.
- **Kết luận: APPROVED cho giai đoạn 1 (mục 1–5 của ticket).** Không có vấn đề mức "chặn". **Ticket chưa xong:** mục 6, 7 và tiêu chí 6–7, 16–17 (và các nhánh phụ thuộc của 11, 15) chưa làm, đúng chỉ định vì T-006 chưa merge. Trạng thái sau review: giữ `READY` cho lượt 2.

## Hạn chế của lần review này

- Chỉ đọc kỹ `bouts.service.ts`, migration 027 và handover; chưa đọc từng dòng `bout-analysis.model.ts` (363 dòng) và các spec. Tiêu chí 1–5 dựa vào việc chạy test và đọc tên test; **nên đọc chéo `bout-analysis.model.ts` đối chiếu R20–R24** khi lượt 2 xong.
- Các ngưỡng R21, R22, R24 là đề xuất chưa có HLV duyệt (hằng số có tên).
- Chưa áp migration 027 lên Supabase; chỉ kiểm bằng `test:db`.

## Lệnh đã chạy lại

Chạy trong `D:/test/ai-worktrees/T-010` tại `78dfc92`:

```text
$ pnpm --filter nestjs-api lint
exit 0; chỉ cảnh báo cũ

$ pnpm --filter nestjs-api build
exit 0

$ pnpm --filter nestjs-api test
 Test Files  6 failed | 49 passed (55)
      Tests  26 failed | 811 passed (837)

$ pnpm --filter nestjs-api test:db
Migration checks passed: 43.

$ pnpm --filter nestjs-api db:check
001-027 checksums OK. No database connection was opened.
```

26 test lỗi đúng bằng baseline B1; không thêm lỗi. Khớp với output Codex báo.

## Đối chiếu tiêu chí nghiệm thu

| # | Kết quả | Căn cứ của tôi |
| --- | --- | --- |
| 1–5 | Đạt (theo test) | `bout-analysis.model.spec.ts` (275 dòng) qua; chưa đọc từng ca, xem hạn chế |
| 6–7 | Chưa làm | Mục 6 (R29, R30) chờ T-006 |
| 8 | Đạt | `putOpponentAnalysis` kiểm `observationIds` (422 `OPPONENT_TACTIC_EVIDENCE_REQUIRED`) và schema Zod |
| 9 | Đạt | `findAnalysisSessions(ids, fighterId)` so số dòng với số `id` (422 `OPPONENT_SESSION_INVALID`); `tacticsWithoutSessions` tính khi đọc |
| 10 | Đạt | `mutateAnalysis` khoá dòng bằng `lockBoutById`; `review` chỉ khi `COMPLETED` |
| 11 | Đạt một phần | FIGHTER chỉ nhận `tactics` đã bỏ `review` và `sessions`; `rounds`, `corner-card` dùng `assertPrivateReadAccess` (FIGHTER 403). Nhánh `report` chưa có |
| 12 | Đạt | `putRound`: `BOUT_ROUNDS_NOT_SET`, `BOUT_ROUND_OUT_OF_RANGE`, `BOUT_ROUND_MARK_UNKNOWN`, upsert theo `(bout_id, round_no)` |
| 13 | Đạt | `getRounds` trả `advice` từ `buildRoundAdvice`, `null` khi đủ hiệp |
| 14 | Đạt | `updateBout` khoá dòng rồi kiểm `BOUT_ROUNDS_BELOW_RECORDED` trong giao dịch |
| 15 | Đạt một phần | `copyableAnalysis` dùng đúng phạm vi `listBouts`, bỏ `review`; `improvementPoints` tạm `null` |
| 16–17 | Chưa làm | Chờ T-006 |
| 18 | Đạt | `test:db` 43 ca qua; migration đúng khuôn 024, RLS bật, revoke `anon`, `authenticated`, trigger audit và `updated_at` |

Việc Codex làm đúng quy trình: không đụng `docs/` ngoài handover (phần diff `FIGHT-CAMP-BUSINESS-FLOWS.md` khi so với `fight-camp` mới chỉ do `fight-camp` có thêm commit `44c1dd1`), không có nhánh nào bị push.

## Vấn đề

| # | Mức | Vị trí | Vấn đề | Xử lý |
| --- | --- | --- | --- | --- |
| 1 | Gợi ý | `nestjs-api/src/bouts/bouts.service.ts` (các hàm `putOpponentAnalysis` … `getPriorContext`) | Viết dày, nhiều câu lệnh trên một dòng, khác mật độ của phần còn lại của file (T-003). Lint qua nhưng khó đọc | Tách và định dạng lại khi làm lượt 2 |
| 2 | Gợi ý | `getPriorContext` | Duyệt toàn bộ trận trong phạm vi người gọi để tìm trận cũ cùng tên đối thủ; chậm khi số trận lớn | Chấp nhận cho đồ án; có thể thêm truy vấn theo `fighter_id` + tên chuẩn hoá sau |
| 3 | Gợi ý | `lockBoutById` | `putOpponentAnalysis` đọc bout hai lần (`requireBout`, rồi `lockBoutById`) | Không ảnh hưởng đúng đắn |

## Việc còn lại (lượt 2)

Sau khi T-006 merge vào `fight-camp`: merge `fight-camp` vào nhánh này (không rebase, giữ cả hai bên; xung đột dự kiến ở 8 file bouts và `schema.ts`), rồi làm mục 6 (R29, R30, `GET /bouts/:id/report`, `improvementPoints` trong `prior-context`, `acuteLoss` cho corner-card) và mục 7 (R25, R26, tự điền `review`), cùng tiêu chí 6–7, 16–17. Giao lại cho Codex bằng `codex exec resume` hoặc phiên mới; prompt trỏ vào ticket và handover.
