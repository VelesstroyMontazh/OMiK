"""
Tickets Registry — stores ticket expense reports (.xlsm/.xlsx) per organization in SQLite.

Supported registries:
  - vsm (ВСМ)
  - sk  (СК)
"""

import os
import json
import re
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional

import pandas as pd
import numpy as np

from data_paths import UPLOAD_DIR

REGISTRY_VSM = "vsm"
REGISTRY_SK = "sk"
VALID_REGISTRIES = (REGISTRY_VSM, REGISTRY_SK)
REGISTRY_LABELS: Dict[str, str] = {
    REGISTRY_VSM: "ВелесстройМонтаж",
    REGISTRY_SK: "Стройконстракшен",
}

# Legacy single-registry files (migrated to vsm on first access)
LEGACY_DB_PATH = os.path.join(UPLOAD_DIR, "tickets_registry.sqlite")
LEGACY_META_PATH = os.path.join(UPLOAD_DIR, "tickets_registry_meta.json")


def _registry_paths(registry: str) -> Dict[str, str]:
    return {
        "db": os.path.join(UPLOAD_DIR, f"tickets_registry_{registry}.sqlite"),
        "meta": os.path.join(UPLOAD_DIR, f"tickets_registry_{registry}_meta.json"),
    }


def _empty_cache_entry() -> Dict[str, Any]:
    return {
        "loaded": False,
        "file_path": None,
        "sheet_name": None,
        "loaded_at": None,
        "row_count": 0,
        "col_count": 0,
        "columns": [],
        "passport_column": None,
    }


_cache: Dict[str, Dict[str, Any]] = {
    REGISTRY_VSM: _empty_cache_entry(),
    REGISTRY_SK: _empty_cache_entry(),
}


def _sanitize_col_name(name: str) -> str:
    s = str(name).strip()
    s = re.sub(r"[^\w\s\.\-]", "_", s, flags=re.UNICODE)
    s = re.sub(r"\s+", "_", s)
    if not s or s[0].isdigit():
        s = f"col_{s}"
    return s[:120]


def _atomic_replace_file(src_path: str, dest_path: str) -> None:
    dest_dir = os.path.dirname(dest_path) or "."
    os.makedirs(dest_dir, exist_ok=True)
    backup_path = f"{dest_path}.bak"
    if os.path.exists(backup_path):
        os.remove(backup_path)
    if os.path.exists(dest_path):
        os.replace(dest_path, backup_path)
    try:
        os.replace(src_path, dest_path)
        if os.path.exists(backup_path):
            os.remove(backup_path)
    except Exception:
        if os.path.exists(backup_path) and not os.path.exists(dest_path):
            os.replace(backup_path, dest_path)
        raise


def _detect_passport_column(columns: List[str]) -> Optional[str]:
    for c in columns:
        if "паспорт" in str(c).lower():
            return c
    if len(columns) >= 10:
        return columns[9]
    return None


def _convert_value_for_json(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (pd.Timestamp, datetime)):
        return str(value)
    if isinstance(value, float) and np.isnan(value):
        return None
    if isinstance(value, (np.integer,)):
        return int(value)
    if isinstance(value, (np.floating,)):
        if np.isnan(value):
            return None
        return float(value)
    if isinstance(value, np.bool_):
        return bool(value)
    return value


def normalize_registry(registry: Optional[str]) -> str:
    if registry is None or str(registry).strip() == "":
        return REGISTRY_VSM
    r = str(registry).strip().lower()
    aliases = {
        "всм": REGISTRY_VSM,
        "vsm": REGISTRY_VSM,
        "ск": REGISTRY_SK,
        "sk": REGISTRY_SK,
    }
    if r in aliases:
        return aliases[r]
    if r in VALID_REGISTRIES:
        return r
    raise ValueError(f"Неизвестный реестр: {registry}. Допустимо: vsm (ВСМ), sk (СК)")


def _migrate_legacy_to_vsm() -> None:
    """Move old single-registry storage to vsm if present."""
    paths = _registry_paths(REGISTRY_VSM)
    if os.path.exists(paths["db"]) or os.path.exists(paths["meta"]):
        return
    if os.path.exists(LEGACY_DB_PATH) and os.path.exists(LEGACY_META_PATH):
        os.replace(LEGACY_DB_PATH, paths["db"])
        os.replace(LEGACY_META_PATH, paths["meta"])


def _load_meta_from_disk(registry: str) -> bool:
    global _cache
    if _cache[registry]["loaded"]:
        return True

    if registry == REGISTRY_VSM:
        _migrate_legacy_to_vsm()

    paths = _registry_paths(registry)
    if os.path.exists(paths["meta"]) and os.path.exists(paths["db"]):
        try:
            with open(paths["meta"], "r", encoding="utf-8") as f:
                meta = json.load(f)
            _cache[registry] = {
                "loaded": True,
                "file_path": meta.get("file_path"),
                "sheet_name": meta.get("sheet_name"),
                "loaded_at": meta.get("loaded_at"),
                "row_count": meta.get("row_count", 0),
                "col_count": meta.get("col_count", 0),
                "columns": meta.get("columns", []),
                "passport_column": meta.get("passport_column"),
            }
            return True
        except Exception:
            return False
    return False


