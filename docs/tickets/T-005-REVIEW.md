# T-005 Review

- Ngày review: 20/10/2026, Claude. Review sau khi đã merge (theo yêu cầu trực tiếp của chủ dự án).
- Phạm vi: `feat/T-005-weigh-in-and-chart` (`0233277`), đã nằm trong `fight-camp` qua merge `a3bb3bb`.
- **Kết luận: APPROVED**, không có vấn đề mức "chặn". Có 3 vấn đề "nên sửa" và 2 "gợi ý".

## Hạn chế của lần review này

- **Không độc lập.** Chính Claude viết T-005 (chủ dự án chỉ định ngày 19/10, ghi trong handover). Gemini đã đọc chéo vòng 2, nên báo cáo này dựa vào việc chạy lại lệnh và đọc lại các điểm rủi ro, không thay được người ngoài.
- **Chưa kiểm tra tay.** Tôi không mở trình duyệt. Tiêu chí 1–6, 9, 10 (kiểm tra tay ở demo mode) dựa vào bảng chứng cứ trong handover, chưa được chạy lại. Tiêu chí 11 (đối chiếu backend thật) chưa làm được vì chưa có T-003 trên backend thật trong tay tôi.

## Lệnh đã chạy lại

Chạy trên `fight-camp` tại `a2f66e8` (đã gồm merge `a3bb3bb`):

```text
$ pnpm --filter nextjs-frontend typecheck
✓ Types generated successfully

$ pnpm --filter nextjs-frontend test
 Test Files  76 passed | 1 skipped (77)
      Tests  656 passed | 1 skipped (657)

$ npx eslint src e2e      (trong nextjs-frontend)
(không lỗi, exit 0)
```

`pnpm --filter nextjs-frontend lint` (toàn thư mục) báo lỗi, nhưng nguồn lỗi là thư mục `nextjs-frontend/nextjs-frontend/.next/` (bản build của dev server chạy sai thư mục, bị git bỏ qua) chứ không phải mã nguồn. Xoá thư mục đó thì lệnh sẽ qua; việc này thuộc chủ dự án, tôi không xoá.

## Đối chiếu tiêu chí nghiệm thu

| # | Kết quả | Căn cứ của tôi |
| --- | --- | --- |
| 1–3 | Chưa chạy lại tay | Logic: `parseWeightKg` nhận `66,5` và `66.5`, làm tròn 0,1; `recordSelfWeight` demo ghi vào `db().boutMeasurements`; `weigh-in.test.ts` qua |
| 4 | Đạt (test) | `parseWeightKg` từ chối rỗng, chữ, ngoài 30–200 kg; form kiểm tra ở `prepare` |
| 5–6 | Chưa chạy lại tay | Xem handover |
| 7 | Đạt | `people.test.ts` qua; `people.ts:410-422` gửi đúng `POST /fighters/{id}/measurements` với `SELF_REPORTED` |
| 8 | Đạt | `weight-chart.test.ts` qua |
| 9–10 | Chưa chạy lại tay | `weightAlerts` có test thứ tự đỏ, vàng, xám |
| 11 | Chưa đạt, chờ T-003 | Xem Câu hỏi |

Kiểm tra bảo mật của `recordSelfWeightAction` (`src/lib/actions/weigh-in.ts`): bắt buộc phiên đăng nhập, chỉ role `fighter` có `profileId`, ghi vào đúng `profileId` của người gọi (không nhận id từ form), số kg được kiểm tra lại ở server. Đạt.

## Vấn đề

| # | Mức | Vị trí | Mô tả | Cách tái hiện |
| --- | --- | --- | --- | --- |
| 1 | Nên sửa | `src/app/(app)/fighter/bout/loading.tsx:4`, `fighter/bout/weigh-in/loading.tsx:5`, `fighter/dashboard/loading.tsx:4`, `coach/dashboard/loading.tsx:4` | Nhãn `Loading your bout`, `Loading weigh-in`, `Loading your day`, `Loading today` còn viết cứng tiếng Anh. Tiêu chí 3 của T-013 yêu cầu các màn T-005 không còn chữ Anh. Screen reader đọc tiếng Anh dù giao diện là tiếng Việt | Đặt `mma_locale=vi`, mở các trang trên với trình đọc màn hình hoặc xem DOM `aria-label` |
| 2 | Nên sửa | `src/lib/services/people.ts:419,420,428` | Ba câu `message` tiếng Anh trong `recordSelfWeight`. Action hiện chỉ dùng `code`, nên chưa hiển thị cho người dùng; nhưng ai đó dùng `message` sau này sẽ lộ tiếng Anh | Đọc `weigh-in.ts:28` (chỉ dùng `result.code`) |
| 3 | Nên sửa | `src/app/(app)/fighter/dashboard/page.tsx:224,362-405` | Nhãn `Weight` của `ReadinessCell` và thẻ onboarding (`Baseline medical`, `View health`, `First goal`…) còn tiếng Anh. Thuộc Today của võ sĩ | Mở `/fighter/dashboard` với `mma_locale=vi`. Đã nằm trong phạm vi mục 1 của T-014 |
| 4 | Gợi ý | `src/lib/domain/weight-chart.ts` | Nhận xét 2 của Gemini vòng 2 chưa xử lý: biểu đồ bắt đầu từ lần ghi cân đầu tiên nên đoạn tham chiếu trước đó bị ẩn. Ticket quy định như vậy; cần chủ dự án quyết định | Ghi cân đầu tiên muộn hơn ngày bắt đầu camp |
| 5 | Gợi ý | Handover, tiêu chí 6 | Chưa đo thời gian thao tác trên điện thoại thật | — |

## Câu hỏi / việc còn mở

- Tiêu chí 11: khi T-003 chạy trên Supabase thật (chủ dự án áp migration 024), chạy `recordSelfWeight` ở API mode và ghi kết quả vào handover hoặc ticket T-008a.
- Vấn đề 1 và 3: nhờ Gemini sửa trong T-014 (đã thêm vào phạm vi, xem ticket).
