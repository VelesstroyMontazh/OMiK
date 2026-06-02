"""
Calendar Database System - Loads and caches the .xlsb Calendar file (Прилет/Вылет).
Stores data in SQLite for fast querying and reporting.
"""

import os
import json
import sqlite3
import re
from typing import Optional, List, Dict, Any
from datetime import datetime

import pandas as pd
import numpy as np

from data_paths import UPLOAD_DIR

CALENDAR_DB_PATH = os.path.join(UPLOAD_DIR, "calendar_db.sqlite")
CALENDAR_META_PATH = os.path.join(UPLOAD_DIR, "calendar_db_meta.json")

_cache: Dict[str, Any] = {
    "loaded": False,
    "file_path": None,
    "loaded_at": None,
    "sheet_count": 0,
    "arrival_sheets": [],
    "departure_sheets": [],
    "total_arrivals": 0,
    "total_departures": 0,
    "available_years": [],
    "available_months": [],
}


def _nan_to_none(value):
    if value is None:
        return None
    if isinstance(value, float) and np.isnan(value):
        return None
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass
    return value


def _convert_value_for_json(value):
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


def _detect_calendar_file() -> Optional[str]:
    """Find the calendar .xlsb file in upload directory."""
    if not os.path.isdir(UPLOAD_DIR):
        return None
    for filename in os.listdir(UPLOAD_DIR):
        if filename.lower().endswith('.xlsb'):
            file_path = os.path.join(UPLOAD_DIR, filename)
            if os.path.isfile(file_path):
                return file_path
    # Also check for xlsx with "календарь" in name
    for filename in os.listdir(UPLOAD_DIR):
        if filename.lower().endswith(('.xlsx', '.xlsm')):
            if 'календарь' in filename.lower() or 'calendar' in filename.lower():
                file_path = os.path.join(UPLOAD_DIR, filename)
                if os.path.isfile(file_path):
                    return file_path
    return None


def _parse_sheet_name(sheet_name: str) -> Dict[str, Any]:
    """Parse sheet name like '1. 2025 Прилет январь' to extract year, type, month."""
    result = {
        "original": sheet_name,
        "year": None,
        "direction": None,  # "Прилет" or "Вылет"
        "month": None,
        "month_num": None,
    }

    # Try pattern: "N. YYYY Direction Month"
    match = re.match(r'\d+\.\s*(\d{4})\s+(Прилет|Вылет)\s+(.+)', sheet_name, re.IGNORECASE)
    if match:
        result["year"] = int(match.group(1))
        result["direction"] = match.group(2)  # Прилет or Вылет
        month_name = match.group(3).strip()
        result["month"] = month_name
        result["month_num"] = _month_to_num(month_name)

    return result


def _month_to_num(month_name: str) -> Optional[int]:
    """Convert Russian month name to number."""
    months = {
        'январь': 1, 'февраль': 2, 'март': 3, 'апрель': 4,
        'май': 5, 'июнь': 6, 'июль': 7, 'август': 8,
        'сентябрь': 9, 'октябрь': 10, 'ноябрь': 11, 'декабрь': 12,
        'января': 1, 'февраля': 2, 'марта': 3, 'апреля': 4,
        'мая': 5, 'июня': 6, 'июля': 7, 'августа': 8,
        'сентября': 9, 'октября': 10, 'ноября': 11, 'декабря': 12,
    }
    return months.get(month_name.lower().strip())


def _sanitize_col_name(name: str) -> str:
    """Sanitize column name for SQLite."""
    if name is None:
        return "unknown"
    return (str(name)
            .replace('.', '_')
            .replace(' ', '_')
            .replace('(', '')
            .replace(')', '')
            .replace('-', '_')
            .replace('/', '_')
            .replace('\n', '_')
            .replace('"', '')
            .replace("'", ''))


