@echo off
echo.
echo  Optional Celery mode - needs local Redis. For normal use: START.bat
echo.
pause
call "%~dp0.zscripts\open-console.cmd" "OMiK_Celery" "%~f0" %*
if errorlevel 1 goto :run
exit /b 0

:run
cd /d "%~dp0"
set OMIK_USE_CELERY=1
if not defined CELERY_BROKER_URL set CELERY_BROKER_URL=redis://127.0.0.1:6379/0
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0.zscripts\start-dev-celery.ps1"
echo.
echo  Stopped. Close Excel + Celery windows. STOP.bat for ports.
exit /b %ERRORLEVEL%
