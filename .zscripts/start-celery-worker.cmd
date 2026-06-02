@echo off
chcp 65001 >nul
cd /d "%~dp0..\mini-services\excel-service"
title OMiK Celery Worker
set OMIK_USE_CELERY=1
if not defined CELERY_BROKER_URL set CELERY_BROKER_URL=redis://127.0.0.1:6379/0
if not defined CELERY_RESULT_BACKEND set CELERY_RESULT_BACKEND=%CELERY_BROKER_URL%

echo.
echo  Celery worker (очередь omik_excel)
echo  Redis: %CELERY_BROKER_URL%
echo  Не закрывайте это окно во время обработки билетов.
echo.

python -m celery -A celery_app worker --loglevel=info -Q omik_excel -c 1
echo.
pause
