@echo off
cd /d "%~dp0"
title OMiK_VSM - install (once)

echo.
echo  ========================================
echo   OMiK_VSM - first-time setup
echo  ========================================
echo.

where bun >nul 2>&1
if errorlevel 1 (
  echo [ERROR] bun not found. Install: https://bun.sh
  goto :fail
)

where python >nul 2>&1
if errorlevel 1 (
  echo [ERROR] python not found. Install Python 3.11+
  goto :fail
)

echo [1/4] bun install ...
call bun install
if errorlevel 1 goto :fail

echo.
echo [2/4] pip install (excel-service) ...
python -m pip install -r "mini-services\excel-service\requirements.txt"
if errorlevel 1 goto :fail

echo.
echo [2b] Celery not installed (optional, needs Redis).
echo      For normal use run START.bat (in-process queue).

echo.
echo [3/4] Prisma / database ...
if exist ".zscripts\setup-db.cmd" (
  call ".zscripts\setup-db.cmd" nopause
) else (
  call bun run db:generate
  call bun run db:push
)

echo.
echo [4/4] Redis not required for START.bat (skipped).
echo      Optional Celery: pip install -r mini-services\excel-service\requirements-celery.txt

echo.
if not exist ".env.local" (
  echo  Optional: copy .env.example .env.local
)

echo.
echo  ========================================
echo   Done.
echo   Run:  START.bat  (no Redis, no Docker)
echo   Optional Celery: see START-Celery.bat
echo  ========================================
echo.
pause
exit /b 0

:fail
echo.
echo  Setup failed.
pause
exit /b 1
