"""Проверки ежедневного учёта: задвоения, Проверка_1/2 против Основной БД."""

from __future__ import annotations

import json
import os
import re
import sqlite3
from datetime import date
from typing import Any, Dict, List, Optional, Tuple

import daily_tracking
import references

# Отображение полей ЕУ → заголовки Основной БД
EU_TO_MAIN = (
    ("tab_number", "Таб. номер"),
    ("fio", "ФИО"),
    ("birth_date_1c", "Дата рожд."),
    ("citizenship", "Страна"),
    ("passport_series_1c", "Серия"),
    ("passport_number_1c", "Номер"),
    ("location_id", "Площадка"),
)


def _norm_val(val: Any) -> str:
    s = str(val or "").strip().lower().replace("ё", "е")
    return " ".join(s.split())


def _norm_tab(val: Any) -> str:
    return _norm_val(val)


def _is_russia_citizenship(val: Any) -> bool:
    c = _norm_val(val)
    if not c:
        return False
    if c in ("россия", "рф", "ru", "russia"):
        return True
    return c.startswith("росс") or c.startswith("ross")


def _norm_passport_series(val: Any, citizenship: Any) -> str:
    """Сравнение серии: пробелы (РФ), 82/83 без 0082/0083, иначе 4 цифры."""
    s = _norm_val(val)
    raw = s.replace(" ", "") if _is_russia_citizenship(citizenship) else s
    digits = re.sub(r"\D", "", raw)
    if not digits:
        return raw
    core = digits.lstrip("0") or "0"
    if core in ("82", "83"):
        return core
    if len(digits) <= 4:
        return digits.zfill(4)
    return digits


def _is_kandidat(tab: Any) -> bool:
    t = _norm_tab(tab)
    return t == "кандидат" or t in ("прием", "нелегал")


def _ref_date(tracking_date: str) -> date:
    """Дата учёта для сравнения с «Дата увольн.» (если не задана — сегодня)."""
    parsed = daily_tracking._parse_date_value(tracking_date)
    return parsed if parsed else date.today()


def _is_acting_employee(dismissal_val: Any, on_date: date) -> bool:
    """
    Действующий сотрудник: нет даты в «Дата увольн.» или она строго позже даты учёта.
    """
    dismissal = daily_tracking._parse_date_value(dismissal_val)
    if dismissal is None:
        return True
    return dismissal > on_date


def _is_fired_on_date(dismissal_val: Any, state_val: Any, on_date: date) -> bool:
    """Не действующий на дату учёта — нельзя в ежедневном учёте."""
    if not _is_acting_employee(dismissal_val, on_date):
        return True
    s = _norm_val(state_val)
    return "уволен" in s


def _fio_dob_key(fio: Any, dob: Any) -> str:
    d = daily_tracking._format_date_display(dob)
    if d and not isinstance(d, str):
        d = str(d)
    return f"{_norm_val(fio)},{_norm_val(d or dob)}"


