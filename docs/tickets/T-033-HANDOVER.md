# T-033 Handover

- Nhánh: feat/T-033-opponent-analysis-ui (tạo từ `sync/T-004-fight-camp`)
- Trạng thái: IN REVIEW
- Người thực hiện: Codex viết `opponent-analysis-form.ts` (WIP 8afa647) rồi hết quota; Gemini hết quota ngay lượt đầu; phần còn lại Claude làm theo quyết định của chủ dự án ngày 27/10. Không có review độc lập: chủ dự án hoặc một dev nên đọc diff trước khi merge.

## Thay đổi

- `nextjs-frontend/src/lib/domain/opponent-analysis-form.ts`: hàm thuần chuyển dữ liệu form thành body `PUT /bouts/:id/opponent-analysis`; kiểm R13, giới hạn 6/5, bằng chứng (link http/https hoặc ghi chú), id duy nhất, hiệp ≤ số hiệp dự kiến; giữ `profile`, `sessionIds`, `evidenceTime` từ bản ghi hiện có; bỏ `review`. Thêm `analysisFieldErrors` dịch mã lỗi sang chữ theo từng ô.
- `nextjs-frontend/src/lib/domain/opponent-analysis-form.test.ts`: 9 test.
- `nextjs-frontend/src/lib/services/bout-analysis.ts`: `saveOpponentAnalysis` (API: PUT, map 404/409/422). `bout-analysis.demo.ts`: bản demo ghi vào `demoCampStore()`, từ chối khi `COMPLETED`/`CANCELLED`, giữ `review` cũ của chiến thuật.
- `nextjs-frontend/src/lib/actions/bout-analysis.ts`: `saveOpponentAnalysisAction`; thêm path `/opponent-analysis` vào `revalidateBoutAnalysisPaths`.
- `nextjs-frontend/src/app/(app)/coach/bouts/[boutId]/opponent-analysis/`: `page.tsx`, `opponent-analysis-view.tsx` (form quan sát và chiến thuật, chỉ đọc khi trận xong hoặc huỷ).
- `.../[boutId]/page.tsx`: thẻ lối vào hiện ở mọi phase trừ `CANCELLED`; link "Phân tích đối thủ" luôn có, thẻ góc đài và ghi hiệp vẫn chỉ ở `WEIGHED_IN`/`COMPLETED`.
- `.../corner-card/corner-card-view.tsx`: link "Phân tích đối thủ".
- `nextjs-frontend/src/lib/i18n/messages/bout-analysis.{en,vi}.ts`: chữ mới.
- **Mở rộng (mục 8–12 của ticket):**
  - `nextjs-frontend/src/lib/domain/opponent-analysis-insights.ts` (+ test, 8 ca): `tacticInsights` (dùng `buildCornerCard`), `planFindings` (P1–P6), `matchupNotes` (C1–C4).
  - `opponent-analysis-form.ts`: nhận `profile` và `sessionIds` từ form; form không gửi thì giữ giá trị cũ; bỏ buổi tập trùng.
  - `page.tsx`: nạp buổi tập của võ sĩ từ `campStartedOn` (bỏ buổi huỷ) và chỉ số của võ sĩ.
  - `opponent-analysis-view.tsx`: hai cột; trái là hồ sơ, quan sát, chiến thuật (nhãn tự tính, chọn buổi tập); phải (dính khi cuộn) là "App kiểm tra kế hoạch" và "App so sánh", cập nhật khi nhập.

## Đối chiếu tiêu chí nghiệm thu

Kiểm bằng Playwright (Chrome) trên demo mode, `next dev -p 3002`:

