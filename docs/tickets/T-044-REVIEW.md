# T-044 Review (phần A: xoá file không dùng)

- Ngày review: 29/10/2026, Claude.
- Phạm vi: `chore/T-044-trim-dead-files`, `3e7b598`.
- **Kết luận: APPROVED.**
- Không có handover. Phiên Gemini (`gemini-3.8-flash-high`) đã `git rm` đủ 25 file, nhưng sau đó chạy lệnh kiểm tra ở chế độ nền rồi ngồi chờ, và kết thúc mà không commit (khoảng 3,2 triệu token cache). Claude commit phần đã xoá, tự kiểm tra lại và viết báo cáo này thay cho handover.

## Đã xoá (25 file, đúng danh sách của ticket)

- Backend: `governance-verifier.service.ts`, `infinity-pagination.ts`, `infinity-pagination-response.dto.ts`, `PaginationOptions.ts`.
- Frontend: `coaching-client.ts`, `application-summary.ts`, kèm 2 file test của chúng.
- Mobile: 12 file nguồn, kèm `auth-step-pager.test.tsx` và `auth-step-rail.test.tsx`.
- Script ở root: `create_buckets.mjs`, `test_upload.mjs` (gọi thẳng Supabase Storage một lần), `test_dom.mjs` (puppeteer). Không có `package.json`, CI hay tài liệu `.md` nào gọi tới.

Kiểm lại sau khi xoá: `git grep` theo tên từng file (bỏ qua `docs/` và `.md`) không còn kết quả. Kết quả duy nhất khớp tên `logo-mark` là `nextjs-frontend/src/components/brand/logo.tsx`, file này import `./logo-mark.webp` (ảnh của frontend, không liên quan).

## Lệnh đã chạy (so với baseline `fight-camp` cùng ngày, `D:/test/ai-worktrees/logs/T-044-baseline.txt`)

| Lệnh | Baseline | Sau T-044 |
| --- | --- | --- |
| `nestjs-api` lint, build | 0 error, build qua | 0 error, build qua |
| `nestjs-api` test | 26 failed, 1113 passed (1139) | 26 failed, 1113 passed (1139) |
| `nextjs-frontend` lint, typecheck | sạch | sạch |
| `nextjs-frontend` test | 822 passed, 2 skipped | 813 passed, 2 skipped. Giảm 9 = 3 (`application-summary.test.ts`) + 6 (`coaching-client.test.ts`) |
| `reactnative-mobile` `tsc --noEmit` | 994 `error TS` (có sẵn) | 959. Giảm vì file đã xoá |
| `reactnative-mobile` jest (`--json`) | 1 suite lỗi (`video-upload.test.tsx` không chạy được), 0 test lỗi, 164 test | Giống hệt, 157 test. Giảm 7 = 4 (`auth-step-pager.test.tsx`) + 3 (`auth-step-rail.test.tsx`) |

`npm test` của mobile cho số suite lỗi dao động giữa các lần chạy (6 rồi 5). Chạy jest trực tiếp thì hai bên có cùng một suite lỗi.

## Tiêu chí nghiệm thu

1. Đã xoá đủ các file trong danh sách: **đạt**.
2. Không sửa file nào khác: **đạt** (diff chỉ có xoá).
3. Không thêm lỗi; số test giảm đúng bằng số test trong các file test đã xoá: **đạt**.
