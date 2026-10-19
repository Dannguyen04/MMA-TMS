# T-013 Handover (Phần 2: Màn trận của HLV)

- Nhánh: `feat/T-013b-i18n-coach-bouts`
- Commit: `c3e2bce`, `48c93bb`, `325a6a4`
- Trạng thái: IN REVIEW

## Thay đổi

Danh sách các file đã dịch và thay đổi:

- `nextjs-frontend/src/lib/i18n/messages/coach-bouts.en.ts` & `coach-bouts.vi.ts`:
  - Định nghĩa toàn bộ từ điển song ngữ cho khu vực màn HLV (tiền tố `coachBouts.`), bao gồm danh sách trận, biểu mẫu tạo trận mới, chi tiết trận, các dialog hành động, checklist y tế, toast, loading label, training phase label và lỗi/thông báo Server Action.
  - Typecheck chặt chẽ qua `satisfies Record<keyof typeof enCoachBouts, string>`.
- `nextjs-frontend/src/app/(app)/coach/bouts/page.tsx`:
  - Đổi metadata sang `generateMetadata()` dùng `getTranslator()`.
  - Dịch tiêu đề trang, mô tả số trận hoạt động qua `plural(t, "coachBouts.activeBouts", ...)`.
  - Dịch nút "Tạo trận mới", empty state, toàn bộ tiêu đề cột bảng.
  - Dịch hiển thị đếm ngày cân (`formatDaysDisplay` với `plural`), nhãn "Chưa rõ võ sĩ", đối thủ ("gặp ...").
  - Truyền `locale` vào `formatShortDate`, `BoutStatusBadge`, `WeightWarningBadge`, `Gate1Badge`.
- `nextjs-frontend/src/app/(app)/coach/bouts/new/page.tsx`:
  - Đổi metadata sang `generateMetadata()` dùng `getTranslator()`.
  - Dịch tiêu đề trang và nhãn quay lại menu trận đấu.
- `nextjs-frontend/src/app/(app)/coach/bouts/new/bout-form.tsx`:
  - Dùng `useT()` để dịch lỗi client validation trong `prepare` (buổi cân phải trước trận đấu).
  - Dịch tiêu đề các form section, toàn bộ field label, select placeholder, input hint/placeholder, cảnh báo luật thi đấu chưa xác thực, nút huỷ và submit.
- `nextjs-frontend/src/app/(app)/coach/bouts/[boutId]/page.tsx`:
  - Đổi metadata sang `generateMetadata()` dùng `getTranslator()`.
  - Dịch eyebrow, tiêu đề mô tả (võ sĩ gặp đối thủ · kg).
  - Dịch hiển thị đếm ngược ngày cân (bao gồm cả trường hợp đã qua ngày cân: "Đã cân cách đây n ngày").
  - Dịch cảnh báo bộ luật chưa xác thực với ban tổ chức.
  - Dịch các thẻ thông tin bên phải: Quy định thi đấu, Đợt tập camp (kèm phase label tiếng Việt và số buổi mục tiêu), Ghi chú HLV, Lịch sử trạng thái (dùng lại key `boutStatus.*`).
  - Truyền `locale` vào `formatDate`, `formatDateTime`, `BoutStatusBadge`.
- `nextjs-frontend/src/app/(app)/coach/bouts/[boutId]/bout-actions.tsx`:
  - Dịch 4 nút hành động ở header và toàn bộ 4 ActionDialog:
    1. Liên kết giáo án camp: title, description, submit/pending label, toast, cảnh báo không có giáo án camp, field label, hint, option hiển thị phase.
    2. Vào tuần thi đấu: title, description, submit/pending label, toast, notice text, tiêu đề danh sách thiếu Cổng 1.
    3. Huỷ trận đấu: title, description, submit/pending label, toast, field label, hint, textarea placeholder.
    4. Chỉnh sửa thông tin trận đấu: title, description, submit/pending label, toast, lỗi client validation trong `prepare`, tất cả field label, hint.
- `nextjs-frontend/src/app/(app)/coach/bouts/[boutId]/bout-checklist-card.tsx`:
  - Dịch tiêu đề thẻ, nút thêm mục, thông báo hạn nộp hồ sơ, badge Quá hạn, cảnh báo quá hạn, empty state.
  - Dịch nhãn danh sách mục hồ sơ: Không bắt buộc, HLV nhập chưa xác thực, ngày cấp, hiệu lực đến, cảnh báo hết hạn trước trận, lý do từ chối, nút và aria-label sửa/xoá.
  - Dịch 3 dialog hành động:
    1. Thêm mục hồ sơ: title, description, submit/pending label, toast, các field label/hint/placeholder.
    2. Sửa mục hồ sơ: title, description, submit/pending label, toast, các option trạng thái (Missing, Provided, Confirmed, Rejected), các field label/hint/placeholder.
    3. Xoá mục hồ sơ: title, description, submit/pending label, toast, thông báo cảnh báo xoá vĩnh viễn.
  - Truyền `locale` vào `Gate1Badge`, `BoutRequirementStatusBadge`, `formatDate`, `formatShortDate`.
