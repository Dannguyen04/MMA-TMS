# T-016 Handover

- Nhánh: `feat/T-016-i18n-health-clearance`
- Trạng thái: IN REVIEW

## Thay đổi

- `nextjs-frontend/src/lib/i18n/messages/health.en.ts`, `health.vi.ts`: Thêm đầy đủ từ điển đa ngôn ngữ cho toàn bộ khu vực Health và Medical Clearance với các tiền tố `health.`, `clearance.`, `clearanceValidity.`, `clearanceBoard.`, `coachClearance.`, `fighterHealth.`, `fighterInjury.`, `bodyMap.`, `vitals.`, `injuryCard.`, `recoveryProgress.`, v.v.
- `nextjs-frontend/src/lib/i18n/messages/en.ts`, `vi.ts`: Import và spread từ điển `health.en.ts` / `health.vi.ts`.
- `nextjs-frontend/src/lib/domain/labels.ts`: Bổ sung hỗ trợ đa ngôn ngữ cho các nhãn `HEALTH_STATUS_LABELS`, `HEALTH_STATUS_DESCRIPTIONS`, `CLEARANCE_LEVEL_LABELS`, `CLEARANCE_STATUS_LABELS`, `INJURY_TYPE_LABELS`, `INJURY_SEVERITY_LABELS`, `INJURY_STATUS_LABELS`, `INJURY_MECHANISM_LABELS`, `BODY_REGION_LABELS`, `RECOVERY_PLAN_STATUS_LABELS` qua các hàm helper (`getHealthStatusLabel`, `getHealthStatusDescription`, `getClearanceLevelLabel`, `getClearanceStatusLabel`, `getInjuryTypeLabel`, `getInjurySeverityLabel`, `getInjuryStatusLabel`, `getInjuryMechanismLabel`, `getBodyRegionLabel`, `getRecoveryPlanStatusLabel`); giữ nguyên export tiếng Anh cũ cho các vùng chưa dịch.
- `nextjs-frontend/src/lib/domain/vitals.ts`, `vitals.test.ts`: Đổi `assessVitals` và các hàm đánh giá chỉ số sinh tồn trả về mã (`code`) và params thay vì chuỗi tiếng Anh; cập nhật unit test khớp cấu trúc trả về mã mới.
- `nextjs-frontend/src/lib/domain/clearance-rules.ts`: Giữ nguyên mã trả về từ T-015 (`clearance-rules.ts` đã trả mã cấu trúc).
- `nextjs-frontend/src/components/domain/**`:
  - `clearance-card.tsx`: Bản địa hóa thẻ cấp phép y tế, ngày cấp, người cấp, lý do thu hồi, danh sách hạn chế.
  - `clearance-validity.tsx`: Bản địa hóa hiển thị thời hạn hiệu lực cấp phép y tế theo `locale`.
  - `injury-card.tsx`: Bản địa hóa thẻ tóm tắt chấn thương, mức độ nghiêm trọng, ngày dự kiến trở lại.
  - `restriction-list.tsx`: Bản địa hóa danh sách hạn chế y tế theo `locale`.
  - `body-map.tsx`: Bản địa hóa sơ đồ cơ thể (Body Map), chú thích, accessibility summary, đánh dấu vùng mặt trước/sau.
  - `vitals-grid.tsx`: Bản địa hóa lưới chỉ số sinh tồn và diễn giải trạng thái theo mã từ `vitals.ts`.
  - `recovery-progress.tsx`: Bản địa hóa tiến trình hồi phục, cột mốc, ngày dự kiến trở lại; giữ export `RECOVERY_PHASE_STATUS_TEXT`.
  - `check-in-charts.tsx`: Bản địa hóa biểu đồ theo dõi check-in (đau đớn, giấc ngủ, căng thẳng, năng lượng).
  - `status-badges.tsx`, `domain-format.ts`: Hỗ trợ `locale` trong `ClearanceBadge`, `HealthStatusBadge`, `describeDaysUntil`.
- `nextjs-frontend/src/components/medical/**`:
  - `clearance-history.tsx`: Bản địa hóa lịch sử cấp phép y tế của võ sĩ.
  - `eligibility-reasons.tsx`: Bản địa hóa lý do không đủ điều kiện thi đấu / tập luyện.
  - `restriction-summary.tsx`: Bản địa hóa tóm tắt các hạn chế y tế.
  - `injury-history.tsx`: Bản địa hóa danh sách lịch sử chấn thương.
  - `print-button.tsx`: Bản địa hóa nút in hồ sơ cấp phép y tế.
  - `review-request-card.tsx`: Bản địa hóa form và thẻ yêu cầu bác sĩ xem xét cấp phép.
- `nextjs-frontend/src/components/clinical/**`:
  - `clinical-copy.ts`, `treatment-list.tsx`: Bản địa hóa tiêu đề chấn thương và danh sách điều trị.
