"""Celery tasks for long-running Excel operations."""
from __future__ import annotations

import os
import sys

# Worker process must resolve local modules (tickets_costs, etc.)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from celery_app import celery_app

import tickets_costs


@celery_app.task(name="omik.tickets_costs_process", bind=True)
def tickets_costs_process_task(
    self,
    registry: str,
    fuzzy_fio_cutoff: int = 86,
) -> dict:
    result = tickets_costs.process_and_display(registry, fuzzy_fio_cutoff)
    if result.get("error"):
        raise ValueError(result["error"])
    return result
