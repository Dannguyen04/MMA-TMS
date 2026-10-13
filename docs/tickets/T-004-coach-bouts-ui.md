# T-004 · Màn trận cho HLV: danh sách, tạo, chi tiết, checklist hồ sơ

| | |
| --- | --- |
| **Trạng thái** | READY |
| **Phần** | Frontend (`nextjs-frontend`) |
| **Nhánh** | `feat/T-004-coach-bouts-ui` từ `fight-camp` |
| **Ước lượng** | 2 ngày |
| **Tài liệu dẫn chiếu** | [Luồng nghiệp vụ F1, F2, F4, F8](../FIGHT-CAMP-BUSINESS-FLOWS.md#4-các-luồng), [T-003](./T-003-bouts-core.md) (contract API), [frontend-architecture.md](../../nextjs-frontend/docs/frontend-architecture.md) |

## Bối cảnh

HLV cần một nơi để tạo trận cho võ sĩ, xem các trận sắp tới, quản lý checklist hồ sơ và đưa trận qua Cổng 1. Backend nằm ở T-003, làm **song song**. Vì vậy ticket này làm theo kiểu **demo trước**: chạy đầy đủ ở demo mode bằng dữ liệu mẫu, đồng thời viết adapter cho API mode theo contract trong T-003. Adapter API sẽ được đối chiếu lại với backend thật khi T-003 merge (ghi rõ trong handover những gì chưa đối chiếu được).

## Phạm vi

Theo đúng quy ước trong `nextjs-frontend/docs/frontend-architecture.md` (cấu trúc thư mục, page template, `loading.tsx`, `useActionForm` / `ActionDialog` / `useConfirmAction`, `EmptyState`, `notFound()` khi không có quyền). Giao diện dùng **tiếng Anh**, như phần còn lại của app.

1. **Kiểu và nhãn:** thêm kiểu `Bout`, `BoutRequirement`, `CompetitionRuleset`, `WeightTrack` vào `src/lib/domain/types.ts`, nhãn trạng thái vào `src/lib/domain/labels.ts`. Trường bám theo response mô tả trong T-003 §2–3 (camelCase).
2. **Service** `src/lib/services/bouts.ts` (API mode, Zod schema cho response) và `src/lib/services/bouts.demo.ts` (demo mode, dùng `src/lib/mocks/db.ts`), theo mẫu `goals.ts` / `goals.demo.ts`. Hàm: `listRulesets`, `listBouts(filter)`, `getBout(id)`, `createBout`, `updateBout`, `linkCamp(id, trainingPlanId)`, `enterFightWeek(id)`, `cancelBout(id, reason)`, `addRequirement`, `updateRequirement`, `removeRequirement`, `getWeightTrack(id)`.
3. **Demo:** bản demo phải tự tính các giá trị ở T-003 §3 (`gate1`, `canEnterFightWeek`, cảnh báo cân) bằng **một hàm thuần dùng chung** đặt trong `src/lib/domain/bout-rules.ts` (có test). Thuật toán cảnh báo cân theo [Tech spec §5](../FIGHT-CAMP-TECH-SPEC.md#5-cảnh-báo-cân-nặng). Seed vào mocks: 3 preset như T-003 §1; ít nhất 3 trận cho các võ sĩ của HLV demo, gồm một trận cân đang **đỏ**, một trận **thiếu hồ sơ** (Cổng 1 chặn), một trận đủ điều kiện vào tuần thi đấu. Ngày tháng tương đối theo `src/lib/mocks/time.ts`.
4. **Server actions** `src/lib/actions/bouts.ts`.
5. **Routes** trong `src/lib/routes.ts`: `coach.bouts` = `/coach/bouts`, `coach.newBout` = `/coach/bouts/new`, `coach.bout(id)` = `/coach/bouts/${id}`.
6. **Menu:** thêm mục "Bouts" vào `NAVIGATION.coach`, ngay sau "Today". Cập nhật test thứ tự trong `navigation.test.ts` (tiêu chí 2 của T-001) cho khớp.
7. **Trang `/coach/bouts`:** bảng các trận chưa kết thúc, sắp theo ngày cân: võ sĩ, giải, ngày cân, số ngày còn lại, trạng thái trận, trạng thái cân (badge GREEN/YELLOW/RED/GREY), Cổng 1 (đạt / thiếu n mục). Nút "New bout". `EmptyState` khi chưa có trận.
8. **Trang `/coach/bouts/new`:** form chọn võ sĩ (trong roster của HLV), ruleset, hạng cân (chọn từ danh sách của preset; preset "Tự nhập" thì nhập số kg), tên giải, địa điểm, đối thủ (không bắt buộc), thời điểm cân, thời điểm thi đấu. Kiểm tra phía client: thời điểm cân phải trước thời điểm thi. Preset `verified = false` hiện cảnh báo "Reference only, not verified with the organiser".
9. **Trang `/coach/bouts/[boutId]`:**
    - Đầu trang: võ sĩ, giải, hạng cân (kg), ngày cân và ngày thi, đếm ngược, trạng thái.
    - Hành động theo trạng thái: "Link camp plan" (`SCHEDULED`; chọn trong các plan phase `fight_camp` của võ sĩ), "Enter fight week" (`CAMP`; nếu backend trả 409 thì hiện danh sách mục thiếu), "Cancel bout" (dialog, bắt buộc lý do), "Edit" (sửa thông tin và ngày theo F8).
    - Thẻ **Weight**: số cân mới nhất, phần trăm còn phải giảm, badge trạng thái, câu khuyến nghị khi đỏ (theo [Luồng nghiệp vụ F3](../FIGHT-CAMP-BUSINESS-FLOWS.md#f3-ghi-cân-hằng-ngày-và-cảnh-báo)). **Không** vẽ biểu đồ (T-005 làm).
    - Thẻ **Medical checklist**: danh sách mục, trạng thái, ngày hết hạn, nhãn "Coach-entered, not verified" cho mục `source = COACH`; thêm, sửa (trạng thái, ngày cấp, ngày hết hạn, lý do từ chối), xoá mục; hạn nộp hồ sơ và cảnh báo khi đã quá hạn. **Không** có ô tải file.
10. `loading.tsx` cho cả ba trang.

## Ngoài phạm vi

Backend; màn của võ sĩ, ghi cân và biểu đồ cân (T-005); cân chính thức, kết quả, đình chỉ (T-006, T-007); đổi `NAVIGATION` ngoài việc thêm "Bouts".

## Tiêu chí nghiệm thu

1. Ở demo mode, đăng nhập HLV demo: thấy mục "Bouts", danh sách có đủ 3 trận seed với đúng badge cân và Cổng 1.
2. Tạo trận mới với preset "MMA – VMMAF 2021", hạng 60 kg → trận xuất hiện trong danh sách; với "Tự nhập", nhập 63,5 kg → lưu đúng 63,5.
3. Thời điểm cân sau thời điểm thi → form báo lỗi tại trường, không gửi.
4. Trận thiếu hồ sơ: bấm "Enter fight week" → hiện danh sách mục thiếu, trạng thái không đổi. Thêm và đánh dấu `PROVIDED` (có ngày hết hạn sau ngày thi) cho đủ mục → vào được tuần thi đấu.
5. HLV mở trận của võ sĩ không thuộc roster (sửa URL) → trang 404.
6. `bout-rules.test.ts` kiểm tra các ví dụ ở T-003 tiêu chí 1, 2, 4 cho bản TypeScript của thuật toán.
7. Trang hiển thị đúng ở bề rộng 390 px (không cuộn ngang).
8. Handover liệt kê mọi trường của adapter API và nguồn của từng trường (T-003 mục nào); những gì chưa đối chiếu được với backend thật.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
```

Tiêu chí 1–5 và 7 kiểm tra bằng tay ở demo mode (`pnpm --filter nextjs-frontend dev`). Tắt dev server sau khi kiểm tra xong.
