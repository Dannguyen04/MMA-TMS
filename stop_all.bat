@echo off
chcp 65001 >nul
title Dừng toàn bộ hệ thống MMA-TMS

echo ============================================================
echo 🛑 ĐANG DỪNG CÁC DỊCH VỤ CỦA MMA-TMS...
echo ============================================================
echo.

echo [1/3] Đang dừng Redis...
taskkill /F /IM redis-server.exe 2>nul

echo [2/3] Đang đóng các cửa sổ dịch vụ MMA-TMS...
taskkill /F /FI "WINDOWTITLE eq MMA-TMS: Python Worker*" 2>nul
taskkill /F /FI "WINDOWTITLE eq MMA-TMS: NestJS API*" 2>nul
taskkill /F /FI "WINDOWTITLE eq MMA-TMS: Next.js Frontend*" 2>nul
taskkill /F /FI "WINDOWTITLE eq MMA-TMS: Redis Server*" 2>nul

echo [3/3] Giải phóng các cổng 3000, 3001 nếu còn tiến trình chiếm dụng...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3001 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul

echo.
echo ✅ Đã dừng toàn bộ dịch vụ MMA-TMS và giải phóng cổng mạng!
echo ============================================================
pause
