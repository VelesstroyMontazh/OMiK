"""
Data merge service for combining multiple Excel files/sheets.
"""

import os
from typing import Any, Dict, List, Optional
from datetime import datetime

import pandas as pd

from excel_libs import read_dataframe

from excel_libs import read_dataframe

import excel_handler


SUPPORTED_EXTENSIONS = {".xlsx", ".xls", ".xlsb", ".xlsm", ".csv", ".tsv"}


def _normalize_headers(cols: List[Any]) -> List[str]:
    out: List[str] = []
    for i, c in enumerate(cols, start=1):
        name = str(c).strip() if c is not None else ""
        out.append(name if name else f"Колонка_{i}")
    return out


def _read_sheet_df(file_path: str, sheet_name: str, header_row: int) -> pd.DataFrame:
    ext = os.path.splitext(file_path)[1].lower()
    header_idx = max(0, int(header_row) - 1)

    if ext in (".xlsx", ".xlsm", ".xls", ".xlsb"):
        df = read_dataframe(file_path, sheet_name=sheet_name, header=header_idx)
    elif ext == ".csv":
        df = pd.read_csv(file_path, header=header_idx, dtype=object)
    elif ext == ".tsv":
        df = pd.read_csv(file_path, sep="\t", header=header_idx, dtype=object)
    else:
        raise ValueError(f"Неподдерживаемый формат: {ext}")

    df.columns = _normalize_headers(list(df.columns))
    return df


def scan_folder(folder_path: str) -> Dict[str, Any]:
    if not folder_path:
        return {"error": "Не указан путь к папке"}
    if not os.path.isdir(folder_path):
        return {"error": f"Папка не найдена: {folder_path}"}

    files: List[Dict[str, Any]] = []
    for name in sorted(os.listdir(folder_path)):
        p = os.path.join(folder_path, name)
        if not os.path.isfile(p):
            continue
        ext = os.path.splitext(name)[1].lower()
        if ext not in SUPPORTED_EXTENSIONS:
            continue
        sheets = excel_handler.get_sheet_names(p)
        files.append(
            {
                "name": name,
                "file_path": p,
                "extension": ext,
                "file_size": os.path.getsize(p),
                "sheets": sheets,
                "modified": datetime.fromtimestamp(os.path.getmtime(p)).isoformat(),
            }
        )
    return {"folder_path": folder_path, "files": files, "count": len(files)}


def merge_data(
    mode: str,
    items: List[Dict[str, Any]],
    selected_headers: Optional[List[str]] = None,
    target_headers: Optional[List[str]] = None,
    mappings: Optional[Dict[str, Dict[str, str]]] = None,
    output_name: Optional[str] = None,
) -> Dict[str, Any]:
    valid_modes = {"headers_equal", "headers_equal_select", "headers_not_equal"}
    if mode not in valid_modes:
        return {"error": f"Неверный режим объединения: {mode}"}
    if not items:
        return {"error": "Не выбраны источники для объединения"}

    included = [i for i in items if i.get("include", True)]
    if not included:
        return {"error": "Нет выбранных файлов/листов для объединения"}

    result_frames: List[pd.DataFrame] = []
    inferred_headers: Optional[List[str]] = None
    source_rows = 0

    for item in included:
        file_path = item.get("file_path")
        sheet_name = item.get("sheet_name")
        header_row = int(item.get("header_row", 1))
        if not file_path or not sheet_name:
            return {"error": "Каждый источник должен содержать file_path и sheet_name"}
        if not os.path.exists(file_path):
            return {"error": f"Файл не найден: {file_path}"}

        df = _read_sheet_df(file_path, sheet_name, header_row)
        source_rows += len(df)
        key = f"{file_path}::{sheet_name}"

        if mode == "headers_equal":
            if inferred_headers is None:
                inferred_headers = list(df.columns)
            if list(df.columns) != inferred_headers:
                return {"error": f"Заголовки не совпадают: {key}"}
            result_frames.append(df.copy())
            continue

        if mode == "headers_equal_select":
            if not selected_headers:
                return {"error": "Не выбраны заголовки для режима 'Заголовки равны, выбрать'"}
            missing = [h for h in selected_headers if h not in df.columns]
            if missing:
                return {"error": f"В источнике {key} отсутствуют заголовки: {', '.join(missing)}"}
            result_frames.append(df[selected_headers].copy())
            continue

        # headers_not_equal
        if not target_headers:
            return {"error": "Не заданы целевые заголовки для режима 'Заголовки не совпадают'"}
        if not mappings or key not in mappings:
            return {"error": f"Не задано сопоставление заголовков для источника: {key}"}
        source_map = mappings.get(key, {})
        out_df = pd.DataFrame(index=df.index)
        for target in target_headers:
            src = source_map.get(target, "")
            if src and src in df.columns:
                out_df[target] = df[src]
            else:
                out_df[target] = None
        result_frames.append(out_df)

    if not result_frames:
        return {"error": "Нет данных для объединения"}

    merged_df = pd.concat(result_frames, ignore_index=True)
    merged_df = merged_df.fillna("")

    if mode == "headers_equal":
        final_headers = list(merged_df.columns)
    elif mode == "headers_equal_select":
        final_headers = selected_headers or list(merged_df.columns)
    else:
        final_headers = target_headers or list(merged_df.columns)
    merged_df = merged_df[final_headers]

    excel_handler.ensure_upload_dir()
    base = output_name.strip() if output_name else f"merged_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    if not base.lower().endswith(".xlsx"):
        base = f"{base}.xlsx"
    stored_filename = f"{excel_handler.generate_file_id()}_{base}"
    output_path = os.path.join(excel_handler.UPLOAD_DIR, stored_filename)

    merged_df.to_excel(output_path, index=False, sheet_name="Объединение")

    return {
        "success": True,
        "mode": mode,
        "stored_filename": stored_filename,
        "file_path": output_path,
        "file_id": os.path.splitext(stored_filename)[0],
        "rows": int(len(merged_df)),
        "columns": int(len(merged_df.columns)),
        "source_rows": int(source_rows),
        "source_files": len(included),
        "headers": final_headers,
    }