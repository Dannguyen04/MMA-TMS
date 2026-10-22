# T-028 · Giảm độ trễ khi chuyển tab và chuyển trang ở frontend

| | |
| --- | --- |
| **Trạng thái** | READY (20/10) |
| **Phần** | Frontend (`nextjs-frontend`) |
| **Nhánh** | `perf/T-028-navigation-latency` từ `fight-camp` mới nhất |
| **Người nhận** | Gemini (hoặc FE) |
| **Backend / migration** | Không |
| **Liên quan** | [T-027](./T-027-backend-request-latency.md) (backend); độc lập, làm song song được |

## Bối cảnh

Chủ dự án báo chuyển tab và chuyển trang rất chậm. Mọi lệnh gọi API đều `cache: "no-store"` ([client.ts](../../nextjs-frontend/src/lib/api/client.ts)); `cache()` của React chỉ gộp lệnh gọi trong cùng một request. Khi chuyển tab, layout không chạy lại, nhưng mỗi trang trả lại các khoản sau:

1. **`/users/me` mỗi lần** qua `requireUser`/`requireRole` ([session.ts](../../nextjs-frontend/src/lib/auth/session.ts)). Coach và doctor còn chạy `withAssignmentScope` (dòng ~69-78), đọc hết roster khi `/users/me` không kèm `assignmentScope`.
2. **`requireFighterAccess` → `getFighter`** ([access.ts:37](../../nextjs-frontend/src/lib/auth/access.ts), [people.ts:338](../../nextjs-frontend/src/lib/services/people.ts)) gọi 4 lệnh (`readFighterProfile`, `latestMeasurement`, `coachAssignmentsFor`, `doctorAssignmentsFor`) **trước** khi trang bắt đầu lấy dữ liệu riêng. Các trang võ sĩ gọi nó: training (`fighter/training/page.tsx:27`), health, goals, schedule, performance, dashboard. Nhiều trang chỉ dùng `fighter.id`, mà đó là `user.profileId`.
3. **Fan-out lớn trong một lần render**: `fighter/dashboard` (~10 lệnh, rồi `await boutsRead` sau cùng), `fighter/health` (9 lệnh).
4. **Lấy lại số đếm thanh điều hướng**: `coach/dashboard/page.tsx:70` gọi `getNavBadgeCounts` dù layout đã lấy.
5. **Làm mới cả shell**: `use-notification-updates.ts:45` gọi `router.refresh()` mỗi khi số chưa đọc đổi, và `actions/notifications.ts:20,32` gọi `revalidatePath("/", "layout")`. Cả hai chạy lại layout: `/users/me` + roster + badges + chuông.
6. Không có `staleTimes` trong [next.config.ts](../../nextjs-frontend/next.config.ts), nên chuyển qua lại giữa các tab luôn gọi lại server.

Môi trường dev (`next dev`) còn chậm hơn production vì biên dịch từng route lần đầu; ticket đo trên bản build.

## Phạm vi

