"""Rebuild integration_ops.py from agent transcript StrReplace chain."""
from __future__ import annotations

import json
from pathlib import Path

TRANSCRIPT = Path(
    r"C:\Users\derevyankoga\.cursor\projects\c-Otchet-OP-Marina-OMiK-VSM"
    r"\agent-transcripts\b515532c-b014-4f5c-b9de-f358cebe9fe8"
    r"\b515532c-b014-4f5c-b9de-f358cebe9fe8.jsonl"
)
ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "mini-services/excel-service/integration_ops.py"

BOOTSTRAP = '''import os
import json
import sqlite3
import re
from datetime import datetime
from typing import Any, Dict, Optional

import pandas as pd
from openpyxl import load_workbook

import calendar_db
import excel_handler
import main_db


def load_calendar_by_path(file_path: str) -> Dict[str, Any]:
    if not file_path or not os.path.isfile(file_path):
        return {"error": f"Файл не найден: {file_path}"}
    return calendar_db.load_calendar_db(file_path)


def merge_calendar_with_main_db(output_name: Optional[str] = None) -> Dict[str, Any]:
    return {"error": "not implemented"}


def merge_tickets_with_main_db(
    ticket_file_path: str,
    output_name: Optional[str] = None,
    sheet_name: Optional[str] = None,
    passport_column: Optional[str] = None,
) -> Dict[str, Any]:
    if not ticket_file_path:
        return {"error": "Не указан путь к файлу отчета билетов"}
    if not os.path.exists(ticket_file_path):
        return {"error": f"Файл не найден: {ticket_file_path}"}

    # Ensure main DB is available
    return {"error": "not implemented"}


def get_merged_calendar_status() -> Dict[str, Any]:
    return {"loaded": False}


def get_merged_calendar_data(**kwargs) -> Dict[str, Any]:
    return {"error": "not loaded", "data": []}
'''


def main() -> None:
    patches: list[tuple[int, str, str]] = []
    with TRANSCRIPT.open(encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            obj = json.loads(line)
            parts = obj.get("message", {}).get("content", [])
            if not isinstance(parts, list):
                continue
            for part in parts:
                if not isinstance(part, dict):
                    continue
                if part.get("type") != "tool_use" or part.get("name") != "StrReplace":
                    continue
                inp = part.get("input", {})
                if not isinstance(inp, dict):
                    continue
                path = inp.get("path", "").replace("\\", "/")
                if "integration_ops.py" not in path:
                    continue
                patches.append((line_no, inp.get("old_string", ""), inp.get("new_string", "")))

    content = BOOTSTRAP
    applied = failed = 0
    for line_no, old, new in patches:
        if not old:
            continue
        if old in content:
            content = content.replace(old, new, 1)
            applied += 1
        else:
            failed += 1

    OUT.write_text(content, encoding="utf-8", newline="\n")
    print(f"patches={len(patches)} applied={applied} failed={failed} len={len(content)}")
    for name in (
        "_normalize_passport",
        "_normalize_fio",
        "_fuzzy_match_fio",
        "_build_fio_indexes",
        "_build_passport_indexes",
        "_translit_latin_to_russian",
        "merge_tickets_with_main_db",
        "merge_calendar_with_main_db",
        "get_merged_calendar_status",
    ):
        print(f"  {name}: {name in content}")


if __name__ == "__main__":
    main()
