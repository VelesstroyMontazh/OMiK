# Next.js + excel-service + Celery worker (нужен Redis на :6379)
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

function Import-EnvLocal {
    $envFile = Join-Path $Root ".env.local"
    if (-not (Test-Path $envFile)) { return }
    Get-Content $envFile -Encoding UTF8 | ForEach-Object {
        $line = $_.Trim()
        if (-not $line -or $line.StartsWith("#")) { return }
        $idx = $line.IndexOf("=")
        if ($idx -lt 1) { return }
        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim().Trim('"').Trim("'")
        Set-Item -Path "Env:$key" -Value $val
    }
}

Import-EnvLocal

if (-not (Test-Path "$Root\db")) { New-Item -ItemType Directory -Path "$Root\db" | Out-Null }
if (-not $env:DATABASE_URL) { $env:DATABASE_URL = "file:./db/custom.db" }
if (-not $env:EXCEL_BACKEND_URL) { $env:EXCEL_BACKEND_URL = "http://127.0.0.1:3031" }
$env:OMIK_USE_CELERY = "1"
if (-not $env:CELERY_BROKER_URL) { $env:CELERY_BROKER_URL = "redis://127.0.0.1:6379/0" }

Write-Host "=== OMiK_VSM: запуск с Celery + Redis ===" -ForegroundColor Cyan

Write-Host "Проверка Redis..." -ForegroundColor Yellow
& python "$PSScriptRoot\check-redis.py"
if ($LASTEXITCODE -ne 0) { exit 1 }

$excelCmd = Join-Path $PSScriptRoot "start-excel-service-celery.cmd"
$celeryCmd = Join-Path $PSScriptRoot "start-celery-worker.cmd"

Write-Host "Запуск Excel API (отдельное окно)..." -ForegroundColor Green
Start-Process cmd.exe -ArgumentList "/k", "`"$excelCmd`"" -WorkingDirectory $Root

Start-Sleep -Seconds 3

Write-Host "Запуск Celery worker (отдельное окно)..." -ForegroundColor Green
Start-Process cmd.exe -ArgumentList "/k", "`"$celeryCmd`"" -WorkingDirectory $Root

Start-Sleep -Seconds 2

Write-Host "Запуск Next.js на http://127.0.0.1:3000 ..." -ForegroundColor Green
Write-Host "(Остановка: СТОП.bat + закройте окна Excel и Celery)" -ForegroundColor DarkGray
bunx next dev -p 3000 -H 127.0.0.1
