"""
Отчёт «Путь сотрудника» для площадки 004 (Геленджик Марина (ВСМ)).
"""

from __future__ import annotations

import json
import os
import re
import uuid
from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple

import numpy as np
import pandas as pd
import xlsxwriter
from openpyxl.utils.dataframe import dataframe_to_rows

import excel_handler
from data_paths import UPLOAD_DIR
import main_db

MAIN_DB_PATH = main_db.DB_PATH
MAIN_META_PATH = main_db.META_PATH

DEFAULT_SITE = "004 (Геленджик Марина (ВСМ))"
SITE_OPEN_DATE = date(2024, 9, 1)  # площадка открылась осенью 2024

AUX_COLUMN_ALIASES = {
    "tab": ["Таб. Номер", "Табельный номер", "Табельный номер (с префиксами)"],
    "fio": ["Сотрудник", "ФИО"],
    "territory_before": ["Территория до"],
    "territory_after": ["Территория после"],
    "transfer_date": ["Дата перевода", "Дата"],
}

AUX_SHEET_RULES = {
    "прием": {"filter_field": "territory_after"},
    "На Геленджик": {"filter_field": "territory_after"},
    "с Геленджик": {"filter_field": "territory_before"},
}

PATH_BASE_COLUMNS = [
    "ФИО",
    "Дата рождения",
    "Табельные номера",
    "Паспорт",
]

SUMMARY_COLUMNS = [
    "Ключ сотрудника",
    "ФИО",
    "Дата рождения",
    "Паспорт",
    "Табельные номера",
    "Событий в пути",
    "Первый приём",
    "Последнее увольнение",
    "Текущее состояние",
    "Последняя территория",
    "Был на площадке 004",
]


def _load_col_mapping() -> Dict[str, str]:
    if os.path.exists(MAIN_META_PATH):
        with open(MAIN_META_PATH, "r", encoding="utf-8") as f:
            meta = json.load(f)
        return meta.get("col_mapping", {})
    return {}


def _normalize_text(value: Any) -> str:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    text = str(value).strip()
    return re.sub(r"\s+", " ", text)


def _normalize_territory(value: Any) -> str:
    return _normalize_text(value)


def _parse_date_series(series: pd.Series) -> pd.Series:
    first = pd.to_datetime(series, errors="coerce")
    need_second = first.isna() & series.notna() & (series.astype(str).str.strip() != "")
    if need_second.any():
        second = pd.to_datetime(series[need_second], errors="coerce", dayfirst=True)
        first.loc[need_second] = second
    return first


def _parse_date(value: Any) -> Optional[pd.Timestamp]:
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return None
    if isinstance(value, pd.Timestamp):
        return value
    if isinstance(value, datetime):
        return pd.Timestamp(value)
    if isinstance(value, date):
        return pd.Timestamp(value)
    text = _normalize_text(value)
    if not text:
        return None
    parsed = pd.to_datetime(text, errors="coerce")
    if pd.isna(parsed):
        parsed = pd.to_datetime(text, errors="coerce", dayfirst=True)
    if pd.isna(parsed):
        return None
    return parsed


def _format_date(value: Any) -> str:
    ts = _parse_date(value)
    return ts.strftime("%d.%m.%Y") if ts is not None else ""


def _passport_key(series: Any, number: Any) -> str:
    return _normalize_text(series) + _normalize_text(number)


def _person_key(
    fio: Any,
    dob: Any,
    passport_series: Any = None,
    passport_number: Any = None,
    tab: Any = None,
) -> str:
    fio_n = _normalize_text(fio)
    dob_n = _format_date(dob)
    if fio_n and dob_n:
        return f"{fio_n}|{dob_n}"
    passport = _passport_key(passport_series, passport_number)
    if fio_n and passport:
        return f"{fio_n}|passport:{passport}"
    tab_n = _normalize_text(tab)
    if tab_n:
        return f"tab:{tab_n}"
    return f"{fio_n}|unknown" if fio_n else "unknown"


def _event_type_hire(territory: str, site: str) -> str:
    if _normalize_territory(territory) == site:
        return "Прием на работу"
    name = _normalize_territory(territory) or "не указана"
    return f'Перевод на ОП "{name}"'


