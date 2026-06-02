# Dependency audit: npm audit (node_modules) + optional Python safety
$ErrorActionPreference = 'Continue'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

Write-Host '=== npm audit (moderate+) ===' -ForegroundColor Cyan
if (-not (Test-Path 'package-lock.json')) {
  Write-Host 'Creating package-lock.json for audit (package-lock-only)...' -ForegroundColor DarkGray
  npm i --package-lock-only --ignore-scripts 2>&1 | Out-Null
}
if (Test-Path 'package-lock.json') {
  npm audit --audit-level=moderate
  if ($LASTEXITCODE -gt 0) { $script:AuditFailed = $true }
} else {
  Write-Host 'Could not create package-lock.json — run: bun install' -ForegroundColor Yellow
  $script:AuditFailed = $true
}

$PyLock = Join-Path $Root 'mini-services\excel-service\requirements.lock'
if (Test-Path $PyLock) {
  Write-Host ''
  Write-Host '=== pip audit (excel-service, optional) ===' -ForegroundColor Cyan
  $pipAudit = Get-Command pip-audit -ErrorAction SilentlyContinue
  if ($pipAudit) {
    Push-Location (Join-Path $Root 'mini-services\excel-service')
    pip-audit -r requirements.lock -q
    Pop-Location
    if ($LASTEXITCODE -gt 0) { $script:AuditFailed = $true }
  } else {
    Write-Host 'pip-audit not installed (pip install pip-audit)' -ForegroundColor DarkGray
  }
}

if ($script:AuditFailed) { exit 1 }
exit 0
