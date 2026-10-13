@echo off
title FITY AI - Khoi dong he thong
echo ========================================================
echo   FITY AI - Khoi dong Backend va Frontend tu dong
echo ========================================================
echo.

set SCRIPT_DIR=%~dp0

echo [1/3] Dang khoi dong Backend (FastAPI :8000)...
start "FITY AI - Backend" powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%start-backend.ps1"

timeout /t 3 /nobreak >nul

echo [2/3] Dang khoi dong Frontend (Next.js :3000)...
start "FITY AI - Frontend" powershell -NoProfile -ExecutionPolicy Bypass -File "%SCRIPT_DIR%start-frontend.ps1"

timeout /t 4 /nobreak >nul

echo [3/3] Dang mo trinh duyet...
start http://localhost:3000

echo.
echo Da khoi dong ca 2 tien trinh tren 2 cua so rieng biet!
echo De tat he thong: chi can dong 2 cua so Backend va Frontend.
echo.
timeout /t 3 >nul
exit
