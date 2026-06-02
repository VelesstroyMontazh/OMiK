# Локальный запуск OMiK_VSM

## Для пользователей

**Читайте сначала:** [ЗАПУСК.md](../ЗАПУСК.md) в корне проекта — пошагово: что запускать, куда жать, какой адрес в браузере.

**Быстрый запуск Windows:** см. **[LAUNCH.md](../LAUNCH.md)** — `INSTALL.bat` → `STOP.bat` → `START.bat` → http://127.0.0.1:3000

---

## Технические детали

### Порты

| Сервис        | Порт | URL |
|---------------|------|-----|
| Интерфейс     | 3000 | http://127.0.0.1:3000 |
| Excel API     | 3031 | http://127.0.0.1:3031/api/health |
| Caddy (опц.)  | 81   | http://127.0.0.1:81 |

### Переменные окружения

См. `.env.example` → скопировать в `.env.local`

### Данные

`%LOCALAPPDATA%\OMiK_VSM\data` (переменная `OMIK_DATA_DIR`)

Подробнее: [DATA_LAYER.md](./DATA_LAYER.md)

### Очередь задач (долгие операции)

**По умолчанию (без Docker, без Redis, бесплатно):** in-process очередь в excel-service.

`POST /api/tickets-costs/process?background=true` → `{ job_id, backend: "inprocess" }`, статус: `GET /api/jobs/{job_id}`.

**Опционально Celery + Redis** — только при `OMIK_USE_CELERY=1` и локальном Redis (`requirements-celery.txt`). См. [ЗАПУСК-Celery.md](../ЗАПУСК-Celery.md).


```bash
bun run typecheck   # TypeScript
bun run lint        # ESLint (src/)
bun run test:python # unit + e2e (skip if service/file missing)
bun run e2e:tickets # CLI load→process (excel-service must run; large xlsm = minutes)
python .zscripts/e2e_tickets_api.py --background   # process via job queue + poll
python .zscripts/e2e_tickets_api.py --skip-load      # only process if load already done
cd mini-services/excel-service && python -m pytest tests/ -q
```

### Скрипты

| Файл | Назначение |
|------|------------|
| `INSTALL.bat` | Установка (один раз) |
| `START.bat` | Запуск |
| `STOP.bat` | Остановка портов |
| `VERIFY.bat` | Проверка (typecheck, lint, API) |
| `LAUNCH.md` | Инструкция |
| `ЗАПУСК.bat` | То же, что `START.bat` |
| `.zscripts\start-dev.ps1` | То же из PowerShell |
| `.zscripts\start-excel-service.cmd` | Только Python API |
| `.zscripts\check-ports.ps1` | Проверка портов |

### Безопасность

По умолчанию сервисы слушают **127.0.0.1** (только этот компьютер). CORS — localhost.

Опционально: `OMIK_API_SECRET` в `.env.local` — требует заголовок `X-OMIK-Token` на `/api/excel/*` и FastAPI.
