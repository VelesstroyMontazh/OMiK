# Создаёт mini-services/excel-service/requirements.lock из requirements.txt
# в изолированном venv (не весь conda).
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
$svc = Join-Path $root "mini-services\excel-service"
$venv = Join-Path $svc ".venv-lock"
$req = Join-Path $svc "requirements.txt"
$lock = Join-Path $svc "requirements.lock"

if (-not (Test-Path $req)) { throw "Not found: $req" }

if (Test-Path $venv) { Remove-Item -Recurse -Force $venv }
python -m venv $venv
& (Join-Path $venv "Scripts\python.exe") -m pip install -q --upgrade pip
& (Join-Path $venv "Scripts\pip.exe") install -r $req
& (Join-Path $venv "Scripts\pip.exe") freeze | Set-Content -Encoding utf8 $lock
Write-Host "Written: $lock"