def _event_type_transfer_to(territory_after: str, site: str) -> str:
    if _normalize_territory(territory_after) == site:
        return "Перевод на ОП Марина"
    name = _normalize_territory(territory_after) or "не указана"
    return f'Перевод на ОП "{name}"'


def _event_type_transfer_from(territory_after: str) -> str:
    name = _normalize_territory(territory_after) or "не указана"
    return f'Перевод на ОП "{name}"'


def _resolve_column(columns: List[str], aliases: List[str]) -> Optional[str]:
    normalized = {_normalize_text(c).lower(): c for c in columns}
    for alias in aliases:
        key = _normalize_text(alias).lower()
        if key in normalized:
            return normalized[key]
    for col in columns:
        col_l = _normalize_text(col).lower()
        for alias in aliases:
            alias_l = _normalize_text(alias).lower()
            if alias_l in col_l or col_l in alias_l:
                return col
    return None


def _load_main_db_dataframe() -> Tuple[pd.DataFrame, Dict[str, str]]:
    if not os.path.exists(MAIN_DB_PATH):
        raise ValueError("Основная БД не загружена (main_db.sqlite отсутствует)")

    col_mapping = _load_col_mapping()
    required = [
        "Табельный номер (с префиксами)",
        "ФИО",
        "Удостоверение.Серия",
        "Удостоверение.Номер",
        "Организация",
        "Подразделение",
        "Должность",
        "Состояние",
        "Дата приема",
        "Дата увольнения",
        "Страна гражданства",
        "Территория",
        "Дата рождения",
        "Физическое лицо.Личный мобильный телефон",
        "Физическое лицо.Рабочий телефон",
    ]
    sql_cols = [col_mapping.get(c) for c in required]
    if any(not c for c in sql_cols):
        missing = [c for c, s in zip(required, sql_cols) if not s]
        raise ValueError(f"В основной БД не найдены столбцы: {', '.join(missing)}")

    quoted = ", ".join(f'"{c}"' for c in sql_cols)
    import sqlite3

    with sqlite3.connect(MAIN_DB_PATH) as conn:
        df = pd.read_sql_query(f"SELECT {quoted} FROM employees", conn)
    df.columns = required
    return df, col_mapping


def _load_auxiliary_sheet(file_path: str, sheet_name: str, site: str) -> pd.DataFrame:
    if sheet_name not in AUX_SHEET_RULES:
        raise ValueError(f"Неизвестный лист: {sheet_name}")

    rule = AUX_SHEET_RULES[sheet_name]
    try:
        raw = pd.read_excel(file_path, sheet_name=sheet_name, header=0)
    except Exception as e:
        raise ValueError(f"Не удалось прочитать лист «{sheet_name}»: {e}") from e

    if raw.empty:
        return pd.DataFrame()

    col_map = {
        key: _resolve_column(list(raw.columns), aliases)
        for key, aliases in AUX_COLUMN_ALIASES.items()
    }
    missing = [k for k, v in col_map.items() if v is None and k != "transfer_date"]
    if missing:
        raise ValueError(f"На листе «{sheet_name}» не найдены столбцы: {missing}")

    filter_col = col_map[rule["filter_field"]]
    site_n = _normalize_territory(site)
    filtered = raw.loc[raw[filter_col].apply(lambda v: _normalize_territory(v) == site_n)].copy()

    out = pd.DataFrame()
    out["Табельный номер"] = filtered[col_map["tab"]]
    out["ФИО"] = filtered[col_map["fio"]]
    out["Территория до"] = filtered[col_map["territory_before"]] if col_map["territory_before"] else ""
    out["Территория после"] = filtered[col_map["territory_after"]] if col_map["territory_after"] else ""
    date_col = col_map.get("transfer_date")
    out["Дата перевода"] = filtered[date_col] if date_col else pd.NaT
    out["Лист"] = sheet_name
    return out


