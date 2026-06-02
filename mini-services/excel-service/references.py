"""
Справочники: территория→площадка, подразделение→площадка (затраты), логины/пароли/площадки/статусы.
Файлы: upload/справочники/*.xlsx
"""

from __future__ import annotations

import json
import os
import re
import sqlite3
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd

from data_paths import LEGACY_UPLOAD_DIR, UPLOAD_DIR
import main_db
import main_db_registry as registry

TERRITORY_FILE = "1С_Территория_в_Площадка.xlsx"
PODR_FILE = "Подр_Площадка_Затраты.xlsx"
LOGIN_FILE = "Login_Pass_Status.xlsx"
CACHE_JSON = "references_cache.json"


def _match_territory_file(name: str) -> bool:
    n = name.lower()
    return n.endswith(".xlsx") and "территория" in n and "площадка" in n


def _match_podr_file(name: str) -> bool:
    n = name.lower()
    return n.endswith(".xlsx") and "подр" in n and "площадка" in n and "затрат" in n


def _match_login_file(name: str) -> bool:
    return name.lower() == LOGIN_FILE.lower()


def resolve_reference_files(ref_dir: Optional[str] = None) -> Dict[str, str]:
    """Найти фактические пути (допускается 1С/1C и мелкие отличия в имени)."""
    directory = ref_dir or references_dir()
    out = {
        "territory_path": "",
        "territory_name": "",
        "podr_path": "",
        "podr_name": "",
        "login_path": "",
        "login_name": "",
    }
    if not os.path.isdir(directory):
        return out
    try:
        names = os.listdir(directory)
    except OSError:
        return out
    for name in names:
        if name.startswith("~$"):
            continue
        full = os.path.join(directory, name)
        if not os.path.isfile(full):
            continue
        if not out["territory_path"] and _match_territory_file(name):
            out["territory_path"] = full
            out["territory_name"] = name
        elif not out["podr_path"] and _match_podr_file(name):
            out["podr_path"] = full
            out["podr_name"] = name
        elif not out["login_path"] and _match_login_file(name):
            out["login_path"] = full
            out["login_name"] = name
    return out

ACTIVE_STATUS_MARKERS = ("актив", "актив.")


def _norm_key(value: Any) -> str:
    if value is None:
        return ""
    s = str(value).strip().lower()
    s = re.sub(r"\s+", " ", s)
    return s


def references_dir() -> str:
    for base in (LEGACY_UPLOAD_DIR, UPLOAD_DIR):
        path = os.path.join(base, "справочники")
        if os.path.isdir(path):
            return path
    path = os.path.join(LEGACY_UPLOAD_DIR, "справочники")
    os.makedirs(path, exist_ok=True)
    return path


def _cache_path() -> str:
    return os.path.join(references_dir(), CACHE_JSON)


def _read_two_column_map(path: str) -> Dict[str, str]:
    if not os.path.isfile(path):
        return {}
    df = pd.read_excel(path, header=None, engine="openpyxl")
    out: Dict[str, str] = {}
    for _, row in df.iterrows():
        if len(row) < 2:
            continue
        a = _norm_key(row.iloc[0])
        b = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ""
        if not a or a in ("nan", "территория", "подразделение", "площадка"):
            continue
        if b and b.lower() != "nan":
            out[a] = b
    return out