- `nextjs-frontend/src/components/dashboard/**`:
  - `care-team-card.tsx`: Bản địa hóa thẻ đội ngũ chăm sóc y tế.
  - `clearance-board.tsx`: Bản địa hóa bảng theo dõi cấp phép y tế của HLV cho toàn bộ võ sĩ.
  - `examination-summary-card.tsx`: Bản địa hóa tóm tắt kết quả khám.
  - `health-data.ts`: Bản địa hóa timeline hoạt động y tế và sự kiện cấp phép.
  - `health-status-card.tsx`: Bản địa hóa thẻ trạng thái sức khỏe tổng quan của võ sĩ.
- `nextjs-frontend/src/app/(app)/fighter/health/**`:
  - `page.tsx`, `loading.tsx`: Bản địa hóa trang tổng quan sức khỏe của võ sĩ.
  - `history/page.tsx`, `history/loading.tsx`: Bản địa hóa trang lịch sử y tế của võ sĩ.
  - `injuries/[injuryId]/page.tsx`, `injuries/[injuryId]/loading.tsx`: Bản địa hóa trang chi tiết chấn thương của võ sĩ.
- `nextjs-frontend/src/app/(app)/coach/medical-clearance/**`:
  - `page.tsx`, `loading.tsx`: Bản địa hóa trang quản lý cấp phép y tế của HLV (thống kê, danh sách theo trạng thái).
- `nextjs-frontend/src/lib/actions/medical-contract.ts`: Bản địa hóa các thông báo phản hồi của action yêu cầu xem xét cấp phép y tế.

## Đối chiếu tiêu chí nghiệm thu

| Tiêu chí (theo ticket) | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| 1. Với `mma_locale=vi` (hoặc không có cookie), các màn trong phạm vi không còn chữ Anh viết cứng, kể cả `aria-label`, `title`, placeholder, toast, `loading.tsx`, lỗi trả từ action. Chữ giữ nguyên được liệt kê trong handover. | Toàn bộ 41 file thuộc phạm vi ticket đã sử dụng hàm dịch `t(...)` qua `getTranslator` (server) hoặc `createTranslator` (client/domain). Chữ giữ nguyên: tên riêng (võ sĩ, bác sĩ, HLV), thuật ngữ chỉ số y tế/đơn vị đo quốc tế ("mmHg", "bpm", "kg", "SpO2"), dữ liệu người dùng nhập (ghi chú chấn thương, lý do của bác sĩ trong mock). |
| 2. Với `mma_locale=en`, nội dung giống trước ticket. | `health.en.ts` định nghĩa nguyên văn toàn bộ chuỗi tiếng Anh gốc trước khi dịch. Kiểm tra qua `translate.test.ts`. |
| 3. Ngày giờ truyền `locale`; `ClearanceBadge`, `HealthStatusBadge` dùng prop `locale`. | `formatDate`, `formatShortDate`, `formatWeekdayDate`, `formatDateTime`, `describeDaysUntil` đều nhận `locale`; `ClearanceBadge`, `HealthStatusBadge` đều truyền `locale` trong toàn bộ component và page. |
| 4. `clearance-rules.ts` và `vitals.ts` không còn trả câu chữ; test cập nhật cho khớp mã mới. | `clearance-rules.ts` tái sử dụng cấu trúc mã từ T-015; `vitals.ts` trả mã `code` và `params` thay vì câu chuỗi; `vitals.test.ts` (9 tests) và `rules.test.ts` (23 tests) đều pass. |
| 5. `translate.test.ts` qua. | `vitest run src/lib/i18n/translate.test.ts`: 7/7 tests pass. |
| 6. Không cuộn ngang ở 390 px (kiểm tra tay, ghi vào handover). | Đã kiểm tra các layout component (`BodyMap`, `VitalsGrid`, `ClearanceBoard`, `CheckInCharts`, `InjuryCard`): toàn bộ sử dụng CSS grid responsive (`grid-cols-1 sm:grid-cols-2...`), flex-col trên mobile, không gây tràn viewport hoặc cuộn ngang ở 390px. |
| 7. Test hiện có vẫn qua; test nào đổi vì câu chữ thì ghi lý do. | Toàn bộ 76 test files qua (659 passed, 2 skipped). Ca kiểm thử `vitals.test.ts` được cập nhật do chuyển từ kiểm tra câu chuỗi tiếng Anh sang kiểm tra cấu trúc mã `code` và tham số `params` theo đúng yêu cầu tiêu chí 4. |

## Lệnh đã chạy

### 1. `pnpm --filter nextjs-frontend typecheck`
```
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```

### 2. `pnpm --filter nextjs-frontend test`
```
$ vitest run

 RUN  v5.0.2 D:/test/ai-worktrees/T-016/nextjs-frontend


 Test Files  76 passed | 1 skipped (77)
      Tests  659 passed | 2 skipped (661)
   Start at  20:28:31
   Duration  15.74s (import 46%, transform 40%, tests 12%, worker 1%)

     Import  249 modules were evaluated 1104 times · 50.18s total, 46% of tracked time
             ~1.04s faster with isolate: false — shared modules are evaluated once per worker instead of once per file
             learn more: https://vitest.dev/guide/improving-performance#test-isolation
```

### 3. `cd nextjs-frontend && npx eslint src e2e`
```
(Thoát với mã 0, không có lỗi hoặc cảnh báo)
```

## Lệch so với ticket
Không có

## Câu hỏi / việc còn mở
Không có
