#!/usr/bin/env python3
"""Проверка Redis (только для опционального режима Celery). Exit 0 = OK."""
from __future__ import annotations

import os
import sys

URL = os.environ.get(
    "CELERY_BROKER_URL",
    os.environ.get("OMIK_REDIS_URL", "redis://127.0.0.1:6379/0"),
)


def main() -> int:
    try:
        import redis
    except ImportError:
        print("Пакет redis не установлен (режим Celery опционален).")
        print("  pip install -r mini-services\\excel-service\\requirements-celery.txt")
        print("Или работайте без Celery: START.bat (очередь in-process).")
        return 1

    try:
        client = redis.from_url(URL, socket_connect_timeout=3)
        client.ping()
    except Exception as exc:
        print(f"Redis недоступен ({URL}): {exc}")
        print()
        print("Celery не обязателен. Для работы без Redis используйте START.bat.")
        print("Если нужен Celery: бесплатный Redis для Windows без Docker, например")
        print("  Memurai Developer (локально, без root): https://www.memurai.com/")
        return 1

    print(f"Redis OK: {URL}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
