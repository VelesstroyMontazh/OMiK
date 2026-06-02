@echo off
set "PORT=%~1"
if "%PORT%"=="" exit /b 0
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %PORT% -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1) { exit 1 } else { exit 0 }"
exit /b %ERRORLEVEL%
