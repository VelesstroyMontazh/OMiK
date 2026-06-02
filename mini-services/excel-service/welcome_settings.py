"""Сохранение конфигурации карточек главного экрана."""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List

from data_paths import MAIN_DB_DIR

SETTINGS_DIR = os.path.join(MAIN_DB_DIR, "settings")
WELCOME_MODULES_PATH = os.path.join(SETTINGS_DIR, "welcome_modules.json")


def _ensure() -> None:
    os.makedirs(SETTINGS_DIR, exist_ok=True)


def get_welcome_modules() -> Dict[str, Any]:
    _ensure()
    if not os.path.isfile(WELCOME_MODULES_PATH):
        return {"modules": None}
    try:
        with open(WELCOME_MODULES_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"modules": None}


def save_welcome_modules(modules: List[Dict[str, Any]]) -> Dict[str, Any]:
    _ensure()
    payload = {"modules": modules, "updated_at": __import__("datetime").datetime.now().isoformat()}
    with open(WELCOME_MODULES_PATH, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
    return {"ok": True, "count": len(modules)}
