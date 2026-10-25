# MMA-TMS — Quản lý huấn luyện võ sĩ

Nền tảng giúp CLB võ thuật quản lý huấn luyện và chuẩn bị thi đấu cho võ sĩ, có module phân tích video bằng AI.

> **Phạm vi hiện tại (từ 2026-10-11):** dự án tạm thu hẹp về **Fight Camp**, tức quản lý võ sĩ trước, trong và sau một trận. Đọc [docs/SCOPE-FIGHT-CAMP.md](docs/SCOPE-FIGHT-CAMP.md) trước khi nhận task. Nghiên cứu AI, tuyển võ sĩ, cổng Doctor đầy đủ và app mobile đang đóng băng.

## Thành phần

| Thư mục | Vai trò | Công nghệ | Cổng |
| --- | --- | --- | --- |
| [nextjs-frontend/](nextjs-frontend/) | Web app theo vai trò: fighter, coach, doctor, admin | Next.js 16, React 19, Tailwind 4 | 3000 |
| [nestjs-api/](nestjs-api/) | REST API, phân quyền, hàng đợi job | NestJS 12, Drizzle ORM, BullMQ, Zod | 3001 (Swagger ở `/api-docs`) |
| [python-worker/](python-worker/) | Phân tích video: YOLOv8-Pose và các bộ nhận diện đòn | Python 3.11, Ultralytics, OpenCV | — |
| [reactnative-mobile/](reactnative-mobile/) | App mobile (đã dựng khung, đang tạm dừng) | Expo SDK 57, React Native 0.86 | — |
| PostgreSQL (Supabase) | Dữ liệu và storage | PostgreSQL 16 | — |
| Redis | Hàng đợi BullMQ cho job video | Redis 7 | 6379 |

Monorepo dùng **pnpm** (`pnpm-workspace.yaml`).

## Chạy nhanh trên Windows

```bat
start_all.bat          :: kiểm tra điều kiện rồi mở API, worker, frontend
start_all.bat --check  :: chỉ kiểm tra điều kiện
stop_all.bat
```

Chạy từng phần:

```bash
cd nestjs-api && pnpm start:dev        # cần nestjs-api/.env (xem .env.example)
cd nextjs-frontend && pnpm dev         # mặc định dùng dữ liệu demo, không cần API
cd python-worker && .venv\Scripts\python worker.py
```

Docker Compose (redis, postgres, nestjs-api, python-worker, nextjs-frontend): `docker compose up --build`, sau khi tạo `.env` từ `.env.example`.

Chi tiết cổng, biến môi trường và cách xử lý lỗi khi khởi động: [RUN_GUIDE.md](RUN_GUIDE.md). Triển khai production: [DEPLOY_GUIDE.md](DEPLOY_GUIDE.md).

## Dữ liệu demo và dữ liệu thật

- Frontend mặc định chạy **demo mode** với dữ liệu giả lập.
- Muốn dùng API thật, sao chép `nextjs-frontend/.env.local.example` thành `.env.local`, rồi đặt `APP_DATA_MODE=api`, `NEXT_PUBLIC_VIDEO_PIPELINE=api` và `API_URL=http://localhost:3001`.
- Khóa Supabase chỉ cấu hình ở NestJS và Python worker, không đưa vào frontend.

## Database

Schema do **SQL migration đánh số** quản lý (`nestjs-api/migrations/001…022`), gồm cả RLS, trigger và quyền. `drizzle-kit push/generate` đã bị tắt.

```bash
cd nestjs-api
pnpm db:check          # kiểm tra ledger và checksum
pnpm db:migrate:022    # áp dụng một migration cụ thể
pnpm test:db           # kiểm thử migration
```

Quy ước viết migration và trạng thái từng migration: [nestjs-api/migrations/README.md](nestjs-api/migrations/README.md). Lần đầu dựng Supabase (bucket `videos`, `analysis-results`): [scripts/supabase-setup.sql](scripts/supabase-setup.sql).

## Luồng phân tích video

Module AI đang đóng băng nhưng vẫn chạy được:

```text
Upload (fighter/coach) → Next.js route → NestJS → Supabase Storage (bucket videos, private)
→ POST /jobs → PostgreSQL (PENDING) + BullMQ (Redis)
→ Python worker: YOLOv8-Pose + bộ nhận diện → result.json (bucket analysis-results)
→ PATCH /jobs/:id/status → Next.js poll /api/ai-jobs/[jobId] → trang phân tích + HLV duyệt
```

Trạng thái AI khi đóng băng: [docs/archive/ai/](docs/archive/ai/).

## Tài liệu

Bắt đầu ở [docs/PROJECT-OVERVIEW.md](docs/PROJECT-OVERVIEW.md). Hướng dẫn cho agent khi sửa backend: [nestjs-api/CLAUDE.md](nestjs-api/CLAUDE.md), [nestjs-api/AGENTS.md](nestjs-api/AGENTS.md). Kiến trúc frontend: [nextjs-frontend/docs/frontend-architecture.md](nextjs-frontend/docs/frontend-architecture.md).