| Tiêu chí | Kết quả |
| --- | --- |
| 1. Form nạp phân tích hiện có | PASS: 4 quan sát, 4 chiến thuật |
| 2. Lưu xong thẻ góc đài hiện chiến thuật mới, lời dặn vẫn chạy | PASS: chiến thuật 5 "Khi đối thủ lùi thẳng…" có nhãn "Chưa luyện"; ghi hiệp 1 ra "Lời dặn giữa hiệp (trước hiệp 2)" |
| 3. Chiến thuật không căn cứ bị chặn; nút thêm tắt khi đủ | PASS: "Chọn ít nhất một quan sát làm căn cứ." tại dòng; "Thêm chiến thuật" tắt ở 5/5 |
| 4. Quan sát thiếu bằng chứng bị chặn | PASS: "Cần link hoặc ghi chú bằng chứng." tại dòng |
| 5. Link ở trận đang `CAMP` | PASS: `/coach/bouts/b-emma-nordic` |
| 6. Test của hàm thuần | `opponent-analysis-form.test.ts`, 9 test |
| 7. Không thêm lỗi so với baseline | Xem dưới |
| Mở rộng: so sánh hồ sơ | PASS: "Đối thủ đánh tay trái…", "Sải tay võ sĩ mình dài hơn 9 cm…" (Diego 185 cm, đối thủ 176 cm) |
| Mở rộng: kiểm tra kế hoạch | PASS: 2 dòng "Chiến thuật chưa có buổi tập"; thêm sơ hở mới thì hiện "Sơ hở chưa có chiến thuật khai thác", chọn nó làm căn cứ thì dòng đó mất |
| Mở rộng: gắn buổi tập | PASS: 18 buổi của camp; chọn một buổi thì nhãn "Chưa luyện" mất; lưu xong thẻ góc đài ghi "Đã luyện" và xếp chiến thuật đó lên trước chiến thuật chưa luyện |

## Lệnh đã chạy

```text
$ pnpm --filter nextjs-frontend exec vitest run src/lib/domain/opponent-analysis-form.test.ts src/lib/domain/opponent-analysis-insights.test.ts
 Test Files  2 passed (2)
      Tests  17 passed (17)

$ pnpm --filter nextjs-frontend lint
$ eslint
(exit 0)

$ pnpm --filter nextjs-frontend typecheck
$ next typegen && tsc --noEmit
✓ Types generated successfully
(exit 0)

$ pnpm --filter nextjs-frontend test
 Test Files  104 passed | 1 skipped (105)
      Tests  947 passed | 2 skipped (949)
```

## Lệch so với ticket

- Thông báo lưu thành công hiện bằng toast, không phải `FormMessage`: `revalidatePath` làm form mount lại nên state của `useActionForm` mất. Link "Thẻ góc đài" luôn hiện (khi trận ở `WEIGHED_IN`/`COMPLETED`) thay vì chỉ sau khi lưu.
- Kiểm tra chạy ở server action (cùng hàm thuần), không chạy trước ở client: `prepare` của `useActionForm` giữ closure của lần render đầu nên đọc `draft` cũ.

## Câu hỏi / việc còn mở

- Quy tắc P1–P6, C1–C4 và các ngưỡng (`MIN_TACTICS`, `REACH_GAP_CM`, `HEIGHT_GAP_CM`) là đề xuất của nhóm, chưa có trong [Luồng nghiệp vụ](../FIGHT-CAMP-BUSINESS-FLOWS.md); cần ghi vào tài liệu và chờ HLV chuyên môn duyệt như R20–R24.
- Dữ liệu demo của trận Diego gắn `ts-1`, `ts-2` không có trong lịch tập demo, nên màn hiện "1 buổi tập khác đã gắn".

- `typecheck` báo "Demo and mock pipeline modes are disabled in production builds" nếu worktree có `.env.local` đặt `APP_DATA_MODE=demo`, vì `next typegen` chạy ở chế độ production. Không phải lỗi của ticket; chạy typecheck khi không có file đó.
- Trang ghi hiệp có sẵn cũng không giữ được thông báo "Đã lưu hiệp N." sau khi lưu (cùng nguyên nhân mount lại); ngoài phạm vi.
