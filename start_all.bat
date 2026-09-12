@echo off
chcp 65001 >nul
title Khởi động Hệ thống MMA-TMS (Smart Launcher)

echo ============================================================
echo 🥋 ĐANG KHỞI ĐỘNG HỆ THỐNG MMA-TMS (SMART LAUNCHER)
echo ============================================================
echo.

set ROOT_DIR=%~dp0

:: 0. Tự động kiểm tra và khởi tạo file .env nếu chưa có
echo [*] Kiểm tra cấu hình môi trường (.env)...
if not exist "%ROOT_DIR%.env" (
    if exist "%ROOT_DIR%.env.example" (
        copy "%ROOT_DIR%.env.example" "%ROOT_DIR%.env" >nul
        echo     + Đã tự động tạo .env từ .env.example
    )
)
if not exist "%ROOT_DIR%nestjs-api\.env" (
    if exist "%ROOT_DIR%nestjs-api\.env.example" (
        copy "%ROOT_DIR%nestjs-api\.env.example" "%ROOT_DIR%nestjs-api\.env" >nul
        echo     + Đã tự động tạo nestjs-api\.env
    )
)
if not exist "%ROOT_DIR%python-worker\.env" (
    if exist "%ROOT_DIR%python-worker\.env.example" (
        copy "%ROOT_DIR%python-worker\.env.example" "%ROOT_DIR%python-worker\.env" >nul
        echo     + Đã tự động tạo python-worker\.env
    )
)
if not exist "%ROOT_DIR%nextjs-frontend\.env.local" (
    if exist "%ROOT_DIR%nextjs-frontend\.env.local.example" (
        copy "%ROOT_DIR%nextjs-frontend\.env.local.example" "%ROOT_DIR%nextjs-frontend\.env.local" >nul
        echo     + Đã tự động tạo nextjs-frontend\.env.local
    )
)

:: 1. Khởi động Redis
echo [1/4] Kiểm tra Redis Server (Port 6379)...
netstat -ano | findstr :6379 | findstr LISTENING >nul
if %ERRORLEVEL% EQU 0 (
    echo     ✓ Redis Server đã đang chạy trên cổng 6379.
) else (
    echo     + Đang khởi động Redis Server...
    set REDIS_PATH="C:\Users\DAN\AppData\Local\Microsoft\WinGet\Packages\taizod1024.redis-windows-fork_Microsoft.Winget.Source_8wekyb3d8bbwe\Redis-8.10.1-Windows-x64-msys2\redis-server.exe"
    if exist %REDIS_PATH% (
        start "MMA-TMS: Redis Server (Port 6379)" %REDIS_PATH%
    ) else (
        start "MMA-TMS: Redis Server (Port 6379)" redis-server
    )
    timeout /t 2 /nobreak >nul
)

:: 2. Khởi động NestJS API (Port 3001)
echo [2/4] Đang khởi động NestJS API (Port 3001)...
start "MMA-TMS: NestJS API (Port 3001)" cmd /k "cd /d %ROOT_DIR%nestjs-api && npm run start:dev"
timeout /t 3 /nobreak >nul

:: 3. Khởi động Python AI Worker
echo [3/4] Đang khởi động Python AI Worker (YOLOv8-Pose)...
start "MMA-TMS: Python Worker (YOLOv8-Pose)" cmd /k "cd /d %ROOT_DIR%python-worker && .venv\Scripts\python.exe worker.py"
timeout /t 2 /nobreak >nul

:: 4. Khởi động Next.js Frontend (Port 3000)
echo [4/4] Đang khởi động Next.js Frontend (Port 3000)...
start "MMA-TMS: Next.js Frontend (Port 3000)" cmd /k "cd /d %ROOT_DIR%nextjs-frontend && npm run dev"

echo.
echo ============================================================
echo ✅ CẢ 4 DỊCH VỤ ĐÃ ĐƯỢC KHỞI ĐỘNG THÀNH CÔNG!
echo.
echo 🌐 Giao diện Web:      http://localhost:3000
echo 📤 Trang tải lên:      http://localhost:3000/analysis
echo 📡 Backend API:        http://localhost:3001
echo.
echo Mẹo: Bạn cũng có thể dùng lệnh 'npm run dev' ở thư mục gốc
echo      để chạy chung trong 1 cửa sổ duy nhất với Concurrently!
echo.
echo Để tắt toàn bộ hệ thống, chạy: stop_all.bat
echo ============================================================
pause