def _read_login_file(path: str) -> Tuple[List[Dict[str, Any]], Dict[str, str]]:
  users: List[Dict[str, Any]] = []
  site_status: Dict[str, str] = {}
  if not os.path.isfile(path):
    return users, site_status
  df = pd.read_excel(path, header=None, engine="openpyxl")
  for _, row in df.iterrows():
    if len(row) < 2:
      continue
    login = str(row.iloc[0]).strip() if pd.notna(row.iloc[0]) else ""
    password = str(row.iloc[1]).strip() if pd.notna(row.iloc[1]) else ""
    sites_raw = str(row.iloc[2]).strip() if len(row) > 2 and pd.notna(row.iloc[2]) else ""
    status = str(row.iloc[3]).strip() if len(row) > 3 and pd.notna(row.iloc[3]) else ""
    if not login or login.lower() in ("логин", "login"):
      continue
    sites = [s.strip() for s in re.split(r"[;,|]", sites_raw) if s.strip()]
    role = "admin" if login.lower() in ("admin", "админ") else (
      "cok" if login.lower() in ("цок", "cok") else "user"
    )
    users.append({
      "login": login,
      "password": password,
      "sites": sites,
      "role": role,
      "status": status,
    })
    for site in sites:
      key = _norm_key(site)
      if key and status:
        prev = site_status.get(key, "")
        if not prev or _is_active_status(status):
          site_status[key] = status
  return users, site_status


def _is_active_status(status: str) -> bool:
    s = _norm_key(status)
    return any(m in s for m in ACTIVE_STATUS_MARKERS)


def load_from_disk() -> Dict[str, Any]:
    """Прочитать xlsx из каталога справочников и сохранить кэш JSON."""
    ref_dir = references_dir()
    terr_path = os.path.join(ref_dir, TERRITORY_FILE)
    podr_path = os.path.join(ref_dir, PODR_FILE)
    login_path = os.path.join(ref_dir, LOGIN_FILE)

    territory_to_site = _read_two_column_map(terr_path)
    podr_to_site = _read_two_column_map(podr_path)
    users, site_status = _read_login_file(login_path)

    payload = {
      "loaded_at": datetime.now().isoformat(),
      "references_dir": ref_dir,
      "files": {
        TERRITORY_FILE: os.path.isfile(terr_path),
        PODR_FILE: os.path.isfile(podr_path),
        LOGIN_FILE: os.path.isfile(login_path),
      },
      "counts": {
        "territory_to_site": len(territory_to_site),
        "podr_to_site": len(podr_to_site),
        "users": len(users),
        "site_status": len(site_status),
      },
      "territory_to_site": territory_to_site,
      "podr_to_site": podr_to_site,
      "users": users,
      "site_status": site_status,
    }
    with open(_cache_path(), "w", encoding="utf-8") as f:
      json.dump(payload, f, ensure_ascii=False, indent=2)
    return payload


