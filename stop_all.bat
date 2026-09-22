@echo off
setlocal EnableExtensions
chcp 65001 >nul
set "ROOT_DIR=%~dp0"
set "PROJECT_NAME=mma-tms-local"

where docker.exe >nul 2>&1 || (
    echo [ERROR] Docker CLI was not found.
    exit /b 1
)
pushd "%ROOT_DIR%"
docker compose -p "%PROJECT_NAME%" down
set "RESULT=%ERRORLEVEL%"
popd
exit /b %RESULT%
