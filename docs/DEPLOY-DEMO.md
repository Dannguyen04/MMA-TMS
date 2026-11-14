# Deploy bản demo (miễn phí) và CD

Cập nhật 14/11/2026. Mục tiêu: một bản chạy trên mạng để cả team và người xem dùng được trong buổi demo, chi phí 0 đồng. Bản này thay phần Render/Vercel của [DEPLOY_GUIDE.md](../DEPLOY_GUIDE.md) (hướng dẫn cũ dùng Render runtime Node, không cài đúng lockfile gốc của workspace).

## Kiến trúc

| Phần | Chạy ở đâu | Gói |
| --- | --- | --- |
| Frontend (`nextjs-frontend`) | Vercel | Hobby (miễn phí) |
| Backend (`nestjs-api`) | Render, Docker, Singapore | Free (ngủ sau 15 phút không có request) |
| Database, storage | Supabase hiện có | Không đổi |
| Hàng đợi video | Upstash Redis | Free |
| AI phân tích video (`python-worker`, YOLO) | Máy của Dan (có GPU) | Không tốn phí |
| AI chiến thuật, lời dặn giữa hiệp (Gemini) | Gọi từ backend | Key hiện có |

Nhánh được deploy: `release/final-review`.

## CD chạy thế nào

[.github/workflows/deploy.yml](../.github/workflows/deploy.yml), chạy khi có push lên `release/final-review` hoặc bấm tay (Actions > Deploy > Run workflow):

1. Chạy lại toàn bộ CI ([ci.yml](../.github/workflows/ci.yml)): lint, typecheck, test, build frontend; lint, build backend; quét secret. Lỗi thì dừng, không deploy.
2. Gọi Render API deploy đúng commit vừa push, chờ tới khi trạng thái `live` (tối đa 25 phút), rồi gọi `GET /health`.
3. Backend ổn mới build frontend bằng Vercel CLI và deploy production, rồi mở thử `/login`.

Render và Vercel đều tắt tự deploy theo git ([render.yaml](../render.yaml), [nextjs-frontend/vercel.json](../nextjs-frontend/vercel.json)), nên mỗi bản lên mạng đều đã qua CI và backend luôn lên trước frontend.

## Cài đặt một lần (Dan làm)

### 1. Upstash Redis

Tạo database Regional, vùng `ap-southeast-1`. Lấy chuỗi `rediss://...` làm `REDIS_URL`.

### 2. Render (backend)

1. New > Blueprint > chọn repo, nhánh `release/final-review`. Render đọc [render.yaml](../render.yaml) và tạo service `mma-tms-api`.
2. Nhập các biến Render hỏi:

   | Biến | Giá trị |
   | --- | --- |
   | `DATABASE_URL` | Chuỗi pooler của Supabase (giống `nestjs-api/.env`) |
   | `REDIS_URL` | Từ Upstash |
   | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY` | Giống `nestjs-api/.env` |
   | `FRONTEND_URL` | Domain production của Vercel, ví dụ `https://mma-tms.vercel.app` (điền sau bước 3, tạm để `https://example.vercel.app`) |
   | `GEMINI_API_KEY`, `GEMINI_BOUT_MODEL` | Giống `nestjs-api/.env` |

   `WORKER_SECRET_TOKEN` do Render tự sinh; chép giá trị đó sang `python-worker/.env` ở bước 5.
3. Ghi lại URL service (`https://mma-tms-api-xxxx.onrender.com`) và service ID (`srv-...`, nằm trên URL dashboard).
4. Account Settings > API Keys > tạo key.

Backend kiểm tra schema database khi khởi động, nên Supabase phải có đủ migration tới `033_suspension_early_end.sql`.

### 3. Vercel (frontend)

