# 🔮 Дополнительные варианты улучшения OMiK_VSM

## 1. Логирование с ротацией 📝

### Python (FastAPI)
```python
import logging
from logging.handlers import RotatingFileHandler
import os

def setup_logging():
    logger = logging.getLogger("uvicorn")
    
    # RotatingFileHandler: 10 MB max, 5 backup files
    handler = RotatingFileHandler(
        "logs/excel-service.log",
        maxBytes=10*1024*1024,
        backupCount=5
    )
    handler.setFormatter(logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    ))
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
```

### Node.js (Next.js)
```bash
npm install winston winston-daily-rotate-file
```

```typescript
// lib/logger.ts
import winston from 'winston';
import 'winston-daily-rotate-file';

const transport = new winston.transports.DailyRotateFile({
  filename: 'logs/omik-vsm-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '10m',
  maxFiles: '5d',
});

export const logger = winston.createLogger({
  level: 'info',
  transports: [transport],
});
```

**Преимущества:**
- ✅ Автоматическая ротация по размеру/времени
- ✅ Хранение только последних 5 файлов
- ✅ Предотвращение заполнения диска

---

## 2. WebSocket / SSE для прогресса операций 🔄

### Backend (FastAPI + Server-Sent Events)
```python
from fastapi.responses import StreamingResponse
import asyncio
import json

async def progress_generator(task_id: str):
    while True:
        progress = await get_task_progress(task_id)
        yield f"data: {json.dumps(progress)}\n\n"
        if progress['status'] == 'completed':
            break
        await asyncio.sleep(0.5)

@app.get("/api/tasks/{task_id}/progress")
async def task_progress(task_id: str):
    return StreamingResponse(
        progress_generator(task_id),
        media_type="text/event-stream"
    )
```

### Frontend (React hook)
```typescript
// hooks/useTaskProgress.ts
export function useTaskProgress(taskId: string) {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const eventSource = new EventSource(`/api/tasks/${taskId}/progress`);
    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setProgress(data.progress);
      if (data.status === 'completed') {
        eventSource.close();
      }
    };
    return () => eventSource.close();
  }, [taskId]);
  
  return progress;
}
```

**Преимущества:**
- ✅ Real-time обновление UI
- ✅ Возможность отмены операции
- ✅ Лучший UX при обработке больших файлов

---

## 3. Кэширование справочников из OMiK/download/ 📚

### Интеграция reference files
```python
# references.py
import pandas as pd
from pathlib import Path
from functools import lru_cache

REFERENCE_DIR = Path(__file__).parent.parent / "OMiK" / "download"

@lru_cache(maxsize=3)
def load_reference_file(filename: str) -> pd.DataFrame:
    """Load and cache reference file."""
    filepath = REFERENCE_DIR / filename
    if not filepath.exists():
        raise FileNotFoundError(f"Reference file not found: {filename}")
    return pd.read_excel(filepath)

def get_user_roles() -> dict:
    """Load Log_pass_role.xlsx and return roles mapping."""
    df = load_reference_file("Log_pass_role.xlsx")
    return dict(zip(df['Login'], df['Role']))

def get_role_permissions() -> dict:
    """Load Role_OP.xlsx and return permissions."""
    df = load_reference_file("Role_OP.xlsx")
    return df.groupby('Role')['Площадка'].apply(list).to_dict()

def get_territory_mapping() -> dict:
    """Load 1С_Территория_в_Площадка.xlsx for territory→site mapping."""
    df = load_reference_file("1С_Территория_в_Площадка.xlsx")
    return dict(zip(df['Территория'], df['Площадка']))
```

**Использование в API:**
```python
@app.post("/api/auth/login")
async def login(credentials: LoginRequest):
    roles = get_user_roles()
    if credentials.login not in roles:
        raise HTTPException(401, "Invalid credentials")
    return {"role": roles[credentials.login]}
```

**Преимущества:**
- ✅ Централизованное управление доступом
- ✅ Быстрое обновление прав без изменения кода
- ✅ Audit trail через Excel файлы

---

## 4. Мониторинг памяти и ресурсов 📊

