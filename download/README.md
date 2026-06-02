# Запуск excel-service (порт 3031)

## Если Kaspersky блокирует PowerShell

Сообщение *«Запуск Windows PowerShell из скрипта JScript»* (Adaptive Anomaly Control) мешает терминалу Cursor и скриптам `.ps1`.

**Используйте запуск без PowerShell:**

```cmd
cd C:\Otchet_OP_Marina\OMiK_VSM
.\.zscripts\start-excel-service.cmd
```

или:

```cmd
python .zscripts\start_excel_service.py
```

Остановка порта 3031:

```cmd
.\.zscripts\stop-excel-service.cmd
```

Ручной запуск (если скрипты недоступны):

```cmd
cd mini-services\excel-service
set UVICORN_WORKERS=1
python app.py
```

Проверка: http://127.0.0.1:3031/api/health

## Где хранятся данные (SQLite, загруженные Excel)

Runtime-файлы **не лежат в папке проекта** — так Next.js/Turbopack не конфликтует с открытыми SQLite.

По умолчанию (Windows):

`%LOCALAPPDATA%\OMiK_VSM\data`

При первом запуске excel-service содержимое старой папки `upload/` в корне проекта переносится туда автоматически.

Свой путь:

```cmd
set OMIK_DATA_DIR=D:\OMiK\data
python .zscripts\start_excel_service.py
```

В Kaspersky можно нажать **«Запросить доступ»** для правила или добавить исключение для `python.exe` и каталога проекта.

## Next.js

```cmd
cd C:\Otchet_OP_Marina\OMiK_VSM
bunx next dev -p 3000
```
