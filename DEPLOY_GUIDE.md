# 🚀 Hướng Dẫn Triển Khai Thực Tế (Production Deployment Guide)

Tài liệu hướng dẫn từng bước triển khai hệ thống **MMA-TMS** lên kiến trúc Cloud hiện đại với chi phí tối ưu (gần như $0):

- **Frontend**: [Vercel](https://vercel.com) (Next.js Serverless)
- **Database & Storage**: [Supabase](https://supabase.com) (PostgreSQL + Object Storage)
- **Message Queue**: [Upstash Redis](https://upstash.com) (Serverless Redis TLS)
- **Backend API**: [Render.com](https://render.com) (NestJS Web Service)
- **AI Worker**: [Railway.app](https://railway.app) (Background Worker) HOẶC Chạy trên PC cá nhân (Hybrid GPU)

---

## 📌 Bảng Biến Môi Trường Cần Chuẩn Bị (Environment Variables)

| Tên biến               | Dùng ở đâu               | Mô tả / Giá trị mẫu                                                                        |
| :--------------------- | :----------------------- | :----------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | NestJS, Supabase         | `postgresql://postgres.[ref]:[pwd]@aws-0-ap-northeast-1.pooler.supabase.com:5432/postgres` |
| `REDIS_URL`            | NestJS, Worker           | `rediss://default:[token]@singapore-redis.upstash.io:6379` _(Upstash)_                     |
| `SUPABASE_URL`         | Frontend, NestJS, Worker | `https://[project-ref].supabase.co`                                                        |
| `SUPABASE_ANON_KEY`    | Frontend                 | Khóa công khai `anon` trên Supabase API                                                    |
| `SUPABASE_SERVICE_KEY` | NestJS, Worker           | Khóa bí mật `service_role` trên Supabase API                                               |
| `WORKER_SECRET_TOKEN`  | NestJS, Worker           | Chuỗi bảo mật ngẫu nhiên (ví dụ: `mma-tms-secret-key-prod-2026`)                           |
| `NEXT_PUBLIC_API_URL`  | Frontend (Vercel)        | URL của Backend trên Render (ví dụ: `https://mma-api.onrender.com`)                        |
| `FRONTEND_URL`         | NestJS (Render)          | `https://*.vercel.app,https://your-domain.com`                                             |

---

## 🟢 BƯỚC 1: KHỞI TẠO CƠ SỞ DỮ LIỆU & STORAGE (SUPABASE)

1. Đăng nhập [Supabase](https://supabase.com), vào project của bạn.
2. Vào **SQL Editor**, mở file [`scripts/supabase-setup.sql`](file:///d:/test/ai/scripts/supabase-setup.sql), copy nội dung và bấm **Run**:
    - Tạo enum `job_status` và bảng `analysis_jobs`.
    - Tạo 2 bucket storage: `videos` và `analysis-results` (đều đặt **Public**).
    - Thiết lập RLS policies cho phép upload và đọc file.
3. Vào **Project Settings > API**:
    - Copy `Project URL` → `SUPABASE_URL`
    - Copy `anon` (public) → `SUPABASE_ANON_KEY`
    - Copy `service_role` (secret) → `SUPABASE_SERVICE_KEY`
4. Vào **Project Settings > Database**:
    - Lấy chuỗi kết nối **Connection String (URI)**, thay mật khẩu database của bạn vào.

---

## 🟢 BƯỚC 2: TẠO REDIS QUEUE MIỄN PHÍ (UPSTASH REDIS)

1. Truy cập [Upstash.com](https://upstash.com), đăng nhập bằng tài khoản GitHub (miễn phí).
2. Bấm **Create Database**:
    - Tên: `mma-tms-redis`
    - Type: **Regional**
    - Region: Chọn `ap-southeast-1 (Singapore)` để có độ trễ thấp nhất với Việt Nam.
3. Sau khi tạo xong, cuộn xuống phần **Connect**:
    - Chọn tab **ioredis** hoặc **Node.js**.
    - Copy chuỗi `UPSTASH_REDIS_URL` bắt đầu bằng `rediss://...`
    - _(Chuỗi này hỗ trợ SSL TLS tự động và được NestJS + Python Worker hỗ trợ trực tiếp)._

---

## 🟢 BƯỚC 3: DEPLOY BACKEND API (RENDER.COM)

1. Đăng nhập [Render.com](https://render.com), chọn **New + > Web Service**.
2. Kết nối tới repository GitHub chứa project của bạn.
3. Cấu hình chi tiết:
    - **Name**: `mma-tms-api`
    - **Root Directory**: `nestjs-api`
    - **Runtime**: `Node`
    - **Build Command**: `npm install && npm run build`
    - **Start Command**: `npm run start:prod`
    - **Health Check Path**: `/health`
4. Cuộn xuống phần **Environment Variables**, thêm các biến:
    - `PORT`: `3001`
    - `DATABASE_URL`: _(Lấy từ Supabase)_
    - `REDIS_URL`: _(Lấy từ Upstash ở Bước 2)_
    - `SUPABASE_URL`: _(Lấy từ Supabase)_
    - `SUPABASE_SERVICE_KEY`: _(Lấy từ Supabase)_
    - `WORKER_SECRET_TOKEN`: `mma-tms-secret-key-prod-2026`
    - `FRONTEND_URL`: `https://*.vercel.app,http://localhost:3000`
5. Bấm **Create Web Service**. Đợi ~2 phút đến khi hiển thị `Live`.
6. Copy domain HTTPS do Render cấp (ví dụ: `https://mma-tms-api.onrender.com`).
7. Thử kiểm tra: Mở trình duyệt vào `https://mma-tms-api.onrender.com/health` → Nếu trả về `{"status":"ok"}` là backend đã sẵn sàng!

---

## 🟢 BƯỚC 4: DEPLOY FRONTEND LÊN VERCEL

1. Đăng nhập [Vercel.com](https://vercel.com), chọn **Add New > Project**.
2. Chọn repository GitHub của bạn.
3. Cấu hình dự án:
    - **Root Directory**: Nhấn Edit và chọn thư mục `nextjs-frontend`.
    - **Framework Preset**: `Next.js` (Tự động nhận diện).
4. Thêm **Environment Variables** trên Vercel:
    - `NEXT_PUBLIC_API_URL`: `https://mma-tms-api.onrender.com` _(URL Render lấy ở Bước 3)_
    - `NEXT_PUBLIC_SUPABASE_URL`: _(Lấy từ Supabase)_
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: _(Lấy từ Supabase)_
5. Bấm **Deploy**. Vercel sẽ tự động build và cấp domain HTTPS (ví dụ: `https://mma-tms.vercel.app`).

---

## 🟢 BƯỚC 5: KHỞI ĐỘNG PYTHON AI WORKER

Bạn có thể chọn 1 trong 2 phương án:

### Lựa chọn 5A: Chạy Worker trên máy tính của bạn (Hybrid Cloud - Khuyên dùng)

> Phù hợp nhất cho giai đoạn Demo / Test thực tế vì tận dụng được GPU máy nhà, tốc độ xử lý chỉ 2–5 giây và hoàn toàn miễn phí.

1. Mở file `python-worker/.env`, cập nhật các biến sau:
    ```env
    REDIS_URL=rediss://default:xxxxxx@singapore-xxxx.upstash.io:6379
    NESTJS_API_URL=https://mma-tms-api.onrender.com
    SUPABASE_URL=https://wskisxkpbhisnqfpjqrm.supabase.co
    SUPABASE_SERVICE_KEY=eyJhbGci...
    WORKER_SECRET_TOKEN=mma-tms-secret-key-prod-2026
    ```
2. Khởi động worker:
    ```bash
    cd python-worker
    .venv\Scripts\python.exe worker.py
    ```
3. Worker sẽ báo: `✅ Kết nối Redis thành công. 👂 Đang lắng nghe queue 'video-analysis'...`
   👉 Bất kỳ ai vào web trên Vercel upload video, máy tính của bạn sẽ tự động kéo việc về xử lý và đẩy kết quả lên!

---

### Lựa chọn 5B: Deploy Worker lên Cloud (Railway.app)

1. Đăng nhập [Railway.app](https://railway.app), chọn **New Project > Deploy from GitHub repo**.
2. Chọn repository của bạn.
3. Vào **Settings**:
    - **Root Directory**: `python-worker`
    - Railway sẽ tự động phát hiện `Dockerfile` và build container.
4. Vào tab **Variables**, thêm các biến:
    - `REDIS_URL`: _(Lấy từ Upstash)_
    - `NESTJS_API_URL`: `https://mma-tms-api.onrender.com`
    - `SUPABASE_URL`: _(Lấy từ Supabase)_
    - `SUPABASE_SERVICE_KEY`: _(Lấy từ Supabase)_
    - `WORKER_SECRET_TOKEN`: `mma-tms-secret-key-prod-2026`
5. Bấm Deploy. Worker sẽ chạy nền liên tục 24/7 trên Cloud.

---

## 🛠️ KIỂM TRA TOÀN BỘ HỆ THỐNG SAU KHI DEPLOY

1. Truy cập vào trang web của bạn: `https://mma-tms.vercel.app`.
2. Vào mục **Upload Video** (`/analysis`).
3. Chọn 1 clip đấm hoặc đá võ thuật (dưới 50MB, định dạng MP4).
4. Bấm **Bắt đầu phân tích**:
    - Video tải trực tiếp lên Supabase Storage (`videos`).
    - NestJS API tạo job và đẩy vào Upstash Redis Queue.
    - Python Worker kéo job về phân tích với YOLOv8-Pose.
    - Kết quả tải lên Supabase Storage (`analysis-results`).
    - Màn hình chuyển sang trang kết quả hiển thị khung xương, số đòn, góc gập cùi chỏ/gối và lời khuyên HLV!
