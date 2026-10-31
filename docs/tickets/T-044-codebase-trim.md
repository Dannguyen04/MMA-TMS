# T-044 Tinh gọn source code sau buổi review 27/10

- Trạng thái: phần A READY (29/10, chủ dự án duyệt giao Gemini), nhánh `chore/T-044-trim-dead-files`. Phần B: DRAFT, chờ T-040 và quyết định của chủ dự án.
- Người nhận: phần A Gemini `gemini-3.8-flash-high` (worktree `D:/test/ai-worktrees/T-044`). Phần B: người làm T-040.
- Phụ thuộc: phần A không phụ thuộc gì. Phần B phụ thuộc [T-040](./README.md) (demo trên backend thật).

## Bối cảnh

Sau buổi review 27/10 ([nhận xét](../REVIEW-27-10-FEEDBACK.md)), chủ dự án yêu cầu tinh gọn source code. Claude đã rà ba app ngày 27/10 bằng cách dựng đồ thị import từ các file entry (Next.js: `page`, `layout`, `route`… và `src/proxy.ts`; NestJS: `src/main.ts`; Expo: `src/app/**`), đối chiếu thêm bằng `git grep` theo tên file, và chạy lint:

- Lint của `nextjs-frontend` và `nestjs-api` không báo biến hay import nào không dùng, nên không cần dọn ở mức dòng.
- Còn lại hai loại thừa: **file không được import từ đâu** (phần A) và **code demo mode** chạy song song với API thật (phần B).

## Phần A: xoá file không dùng

### Phạm vi

Xoá các file dưới đây cùng test chỉ dùng để kiểm tra chính file đó. Trước khi xoá, người thực hiện chạy lại `git grep -n "<tên file không đuôi>"` cho từng file. Nếu thấy chỗ dùng mà ticket chưa ghi thì **giữ file** và ghi vào handover.

**Backend (`nestjs-api/src`)**

| File | Dòng | Ghi chú |
| --- | --- | --- |
| `dataset-export/services/governance-verifier.service.ts` | 154 | Không module nào khai báo `GovernanceVerifierService`, không file nào import |
| `shared/utils/infinity-pagination.ts` | 13 | Không ai import |
| `shared/dto/infinity-pagination-response.dto.ts` | 27 | Chỉ `infinity-pagination.ts` dùng |
| `shared/types/PaginationOptions.ts` | 5 | Chỉ `infinity-pagination.ts` dùng |

**Frontend (`nextjs-frontend/src`)**

| File | Dòng | Test đi kèm, xoá cùng |
| --- | --- | --- |
| `lib/api/coaching-client.ts` | 217 | `lib/api/coaching-client.test.ts` |
| `components/admissions/application-summary.ts` | 72 | `components/admissions/application-summary.test.ts` |

Giữ `src/test/server-only-stub.ts` và `src/test/platform-features-mock.ts`, vì `vitest.config.mts` và các test đang dùng hai file này.

**Mobile (`reactnative-mobile/src`)**

| File | Dòng | Test đi kèm, xoá cùng |
| --- | --- | --- |
| `screens/fighter/appearance-editor.tsx` | 509 | — |
| `screens/doctor/clinical-read.tsx` | 185 | — |
| `screens/doctor/blocked-page.tsx` | 41 | — (bản đang dùng là `screens/coach/blocked-page.tsx`, giữ nguyên) |
| `screens/dashboard/dashboard.tsx` | 9 | — |
| `components/launch/splash-layers.tsx` | 182 | — |
| `components/launch/dashboard-skeleton.tsx` | 78 | — |
| `components/launch/strike-track-mark.tsx` | 38 | — |
| `components/brand/logo-mark.tsx` | 43 | — |
| `components/auth/auth-section.tsx` | 31 | — |
| `components/auth/auth-step-pager.tsx` | 43 | `components/auth/auth-step-pager.test.tsx` |
| `components/auth/auth-step-rail.tsx` | 101 | `components/auth/auth-step-rail.test.tsx` |
| `constants/fighter-stances.ts` | 8 | — |

Giữ nguyên:

- `screens/fighter/redesign/header-layout.ts`: `theme/appearance-product.test.ts` đang dùng.
- `components/launch/splash-video-source*.ts`: Metro chọn file theo nền tảng.
- `shims/moti-safe-area-view.ts`: `metro.config.js` nạp file này.

**Script ở root (`scripts/`)**: `test_upload.mjs`, `test_dom.mjs`, `create_buckets.mjs` không được `package.json`, CI hay tài liệu nào gọi tới. Người thực hiện mở từng file, xác nhận đây là script thử một lần rồi mới xoá. Không chắc thì giữ lại và ghi vào handover.

Tổng phần A: khoảng 1.750 dòng trên 18 file nguồn (chưa tính 3 script và test).

### Ngoài phạm vi phần A

- Tách file lớn (`bouts.service.ts` 2.034 dòng, `bouts.model.ts` 1.480 dòng, `medical.repo.ts` 1.379 dòng). Tách theo trách nhiệm cần ticket riêng, giống [T-031](./T-031-refactor-suggest-suspensions-srp.md).
- Video kiểm định trong `python-worker/validation_videos/` và `yolov8n-pose.pt`: Dockerfile và benchmark đang dùng. Ngoài ra, bỏ khỏi git cũng không làm lịch sử repo nhẹ đi.
- Sửa logic hay đổi tên bất kỳ thứ gì còn được dùng.

