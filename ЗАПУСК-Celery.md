# Celery + Redis — только опционально

> **Важно:** для вашего сценария (**без Docker, без root, бесплатно**) Celery **не нужен**.
>
> Используйте **`START.bat`** / **`ЗАПУСК.bat`** — фоновые задачи работают **in-process** (внутри excel-service), Redis и отдельный worker **не требуются**.

Этот файл — только если **сами** решите позже поставить **бесплатный Redis для Windows** (без Docker).

---

## Что не изменилось для обычной работы

| Было | Сейчас |
|------|--------|
| `START.bat` → браузер :3000 | **То же** |
| Без Docker | **По-прежнему** |
| Без платных сервисов | **По-прежнему** |
| Долгий process билетов | `?background=true` → очередь **in-process** (`backend: "inprocess"`) |

Celery в коде — **дополнительный** путь. Включается **только** если вручную задать `OMIK_USE_CELERY=1` **и** установить Redis.

---

## Когда имеет смысл Celery (опционально)

- Нужен отдельный процесс-worker (перезапуск API не убивает задачу).
- Уже есть **бесплатный локальный Redis** без Docker (например Memurai Developer — бесплатно для разработки на одной машине).

**Docker, WSL с root, облачные Redis — не требуются и в инструкции не используются.**

---

## Установка Celery (только по желанию)

```powershell
cd C:\Otchet_OP_Marina\OMiK_VSM
pip install -r mini-services\excel-service\requirements-celery.txt
```

Проверка Redis (если установили Memurai и он слушает 127.0.0.1:6379):

```powershell
python .zscripts\check-redis.py
```

Запуск: **`ЗАПУСК-Celery.bat`** (3 окна: Excel API, Celery worker, Next.js).

---

## Остановка

`СТОП.bat` + закрыть окна Excel API и Celery.

---

## Обычный режим (рекомендуется)

**`INSTALL.bat`** → **`START.bat`** → http://127.0.0.1:3000

Никакого Redis.