def load_calendar_db(file_path: Optional[str] = None) -> Dict[str, Any]:
    """Load the calendar .xlsb file into SQLite database."""
    global _cache

    if file_path is None:
        file_path = _detect_calendar_file()
        if file_path is None:
            return {"loaded": False, "error": "No calendar .xlsb file found in upload directory"}

    if not os.path.exists(file_path):
        return {"loaded": False, "error": f"File not found: {file_path}"}

    try:
        from pyxlsb import open_workbook

        wb = open_workbook(file_path)
        all_sheets = wb.sheets
        wb.close()

        # Parse sheet names
        arrival_sheets = []
        departure_sheets = []
        available_years = set()
        available_months = set()

        for sheet_name in all_sheets:
            parsed = _parse_sheet_name(sheet_name)
            if parsed["direction"] == "Прилет":
                arrival_sheets.append(parsed)
            elif parsed["direction"] == "Вылет":
                departure_sheets.append(parsed)
            if parsed["year"]:
                available_years.add(parsed["year"])
            if parsed["month_num"]:
                available_months.add(parsed["month_num"])

        # Remove existing database
        if os.path.exists(CALENDAR_DB_PATH):
            os.remove(CALENDAR_DB_PATH)

        conn = sqlite3.connect(CALENDAR_DB_PATH)
        conn.row_factory = sqlite3.Row

        # Create table for calendar data
        conn.execute('''
            CREATE TABLE IF NOT EXISTS calendar_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                direction TEXT,
                year INTEGER,
                month INTEGER,
                month_name TEXT,
                sheet_name TEXT,
                tab_num TEXT,
                project TEXT,
                organization TEXT,
                full_name TEXT,
                full_name_latin TEXT,
                birth_date TEXT,
                citizenship TEXT,
                passport_series TEXT,
                passport_number TEXT,
                worker_type TEXT,
                position TEXT,
                department TEXT,
                supervisor TEXT,
                ticket_departure_date TEXT,
                arrival_date TEXT,
                arrival_time TEXT,
                transport_type TEXT,
                ticket_status TEXT,
                justification TEXT,
                arrival_status TEXT,
                phone TEXT,
                route TEXT,
                notes TEXT,
                visa_type TEXT,
                visa_expiry TEXT,
                residence TEXT,
                flight_number TEXT,
                charter_flight TEXT,
                charter_date TEXT,
                declared_charter TEXT,
                arrival_date_loc TEXT,
                arrival_time_loc TEXT,
                ticket_cost TEXT,
                pass_territory TEXT,
                airport TEXT,
                arrival_moscow_date TEXT,
                row_number INTEGER
            )
        ''')

        # Create indexes
        conn.execute('CREATE INDEX IF NOT EXISTS idx_direction ON calendar_records(direction)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_year ON calendar_records(year)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_month ON calendar_records(month)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_citizenship ON calendar_records(citizenship)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_justification ON calendar_records(justification)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_arrival_status ON calendar_records(arrival_status)')
        conn.execute('CREATE INDEX IF NOT EXISTS idx_year_month_dir ON calendar_records(year, month, direction)')

        total_arrivals = 0
        total_departures = 0

        # Process each data sheet (skip Параметры)
        for sheet_name in all_sheets:
            if sheet_name == 'Параметры':
                continue

            parsed = _parse_sheet_name(sheet_name)
            if not parsed["direction"]:
                continue

            try:
                wb2 = open_workbook(file_path)
                sheet = wb2.get_sheet(sheet_name)

                rows_data = []
                for i, row in enumerate(sheet.rows()):
                    if i == 0:
                        # Header row - skip
                        continue
                    cells = [_nan_to_none(cell.v) for cell in row]
                    if cells[0] is None and cells[1] is None and cells[4] is None:
                        continue  # Skip empty rows

                    def safe_get(idx, default=None):
                        try:
                            val = cells[idx] if idx < len(cells) else default
                            return _convert_value_for_json(val)
                        except (IndexError, TypeError):
                            return default

                    direction = parsed["direction"]
                    row_record = (
                        direction,
                        parsed["year"],
                        parsed["month_num"],
                        parsed["month"],
                        sheet_name,
                        str(safe_get(1, '') or ''),   # Таб. №
                        str(safe_get(2, '') or ''),   # Проект
                        str(safe_get(3, '') or ''),   # Организация
                        str(safe_get(4, '') or ''),   # ФИО
                        str(safe_get(5, '') or ''),   # ФИО латиница
                        str(safe_get(6, '') or ''),   # Дата рождения
                        str(safe_get(7, '') or ''),   # Гражданство
                        str(safe_get(8, '') or ''),   # Серия паспорта
                        str(safe_get(9, '') or ''),   # Номер паспорта
                        str(safe_get(10, '') or ''),  # Рабочий или ИТР
                        str(safe_get(11, '') or ''),  # Фактическая должность
                        str(safe_get(12, '') or ''),  # Отдел / Участок
                        str(safe_get(13, '') or ''),  # Начальник участка
                        str(safe_get(14, '') or ''),  # Дата вылета по билету
                        str(safe_get(15, '') or ''),  # Дата прибытия
                        str(safe_get(16, '') or ''),  # Время прибытия
                        str(safe_get(17, '') or ''),  # АВИА /ЖД
                        str(safe_get(18, '') or ''),  # Билет куплен
                        str(safe_get(19, '') or ''),  # Обоснование перелета
                        str(safe_get(20, '') or ''),  # Сотрудник прибыл/не прибыл
                        str(safe_get(21, '') or ''),  # Номер телефона
                        str(safe_get(22, '') or ''),  # Маршрут
                        str(safe_get(23, '') or ''),  # Примечание
                        str(safe_get(24, '') or ''),  # Вид визы
                        str(safe_get(25, '') or ''),  # Срок действия визы
                        str(safe_get(26, '') or ''),  # Место проживания
                        str(safe_get(27, '') or ''),  # Номер рейса
                        str(safe_get(28, '') or ''),  # чартерный рейс
                        str(safe_get(29, '') or ''),  # Дата чартера
                        str(safe_get(30, '') or ''),  # Заявлен на чартер
                        str(safe_get(31, '') or ''),  # Дата прибытия в
                        str(safe_get(32, '') or ''),  # Время прибытия в
                        str(safe_get(33, '') or ''),  # Сумма стоимости билета
                        str(safe_get(34, '') or ''),  # Пропуска на территории
                        str(safe_get(35, '') or ''),  # Аэропорт
                        str(safe_get(36, '') or ''),  # Дата прибытие в Москву
                        i + 1,  # row_number
                    )
                    rows_data.append(row_record)

                wb2.close()

                if rows_data:
                    conn.executemany('''
                        INSERT INTO calendar_records (
                            direction, year, month, month_name, sheet_name,
                            tab_num, project, organization, full_name, full_name_latin,
                            birth_date, citizenship, passport_series, passport_number,
                            worker_type, position, department, supervisor,
                            ticket_departure_date, arrival_date, arrival_time,
                            transport_type, ticket_status, justification, arrival_status,
                            phone, route, notes, visa_type, visa_expiry,
                            residence, flight_number, charter_flight, charter_date,
                            declared_charter, arrival_date_loc, arrival_time_loc,
                            ticket_cost, pass_territory, airport, arrival_moscow_date,
                            row_number
                        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                    ''', rows_data)

                    if parsed["direction"] == "Прилет":
                        total_arrivals += len(rows_data)
                    else:
                        total_departures += len(rows_data)

            except Exception as e:
                print(f"Warning: Failed to process sheet '{sheet_name}': {e}")
                continue

        conn.commit()

        # Get actual counts from DB
        actual_arrivals = conn.execute('SELECT COUNT(*) FROM calendar_records WHERE direction = "Прилет"').fetchone()[0]
        actual_departures = conn.execute('SELECT COUNT(*) FROM calendar_records WHERE direction = "Вылет"').fetchone()[0]
        conn.close()

        total_arrivals = actual_arrivals
        total_departures = actual_departures

        # Save metadata
        meta = {
            "file_path": file_path,
            "loaded_at": datetime.now().isoformat(),
            "sheet_count": len(all_sheets),
            "arrival_sheets": arrival_sheets,
            "departure_sheets": departure_sheets,
            "total_arrivals": total_arrivals,
            "total_departures": total_departures,
            "available_years": sorted(list(available_years)),
            "available_months": sorted(list(available_months)),
        }
        with open(CALENDAR_META_PATH, 'w', encoding='utf-8') as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

        _cache = {
            "loaded": True,
            "file_path": file_path,
            "loaded_at": meta["loaded_at"],
            "sheet_count": len(all_sheets),
            "arrival_sheets": arrival_sheets,
            "departure_sheets": departure_sheets,
            "total_arrivals": total_arrivals,
            "total_departures": total_departures,
            "available_years": sorted(list(available_years)),
            "available_months": sorted(list(available_months)),
        }

        return {
            "loaded": True,
            "file_path": file_path,
            "total_arrivals": total_arrivals,
            "total_departures": total_departures,
            "sheet_count": len(all_sheets),
            "available_years": sorted(list(available_years)),
            "available_months": sorted(list(available_months)),
        }

    except Exception as e:
        return {"loaded": False, "error": f"Failed to load calendar file: {str(e)}"}