def _check_internal_duplicates(
    rows: List[Dict[str, Any]],
    default_loc: str,
) -> List[Dict[str, Any]]:
    """
    Проверка_3 — задвоение таб. № (кроме «Кандидат» / «Прием» / «Нелегал»).
    Проверка_4 — задвоение кандидатов по связке «Ф.И.О.», «Дата рождения».
    """
    errors: List[Dict[str, Any]] = []
    by_tab: Dict[str, List[Tuple[int, Dict[str, Any], str, Any]]] = {}
    by_fio_dob: Dict[str, List[Tuple[int, Dict[str, Any], str, Any]]] = {}

    for idx, row in enumerate(rows, start=1):
        loc = str(row.get("location_id") or default_loc or "")
        tab_raw = row.get("tab_number")
        if _is_kandidat(tab_raw):
            key = _fio_dob_key(row.get("fio"), row.get("birth_date_1c"))
            if key == ",":
                continue
            by_fio_dob.setdefault(key, []).append((idx, row, loc, tab_raw))
        else:
            tab_n = _norm_tab(tab_raw)
            if not tab_n:
                continue
            by_tab.setdefault(tab_n, []).append((idx, row, loc, tab_raw))

    for tab_n, items in by_tab.items():
        if len(items) < 2:
            continue
        row_nums = ", ".join(str(i[0]) for i in items)
        display_tab = str(items[0][3] if items[0][3] is not None else tab_n)
        for idx, row, loc, tab_raw in items:
            errors.append({
                "check": "Проверка_3",
                "row": idx,
                "locationId": loc,
                "tabNumber": tab_raw,
                "fio": row.get("fio"),
                "field": "Таб. №",
                "message": f"Задвоение по таб. № «{display_tab}»: строки {row_nums}",
            })

    for _key, items in by_fio_dob.items():
        if len(items) < 2:
            continue
        row_nums = ", ".join(str(i[0]) for i in items)
        fio_disp = items[0][1].get("fio") or "—"
        dob_disp = daily_tracking._format_date_display(items[0][1].get("birth_date_1c")) or "—"
        for idx, row, loc, tab_raw in items:
            errors.append({
                "check": "Проверка_4",
                "row": idx,
                "locationId": loc,
                "tabNumber": tab_raw,
                "fio": row.get("fio"),
                "field": "Ф.И.О. / Дата рождения",
                "message": (
                    f"Задвоение кандидата «{fio_disp}», дата рожд. «{dob_disp}»: строки {row_nums}"
                ),
            })

    return errors


def _pick_sql_column(
    col_map: Dict[str, str], columns: List[str], *logical_names: str
) -> Optional[str]:
    """Имя столбца в SQLite (sanitized) по одному из заголовков Excel."""
    for name in logical_names:
        if name in col_map:
            return col_map[name]
        if name in columns:
            return name
    return None


def _resolve_main_columns() -> Optional[Dict[str, str]]:
    import main_db

    if not main_db.is_loaded():
        return None
    meta_path = main_db._meta_path()
    if not os.path.isfile(meta_path):
        return None
    try:
        with open(meta_path, encoding="utf-8") as f:
            meta = json.load(f)
    except (OSError, json.JSONDecodeError):
        return None
    col_map: Dict[str, str] = meta.get("col_mapping") or {}
    columns: List[str] = list(meta.get("columns") or [])

    site_sql = references.resolve_site_sql_column(col_map)
    if not site_sql:
        site_sql = _pick_sql_column(col_map, columns, "Площадка", "Итого", "Территория")

    resolved = {
        "tab": _pick_sql_column(
            col_map,
            columns,
            "Таб. номер",
            "Табельный номер (с префиксами)",
            "Табельный номер",
        ),
        "fio": _pick_sql_column(col_map, columns, "ФИО"),
        "birth": _pick_sql_column(col_map, columns, "Дата рожд.", "Дата рождения"),
        "country": _pick_sql_column(col_map, columns, "Страна", "Страна гражданства"),
        "series": _pick_sql_column(col_map, columns, "Серия", "Удостоверение.Серия"),
        "number": _pick_sql_column(col_map, columns, "Номер", "Удостоверение.Номер"),
        "site": site_sql,
        "state": _pick_sql_column(col_map, columns, "Состояние"),
        "hire": _pick_sql_column(col_map, columns, "Дата приема"),
        "dismissal": _pick_sql_column(
            col_map, columns, "Дата увольн.", "Дата увольнения"
        ),
        "site_status": _pick_sql_column(col_map, columns, "Статус"),
    }
    if not resolved["tab"] or not resolved["fio"]:
        return None
    return resolved