def _timeline_from_base_row(row: pd.Series, site: str) -> List[Tuple[pd.Timestamp, str]]:
    """События из строки базы: приём/перевод и увольнение."""
    events: List[Tuple[pd.Timestamp, str]] = []
    hire = _parse_date(row["Дата приема"])
    fire = _parse_date(row["Дата увольнения"])
    if fire is not None and hire is not None and fire < hire:
        fire = None
    territory = _normalize_text(row["Территория"])

    if hire is not None:
        events.append((hire, _event_type_hire(territory, site)))
    if fire is not None:
        events.append((fire, "Увольнение"))
    return events


def _timeline_from_aux_row(row: pd.Series, sheet_name: str, site: str) -> List[Tuple[pd.Timestamp, str]]:
    transfer = _parse_date(row.get("Дата перевода"))
    if transfer is None:
        return []

    before = _normalize_text(row.get("Территория до"))
    after = _normalize_text(row.get("Территория после"))

    if sheet_name == "прием":
        event_type = "Прием на работу"
    elif sheet_name == "На Геленджик":
        event_type = _event_type_transfer_to(after, site)
    elif sheet_name == "с Геленджик":
        event_type = _event_type_transfer_from(after)
    else:
        event_type = _event_type_transfer_to(after, site)

    return [(transfer, event_type)]


def _merge_timeline(events: List[Tuple[pd.Timestamp, str]]) -> List[Tuple[pd.Timestamp, str]]:
    """Сортировка и удаление дублей (одна дата + тип)."""
    cleaned = [(d.normalize(), t) for d, t in events if d is not None and t]
    cleaned.sort(key=lambda x: (x[0], x[1]))
    merged: List[Tuple[pd.Timestamp, str]] = []
    seen: Set[Tuple[str, str]] = set()
    for d, t in cleaned:
        key = (d.strftime("%Y-%m-%d"), t)
        if key in seen:
            continue
        seen.add(key)
        merged.append((d, t))
    return merged


def _site_intervals_for_person(person_df: pd.DataFrame, site: str) -> List[Tuple[date, date]]:
    """Интервалы присутствия на площадке 004 по строкам базы."""
    today = date.today()
    intervals: List[Tuple[date, date]] = []
    for _, row in person_df.iterrows():
        if _normalize_territory(row["Территория"]) != site:
            continue
        hire = _parse_date(row["Дата приема"])
        fire = _parse_date(row["Дата увольнения"])
        if hire is None:
            continue
        if fire is not None and fire < hire:
            fire = None
        start = hire.date()
        end = fire.date() if fire is not None else today
        intervals.append((start, end))
    return _merge_intervals(intervals)


def _merge_intervals(intervals: List[Tuple[date, date]]) -> List[Tuple[date, date]]:
    if not intervals:
        return []
    intervals.sort(key=lambda x: x[0])
    merged = [intervals[0]]
    for start, end in intervals[1:]:
        last_start, last_end = merged[-1]
        if start <= last_end + timedelta(days=1):
            merged[-1] = (last_start, max(last_end, end))
        else:
            merged.append((start, end))
    return merged


def _build_path_wide_rows(
    site_person_keys: Set[str],
    person_meta: Dict[str, Dict[str, Any]],
    person_timelines: Dict[str, List[Tuple[pd.Timestamp, str]]],
) -> Tuple[pd.DataFrame, int]:
    max_events = max((len(person_timelines.get(pk, [])) for pk in site_person_keys), default=0)
    columns = list(PATH_BASE_COLUMNS)
    for i in range(1, max_events + 1):
        columns.append(f"Тип события{i}")
        columns.append(f"Дата события{i}")

    rows: List[Dict[str, Any]] = []
    for pk in sorted(site_person_keys):
        meta = person_meta.get(pk, {})
        timeline = person_timelines.get(pk, [])
        row: Dict[str, Any] = {
            "ФИО": meta.get("fio", ""),
            "Дата рождения": meta.get("dob", ""),
            "Табельные номера": meta.get("tabs", ""),
            "Паспорт": meta.get("passport", ""),
        }
        for i, (event_date, event_type) in enumerate(timeline, start=1):
            row[f"Тип события{i}"] = event_type
            row[f"Дата события{i}"] = event_date.strftime("%d.%m.%Y")
        rows.append(row)

    return pd.DataFrame(rows, columns=columns), max_events


