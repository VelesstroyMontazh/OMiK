@echo off
cd /d "%~dp0.."
python "%~dp0stop_excel_service.py"
exit /b %ERRORLEVEL%
