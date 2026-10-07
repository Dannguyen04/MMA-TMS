# MMA-TMS — Tổng Quan Dự Án

> **MMA Training & Movement Analysis System**
> Nền tảng AI phân tích chuyển động và quản lý huấn luyện võ thuật

**Phiên bản tài liệu**: 1.0
**Cập nhật lần cuối**: 2026-09-29
**Tác giả**: MMA-TMS Team

---

## Lộ Trình Đọc Khuyến Nghị

1. **Bắt đầu tại đây** để nắm mục tiêu, kiến trúc và cách chạy dự án.
2. Đọc [Luồng nghiệp vụ](./BUSINESS-FLOWS.md) để hiểu hệ thống phục vụ Fighter, Coach, Doctor và Admin như thế nào.
3. Đọc [Phân tích thị trường Việt Nam](./VIETNAM-MARKET-ANALYSIS.md) để hiểu bối cảnh, khách hàng và khoảng cách sản phẩm.
4. Mở [Roadmap](./ROADMAP.md) để chọn task và theo dõi checklist triển khai.

Spec kỹ thuật chính: [MMA-TMS Master Specification v3](./MMA-TMS-MASTER-SPECIFICATION-v3.md) và [Martial Arts AI Coaching Spec v1](./MARTIAL-ARTS-AI-COACHING-SPEC-v1.md).

Triển khai temporal AI sau YOLO-Pose (2026-10-05):
[thiết kế, contract và lệnh chạy](./AI-TEMPORAL-IMPLEMENTATION.md),
[thu thập/gán nhãn dữ liệu cho HLV](./AI-DATA-COLLECTION-PROTOCOL.md).

---

## 1. Giới Thiệu

MMA-TMS là nền tảng phần mềm giúp **các CLB / trung tâm võ thuật** quản lý quá trình huấn luyện và chuẩn bị thi đấu cho võ sĩ, sử dụng trí tuệ nhân tạo (AI) để phân tích kỹ thuật từ video tập luyện.

### Mục tiêu chính

1. **Phân tích video AI**: Biến video tập luyện thành dữ liệu kỹ thuật có cấu trúc (đòn đánh, tốc độ, góc khớp, guard uptime...)
2. **Quản lý huấn luyện**: Lập kế hoạch tập luyện theo chu kỳ (periodization), theo dõi tuân thủ
3. **Theo dõi y tế**: Medical clearance, ghi nhận chấn thương, phục hồi chấn thương
4. **Đánh giá hiệu suất**: Điểm kỹ thuật 0-100, trend 12 tuần, goal tracking

### Đối tượng người dùng

| Vai trò | Mô tả | Ví dụ |
|---|---|---|
| **Võ sĩ (Fighter)** | VĐV thi đấu tại CLB | Minh Trần (Muay Thai, 65kg) |
| **HLV (Coach)** | Huấn luyện viên | Rafael Costa (Head Striking Coach) |
| **Bác sĩ (Doctor)** | Bác sĩ thể thao / Vật lý trị liệu | BS. Thu Lê (Sports Medicine) |
| **Admin** | Quản trị hệ thống | Quản lý CLB |

---

## 2. Kiến Trúc Hệ Thống

```
                    ┌─────────────────────────────────────┐
                    │          CLIENT TIER                 │
                    │  ┌─────────────┐  ┌──────────────┐  │
                    │  │  Next.js 16 │  │ React Native │  │
                    │  │  Port 3000  │  │  Expo SDK 57 │  │
                    │  │  (Active)   │  │  (Deferred)  │  │
                    │  └──────┬──────┘  └──────────────┘  │
                    └─────────┼───────────────────────────┘
                              │ REST API
                    ┌─────────┼───────────────────────────┐
                    │         ▼     API TIER               │
                    │  ┌─────────────┐                     │
                    │  │  NestJS 12  │─── Drizzle ORM ──► PostgreSQL 16
                    │  │  Port 3001  │                     │  (Supabase)
                    │  └──────┬──────┘                     │
                    └─────────┼───────────────────────────┘
                              │ BullMQ
                    ┌─────────┼───────────────────────────┐
                    │         ▼     AI TIER                │
                    │  ┌─────────────┐      ┌───────────┐ │
                    │  │   Redis 7   │◄─────│  Python   │ │
                    │  │  Port 6379  │      │  Worker   │ │
                    │  │  (BullMQ)   │      │ YOLOv8    │ │
                    │  └─────────────┘      └───────────┘ │
                    └─────────────────────────────────────┘
```

### Tech Stack

| Layer | Công nghệ | Phiên bản |
|---|---|---|
| Frontend | Next.js (App Router), React, Tailwind CSS | 16.3.4, 19.2.8, v4 |
| Backend | NestJS, Drizzle ORM, BullMQ | 12, 0.45.2, 6.3.4 |
| AI Worker | Python, Ultralytics YOLOv8-Pose, OpenCV | 3.11, 8.2+, 4.9+ |
| Database | PostgreSQL (Supabase) | 16 |
| Queue | Redis | 7 |
| Mobile | React Native, Expo (scaffolded, deferred) | 0.86.3, SDK 57 |

