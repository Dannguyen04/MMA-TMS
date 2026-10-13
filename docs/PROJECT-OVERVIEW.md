# MMA-TMS — Tổng Quan Dự Án

> **MMA Training & Movement Analysis System**
> Đồ án: nền tảng quản lý huấn luyện võ sĩ cho CLB võ thuật, có module phân tích video bằng AI

**Phiên bản tài liệu**: 2.0
**Cập nhật lần cuối**: 2026-10-13
**Tác giả**: MMA-TMS Team

---

## Lộ Trình Đọc Khuyến Nghị

**Từ 2026-10-11, dự án tạm thu hẹp về Fight Camp**, tức quản lý và huấn luyện võ sĩ trước, trong và sau một trận. Việc đang làm do sáu tài liệu dưới đây quyết định:

1. [Phạm vi](./SCOPE-FIGHT-CAMP.md): quyết định, giữ/gộp/đóng băng, lộ trình, các câu hỏi cần chốt
2. [Nghiên cứu nghiệp vụ](./FIGHT-CAMP-DOMAIN-RESEARCH.md): cân, hồ sơ, đình chỉ, kèm nguồn
3. [Luồng nghiệp vụ](./FIGHT-CAMP-BUSINESS-FLOWS.md): trạng thái trận, quy tắc, chế độ không có bác sĩ, tiêu chí nghiệm thu
4. [Tech spec](./FIGHT-CAMP-TECH-SPEC.md): dữ liệu, API, Cổng 2, migration, thứ tự PR
5. [Kiểm thử người dùng](./FIGHT-CAMP-USER-TESTING.md): tuyển người kiểm thử, kịch bản tác vụ, phiếu SUS
6. [Câu hỏi mở](./FIGHT-CAMP-OPEN-QUESTIONS.md): phiếu câu hỏi để đi hỏi, tra cứu và điền câu trả lời

Muốn hiểu hệ thống đang có (cả phần đã đóng băng), đọc tiếp:

- [Luồng nghiệp vụ hiện có](./BUSINESS-FLOWS.md): onboarding, training plan, session, AI review, y tế
- [Master Specification v3](./MMA-TMS-MASTER-SPECIFICATION-v3.md): spec đầy đủ của hệ thống hiện tại (v3.5, xoay quanh vai trò bác sĩ)
- [Kiến trúc frontend](../nextjs-frontend/docs/frontend-architecture.md)
- [Phân tích thị trường Việt Nam](./VIETNAM-MARKET-ANALYSIS.md): bối cảnh và khách hàng. Nhiều con số trong đó chưa có nguồn; xem đối chiếu ở [Nghiên cứu nghiệp vụ](./FIGHT-CAMP-DOMAIN-RESEARCH.md)

Tài liệu cũ (spec v1/v2, tài liệu AI, bàn giao cũ) nằm ở [archive/](./archive/).

---

## 1. Giới Thiệu

MMA-TMS giúp **CLB và trung tâm võ thuật** quản lý quá trình huấn luyện và chuẩn bị thi đấu cho võ sĩ.

### Trọng tâm hiện tại: Fight Camp

Giúp HLV đưa một võ sĩ từ lúc nhận trận đến lúc được tập lại sau trận: đúng hạng cân, đủ hồ sơ y tế, và không tập khi đang bị đình chỉ. Chi tiết ở [SCOPE-FIGHT-CAMP.md](./SCOPE-FIGHT-CAMP.md). Đây là đồ án: mục tiêu là hệ thống chạy trọn vòng đời một trận, qua tiêu chí nghiệm thu, và có bằng chứng kiểm thử với 3–5 người dùng.

### Năng lực hệ thống đang có

| Năng lực | Trạng thái |
| --- | --- |
| Kế hoạch tập theo phase (`base`, `build`, `fight_camp`, `taper`…), buổi tập, tiến độ | Đang dùng, gộp vào camp |
| Mục tiêu đo được (goals, migration 021–022) | Chưa merge; sẽ gắn với trận |
| Hồ sơ y tế: khám, clearance, chấn thương, phục hồi | Giữ chấn thương; phần còn lại đóng băng hoặc rút gọn |
| Thông báo trong app | Đang dùng |
| Phân tích video AI (YOLOv8-Pose, nhận diện đòn) | Đóng băng; vẫn chạy được |
| Tuyển võ sĩ (admissions), hiệu suất 12 tuần, live video, mobile | Đóng băng |

