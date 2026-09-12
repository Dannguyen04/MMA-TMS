# Martial Arts Tracker — Full Stack System

Hệ thống phân tích kỹ thuật võ thuật 3-tier với AI realtime.

## Kiến trúc

```
┌─────────────────────────────────────────────────────┐
│                    BROWSER / CLIENT                 │
│  Next.js App (port 3000)                            │
│  ├── /live        → Live MediaPipe webcam           │
│  └── /analysis    → Upload video → Result overlay  │
└────────────────────┬────────────────────────────────┘
                     │ HTTP/REST
┌────────────────────▼────────────────────────────────┐
│               NestJS API (port 3001)                │
│  POST /jobs     → Tạo job + đẩy vào BullMQ         │
│  GET  /jobs/:id → Lấy status + result URL           │
│  PATCH /jobs/:id/status → Worker callback           │
└────────┬──────────────────────────┬─────────────────┘
         │ Prisma ORM               │ BullMQ (Redis)
┌────────▼────────┐      ┌──────────▼─────────────────┐
│  PostgreSQL     │      │   Redis (port 6379)         │
│  (Supabase DB)  │      │   Queue: video-analysis     │
└─────────────────┘      └──────────┬─────────────────┘
                                    │ poll jobs
                         ┌──────────▼─────────────────┐
                         │   Python Worker             │
                         │   ├── YOLO-Pose detection  │
                         │   ├── KickAnalyzer          │
                         │   └── Upload JSON → Supabase│
                         └─────────────────────────────┘
```

## Cấu trúc thư mục

```
d:/test/ai/
├── martial-arts-tracker/   ← Phase 1: Vite+React MVP (standalone)
├── python-worker/          ← Phase 2: YOLO-Pose worker
├── nestjs-api/             ← Phase 3: Backend API + BullMQ
├── nextjs-frontend/        ← Phase 3: Full-stack frontend
└── docker-compose.yml      ← Chạy toàn bộ hệ thống
```

## Khởi động nhanh (Development)

### Yêu cầu

- Node.js 18+
- Python 3.11+ (hoặc uv)
- Redis (local hoặc Docker)
- PostgreSQL (hoặc Supabase)

### 1. Redis (cần thiết cho NestJS + Worker)

```bash
# Dùng Docker
docker run -d -p 6379:6379 redis:7-alpine

# Hoặc trên Windows với winget
winget install Redis.Redis
```

### 2. NestJS API

```bash
cd nestjs-api
cp .env.example .env   # Điền DATABASE_URL và REDIS_*
npm run start:dev
```

### 3. Python Worker

```bash
cd python-worker
.venv\Scripts\activate      # Windows
cp .env.example .env        # Điền REDIS_URL, SUPABASE_*
python worker.py
```

### 4. Next.js Frontend

```bash
cd nextjs-frontend
cp .env.local.example .env.local   # Điền SUPABASE_*, NEXT_PUBLIC_API_URL
npm run dev
```

### 5. Mở trình duyệt

- `http://localhost:3000` → Trang chính
- `http://localhost:3000/live` → Live MediaPipe camera
- `http://localhost:3000/analysis` → Upload video

---

## Chạy toàn bộ bằng Docker Compose

```bash
# Tạo file .env tại thư mục gốc
cp .env.example .env   # Điền SUPABASE_URL, SUPABASE_SERVICE_KEY, SUPABASE_ANON_KEY

docker-compose up --build
```

---

## Luồng xử lý Upload Video

```
User chọn video
    ↓
uploadVideo() → Supabase Storage (bucket: videos)
    ↓
api.createJob(videoUrl) → POST /jobs (NestJS)
    ↓ NestJS
prisma.create() → PostgreSQL (status: PENDING)
queue.add() → Redis BullMQ
    ↓ Python Worker (poll Redis)
YOLO-Pose analyze frames
KickAnalyzer score kicks
    ↓
Upload result.json → Supabase Storage (bucket: analysis-results)
PATCH /jobs/:id/status (status: DONE, resultUrl, score)
    ↓ Next.js
pollJobStatus() every 2s → GET /jobs/:id
    ↓ status === DONE
router.push('/analysis/[jobId]')
    ↓
Hiển thị video + skeleton overlay + kick scores
```

---

## Cấu hình Supabase (Project `wskisxkpbhisnqfpjqrm`)

1. **Khởi tạo Database & Storage Buckets**:
    - Vào **Supabase Dashboard** > **SQL Editor**.
    - Mở file `supabase-setup.sql` trong dự án, copy toàn bộ nội dung và bấm **Run**.
    - Script sẽ tự động:
        - Tạo kiểu enum `job_status` và bảng `analysis_jobs` (với triggers & indexes).
        - Tạo 2 storage buckets: `videos` và `analysis-results` (public).
        - Thiết lập RLS policies cho phép upload & xem video / kết quả.

2. **Lấy API Keys**:
    - Vào **Settings** > **API**:
        - Copy `anon` (public key) → điền vào `SUPABASE_ANON_KEY` trong `.env` và `nextjs-frontend/.env.local`.
        - Copy `service_role` (secret key) → điền vào `SUPABASE_SERVICE_KEY` trong `.env` và `python-worker/.env`.

3. **Database Password**:
    - Thay `[YOUR-PASSWORD]` trong `DATABASE_URL` tại các file `.env` bằng mật khẩu database Supabase của bạn.

4. **Sync Schema qua Drizzle Kit (tùy chọn thay cho SQL Editor)**:
    ```bash
    cd nestjs-api
    npm run db:push
    ```

---

## API Reference

| Method  | Path               | Body                             | Response            |
| ------- | ------------------ | -------------------------------- | ------------------- |
| `POST`  | `/jobs`            | `{ videoUrl, userId? }`          | `{ jobId, status }` |
| `GET`   | `/jobs`            | —                                | `AnalysisJob[]`     |
| `GET`   | `/jobs/:id`        | —                                | `AnalysisJob`       |
| `PATCH` | `/jobs/:id/status` | `{ status, resultUrl?, score? }` | `AnalysisJob`       |

---

## Phase Roadmap

| Phase       | Status  | Mô tả                                |
| ----------- | ------- | ------------------------------------ |
| **Phase 1** | ✅ Done | Vite+React + MediaPipe realtime      |
| **Phase 2** | ✅ Done | Python + YOLOv8-Pose video analysis  |
| **Phase 3** | ✅ Done | NestJS + BullMQ + Next.js full-stack |