def _load_meta_from_disk():
    """Load metadata from disk if cache is empty but database exists."""
    global _cache
    if _cache["loaded"]:
        return True
    if os.path.exists(CALENDAR_META_PATH) and os.path.exists(CALENDAR_DB_PATH):
        try:
            with open(CALENDAR_META_PATH, 'r', encoding='utf-8') as f:
                meta = json.load(f)
            _cache = {
                "loaded": True,
                "file_path": meta["file_path"],
                "loaded_at": meta["loaded_at"],
                "sheet_count": meta["sheet_count"],
                "arrival_sheets": meta["arrival_sheets"],
                "departure_sheets": meta["departure_sheets"],
                "total_arrivals": meta["total_arrivals"],
                "total_departures": meta["total_departures"],
                "available_years": meta["available_years"],
                "available_months": meta["available_months"],
            }
            return True
        except Exception:
            return False
    return False


def is_loaded() -> bool:
    if _cache["loaded"]:
        return True
    return _load_meta_from_disk()


def get_status() -> Dict[str, Any]:
    if not is_loaded():
        return {"loaded": False}
    return {
        "loaded": True,
        "file_path": _cache["file_path"],
        "loaded_at": _cache["loaded_at"],
        "sheet_count": _cache["sheet_count"],
        "total_arrivals": _cache["total_arrivals"],
        "total_departures": _cache["total_departures"],
        "available_years": _cache["available_years"],
        "available_months": _cache["available_months"],
    }


