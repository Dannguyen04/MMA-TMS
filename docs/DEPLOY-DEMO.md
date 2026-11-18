# Deploy bản demo (miễn phí) và CD

Cập nhật 14/11/2026. Mục tiêu: một bản chạy trên mạng để cả team và người xem dùng được trong buổi demo, chi phí 0 đồng. Bản này thay phần Render/Vercel/Upstash của [DEPLOY_GUIDE.md](../DEPLOY_GUIDE.md).

## Địa chỉ

| Phần | Địa chỉ |
| --- | --- |
| Web | https://mma-tms-demo.vercel.app |
| API | https://mma-tms-api.onrender.com (kiểm tra: `/health`) |

## Kiến trúc

| Phần | Chạy ở đâu | Gói |
| --- | --- | --- |
| Frontend (`nextjs-frontend`) | Vercel, project `mma-tms` | Hobby (miễn phí) |
| Backend (`nestjs-api`) | Render, Docker, Singapore, service `mma-tms-api` | Free (ngủ sau 15 phút không có request) |
| Hàng đợi video | Render Key Value `mma-tms-redis` | Free (25 MB, mất dữ liệu khi khởi động lại) |
| Database, storage | Supabase hiện có | Không đổi |
| AI phân tích video (`python-worker`, YOLO) | Máy của Dan (có GPU) | Không tốn phí |
| AI chiến thuật, lời dặn giữa hiệp (Gemini) | Gọi từ backend | Key hiện có |

## CD chạy thế nào

Nhánh được deploy: `release/final-review`. Mỗi lần push lên nhánh này:

- **GitHub Actions** chạy [CI](../.github/workflows/ci.yml): lint, typecheck, test, build frontend; lint, build backend; quét secret.
- **Render** build và deploy backend khi commit có đổi `nestjs-api/`, lockfile hoặc `render.yaml`. Render tự kiểm tra `/health`: bản mới không lên được thì bản cũ vẫn chạy.

  **Tạm thời (14/11):** GitHub Actions không chạy job nào vì tài khoản GitHub bị khoá thanh toán ("account is locked due to a billing issue"), nên Render đang deploy theo mỗi commit (`autoDeployTrigger: commit`), không chờ CI. Gỡ khoá ở GitHub > Settings > Billing xong thì đổi thành `checksPass` trong [render.yaml](../render.yaml) để Render chỉ deploy khi CI xanh. Trong lúc chờ, chạy các lệnh CI ở máy trước khi push.
- **Vercel** build frontend ngay khi có push và gắn bản mới vào `mma-tms-demo.vercel.app`. Các nhánh khác bị bỏ qua (Ignored Build Step trong cài đặt project).

Vercel không chờ CI, nên trong vài phút sau push frontend mới có thể chạy với backend cũ. Với demo một buổi thì chấp nhận được: đừng push ngay trước giờ demo.

## Cài đặt (đã làm ngày 14/11)

- Vercel: project `mma-tms`, Root Directory `nextjs-frontend`, nối repo GitHub, domain `mma-tms-demo.vercel.app` theo nhánh `release/final-review`, tắt Vercel Authentication để ai cũng mở được. Biến: `API_URL`, `NEXT_PUBLIC_API_URL` (URL Render), `APP_DATA_MODE=api`, `NEXT_PUBLIC_VIDEO_PIPELINE=api`, cho Production và Preview.
- Supabase: đã có đủ migration tới `033_suspension_early_end.sql` (đọc `mma_private.migration_history`). Backend kiểm tra schema khi khởi động, nên migration mới phải áp lên Supabase trước khi merge code cần nó.
- Render: tạo bằng Blueprint từ [render.yaml](../render.yaml) (New > Blueprint > repo `Dannguyen04/MMA-TMS`, nhánh `release/final-review`), nhập `WORKER_SECRET_TOKEN`, `DATABASE_URL`, `SUPABASE_*`, `GEMINI_*` giống `nestjs-api/.env`.

Nếu Render cấp URL khác `mma-tms-api.onrender.com`, sửa `API_URL` và `NEXT_PUBLIC_API_URL` trên Vercel rồi Redeploy.

## Worker AI trên máy Dan

Cấu hình demo nằm ngoài repo, ở `D:\test\ai-worktrees\secrets\worker-demo.env`: `REDIS_URL` (External URL của `mma-tms-redis`), `NESTJS_API_URL=https://mma-tms-api.onrender.com`, `WORKER_SECRET_TOKEN` (giống trên Render), `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `POLL_INTERVAL_S=3`. `python-worker/.env` giữ nguyên để chạy local.

Chạy:

```powershell
pwsh -File D:\test\ai-worktrees\secrets\start-demo-worker.ps1
```

Thấy dòng `Đang lắng nghe queue 'video-analysis'` là được. Log của worker in cả chuỗi Redis có mật khẩu, đừng chiếu cửa sổ này lên màn hình.

Khi nhập biến lên Render, bỏ dấu ngoặc kép bao quanh giá trị (các file `.env` của repo có ngoặc kép). Lần deploy đầu ngày 14/11 hỏng vì `DATABASE_URL` dính ngoặc kép (log: `getaddrinfo ENOTFOUND base`).

## Ngày demo: làm trước 30 phút

1. Mở https://mma-tms-api.onrender.com/health để đánh thức Render (lần đầu khoảng 1 phút), thấy `"status":"ok"`.
2. Tắt chế độ ngủ của máy Dan, bật worker.
3. Mở https://mma-tms-demo.vercel.app/login, đăng nhập lần lượt các vai HLV, võ sĩ, bác sĩ bằng tài khoản demo.
4. Thử AI Gemini: vào một trận, bấm gợi ý chiến thuật trước trận, phải có kết quả trong khoảng 1 phút.
5. Thử AI video: tải một clip ngắn (dưới 50 MB), xem trạng thái chuyển sang hoàn tất.
6. Nhắc cả team tắt API đang chạy trên máy (`pnpm --filter nestjs-api start:dev`) nếu nó dùng database chung: mọi server nối vào Supabase chia nhau khoảng 15 kết nối ở cổng 5432.

## Giới hạn của bản miễn phí

| Giới hạn | Ảnh hưởng | Cách xử lý |
| --- | --- | --- |
| Render Free ngủ sau 15 phút không có request | Request đầu chờ khoảng 1 phút | Mở `/health` trước khi dùng |
| Render Free 512 MB RAM | Đủ cho demo; nếu bị khởi động lại, xem Render > Events | Không tải nhiều video cùng lúc |
| Key Value Free không lưu ra đĩa | Khởi động lại thì mất các job video đang chờ | Tải lại video |
| Supabase cổng 5432 (session mode) cho khoảng 15 kết nối cho cả project, chia cho mọi server | Vượt giới hạn thì Supabase từ chối kết nối, API trả 500 | API mở tối đa 10 kết nối (`DATABASE_POOL_MAX`), tự thử lại khi bị từ chối; web đọc lại một lần khi gặp 5xx; API trên máy dev đặt `DATABASE_POOL_MAX=3` |
| Gemini theo hạn mức của key | Nhiều người bấm AI cùng lúc có thể bị lỗi hạn mức (429), app hiện lỗi | Chờ 1 phút rồi bấm lại |
| Worker chạy trên máy Dan | Máy tắt hoặc ngủ thì video đứng ở trạng thái chờ | Giữ máy bật, cắm sạc |