### Endpoint для метрик
```python
# app.py
import psutil
import os

@app.get("/api/metrics/memory")
async def memory_metrics():
    process = psutil.Process(os.getpid())
    memory_info = process.memory_info()
    
    return {
        "rss_mb": round(memory_info.rss / 1024 / 1024, 2),
        "vms_mb": round(memory_info.vms / 1024 / 1024, 2),
        "percent": round(process.memory_percent(), 2),
        "cache_size": len(main_db._cache_store._cache),
        "cache_max": main_db.MAX_CACHE_SIZE,
        "system_memory": {
            "total_gb": round(psutil.virtual_memory().total / 1024**3, 2),
            "available_gb": round(psutil.virtual_memory().available / 1024**3, 2),
            "percent_used": psutil.virtual_memory().percent,
        }
    }
```

### Dashboard компонент (React)
```typescript
// components/MemoryDashboard.tsx
export function MemoryDashboard() {
  const [metrics, setMetrics] = useState(null);
  
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await fetch('/api/metrics/memory');
      setMetrics(await res.json());
    }, 5000);
    return () => clearInterval(interval);
  }, []);
  
  return (
    <div className="grid grid-cols-3 gap-4">
      <MetricCard label="RSS Memory" value={`${metrics?.rss_mb} MB`} />
      <MetricCard label="Cache Size" value={`${metrics?.cache_size}/${metrics?.cache_max}`} />
      <MetricCard label="System RAM" value={`${metrics?.system_memory.percent_used}%`} />
    </div>
  );
}
```

**Преимущества:**
- ✅ Раннее обнаружение утечек памяти
- ✅ Оптимизация размера кэша
- ✅ Proactive monitoring

---

## 5. Автоматическое резервное копирование БД 💾

### Backup script
```python
# backup_db.py
import sqlite3
import shutil
from datetime import datetime
from pathlib import Path

def create_backup(db_path: str, backup_dir: str = "backups"):
    """Create timestamped backup of SQLite database."""
    Path(backup_dir).mkdir(exist_ok=True)
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = Path(backup_dir) / f"main_db_{timestamp}.sqlite"
    
    # WAL checkpoint before backup
    conn = sqlite3.connect(db_path)
    conn.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    conn.close()
    
    shutil.copy2(db_path, backup_path)
    
    # Keep only last 7 backups
    cleanup_old_backups(backup_dir, keep=7)
    
    return str(backup_path)
```

### Scheduled task (cron/APScheduler)
```python
from apscheduler.schedulers.background import BackgroundScheduler

scheduler = BackgroundScheduler()
scheduler.add_job(
    create_backup,
    'interval',
    hours=6,
    args=['upload/main_db.sqlite']
)
scheduler.start()
```

**Преимущества:**
- ✅ Защита от потери данных
- ✅ Автоматическая очистка старых бэкапов
- ✅ Point-in-time recovery

---

## 6. GraphQL API для сложных запросов 🔍

### Установка
```bash
pip install strawberry-graphql
```

### Schema
```python
# schema.py
import strawberry
from typing import List, Optional

@strawberry.type
class Employee:
    fio: str
    position: str
    territory: str
    site: str
    status: str

@strawberry.type
class Query:
    @strawberry.field
    def employees(
        self,
        site: Optional[str] = None,
        status: Optional[str] = None
    ) -> List[Employee]:
        # Query from main_db with filters
        ...

schema = strawberry.Schema(Query)
```

### Endpoint
```python
from strawberry.fastapi import GraphQLRouter

graphql_app = GraphQLRouter(schema)
app.include_router(graphql_app, prefix="/api/graphql")
```

**Преимущества:**
- ✅ Гибкие запросы на стороне клиента
- ✅ Избегание over-fetching
- ✅ Типобезопасность

---

## 7. Контейнеризация для разработки (опционально) 🐳

### docker-compose.dev.yml
```yaml
version: '3.8'
services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
    ports:
      - "3000:3000"
    volumes:
      - ./src:/app/src
    environment:
      - EXCEL_SERVICE_URL=http://backend:3031
  
  backend:
    build:
      context: ./mini-services/excel-service
      dockerfile: Dockerfile
    ports:
      - "3031:3031"
    volumes:
      - ./mini-services/excel-service:/app
      - ./upload:/app/upload
    environment:
      - OMIK_API_SECRET=dev-secret

volumes:
  upload:
```

**Преимущества:**
- ✅ Изолированная среда разработки
- ✅ Воспроизводимость окружения
- ✅ Упрощённый onboarding новых разработчиков

---

## 8. CI/CD Pipeline enhancements 🚀

