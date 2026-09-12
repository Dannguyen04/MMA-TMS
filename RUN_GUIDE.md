# 🥋 Hướng Dẫn Vận Hành & Khởi Động Hệ Thống MMA-TMS

Tài liệu hướng dẫn chi tiết cách cài đặt, khởi động và kiểm thử toàn bộ hệ thống phân tích võ thuật **MMA-TMS (MMA Training & Movement Analysis System)** trên môi trường Windows và Docker.

---

## 📌 1. Bảng Tham Chiếu Cổng & Dịch Vụ (Port Reference)

Hệ thống bao gồm 4 thành phần phối hợp qua hàng đợi BullMQ và cơ sở dữ liệu Supabase Cloud:

| Dịch vụ              | Thư mục            | Cổng (Port) | Vai trò chính                                                           |
| :------------------- | :----------------- | :---------: | :---------------------------------------------------------------------- |
| **Redis Server**     | WinGet Package     |   `6379`    | Message broker trung chuyển hàng đợi job `video-analysis`               |
| **NestJS API**       | `nestjs-api/`      |   `3001`    | REST API quản lý job, phân quyền, kết nối Supabase PostgreSQL           |
| **Python Worker**    | `python-worker/`   |   Daemon    | AI Computer Vision: YOLOv8-Pose, KickAnalyzer, PunchAnalyzer            |
| **Next.js Frontend** | `nextjs-frontend/` |   `3000`    | Web UI: Tải lên video, Canvas vẽ khung xương & góc cùi chỏ, AI Findings |

---

## 🚀 2. Cách 1: Khởi Động 1-Click (Khuyến Nghị Nhanh Nhất)

Dự án đã tích hợp sẵn 2 script tự động mở 4 cửa sổ console độc lập cho từng dịch vụ:

### Khởi động:

- Vào thư mục gốc `d:\test\ai\`
- Nhấp đúp chuột vào file: **`start_all.bat`**
- Hệ thống sẽ tự động bật 4 cửa sổ console:
    1. `MMA-TMS: Redis Server (Port 6379)`
    2. `MMA-TMS: NestJS API (Port 3001)`
    3. `MMA-TMS: Python Worker (YOLOv8-Pose)`
    4. `MMA-TMS: Next.js Frontend (Port 3000)`

### Tắt toàn bộ hệ thống:

- Nhấp đúp chuột vào file: **`stop_all.bat`**

---

## 🛠️ 3. Cách 2: Khởi Động Thủ Công Từng Dịch Vụ (Dành Cho Developer)

Mở 4 cửa sổ **PowerShell** hoặc **Terminal** riêng biệt và chạy lần lượt các lệnh sau:

### Terminal 1: Khởi động Redis

```powershell
& "C:\Users\DAN\AppData\Local\Microsoft\WinGet\Packages\taizod1024.redis-windows-fork_Microsoft.Winget.Source_8wekyb3d8bbwe\Redis-8.10.1-Windows-x64-msys2\redis-server.exe"
```

_(Nếu đã cấu hình PATH cho Redis, bạn chỉ cần gõ `redis-server`)_

---

### Terminal 2: Khởi động NestJS Backend API

```powershell
cd d:\test\ai\nestjs-api
npm run dev
```

- Khi sẵn sàng sẽ thông báo: `Nest application successfully started on port 3001`
- Kiểm tra kết nối: Mở trình duyệt truy cập `http://localhost:3001/jobs`

---

### Terminal 3: Khởi động Python AI Worker

```powershell
cd d:\test\ai\python-worker
.\.venv\Scripts\python.exe worker.py
```

- Khi sẵn sàng sẽ thông báo:
    ```text
    🚀 Worker khởi động
       Redis:    redis://localhost:6379
       Queue:    video-analysis
       Model:    yolov8n-pose
    👂 Đang lắng nghe queue 'video-analysis'...
    ```

---

### Terminal 4: Khởi động Next.js Frontend

```powershell
cd d:\test\ai\nextjs-frontend
npm run dev
```

- Khi sẵn sàng sẽ thông báo: `Ready in ...ms (http://localhost:3000)`

---

## 🐳 4. Cách 3: Khởi Động Bằng Docker Compose

Nếu máy trạm đã cài đặt **Docker Desktop**, bạn có thể khởi động toàn bộ stack chỉ với 1 lệnh:

```bash
cd d:\test\ai
docker compose up --build
```

---

## 🧪 5. Hướng Dẫn Chạy Các Bộ Kiểm Thử (Test Suites)

Mọi tính năng đều có kịch bản test tự động để đảm bảo hệ thống hoạt động ổn định:

### 1. Kiểm thử E2E Phase 2 (Đòn đấm Cross + AI Findings):

```powershell
cd d:\test\ai
node test_phase2_verification.mjs
```

_(Tự động chạy headless browser, tải video mẫu, chờ worker phân tích và chụp ảnh màn hình kết quả)_

### 2. Kiểm thử hồi quy toàn diện 28 bài test:

```powershell
cd d:\test\ai
node test_full_suite.mjs
```

### 3. Kiểm thử riêng lẻ Unit Tests Python:

```powershell
cd d:\test\ai\python-worker
# Test PunchAnalyzer
.\.venv\Scripts\python.exe test_punch_analyzer.py

# Test Pose Math
.\.venv\Scripts\python.exe test_pose_math.py
```

---

## 🥊 6. Hướng Dẫn Sử Dụng Ứng Dụng Trên Web

1. Mở trình duyệt truy cập: **`http://localhost:3000/analysis`**
2. Bấm chọn video võ thuật của bạn (`.mp4`) và bấm **"Bắt đầu phân tích"**.
3. Hệ thống tự động:
    - Đẩy video lên Supabase Storage.
    - Thêm task vào hàng đợi BullMQ.
    - Python Worker dùng YOLOv8-Pose bóc tách 17 khớp xương, phân tích góc cùi chỏ, góc gối, tốc độ và thế thủ.
    - Tự động chuyển hướng sang trang kết quả `/analysis/[jobId]`.
4. Trên trang kết quả:
    - Xem video phát kèm khung xương động và cung đo góc cùi chỏ `🥊 173.4°`.
    - Chọn tốc độ phát chậm (`0.25x`, `0.5x`) hoặc tua từng khung hình (`⏮ -1`, `+1 ⏭`).
    - Chuyển đổi giữa các tab **Đòn đấm**, **AI Findings** và **Cú đá** để xem chi tiết nhận xét của HLV ảo.
