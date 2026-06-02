@echo off
setlocal EnableExtensions
cd /d "%~dp0.."
for %%P in (3000 3031 81) do (
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr /R /C:":%%P .*LISTENING" /C:":%%P .*ПРОСЛУШИВАНИЕ"') do (
    if not "%%a"=="0" taskkill /F /PID %%a >nul 2>&1
  )
)
exit /b 0
