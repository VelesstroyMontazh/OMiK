# What is verified automatically

On your PC:

```text
VERIFY.bat
```

or:

```powershell
cd C:\Otchet_OP_Marina\OMiK_VSM
bun run verify:win
```

## Covered on Windows

| Check | Notes |
|-------|--------|
| `STOP.bat run` | Same as double-click, without spawning a second window |
| `stop-ports.cmd` | Ports 3000, 3031, 81; EN/RU `netstat` |
| `port-busy.cmd` / `check-ports.bat` | Only **local LISTENING**, not remote `:3000` in ESTABLISHED |
| `bun run typecheck` | TypeScript |
| `bun run lint` | ESLint |
| `start_excel_service.py` | Starts :3031 if needed |
| `e2e_tickets_api.py --health-only` | HTTP smoke on running excel-service |
| `pytest` smoke | health + date helpers |

## Manual (your machine only)

| Check | How |
|-------|-----|
| Double-click `START.bat` / `STOP.bat` in Explorer | Window must stay open (`cmd /k` via `open-console.cmd`) |
| See `Ready` and open UI | http://127.0.0.1:3000 |
| Cyrillic shortcuts | `ЗАПУСК.bat` → `START.bat`, `СТОП.bat` → `STOP.bat` |
| Kaspersky / corporate policy | Exclude project folder if blocked |
| Full tickets E2E (large xlsm) | `python .zscripts\e2e_tickets_api.py --background` |

## Runtime defaults

- No Docker
- No Redis / Celery unless `OMIK_USE_CELERY=1`
- Background jobs: in-process (`backend: "inprocess"`)
