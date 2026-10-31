# T-010B Handover

- Nhánh: `feat/T-010B-corner-card-rounds`    Commit: `1736d27` (cập nhật kèm handover ở commit cuối)
- Trạng thái: IN REVIEW
- Phạm vi đã làm: **Đợt 1 (mục 1–3) và mục 5 của Đợt 2 (lời dặn giữa hiệp)** (đã merge `sync/T-004-fight-camp`)

## Cách mở hai màn ở DEMO MODE (phục vụ trình bày 27/10)

1. **Đăng nhập HLV demo**: chọn tài khoản HLV **Rafael Costa** (`c-rafael-costa`, user `u-rafael-costa`).
2. **Trận demo ở trạng thái `WEIGHED_IN`** (seed trong `demoCampStore()` của `src/lib/services/bouts.demo.ts`):
   - Mã trận (`boutId`): `bout-weighed-in`
   - Giải đấu: **Vietnam MMA Open 2026** — võ sĩ **Diego Alvarez** (`f-diego-alvarez`) gặp **Lê Hoàng Nam** (hạng 65.8 kg, đã cân chính thức 64.8 kg — `PASSED`, `scheduledRounds = 3`, có sẵn 4 quan sát và 4 chiến thuật).
   - Trang chi tiết trận: `/coach/bouts/bout-weighed-in` (hiện thẻ **"Góc đài & diễn biến hiệp"** với 2 nút dẫn sang **Thẻ góc đài** và **Ghi hiệp & lời dặn**; các trận chưa `WEIGHED_IN` như `bout-ufc-312-silva`, `bout-one-170-tanaka`, `bout-cage-warriors-osei` không hiện link).
3. **Đường dẫn trực tiếp**:
   - **Trang chi tiết trận**: `/coach/bouts/bout-weighed-in`
   - **Màn Thẻ góc đài (in A4)**: `/coach/bouts/bout-weighed-in/corner-card`
   - **Màn Ghi hiệp & Lời dặn giữa hiệp**: `/coach/bouts/bout-weighed-in/rounds`
   - Thử lỗi 409 (trận chưa `WEIGHED_IN`): mở `/coach/bouts/bout-ufc-312-silva/corner-card` hoặc `/coach/bouts/bout-ufc-312-silva/rounds` sẽ hiện thông báo tiếng Việt báo lỗi 409 chưa qua cân chính thức.

## Thay đổi

- `nextjs-frontend/src/lib/domain/round-advice.ts`: Bản TypeScript của `buildCornerCard`, `buildRoundAdvice` (R20–R24), schema Zod (`cornerCardSchema`, `roundAdviceSchema`, `roundsResponseSchema`, `opponentAnalysisSchema`, `roundInputSchema`) chép đúng tên trường từ `nestjs-api/src/bouts/bout-analysis.model.ts`, và hàm lọc hiệp `filterCornerCardTactics` giữ nguyên thứ tự backend.
- `nextjs-frontend/src/lib/domain/round-advice.test.ts`: Unit test kiểm tra đầy đủ các ca R20–R24 theo tiêu chí 1–5 của T-010 và hàm lọc chiến thuật theo hiệp.
- `nextjs-frontend/src/lib/services/bout-analysis.ts` & `nextjs-frontend/src/lib/services/bout-analysis.demo.ts`: Service đọc/ghi phân tích, thẻ góc đài (`getCornerCard`), danh sách hiệp kèm lời dặn (`getBoutRounds`), và ghi hiệp (`upsertBoutRound`) hỗ trợ cả Demo mode (đọc/ghi qua `demoCampStore()`) và API mode.
- `nextjs-frontend/src/lib/services/bouts.demo.ts`: Seed trận mẫu `bout-weighed-in` ở trạng thái `WEIGHED_IN` (`scheduledRounds = 3`, 4 quan sát, 4 chiến thuật) trong `demoCampStore()` cho võ sĩ Diego Alvarez (`f-diego-alvarez`) và HLV Rafael Costa (`c-rafael-costa`).
- `nextjs-frontend/src/lib/actions/bout-analysis.ts`: Server Action `recordBoutRoundAction` theo khuôn `enterFightWeekAction`, kiểm tra quyền HLV, dữ liệu hiệp và revalidate đường dẫn.
- `nextjs-frontend/src/lib/i18n/messages/bout-analysis.en.ts`, `bout-analysis.vi.ts`, `en.ts`, `vi.ts`: Từ điển song ngữ Anh–Việt cho thẻ góc đài, ghi hiệp và lời dặn giữa hiệp.
- `nextjs-frontend/src/app/(app)/coach/bouts/[boutId]/page.tsx`: Giữ bản của `sync/T-004-fight-camp` và hiển thị link tới `/corner-card` và `/rounds` khi trận ở trạng thái `WEIGHED_IN` hoặc `COMPLETED`.
- `nextjs-frontend/src/app/(app)/coach/bouts/[boutId]/corner-card/page.tsx` & `corner-card-view.tsx`: Màn thẻ góc đài giữ nguyên thứ tự chiến thuật từ backend/domain, nhãn `"Chưa luyện"` khi `trained = false`, lọc theo hiệp, cảnh báo `acuteLossFlag`, định dạng in 1 trang A4 (`@media print`), và thông báo tiếng Việt khi gặp lỗi 409.
- `nextjs-frontend/src/app/(app)/coach/bouts/[boutId]/rounds/page.tsx` & `rounds-view.tsx`: Màn ghi hiệp trên điện thoại (mỗi hiệp một thẻ: tự chấm `WIN`/`LOSS`/`CLOSE`, số lần bị đánh ngã, choáng/chảy máu/mệt, dấu chiến thuật `EFFECTIVE`/`INEFFECTIVE`/`NOT_USED`, dấu quan sát `SEEN`/`NOT_SEEN`, ghi chú) và khối **Lời dặn giữa hiệp** (`advice`: cảnh báo đỏ `"Cân nhắc dừng trận, báo bác sĩ của giải"`, thế trận kèm `"HLV tự chấm"`, chiến thuật xếp lại kèm `dropped` và `OPPONENT_MAY_HAVE_CHANGED`).