def _build_presence_chart_data(
    site_person_keys: Set[str],
    person_meta: Dict[str, Dict[str, Any]],
    person_site_intervals: Dict[str, List[Tuple[date, date]]],
    chart_start: date,
    chart_end: date,
) -> Tuple[List[List[str]], List[str], List[np.ndarray]]:
    """Данные графика: мета-строки, заголовки дат, массивы 0/1 по дням."""
    day_count = (chart_end - chart_start).days + 1
    date_cols = [
        (chart_start + timedelta(days=i)).strftime("%d.%m.%Y") for i in range(day_count)
    ]

    meta_rows: List[List[str]] = []
    value_rows: List[np.ndarray] = []

    for pk in sorted(site_person_keys):
        meta = person_meta.get(pk, {})
        meta_rows.append([meta.get("fio", ""), meta.get("dob", ""), meta.get("tabs", "")])
        arr = np.zeros(day_count, dtype=np.int8)
        for start, end in person_site_intervals.get(pk, []):
            i0 = max(0, (start - chart_start).days)
            i1 = min(day_count - 1, (end - chart_start).days)
            if i0 <= i1:
                arr[i0 : i1 + 1] = 1
        value_rows.append(arr)

    return meta_rows, date_cols, value_rows


def _xlsx_cell_value(value: Any) -> Any:
    if value is None:
        return ""
    if isinstance(value, float) and (np.isnan(value) or np.isinf(value)):
        return ""
    if isinstance(value, (pd.Timestamp, datetime)):
        return value.strftime("%d.%m.%Y")
    if isinstance(value, date):
        return value.strftime("%d.%m.%Y")
    return value


def _xlsx_write_df_sheet(workbook: xlsxwriter.Workbook, sheet_name: str, df: pd.DataFrame) -> None:
    ws = workbook.add_worksheet(sheet_name[:31])
    if df.empty:
        ws.write(0, 0, "Нет данных")
        return
    for r_idx, row in enumerate(dataframe_to_rows(df, index=False, header=True)):
        ws.write_row(r_idx, 0, [_xlsx_cell_value(v) for v in row])


def _xlsx_write_presence_chart(
    workbook: xlsxwriter.Workbook,
    sheet_name: str,
    meta_rows: List[List[str]],
    date_cols: List[str],
    value_rows: List[np.ndarray],
) -> None:
    ws = workbook.add_worksheet(sheet_name[:31])
    ws.write_row(0, 0, ["ФИО", "Дата рождения", "Табельные номера"] + date_cols)
    for r_idx, (meta, values) in enumerate(zip(meta_rows, value_rows), start=1):
        ws.write_row(r_idx, 0, meta + values.tolist())


