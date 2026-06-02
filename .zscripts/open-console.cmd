@echo off
REM Usage: open-console.cmd "Title" "C:\path\script.bat" [run]
REM Without "run": spawns cmd /k. With "run": exit 1 so caller continues.
if /i "%~3"=="run" exit /b 1
if "%~2"=="" exit /b 0
start "%~1" cmd /k call "%~2" run
exit /b 0
