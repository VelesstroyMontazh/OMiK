"""Celery application (Redis broker + result backend)."""
from __future__ import annotations

import os

from celery import Celery

_broker = os.environ.get(
    "CELERY_BROKER_URL",
    os.environ.get("OMIK_REDIS_URL", "redis://127.0.0.1:6379/0"),
)
_backend = os.environ.get("CELERY_RESULT_BACKEND", _broker)

celery_app = Celery(
    "omik_excel",
    broker=_broker,
    backend=_backend,
    include=["celery_tasks"],
)

celery_app.conf.update(
    task_track_started=True,
    result_extended=True,
    result_expires=86400,
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    worker_prefetch_multiplier=1,
    task_default_queue="omik_excel",
)
