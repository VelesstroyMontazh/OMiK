# Windows smoke: batch launchers, ports (RU/EN netstat), excel health, typecheck, lint
$ErrorActionPreference = "Continue"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$fail = @()

Write-Host "=== OMiK_VSM verify-windows ===" -ForegroundColor Cyan

function Invoke-CmdOk {
    param([string[]]$ScriptArgs)
    $cmdArgs = @('/c', 'call') + $ScriptArgs
    $p = Start-Process -FilePath 'cmd.exe' -ArgumentList $cmdArgs -WorkingDirectory $Root -Wait -PassThru -NoNewWindow
    return $p.ExitCode
}

# 0) Free ports first
$stopExit = Invoke-CmdOk @('STOP.bat', 'run')
if ($stopExit -ne 0) { $fail += "STOP.bat run exit $stopExit" }
else { Write-Host "[OK] STOP.bat run" -ForegroundColor Green }

Start-Sleep -Seconds 2

# 1) Batch syntax
foreach ($scriptArgs in @(
        @('.zscripts\stop-ports.cmd', 'silent'),
        @('.zscripts\port-busy.cmd', '3000'),
        @('.zscripts\check-ports.bat')
    )) {
    $code = Invoke-CmdOk $scriptArgs
    $label = $scriptArgs -join ' '
    if ($code -ne 0) {
        $fail += "cmd failed ($code): $label"
    } else {
        Write-Host "[OK] $label" -ForegroundColor Green
    }
}

# 2) TypeScript / ESLint
Write-Host "Running typecheck..." -ForegroundColor Yellow
& bun run typecheck
if ($LASTEXITCODE -ne 0) { $fail += "bun run typecheck failed" }
else { Write-Host "[OK] typecheck" -ForegroundColor Green }

& bun run lint
if ($LASTEXITCODE -ne 0) { $fail += "bun run lint failed" }
else { Write-Host "[OK] lint" -ForegroundColor Green }

# 3) Excel service + E2E health
Write-Host "Starting excel-service..." -ForegroundColor Yellow
& python .zscripts\start_excel_service.py --quiet
if ($LASTEXITCODE -ne 0) { $fail += "start_excel_service.py exit $LASTEXITCODE" }
else { Write-Host "[OK] start_excel_service.py" -ForegroundColor Green }

& python .zscripts\e2e_tickets_api.py --health-only
if ($LASTEXITCODE -ne 0) { $fail += "e2e --health-only failed" }
else { Write-Host "[OK] e2e /api/health" -ForegroundColor Green }

# 4) Python unit tests
Push-Location "$Root\mini-services\excel-service"
& python -m pytest tests/test_health_smoke.py tests/test_tickets_costs_dates.py -q
if ($LASTEXITCODE -ne 0) { $fail += "pytest smoke failed" }
else { Write-Host "[OK] pytest smoke" -ForegroundColor Green }
Pop-Location

Start-Process -FilePath 'cmd.exe' -ArgumentList @('/c', 'call', 'STOP.bat', 'run') -WorkingDirectory $Root -Wait -NoNewWindow | Out-Null

Write-Host ""
if ($fail.Count -eq 0) {
    Write-Host "ALL CHECKS PASSED" -ForegroundColor Green
    Write-Host "Launch: double-click START.bat, then http://127.0.0.1:3000"
    exit 0
}

Write-Host "FAILED:" -ForegroundColor Red
$fail | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
exit 1
