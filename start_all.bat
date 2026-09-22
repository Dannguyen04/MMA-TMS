@echo off
setlocal EnableExtensions
chcp 65001 >nul
set "ROOT_DIR=%~dp0"
set "PROJECT_NAME=mma-tms-local"

where docker.exe >nul 2>&1 || (
    echo [ERROR] Docker CLI was not found.
    exit /b 1
)
docker info >nul 2>&1 || (
    echo [ERROR] Docker daemon is not running.
    exit /b 1
)
set "ENV_FILE=%ROOT_DIR%.env"
if not exist "%ENV_FILE%" set "ENV_FILE=%ROOT_DIR%nestjs-api\.env"
if not exist "%ENV_FILE%" (
    echo [ERROR] Missing %ROOT_DIR%.env and %ROOT_DIR%nestjs-api\.env.
    echo Copy .env.example to .env or configure nestjs-api\.env.
    exit /b 1
)
findstr /I /C:"replace-with" /C:"your-project" /C:"[YOUR-PASSWORD]" "%ENV_FILE%" >nul && (
    echo [ERROR] %ENV_FILE% still contains placeholder values.
    exit /b 1
)

pushd "%ROOT_DIR%"
docker compose --env-file "%ENV_FILE%" -p "%PROJECT_NAME%" up --build --wait
set "RESULT=%ERRORLEVEL%"
popd
if not "%RESULT%"=="0" exit /b %RESULT%

echo MMA-TMS is ready at http://localhost:3000
exit /b 0
