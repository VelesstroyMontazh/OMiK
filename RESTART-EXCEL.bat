@echo off
title OMiK - restart excel :3031
cd /d "%~dp0"
echo.
echo  Restart excel-service (port 3031 only)
echo.
python "%~dp0.zscripts\stop_excel_service.py"
if errorlevel 1 (
  echo  Warning: stop script returned error, continuing...
)
set "EXCEL_SERVICE_WAIT_SEC=45"
set "EXCEL_SERVICE_QUIET=1"
python "%~dp0.zscripts\start_excel_service.py" --force-restart
if errorlevel 1 (
  echo.
  echo  Failed. Try foreground debug:
  echo    python .zscripts\start_excel_service.py --foreground --force-restart
  pause
  exit /b 1
)
echo.
echo  OK: http://127.0.0.1:3031/api/health
echo  Then F5 in browser.
echo.
exit /b 0