- `nextjs-frontend/src/app/(app)/coach/bouts/loading.tsx`, `new/loading.tsx`, `[boutId]/loading.tsx`:
  - Chuyển thành async Server Component, dùng `getTranslator()` để dịch `LoadingRegion label`.
- `nextjs-frontend/src/lib/actions/bouts.ts`:
  - Dùng `getTranslator()` trong mọi Server Action.
  - Tạo các schema Zod trong hàm với `t` để dịch toàn bộ thông báo lỗi validation.
  - Dịch toàn bộ thông báo thành công và lỗi nghiệp vụ trả về từ action.

## Chữ tiếng Anh cố ý giữ (tên riêng, mã kỹ thuật)

1. Tên riêng và dữ liệu do người dùng/hệ thống nhập:
   - Tên võ sĩ (`fighter.name`), tên giải đấu (`bout.eventName`), tên đối thủ (`bout.opponentName`), địa điểm (`bout.venue`).
   - Tên bộ luật (`ruleset.name`), tên giáo án (`linkedPlan.title`), mục tiêu giáo án (`linkedPlan.objective`).
   - Lý do huỷ/chuyển trạng thái (`entry.reason`), tên mục hồ sơ (`req.label`), mã mục hồ sơ (`req.code`).
2. Mã kỹ thuật và tên định danh:
   - Môn thể thao: `"MMA"` (fallback khi ruleset không có tên sport).
   - Tên trường dữ liệu form / FormData: `"fighterId"`, `"rulesetId"`, `"weightClassCode"`, `"weightLimitKg"`, `"eventName"`, `"venue"`, `"opponentName"`, `"weighInAt"`, `"boutAt"`, `"notes"`, `"requirementsDueDays"`, `"reason"`, `"code"`, `"label"`, `"validityDays"`, `"status"`, `"issuedOn"`, `"validUntil"`, `"statusReason"`.
   - Mã trạng thái enum kỹ thuật: `"SCHEDULED"`, `"CAMP"`, `"FIGHT_WEEK"`, `"WEIGHED_IN"`, `"COMPLETED"`, `"CANCELLED"`, `"MISSING"`, `"PROVIDED"`, `"CONFIRMED"`, `"REJECTED"`.

## Đối chiếu tiêu chí nghiệm thu

| Tiêu chí (theo ticket) | Đáp ứng ở đâu (file:dòng, test nào) |
| --- | --- |
| **Tiêu chí 3**: Không còn chữ tiếng Anh viết cứng ở cả hai ngôn ngữ, trừ tên riêng và dữ liệu | Toàn bộ 9 file màn hình/loading/dialog/card/action của HLV bouts đã được rà soát sạch chữ tiếng Anh viết cứng: `coach/bouts/page.tsx:22-165`, `coach/bouts/new/page.tsx:15-46`, `coach/bouts/new/bout-form.tsx:53-310`, `coach/bouts/[boutId]/page.tsx:33-238`, `coach/bouts/[boutId]/bout-actions.tsx:47-355`, `coach/bouts/[boutId]/bout-checklist-card.tsx:50-394`, `coach/bouts/loading.tsx`, `coach/bouts/new/loading.tsx`, `coach/bouts/[boutId]/loading.tsx`, `src/lib/actions/bouts.ts:26-398`. |
| **Tiêu chí 5**: `translate.test.ts` qua: hai từ điển cùng key, cùng placeholder, mọi nhãn menu có bản dịch | Test `nextjs-frontend/src/lib/i18n/translate.test.ts` qua 100% (7/7 tests passed). Mọi key trong `enCoachBouts` và `viCoachBouts` khớp nhau hoàn toàn, không có key rỗng, placeholder khớp chính xác. |

## Lệnh đã chạy

### 1. `pnpm --filter nextjs-frontend lint`

```text
$ eslint
```

(Thoát mã 0, không có lỗi hay cảnh báo)

### 2. `pnpm --filter nextjs-frontend typecheck`

```text
$ next typegen && tsc --noEmit
Generating route types...
✓ Types generated successfully
```

(Thoát mã 0)

### 3. `pnpm --filter nextjs-frontend test`

```text
$ vitest run

 RUN  v5.0.2 D:/test/ai-worktrees/T-013b/nextjs-frontend


 Test Files  74 passed | 1 skipped (75)
      Tests  636 passed | 1 skipped (637)
   Start at  18:22:38
   Duration  5.95s (import 52%, transform 27%, tests 19%, worker 2%)

  Transform  transforming modules took 10.27s · 27% of tracked time, re-done on every run
             persist transforms across runs with fsModuleCache: true
             learn more: https://vitest.dev/guide/improving-performance#caching-between-reruns
```

(74 files passed, 636 tests passed, không có lỗi mới so với baseline)

## Lệch so với ticket

Không có.

## Câu hỏi / việc còn mở

Không có.
