"""
Runtime data directory for excel-service.

Stored outside the Next.js project tree so Turbopack/Tailwind file watchers
never touch open SQLite WAL sidecar files (.sqlite-shm / .sqlite-wal).

Override with env OMIK_DATA_DIR if needed.
"""

from __future__ import annotations

import logging
import os
import shutil
from typing import List

logger = logging.getLogger(__name__)

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
LEGACY_UPLOAD_DIR = os.path.join(PROJECT_ROOT, "upload")

# Основная База: только Excel и SQLite в каталоге upload проекта
MAIN_DB_DIR = os.path.abspath(LEGACY_UPLOAD_DIR)

_migration_done = False


def _default_data_dir() -> str:
    explicit = os.environ.get("OMIK_DATA_DIR", "").strip()
    if explicit:
        return os.path.abspath(explicit)
    if os.name == "nt":
        base = os.environ.get("LOCALAPPDATA") or os.path.expanduser("~")
    else:
        base = os.environ.get("XDG_DATA_HOME") or os.path.join(
            os.path.expanduser("~"), ".local", "share"
        )
    return os.path.join(base, "OMiK_VSM", "data")


def get_upload_dir() -> str:
    path = _default_data_dir()
    os.makedirs(path, exist_ok=True)
    return path


UPLOAD_DIR = get_upload_dir()


def _list_entries(path: str) -> List[str]:
    if not os.path.isdir(path):
        return []
    try:
        return [name for name in os.listdir(path) if name and not name.startswith(".")]
    except OSError:
        return []


def migrate_legacy_upload_dir() -> None:
    """Move project upload/ into the external data dir once (best-effort)."""
    global _migration_done
    if _migration_done:
        return
    _migration_done = True

    legacy = LEGACY_UPLOAD_DIR
    target = get_upload_dir()
    if os.path.normcase(legacy) == os.path.normcase(target):
        return

    legacy_entries = _list_entries(legacy)
    if not legacy_entries:
        return

    target_entries = _list_entries(target)
    if target_entries:
        logger.info(
            "Legacy upload dir %s not migrated: target %s already has data",
            legacy,
            target,
        )
        return

    logger.info("Migrating runtime data from %s to %s", legacy, target)
    for name in legacy_entries:
        src = os.path.join(legacy, name)
        dst = os.path.join(target, name)
        try:
            shutil.move(src, dst)
        except OSError as exc:
            logger.warning("Could not migrate %s: %s", name, exc)
