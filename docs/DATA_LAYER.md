# Слой данных OMiK_VSM

## Две базы — зачем

| Хранилище | Путь | Назначение |
|-----------|------|------------|
| **Prisma SQLite** | `DATABASE_URL` → `db/custom.db` | Метаданные файлов Excel в UI: `ExcelFile`, `Macro`, `Operation` |
| **Python SQLite** | `%LOCALAPPDATA%\OMiK_VSM\data\` (`OMIK_DATA_DIR`) | Рабочие данные: основная БД, календарь, билеты VSM/SK |

## Основная БД сотрудников

- **Источник правды:** `mini-services/excel-service/main_db.py` → `main_db.sqlite` в каталоге данных.
- UI: панель «Основная БД» (`MainDatabasePanel.tsx`) → кнопка **«Обновить из Excel»** (`force_reload`).
- Положите актуальный выгруз из 1С (`.xlsx`) в `%LOCALAPPDATA%\OMiK_VSM\data\` (приоритет — имя с `1С` / `1C`) и нажмите **Обновить из Excel**.
- Столбцы **Удостоверение.Серия** (4 цифры) и **Удостоверение.Номер** (6 цифр) хранятся как текст с ведущими нулями.
- Модель Prisma `MainDatabase` **не используется** — оставлена для совместимости схемы.

## Билеты и календарь

- Билеты (затраты, реестры): `tickets_costs.py`, `tickets_db.py`
- Календарь: `calendar_db.py`
- Все SQLite-файлы в `%LOCALAPPDATA%\OMiK_VSM\data\` — вне дерева Next.js (WAL не ломает Turbopack).

## API

- Next.js прокси: `/api/excel/*` → FastAPI `:3031`
- Опциональная защита: `OMIK_API_SECRET` + заголовок `X-OMIK-Token` (Next middleware + FastAPI middleware)
