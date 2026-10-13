@echo off
title FITY AI - Dung he thong
echo ========================================================
echo   FITY AI - Dung Backend va Frontend (Port 8000 & 3000)
echo ========================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 8000, 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }"

echo Da tat cac tien trinh dang chay tren cong 8000 va 3000.
timeout /t 2 >nul
exit