def _get_db_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(CALENDAR_DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.create_function("LOWER", 1, lambda x: x.lower() if x else None)
    return conn


def get_calendar_data(
    direction: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    citizenship: Optional[str] = None,
    justification: Optional[str] = None,
    justification_contains: Optional[str] = None,
    arrival_status: Optional[str] = None,
    worker_type: Optional[str] = None,
    department: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    offset: int = 0,
    limit: int = 200,
) -> Dict[str, Any]:
    """Get calendar data with filters."""
    if not is_loaded():
        return {"error": "Calendar database not loaded", "data": [], "total": 0}

    conn = _get_db_connection()
    try:
        where_parts, params = build_calendar_filter_clause(
            direction=direction,
            year=year,
            month=month,
            date_from=date_from,
            date_to=date_to,
            citizenship=citizenship,
            justification=justification,
            justification_contains=justification_contains,
            arrival_status=arrival_status,
            worker_type=worker_type,
            department=department,
            search=search,
        )

        where_clause = f'WHERE {" AND ".join(where_parts)}' if where_parts else ''

        total = conn.execute(f'SELECT COUNT(*) FROM calendar_records {where_clause}', params).fetchone()[0]

        rows = conn.execute(
            f'SELECT * FROM calendar_records {where_clause} ORDER BY year, month, row_number LIMIT ? OFFSET ?',
            params + [limit, offset]
        ).fetchall()

        data = []
        for row in rows:
            record = {}
            for key in row.keys():
                record[key] = _convert_value_for_json(row[key])
            data.append(record)

        return {
            "data": data,
            "total": total,
            "offset": offset,
            "limit": limit,
            "has_more": (offset + limit) < total,
        }
    finally:
        conn.close()


def get_calendar_stats(
    direction: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
) -> Dict[str, Any]:
    """Get calendar statistics with optional filters."""
    if not is_loaded():
        return {"error": "Calendar database not loaded"}

    conn = _get_db_connection()
    try:
        where_parts = []
        params = []

        if direction:
            where_parts.append('direction = ?')
            params.append(direction)
        if year:
            where_parts.append('year = ?')
            params.append(year)
        if month:
            where_parts.append('month = ?')
            params.append(month)

        where_clause = f'WHERE {" AND ".join(where_parts)}' if where_parts else ''

        # By citizenship
        by_citizenship = conn.execute(
            f'SELECT citizenship, COUNT(*) as cnt FROM calendar_records {where_clause} '
            f'GROUP BY citizenship ORDER BY cnt DESC',
            params
        ).fetchall()

        # By justification
        by_justification = conn.execute(
            f'SELECT justification, COUNT(*) as cnt FROM calendar_records {where_clause} '
            f'GROUP BY justification ORDER BY cnt DESC',
            params
        ).fetchall()

        # By arrival status
        by_arrival_status = conn.execute(
            f'SELECT arrival_status, COUNT(*) as cnt FROM calendar_records {where_clause} '
            f'GROUP BY arrival_status ORDER BY cnt DESC',
            params
        ).fetchall()

        # By worker type
        by_worker_type = conn.execute(
            f'SELECT worker_type, COUNT(*) as cnt FROM calendar_records {where_clause} '
            f'GROUP BY worker_type ORDER BY cnt DESC',
            params
        ).fetchall()

        # By month (time series)
        by_month = conn.execute(
            f'SELECT year, month, direction, COUNT(*) as cnt FROM calendar_records {where_clause} '
            f'GROUP BY year, month, direction ORDER BY year, month',
            params
        ).fetchall()

        # By department
        by_department = conn.execute(
            f'SELECT department, COUNT(*) as cnt FROM calendar_records {where_clause} '
            f'GROUP BY department ORDER BY cnt DESC LIMIT 20',
            params
        ).fetchall()

        # By ticket status
        by_ticket_status = conn.execute(
            f'SELECT ticket_status, COUNT(*) as cnt FROM calendar_records {where_clause} '
            f'GROUP BY ticket_status ORDER BY cnt DESC',
            params
        ).fetchall()

        return {
            "by_citizenship": [{"name": r[0] or "Не указано", "count": r[1]} for r in by_citizenship],
            "by_justification": [{"name": r[0] or "Не указано", "count": r[1]} for r in by_justification],
            "by_arrival_status": [{"name": r[0] or "Не указано", "count": r[1]} for r in by_arrival_status],
            "by_worker_type": [{"name": r[0] or "Не указано", "count": r[1]} for r in by_worker_type],
            "by_month": [{"year": r[0], "month": r[1], "direction": r[2], "count": r[3]} for r in by_month],
            "by_department": [{"name": r[0] or "Не указано", "count": r[1]} for r in by_department],
            "by_ticket_status": [{"name": r[0] or "Не указано", "count": r[1]} for r in by_ticket_status],
        }
    finally:
        conn.close()


def _parse_date_param(value: Optional[str]) -> Optional[str]:
    """Parse DD.MM.YYYY or YYYY-MM-DD to ISO YYYY-MM-DD."""
    if not value:
        return None
    s = str(value).strip()
    if not s:
        return None
    for fmt in ("%d.%m.%Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(s[:10] if fmt != "%Y-%m-%d" else s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def _arrival_date_key_sql() -> str:
    """Normalize arrival_date text to YYYY-MM-DD when possible."""
    return (
        "CASE "
        "WHEN arrival_date GLOB '????-??-??*' THEN substr(arrival_date, 1, 10) "
        "WHEN arrival_date GLOB '??.??.????*' THEN "
        "  substr(arrival_date, 7, 4) || '-' || substr(arrival_date, 4, 2) || '-' || substr(arrival_date, 1, 2) "
        "ELSE NULL END"
    )


def build_calendar_filter_clause(
    direction: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    citizenship: Optional[str] = None,
    justification: Optional[str] = None,
    justification_contains: Optional[str] = None,
    arrival_status: Optional[str] = None,
    worker_type: Optional[str] = None,
    department: Optional[str] = None,
    search: Optional[str] = None,
) -> tuple[list[str], list[Any]]:
    where_parts: list[str] = []
    params: list[Any] = []

    if direction:
        where_parts.append("direction = ?")
        params.append(direction)
    if year:
        where_parts.append("year = ?")
        params.append(year)
    if month:
        where_parts.append("month = ?")
        params.append(month)

    iso_from = _parse_date_param(date_from)
    iso_to = _parse_date_param(date_to)
    date_key = _arrival_date_key_sql()
    if iso_from:
        where_parts.append(f"({date_key}) >= ?")
        params.append(iso_from)
    if iso_to:
        where_parts.append(f"({date_key}) <= ?")
        params.append(iso_to)

    if citizenship:
        where_parts.append("LOWER(citizenship) LIKE ?")
        params.append(f"%{citizenship.lower()}%")
    if justification_contains:
        where_parts.append("LOWER(justification) LIKE ?")
        params.append(f"%{justification_contains.lower()}%")
    elif justification:
        where_parts.append("justification = ?")
        params.append(justification)
    if arrival_status:
        where_parts.append("LOWER(arrival_status) LIKE ?")
        params.append(f"%{arrival_status.lower()}%")
    if worker_type:
        where_parts.append("LOWER(worker_type) LIKE ?")
        params.append(f"%{worker_type.lower()}%")
    if department:
        where_parts.append("LOWER(department) LIKE ?")
        params.append(f"%{department.lower()}%")
    if search:
        s = search.lower()
        where_parts.append(
            "(LOWER(full_name) LIKE ? OR LOWER(tab_num) LIKE ? OR LOWER(justification) LIKE ?)"
        )
        params.extend([f"%{s}%", f"%{s}%", f"%{s}%"])

    return where_parts, params


CALENDAR_EXPORT_COLUMNS: Dict[str, str] = {
    "direction": "Направление",
    "year": "Год",
    "month_name": "Месяц",
    "sheet_name": "Лист",
    "tab_num": "Таб. №",
    "full_name": "ФИО",
    "citizenship": "Гражданство",
    "passport_series": "Серия паспорта",
    "passport_number": "Номер паспорта",
    "organization": "Организация",
    "department": "Отдел / Участок",
    "worker_type": "Рабочий/ИТР",
    "position": "Должность",
    "justification": "Обоснование",
    "arrival_status": "Статус прибытия",
    "arrival_date": "Дата прибытия",
    "ticket_departure_date": "Дата вылета по билету",
    "transport_type": "АВИА/ЖД",
    "ticket_status": "Билет куплен",
    "ticket_cost": "Сумма билета",
    "route": "Маршрут",
    "phone": "Телефон",
}


def get_unique_values(column: str) -> List[str]:
    """Get unique values for a column."""
    if not is_loaded():
        return []

    allowed = ['citizenship', 'justification', 'arrival_status', 'worker_type',
                'department', 'position', 'organization', 'transport_type',
                'ticket_status', 'direction']

    if column not in allowed:
        return []

    conn = _get_db_connection()
    try:
        rows = conn.execute(
            f'SELECT DISTINCT "{column}" FROM calendar_records WHERE "{column}" IS NOT NULL AND "{column}" != "" ORDER BY "{column}"'
        ).fetchall()
        return [r[0] for r in rows if r[0]]
    finally:
        conn.close()


def clear_cache() -> Dict[str, Any]:
    global _cache
    if os.path.exists(CALENDAR_DB_PATH):
        os.remove(CALENDAR_DB_PATH)
    if os.path.exists(CALENDAR_META_PATH):
        os.remove(CALENDAR_META_PATH)

    _cache = {
        "loaded": False,
        "file_path": None,
        "loaded_at": None,
        "sheet_count": 0,
        "arrival_sheets": [],
        "departure_sheets": [],
        "total_arrivals": 0,
        "total_departures": 0,
        "available_years": [],
        "available_months": [],
    }
    return {"cleared": True}