### Đối tượng người dùng

| Vai trò | Vai trò trong Fight Camp |
| --- | --- |
| **HLV (Coach)** | Người dùng chính: tạo trận, lập camp, theo dõi cân và hồ sơ, ghi kết quả |
| **Võ sĩ (Fighter)** | Ghi cân hằng ngày, xem lịch và trận của mình |
| **Bác sĩ (Doctor)** | Không bắt buộc: xác nhận hồ sơ, chấn thương, cho phép tập lại sau đình chỉ |
| **Admin** | Quản lý người dùng, bộ luật giải, chế độ có/không có bác sĩ |

---

## 2. Kiến Trúc Hệ Thống

```text
Next.js 16 (3000) ──REST──► NestJS 12 (3001) ──Drizzle──► PostgreSQL 16 (Supabase)
                                  │
                                  └──BullMQ──► Redis 7 (6379) ◄── Python worker (YOLOv8-Pose)
React Native / Expo SDK 57: đã dựng khung, đang tạm dừng
```

### Tech Stack

| Layer | Công nghệ | Phiên bản |
| --- | --- | --- |
| Frontend | Next.js (App Router), React, Tailwind CSS, Zod | 16.3.4, 19.2.8, v4, v4 |
| Backend | NestJS, Drizzle ORM, BullMQ, Zod | 12, 0.45.2, 6.3.4, v4 |
| AI Worker | Python, Ultralytics YOLOv8-Pose, OpenCV | 3.11 |
| Database | PostgreSQL (Supabase) | 16 |
| Queue | Redis | 7 |
| Mobile | React Native, Expo (tạm dừng) | 0.86.3, SDK 57 |

---

## 3. Cấu Trúc Monorepo

```text
├── nextjs-frontend/       # Web app (Next.js 16)
│   ├── src/app/           # 85 trang; 78 trong khu vực theo vai trò (app)/fighter|coach|doctor|admin
│   ├── src/components/    # UI components; điều hướng ở components/layout/navigation.ts
│   ├── src/lib/           # services (API + bản demo), actions, routes, domain
│   └── docs/              # frontend-architecture.md
│
├── nestjs-api/            # REST API (NestJS 12)
│   ├── src/               # 14 module nghiệp vụ: auth, authorization, users, fighters, coaches,
│   │                      # fighter-admissions, training, goals, medical, notifications,
│   │                      # videos, jobs, coaching, dataset-export (cùng database, config)
│   ├── migrations/        # SQL migrations 001–022 + manifest.json (checksum) + README
│   └── test/              # E2E tests
│
├── python-worker/         # Worker phân tích video
│   ├── pipeline/          # Các thành phần AI
│   ├── worker.py          # Consumer hàng đợi Redis
│   └── process_video.py   # Chạy một video từ dòng lệnh
│
├── reactnative-mobile/    # App mobile (tạm dừng)
├── docs/                  # Tài liệu dự án (bạn đang ở đây); docs/archive/ là tài liệu cũ
├── scripts/               # Setup Supabase, kiểm tra secret, test toàn bộ
├── docker-compose.yml     # redis, postgres, nestjs-api, python-worker, nextjs-frontend
└── start_all.bat          # Khởi động 1-click trên Windows
```

---

## 4. Cách Chạy Dự Án

### Yêu cầu

- Node.js 22+, pnpm
- Python 3.11+ (với venv trong `python-worker/.venv`)
- Redis 7
- PostgreSQL 16 (hoặc Supabase)

### Quick Start

```bash
start_all.bat              # 1-click trên Windows (start_all.bat --check để chỉ kiểm tra)
pnpm dev                   # chạy API, worker, frontend song song (tự kiểm tra Redis trước)
docker compose up --build  # toàn bộ bằng Docker
```

### Ports & URLs

| Service | Port | URL |
| --- | --- | --- |
| Frontend | 3000 | `http://localhost:3000` |
| Backend API | 3001 | `http://localhost:3001` |
| Swagger | 3001 | `http://localhost:3001/api-docs` |
| Redis | 6379 | `redis://localhost:6379` |

### Demo mode và API mode

