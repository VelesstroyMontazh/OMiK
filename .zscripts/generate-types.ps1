# Regenerate TypeScript types from excel-service Pydantic models (quicktype).
# Requires: Node/npx, Python. Run from repo root: powershell -File .zscripts\generate-types.ps1
$ErrorActionPreference = 'Stop'
$Root = Split-Path $PSScriptRoot -Parent
Set-Location $Root

$py = @'
import json
from pathlib import Path
import sys
sys.path.insert(0, str(Path("mini-services/excel-service").resolve()))
from schemas import TicketsCostsLoadRequest, TicketsRegistryLoadRequest, ReportRequest
models = {
    "TicketsCostsLoadRequest": TicketsCostsLoadRequest.model_json_schema(),
    "TicketsRegistryLoadRequest": TicketsRegistryLoadRequest.model_json_schema(),
    "ReportRequest": ReportRequest.model_json_schema(),
}
out = Path(".zscripts/schemas-quicktype.json")
out.write_text(json.dumps(models, ensure_ascii=False, indent=2), encoding="utf-8")
print("Wrote", out)
'@

python -c $py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$env:NODE_TLS_REJECT_UNAUTHORIZED = '0'
npx --yes quicktype --lang ts --src-lang json .zscripts/schemas-quicktype.json -o src/types/excel-service-generated.ts
Write-Host "Done: src/types/excel-service-generated.ts"