def get_cached() -> Dict[str, Any]:
    path = _cache_path()
    if os.path.isfile(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except (json.JSONDecodeError, OSError):
            pass
    return load_from_disk()


def status() -> Dict[str, Any]:
    ref_dir = references_dir()
    resolved = resolve_reference_files(ref_dir)
    cached = get_cached() if os.path.isfile(_cache_path()) else None
    return {
      "references_dir": ref_dir,
      "resolved_files": resolved,
      "files": {
        TERRITORY_FILE: bool(resolved["territory_path"]),
        PODR_FILE: bool(resolved["podr_path"]),
        LOGIN_FILE: bool(resolved["login_path"]),
      },
      "cached": cached is not None,
      "loaded_at": (cached or {}).get("loaded_at"),
      "counts": (cached or {}).get("counts", {}),
    }


def resolve_site_sql_column(col_mapping: Dict[str, str]) -> str:
    if "Площадка" in col_mapping:
        return col_mapping["Площадка"]
    if "Итого" in col_mapping:
        return col_mapping["Итого"]
    return col_mapping.get("Территория", "Территория")


def apply_to_main_db() -> Dict[str, Any]:
    data = get_cached()
    territory_map: Dict[str, str] = data.get("territory_to_site") or {}
    site_status: Dict[str, str] = data.get("site_status") or {}

    registry.migrate_legacy_if_needed()
    db_path = registry.active_db_path()
    meta_path = registry.active_meta_path()
    if not db_path or not os.path.isfile(db_path):
        return {"error": "Нет активной Основной базы. Загрузите БД в Настройки → БАЗА."}

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    col_mapping: Dict[str, str] = dict(meta.get("col_mapping") or {})
    columns: List[str] = list(meta.get("columns") or [])

    territory_sql = col_mapping.get("Территория")
    if not territory_sql:
        return {"error": 'В Основной базе нет столбца "Территория"'}

    conn = sqlite3.connect(db_path)
    try:
        cur = conn.execute('PRAGMA table_info("employees")')
        existing = {row[1] for row in cur.fetchall()}

        site_sql = col_mapping.get("Площадка") or col_mapping.get("Итого")
        if col_mapping.get("Итого") and not col_mapping.get("Площадка"):
            old_sql = col_mapping["Итого"]
            if old_sql in existing:
                conn.execute(f'ALTER TABLE employees RENAME COLUMN "{old_sql}" TO "Площадка"')
            col_mapping["Площадка"] = "Площадка"
            col_mapping.pop("Итого", None)
            columns = ["Площадка" if c == "Итого" else c for c in columns]
            site_sql = "Площадка"
            existing.add("Площадка")

        if "Площадка" not in existing and site_sql not in existing:
            conn.execute('ALTER TABLE employees ADD COLUMN "Площадка" TEXT')
            col_mapping["Площадка"] = "Площадка"
            columns.append("Площадка")
            site_sql = "Площадка"

        status_sql = col_mapping.get("Статус", "Статус")
        if status_sql not in existing and "Статус" not in existing:
            conn.execute('ALTER TABLE employees ADD COLUMN "Статус" TEXT')
            col_mapping["Статус"] = "Статус"
            if "Статус" not in columns:
                idx = columns.index("Площадка") + 1 if "Площадка" in columns else len(columns)
                columns.insert(idx, "Статус")

        df = pd.read_sql_query(
            f'SELECT rowid, "{territory_sql}", "{site_sql}" FROM employees',
            conn,
        )
        filled_site = 0
        filled_status = 0
        for _, row in df.iterrows():
            rid = row["rowid"]
            terr = _norm_key(row[territory_sql])
            site_val = row[site_sql]
            new_site = territory_map.get(terr) if terr in territory_map else None
            if new_site is not None:
                conn.execute(
                    f'UPDATE employees SET "{site_sql}" = ? WHERE rowid = ?',
                    (new_site, rid),
                )
                filled_site += 1
                site_val = new_site
            site_key = _norm_key(site_val)
            st = site_status.get(site_key, "")
            if st:
                conn.execute(
                    f'UPDATE employees SET "{status_sql}" = ? WHERE rowid = ?',
                    (st, rid),
                )
                filled_status += 1

        conn.commit()
    finally:
        conn.close()

    meta["col_mapping"] = col_mapping
    meta["columns"] = columns
    meta["references_applied_at"] = datetime.now().isoformat()
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    main_db.invalidate_cache()

    return {
      "success": True,
      "filled_ploshchadka": filled_site,
      "filled_status": filled_status,
      "row_count": len(df),
    }


def apply_all() -> Dict[str, Any]:
    loaded = load_from_disk()
    main_result = apply_to_main_db()
    return {
      "success": main_result.get("success", False) and "error" not in main_result,
      "load": {
        "counts": loaded.get("counts"),
        "loaded_at": loaded.get("loaded_at"),
      },
      "main_db": main_result,
      "tickets_hint": "Для «Затраты по билетам» нажмите «Заполнить Площадки» на вкладке «Таблица данных».",
    }


def get_podr_to_site() -> Dict[str, str]:
    return get_cached().get("podr_to_site") or {}


def get_users() -> List[Dict[str, Any]]:
    return get_cached().get("users") or []


def verify_user(login: str, password: str) -> Optional[Dict[str, Any]]:
    login_n = login.strip().lower()
    for u in get_users():
        if u.get("login", "").strip().lower() == login_n and u.get("password") == password:
            return u
    return None


def list_active_sites() -> List[str]:
    data = get_cached()
    site_status: Dict[str, str] = data.get("site_status") or {}
    sites = sorted({v for v in site_status.values() if v})
    active = [
        k for k, st in site_status.items()
        if _is_active_status(st)
    ]
    return active