def _load_main_indexes() -> Tuple[Optional[Dict[str, str]], Dict[str, Dict], Dict[str, List[Dict]]]:
    cols = _resolve_main_columns()
    if not cols:
        return None, {}, {}

    import main_db

    path = main_db._db_path()
    if not os.path.isfile(path):
        return cols, {}, {}

    field_map = (
        ("tab", "tab"),
        ("fio", "fio"),
        ("birth", "birth"),
        ("country", "country"),
        ("series", "series"),
        ("number", "number"),
        ("site", "site"),
        ("state", "state"),
        ("hire", "hire"),
        ("dismissal", "dismissal"),
        ("site_status", "site_status"),
    )
    sel_parts: List[str] = []
    for col_key, alias in field_map:
        c = cols.get(col_key)
        if c:
            sel_parts.append(f'"{c}" AS {alias}')
    if not sel_parts:
        return cols, {}, {}

    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    by_tab: Dict[str, Dict[str, Any]] = {}
    by_fio_dob: Dict[str, List[Dict[str, Any]]] = {}
    try:
        cur = conn.execute(f"SELECT {', '.join(sel_parts)} FROM employees")
        for row in cur.fetchall():
            rec = {k: row[k] for k in row.keys()}
            tab_k = _norm_tab(rec.get("tab"))
            if tab_k:
                by_tab[tab_k] = rec
            key = _fio_dob_key(rec.get("fio"), rec.get("birth"))
            if key != ",":
                by_fio_dob.setdefault(key, []).append(rec)
    finally:
        conn.close()
    return cols, by_tab, by_fio_dob


