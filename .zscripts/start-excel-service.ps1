# Запуск excel-service на 3031 (в фоне, без дублирования)
# При блокировке Kaspersky («PowerShell из JScript») используйте:
#   .\.zscripts\start-excel-service.cmd
#   python .\.zscripts\start_excel_service.py
$ErrorActionPreference = "Stop"
$Port = 3031
$Root = Split-Path $PSScriptRoot -Parent
$ServiceDir = Join-Path $Root "mini-services\excel-service"

function Test-ExcelHealth {
    try {
        $r = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/api/health" -TimeoutSec 3
        return $r.status -eq "ok"
    } catch {
        return $false
    }
}

if (Test-ExcelHealth) {
    Write-Host "Excel-service уже работает (http://127.0.0.1:$Port, health: ok)."
    exit 0
}

if (-not (Test-ExcelHealth)) {
    $pids = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
        Select-Object -ExpandProperty OwningProcess -Unique
    foreach ($procId in $pids) {
        Write-Host "Порт $Port занят PID $procId — останавливаем..."
        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
}

Write-Host "Запуск excel-service в фоне..."
$env:UVICORN_WORKERS = "1"
Start-Process -FilePath "python" -ArgumentList "app.py" -WorkingDirectory $ServiceDir -WindowStyle Normal

for ($i = 1; $i -le 30; $i++) {
    if (Test-ExcelHealth) {
        Write-Host "Готово: http://127.0.0.1:$Port/api/health"
        exit 0
    }
    Start-Sleep -Seconds 1
}

Write-Host "Сервис не ответил за 30 с. Проверьте окно Python на ошибки."
exit 1
