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
- **Render** chờ CI của commit đó xanh rồi mới build và deploy backend (`autoDeployTrigger: checksPass` trong [render.yaml](../render.yaml)). CI đỏ thì backend giữ bản cũ. Chỉ deploy khi commit có đổi `nestjs-api/`, lockfile hoặc `render.yaml`.
- **Vercel** build frontend ngay khi có push và gắn bản mới vào `mma-tms-demo.vercel.app`. Các nhánh khác bị bỏ qua (Ignored Build Step trong cài đặt project).

Vercel không chờ CI, nên trong vài phút sau push frontend mới có thể chạy với backend cũ. Với demo một buổi thì chấp nhận được: đừng push ngay trước giờ demo.

## Cài đặt (đã làm ngày 14/11)

- Vercel: project `mma-tms`, Root Directory `nextjs-frontend`, nối repo GitHub, domain `mma-tms-demo.vercel.app` theo nhánh `release/final-review`, tắt Vercel Authentication để ai cũng mở được. Biến: `API_URL`, `NEXT_PUBLIC_API_URL` (URL Render), `APP_DATA_MODE=api`, `NEXT_PUBLIC_VIDEO_PIPELINE=api`, cho Production và Preview.
- Supabase: đã có đủ migration tới `033_suspension_early_end.sql` (đọc `mma_private.migration_history`). Backend kiểm tra schema khi khởi động, nên migration mới phải áp lên Supabase trước khi merge code cần nó.
- Render: tạo bằng Blueprint từ [render.yaml](../render.yaml) (New > Blueprint > repo `Dannguyen04/MMA-TMS`, nhánh `release/final-review`), nhập `WORKER_SECRET_TOKEN`, `DATABASE_URL`, `SUPABASE_*`, `GEMINI_*` giống `nestjs-api/.env`.

Nếu Render cấp URL khác `mma-tms-api.onrender.com`, sửa `API_URL` và `NEXT_PUBLIC_API_URL` trên Vercel rồi Redeploy.

## Worker AI trên máy Dan

Trong `python-worker/.env` (giữ bản cũ để chạy local):

```env
REDIS_URL=<External Key Value URL của mma-tms-redis trên Render, dạng rediss://...>
NESTJS_API_URL=https://mma-tms-api.onrender.com
WORKER_SECRET_TOKEN=<giống trên Render>
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
POLL_INTERVAL_S=3
```

Chạy `python-worker\.venv\Scripts\python.exe python-worker\worker.py`, thấy dòng `Đang lắng nghe queue 'video-analysis'` là được.

## Ngày demo: làm trước 30 phút

1. Mở https://mma-tms-api.onrender.com/health để đánh thức Render (lần đầu khoảng 1 phút), thấy `"status":"ok"`.
2. Tắt chế độ ngủ của máy Dan, bật worker.
3. Mở https://mma-tms-demo.vercel.app/login, đăng nhập lần lượt các vai HLV, võ sĩ, bác sĩ bằng tài khoản demo.
4. Thử AI Gemini: vào một trận, bấm gợi ý chiến thuật trước trận, phải có kết quả trong khoảng 1 phút.
5. Thử AI video: tải một clip ngắn (dưới 50 MB), xem trạng thái chuyển sang hoàn tất.

## Giới hạn của bản miễn phí

| Giới hạn | Ảnh hưởng | Cách xử lý |
| --- | --- | --- |
| Render Free ngủ sau 15 phút không có request | Request đầu chờ khoảng 1 phút | Mở `/health` trước khi dùng |
| Render Free 512 MB RAM | Đủ cho demo; nếu bị khởi động lại, xem Render > Events | Không tải nhiều video cùng lúc |
| Key Value Free không lưu ra đĩa | Khởi động lại thì mất các job video đang chờ | Tải lại video |
| Gemini theo hạn mức của key | Nhiều người bấm AI cùng lúc có thể bị lỗi hạn mức (429), app hiện lỗi | Chờ 1 phút rồi bấm lại |
| Worker chạy trên máy Dan | Máy tắt hoặc ngủ thì video đứng ở trạng thái chờ | Giữ máy bật, cắm sạc |