def validate_report(
    tracking_date: str,
    location_id: Optional[str] = None,
    combined: bool = False,
) -> Dict[str, Any]:
    if combined:
        payload = daily_tracking.get_combined_rows(tracking_date, limit=500_000, offset=0)
        rows = payload.get("data") or []
        if not payload.get("hasCombined"):
            return {"error": "Общий отчёт не сформирован. Нажмите «Создать Общий отчёт»."}
    else:
        if not location_id:
            return {"error": "Укажите площадку"}
        rows = daily_tracking.get_rows(
            tracking_date, location_id, combined=False, limit=500_000, offset=0
        ).get("data") or []

    errors: List[Dict[str, Any]] = _check_internal_duplicates(
        rows, location_id or ""
    )

    cols, by_tab, by_fio_dob = _load_main_indexes()
    if not cols:
        import main_db

        if errors:
            return {
                "success": True,
                "trackingDate": tracking_date,
                "locationId": location_id,
                "combined": combined,
                "rowCount": len(rows),
                "errorCount": len(errors),
                "errors": errors,
                "hasErrors": True,
                "warning": (
                    "Проверки задвоения выполнены. Основная БД не загружена — "
                    "Проверка_1/2 не выполнялись."
                    if not main_db.is_loaded()
                    else (
                        "Проверки задвоения выполнены. В Основной БД нет нужных столбцов — "
                        "Проверка_1/2 не выполнялись."
                    )
                ),
            }
        if not main_db.is_loaded():
            return {
                "error": "Основная БД не загружена. Загрузите файл в Настройки → БАЗА.",
            }
        return {
            "error": (
                "В Основной БД не найдены обязательные столбцы «Табельный номер» и «ФИО». "
                "Перезагрузите выгрузку 1С или примените справочники в Настройках."
            ),
        }

    on_date = _ref_date(tracking_date)

    for idx, row in enumerate(rows, start=1):
        loc = row.get("location_id") or location_id or ""
        tab_raw = row.get("tab_number")
        tab_n = _norm_tab(tab_raw)

        if _is_kandidat(tab_raw):
            key = _fio_dob_key(row.get("fio"), row.get("birth_date_1c"))
            if key == ",":
                continue
            matches = by_fio_dob.get(key, [])
            for m in matches:
                if not _is_acting_employee(m.get("dismissal"), on_date):
                    continue
                dismiss_disp = daily_tracking._format_date_display(m.get("dismissal"))
                errors.append({
                    "check": "Проверка_2",
                    "row": idx,
                    "locationId": loc,
                    "tabNumber": tab_raw,
                    "fio": row.get("fio"),
                    "message": (
                        f"Кандидат «{row.get('fio')}» обнаружен в Базе как действующий сотрудник "
                        f"(на {on_date.strftime('%d.%m.%Y')} нет увольнения или дата увольн. позже)"
                    ),
                    "mainDb": {
                        "Таб. номер": m.get("tab"),
                        "ФИО": m.get("fio"),
                        "Площадка": m.get("site"),
                        "Дата приема": daily_tracking._format_date_display(m.get("hire")),
                        "Дата увольн.": dismiss_disp if dismiss_disp else "—",
                    },
                })
            continue

        main_row = by_tab.get(tab_n) if tab_n else None
        if not main_row:
            errors.append({
                "check": "Проверка_1",
                "row": idx,
                "locationId": loc,
                "tabNumber": tab_raw,
                "fio": row.get("fio"),
                "field": "Таб. №",
                "message": f"Таб. № «{tab_raw}» не найден в Основной БД",
            })
            continue

        if _is_fired_on_date(main_row.get("dismissal"), main_row.get("state"), on_date):
            dismiss_disp = daily_tracking._format_date_display(main_row.get("dismissal"))
            state_disp = main_row.get("state") or "—"
            if not _is_acting_employee(main_row.get("dismissal"), on_date) and dismiss_disp:
                reason = (
                    f"дата увольн. {dismiss_disp} — на дату учёта "
                    f"{on_date.strftime('%d.%m.%Y')} сотрудник уже уволен"
                )
                field = "Дата увольн."
            else:
                reason = f"состояние в Базе: {state_disp}"
                field = "Состояние"
            errors.append({
                "check": "Проверка_1",
                "row": idx,
                "locationId": loc,
                "tabNumber": tab_raw,
                "fio": row.get("fio"),
                "field": field,
                "message": (
                    f"Сотрудник не является действующим ({reason}), "
                    "не может быть в ежедневном учёте"
                ),
            })

        eu_main_pairs = (
            ("tab_number", "tab", "Таб. №"),
            ("fio", "fio", "Ф.И.О."),
            ("birth_date_1c", "birth", "Дата рождения"),
            ("citizenship", "country", "Гражданство"),
            ("passport_series_1c", "series", "Серия паспорта"),
            ("passport_number_1c", "number", "Номер паспорта"),
            ("location_id", "site", "Площадка"),
        )
        citizenship_for_passport = row.get("citizenship") or main_row.get("country")
        for eu_key, main_key, label in eu_main_pairs:
            if eu_key in daily_tracking.DATE_FIELD_KEYS:
                eu_v = _norm_val(daily_tracking._format_date_display(row.get(eu_key)))
                main_v = _norm_val(daily_tracking._format_date_display(main_row.get(main_key)))
            elif eu_key == "passport_series_1c":
                eu_v = _norm_passport_series(row.get(eu_key), citizenship_for_passport)
                main_v = _norm_passport_series(main_row.get(main_key), citizenship_for_passport)
            else:
                eu_v = _norm_val(row.get(eu_key))
                main_v = _norm_val(main_row.get(main_key))
            if eu_v != main_v:
                errors.append({
                    "check": "Проверка_1",
                    "row": idx,
                    "locationId": loc,
                    "tabNumber": tab_raw,
                    "fio": row.get("fio"),
                    "field": label,
                    "message": (
                        f"{label}: в ЕУ «{row.get(eu_key)}», в Базе «{main_row.get(main_key)}»"
                    ),
                })

    return {
        "success": True,
        "trackingDate": tracking_date,
        "locationId": location_id,
        "combined": combined,
        "rowCount": len(rows),
        "errorCount": len(errors),
        "errors": errors,
        "hasErrors": len(errors) > 0,
    }