---

## 3. Cấu Trúc Monorepo

```
mma-tms/
├── nextjs-frontend/      # Frontend web app (Next.js 16)
│   ├── src/app/           # Pages & routes (57 trang)
│   ├── src/components/    # UI components
│   ├── src/lib/           # Domain logic, services, actions
│   └── docs/              # Frontend architecture docs
│
├── nestjs-api/            # Backend REST API (NestJS 12)
│   ├── src/               # Modules: auth, users, fighters, coaching, jobs, dataset-export
│   ├── migrations/        # SQL migrations (001-005)
│   └── test/              # Unit & E2E tests
│
├── python-worker/         # AI Video Analysis Worker
│   ├── pipeline/          # 30+ modular AI components
│   ├── worker.py          # Redis queue consumer daemon
│   └── process_video.py   # Standalone CLI processor
│
├── reactnative-mobile/    # Mobile app (Expo, deferred)
│
├── docs/                  # 📂 TÀI LIỆU DỰ ÁN (bạn đang ở đây)
├── scripts/               # Setup & test scripts
├── docker-compose.yml     # Container orchestration
└── start_all.bat          # 1-click launch
```

---

## 4. Cách Chạy Dự Án

### Yêu cầu
- Node.js 22+, pnpm
- Python 3.11+ (với venv)
- Redis 7
- PostgreSQL 16 (hoặc Supabase)

### Quick Start

```bash
# Cách 1: 1-click (Windows)
start_all.bat

# Cách 2: Docker
docker compose up --build

# Cách 3: pnpm concurrent
pnpm dev
```

### Ports & URLs

| Service | Port | URL |
|---|---|---|
| Frontend | 3000 | http://localhost:3000 |
| Backend API | 3001 | http://localhost:3001 |
| Swagger Docs | 3001 | http://localhost:3001/api-docs |
| Redis | 6379 | redis://localhost:6379 |

### Dual Mode

| Mode | Biến môi trường | Mô tả |
|---|---|---|
| **Mock** (mặc định) | `NEXT_PUBLIC_VIDEO_PIPELINE=mock` | Demo mode, dữ liệu giả lập, không cần Redis/Worker |
| **API** (production) | `NEXT_PUBLIC_VIDEO_PIPELINE=api` | Kết nối thật: Supabase + Redis + Python Worker |

---

## 5. Test Coverage

| Component | Số test | Trạng thái |
|---|---|---|
| Python Worker | 763 tests (52 files) | ✅ All passing |
| Next.js Frontend | 225 tests, 57 pages | ✅ Typecheck clean |
| NestJS Backend | 96 unit + 29 E2E | ✅ All passing |

---

## 6. Danh Sách Tài Liệu

### Tài liệu Team (mới)
| File | Mô tả |
|---|---|
| [`PROJECT-OVERVIEW.md`](./PROJECT-OVERVIEW.md) | 📌 Tổng quan dự án (file này) |
| [`VIETNAM-MARKET-ANALYSIS.md`](./VIETNAM-MARKET-ANALYSIS.md) | Phân tích thị trường VN & đánh giá phù hợp |
| [`BUSINESS-FLOWS.md`](./BUSINESS-FLOWS.md) | 8 luồng nghiệp vụ chi tiết |
| [`ROADMAP.md`](./ROADMAP.md) | Lộ trình phát triển & ưu tiên |

### Tài liệu kỹ thuật (có sẵn)
| File | Mô tả |
|---|---|
| [`MMA-TMS-MASTER-SPECIFICATION-v3.md`](./MMA-TMS-MASTER-SPECIFICATION-v3.md) | Spec kỹ thuật chi tiết (2,792 dòng) |
| [`MARTIAL-ARTS-AI-COACHING-SPEC-v1.md`](./MARTIAL-ARTS-AI-COACHING-SPEC-v1.md) | Spec AI coaching & rubrics |
| [`MMA-TMS-MASTER-SPECIFICATION-v2.md`](./MMA-TMS-MASTER-SPECIFICATION-v2.md) | Bản đặc tả v2 để đối chiếu lịch sử |
| [`MMA-TMS-MASTER-SPECIFICATION.md`](./MMA-TMS-MASTER-SPECIFICATION.md) | Bản đặc tả nền tảng ban đầu |

---

## 7. Liên Hệ & Đóng Góp

- **Repository**: https://github.com/Dannguyen04/MMA-TMS
- **Branch chính**: `ai-feature`
- **Quy ước commit**: `feat()`, `fix()`, `chore()`, `docs()`

### Quy trình đóng góp

1. Tạo branch từ `ai-feature`
2. Code + viết test
3. Chạy `pnpm test:full` để verify
4. Tạo Pull Request → Review → Merge
