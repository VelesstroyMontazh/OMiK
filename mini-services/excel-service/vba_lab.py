"""
Лаборатория VBA+PY — извлечение макросов из Excel и хранение в JSON.
"""

from __future__ import annotations

import hashlib
import json
import os
import re
import zipfile
from datetime import datetime
from typing import Any, Dict, List, Optional

from data_paths import UPLOAD_DIR

STORE_PATH = os.path.join(UPLOAD_DIR, "vba_laboratory.json")

VBA_EXTENSIONS = {".xlsm", ".xls", ".xla", ".xlam", ".xltm"}


def _ensure_store() -> Dict[str, Any]:
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    if os.path.exists(STORE_PATH):
        with open(STORE_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            data.setdefault("macros", [])
            return data
    return {"macros": [], "updated_at": None}


def _save_store(data: Dict[str, Any]) -> None:
    data["updated_at"] = datetime.now().isoformat()
    with open(STORE_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _macro_id(name: str, code: str) -> str:
    h = hashlib.sha256(f"{name}:{code[:500]}".encode("utf-8", errors="replace")).hexdigest()
    return h[:16]


def _extract_with_oletools(file_path: str) -> List[Dict[str, Any]]:
    from oletools.olevba import VBA_Parser

    macros: List[Dict[str, Any]] = []
    parser = VBA_Parser(file_path)
    try:
        if not parser.detect_vba_macros():
            return macros
        for filename, stream_path, vba_code in parser.extract_macros():
            code = (vba_code or "").strip()
            if not code:
                continue
            name = (filename or stream_path or "VBA_Module").strip()
            name = re.sub(r"[^\w\.\-]+", "_", name) or "VBA_Module"
            macros.append(
                {
                    "id": _macro_id(name, code),
                    "name": name,
                    "stream": stream_path or "",
                    "code": code,
                    "language": "vba",
                }
            )
    finally:
        try:
            parser.close()
        except Exception:
            pass
    return macros


def _extract_fallback_zip(file_path: str) -> List[Dict[str, Any]]:
    """Минимальное определение VBA-проекта без oletools."""
    macros: List[Dict[str, Any]] = []
    try:
        with zipfile.ZipFile(file_path, "r") as zf:
            vba_entries = [n for n in zf.namelist() if "vba" in n.lower()]
            if not vba_entries:
                return macros
            macros.append(
                {
                    "id": _macro_id("vbaProject", file_path),
                    "name": "vbaProject.bin",
                    "stream": "xl/vbaProject.bin",
                    "code": (
                        "' Макросы найдены в файле, но исходный код не извлечён.\n"
                        "' Установите oletools или откройте файл в Excel и экспортируйте модуль вручную."
                    ),
                    "language": "vba",
                    "partial": True,
                }
            )
    except zipfile.BadZipFile:
        pass
    return macros


def extract_vba_from_file(file_path: str) -> Dict[str, Any]:
    if not file_path or not os.path.isfile(file_path):
        return {"error": "Файл не найден", "has_vba": False, "macros": []}

    ext = os.path.splitext(file_path)[1].lower()
    if ext not in VBA_EXTENSIONS:
        return {
            "file_path": file_path,
            "has_vba": False,
            "macros": [],
            "count": 0,
        }

    macros: List[Dict[str, Any]] = []
    try:
        macros = _extract_with_oletools(file_path)
    except ImportError:
        macros = _extract_fallback_zip(file_path)
    except Exception as e:
        macros = _extract_fallback_zip(file_path)
        if not macros:
            return {"error": str(e), "has_vba": False, "macros": []}

    if not macros:
        macros = _extract_fallback_zip(file_path)

    seen = set()
    uniq: List[Dict[str, Any]] = []
    for m in macros:
        mid = m["id"]
        if mid in seen:
            continue
        seen.add(mid)
        uniq.append(m)

    return {
        "file_path": file_path,
        "has_vba": len(uniq) > 0,
        "macros": uniq,
        "count": len(uniq),
    }


def list_stored_macros() -> Dict[str, Any]:
    data = _ensure_store()
    return {
        "macros": data.get("macros", []),
        "count": len(data.get("macros", [])),
        "updated_at": data.get("updated_at"),
    }


def import_macros(
    file_path: str,
    macro_names: Optional[List[str]] = None,
    source_label: Optional[str] = None,
) -> Dict[str, Any]:
    detected = extract_vba_from_file(file_path)
    if detected.get("error"):
        return detected
    if not detected.get("has_vba"):
        return {"error": "В файле не обнаружены VBA-макросы", "imported": 0}

    pick = set(macro_names or [])
    to_import = [
        m
        for m in detected["macros"]
        if not pick or m["name"] in pick or m.get("stream") in pick
    ]
    if not to_import:
        return {"error": "Не выбраны макросы для импорта", "imported": 0}

    store = _ensure_store()
    existing_ids = {m.get("id") for m in store.get("macros", [])}
    imported = 0
    now = datetime.now().isoformat()
    label = source_label or os.path.basename(file_path)

    for m in to_import:
        entry = {
            "id": m["id"],
            "name": m["name"],
            "code": m["code"],
            "language": m.get("language", "vba"),
            "stream": m.get("stream", ""),
            "source_file": file_path,
            "source_label": label,
            "imported_at": now,
            "partial": bool(m.get("partial")),
        }
        idx = next(
            (i for i, x in enumerate(store["macros"]) if x.get("id") == entry["id"]),
            None,
        )
        if idx is not None:
            store["macros"][idx] = {**store["macros"][idx], **entry}
        else:
            store["macros"].append(entry)
            imported += 1
        existing_ids.add(entry["id"])

    _save_store(store)
    return {
        "success": True,
        "imported": imported,
        "updated": len(to_import) - imported,
        "total_in_lab": len(store["macros"]),
        "macros": to_import,
    }


def update_stored_macro(macro_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
    store = _ensure_store()
    for i, m in enumerate(store["macros"]):
        if m.get("id") == macro_id:
            if "name" in updates and updates["name"]:
                store["macros"][i]["name"] = str(updates["name"]).strip()
            if "code" in updates:
                store["macros"][i]["code"] = str(updates["code"])
            if "language" in updates:
                store["macros"][i]["language"] = updates["language"]
            store["macros"][i]["updated_at"] = datetime.now().isoformat()
            _save_store(store)
            return {"success": True, "macro": store["macros"][i]}
    return {"error": "Макрос не найден"}


def delete_stored_macro(macro_id: str) -> Dict[str, Any]:
    store = _ensure_store()
    before = len(store["macros"])
    store["macros"] = [m for m in store["macros"] if m.get("id") != macro_id]
    if len(store["macros"]) == before:
        return {"error": "Макрос не найден"}
    _save_store(store)
    return {"success": True, "deleted": macro_id}
