# Остановить все процессы на порту 3031 (включая «зависшие» worker после uvicorn)
$Port = 3031
$pids = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

if (-not $pids) {
    Write-Host "Порт $Port свободен."
    exit 0
}

foreach ($procId in $pids) {
    Write-Host "Останавливаем PID $procId ..."
    Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 2
$still = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
if ($still) {
    Write-Host "Порт $Port всё ещё занят. Завершите процессы Python вручную в диспетчере задач."
    exit 1
}

Write-Host "Порт $Port освобождён. Запуск: .\.zscripts\start-excel-service.cmd"
exit 0
