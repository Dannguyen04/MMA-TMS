# start_all.ps1 — Smart PowerShell Launcher for MMA-TMS
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "🥋 ĐANG KHỞI ĐỘNG HỆ THỐNG MMA-TMS (SMART PS1 LAUNCHER)" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

$rootDir = $PSScriptRoot

# 0. Kiểm tra .env
Write-Host "[*] Kiểm tra cấu hình môi trường (.env)..." -ForegroundColor Yellow
$envPairs = @(
    @("$rootDir\.env.example", "$rootDir\.env"),
    @("$rootDir\nestjs-api\.env.example", "$rootDir\nestjs-api\.env"),
    @("$rootDir\python-worker\.env.example", "$rootDir\python-worker\.env"),
    @("$rootDir\nextjs-frontend\.env.local.example", "$rootDir\nextjs-frontend\.env.local")
)

foreach ($pair in $envPairs) {
    if (-not (Test-Path $pair[1]) -and (Test-Path $pair[0])) {
        Copy-Item -Path $pair[0] -Destination $pair[1]
        Write-Host "    + Đã tự động tạo $($pair[1])" -ForegroundColor Green
    }
}

# 0.1 Đảm bảo Node.js và pnpm có trong PATH
$nodePath = "C:\Program Files\Microsoft Visual Studio\18\Community\MSBuild\Microsoft\VisualStudio\NodeJs"
if ($env:Path -notlike "*$nodePath*") {
    $env:Path = "$nodePath;$env:Path"
}

# 1. Kiểm tra Redis
Write-Host "[1/4] Kiểm tra Redis Server (Port 6379)..." -ForegroundColor Yellow
$redisActive = (Get-NetTCPConnection -LocalPort 6379 -ErrorAction SilentlyContinue | Where-Object State -eq 'Listen')
if ($redisActive) {
    Write-Host "    ✓ Redis Server đã đang chạy trên cổng 6379." -ForegroundColor Green
} else {
    Write-Host "    + Đang khởi động Redis Server..." -ForegroundColor Yellow
    $redisWinGet = "$env:LOCALAPPDATA\Microsoft\WinGet\Packages\taizod1024.redis-windows-fork_Microsoft.Winget.Source_8wekyb3d8bbwe\Redis-8.10.1-Windows-x64-msys2\redis-server.exe"
    if (Test-Path $redisWinGet) {
        Start-Process -FilePath $redisWinGet -WindowStyle Normal
    } else {
        Start-Process -FilePath "redis-server" -WindowStyle Normal -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

# 2. NestJS API
Write-Host "[2/4] Khởi động NestJS API (Port 3001)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootDir\nestjs-api'; pnpm run start:dev" -WindowStyle Normal
Start-Sleep -Seconds 3

# 3. Python AI Worker
Write-Host "[3/4] Khởi động Python AI Worker (YOLOv8-Pose)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootDir\python-worker'; .\.venv\Scripts\python.exe worker.py" -WindowStyle Normal
Start-Sleep -Seconds 2

# 4. Next.js Frontend
Write-Host "[4/4] Khởi động Next.js Frontend (Port 3000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootDir\nextjs-frontend'; pnpm run dev" -WindowStyle Normal

Write-Host ""
Write-Host "============================================================" -ForegroundColor Green
Write-Host "✅ CẢ 4 DỊCH VỤ ĐÃ ĐƯỢC KHỞI ĐỘNG THÀNH CÔNG!" -ForegroundColor Green
Write-Host "🌐 Giao diện Web:      http://localhost:3000" -ForegroundColor White
Write-Host "📤 Trang tải lên:      http://localhost:3000/analysis" -ForegroundColor White
Write-Host "📡 Backend API:        http://localhost:3001" -ForegroundColor White
Write-Host ""
Write-Host "Mẹo: Chạy 'pnpm dev' ở thư mục gốc để gom chung log vào 1 terminal!" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Green

