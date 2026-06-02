@echo off
title OMiK Excel API :3031
cd /d "%~dp0.."
if not exist "logs" mkdir logs
set PORT=3031
set EXCEL_SERVICE_HOST=127.0.0.1
set UVICORN_WORKERS=1
echo Log: %CD%\logs\excel-service.log
python "%~dp0start_excel_service.py" %*
if errorlevel 1 (
  echo.
  echo If startup failed, run for details:
  echo   python .zscripts\start_excel_service.py --foreground
  pause
)
exit /b %ERRORLEVEL%
