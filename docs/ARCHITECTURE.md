# Архитектура OMiK_VSM

## Компоненты

```mermaid
flowchart LR
  Browser["Браузер :3000"]
  Next["Next.js App Router"]
  Proxy["/api/excel/* proxy"]
  Excel["excel-service FastAPI :3031"]
  Data["%LOCALAPPDATA%/OMiK_VSM/data"]
  Prisma["SQLite Prisma custom.db"]

  Browser --> Next
  Next --> Proxy
  Proxy --> Excel
  Excel --> Data
  Next --> Prisma
```

## Поток загрузки файла

```mermaid
sequenceDiagram
  participant UI as TicketCostsLoadSection
  participant NX as /api/excel/upload
  participant PY as excel-service
  UI->>NX: POST multipart
  NX->>NX: waitForExcelBackend
  NX->>PY: POST /api/upload
  PY->>PY: save_uploaded_file
  PY-->>NX: file_path, file_id
  NX-->>UI: JSON
```

## Пути API

Константы: `src/lib/api-paths.ts`  
Типы запросов: `src/types/excel-service-schemas.ts` (из `schemas.py`)

## Запуск

См. [LAUNCH.md](../LAUNCH.md) — единственный рекомендуемый способ для Windows.
