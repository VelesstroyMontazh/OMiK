@echo off
call "%~dp0.zscripts\open-console.cmd" "OMiK_VSM" "%~f0" %*
if errorlevel 1 goto :run
exit /b 0

:run
set ERR=0
cd /d "%~dp0"
title OMiK_VSM
set DATABASE_URL=file:./db/custom.db
set EXCEL_BACKEND_URL=http://127.0.0.1:3031
set PORT=3031
set EXCEL_SERVICE_HOST=127.0.0.1
if not exist "db" mkdir db
if not exist "logs" mkdir logs

echo.
echo  ============================================
echo   OMiK_VSM - ONE-CLICK START
echo   Browser opens automatically
echo   Stop: double-click STOP.bat
echo  ============================================
echo.

where bun >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Bun not found. Install: https://bun.sh
  echo         Then run INSTALL.bat once.
  set ERR=1
  goto :done
)

where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Python not found.
  set ERR=1
  goto :done
)

echo [1/2] Freeing ports 3000 and 3031...
call "%~dp0.zscripts\stop-ports.cmd" silent
ping 127.0.0.1 -n 3 >nul
call "%~dp0.zscripts\stop-ports.cmd" silent
ping 127.0.0.1 -n 2 >nul

call "%~dp0.zscripts\port-busy.cmd" 3000
if errorlevel 1 (
  echo [ERROR] Port 3000 still busy. Close other Next.js windows or reboot.
  set ERR=1
  goto :done
)

echo [2/2] Starting excel + Next.js...
echo       Wait for Ready - browser opens by itself.
echo.

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0.zscripts\start-dev.ps1"
set ERR=%ERRORLEVEL%

:done
echo.
if defined ERR if not %ERR%==0 echo  Failed with code %ERR%.
echo  To stop: STOP.bat  ^|  Close this window after Ctrl+C in Next.js
echo.
exit /b %ERR%
