"""
Реестр параллельных экземпляров Основной Базы (SQLite) в upload/instances/.
"""

from __future__ import annotations

import json
import os
import shutil
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from data_paths import MAIN_DB_DIR

INSTANCES_DIR = os.path.join(MAIN_DB_DIR, "instances")
REGISTRY_PATH = os.path.join(MAIN_DB_DIR, "main_db_registry.json")
EXPORTS_DIR = os.path.join(MAIN_DB_DIR, "exports")

LEGACY_DB = os.path.join(MAIN_DB_DIR, "main_db.sqlite")
LEGACY_META = os.path.join(MAIN_DB_DIR, "main_db_meta.json")


def _ensure_dirs() -> None:
    os.makedirs(INSTANCES_DIR, exist_ok=True)
    os.makedirs(EXPORTS_DIR, exist_ok=True)


def _read_registry() -> Dict[str, Any]:
    _ensure_dirs()
    if not os.path.isfile(REGISTRY_PATH):
        return {"active_id": None, "entries": []}
    try:
        with open(REGISTRY_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        if "entries" not in data:
            data["entries"] = []
        return data
    except Exception:
        return {"active_id": None, "entries": []}


def _write_registry(data: Dict[str, Any]) -> None:
    _ensure_dirs()
    with open(REGISTRY_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def instance_dir(instance_id: str) -> str:
    return os.path.join(INSTANCES_DIR, instance_id)


def instance_db_path(instance_id: str) -> str:
    return os.path.join(instance_dir(instance_id), "main_db.sqlite")


def instance_meta_path(instance_id: str) -> str:
    return os.path.join(instance_dir(instance_id), "meta.json")


def new_instance_id() -> str:
    return datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:8]


def migrate_legacy_if_needed() -> None:
    """Переносит старую одиночную main_db.sqlite в instances/."""
    _ensure_dirs()
    reg = _read_registry()
    if reg.get("entries"):
        return
    if not os.path.isfile(LEGACY_DB):
        return

    inst_id = "legacy"
    dest = instance_dir(inst_id)
    os.makedirs(dest, exist_ok=True)
    dest_db = instance_db_path(inst_id)
    dest_meta = instance_meta_path(inst_id)

    if not os.path.isfile(dest_db):
        shutil.copy2(LEGACY_DB, dest_db)
    if os.path.isfile(LEGACY_META) and not os.path.isfile(dest_meta):
        shutil.copy2(LEGACY_META, dest_meta)
    elif os.path.isfile(dest_meta):
        pass
    else:
        with open(dest_meta, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "source_excel": "",
                    "file_path": "",
                    "loaded_at": datetime.fromtimestamp(os.path.getmtime(dest_db)).isoformat(),
                    "row_count": 0,
                    "col_count": 0,
                },
                f,
                ensure_ascii=False,
            )

    meta = _read_instance_meta(inst_id)
    entry = {
        "id": inst_id,
        "source_excel": meta.get("source_excel") or meta.get("file_path") or "",
        "loaded_at": meta.get("loaded_at"),
        "row_count": meta.get("row_count", 0),
        "col_count": meta.get("col_count", 0),
    }
    reg["entries"] = [entry]
    reg["active_id"] = inst_id
    _write_registry(reg)


def get_active_id() -> Optional[str]:
    migrate_legacy_if_needed()
    reg = _read_registry()
    active = reg.get("active_id")
    if active and _entry_exists(active):
        return active
    entries = reg.get("entries") or []
    if entries:
        return entries[-1]["id"]
    return None


def _entry_exists(instance_id: str) -> bool:
    return os.path.isfile(instance_db_path(instance_id))


def active_db_path() -> Optional[str]:
    aid = get_active_id()
    if not aid:
        if os.path.isfile(LEGACY_DB):
            return LEGACY_DB
        return None
    path = instance_db_path(aid)
    return path if os.path.isfile(path) else None


def active_meta_path() -> Optional[str]:
    aid = get_active_id()
    if not aid:
        if os.path.isfile(LEGACY_META):
            return LEGACY_META
        return None
    path = instance_meta_path(aid)
    return path if os.path.isfile(path) else None


def _read_instance_meta(instance_id: str) -> Dict[str, Any]:
    path = instance_meta_path(instance_id)
    if not os.path.isfile(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def list_instances() -> List[Dict[str, Any]]:
    migrate_legacy_if_needed()
    reg = _read_registry()
    active_id = get_active_id()
    result: List[Dict[str, Any]] = []
    for entry in reg.get("entries") or []:
        iid = entry["id"]
        meta = _read_instance_meta(iid)
        src = meta.get("source_excel") or meta.get("file_path") or entry.get("source_excel") or ""
        loaded_at = meta.get("loaded_at") or entry.get("loaded_at")
        result.append(
            {
                "id": iid,
                "source_excel": src,
                "file_name": os.path.basename(src) if src else f"База {iid}",
                "loaded_at": loaded_at,
                "row_count": meta.get("row_count", entry.get("row_count", 0)),
                "col_count": meta.get("col_count", entry.get("col_count", 0)),
                "is_active": iid == active_id,
                "exists": _entry_exists(iid),
            }
        )
    return result


def register_instance(
    instance_id: str,
    *,
    source_excel: str,
    meta: Dict[str, Any],
    set_active: bool = False,
) -> Dict[str, Any]:
    _ensure_dirs()
    inst_path = instance_dir(instance_id)
    os.makedirs(inst_path, exist_ok=True)
    meta_path = instance_meta_path(instance_id)
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    reg = _read_registry()
    entries = [e for e in (reg.get("entries") or []) if e.get("id") != instance_id]
    entries.append(
        {
            "id": instance_id,
            "source_excel": source_excel,
            "loaded_at": meta.get("loaded_at"),
            "row_count": meta.get("row_count", 0),
            "col_count": meta.get("col_count", 0),
        }
    )
    reg["entries"] = entries
    if set_active or not reg.get("active_id"):
        reg["active_id"] = instance_id
    _write_registry(reg)
    return {"id": instance_id, "is_active": reg["active_id"] == instance_id}


def activate_instance(instance_id: str) -> Dict[str, Any]:
    migrate_legacy_if_needed()
    if not _entry_exists(instance_id):
        return {"ok": False, "error": f"Экземпляр не найден: {instance_id}"}
    reg = _read_registry()
    reg["active_id"] = instance_id
    _write_registry(reg)
    return {"ok": True, "active_id": instance_id}


def delete_instance(instance_id: str) -> Dict[str, Any]:
    migrate_legacy_if_needed()
    reg = _read_registry()
    active_id = reg.get("active_id")
    folder = instance_dir(instance_id)
    if os.path.isdir(folder):
        shutil.rmtree(folder, ignore_errors=True)
    reg["entries"] = [e for e in (reg.get("entries") or []) if e.get("id") != instance_id]
    if active_id == instance_id:
        reg["active_id"] = reg["entries"][-1]["id"] if reg["entries"] else None
    _write_registry(reg)
    return {"ok": True, "deleted_id": instance_id, "active_id": reg.get("active_id")}


def paths_for_load(instance_id: str) -> tuple[str, str, str]:
    """db_path, build_path, meta_path для новой загрузки."""
    inst = instance_dir(instance_id)
    os.makedirs(inst, exist_ok=True)
    db = instance_db_path(instance_id)
    return db, db + ".building", instance_meta_path(instance_id)
