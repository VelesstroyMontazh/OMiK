@echo off
chcp 65001 >nul
title OMiK Excel API (Celery mode)
cd /d "%~dp0..\mini-services\excel-service"

set OMIK_USE_CELERY=1
if not defined CELERY_BROKER_URL set CELERY_BROKER_URL=redis://127.0.0.1:6379/0
if not defined CELERY_RESULT_BACKEND set CELERY_RESULT_BACKEND=%CELERY_BROKER_URL%
set EXCEL_SERVICE_HOST=127.0.0.1
set PORT=3031
set UVICORN_WORKERS=1

echo.
echo  Excel-service + Celery mode (OMIK_USE_CELERY=1)
echo  http://127.0.0.1:3031/api/health
echo  Redis: %CELERY_BROKER_URL%
echo  Не закрывайте это окно.
echo.

python app.py
echo.
echo  Excel-service остановлен.
pause