def report_gelendzhik_career_path(
    gelendzhik_file_path: Optional[str] = None,
    site_territory: Optional[str] = None,
    output_name: Optional[str] = None,
) -> Dict[str, Any]:
    site = _normalize_territory(site_territory or DEFAULT_SITE)
    if not site:
        return {"error": "Не указана площадка (территория)"}

    try:
        df, _ = _load_main_db_dataframe()
    except ValueError as e:
        return {"error": str(e)}

    fio_s = df["ФИО"].fillna("").astype(str).str.strip()
    dob_s = _parse_date_series(df["Дата рождения"]).dt.strftime("%d.%m.%Y").fillna("")
    passport_s = (
        df["Удостоверение.Серия"].fillna("").astype(str).str.strip()
        + df["Удостоверение.Номер"].fillna("").astype(str).str.strip()
    )
    tab_s = df["Табельный номер (с префиксами)"].fillna("").astype(str).str.strip()

    df["person_key"] = np.where(
        (fio_s != "") & (dob_s != ""),
        fio_s + "|" + dob_s,
        np.where(
            (fio_s != "") & (passport_s != ""),
            fio_s + "|passport:" + passport_s,
            np.where(tab_s != "", "tab:" + tab_s, np.where(fio_s != "", fio_s + "|unknown", "unknown")),
        ),
    )

    at_site_mask = df["Территория"].apply(lambda v: _normalize_territory(v) == site)
    site_person_keys: Set[str] = set(df.loc[at_site_mask, "person_key"])

    tab_to_person: Dict[str, str] = {}
    fio_to_person: Dict[str, str] = {}
    for _, row in df.iterrows():
        pk = row["person_key"]
        tab = _normalize_text(row["Табельный номер (с префиксами)"])
        fio = _normalize_text(row["ФИО"])
        if tab:
            tab_to_person[tab] = pk
        if fio:
            fio_to_person[fio] = pk

    aux_frames: Dict[str, pd.DataFrame] = {}
    aux_timeline_by_person: Dict[str, List[Tuple[pd.Timestamp, str]]] = {}

    if gelendzhik_file_path:
        if not os.path.isfile(gelendzhik_file_path):
            return {"error": f"Файл не найден: {gelendzhik_file_path}"}
        for sheet_name in AUX_SHEET_RULES:
            try:
                sheet_df = _load_auxiliary_sheet(gelendzhik_file_path, sheet_name, site)
            except ValueError as e:
                return {"error": str(e)}
            aux_frames[sheet_name] = sheet_df
            for _, aux_row in sheet_df.iterrows():
                tab = _normalize_text(aux_row.get("Табельный номер"))
                fio = _normalize_text(aux_row.get("ФИО"))
                pk = tab_to_person.get(tab) or fio_to_person.get(fio) or _person_key(fio, None, tab=tab)
                if pk:
                    site_person_keys.add(pk)
                events = _timeline_from_aux_row(aux_row, sheet_name, site)
                aux_timeline_by_person.setdefault(pk, []).extend(events)

    if not site_person_keys:
        return {
            "error": f"Не найдено сотрудников для площадки «{site}». "
            "Проверьте основную БД и файл Геленджик.xlsx.",
        }

    involved_df = df[df["person_key"].isin(site_person_keys)].copy()

    person_meta: Dict[str, Dict[str, Any]] = {}
    person_timelines: Dict[str, List[Tuple[pd.Timestamp, str]]] = {}
    person_site_intervals: Dict[str, List[Tuple[date, date]]] = {}
    chart_start_candidates: List[date] = [SITE_OPEN_DATE]

    for pk in site_person_keys:
        person_df = involved_df[involved_df["person_key"] == pk]
        events: List[Tuple[pd.Timestamp, str]] = []

        if not person_df.empty:
            for _, row in person_df.iterrows():
                events.extend(_timeline_from_base_row(row, site))
            fio = _normalize_text(person_df.iloc[0]["ФИО"])
            dob = _format_date(person_df.iloc[0]["Дата рождения"])
            passport = _passport_key(
                person_df.iloc[0]["Удостоверение.Серия"],
                person_df.iloc[0]["Удостоверение.Номер"],
            )
            tabs = sorted(
                {_normalize_text(t) for t in person_df["Табельный номер (с префиксами)"] if _normalize_text(t)}
            )
            person_site_intervals[pk] = _site_intervals_for_person(person_df, site)
            for start, _end in person_site_intervals[pk]:
                chart_start_candidates.append(start)
        else:
            fio = ""
            dob = ""
            passport = ""
            tabs = []
            person_site_intervals[pk] = []

        events.extend(aux_timeline_by_person.get(pk, []))
        person_timelines[pk] = _merge_timeline(events)

        person_meta[pk] = {
            "fio": fio,
            "dob": dob,
            "passport": passport,
            "tabs": ", ".join(tabs) if isinstance(tabs, list) else tabs,
        }

    # Мета для сотрудников только из файла переводов
    for pk in site_person_keys:
        if person_meta.get(pk, {}).get("fio"):
            continue
        for sheet_df in aux_frames.values():
            for _, r in sheet_df.iterrows():
                tab = _normalize_text(r.get("Табельный номер"))
                fio = _normalize_text(r.get("ФИО"))
                rpk = tab_to_person.get(tab) or fio_to_person.get(fio) or _person_key(fio, None, tab=tab)
                if rpk == pk and fio:
                    person_meta[pk] = {
                        "fio": fio,
                        "dob": person_meta[pk].get("dob", ""),
                        "passport": person_meta[pk].get("passport", ""),
                        "tabs": tab or person_meta[pk].get("tabs", ""),
                    }
                    break

    path_df, max_events = _build_path_wide_rows(site_person_keys, person_meta, person_timelines)

    chart_start = max(SITE_OPEN_DATE, min(chart_start_candidates)) if chart_start_candidates else SITE_OPEN_DATE
    chart_end = date.today()
    chart_meta_rows, chart_date_cols, chart_value_rows = _build_presence_chart_data(
        site_person_keys, person_meta, person_site_intervals, chart_start, chart_end
    )
    chart_days = len(chart_date_cols)

    # Сводка
    summary_rows: List[Dict[str, Any]] = []
    for pk in sorted(site_person_keys):
        person_df = involved_df[involved_df["person_key"] == pk]
        meta = person_meta.get(pk, {})
        timeline = person_timelines.get(pk, [])
        hires = [_parse_date(v) for v in person_df["Дата приема"]] if not person_df.empty else []
        hires = [h for h in hires if h is not None]
        fires = [_parse_date(v) for v in person_df["Дата увольнения"]] if not person_df.empty else []
        fires = [f for f in fires if f is not None]
        last_row = person_df.iloc[-1] if not person_df.empty else None
        summary_rows.append(
            {
                "Ключ сотрудника": pk,
                "ФИО": meta.get("fio", ""),
                "Дата рождения": meta.get("dob", ""),
                "Паспорт": meta.get("passport", ""),
                "Табельные номера": meta.get("tabs", ""),
                "Событий в пути": len(timeline),
                "Первый приём": _format_date(min(hires)) if hires else "",
                "Последнее увольнение": _format_date(max(fires)) if fires else "",
                "Текущее состояние": _normalize_text(last_row["Состояние"]) if last_row is not None else "",
                "Последняя территория": _normalize_text(last_row["Территория"]) if last_row is not None else "",
                "Был на площадке 004": "Да",
            }
        )
    summary_df = pd.DataFrame(summary_rows, columns=SUMMARY_COLUMNS)

    base_export_cols = [
        "Табельный номер (с префиксами)",
        "ФИО",
        "Дата рождения",
        "Удостоверение.Серия",
        "Удостоверение.Номер",
        "Организация",
        "Подразделение",
        "Должность",
        "Состояние",
        "Дата приема",
        "Дата увольнения",
        "Территория",
        "Страна гражданства",
    ]
    base_export_df = involved_df[base_export_cols].copy()

    excel_handler.ensure_upload_dir()
    out_base = output_name.strip() if output_name and str(output_name).strip() else "Отчет_Геленджик_путь_сотрудника"
    if not out_base.lower().endswith(".xlsx"):
        out_base = f"{out_base}.xlsx"
    stored_filename = f"{uuid.uuid4().hex[:12]}_{out_base}"
    out_path = os.path.join(UPLOAD_DIR, stored_filename)

    workbook = xlsxwriter.Workbook(out_path, {"nan_inf_to_errors": True})
    try:
        _xlsx_write_df_sheet(workbook, "Путь сотрудника", path_df)
        _xlsx_write_presence_chart(
            workbook, "График присутствия", chart_meta_rows, chart_date_cols, chart_value_rows
        )
        _xlsx_write_df_sheet(workbook, "Сводка", summary_df)
        _xlsx_write_df_sheet(workbook, "Периоды в базе", base_export_df)
        for sheet_name, aux_df in aux_frames.items():
            _xlsx_write_df_sheet(workbook, sheet_name, aux_df)
    finally:
        workbook.close()

    return {
        "success": True,
        "report_type": "gelendzhik_career_path",
        "title": f"Путь сотрудников — {site}",
        "file_path": out_path,
        "stored_filename": stored_filename,
        "file_id": os.path.splitext(stored_filename)[0],
        "site_territory": site,
        "employees_count": len(site_person_keys),
        "base_periods_count": len(involved_df),
        "max_events_per_person": max_events,
        "chart_days": chart_days,
        "chart_start": chart_start.strftime("%d.%m.%Y"),
        "chart_end": chart_end.strftime("%d.%m.%Y"),
        "gelendzhik_file": gelendzhik_file_path or None,
        "sheets": {
            "path": len(path_df),
            "chart": len(chart_meta_rows),
            "summary": len(summary_df),
            "base_periods": len(base_export_df),
            **{k: len(v) for k, v in aux_frames.items()},
        },
    }
