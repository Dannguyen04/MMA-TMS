# T-025 · Tiếng Việt: rà soát cuối và khoá chặn chữ Anh mới

| | |
| --- | --- |
| **Trạng thái** | READY (chủ dự án duyệt 20/10). Làm cuối, sau khi T-014 đến T-024 đã merge |
| **Phần** | Frontend (`nextjs-frontend`) |
| **Nhánh** | `feat/T-025-i18n-final-sweep` từ `fight-camp` mới nhất |
| **Thuộc** | Phần 3 của [T-013](./T-013-i18n-vi.md). Mục "Thiết kế" và "Quy ước khi dịch" của T-013 áp dụng nguyên văn |

## Bối cảnh

Sau khi các ticket dịch theo khu vực xong, còn lại những chỗ lẻ không thuộc khu vực nào: nhãn enum dùng chung trong `src/lib/domain/labels.ts`, `src/lib/mocks/**` hiển thị trực tiếp, thông báo của `not-found.tsx` và `error.tsx`, `src/components/ui/**`, `src/components/charts/**`, trang `/api/**` trả chữ. Ticket này quét sạch và thêm test để chữ Anh không quay lại.

## Phạm vi

1. **Quét chữ Anh còn sót** toàn `nextjs-frontend/src`, trừ các chỗ giữ cố ý. Dùng kiểm tra tự động (mục 3) và rà tay: chuỗi bắt đầu bằng chữ hoa trong JSX, `aria-label`, `title`, `placeholder`, `alt`, toast, `metadata`, `loading.tsx`, `not-found.tsx`, `error.tsx`.
2. **`src/lib/domain/labels.ts`:** các `*_LABELS` còn dùng ở đâu thì chuyển sang key từ điển hoặc hàm nhận `locale`. Bỏ export không còn ai dùng. Với badge trong `status-badges.tsx` và các hàm định dạng ở `src/lib/format.ts`: đổi tham số `locale` từ tuỳ chọn (mặc định `"en"`) sang bắt buộc, để màn quên truyền `locale` bị `typecheck` bắt thay vì lặng lẽ hiện tiếng Anh.
3. **Test chống thoái lui** `src/lib/i18n/hardcoded-english.test.ts`: quét các file `.tsx` trong `src/app` và `src/components` tìm văn bản JSX hoặc thuộc tính hiển thị chứa chữ Anh viết cứng, với danh sách cho phép (allowlist) ghi lý do cho từng ngoại lệ (tên thương hiệu, đơn vị, mã kỹ thuật). Test phải qua trên code hiện tại và lỗi khi thêm một chuỗi Anh mới.
4. **`<html lang>`, metadata và trang lỗi:** `src/app/layout.tsx` (`metadata`), `src/app/not-found.tsx`, `src/app/(app)/error.tsx`, `src/app/(app)/not-found.tsx` dùng ngôn ngữ người xem.
5. **Tài liệu quy ước:** cập nhật mục "UI copy is English" trong `nextjs-frontend/docs/frontend-architecture.md` thành quy ước song ngữ (do T-013 quyết định). Đây là ngoại lệ được phép sửa `docs/` của Gemini cho riêng ticket này (nằm ngoài thư mục `docs/` gốc, trong `nextjs-frontend/docs/`).

## Ngoài phạm vi

- Không đổi logic, route, schema, backend; không cài thư viện.
- Không dịch tên riêng, dữ liệu người dùng nhập, dữ liệu mock mô phỏng nhập liệu của người dùng.

## Tiêu chí nghiệm thu

1. `hardcoded-english.test.ts` qua trên code hiện tại; thử thêm `<p>Hello world</p>` vào một component thì test lỗi (ghi lại cách thử trong handover, rồi hoàn tác).
2. Mọi `locale` của `formatDate`, `formatShortDate`, `formatWeekdayDate`, `formatTime`, `formatDateTime`, `formatMonthYear` và badge là bắt buộc; `typecheck` qua.
3. Với `mma_locale=vi`, không còn chữ Anh viết cứng trong toàn `src`, trừ allowlist đã ghi lý do. Với `mma_locale=en`, nội dung giống bản tiếng Anh trước đợt dịch.
4. `translate.test.ts` qua; `frontend-architecture.md` đã cập nhật.
5. Không cuộn ngang ở 390 px trên các trang chính của bốn vai trò (kiểm tra tay hoặc bằng e2e của T-021; ghi vào handover).
6. Test hiện có vẫn qua; test nào đổi vì câu chữ thì ghi lý do.

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
npx eslint src e2e        # trong nextjs-frontend
```