| Mode | Cấu hình (`nextjs-frontend/.env.local`) | Mô tả |
| --- | --- | --- |
| **Demo** (mặc định) | không cần | Dữ liệu giả lập, không cần API, Redis hay worker |
| **API** | `APP_DATA_MODE=api`, `NEXT_PUBLIC_VIDEO_PIPELINE=api`, `API_URL=http://localhost:3001` | Kết nối thật: NestJS, Supabase, Redis, worker |

### Database

Schema do SQL migration đánh số quản lý; `drizzle-kit push/generate` đã bị tắt. Dùng `pnpm db:check`, `pnpm db:migrate:0xx` và `pnpm test:db` trong `nestjs-api/`. Quy ước và trạng thái từng migration: [migrations/README.md](../nestjs-api/migrations/README.md).

---

## 5. Kiểm Thử

| Phần | Lệnh |
| --- | --- |
| Toàn bộ | `pnpm test:full` (ở thư mục gốc) |
| Backend | `pnpm test` trong `nestjs-api/` (Vitest); migration: `pnpm test:db` |
| Frontend | `pnpm test` trong `nextjs-frontend/` (Vitest) |
| Python worker | Các file `test_*.py` trong `python-worker/tests/`, chạy bằng Python trong `.venv` |
| Quét secret | `pnpm secret:scan` |

Số lượng test thay đổi liên tục nên không ghi ở đây; xem kết quả của `pnpm test:full`.

---

## 6. Danh Sách Tài Liệu

### Fight Camp (đang làm)

| File | Mô tả |
| --- | --- |
| [`SCOPE-FIGHT-CAMP.md`](./SCOPE-FIGHT-CAMP.md) | Phạm vi, lộ trình, câu hỏi cần chốt |
| [`FIGHT-CAMP-DOMAIN-RESEARCH.md`](./FIGHT-CAMP-DOMAIN-RESEARCH.md) | Nghiên cứu quy định cân, hồ sơ, đình chỉ |
| [`FIGHT-CAMP-BUSINESS-FLOWS.md`](./FIGHT-CAMP-BUSINESS-FLOWS.md) | Luồng nghiệp vụ và tiêu chí nghiệm thu |
| [`FIGHT-CAMP-TECH-SPEC.md`](./FIGHT-CAMP-TECH-SPEC.md) | Thiết kế kỹ thuật và thứ tự PR |
| [`FIGHT-CAMP-USER-TESTING.md`](./FIGHT-CAMP-USER-TESTING.md) | Hướng dẫn kiểm thử người dùng (tác vụ, SUS) |
| [`FIGHT-CAMP-OPEN-QUESTIONS.md`](./FIGHT-CAMP-OPEN-QUESTIONS.md) | Câu hỏi cần trả lời, có chỗ điền |

### Hệ thống hiện có

| File | Mô tả |
| --- | --- |
| [`BUSINESS-FLOWS.md`](./BUSINESS-FLOWS.md) | Luồng nghiệp vụ của hệ thống hiện tại |
| [`MMA-TMS-MASTER-SPECIFICATION-v3.md`](./MMA-TMS-MASTER-SPECIFICATION-v3.md) | Spec đầy đủ, bản đang hiệu lực (v3.5) |
| [`VIETNAM-MARKET-ANALYSIS.md`](./VIETNAM-MARKET-ANALYSIS.md) | Phân tích thị trường; nhiều số liệu chưa có nguồn |
| [`ROADMAP.md`](./ROADMAP.md) | Roadmap cũ, đã được thay thế; chỉ để tham khảo |
| [`../nextjs-frontend/docs/frontend-architecture.md`](../nextjs-frontend/docs/frontend-architecture.md) | Kiến trúc frontend |
| [`../nestjs-api/migrations/README.md`](../nestjs-api/migrations/README.md) | Quy ước và trạng thái migration |

### Lưu trữ

[`archive/`](./archive/): spec v1/v2, tài liệu và báo cáo AI, luồng FE cũ, bàn giao cũ, thiết kế landing 3D.

---

## 7. Đóng Góp

- **Repository**: [github.com/Dannguyen04/MMA-TMS](https://github.com/Dannguyen04/MMA-TMS)
- **Nhánh chính**: `main`
- **Quy ước commit**: `feat()`, `fix()`, `chore()`, `docs()`

Quy trình:

1. Tạo branch từ `main`
2. Code và viết test
3. Chạy `pnpm test:full`
4. Tạo Pull Request, review, merge
