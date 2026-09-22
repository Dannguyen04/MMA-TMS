@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul
title MMA-TMS Smart Launcher

set "ROOT_DIR=%~dp0"
set "API_DIR=%ROOT_DIR%nestjs-api"
set "WORKER_DIR=%ROOT_DIR%python-worker"
set "FRONTEND_DIR=%ROOT_DIR%nextjs-frontend"
set "PYTHON_EXE=%WORKER_DIR%\.venv\Scripts\python.exe"
set "CHECK_ONLY="
if /I "%~1"=="--check" set "CHECK_ONLY=1"

echo ============================================================
echo MMA-TMS SMART LAUNCHER
echo ============================================================
echo.

rem Preflight: fail before starting a partial stack.
echo [0/4] Running prerequisite checks...

where node.exe >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js was not found in PATH.
    echo Install Node.js and reopen the terminal before retrying.
    goto :failed
)

if not defined PNPM_CMD (
    where pnpm.cmd >nul 2>&1
    if not errorlevel 1 set "PNPM_CMD=pnpm"
    if not defined PNPM_CMD (
        where corepack.cmd >nul 2>&1
        if not errorlevel 1 set "PNPM_CMD=corepack pnpm"
    )
)
if not defined PNPM_CMD (
    echo [ERROR] pnpm and Corepack were not found in PATH.
    echo Install pnpm or enable Corepack, then reopen the terminal and retry.
    echo This project intentionally does not fall back to npm.
    goto :failed
)

if not exist "%API_DIR%\package.json" (
    echo [ERROR] Missing directory: "%API_DIR%"
    goto :failed
)
if not exist "%FRONTEND_DIR%\package.json" (
    echo [ERROR] Missing directory: "%FRONTEND_DIR%"
    goto :failed
)
if not exist "%WORKER_DIR%\worker.py" (
    echo [ERROR] Missing directory or worker entry point: "%WORKER_DIR%"
    goto :failed
)
if not exist "%PYTHON_EXE%" (
    echo [ERROR] Python virtual environment was not found:
    echo         "%PYTHON_EXE%"
    echo Create python-worker\.venv and install the worker dependencies first.
    goto :failed
)
if not exist "%API_DIR%\node_modules" (
    echo [ERROR] API dependencies are missing.
    echo Run: cd /d "%API_DIR%" ^&^& %PNPM_CMD% install
    goto :failed
)
if not exist "%FRONTEND_DIR%\node_modules" (
    echo [ERROR] Frontend dependencies are missing.
    echo Run: cd /d "%FRONTEND_DIR%" ^&^& %PNPM_CMD% install
    goto :failed
)

call :copy_env_if_missing "%ROOT_DIR%.env.example" "%ROOT_DIR%.env"
call :copy_env_if_missing "%API_DIR%\.env.example" "%API_DIR%\.env"
call :copy_env_if_missing "%WORKER_DIR%\.env.example" "%WORKER_DIR%\.env"
call :copy_env_if_missing "%FRONTEND_DIR%\.env.local.example" "%FRONTEND_DIR%\.env.local"

echo     Prerequisite checks passed.
echo.

if defined CHECK_ONLY (
    echo Launcher preflight completed successfully. No services were started.
    exit /b 0
)

