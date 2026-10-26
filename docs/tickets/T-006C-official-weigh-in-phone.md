# T-006 C · Màn cân chính thức trên điện thoại

| | |
| --- | --- |
| **Trạng thái** | READY (26/10) |
| **Người nhận** | Fon |
| **Hạn** | 29/10 (trước tổng duyệt 30/10) |
| **Phụ thuộc** | T-006 A (đã merge). Action `recordWeighInAction`, `recordResultAction` do Hoàng Anh viết ở T-006 B (`a182bd1` trên `feat/T-004-bout-lifecycle-ui`, chưa merge). Bắt đầu sau khi T-006 B và T-011 merge vào `fight-camp`; trước đó dựng giao diện ở demo mode |
| **Nguồn** | [T-006 mục 3](./T-006-weigh-in-and-result.md) (R17–R19), [Luồng nghiệp vụ F5, nghiệp vụ 8](../FIGHT-CAMP-BUSINESS-FLOWS.md) |

## Bối cảnh

Ở buổi cân, HLV đứng cạnh bàn cân và cầm điện thoại. Cân chính thức cần quyền `bout:update` (`POST /bouts/:id/weigh-in`), nên **HLV** là người ghi, không phải võ sĩ. Màn trên máy tính (T-006 B) đã có; ticket này làm bản cho điện thoại: một màn, chạm ít, số to.

## Phạm vi

1. Route mới `nextjs-frontend/src/app/(app)/coach/bouts/[boutId]/weigh-in/page.tsx` (Server Component) và form Client trong cùng thư mục. **Khuôn:** `nextjs-frontend/src/app/(app)/fighter/bout/weigh-in/weigh-in-form.tsx` (T-005 A, form cân điện thoại đã duyệt). Dùng lại `recordWeighInAction` của T-006 B, không viết action mới.
2. Nội dung: tên võ sĩ, giới hạn (`catchweightKg ?? weightLimitKg`), ô số cân (bàn phím số, 30–200 kg, 1 chữ số thập phân), chọn kiểm tra nước (`NOT_APPLICABLE`, `PASSED`, `FAILED`), ghi chú tùy chọn (≤ 500 ký tự), nút Ghi cân.
3. Kết quả trả về:
   - Đạt (R17): báo đạt, trận sang `WEIGHED_IN`, nút về chi tiết trận.
   - Không đạt (`reason = OVER_LIMIT | HYDRATION_FAILED`): hiện **một câu hỏi** với đúng các lựa chọn trong `options` (R18): `CATCHWEIGHT` (gọi action catchweight của T-006 B) hoặc `CANCEL`.
   - `acuteLossFlag` đúng (R19): hiện cảnh báo giảm cân cấp tốc.
   - Lỗi `BOUT_WEIGH_IN_TOO_EARLY`: báo ngày sớm nhất được cân (`earliestOn`); `BOUT_INVALID_TRANSITION`: báo trận không ở tuần thi đấu.
4. Nút "Cân chính thức" trên chi tiết trận của HLV (`coach/bouts/[boutId]/bout-actions.tsx`) chỉ hiện khi trận `FIGHT_WEEK`; trên màn hẹp thì dẫn tới route mới.
5. Chữ giao diện đi qua từ điển (`coach-bouts.en.ts` / `coach-bouts.vi.ts`), theo [T-013 "Quy ước khi dịch"](./T-013-i18n-vi.md).
6. Demo mode: dùng service demo có sẵn trong `nextjs-frontend/src/lib/services/bouts.demo.ts`; thiếu hàm cân thì thêm theo khuôn các hàm cùng file.

## Ngoài phạm vi

Backend. Màn võ sĩ. Form kết quả trận (T-006 B). Đổi contract.

## Tiêu chí nghiệm thu

1. Ở 390 px không cuộn ngang; ô số cân mở bàn phím số (`inputMode="decimal"`).
2. Đạt → trận `WEIGHED_IN`; vượt cân → chỉ hiện lựa chọn có trong `options`; nước `FAILED` mà số cân đạt → vẫn hỏi (theo T-006 mục 3.5).
3. Hai mã lỗi ở mục 3 hiện đúng câu tiếng Việt.
4. Test cho phần chuyển kết quả thành nội dung hiển thị (hàm thuần, theo khuôn `nextjs-frontend/src/lib/domain/bout-rules.test.ts`).
5. Chạy được ở demo mode và API mode (dev được chạy app bằng `.env` của team, TEAM-WORKFLOW §3a).

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```