1. Add New > Project > chọn repo. Root Directory: `nextjs-frontend`. Framework: Next.js.
2. Environment Variables (Production):

   | Biến | Giá trị |
   | --- | --- |
   | `API_URL` | URL Render ở bước 2 |
   | `NEXT_PUBLIC_API_URL` | Như trên |
   | `APP_DATA_MODE` | `api` |
   | `NEXT_PUBLIC_VIDEO_PIPELINE` | `api` |

   Bản production luôn đăng nhập bằng tài khoản thật qua backend; biến `ALLOW_DEMO_AUTH` trong hướng dẫn cũ không còn được code đọc.
3. Lần import đầu có thể build lỗi vì chưa có biến; không sao, workflow sẽ deploy lại.
4. Account Settings > Tokens > tạo token. `VERCEL_ORG_ID` và `VERCEL_PROJECT_ID` lấy ở Project Settings > General (Project ID) và Team/Account Settings (ID), hoặc chạy `vercel link` trong `nextjs-frontend` rồi xem `.vercel/project.json`.
5. Quay lại Render, sửa `FRONTEND_URL` thành domain production của Vercel.

### 4. GitHub

Settings > Secrets and variables > Actions:

| Loại | Tên | Giá trị |
| --- | --- | --- |
| Secret | `RENDER_API_KEY` | Bước 2.4 |
| Secret | `RENDER_SERVICE_ID` | `srv-...` |
| Secret | `VERCEL_TOKEN` | Bước 3.4 |
| Secret | `VERCEL_ORG_ID` | Bước 3.4 |
| Secret | `VERCEL_PROJECT_ID` | Bước 3.4 |
| Variable | `API_URL` | URL Render, không có `/` cuối |
| Variable | `WEB_URL` | Domain production Vercel, không có `/` cuối |

Sau đó vào Actions > Deploy > Run workflow để deploy lần đầu.

### 5. Worker AI trên máy Dan

Trong `python-worker/.env`:

```env
REDIS_URL=<rediss:// từ Upstash>
NESTJS_API_URL=<URL Render>
WORKER_SECRET_TOKEN=<giá trị Render tự sinh>
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
POLL_INTERVAL_S=3
```

Chạy `python-worker\.venv\Scripts\python.exe python-worker\worker.py`, thấy dòng `Đang lắng nghe queue 'video-analysis'` là được. Worker hỏi Redis liên tục, tốn hạn mức lệnh của Upstash Free, nên **chỉ bật trong ngày demo**.

## Ngày demo: làm trước 30 phút

1. Mở `<API_URL>/health` để đánh thức Render (lần đầu mất khoảng 1 phút), thấy `"status":"ok"`.
2. Tắt chế độ ngủ của máy Dan, bật worker.
3. Mở `<WEB_URL>/login`, đăng nhập lần lượt các vai HLV, võ sĩ, bác sĩ bằng tài khoản demo.
4. Thử AI Gemini: vào một trận, bấm gợi ý chiến thuật trước trận, phải có kết quả trong khoảng 1 phút.
5. Thử AI video: tải một clip ngắn (dưới 50 MB), xem trạng thái chuyển sang hoàn tất.
6. Mở dashboard Upstash xem còn hạn mức lệnh.

## Giới hạn của bản miễn phí

| Giới hạn | Ảnh hưởng | Cách xử lý |
| --- | --- | --- |
| Render Free ngủ sau 15 phút không có request | Request đầu chờ khoảng 1 phút | Mở `/health` trước khi dùng; trong buổi demo có người dùng liên tục nên không ngủ |
| Render Free 512 MB RAM | Đủ cho demo; nếu bị khởi động lại, xem Render > Events | Không tải nhiều video cùng lúc |
| Gemini theo hạn mức của key | Nhiều người bấm AI cùng lúc có thể bị lỗi hạn mức (429), app hiện lỗi | Chờ 1 phút rồi bấm lại |
| Worker chạy trên máy Dan | Máy tắt hoặc ngủ thì video đứng ở trạng thái chờ | Giữ máy bật, cắm sạc |
| Upstash Free giới hạn số lệnh | Hết hạn mức thì hàng đợi video ngừng | Chỉ bật worker trong ngày demo |
