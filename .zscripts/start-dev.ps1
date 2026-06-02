# Next.js (3000) + excel-service (3031) + auto-open browser
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

if (-not (Test-Path "$Root\db")) { New-Item -ItemType Directory -Path "$Root\db" | Out-Null }
if (-not $env:DATABASE_URL) { $env:DATABASE_URL = "file:./db/custom.db" }
$env:EXCEL_BACKEND_URL = "http://127.0.0.1:3031"
$env:PORT = "3031"
$env:EXCEL_SERVICE_HOST = "127.0.0.1"

function Test-ExcelHealth {
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:3031/api/health" -UseBasicParsing -TimeoutSec 5
        if ($r.StatusCode -ne 200) { return $false }
        $body = $r.Content | ConvertFrom-Json
        return $body.status -eq "ok"
    } catch {
        return $false
    }
}

function Start-BrowserWhenReady {
    if ($env:OMIK_NO_BROWSER -eq "1") { return }
    $null = Start-Job -ScriptBlock {
        for ($i = 0; $i -lt 120; $i++) {
            Start-Sleep -Seconds 2
            try {
                $r = Invoke-WebRequest -Uri "http://127.0.0.1:3000" -UseBasicParsing -TimeoutSec 5
                if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) {
                    Start-Process "http://127.0.0.1:3000"
                    return
                }
            } catch {
                # Next.js still starting
            }
        }
    }
}

Write-Host "=== OMiK_VSM: starting services ===" -ForegroundColor Cyan

if (-not (Test-ExcelHealth)) {
    Write-Host "Starting excel-service (port 3031)..." -ForegroundColor Yellow
    Write-Host "  First start may take up to 90 sec." -ForegroundColor DarkGray
    $launcher = Join-Path $PSScriptRoot "start_excel_service.py"
    & python $launcher --force-restart
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] excel-service did not start on :3031" -ForegroundColor Red
        Write-Host "  Log: $Root\logs\excel-service.log" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "excel-service OK on :3031" -ForegroundColor Green
}

Write-Host "Starting Next.js on http://127.0.0.1:3000 ..." -ForegroundColor Green
Write-Host "  Browser opens automatically when Ready." -ForegroundColor DarkGray
Start-BrowserWhenReady
& bunx next dev -p 3000 -H 127.0.0.1