## Đối chiếu tiêu chí nghiệm thu

| Tiêu chí (theo ticket) | Đáp ứng ở đâu (`file:dòng`, test nào) |
| --- | --- |
| 1. Đợt 1: thẻ góc đài đúng thứ tự backend, nhãn "Chưa luyện" khi `trained = false`, lọc theo hiệp, cảnh báo `acuteLossFlag`, in một trang A4; ghi đủ trận 3 hiệp và đọc lại đúng | `src/app/(app)/coach/bouts/[boutId]/corner-card/corner-card-view.tsx:41-215`, `src/lib/services/bout-analysis.ts:74-141`, `src/lib/services/bout-analysis.demo.ts:46-162`, `src/lib/domain/round-advice.test.ts` (`R20`, `filters corner card tactics`) |
| 2. Ở 390 px không cuộn ngang (thẻ góc đài và ghi hiệp dùng trên điện thoại ở góc đài) | `src/app/(app)/coach/bouts/[boutId]/corner-card/corner-card-view.tsx:44-214`, `src/app/(app)/coach/bouts/[boutId]/rounds/rounds-view.tsx:49-457` (dùng `min-w-0`, `flex-wrap`, `break-words`, lưới 1 cột trên mobile) |
| 3. Trận chưa `WEIGHED_IN`: không hiện link thẻ góc đài; lỗi 409 hiện câu tiếng Việt | `src/app/(app)/coach/bouts/[boutId]/page.tsx:56-164`, `src/app/(app)/coach/bouts/[boutId]/corner-card/page.tsx:66-79`, `src/app/(app)/coach/bouts/[boutId]/rounds/page.tsx:73-86` |
| 4. Chữ qua từ điển; có test cho hàm thuần (R20–R24 và hàm lọc hiển thị) | `src/lib/i18n/messages/bout-analysis.en.ts`, `src/lib/i18n/messages/bout-analysis.vi.ts`, `src/lib/domain/round-advice.test.ts:9-203` |
| 5. Đợt 2 mục 5 (lời dặn giữa hiệp): `tactics` xếp lại kèm `dropped`/`OPPONENT_MAY_HAVE_CHANGED`, `standing` kèm chữ "HLV tự chấm", `safety` RED với câu "Cân nhắc dừng trận, báo bác sĩ của giải" | `src/app/(app)/coach/bouts/[boutId]/rounds/rounds-view.tsx:62-164`, `src/lib/domain/round-advice.ts:212-304`, `src/lib/domain/round-advice.test.ts:55-184` |
| 6. Handover ghi rõ đã làm đợt nào và cách mở ở demo mode | `docs/tickets/T-010B-HANDOVER.md:5-23` |

## Lệnh đã chạy

### 1. `pnpm --filter nextjs-frontend lint`

```text
$ eslint
```

(Exit code 0, 0 errors, 0 warnings)

### 2. `APP_DATA_MODE=api pnpm --filter nextjs-frontend typecheck`

```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```

(Exit code 0, 0 errors)

### 3. `pnpm --filter nextjs-frontend test`

```text
 RUN  v5.0.2 D:/test/ai-worktrees/T-010B/nextjs-frontend


 Test Files  102 passed | 1 skipped (103)
      Tests  930 passed | 2 skipped (932)
   Start at  14:27:59
   Duration  16.32s (import 50%, transform 37%, tests 12%, worker 1%)
```

So với baseline: tăng thêm 1 test file (`round-advice.test.ts`, 6 tests), 0 lỗi mới.

## Lệch so với ticket

- Theo chỉ dẫn trực tiếp trong prompt giao việc (để tránh xung đột với các nhánh đang làm song song):
  - Đặt service, demo service, server action và từ điển vào các file mới `src/lib/services/bout-analysis.ts`, `src/lib/services/bout-analysis.demo.ts`, `src/lib/actions/bout-analysis.ts`, `src/lib/i18n/messages/bout-analysis.en.ts`/`.vi.ts` thay vì sửa trực tiếp `services/bouts.ts`, `actions/bouts.ts`, `coach-bouts.*.ts`.
  - Phạm vi thực hiện gồm **Đợt 1 (mục 1–3)** và **mục 5 của Đợt 2 (lời dặn giữa hiệp)**; chưa làm mục 4 (tab Đối thủ) và mục 6 (báo cáo trận) của Đợt 2 theo đúng yêu cầu của lượt này.

## Câu hỏi / việc còn mở

Không có
