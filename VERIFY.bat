@echo off
call "%~dp0.zscripts\open-console.cmd" "OMiK_VERIFY" "%~f0" %*
if errorlevel 1 goto :run
exit /b 0

:run
cd /d "%~dp0"
title OMiK_VERIFY
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0.zscripts\verify-windows.ps1"
echo.
echo Exit code: %ERRORLEVEL%
echo Type exit to close.
exit /b %ERRORLEVEL%
