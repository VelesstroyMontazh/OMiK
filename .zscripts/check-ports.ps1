# Проверка занятости портов OMiK_VSM
$ports = @(3000, 3031, 81)
Write-Host "Порты OMiK_VSM:" -ForegroundColor Cyan
foreach ($p in $ports) {
  $conn = Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($conn) {
    $proc = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
    $name = if ($proc) { $proc.ProcessName } else { "PID $($conn.OwningProcess)" }
    Write-Host "  $p — ЗАНЯТ ($name)" -ForegroundColor Yellow
  } else {
    Write-Host "  $p — свободен" -ForegroundColor Green
  }
}