### Tiêu chí nghiệm thu phần A

1. Các file trong danh sách đã bị xoá, trừ file mà handover ghi rõ lý do giữ.
2. Không file nào khác bị sửa, trừ chỗ import trỏ tới file đã xoá (theo rà soát ngày 27/10 thì không có chỗ nào như vậy).
3. Lệnh kiểm tra bên dưới không thêm lỗi nào so với [baseline](./BASELINE.md). Số test giảm đúng bằng số test trong các file test đã xoá, và handover ghi số đó.

### Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nestjs-api lint
pnpm --filter nestjs-api build
pnpm --filter nestjs-api test
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
cd reactnative-mobile && npx tsc --noEmit && npm test
```

## Phần B: bỏ demo mode (chờ T-040)

### Hiện trạng

`isDemoAuthEnabled()` ở `nextjs-frontend/src/lib/auth/constants.ts:23` trả `true` khi `NODE_ENV !== "production"` và `APP_DATA_MODE !== "api"`. Vì vậy chế độ mặc định khi chạy dev là demo, dữ liệu nằm trong bộ nhớ. Mỗi hàm service đều rẽ nhánh. Ví dụ `nextjs-frontend/src/lib/services/bouts.ts:308-486` có 12 dòng dạng `if (isDemoAuthEnabled()) return (await demoService()).…`.

Quy mô:

- 194 lời gọi `isDemoAuthEnabled(` trong 29 file không phải test.
- 16 file demo, khoảng 5.900 dòng: `lib/services/*.demo.ts` (medical 1.258, training 917, admin 582, ai 521, videos 431, bouts 360, goals 229, admissions 228, notifications 92, audit 92, care-team 74); `lib/i18n/messages/demo-flow.{vi,en}.ts`; `lib/i18n/demo-copy.ts`; `lib/auth/demo-session.ts`; `app/(auth)/login/demo-accounts.tsx`.

Theo nhận xét 27/10 mục 4, demo phải chạy backend thật. Khi T-040 xong và buổi tổng duyệt 9/11 chạy ổn ở API mode, demo mode chỉ còn làm hai việc: chạy app không cần backend, và làm dữ liệu cho unit test.

### Việc cần chủ dự án quyết trước khi viết thiết kế

1. Bỏ hẳn demo mode, hay giữ làm chế độ chạy không cần backend (khi mất mạng lúc trình bày) nhưng chuyển mặc định sang API?
2. Unit test nào đang dựa vào dữ liệu demo thì chuyển sang mock trong test.

Claude viết thiết kế chi tiết cho phần B (danh sách file, thứ tự gỡ theo từng service, tiêu chí nghiệm thu) sau khi có hai quyết định trên và T-040 đã DONE.

## Phần C: nguồn Việc cần làm không còn bật

Ghi ngày 31/10, từ review T-040 B (Ken phát hiện). Chủ dự án quyết hướng trước khi giao.

`trainingConflictsProvider` (`nestjs-api/src/bouts/bouts-todo.model.ts:186-204`, nguồn `TRAINING_CONFLICTS_WITH_SUSPENSION`) chỉ bật khi võ sĩ có buổi `SCHEDULED` từ hôm nay trở đi nằm trong khoảng đình chỉ. Từ T-036 thì trường hợp này không còn xảy ra với dữ liệu mới:

- Tạo đình chỉ bằng tay (`suspensions.service.ts:136`) và ghi kết quả thua KO (`bouts.service.ts:1823`) đều gọi `SuspensionEffects.runOnCreated` trong cùng giao dịch. Hàm này chuyển buổi bị chặn sang `PENDING` hoặc `CANCELLED`.
- Cổng 2 chặn tạo buổi (`training-session.service.ts:112`) và dời buổi (`:197`) vào khoảng đình chỉ.

Còn hai trường hợp provider vẫn bật được:

1. Dữ liệu cũ trên Supabase: buổi `SCHEDULED` thuộc các đình chỉ tạo trước khi áp migration 032 (30/10).
2. Khe tranh chấp: `createSession` kiểm Cổng 2 ngoài giao dịch, nên một đình chỉ tạo đúng lúc đó vẫn có thể để lại buổi `SCHEDULED`. Cổng lúc bắt đầu buổi tập vẫn chặn được buổi này.

Việc cần quyết: xoá provider hay giữ làm lưới an toàn cho hai trường hợp trên. Nếu xoá thì phải sửa cùng lúc:

- Backend: `bouts-todo.model.ts` (`TODO_SOURCES`, provider, `FIGHTER_SCOPED_SOURCES`), `bouts-todo.service.ts` và các spec liên quan.
- Frontend: trên `fight-camp` ngày 31/10 chưa có mã này. Nhánh `feat/T-030-suspension-ui` đang thêm vào `lib/domain/coach-todo.ts`, `coach/dashboard/coach-todo-card.tsx` và từ điển, nên phải báo Ken.
- Trước khi xoá, kiểm Supabase không còn dữ liệu thuộc trường hợp 1.
- Dòng R28 trong bảng Việc cần làm của [FIGHT-CAMP-BUSINESS-FLOWS](../FIGHT-CAMP-BUSINESS-FLOWS.md) sửa theo quyết định này.
