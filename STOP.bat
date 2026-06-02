@echo off
call "%~dp0.zscripts\open-console.cmd" "OMiK_STOP" "%~f0" %*
if errorlevel 1 goto :run
exit /b 0

:run
cd /d "%~dp0"
title OMiK_STOP
echo Stopping ports 3000, 3031, 81...
call "%~dp0.zscripts\stop-ports.cmd" silent
ping 127.0.0.1 -n 3 >nul
echo.
call "%~dp0.zscripts\port-busy.cmd" 3000
if errorlevel 1 (echo   Port 3000: still in use) else (echo   Port 3000: free)
call "%~dp0.zscripts\port-busy.cmd" 3031
if errorlevel 1 (echo   Port 3031: still in use) else (echo   Port 3031: free)
echo.
echo Done. Now run START.bat
echo Type exit to close.
echo.
exit /b 0