rem Redis: reuse an existing instance, find a native binary, or use Docker.
echo [1/4] Checking Redis on port 6379...
call :port_open 6379
if not errorlevel 1 (
    echo     Redis is already running.
) else (
    set "REDIS_EXE="
    for /f "delims=" %%I in ('where redis-server.exe 2^>nul') do (
        if not defined REDIS_EXE set "REDIS_EXE=%%~fI"
    )
    if not defined REDIS_EXE if defined LOCALAPPDATA (
        if exist "%LOCALAPPDATA%\Microsoft\WinGet\Packages" (
            for /r "%LOCALAPPDATA%\Microsoft\WinGet\Packages" %%I in (redis-server.exe) do (
                if not defined REDIS_EXE set "REDIS_EXE=%%~fI"
            )
        )
    )

    if defined REDIS_EXE (
        echo     Starting native Redis: "!REDIS_EXE!"
        start "MMA-TMS: Redis Server (Port 6379)" "!REDIS_EXE!"
    ) else (
        where docker.exe >nul 2>&1
        if errorlevel 1 (
            echo [ERROR] Redis was not found and Docker is unavailable.
            echo Install Redis, add redis-server.exe to PATH, or start Docker Desktop.
            goto :failed
        )
        docker info >nul 2>&1
        if errorlevel 1 (
            echo [ERROR] Docker is installed but its daemon is not running.
            echo Start Docker Desktop and retry.
            goto :failed
        )

        echo     Starting Redis with Docker Compose...
        pushd "%ROOT_DIR%"
        docker compose up -d redis
        if errorlevel 1 (
            popd
            echo [ERROR] Docker Compose could not start Redis.
            goto :failed
        )
        popd
    )

    call :wait_for_port 6379 20
    if errorlevel 1 (
        echo [ERROR] Redis did not become ready on port 6379 within 20 seconds.
        goto :failed
    )
    echo     Redis is ready.
)
echo.

rem NestJS API.
echo [2/4] Checking NestJS API on port 3001...
call :port_open 3001
if not errorlevel 1 (
    echo     NestJS API is already running.
) else (
    echo     Starting NestJS API...
    start "MMA-TMS: NestJS API (Port 3001)" /D "%API_DIR%" cmd /k "%PNPM_CMD% run start:dev"
    call :wait_for_port 3001 30
    if errorlevel 1 (
        echo [ERROR] NestJS API did not become ready on port 3001 within 30 seconds.
        echo Review the NestJS API window for the actual startup error.
        goto :failed
    )
    echo     NestJS API is ready.
)
echo.

rem Python worker. It has no HTTP port, so its own window remains authoritative.
echo [3/4] Starting Python AI worker...
start "MMA-TMS: Python Worker" /D "%WORKER_DIR%" cmd /k ""%PYTHON_EXE%" worker.py"
echo     Python worker process launched.
echo.

rem Next.js frontend.
echo [4/4] Checking Next.js frontend on port 3000...
call :port_open 3000
if not errorlevel 1 (
    echo     Next.js frontend is already running.
) else (
    echo     Starting Next.js frontend...
    start "MMA-TMS: Next.js Frontend (Port 3000)" /D "%FRONTEND_DIR%" cmd /k "%PNPM_CMD% run dev"
    call :wait_for_port 3000 30
    if errorlevel 1 (
        echo [ERROR] Next.js frontend did not become ready on port 3000 within 30 seconds.
        echo Review the Next.js frontend window for the actual startup error.
        goto :failed
    )
    echo     Next.js frontend is ready.
)

echo.
echo ============================================================
echo MMA-TMS services are ready.
echo Frontend:       http://localhost:3000
echo Backend API:    http://localhost:3001
echo Swagger UI:     http://localhost:3001/docs
echo OpenAPI JSON:   http://localhost:3001/docs-json
echo ============================================================
pause
exit /b 0

:copy_env_if_missing
if not exist "%~2" if exist "%~1" (
    copy /Y "%~1" "%~2" >nul
    echo     Created "%~2" from its example file.
)
exit /b 0

:port_open
netstat -ano | findstr /R /C:":%~1 .*LISTENING" >nul 2>&1
exit /b %errorlevel%

:wait_for_port
set /a "WAIT_REMAINING=%~2"
:wait_for_port_loop
call :port_open %~1
if not errorlevel 1 exit /b 0
if !WAIT_REMAINING! LEQ 0 exit /b 1
set /a "WAIT_REMAINING-=1"
timeout /t 1 /nobreak >nul
goto :wait_for_port_loop

:failed
echo.
echo MMA-TMS launcher stopped before reporting success.
pause
exit /b 1