def is_loaded(registry: str = REGISTRY_VSM) -> bool:
    registry = normalize_registry(registry)
    if _cache[registry]["loaded"]:
        return True
    return _load_meta_from_disk(registry)


def get_status(registry: Optional[str] = None) -> Dict[str, Any]:
    if registry is not None:
        reg = normalize_registry(registry)
        if not is_loaded(reg):
            return {
                "registry": reg,
                "label": REGISTRY_LABELS[reg],
                "loaded": False,
            }
        return {
            "registry": reg,
            "label": REGISTRY_LABELS[reg],
            "loaded": True,
            "file_path": _cache[reg]["file_path"],
            "sheet_name": _cache[reg]["sheet_name"],
            "loaded_at": _cache[reg]["loaded_at"],
            "row_count": _cache[reg]["row_count"],
            "col_count": _cache[reg]["col_count"],
            "columns": _cache[reg]["columns"],
            "passport_column": _cache[reg]["passport_column"],
        }

    registries: Dict[str, Any] = {}
    any_loaded = False
    for reg in VALID_REGISTRIES:
        st = get_status(reg)
        registries[reg] = st
        if st.get("loaded"):
            any_loaded = True
    return {"loaded": any_loaded, "registries": registries}


def load_tickets_registry(
    file_path: str,
    registry: str = REGISTRY_VSM,
    sheet_name: Optional[str] = None,
) -> Dict[str, Any]:
    """Load ticket registry from Excel into SQLite for vsm or sk."""
    global _cache

    try:
        reg = normalize_registry(registry)
    except ValueError as e:
        return {"error": str(e)}

    if not file_path:
        label = REGISTRY_LABELS[reg]
        return {"error": f"Не указан путь к файлу реестра билетов ({label})"}
    if not os.path.exists(file_path):
        return {"error": f"Файл не найден: {file_path}"}
    if not os.path.isfile(file_path):
        return {"error": f"Это не файл: {file_path}"}

    ext = os.path.splitext(file_path)[1].lower()
    if ext not in {".xlsx", ".xlsm", ".xls"}:
        return {"error": f"Неподдерживаемый формат: {ext}"}

    paths = _registry_paths(reg)

    try:
        xls = pd.ExcelFile(file_path, engine="openpyxl")
        target_sheet = sheet_name or (xls.sheet_names[0] if xls.sheet_names else None)
        if not target_sheet:
            return {"error": "Не удалось определить лист файла"}

        df = pd.read_excel(
            file_path,
            sheet_name=target_sheet,
            header=0,
            dtype=object,
            engine="openpyxl",
        )
        if df.empty:
            return {"error": "Файл реестра пустой"}

        original_columns = [str(c) for c in df.columns]
        col_mapping: Dict[str, str] = {}
        sanitized_names: List[str] = []
        for col in original_columns:
            sanitized = _sanitize_col_name(col)
            base = sanitized
            counter = 1
            while sanitized in sanitized_names:
                sanitized = f"{base}_{counter}"
                counter += 1
            col_mapping[col] = sanitized
            sanitized_names.append(sanitized)

        df = df.rename(columns=col_mapping)

        os.makedirs(UPLOAD_DIR, exist_ok=True)
        tmp_path = f"{paths['db']}.tmp"
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

        conn = sqlite3.connect(tmp_path)
        try:
            df.to_sql("tickets_records", conn, if_exists="replace", index=False)
            passport_sanitized = col_mapping.get(
                _detect_passport_column(original_columns) or "", ""
            )
            if passport_sanitized:
                conn.execute(
                    f'CREATE INDEX IF NOT EXISTS idx_passport ON tickets_records ("{passport_sanitized}")'
                )
            conn.commit()
        finally:
            conn.close()

        _atomic_replace_file(tmp_path, paths["db"])

        passport_orig = _detect_passport_column(original_columns)
        meta = {
            "registry": reg,
            "label": REGISTRY_LABELS[reg],
            "file_path": file_path,
            "sheet_name": target_sheet,
            "loaded_at": datetime.now().isoformat(),
            "row_count": int(len(df)),
            "col_count": int(len(original_columns)),
            "columns": original_columns,
            "col_mapping": col_mapping,
            "passport_column": passport_orig,
        }
        with open(paths["meta"], "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

        _cache[reg] = {
            "loaded": True,
            "file_path": file_path,
            "sheet_name": target_sheet,
            "loaded_at": meta["loaded_at"],
            "row_count": meta["row_count"],
            "col_count": meta["col_count"],
            "columns": original_columns,
            "passport_column": passport_orig,
        }

        return {
            "registry": reg,
            "label": REGISTRY_LABELS[reg],
            "loaded": True,
            "file_path": file_path,
            "sheet_name": target_sheet,
            "row_count": meta["row_count"],
            "col_count": meta["col_count"],
            "columns": original_columns,
            "passport_column": passport_orig,
        }
    except Exception as e:
        tmp = f"{paths['db']}.tmp"
        if os.path.exists(tmp):
            try:
                os.remove(tmp)
            except OSError:
                pass
        label = REGISTRY_LABELS.get(reg, reg)
        return {"error": f"Ошибка загрузки реестра билетов ({label}): {str(e)}"}


def get_registry_data(
    registry: str = REGISTRY_VSM,
    search: Optional[str] = None,
    offset: int = 0,
    limit: int = 200,
) -> Dict[str, Any]:
    try:
        reg = normalize_registry(registry)
    except ValueError as e:
        return {"error": str(e), "data": [], "total": 0}

    label = REGISTRY_LABELS[reg]
    if not is_loaded(reg):
        return {
            "error": f"Реестр билетов ({label}) не загружен",
            "registry": reg,
            "label": label,
            "data": [],
            "total": 0,
        }

    paths = _registry_paths(reg)
    conn = sqlite3.connect(paths["db"])
    conn.row_factory = sqlite3.Row
    try:
        where_clause = ""
        params: List[Any] = []
        if search:
            with open(paths["meta"], "r", encoding="utf-8") as f:
                meta = json.load(f)
            col_mapping = meta.get("col_mapping", {})
            passport_col = meta.get("passport_column")
            conditions = []
            if passport_col and passport_col in col_mapping:
                s_col = col_mapping[passport_col]
                conditions.append(f'CAST("{s_col}" AS TEXT) LIKE ?')
                params.append(f"%{search}%")
            for key in list(col_mapping.values())[:8]:
                conditions.append(f'CAST("{key}" AS TEXT) LIKE ?')
                params.append(f"%{search}%")
            if conditions:
                where_clause = f"WHERE {' OR '.join(conditions[:12])}"

        total = conn.execute(
            f"SELECT COUNT(*) FROM tickets_records {where_clause}",
            params,
        ).fetchone()[0]

        rows = conn.execute(
            f"SELECT * FROM tickets_records {where_clause} LIMIT ? OFFSET ?",
            params + [limit, offset],
        ).fetchall()

        with open(paths["meta"], "r", encoding="utf-8") as f:
            meta = json.load(f)
        reverse_map = {v: k for k, v in meta.get("col_mapping", {}).items()}

        data = []
        for row in rows:
            record: Dict[str, Any] = {}
            for key in row.keys():
                display_key = reverse_map.get(key, key)
                record[display_key] = _convert_value_for_json(row[key])
            data.append(record)

        return {
            "registry": reg,
            "label": label,
            "data": data,
            "total": total,
            "offset": offset,
            "limit": limit,
            "has_more": (offset + limit) < total,
        }
    finally:
        conn.close()


def read_registry_dataframe(registry: str = REGISTRY_VSM) -> tuple[pd.DataFrame, str, str]:
    """
    Read full registry for merge operations.
    Returns (dataframe with original column names, passport column name, sheet name).
    """
    reg = normalize_registry(registry)
    label = REGISTRY_LABELS[reg]
    if not is_loaded(reg):
        raise ValueError(f"Реестр билетов ({label}) не загружен")

    paths = _registry_paths(reg)
    with open(paths["meta"], "r", encoding="utf-8") as f:
        meta = json.load(f)

    conn = sqlite3.connect(paths["db"])
    try:
        df = pd.read_sql_query("SELECT * FROM tickets_records", conn)
    finally:
        conn.close()

    col_mapping = meta.get("col_mapping", {})
    reverse_map = {v: k for k, v in col_mapping.items()}
    df = df.rename(columns=reverse_map)
    passport_col = meta.get("passport_column") or _detect_passport_column(list(df.columns))
    sheet_name = meta.get("sheet_name") or f"Реестр_{label}"
    return df, str(passport_col) if passport_col else "", sheet_name


def clear_cache(registry: Optional[str] = None) -> Dict[str, Any]:
    global _cache

    if registry is None:
        cleared = []
        for reg in VALID_REGISTRIES:
            clear_cache(reg)
            cleared.append(reg)
        return {"cleared": True, "registries": cleared}

    reg = normalize_registry(registry)
    paths = _registry_paths(reg)
    if os.path.exists(paths["db"]):
        os.remove(paths["db"])
    if os.path.exists(paths["meta"]):
        os.remove(paths["meta"])
    _cache[reg] = _empty_cache_entry()
    return {"cleared": True, "registry": reg, "label": REGISTRY_LABELS[reg]}