### GitHub Actions с тестами
```yaml
# .github/workflows/ci.yml
name: CI/CD

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Bun
        uses: oven-sh/setup-bun@v1
      
      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Install dependencies
        run: |
          bun install
          pip install -r mini-services/excel-service/requirements.txt
      
      - name: Run pre-commit
        run: |
          pip install pre-commit
          pre-commit run --all-files
      
      - name: Run tests
        run: |
          bun run test:unit
          cd mini-services/excel-service && pytest tests/ -v
      
      - name: Security audit
        run: |
          bun pm audit --audit-level=moderate
          pip install pip-audit
          pip-audit -r mini-services/excel-service/requirements.txt
```

**Преимущества:**
- ✅ Автоматическая проверка каждого коммита
- ✅ Раннее обнаружение уязвимостей
- ✅ Гарантия качества кода

---

## 9. Документация API с OpenAPI/Swagger 📖

### Настройка в FastAPI
```python
app = FastAPI(
    title="OMiK VSM Excel Service",
    description="API для обработки Excel файлов и управления данными сотрудников",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)
```

### Пример с документацией
```python
@app.post(
    "/api/upload",
    summary="Загрузить Excel файл",
    description="Загружает Excel файл в систему и возвращает метаданные",
    response_description="Метаданные загруженного файла",
    tags=["Files"]
)
@rate_limiter.limit("10/minute")
async def upload_file(
    file: UploadFile = File(..., description="Excel файл (.xlsx, .xls, .xlsm)")
):
    """
    ### Поддерживаемые форматы:
    - .xlsx (Office Open XML)
    - .xls (BIFF8)
    - .xlsm (с макросами)
    - .csv, .tsv (текстовые)
    
    ### Ограничения:
    - Максимальный размер: 250 MB
    - Rate limit: 10 файлов в минуту
    """
    ...
```

**Преимущества:**
- ✅ Интерактивная документация
- ✅ Auto-generated SDK для клиентов
- ✅ Always up-to-date

---

## 10. Unit/Integration тесты для reference files 🧪

```python
# tests/test_references.py
import pytest
from references import get_user_roles, get_role_permissions

def test_log_pass_role_structure():
    roles = get_user_roles()
    assert isinstance(roles, dict)
    assert 'admin' in roles
    assert roles['admin'] == 'Administrator'

def test_role_op_permissions():
    perms = get_role_permissions()
    assert isinstance(perms, dict)
    assert 'Operator' in perms
    assert len(perms['Operator']) > 0

def test_territory_mapping():
    mapping = get_territory_mapping()
    assert isinstance(mapping, dict)
    # Проверка что все территории мапятся на площадки
    for territory, site in mapping.items():
        assert site is not None
```

**Преимущества:**
- ✅ Гарантия целостности справочников
- ✅ Раннее обнаружение ошибок в данных
- ✅ Regression testing

---

## 📊 Приоритизация улучшений

| Улучшение | Сложность | Польза | Приоритет |
|-----------|-----------|--------|-----------|
| Логирование с ротацией | Низкая | Высокая | 🔴 Высокий |
| WebSocket прогресс | Средняя | Высокая | 🔴 Высокий |
| Кэширование справочников | Низкая | Средняя | 🟡 Средний |
| Мониторинг памяти | Низкая | Средняя | 🟡 Средний |
| Backup БД | Низкая | Высокая | 🔴 Высокий |
| GraphQL API | Высокая | Средняя | 🟢 Низкий |
| Docker dev | Средняя | Средняя | 🟢 Низкий |
| CI/CD enhancement | Средняя | Высокая | 🔴 Высокий |
| Swagger документация | Низкая | Высокая | 🔴 Высокий |
| Тесты reference files | Низкая | Средняя | 🟡 Средний |

---

## 🎯 Roadmap на следующий квартал

### Q1 (Месяц 1-2)
- [ ] Логирование с ротацией
- [ ] Backup БД
- [ ] Swagger документация
- [ ] Тесты reference files

### Q2 (Месяц 3-4)
- [ ] WebSocket прогресс операций
- [ ] Мониторинг памяти
- [ ] CI/CD enhancement

### Q3 (Месяц 5-6)
- [ ] Кэширование справочников
- [ ] GraphQL API (опционально)
- [ ] Docker dev окружение

---

*Документ создан для планирования будущих улучшений*
