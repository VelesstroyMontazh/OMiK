@echo off
cd /d "%~dp0.."
if not exist "db" mkdir db
set DATABASE_URL=file:./db/custom.db
echo Creating database...
call bun run db:push
if errorlevel 1 exit /b 1
call bun run db:generate
if errorlevel 1 exit /b 1
echo Done. Database: db\custom.db
if /i not "%~1"=="nopause" pause
exit /b 0
