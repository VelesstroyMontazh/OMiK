# Запуск OMiK_VSM (Windows)

Проверено: `bun run verify:win` → **ALL CHECKS PASSED** (typecheck, lint, excel :3031, pytest).

## Требования

| Компонент | Проверка |
|-----------|----------|
| [Bun](https://bun.sh) | `bun --version` |
| Python 3 | `python --version` |
| Зависимости | один раз `INSTALL.bat` |

Порты: **3000** (Next.js), **3031** (excel-service).

---

## Единственный рекомендуемый способ (каждый день)

### 1. Остановить старые процессы

Дважды щёлкните **`STOP.bat`**  
(или **`СТОП.bat`**). В окне должно быть `Port 3000: free` и `Port 3031: free`.

### 2. Запустить всё

Дважды щёлкните **`START.bat`**  
(или **`ЗАПУСК.bat`**).

В окне дождитесь строки **`Ready`** (Next.js).

### 3. Браузер

Откройте: **http://127.0.0.1:3000**

Внизу справа статус **Python** (зелёный) = excel-service доступен.

---

## Не делайте так

| ❌ | Почему |
|----|--------|
| Только `bunx next dev -p 3000` | Excel **не** стартует → «Excel-service недоступен», upload `fetch failed` |
| `--force-restart` во время очистки/загрузки | Прервёт операцию SQLite |
| Закрыть окно excel с `--foreground`, не запустив снова | Порт 3031 пуст |

---

### Ошибка `WinError 10048` / порт 3031 занят

**Причина:** старый **зависший** `python.exe` держит порт, но не отвечает на `/api/health`.

**Решение (любой вариант):**

1. **STOP.bat** → **START.bat**
2. Или **RESTART-EXCEL.bat** (в корне проекта)
3. Или в cmd:
   ```bat
   python .zscripts\start_excel_service.py --foreground --force-restart
   ```
   (`--force-restart` **обязателен**, если порт занят!)

Проверка: http://127.0.0.1:3031/api/health → `"status":"ok"`

---

1. Закройте **все** вкладки терминала OMiK_VSM / Excel API.
2. **STOP.bat** → порты free.
3. **START.bat** снова — **подождите до 90 секунд** (первый запуск Anaconda/Python может быть медленным).
4. В окне START.bat должно появиться `Готово: http://127.0.0.1:3031/api/health`, затем `Ready` (Next.js).
5. Если снова ошибка — отладка в **одном** окне cmd:

```bat
cd C:\Otchet_OP_Marina\OMiK_VSM
python .zscripts\start_excel_service.py --foreground
```

Текст ошибки (ImportError, ModuleNotFoundError) — пришлите или смотрите `logs\excel-service.log`.

6. Если не хватает Python-пакетов: `INSTALL.bat` или  
   `python -m pip install -r mini-services\excel-service\requirements.txt`

---

## Если excel не отвечает (работал, но перестал)

В **отдельном** окне cmd:

```bat
cd C:\Otchet_OP_Marina\OMiK_VSM
python .zscripts\start_excel_service.py --force-restart
```

Проверка: http://127.0.0.1:3031/api/health → `"status":"ok"`

Лог: `logs\excel-service.log`

Затем **F5** в браузере.

---

## Загрузка больших файлов (18+ MB)

В `.env.local` (уже добавлено):

```env
EXCEL_BACKEND_URL=http://127.0.0.1:3031
NEXT_PUBLIC_EXCEL_BACKEND_URL=http://127.0.0.1:3031
```

После изменения `.env.local` или `next.config.ts` — **перезапустите** Next (`STOP.bat` → `START.bat`).

---

## Автопроверка

```bat
VERIFY.bat
```

или:

```bat
bun run verify:win
```

---

## Файлы

| Файл | Назначение |
|------|------------|
| `INSTALL.bat` | Первичная установка |
| `START.bat` | Excel + Next.js |
| `STOP.bat` | Освободить порты |
| `VERIFY.bat` | Полная проверка |

---

## Затраты по билетам — порядок работы

1. `START.bat` → дождаться **Ready** и **Python** (зелёный).
2. Модуль «Затраты по билетам» → вкладка «Загрузить и обработать».
3. Загрузить файлы на сервер (до 18+ MB — нужны оба сервиса).
4. «Загрузить в реестр» → «Обработать».
5. Перед **очисткой реестра** закройте вкладку «Таблица данных», подождите 10 с.

---

## Предупреждение Next.js

`middleware file convention is deprecated` — переименование в `proxy.ts` в Next 16; на работу **не влияет**.

---

## Документация

- Архитектура: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Инструменты/CI: [docs/TOOLING.md](docs/TOOLING.md)
