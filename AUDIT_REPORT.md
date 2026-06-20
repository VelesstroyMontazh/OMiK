# Полный аудит проекта OMiK-main

> **Проект:** OMiK («Отдел мобилизации и координации персонала») — корпоративный HR/учётный инструмент ООО «ВелесстройМонтаж».
> **Стек:** Next.js 16 (App Router) + React 19 + TypeScript + Prisma (SQLite) + Python FastAPI (excel-service на :3031) + опционально Caddy/Celery/Redis.
> **Целевая платформа:** Windows 11 Pro 64-bit, БЕЗ прав администратора, БЕЗ Docker, только бесплатное/opensource-ПО.
> **Дата аудита:** 2025
> **Аудиторы:** 5 параллельных суб-агентов (Python, Backend API, Frontend, Configs/Deploy, Docs) + главный оркестратор.

---

## Содержание

1. [Краткое резюме (TL;DR)](#1-краткое-резюме)
2. [Архитектурный обзор проекта](#2-архитектурный-обзор)
3. [Сводная таблица находок по критичности](#3-сводная-таблица)
4. [КРИТИЧЕСКИЕ уязвимости (Critical)](#4-critical)
5. [Высокий уровень (High)](#5-high)
6. [Средний уровень (Medium)](#6-medium)
7. [Низкий и информационный уровень (Low/Info)](#7-lowinfo)
8. [Совместимость с Windows 11 (без админа, без Docker)](#8-windows-11)
9. [Отклонения от документации](#9-spec-deviations)
10. [Рекомендуемый план исправлений (приоритизированный)](#10-improvement-plan)
11. [Конкретные улучшения кода и конфигов](#11-concrete-fixes)
12. [Чек-лист «запустится ли на Windows 11 без админа»](#12-checklist)
13. [Приложения — детальные находки по файлам](#13-appendix)

---

## 1. Краткое резюме

**Вердикт по запуску на Windows 11:** 🟡 **Да, запустится — но только после устранения 4–6 критических блокеров.** Архитектура Next.js + FastAPI на localhost 3000/3031 — разумная для single-user localhost-приложения, кроссплатформенные пути в `data_paths.py` сделаны правильно (`%LOCALAPPDATA%\OMiK_VSM\data`), Docker/admin/Redis не требуются (используется in-process queue). Однако в текущем виде проект **нельзя считать production-ready** из-за серьёзных проблем безопасности и гигиены репозитория.

**Топ-5 критических проблем:**

| # | Проблема | Где | Влияние |
|---|---|---|---|
| 🔴 1 | **RCE через `/api/macro/execute`** — `exec(code, {"__builtins__": {}}, ns)` не является песочницей; через `pandas._libs.lib.__builtins__` восстанавливается `__import__`, `open`, `subprocess` | `mini-services/excel-service/macro_engine.py:422` | Любой локальный процесс может выполнить произвольный Python-код от имени пользователя |
| 🔴 2 | **Авторизация опциональна и выключена по умолчанию** — `OMIK_API_SECRET` пустой → все эндпоинты открыты | `auth_middleware.py:14-16`, `src/middleware.ts` | В сочетании с #1 = полная компрометация системы |
| 🔴 3 | **Path traversal по ~20 эндпоинтам** — `safe_resolve_path()` определён, но нигде не вызывается; проверяется только `os.path.exists()` | `app.py` (все эндпоинты с `file_path`) | Чтение/модификация/удаление любого Excel-файла на диске |
| 🔴 4 | **Хардкод пароля `admin2606` в браузерном бандле** + **`NEXT_PUBLIC_OMIK_API_SECRET`** раскрывает общий секрет в JS | `src/lib/settings-password.ts:1`, `src/lib/excel-backend-direct.ts:11` | Любой посетитель страницы читает пароль и токен в DevTools |
| 🔴 5 | **`.gitignore` сломан** (обёрнут в markdown-коды ` ``` `) + в репозитории лежат: 4.7 МБ чат-лог с PII, `Log_pass_role.xlsx` с реальным паролем `Admin2606`, `db/custom.db`, `__pycache__/`, dev-пути `C:\Otchet_OP_Marina\…` | корень репозитория | Утечка персональных данных (152-ФЗ/GDPR), неработающий `bun install` на новой машине |

**Всего находок: 197**
- Critical: 23
- High: 35
- Medium: 70
- Low/Info: 69

**Позитивные моменты (что сделано хорошо):**
- ✅ Кроссплатформенный выбор директории данных (`data_paths.py`).
- ✅ In-process fallback очереди задач — не требует Redis.
- ✅ Сервисы слушают только `127.0.0.1` (по умолчанию).
- ✅ Pre-commit инфраструктура (Husky + lint-staged + detect-secrets).
- ✅ CI на Ubuntu с Bun + Python 3.12, security-audit через `bun pm audit` и `pip-audit`.
- ✅ Pydantic-схемы на большинстве эндпоинтов Python-сервиса.
- ✅ Хеширование bcrypt (хоть и с fallback на plaintext).
- ✅ Cyrillic-алиасы `УСТАНОВКА.bat`/`ЗАПУСК.bat` — однострочные обёртки над EN-аналогами.

---

## 2. Архитектурный обзор

```
┌────────────────────────────────────────────────────────────────────┐
│                  Браузер пользователя (Edge/Chrome)                 │
│                                                                     │
│  Next.js client (React 19)  ──── POST /api/excel/*  ────┐           │
│  - HomePageClient                                         │           │
│  - WelcomeModuleCard ×13 (большинство — placeholder)     │           │
│  - SpreadsheetGrid, MainDatabasePanel (до 250 000 строк!)│           │
│  - VbaLaboratoryPanel, MacroEditor                       │           │
│  - SettingsPanel (пароль admin2606 в бандле)             │           │
│                                                          ▼           │
└────────────────────────────────────────────────────────────────────┘
                                                          │
                                                          ▼
┌────────────────────────────────────────────────────────────────────┐
│  Next.js 16 (App Router, порт 3000, dev-mode через START.bat)      │
│                                                                     │
│  src/middleware.ts  →  проверка X-OMIK-Token (только /api/excel/*)  │
│  src/app/api/excel/*/route.ts (≈30 роутов) — тонкие прокси          │
│  src/lib/backend-proxy.ts  →  fetch(EXCEL_BACKEND_URL + path)      │
│  src/lib/excel-backend-direct.ts → клиентский прямой путь к :3031   │
│  src/lib/db.ts → Prisma (SQLite, db/custom.db) — только метаданные  │
└────────────────────────────────────────────────────────────────────┘
                                                          │
                                                          ▼
┌────────────────────────────────────────────────────────────────────┐
│  Python FastAPI excel-service (порт 3031)                           │
│                                                                     │
│  app.py (≈2000 строк, ~30 эндпоинтов)                              │
│  auth_middleware.py (опциональный токен)                            │
│  routers/{jobs,daily,references}.py                                 │
│  main_db.py + main_db_registry.py (инстансы основных БД)            │
│  tickets_db.py / tickets_costs.py / calendar_db.py                  │
│  daily_tracking.py / daily_validation.py                            │
│  references.py (читает Log_pass_role.xlsx, bcrypt + plaintext)      │
│  macro_engine.py (exec/eval — НЕ песочница!)                        │
│  vba_lab.py / excel_handler.py / data_ops.py / reports.py           │
│  data_paths.py → %LOCALAPPDATA%\OMiK_VSM\data\                     │
│  task_queue.py (in-process) | celery_app.py (опц. при OMIK_USE_CELERY=1) │
└────────────────────────────────────────────────────────────────────┘
                                                          │
                                                          ▼
┌────────────────────────────────────────────────────────────────────┐
│  SQLite-файлы в %LOCALAPPDATA%\OMiK_VSM\data\                      │
│  - main_db.sqlite (113 000+ сотрудников)                            │
│  - tickets_registry_*.sqlite, tickets_costs_*.sqlite                │
│  - calendar_db.sqlite, daily_tracking.sqlite                        │
│  - instances/<id>/main_db.sqlite (инстанс-реестр)                   │
│  - upload/ (загруженные Excel-файлы)                                │
└────────────────────────────────────────────────────────────────────┘
```

**Дополнительные компоненты (опциональные):**
- **Caddy** на :81 (опциональный шлюз для `XTransformPort`-паттерна; бинарник НЕ bundled).
- **Celery + Redis** при `OMIK_USE_CELERY=1` (фактически неработоспособно на Windows без Docker — см. §8).

**Prisma-схема (5 моделей, фактически только метаданные):**
`ExcelFile`, `Macro`, `MacroRun`, `Operation`, `MainDatabase` (legacy). Все бизнес-данные живут в Python-SQLite — Prisma-аудиторы их не увидят.

---

## 3. Сводная таблица находок

| Категория | Critical | High | Medium | Low/Info | Всего |
|-----------|----------|------|--------|----------|-------|
| Python excel-service (`mini-services/excel-service/`) | 7 | 6 | 25 | 25 | 63 |
| Next.js backend API + lib (`src/app/api/`, `src/lib/`) | 7 | 13 | 22 | 20 | 67 (включая 5 архитектурных) |
| Next.js frontend (`src/app/`, `src/components/`) | 4 | 6 | 11 | 22 | 43 |
| Конфиги/деплой/скрипты (`*.json`, `.zscripts/`, `*.bat`) | 8 | 9 | 12 | 14 | 43 |
| Документация (отклонения от doc3) | — | — | — | 18 | 18 |
| **ИТОГО** | **23 (+4 критических блока Windows)** | **35** | **70** | **69 (+18)** | **~197** |

---

## 4. КРИТИЧЕСКИЕ уязвимости (Critical)

### 🔴 C-Python-1 — RCE через `/api/macro/execute`
**Файл:** `mini-services/excel-service/macro_engine.py:422` (вызов из `app.py:884-901`)

`PythonMacroExecutor.execute()` делает:
```python
exec(code, {"__builtins__": {}}, namespace)
```
где в `namespace` есть `pandas`, `openpyxl`, `excel_libs`, `wb`, `ws`. Пустой `__builtins__` **не является песочницей** — через `pd._libs.lib.__builtins__` или `().__class__.__base__.__subclasses__()` восстанавливаются `__import__`, `open`, `subprocess`. Любой пользователь (или любой локальный процесс при выключенной авторизации — см. C-Python-3) выполняет **произвольный код от имени пользователя Windows**.

**Исправление:**
1. Полностью убрать `language="python"` из публичного API, **ИЛИ**
2. Запускать пользовательский код в отдельном subprocess-песочнице (Windows: `AppContainer` / restricted token / Job Object + ограниченный ACL на запись только в рабочий каталог), без сети, без доступа вне разрешённых директорий.
3. Минимум: требовать авторизованную **admin-роль** + per-request confirmation-токен для `language="python"`.

### 🔴 C-Python-2 — `eval()` в VBA-парсере
**Файл:** `macro_engine.py:287`

`VBAParser._eval_expr` вызывает `eval(eval_expr, {"__builtins__": {}}, {})` после подстановки значений переменных. Даже с ограничением на арифметику путь хрупок, классический escape: `().__class__.__base__.__subclasses__()`.

**Исправление:** Заменить на `ast.parse(..., mode="eval")` + `ast.NodeVisitor` с whitelist-ом узлов (`BinOp`, `Constant`, `Name`, `UnaryOp`).

### 🔴 C-Python-3 — Авторизация опциональна и выключена по умолчанию
**Файл:** `auth_middleware.py:14-16`
```python
secret = os.environ.get("OMIK_API_SECRET", "").strip()
if not secret or request.url.path == "/api/health":
    return await call_next(request)
```

`.env.example` содержит `OMIK_API_SECRET=...` закомментированным. В сочетании с C-Python-1 и C-Python-4 — любой браузерный tab или локальный процесс может читать/модифицировать любые Excel-файлы пользователя и выполнять произвольный код.

**Исправление:**
1. Отказаться запускать сервис, если `OMIK_API_SECRET` пустой (или авто-генерировать и логировать).
2. Требовать авторизацию на всём, кроме `/api/health`.
3. Per-route role checks для чувствительных эндпоинтов (макросы, upload reference-ов, удаление инстансов, backup/restore).

### 🔴 C-Python-4 — Path traversal: `safe_resolve_path()` определён, но НИГДЕ не вызывается
**Файл:** `app.py:54-78` (определение) → не используется в ~20 эндпоинтах (`/api/sheet-data`, `/api/sheet-update`, `/api/sort`, `/api/filter`, `/api/find-replace`, `/api/pivot`, `/api/merge-cells`, `/api/format-cells`, `/api/insert-rows-cols`, `/api/delete-rows-cols`, `/api/convert`, `/api/macro/execute`, `/api/macro/list`, `/api/vba-laboratory/{detect,import}`, `/api/analyze`, `/api/sheet-info`, `/api/tickets-registry/load`, `/api/tickets-costs/{load,pipeline}`, `/api/file-prepare/process`, `/api/integration/calendar/load-by-path`, `/api/merge/{scan-folder,execute}`).

Все они принимают `file_path` (или `file_paths[]`, или `folder_path`) из запроса и проверяют только `os.path.exists()`. Большинство операций **модифицируют файл на месте** (`wb.save(file_path)`). `/api/merge/scan-folder` может листать любые каталоги. `/api/convert` пишет рядом с исходным. В сочетании с C-Python-3 — любой локальный процесс может читать/портить любые Excel-файлы пользователя.

**Исправление:**
1. В начале каждого эндпоинта вызывать `safe_resolve_path(request.file_path)`, возвращать 403 при выходе за пределы `ALLOWED_BASE_DIRS`.
2. Добавить `MAIN_DB_DIR` и `INSTANCES_DIR` в `ALLOWED_BASE_DIRS` если эти пути должны быть допустимы.
3. Для `tickets_costs.load_raw_files` валидировать каждый элемент `file_paths` против `ALLOWED_BASE_DIRS` до вызова `_resolve_input_path`.
4. Для `/api/merge/scan-folder` ограничить только `UPLOAD_DIR` (и его подкаталогами).

### 🔴 C-Python-5 — Удаление произвольной директории через `DELETE /api/main-db/instances/{instance_id}`
**Файл:** `main_db_registry.py:224-235` (через `app.py:1192-1203`)

`instance_id` берётся из URL, `instance_dir(instance_id) = os.path.join(INSTANCES_DIR, instance_id)` без нормализации. Запрос `DELETE /api/main-db/instances/..%2F..%2F..%2FOMiK_VSM` вычислит путь вне `INSTANCES_DIR`, после чего `shutil.rmtree(folder, ignore_errors=True)` попытается удалить всё внутри. На Windows без admin это ограничено файлами пользователя, но **документы пользователя, проектные данные — всё под ударом**. Тот же `instance_id` используется в `verify_instance`, `export_instance_to_excel`, `activate_instance` — все path-traversable.

**Исправление:**
1. `re.fullmatch(r"[\w\-]+", instance_id)` → отбрасывать `/`, `\`, `..`.
2. `instance_dir(id).resolve()` и assert что строго под `INSTANCES_DIR.resolve()`.
3. Применить ту же проверку во всех функциях реестра.

### 🔴 C-Python-6 — Перезапись файла авторизации `/api/references/upload/login`
**Файл:** `routers/references.py:69-93` (+ `references.py:118-153, 161-204`)

`POST /api/references/upload/login` принимает любой `UploadFile`, сохраняет в `references_dir()/Login_Pass_Status.xlsx` без авторизации (см. C-Python-3), без лимита размера, без проверки magic-bytes. `references.verify_user` читает этот же файл при каждом логине. Атакующий может:
- подменить файл credentials на свой с `admin/password` plaintext,
- подменить на bcrypt-хэш, который он знает,
- подсунуть битый файл (DoS авторизации).

Plain-text пароли официально поддерживаются в `verify_user` (ветка `if stored_password == password: return u`), сравнение non-constant-time.

**Исправление:**
1. Требовать admin-роль для любого reference-upload.
2. Валидировать размер (≤1 МБ) и magic-bytes (`PK\x03\x04`) перед сохранением.
3. Отказаться от plain-text паролей — только bcrypt-хэши.
4. `hmac.compare_digest` для любых неизбежных plaintext-сравнений (в идеале — удалить plaintext-ветку).

### 🔴 C-Python-7 — `find_file_by_id` использует `startswith` (prefix matching)
**Файл:** `excel_handler.py:703-709`
```python
for filename in os.listdir(UPLOAD_DIR):
    if filename.startswith(file_id):
        return os.path.join(UPLOAD_DIR, filename)
```
`file_id="a"` матчит все файлы на `a`; `file_id=""` возвращает первый в директории. Используется в `/api/file/{file_id}` GET/DELETE, `/api/download/{file_id}`, `/api/sheet-data`, `/api/sheet-info`, косвенно — во множестве других.

**Исправление:** Матчить `filename == f"{file_id}.{ext}"` или `os.path.splitext(filename)[0] == file_id`; отбрасывать пустой `file_id`.

---

### 🔴 C-Backend-1 — Хардкод пароля `admin2606` в браузерном бандле
**Файл:** `src/lib/settings-password.ts:1`
```ts
export const SETTINGS_PASSWORD = 'admin2606'
```
Импортируется клиентскими компонентами (`SettingsPanel.tsx`, `SettingsDialog.tsx`). Проверка `value.trim() === SETTINGS_PASSWORD` принимает trailing-whitespace — ещё сильнее снижает энтропию. Без rate-limit и lockout.

**Исправление:**
1. Убрать константу из клиента.
2. Перенести проверку в server-action/API-route.
3. Хранить солёный+перечный хэш в БД или `.env.local`, сравнивать через `crypto.timingSafeEqual` над равными по длине буферами.
4. Требовать авторизованную сессионную куку для вызова; rate-limit per IP.

### 🔴 C-Backend-2 — `NEXT_PUBLIC_OMIK_API_SECRET` раскрывает общий секрет в браузере
**Файлы:** `src/lib/excel-backend-direct.ts:11-12`, `src/hooks/excel-api/files.ts:65`, потребители в `src/hooks/excel-api/{files,jobs,health,tickets}.ts`

При `NEXT_PUBLIC_OMIK_DIRECT_UPLOAD=1` (рекомендуется в `.env.example`) браузер обращается напрямую к `:3031` с заголовком `X-OMIK-Token`, взятым из `process.env.NEXT_PUBLIC_OMIK_API_SECRET`. Префикс `NEXT_PUBLIC_` инлайнит значение в JS-бандл. Любой может вытащить токен и обойти авторизацию Python-сервиса с любого вкладки/процесса.

**Исправление:**
1. Никогда не экспортировать API-секрет в клиент.
2. Загружать большие файлы через server-side route, который добавляет токен (расширить `src/app/api/excel/upload/route.ts` чтобы стримить `request.body` на бэкенд).
3. Удалить `NEXT_PUBLIC_OMIK_API_SECRET` из `.env*` и из всего клиентского кода.

### 🔴 C-Backend-3 — Timing-unsafe сравнение токена
**Файл:** `src/lib/api-auth.ts:22`
```ts
if (token !== secret) return new NextResponse("...", { status: 401 })
```
Python-сторона правильно использует `hmac.compare_digest`, а Next.js middleware — короткозамкнутое `!==`. На localhost реальный риск низкий, но несогласованность.

**Исправление:** `crypto.timingSafeEqual(Buffer.from(token), Buffer.from(secret))` (Node.js `crypto`).

### 🔴 C-Backend-4 — Неавторизованная RCE-поверхность (макросы/VBA)
**Файлы:** `src/app/api/excel/macro/route.ts`, `src/app/api/excel/vba-laboratory/route.ts`

Принимают пользовательский VBA/Python код и форвардят на выполнение. В дефолт-конфигурации (без `OMIK_API_SECRET`) — любой в сети (если когда-нибудь слушать 0.0.0.0) или любой локальный процесс может выполнить произвольный код на Windows-хосте.

**Исправление:** См. C-Python-1 + ввести серверную авторизацию.

### 🔴 C-Backend-5 — Неавторизованный upload до 250 МБ
**Файлы:** `next.config.ts:11` (`proxyClientMaxBodySize: "250mb"`), `src/app/api/excel/upload/route.ts`

Нет MIME-проверки, нет per-route size cap, нет авторизации, нет rate-limit. Тривиальный disk-fill DoS против `C:\Otchet_OP_Marina\OMiK_VSM\upload` (или `%LOCALAPPDATA%\OMiK_VSM\data\upload`).

**Исправление:** Per-route `Content-Length` чек перед чтением body, magic-bytes валидация, auth+rate-limit.

### 🔴 C-Backend-6 — SSRF / open-proxy risk через `EXCEL_BACKEND_URL`
**Файл:** `src/lib/backend-proxy.ts`

`EXCEL_BACKEND_URL` конкатенируется с пользовательскими путями без host-allow-list и без проверки что `path` начинается с `/api/`. Если env когда-нибудь будет сконфигурирован криво (например, на cloud-metadata IP `169.254.169.254`) — exfiltration.

**Исправление:** Жёстко проверить что URL-хост = `127.0.0.1` / `localhost`; `path` начинается с `/api/`.

### 🔴 C-Backend-7 — Логин без rate-limit/lockout; роль/sites из sessionStorage (forgeable)
**Файл:** `src/app/api/excel/auth/login/route.ts`, `src/lib/app-auth.ts`

Brute-forceable; возвращаемая роль/sites пользователя хранятся в `sessionStorage` как plaintext JSON — XSS или ручная правка = privilege escalation.

**Исправление:**
1. Серверные сессии: подписанная HttpOnly cookie на `/api/auth/login`.
2. Per-IP rate-limit (10 req/min).
3. Роль/sites брать из серверного источника на каждый запрос, не из sessionStorage.

---

### 🔴 C-Frontend-1 — Нет `error.tsx` / `loading.tsx` / `not-found.tsx` / `global-error.tsx`
**Файл:** `src/app/` (вся директория)

Любой необработанный runtime error = дефолтная красная страница Next.js. Нет loading-skeleton, нет локализованной 404.

**Исправление:** Добавить `error.tsx`, `global-error.tsx`, `loading.tsx`, `not-found.tsx` (можно переиспользовать существующий `LoadingOverlay`).

### 🔴 C-Frontend-2 — `MainDatabasePanel` рендерит до 250 000 строк без виртуализации
**Файл:** `src/components/excel/MainDatabasePanel.tsx:34, 350-353, 644`

`PAGE_SIZE_MAX = 250_000`. В режиме `loadAllMode` — `visibleData = data.filter(...)` по всему массиву, затем `<tbody>{visibleData.map(...)}` создаёт DOM-узлы под каждую строку. Edge на Windows 11 упадёт по OOM.

**Исправление:**
1. `@tanstack/react-virtual` (или `react-window`) для виртуализации строк.
2. Снизить `PAGE_SIZE_MAX` до 10 000, предупреждать перед загрузкой большего.

---

### 🔴 C-Config-1 — `.gitignore` сломан markdown-кодами
**Файл:** `.gitignore` (5 строк обёрнуты в ` ``` `)

Только `!.github/workflows/` — реальное правило. Всё остальное (`node_modules/`, `.next/`, `__pycache__/`, `*.log`, `*.sqlite`, `*.db`, `.env.local`, `dev.log`, `server.log`, `download/`, `agent-ctx/`) **не игнорируется**. Корневая причина множества гигиен-проблем.

**Исправление:** Переписать `.gitignore` как стандартный Node/Next.js/Python; убрать тройные backticks.

### 🔴 C-Config-2 — 4.7 МБ чат-лог `ЛОГ_ЧАТА.txt` с PII в репозитории
**Файл:** `ЛОГ_ЧАТА.txt` (4 797 593 байт)

Содержит Windows-username `derevyankoga`, полные MCP tool-call JSON, схему персональных данных сотрудников, абсолютные пути `C:\Otchet_OP_Marina\…`. Возможное нарушение 152-ФЗ / GDPR.

**Исправление:** `git rm --cached ЛОГ_ЧАТА.txt`; добавить `*.txt` (селективно) в `.gitignore`; scrub history через `git filter-repo` если репозиторий публичный.

### 🔴 C-Config-3 — Реальные producton-credentials в `download/Log_pass_role.xlsx`
**Файл:** `download/Log_pass_role.xlsx` (10 906 байт) + дубликат в `OMiK/download/`

В `xl/sharedStrings.xml`: `Admin`, `Admin2606`, реальные названия площадок `Norilsk_Dikson`, `Sber_32`, `Sochi-2`, `Ust-Luga_Kareliya`, `ЦОК`, `Одинцово`, `Винный_город`. `references.py:353` читает файл при каждом логине; пароли хранятся plaintext. Любой, кто клонировал репо, уже залогинен.

**Исправление:**
1. `git rm --cached download/Log_pass_role.xlsx OMiK/download/Log_pass_role.xlsx`.
2. На первом запуске `INSTALL.bat` должен создавать пустой шаблон `Log_pass_role.xlsx`.
3. Хешировать все пароли через bcrypt.
4. Ротировать слитый `Admin2606`.

### 🔴 C-Config-4 — `bun.lock` рассинхронизирован с `package.json`
**Файл:** `bun.lock` (328 КБ)

- 9 пакетов в `bun.lock` отсутствуют в `package.json`: `@dnd-kit/*`, `@mdxeditor/editor`, `next-auth`, `next-intl`, `react-markdown`, `react-syntax-highlighter`, **`z-ai-web-dev-sdk`** (палится, что lockfile скоммичен из sandbox vibe-coding!).
- 6 пакетов из `package.json` отсутствуют в `bun.lock`: `@playwright/test`, `@types/node`, `husky`, `lint-staged`, `vitest`, **`xlsx`**.
- `@prisma/client` `^6.11.1` в lock vs `^6.19.3` в package.json.

**Исправление:** Удалить `bun.lock`, регенерировать через `bun install` из канонического `package.json`. Коммитить только ОДИН lockfile.

### 🔴 C-Config-5 — Одновременно `bun.lock` AND `package-lock.json`
**Файлы:** `bun.lock` (328 КБ), `package-lock.json` (399 КБ, lockfileVersion 3)

Конкурирующие lockfiles. CI использует `bun install`, а `audit-deps.ps1` тихо регенерирует `package-lock.json` через `npm i --package-lock-only`. Каждый CI/dev запуск может менять состояние репо.

**Исправление:** Выбрать ОДИН пакетный менеджер (рекомендуется `bun`). Удалить `package-lock.json`. В `audit-deps.ps1` использовать `bun pm audit` или временный lockfile.

### 🔴 C-Config-6 — `__pycache__/`, `*.pyc`, пустой `excel_service.log`, `db/custom.db` в репозитории
**Файлы:** 53 `.pyc`-файла в трёх `__pycache__/`, `mini-services/excel-service/logs/excel_service.log` (0 байт), `db/custom.db` (45 КБ, содержит тестовые строки ExcelFile + Macros)

Свежий клон начинает со stale-тестовыми данными в `db/custom.db`; Prisma `db push` отказывается работать без `--accept-data-loss`. `.pyc` собраны на Python 3.12 **и** 3.13 — оба интерпретатора использовались, на машине пользователя они не совпадут.

**Исправление:** Добавить правила в `.gitignore` (`__pycache__/`, `*.pyc`, `*.log`, `db/*.db`, `db/*.sqlite*`); `git rm --cached` для существующих.

### 🔴 C-Config-7 — `START.bat` запускает Next.js в **DEV**-режиме
**Файлы:** `START.bat` → `.zscripts/start-dev.ps1:60` (`& bunx next dev -p 3000 -H 127.0.0.1`)

`package.json` содержит полную standalone-build-инфраструктуру (`build`, `start`, `output: "standalone"`, `copy-standalone.mjs`), но Windows-лаунчер её **никогда не вызывает**. Пользователь получает: медленный dev-server, source-maps открыты, reactStrictMode-предупреждения, middleware-deprecation warning.

**Исправление (вариант A — рекомендуемый):**
1. В `INSTALL.bat` один раз вызывать `bun run build`.
2. В `START.bat` вызывать `bun run start` (`bun .next/standalone/server.js`).
3. Приложение ускорится в 5-10×, исчезнет middleware-deprecation warning.

**Исправление (вариант B):** Закоммитить что dev-mode — это намеренно для single-user localhost; удалить `copy-standalone.mjs`, `output: "standalone"`, `start`-скрипт.

### 🔴 C-Config-8 — `README.md` пустой (2 строки)
**Файл:** `README.md` (`# OMiK_VSM\nOMiK_VSM`)

Нет описания, prerequisites, quick-start, ссылок на `LAUNCH.md`. Все инструкции рассредоточены по `LAUNCH.md` / `ЗАПУСК.md` / `docs/LOCAL_SETUP.md`, но ничего не указывает на них.

**Исправление:** Написать полноценный README: описание проекта, prerequisites (Bun, Python 3.11+, Windows 11), quick-start (`INSTALL.bat` → `START.bat` → `http://127.0.0.1:3000`), ссылки на `LAUNCH.md`, `docs/LOCAL_SETUP.md`, `docs/ARCHITECTURE.md`. Двуязычно RU/EN.

---

## 5. Высокий уровень (High)

### Python excel-service (6 High)

| ID | Файл | Проблема | Фикс |
|----|------|----------|------|
| H-Python-1 | `main_db.py`, `reports.py`, `references.py`, `daily_tracking.py`, `tickets_db.py`, `integration_ops.py`, `calendar_db.py`, `daily_validation.py`, `tickets_costs.py` | SQL injection-поверхность: f-strings с именами колонок из `meta.json`. `_sanitize_col_name` не всегда стрипает `"`. `reports.py` определяет `ALLOWED_MAIN_DB_COLUMNS` + `_safe_column_name`, но **никогда не вызывает** (мёртвый код). | Единый `_sanitize_col_name` (как в `calendar_db` — стрипает `"` и `'`); whitelist колонок везде; параметризация где возможно. |
| H-Python-2 | `tickets_costs.py:1006-1032` | `_resolve_input_path` принимает любой абсолютный путь; копирует файл в `_sources_dir` через `shutil.copy2`. Эндпоинт `POST /api/tickets-costs/load` принимает `file_paths: List[str]` — атакующий может скормить `["C:\\Users\\victim\\Documents\\accounts.xlsx"]`. | Ограничить `UPLOAD_DIR`; вызывать `safe_resolve_path` в эндпоинте. |
| H-Python-3 | `routers/daily.py:160-238`, `routers/references.py:69-93` | Uploads без size/magic-bytes проверок; `await file.read()` грузит всё в память. | Применить `MAX_FILE_SIZE` + `validate_file_by_magic_bytes` как в `/api/upload`. |
| H-Python-4 | `references.py:118-153, 353-374` | Plaintext-пароли в `Log_pass_role.xlsx`, non-constant-time `==`. | Отказаться от plaintext; `hmac.compare_digest` для любого неизбежного сравнения. |
| H-Python-5 | `tickets_costs.py:341-343, 431, 449` | `_snapshot_table(run_id)` — regex-санитизация правильная, но окружение полагается на неё. `DELETE /api/tickets-costs/run?run_id=...` передаёт user input. | `re.fullmatch(r"[\w_]+", run_id)` перед любой DB-операцией. |
| H-Python-6 | `app.py:88-91` | `slowapi` rate-limiter — in-process per-worker. `UVICORN_WORKERS=2` по умолчанию на non-Windows удваивает лимит. | Shared backend (Redis) при `workers>1` ИЛИ документировать `UVICORN_WORKERS=1` (что и так default на Windows). |

### Next.js backend (13 High)

| ID | Файл | Проблема |
|----|------|----------|
| H-Backend-1 | `src/app/api/health/route.ts` | Читает `EXCEL_SERVICE_URL` (нигде не задаётся), а не `EXCEL_BACKEND_URL` — тихо падает в fallback навсегда. |
| H-Backend-2 | `src/app/api/health/route.ts` | Логика `/api/health` (root) не покрывается matcher middleware `/api/excel/:path*` — анонимус получает Node version, platform, memoryUsage. |
| H-Backend-3 | `src/lib/db.ts:18` | Prisma client не кэшируется в production (`if (NODE_ENV !== 'production') globalThis.prisma = ...`). В prod каждый реимпорт создаёт новое подключение, без `$disconnect`. |
| H-Backend-4 | `src/lib/backend-proxy.ts:115-128` | `proxyBackend` буферизует весь ответ бэкенда в память (`text()` → `JSON.parse` → re-serialize). Multi-MB ответы под concurrent load = OOM Node на 4 ГБ Windows-ноутбуке. Stream! |
| H-Backend-5 | `src/app/api/excel/download/[id]/route.ts` | IDOR: `filePath.split('/').pop()?.split('.')[0]` — падает на Windows backslash-путях; `Content-Disposition` filename не экранирован. |
| H-Backend-6 | все POST-роуты (16 файлов) | Нет валидации body — Zod стоит в `package.json`, но не используется. `data-ops`, `merge`, `reports`, `tickets-costs/save-rows` форвардят произвольный JSON на Python. |
| H-Backend-7 | `src/lib/ensure-excel-backend.ts` | На любой network blip убивает Python-процесс и теряет in-progress Celery-задачи. Должно быть opt-in. |
| H-Backend-8 | `src/lib/excel-service-launcher.ts:17-23` | Поиск `python` в PATH на свежей Windows 11 попадает в Microsoft Store stub; 90-секундный polling-цикл; запутанное Russian-сообщение об ошибке. |
| H-Backend-9 | `src/lib/main-db-upload.ts:2` | Хардкод `C:\Otchet_OP_Marina\OMiK_VSM\upload` — хрупко на другой машине. |
| H-Backend-10 | `src/lib/daily-accounting-cache.ts:57-69` | `dailyCacheFetch` кэширует failures как пустой массив; UI навсегда показывает "no data". |
| H-Backend-11 | `daily-tracking/{route,sites,combined}/route.ts` | Client-controlled authorization: `user_role` и `user_sites` принимаются из запроса и форвардятся Python-бэкенду, который их использует для authz. Любой звонящий может передать `user_role=admin`. |
| H-Backend-12 | `excel/upload/route.ts` | Нет per-route body-size cap; глобальный 250 МБ. Для `auth/login` (нужно ≤512 байт) — абсурд. |
| H-Backend-13 | `src/app/api/excel/files/route.ts:5-67` | `db.excelFile.findMany({ orderBy })` без `take` — после года загрузок вернёт всю таблицу. |

### Frontend (6 High)

| ID | Файл | Проблема |
|----|------|----------|
| H-Frontend-1 | весь проект | `@tanstack/react-query` стоит в `package.json` но НИГДЕ не используется. Каждый fetch — raw `fetch` в `useEffect` без cache/dedup/retry. Health-ping каждые 60 сек дублируется каждым компонентом. |
| H-Frontend-2 | `src/components/home/WelcomeDateTimePanel.tsx:48-66` | Hydration mismatch: `useState(new Date())` на SSR + клиенте дают разные `Date`. `isMounted` инициализирован `true` и не обновляется — guard-ветка мёртвая. |
| H-Frontend-3 | `src/components/ui/sonner.tsx:3` + `src/app/layout.tsx` | `next-themes` используется в `sonner.tsx`, но `<ThemeProvider>` не смонтирован в `layout.tsx`. `.dark`-токены в `globals.css` никогда не применяются — dark mode мёртв. |
| H-Frontend-4 | `src/components/excel/SpreadsheetGrid.tsx:338-364` | `window.addEventListener('keydown')` перехватывает Ctrl+C/V/X/Z/Y/F/H без проверки `e.target` — пока пользователь печатает в input/dialog, шорткаты действуют на таблицу. |
| H-Frontend-5 | `src/components/home/AppLoginBar.tsx`, `SettingsDialog.tsx`, `MacroEditor.tsx` | `react-hook-form` + `@hookform/resolvers` + `zod` установлены, но НИГДЕ не импортируются. Логин/настройки/макрос-формы отправляют данные без валидации. |
| H-Frontend-6 | большинство роутов в `src/app/api/excel/**` | Нет `export const runtime = 'nodejs'`. Только 3 из ~30 роутов объявляют его. Любой workspace-level override в Next 16 может молча переключить их на edge, где `@prisma/client`, `child_process.spawn`, `process.env` сломаются. |

### Configs/Deploy (9 High)

| ID | Файл | Проблема |
|----|------|----------|
| H-Config-1 | `package.json:31,72` | `prisma` (CLI) `^6.11.1` ≠ `@prisma/client` `^6.19.3`. Prisma требует один минор. → `PrismaClientInitializationError`. |
| H-Config-2 | `package.json:85` | `xlsx@^0.18.5` — CVE-2023-30533 (prototype pollution) + CVE-2024-22363 (ReDoS). SheetJS не публикует фиксы на npm. |
| H-Config-3 | `LAUNCH.md`, `docs/LOCAL_SETUP.md`, `INSTALL.bat` | Нет инструкций по установке Bun/Python БЕЗ admin. INSTALL.bat просто падает с `bun not found`. |
| H-Config-4 | `package.json` (нет `postinstall`) | После `bun install` Prisma-клиент НЕ сгенерирован. App крашится на первом DB-запросе. INSTALL.bat обязателен. |
| H-Config-5 | `scripts/copy-standalone.mjs` + `next.config.ts` (`output: "standalone"`) + `start` script | Мёртвый код на Windows (см. C-Config-7). |
| H-Config-6 | `.zscripts/*.py` (13 файлов) | Хардкод `C:\Otchet_OP_Marina\OMiK_VSM\...` и `C:\Users\derevyankoga\...`. Dev-only restore-скрипты в репо — на машине пользователя тихо упадут. |
| H-Config-7 | `.zscripts/generate-types.ps1:26` | `$env:NODE_TLS_REJECT_UNAUTHORIZED = '0'` перед `npx --yes quicktype` — отключает TLS для всего процесса (MITM risk). |
| H-Config-8 | `.pre-commit-config.yaml:38` | `entry: bun run format` — формат-скрипта в `package.json` НЕТ. Hook падает на каждом коммите. |
| H-Config-9 | `.zscripts/{build,start,mini-services-build,mini-services-install}.sh` | Linux-only с хардкодом `/home/z/my-project`, `/tmp/build_fullstack_*`, `/app/db/custom.db`, `exec caddy run`. На Windows не запустятся. |

---

## 6. Средний уровень (Medium) — выборка

### Python (25 Medium — основные)
- **M-Python-1**: `requirements.txt` не содержит `bcrypt` (нужен `references.py`). Fresh install → `ModuleNotFoundError`.
- **M-Python-2**: `start.sh` — bash-only с Linux-путём. Мёртвый на Windows.
- **M-Python-3**: `db_backup.py` — `DB_DIR = parent.parent / "db"` (не существует), glob `*.db` (а у вас `*.sqlite`). Backups тихо пустые.
- **M-Python-4**: `reports.py:21-23`, `gelendzhik_report.py:23-24` — `MAIN_DB_PATH = main_db.DB_PATH` (legacy). После реестра инстансов — всегда `"Main database not loaded"` для fresh install.
- **M-Python-5**: `main_db.py` — 8 функций определены по 3 раза (строки ~248-362, ~365-479, ~482-596). Botched merge.
- **M-Python-6**: `excel_handler.py:567` — `sum(1 for _ in open(file_path))` без `with`, без encoding → утечка FD, cp1251/utf-8 inconsistency.
- **M-Python-7**: `app.py:414-416` — `psutil.disk_usage('/')` на Windows = текущий диск, не `D:` где данные.
- **M-Python-8**: `app.py:409` — `psutil.cpu_percent(interval=0.1)` блокирует event-loop 100 мс.
- **M-Python-9**: Нет body-size лимитов на JSON-эндпоинтах (`/api/tickets-costs/save-rows` и т.д.).
- **M-Python-10**: `@app.on_event("startup")` deprecated с Starlette 0.36. Использовать `lifespan`.
- **M-Python-11**: CORS `allow_credentials=True` + user-controlled `CORS_ORIGINS`. Typo `*` = открытая политика.
- **M-Python-12**: `data_merge.py:11-13`, `macro_engine.py:381-386` — дублирующие imports.
- **M-Python-13**: `slowapi` exception handler не зарегистрирован на routers — может молча не срабатывать.
- **M-Python-14**: `daily_tracking.py` — `assert_upload_access` определяется по подстроке `"Нет прав"` в error message. Любая переформулировка ломает HTTP status.
- **M-Python-15**: `data_paths.migrate_legacy_upload_dir` — `shutil.move` на Windows с открытым в Excel файлом → `PermissionError`, partial move.
- **M-Python-16**: Celery+Redis на Windows неработоспособен без Docker (есть fallback — OK).
- **M-Python-17**: `xlwings` требует установленный Excel + interactive desktop.
- **M-Python-18**: `find_file_by_id` — race condition.
- **M-Python-19**: Long-path support на Windows (>260 chars) для `instances/<id>/...`.
- **M-Python-20**: `app.py:99-102` — `ThreadPoolExecutor(max_workers=16)` независимо от CPU.
- **M-Python-21**: `app.py` — `HTTPException(detail=str(e))` раскрывает stack traces клиентам.
- **M-Python-22**: `excel_handler.validate_file_by_magic_bytes` — latin-1 fallback для CSV декодирует что угодно → magic-bytes для CSV бесполезен.
- **M-Python-23**: `PythonMacroExecutor` namespace содержит mutable `wb`/`ws` — после макроса нужно всегда `wb.save(file_path)`.
- **M-Python-24**: `ApiTokenMiddleware` — `BaseHTTPMiddleware` (известны issues со streaming/background tasks). Лучше pure-ASGI.
- **M-Python-25**: `routers/references.py:69-78` — `kind` валидируется dict-ой, OK, но filenames содержат кириллицу (`1С_Территория_в_Площадка.xlsx`).

### Backend (22 Medium)
- Прокси-роуты возвращают 504 на любую ошибку (конфлав "backend down" vs "backend 5xx" vs "client network error").
- `excel-service-launcher.ts` — 90-итерационный sleep loop внутри request handler, worst-case 450 сек.
- `analyze/route.ts` принимает произвольный `operations` array.
- `welcome-modules/route.ts` POST форвардит произвольный JSON.
- `excel/macro/route.ts` GET без `file_path` возвращает ВСЕ макросы (data exfiltration + unbounded).
- `excel-service-launcher.ts:65-72` — `child.unref()` + polling loop блокирует request до 90 секунд.
- `proxyBackend` 504 fallback скрывает реальные status codes.
- `api-paths.ts` — documentary, не используется (drift).
- `app-auth.ts` — purely client-side, server не знает пользователя.
- `home-modules.ts` импортирует zustand-store на module load.
- `openSpreadsheetEditor.ts` — unsound cast `unknown as Array<Array<...>>`.
- `export-table-to-excel.ts:42` — `XLSX.writeFile` синхронный в браузере.
- `sanitizeFileName` не обрабатывает Windows reserved names (`CON`, `PRN`, `AUX`, `NUL`, `COM1-9`, `LPT1-9`).
- `settings-password.ts:5-7` — `value.trim() === SETTINGS_PASSWORD` (ещё снижает энтропию).
- `backend-proxy.ts:79-101` — retry без jitter.
- `excel-service-launcher.ts:7` — `LAUNCH_COOLDOWN_MS = 15_000` global per process, второй звонящий молча пропускается.
- `data-ops/route.ts:68-143` — switch без `default: never`.
- `sheet-ops/route.ts:69-73` — `path!` non-null assertion.
- `daily-tracking/sites/route.ts` — `user_role` в query string (дубликат H-Backend-11).
- Все роуты — `console.error` без structured logging, без rotation.
- `types/excel-service-schemas.ts` — hand-maintained, без CI-генерации (drift).
- `db.ts:5` — `process.cwd()` для `DATABASE_URL`; запуск из другого CWD = fresh пустая БД.

### Frontend (11 Medium)
- `globals.css` — 5 дубликатов `.daily-scroll-*` (~200 мёртвых строк).
- `tailwind.config.ts` (v3) coexists с Tailwind v4 + `@tailwindcss/postcss`.
- `WelcomeModuleCard` — `<div onClick>`, не keyboard-accessible.
- `ErrorNotification` — нет `role="alert"`, `aria-live="polite"`, `aria-label` у close-кнопки.
- `LoadingOverlay` блокирует viewport без Cancel/timeout.
- `layout.tsx` — нет `export const viewport: Viewport`.
- `StatusBar` — `useExcelStore.getState()` в `useMemo`, stale deps.
- `HomePageClient` — orphan Python-процессы на Windows при закрытии tab.
- `FindReplaceDialog` — `<div>`, не `<Dialog>` (нет focus trap).
- `SpreadsheetGrid` — crash если `sheet` undefined.
- `next.config.ts:10-12` — `proxyClientMaxBodySize: "250mb"` рискует OOM Node.

### Configs/Deploy (12 Medium)
- `src/lib/api-auth.ts:22` — timing-unsafe `token !== secret` (дубликат C-Backend-3).
- `stop-ports.cmd` — `taskkill /F` по любому процессу на 3000/3031/81.
- `bun run audit`, `verify:win`, `types:excel` — `-ExecutionPolicy Bypass` (на corporate AppLocker не сработает).
- `overrides.postcss: "^8.5.10"` без комментария зачем.
- Tailwind v3 config + v4 + оба animate-плагина.
- `ЗАПУСК-Celery.md` — рекомендует Memurai (commercial, не FOSS). Нужно `tporadowski/redis` или явно пропустить.
- Нет autostart на Windows boot (нужен shortcut в `shell:startup`).
- 3 hardcoded localhost порта без конфигураруемости.
- README и docs — Russian-only.
- `IMPROVEMENTS_REPORT.md` ложно утверждает "Cross-platform ✅".
- `agent-ctx/` и `OMiK/download/` — committed dev-артефакты (дубликаты credentials!).
- `download/vba/*.bas` и `download/Подр_Площадка_Затраты.xlsx` — business-sensitive VBA и 1С-данные в репо.

---

## 7. Низкий и информационный уровень

Подробно — в отдельных findings-файлах (см. §13). Краткая выборка:
- `console.error` в 30+ точках production-кода.
- `tsconfig.json` target `ES2017` (можно `ES2022`).
- `vitest.config.ts` — `environment: 'node'`, исключает `.tsx`.
- 2 toast-системы (Radix + Sonner) сосуществуют.
- `sharp` установлен, но `next/image` не используется.
- `robots.txt` allows all bots на internal corporate tool.
- `playwright.config` без `webServer`.
- `/api/health` (root) возвращает `process.version`/`platform`/`memoryUsage` без авторизации.
- `tsconfig.json:33` включает `next-env.d.ts`, но файл не закоммичен — первый pre-commit упадёт.
- Caddy binary не bundled и не скачивается `INSTALL.bat`.
- `mini-services/excel-service/package.json` — `"dev": "bun --hot index.ts"` мёртвый (index.ts просто spawn `python app.py`).
- `INSTALL.bat` печатает шаги Celery/Redis без объяснения "почему пропускаем".
- `.gitattributes` объявляет `*.sqlite filter=lfs`, но БД — `*.db`.
- `LAUNCH.md` упоминает middleware-deprecation, но не объясняет миграцию `middleware.ts → proxy.ts` (Next 16).
- `examples/websocket/server.ts` — port 3003, не запускается никаким лаунчером.

---

## 8. Совместимость с Windows 11 (без admin, без Docker)

### ✅ Что работает

| Компонент | Статус | Комментарий |
|-----------|--------|-------------|
| Next.js 16 на Bun | ✅ | Bun ставится в `%USERPROFILE%\.bun` без admin. |
| Python 3.11+ | ✅ | Python.org installer с опцией "Install for me only" — без admin. Альтернативы: `pyenv-win`, `scoop install python`. |
| FastAPI + uvicorn | ✅ | `pip install --user` или venv. |
| Prisma + SQLite | ✅ | SQLite — встроенный файл. Prisma binary скачивается через `prisma generate` (нужен интернет или кеш). |
| in-process task queue | ✅ | `task_queue.py` fallback работает без Redis. |
| `%LOCALAPPDATA%\OMiK_VSM\data\` | ✅ | Юзер имеет полные права в `LOCALAPPDATA`. |
| `.bat`/`.ps1`/`.vbs` лаунчеры | ✅ | `-ExecutionPolicy Bypass` работает per-process без admin. |
| Кроссплатформенные пути в `data_paths.py` | ✅ | `LOCALAPPDATA` на Windows, `XDG_DATA_HOME` на Linux. |
| Caddy (опционально) | ⚠️ | Бинарник `caddy_x64.exe` можно положить рядом с проектом без admin. Но в `INSTALL.bat` он НЕ скачивается. |

### ❌ Что НЕ работает / требует внимания

| Компонент | Проблема | Решение |
|-----------|----------|---------|
| **Celery + Redis** | `celery` prefork pool не работает на Windows (`os.fork`). У Redis нет официального Windows-билда. `ЗАПУСК-Celery.md` рекомендует **Memurai** — это commercial, нарушает "100% FOSS". | (a) Документировать: "на Windows оставьте `OMIK_USE_CELERY` пустым — фоновые задачи идут in-process". (b) Если очень нужен Redis — `tporadowski/redis` (community Windows port, GPL-compatible, без admin). |
| **`xlwings`** | Требует установленный MS Excel + interactive desktop session. | Документировать; добавить startup-probe `HAS_EXCEL_COM`. |
| **Microsoft Store `python` stub** | На свежей Windows 11 `python` в PATH может быть stub от Store; 90-сек polling в `excel-service-launcher.ts`. | В `INSTALL.bat` проверять `python --version` с явным сообщением; рекомендовать `py launcher` или `python.org` installer. |
| **`generate-types.ps1`** | `$env:NODE_TLS_REJECT_UNAUTHORIZED = '0'` (MITM risk). | Убрать строку; для корпоративных прокси — `NODE_EXTRA_CA_CERTS`. |
| **PowerShell `-ExecutionPolicy Bypass`** | На corporate AppLocker / WDAC / Constrained Language Mode — даже Bypass запрещён. | fallback на pure `node`/`bun` scripts; документировать в `LAUNCH.md`. |
| **Long path (>260 chars)** | `instances/20241107_120000_abc12345/main_db.sqlite` + `OMIK_DATA_DIR` глубоко в профиле. | Документировать короткий `OMIK_DATA_DIR` (напр. `C:\OMiK\data`); `manifest` longPathAware. |
| **Cyrillic filenames в cmd.exe** | `УСТАНОВКА.bat` и т.д. — на cp1251/cp437 codepage могут отображаться как `???`. | Добавить `chcp 65001 >nul` во все `.bat` с кириллицей. |
| **`stop-ports.cmd` `taskkill /F`** | Убивает любой процесс на 3000/3031/81 — может убить чужой dev-сервер. | Выводить `tasklist` перед kill; требовать подтверждение. |
| **3 hardcoded порта** | Конфликт с другим Next.js на 3000 или FastAPI на 3031. | Читать порты из `.env.local`; `INSTALL.bat` должен предлагать альтернативы. |
| **Autostart на Windows boot** | Нет `schtasks`/`nssm`/startup-shortcut. | `INSTALL-AUTOSTART.bat` создаёт shortcut в `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\`. |

---

## 9. Отклонения от документации

Полная таблица — в `findings_docs_context.md` (18 пунктов). Главные:

| # | Ожидание из doc3 | Реальность OMiK-main | Влияние |
|---|------------------|----------------------|---------|
| 1 | NextAuth + bcrypt + Session-table (Spec B) | Нет NextAuth, нет bcryptjs в deps. Auth делегирован Python `references.py::verify_user()` → `Log_pass_role.xlsx`. Сессия — plaintext JSON в `sessionStorage`. | High |
| 2 | Rate-limit: 200/min (README), 100/min general + 10/min login (Spec B) | `src/middleware.ts` только проверяет опциональный `OMIK_API_SECRET`. **Rate-limit отсутствует.** | High |
| 3 | 18-25 Prisma моделей | **5 моделей** (ExcelFile, Macro, MacroRun, Operation, MainDatabase-legacy). Все бизнес-данные в Python-SQLite. | High (architectural) |
| 4 | VLM/OCR через `z-ai-web-dev-sdk` для паспортов/билетов/виз | `z-ai-web-dev-sdk` НЕТ в `package.json`. | High (Spec B only) |
| 5 | Microsoft Outlook (Graph API) OAuth2 | Нет `@azure/msal`, нет `/api/outlook/*`. | High (Spec B only) |
| 6 | SQL Lab с DDL/DML blocking | Нет `/api/hr/sql-execute`. | High (Spec B only) |
| 7 | Excel Power: Workbook/Sheet/Pipeline/Report Prisma models, formula engine, VBA→Python transpiler, Python REPL | Только `MacroEditor.tsx`, `VbaLaboratoryPanel.tsx`, `/api/excel/macro`, `/api/excel/vba-laboratory`. | High (Spec B only) |
| 8 | File upload limit 10 МБ (SECURITY.md) vs 100 МБ (README) | `next.config.ts` — 100 МБ. SECURITY.md-овские 10 МБ — только в документации. | Medium |
| 9 | FastAPI на :3031 "ДЕКОМИССИРОВАН" (Spec A §13) | **Реально жив и обязателен.** Без него: "Excel-service недоступен, upload fetch failed". | High (Spec A self-contradicts) |
| 10 | 4 группы × 19 табов (Spec A) или 16 viewModes (Spec B) | **13 module cards**, большинство `panel: 'placeholder'`. | Medium |

**Главный мета-вывод:** doc3 внутренне противоречива. **Spec A** (`VSM_DOCUMENTATION.md`, `README.md`, `DOC/`) ближе к реальности; **Spec B** (`doc2/`, inner `doc3/`) — aspirational redesign с bearer-auth, VLM, Outlook, SQL Lab, Excel Power, которых **в OMiK-main нет**. Аудит надо сравнивать со Spec A + actual code, а Spec B — как desiderata.

---

## 10. Рекомендуемый план исправлений (приоритизированный)

### 🚨 Фаза 0 — Блокирующие (до любого production-использования, ~1-2 дня)

1. **C-Python-3** — Сделать `OMIK_API_SECRET` обязательным (auto-generate при первом запуске, логировать, требовать смены).
2. **C-Python-1, C-Python-2** — Убрать `language="python"` из `/api/macro/execute` (или вынести в отдельный admin-only эндпоинт с subprocess-песочницей). Заменить `eval` в VBA-парсере на `ast.parse` + whitelist.
3. **C-Python-4** — Вызвать `safe_resolve_path()` в начале каждого path-принимающего эндпоинта. Это ~20 мест в `app.py` + `tickets_costs._resolve_input_path`.
4. **C-Python-5** — Валидировать `instance_id` через `re.fullmatch(r"[\w\-]+", instance_id)` во всех функциях `main_db_registry.py`.
5. **C-Python-6** — Требовать admin-роль + magic-bytes + size limit на `/api/references/upload/login` и остальных reference-uploads.
6. **C-Python-7** — Исправить `find_file_by_id` на точное совпадение.
7. **C-Backend-1** — Убрать `SETTINGS_PASSWORD = 'admin2606'` из клиента. Перенести проверку в server-route с bcrypt-хэшем.
8. **C-Backend-2** — Убрать `NEXT_PUBLIC_OMIK_API_SECRET`. Все uploads через server-proxy.
9. **C-Backend-3** — `crypto.timingSafeEqual` в `api-auth.ts`.
10. **C-Backend-7** — Серверные сессии (signed HttpOnly cookie) + per-IP rate-limit на login. Убрать `user_role`/`user_sites` из client-controlled запросов (H-Backend-11).
11. **C-Config-1** — Переписать `.gitignore`.
12. **C-Config-2, C-Config-3** — `git rm --cached ЛОГ_ЧАТА.txt download/Log_pass_role.xlsx OMiK/download/Log_pass_role.xlsx`. Scrub history.
13. **C-Config-4, C-Config-5** — Удалить `bun.lock` И `package-lock.json`; `bun install` → закоммитить один новый `bun.lock`.
14. **H-Config-1** — `prisma` и `@prisma/client` в одной версии (`^6.19.3`).
15. **H-Config-4** — `"postinstall": "prisma generate"` в `package.json`.
16. **H-Config-7** — Убрать `$env:NODE_TLS_REJECT_UNAUTHORIZED = '0'` из `generate-types.ps1`.
17. **H-Python-1** (блокер Windows) — Добавить `bcrypt>=4.0.0` в `requirements.txt`.
18. **H-Python-4** (блокер reports) — Заменить `MAIN_DB_PATH = main_db.DB_PATH` на `main_db._db_path()` / `main_db._meta_path()` в `reports.py`, `gelendzhik_report.py`.

### 🟠 Фаза 1 — Критичное для Windows-деплоя (~2-3 дня)

19. **C-Config-7** — Решить dev vs prod. Рекомендация: `INSTALL.bat` один раз делает `bun run build`, `START.bat` вызывает `bun run start`.
20. **C-Config-8** — Написать полноценный `README.md` с prerequisites и quick-start.
21. **H-Config-3** — Добавить в `LAUNCH.md`/`README.md` PowerShell-сниппеты для установки Bun и Python per-user без admin.
22. **H-Config-9** — Удалить или переместить в `linux-deployment/` файлы `.zscripts/{build,start,mini-services-*}.sh`.
23. **H-Config-6** — Рефакторить `.zscripts/*.py` (13 файлов) на `Path(__file__).parent` вместо хардкода `C:\Otchet_OP_Marina\...`.
24. **H-Config-8** — Добавить `"format": "prettier --write ..."` в `package.json` (с `prettier` в devDeps), или убрать prettier из `.pre-commit-config.yaml`.
25. **H-Backend-8** — В `excel-service-launcher.ts` добавить проверку что `python` не Microsoft Store stub; лучше использовать `py -3` launcher.
26. **M-Config-3.6** — Переписать `ЗАПУСК-Celery.md`: либо "пропустите Celery на Windows", либо `tporadowski/redis` + Zip-дистрибутив.
27. **C-Config-6** — Добавить `__pycache__/`, `*.pyc`, `*.log`, `db/*.db`, `db/*.sqlite*` в `.gitignore`; `git rm --cached` для существующих.

### 🟡 Фаза 2 — Производительность и UX (~3-5 дней)

28. **C-Frontend-1** — Добавить `error.tsx`, `global-error.tsx`, `loading.tsx`, `not-found.tsx`.
29. **C-Frontend-2** — Виртуализация в `MainDatabasePanel` через `@tanstack/react-virtual`; снизить `PAGE_SIZE_MAX` до 10 000.
30. **H-Frontend-1** — Обернуть приложение в `<QueryClientProvider>`, перевести `useExcelApi` на `useQuery`/`useMutation`.
31. **H-Frontend-5** — Добавить Zod-схемы для Login, SettingsPassword, MacroExecute. Использовать `react-hook-form` + `zodResolver`.
32. **H-Backend-3** — Кэшировать Prisma client в production в `db.ts`; добавить `await prisma.$disconnect()` в `process.on('beforeExit')`.
33. **H-Backend-4** — Stream proxy-ответы в `backend-proxy.ts` (убрать `text()` + `JSON.parse`).
34. **H-Backend-13** — Pagination в `files/route.ts` (`take: 200`, cursor).
35. **H-Frontend-4** — В `SpreadsheetGrid` проверять `e.target instanceof HTMLInputElement` и т.д. в keyboard-handler.
36. **H-Frontend-3** — Смонтировать `<ThemeProvider attribute="class">` в `layout.tsx` (или убрать dark mode).
37. **H-Frontend-2** — Инициализировать `useState<Date | null>(null)` в `WelcomeDateTimePanel`; рендерить только после `useEffect`.
38. **H-Frontend-6** — `export const runtime = 'nodejs'` во всех роутах `/api/excel/**`.
39. **M-Frontend-11** — Удалить 4 дубликата `.daily-scroll-*` из `globals.css`.
40. **M-Frontend-12** — Удалить `tailwind.config.ts` (Tailwind v4), убрать `tailwindcss-animate` (есть `tw-animate-css`).

### 🟢 Фаза 3 — Гигиена и качество (параллельно)

41. **H-Backend-5** — Исправить IDOR в `download/[id]` (Windows-пути, escape `Content-Disposition`).
42. **H-Backend-6** — Zod-валидация во всех POST-роутах.
43. **M-Python-5** — Удалить дубликаты функций в `main_db.py`.
44. **M-Python-6** — `with open(..., encoding="utf-8", errors="replace")` в `excel_handler.py:567`.
45. **M-Python-10** — Перейти на `lifespan` context manager вместо `@app.on_event("startup")`.
46. **M-Python-21** — Не раскрывать `str(e)` клиентам; env-gate `OMIK_DEBUG=1`.
47. **A-Backend-1** — Вынести business-logic из роутов в `src/lib/services/*.ts`.
48. **A-Backend-4** — OpenAPI spec на Python-стороне, contract-testing на Next↔Python.
49. **L-Frontend-23** — Logger wrapper (`src/lib/log.ts`) с no-op для warn в production.
50. **L-Frontend-24** — `tsconfig.json` target → `ES2022`.

---

## 11. Конкретные улучшения кода и конфигов

### 11.1. `.gitignore` (заменить полностью)

```gitignore
# Dependencies
node_modules/
.pnp
.pnp.js

# Next.js
.next/
out/
build/
dist/
.next/standalone/
.vercel

# Production
*.tsbuildinfo
next-env.d.ts

# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
.venv/
venv/
env/
ENV/
*.egg-info/
.pytest_cache/
.mypy_cache/
.ruff_cache/

# Logs
*.log
logs/
dev.log
server.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Databases
db/*.db
db/*.sqlite
db/*.sqlite-journal
db/*.sqlite-wal
db/*.sqlite-shm
*.db-journal

# Env
.env
.env.local
.env.*.local
.env.development
.env.production

# IDE
.idea/
.vscode/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db
desktop.ini

# Project-specific
agent-ctx/
OMiK/download/
download/*.xlsx
download/vba/*.bas
ЛОГ_ЧАТА.txt
tool-results/
download/Log_pass_role.xlsx
download/Role_OP.xlsx
download/1С_Территория_в_Площадка.xlsx
download/Подр_Площадка_Затраты.xlsx

# Lockfiles (keep only one — bun)
package-lock.json

# Caddy
caddy.exe
caddy_data/

# Test artifacts
test-results/
playwright-report/
coverage/
```

### 11.2. `package.json` (ключевые правки)

```json
{
  "scripts": {
    "dev": "next dev -p 3000 2>&1 | tee dev.log",
    "build": "next build && node scripts/copy-standalone.mjs",
    "start": "cross-env NODE_ENV=production bun .next/standalone/server.js 2>&1 | tee server.log",
    "postinstall": "prisma generate",
    "format": "prettier --write \"src/**/*.{ts,tsx,js,jsx}\"",
    "lint": "eslint .",
    "audit": "bun pm audit",
    "typecheck": "tsc --noEmit",
    "precommit": "bun run typecheck && bunx lint-staged && bun run test:unit",
    "test": "bun run test:unit && bun run test:python",
    "test:python": "cd mini-services/excel-service && python -m pytest tests/ -q",
    "test:unit": "vitest run",
    "test:e2e": "playwright test",
    "db:push": "prisma db push",
    "db:generate": "prisma generate"
  },
  "dependencies": {
    "@prisma/client": "^6.19.3",
    "prisma": "^6.19.3",
    "xlsx": "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz",
    "next": "^16.1.1",
    "react": "^19.2.7",
    "react-dom": "^19.2.7",
    "next-themes": "^0.4.6",
    "@tanstack/react-query": "^5.82.0",
    "@tanstack/react-table": "^8.21.3",
    "@tanstack/react-virtual": "^3.13.12",
    "zod": "^4.0.2",
    "react-hook-form": "^7.77.0",
    "@hookform/resolvers": "^5.1.1",
    "zustand": "^5.0.14",
    "bcryptjs": "^2.4.3",
    "@types/bcryptjs": "^2.4.6",
    "lucide-react": "^0.525.0",
    "tailwind-merge": "^3.6.0",
    "clsx": "^2.1.1",
    "class-variance-authority": "^0.7.1",
    "date-fns": "^4.1.0",
    "framer-motion": "^12.23.2",
    "sonner": "^2.0.7",
    "uuid": "^11.1.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "tailwindcss": "^4",
    "tw-animate-css": "^1.3.5",
    "typescript": "^5.9.3",
    "@types/node": "^25.9.1",
    "@types/react": "^19.2.16",
    "@types/react-dom": "^19.2.3",
    "bun-types": "^1.3.4",
    "eslint": "^9.39.4",
    "eslint-config-next": "^16.2.7",
    "husky": "^9.1.7",
    "lint-staged": "^15.5.2",
    "prettier": "^3.3.3",
    "vitest": "^4.1.8",
    "@playwright/test": "^1.52.0",
    "jsdom": "^25.0.1"
  },
  "overrides": {
    "postcss": "^8.5.10"
  }
}
```

Примечания:
- `prisma` и `@prisma/client` выровнены.
- `xlsx` заменён на CDN-версию 0.20.3 (FOSS, без CVE).
- Добавлен `bcryptjs` (или использовать Python-side `bcrypt`).
- Добавлен `@tanstack/react-virtual` для C-Frontend-2.
- Добавлен `prettier` (для H-Config-8).
- `postinstall: prisma generate` (H-Config-4).
- Убран `tailwindcss-animate` (M-Frontend-12 — есть `tw-animate-css`).
- Убраны `package-lock.json` (выбран `bun`).

### 11.3. `mini-services/excel-service/requirements.txt` (ключевые правки)

```txt
fastapi>=0.115.0,<1.0
uvicorn[standard]>=0.30.0,<1.0
python-multipart>=0.0.9
openpyxl>=3.1.0
xlsxwriter>=3.2.0
xlrd>=2.0.0
pandas>=2.2.0
numpy>=1.26.0
polars>=1.0.0
xlwt>=1.3.0
xlutils>=2.0.0
pyxlsb>=1.0.10
formulas>=1.2.0
pyexcelerate>=0.5.0
pycel>=1.0b30
xlwings>=0.30.0; sys_platform == "win32"
rapidfuzz>=3.0.0
oletools>=0.60.0
python-calamine>=0.2.0
slowapi>=0.1.9
psutil>=5.9.0
bcrypt>=4.0.0
```

### 11.4. `mini-services/excel-service/auth_middleware.py` (безопасная версия)

```python
import os
import hmac
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

PUBLIC_PATHS = {"/api/health", "/api/health/", "/docs", "/openapi.json", "/redoc"}

class ApiTokenMiddleware(BaseHTTPMiddleware):
    def __init__(self, app, secret: str):
        super().__init__(app)
        if not secret or len(secret) < 32:
            raise RuntimeError(
                "OMIK_API_SECRET must be set and at least 32 chars. "
                "Generate one with: python -c \"import secrets; print(secrets.token_urlsafe(48))\""
            )
        self._secret = secret.encode("utf-8")

    async def dispatch(self, request, call_next):
        path = request.url.path
        if path in PUBLIC_PATHS or path.startswith("/docs") or path.startswith("/api/health"):
            return await call_next(request)
        token = (request.headers.get("x-omik-token") or "").encode("utf-8")
        if not token or not hmac.compare_digest(token, self._secret):
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)
        return await call_next(request)
```

### 11.5. `mini-services/excel-service/app.py` — path-traversal fix

В начале каждого path-принимающего эндпоинта:

```python
ALLOWED_BASE_DIRS = [
    os.path.abspath(UPLOAD_DIR),
    os.path.abspath(excel_handler.UPLOAD_DIR),
    os.path.abspath(MAIN_DB_DIR),
    os.path.abspath(INSTANCES_DIR),
]

def assert_safe_path(user_path: str) -> str:
    resolved = os.path.abspath(user_path)
    for base in ALLOWED_BASE_DIRS:
        if resolved == base or resolved.startswith(base + os.sep):
            return resolved
    raise HTTPException(status_code=403, detail="Path outside allowed directories")

# В эндпоинте:
@app.post("/api/sheet-data")
async def sheet_data(payload: SheetDataRequest):
    file_path = assert_safe_path(payload.file_path)
    # ... остальная логика
```

### 11.6. `mini-services/excel-service/main_db_registry.py` — instance_id fix

```python
import re
INSTANCE_ID_RE = re.compile(r"^[\w\-]+$")

def _validate_instance_id(instance_id: str) -> str:
    if not INSTANCE_ID_RE.fullmatch(instance_id):
        raise HTTPException(status_code=400, detail="Invalid instance_id")
    return instance_id

def instance_dir(instance_id: str) -> Path:
    iid = _validate_instance_id(instance_id)
    folder = INSTANCES_DIR / iid
    resolved = folder.resolve()
    base = INSTANCES_DIR.resolve()
    if resolved != base and not str(resolved).startswith(str(base) + os.sep):
        raise HTTPException(status_code=403, detail="Path traversal detected")
    return resolved
```

### 11.7. `src/lib/settings-password.ts` → server-side check

```typescript
// src/lib/settings-password.ts — удалить константу полностью

// src/app/api/excel/auth/settings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { rateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? 'unknown'
  if (!rateLimit(`settings-login:${ip}`, 5, 60_000)) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 })
  }
  const { password } = await request.json()
  // SETTINGS_PASSWORD_HASH env var: bcrypt hash
  const hash = process.env.SETTINGS_PASSWORD_HASH
  if (!hash) return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  const ok = await bcrypt.compare(password ?? '', hash)
  if (!ok) return NextResponse.json({ error: 'Invalid' }, { status: 401 })
  // Issue signed session cookie here
  return NextResponse.json({ ok: true })
}
```

### 11.8. `src/lib/api-auth.ts` — timing-safe compare

```typescript
import crypto from 'crypto'

export function checkIncomingApiAuth(request: Request): Response | null {
  const secret = process.env.OMIK_API_SECRET
  if (!secret || secret.length < 32) {
    return new Response('OMIK_API_SECRET not configured', { status: 500 })
  }
  const token = request.headers.get('x-omik-token') ?? ''
  const a = Buffer.from(token)
  const b = Buffer.from(secret)
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    return new Response('Unauthorized', { status: 401 })
  }
  return null
}
```

### 11.9. `next.config.ts` — без 250mb proxy

```typescript
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  experimental: {
    // Убрать proxyClientMaxBodySize — все большие файлы через direct-to-:3031
    // после исправления C-Backend-2 (no NEXT_PUBLIC_ secret).
  },
  // Явно указать runtime для всех API роутов
  // (либо在每个 route.ts добавлять export const runtime = 'nodejs')
}

export default nextConfig
```

### 11.10. `START.bat` — production-mode (рекомендация)

```batch
@echo off
chcp 65001 >nul
cd /d "%~dp0"

REM Load .env.local
if exist ".env.local" (
  for /f "usebackq tokens=1,* delims==" %%a in (".env.local") do (
    set "%%a=%%b"
  )
)

REM Ensure excel-service is running
start "OMiK Excel Service" /MIN cmd /c "cd /d mini-services\excel-service && python -u app.py"

REM Wait for :3031
timeout /t 5 /nobreak >nul

REM Start Next.js in PRODUCTION
set NODE_ENV=production
bun .next\standalone\server.js
```

### 11.11. `INSTALL.bat` — проверки без admin

```batch
@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo [1/5] Checking Bun...
where bun >nul 2>nul
if errorlevel 1 (
  echo Bun not found. Installing per-user (no admin needed)...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "irm bun.sh/install.ps1 | iex"
  call "%USERPROFILE%\.bun\bin\bun.exe" --version
)

echo [2/5] Checking Python...
where python >nul 2>nul
if errorlevel 1 (
  echo Python not found. Install from https://python.org (choose "Install for me only")
  pause
  exit /b 1
)
python --version | findstr /R "3\.\(1[1-9]\|[2-9][0-9]\)\." >nul || (
  echo Python 3.11+ required
  exit /b 1
)

echo [3/5] Installing JS dependencies...
call bun install
call bun run postinstall

echo [4/5] Installing Python dependencies...
cd mini-services\excel-service
python -m pip install --user -r requirements.txt
cd ..\..

echo [5/5] Initializing database...
call bun run db:push

echo Done. Run START.bat to launch.
pause
```

---

## 12. Чек-лист «запустится ли на Windows 11 без админа»

| # | Проверка | Статус текущий | После фиксов |
|---|----------|----------------|--------------|
| 1 | `bun install` выполняется без admin | ⚠️ Только если Bun уже установлен | ✅ INSTALL.bat ставит Bun per-user |
| 2 | `python -m pip install --user` выполняется без admin | ⚠️ Если Python установлен | ✅ INSTALL.bat проверяет и направляет |
| 3 | `prisma generate` работает без admin | ✅ | ✅ |
| 4 | `prisma db push` на SQLite работает без admin | ✅ (файл в проекте) | ✅ |
| 5 | FastAPI стартует без admin | ✅ | ✅ |
| 6 | Next.js dev/start работает без admin | ✅ | ✅ |
| 7 | Запись в `%LOCALAPPDATA%\OMiK_VSM\data\` | ✅ | ✅ |
| 8 | Запуск `.bat` без admin | ✅ | ✅ |
| 9 | `-ExecutionPolicy Bypass` без admin | ⚠️ На corporate-машине может не сработать | ⚠️ Добавить node-fallback |
| 10 | Caddy (опц.) без admin | ⚠️ Не bundled | ⚠️ Добавить `install-caddy.cmd` с SHA-256 |
| 11 | Redis (опц.) без admin | ❌ Memurai — commercial | ✅ `tporadowski/redis` или skip |
| 12 | Доступ к портам 3000/3031/81 без admin | ✅ (non-privileged ports) | ✅ |
| 13 | Autostart при boot без admin | ❌ Не реализовано | ✅ Shortcut в `shell:startup` |
| 14 | Long-path support (>260 chars) | ⚠️ | ⚠️ Документировать короткий `OMIK_DATA_DIR` |
| 15 | Cyrillic filenames в cmd.exe | ⚠️ | ✅ `chcp 65001` во всех `.bat` |
| 16 | Fresh clone → `INSTALL.bat` → `START.bat` → app работает | ❌ (баги в lockfile, Prisma, bcrypt, paths) | ✅ После Phase 0 + Phase 1 |

---

## 13. Приложения — детальные находки по файлам

Полные списки находок (с указанием конкретных строк, severity, категорий и предлагаемых фиксов) сохранены в:

| Файл | Размер | Кол-во находок |
|------|--------|----------------|
| `/home/z/my-project/audit/findings_python.md` | 45 КБ | 63 (7C/6H/25M/25L) |
| `/home/z/my-project/audit/findings_backend.md` | 48 КБ | 67 (7C/13H/22M/20L+5A) |
| `/home/z/my-project/audit/findings_frontend.md` | 31 КБ | 43 (4C/6H/11M/22L) |
| `/home/z/my-project/audit/findings_configs_deploy.md` | 36 КБ | 43 (8C/9H/12M/14L) |
| `/home/z/my-project/audit/findings_docs_context.md` | 19 КБ | 18 spec deviations |

Эти файлы содержат:
- Точные номера строк для каждой находки.
- Категорию (Security / Quality / Performance / Windows-compat / Bug / Architecture).
- Severity (Critical / High / Medium / Low / Info).
- Описание с примерами кода.
- Конкретные предложения по исправлению (код или конфиг).

---

## Заключение

OMiK — **функционально богатый, но концептуально сырой** проект. Архитектура (Next.js + FastAPI на localhost) разумна для целевой платформы Windows 11 без admin/Docker, и **большинство Windows-блокеров решаемы за 1-2 дня работы**.

Однако перед любым production-использованием (даже single-user на локальной машине!) **обязательно устранить 18 блокеров Фазы 0** — в первую очередь:
1. RCE через макросы (C-Python-1, C-Python-2).
2. Опциональную авторизацию (C-Python-3, C-Backend-3).
3. Path traversal (C-Python-4, C-Python-5).
4. Хардкод пароля `admin2606` в браузере (C-Backend-1).
5. Раскрытие `NEXT_PUBLIC_OMIK_API_SECRET` (C-Backend-2).
6. Сломанный `.gitignore` + слитые credentials (C-Config-1, C-Config-2, C-Config-3).

После Phase 0 + Phase 1 проект **будет запускаться на свежей Windows 11 Pro машине без прав администратора и без Docker** инструкцией `INSTALL.bat` → `START.bat` → `http://127.0.0.1:3000`, оставаясь в рамках 100% FOSS-стека.

Phase 2 и Phase 3 — это улучшения производительности, UX и гигиены кода; их можно выполнять инкрементально.
