# Giao diện web: select, token và cách chạy

Ghi chú cho đồng đội trên `nextjs-frontend`. Không cần cài trình sinh SVG hay thư viện ngoài lockfile.

## Select dùng chung

Ô chọn là `<select>` gốc trong `src/components/ui/form.tsx` (`Select`). Khung vát nằm ở `src/components/ui/select-frame.css`. SVG góc và cạnh nằm trong `public/ui/select/` và được git theo dõi, kể cả file mới chưa commit trên máy đang làm. Không dùng `mask-border` (Firefox không hỗ trợ). Vòng focus nằm trên phần tử bọc, không bị mask cắt.

## Kéo code và chạy

Trong `nextjs-frontend`:

```powershell
pnpm install
pnpm dev
```

`pnpm install` theo `pnpm-lock.yaml` là đủ. Không có bước cài asset riêng.

## Kiểm tra kiểu và bản production

`pnpm typecheck` (`next typegen && tsc --noEmit`) và `pnpm build` đọc `next.config.ts` như production. Nếu tiến trình PowerShell đang kế thừa `APP_DATA_MODE=demo` hoặc `NEXT_PUBLIC_VIDEO_PIPELINE=mock`, lệnh ném lỗi trước khi biên dịch. Chỉ đặt hai biến cho tiến trình đó, không ghi vào `.env`:

```powershell
$env:APP_DATA_MODE='api'; $env:NEXT_PUBLIC_VIDEO_PIPELINE='api'; pnpm typecheck
$env:APP_DATA_MODE='api'; $env:NEXT_PUBLIC_VIDEO_PIPELINE='api'; pnpm build
```

`pnpm exec tsc --noEmit` không đọc `next.config.ts`, nên không cần hai biến này.

## Test

Unit test chạy môi trường demo mặc định (không đặt `APP_DATA_MODE=api`). Nếu shell còn biến đó từ lần build trước, xóa khỏi tiến trình rồi chạy:

```powershell
Remove-Item Env:APP_DATA_MODE -ErrorAction SilentlyContinue
Remove-Item Env:NEXT_PUBLIC_VIDEO_PIPELINE -ErrorAction SilentlyContinue
pnpm exec vitest run --maxWorkers 1 --fileParallelism false
```
