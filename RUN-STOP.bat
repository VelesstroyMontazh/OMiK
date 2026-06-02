@echo off
cd /d "%~dp0"
start "OMiK_STOP" cmd /k call "%~dp0STOP.bat" run