**A. Đo trước.** Chạy `pnpm --filter nextjs-frontend build` rồi `start` (không phải `dev`) với backend local (`.env` của team, chỉ đọc, dữ liệu giả; quyết định 19 trong [Phạm vi](../SCOPE-FIGHT-CAMP.md#quyết-định-và-câu-hỏi)). Đo thời gian từ lúc bấm tab đến lúc hiện nội dung (Network tab hoặc Playwright) cho: fighter training → health → goals → dashboard, và coach dashboard → fighters → sessions. Ghi bảng số liệu trước/sau vào handover. Số lượt gọi API mỗi trang đếm bằng log tạm ở `apiRequest`; bỏ log trước khi commit.

**B. Bỏ gate nặng `getFighter` ở trang võ sĩ.** Với trang chỉ cần `fighter.id` (và đã có `canAccessFighter`), dùng `user.profileId` trực tiếp; chỉ gọi `getFighter` ở trang thật sự đọc các trường khác của `Fighter`, và chạy nó **song song** với các lệnh khác của trang, không đứng trước. Kiểm tra từng trang trước khi đổi: trang dùng trường nào của `fighter`.

**C. Gộp lệnh trùng.** Bọc `getNavBadgeCounts` trong `cache()` (hoặc truyền từ layout) để `coach/dashboard` không gọi lần hai. Rà các trang khác xem có lệnh trùng trong cùng request.

**D. Cache ngắn cho dữ liệu ít đổi** bằng cơ chế Next.js đã có sẵn trong phiên bản đang dùng (16.3.4; đọc `node_modules/next/dist/docs/` hoặc tài liệu đi kèm trước khi dùng `use cache`/`unstable_cache`/tag): `/users/me` (theo phiên), danh sách coach/doctor, `getCoachNames`, `getSettings`. TTL ngắn (≤ 60 giây), có thẻ để xoá khi dữ liệu đó bị ghi. Không cache dữ liệu y tế, cân nặng, hay thứ gì liên quan cấp phép.

**E. `staleTimes`** (`experimental.staleTimes.dynamic` ≈ 30 giây) để quay lại tab vừa xem không gọi lại server. Kiểm tra tác động lên trang cần dữ liệu mới ngay sau khi ghi (server action phải vẫn làm mới đúng trang).

**F. Streaming.** Ở `fighter/dashboard` và `fighter/health`, đặt các thẻ phụ vào component server bất đồng bộ trong `<Suspense>` để khung trang hiện trước. Mỗi `fallback` có skeleton sẵn trong `components/ui/skeleton`.

**G. Làm mới thông báo gọn hơn.** Cập nhật chuông và số đếm bằng gọi nhẹ `/notifications/unread-count` (đã có `fetchUnreadCount`) thay vì `router.refresh()` toàn shell; thu hẹp `revalidatePath("/", "layout")` ở `actions/notifications.ts` về phạm vi cần thiết.

## Ngoài phạm vi

Sửa backend (T-027); route đóng băng ([Phạm vi](../SCOPE-FIGHT-CAMP.md#giữ-gộp-đóng-băng)); đổi hợp đồng API; landing page và `src/app/concept/`; thêm thư viện; đổi logic phân quyền (`canAccessFighter`, `requireRole` giữ nguyên hành vi).

## File cần sửa (đã kiểm tra là có thật)

`src/lib/auth/session.ts`, `src/lib/auth/access.ts`, `src/lib/services/people.ts`, `src/lib/services/shell.ts`, `src/app/(app)/fighter/{training,health,goals,schedule,performance,dashboard}/page.tsx`, `src/app/(app)/coach/dashboard/page.tsx`, `src/components/layout/use-notification-updates.ts`, `src/lib/actions/notifications.ts`, `next.config.ts`. Mỗi file chỉ sửa phần nêu trên.

## Tiêu chí nghiệm thu

1. Handover có bảng thời gian chuyển tab và số lượt gọi API trước/sau, đo trên bản production build, cùng điều kiện. Mục tiêu: số lượt gọi API tuần tự (độ sâu chuỗi) của các trang võ sĩ ở mục A giảm ít nhất 2 bước; thời gian chuyển tab trung vị giảm. Không đạt thì ghi nguyên nhân bằng số đo.
2. Trang võ sĩ không còn `await requireFighterAccess` đứng trước các lệnh lấy dữ liệu của trang, trừ trang cần trường của `Fighter` (nêu rõ trang nào và vì sao trong handover).
3. Võ sĩ A không xem được dữ liệu của võ sĩ B: các test truy cập hiện có qua; thêm test cho phần đổi ở `access.ts` nếu có logic mới.
4. `coach/dashboard` gọi `/navigation/badges` (nếu tính năng bật) tối đa một lần mỗi request (test hoặc đếm log, ghi vào handover).
5. Dữ liệu cache có thẻ xoá; sau khi ghi (ví dụ đổi hồ sơ, gán coach), trang đọc lại thấy giá trị mới trong ≤ TTL hoặc ngay. Dữ liệu y tế/cân nặng/cấp phép không nằm trong cache.
6. Sau khi gửi form (tạo buổi tập, ghi cân nặng), trang liên quan hiển thị dữ liệu mới, không bị `staleTimes` giữ bản cũ (kiểm tra tay hoặc E2E, ghi vào handover).
7. Nhận thông báo mới làm số trên chuông đổi mà không chạy lại `/users/me` (đếm log).
8. Dashboard và health hiện khung trang trước, các thẻ phụ hiện sau với skeleton; không nhảy bố cục lớn (kiểm tra tay ở 390 px và 1280 px).
9. Không đổi chữ hiển thị; từ điển i18n không đổi.
10. lint, typecheck, test qua; không thêm lỗi so với [BASELINE](./BASELINE.md).

## Lệnh kiểm tra bắt buộc

```bash
pnpm --filter nextjs-frontend lint
pnpm --filter nextjs-frontend typecheck
pnpm --filter nextjs-frontend test
pnpm --filter nextjs-frontend build
```

## Câu hỏi mở (ghi vào handover, không tự đoán)

- Cơ chế cache nào của Next 16.3.4 phù hợp với cookie phiên (cache theo user thế nào để không lộ dữ liệu giữa người dùng)?
- Backend có thể trả `assignmentScope` luôn trong `/users/me` không (để bỏ `withAssignmentScope`)? Nếu có, ghi đề xuất cho ticket sau; ticket này không sửa backend.
- Trang nào thật sự cần các trường của `getFighter` ngoài `id`?
