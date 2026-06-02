"""Assemble integration_ops.py from transcript patches with deduplication."""
from __future__ import annotations

import json
import re
from pathlib import Path

TRANSCRIPT = Path(
    r"C:\Users\derevyankoga\.cursor\projects\c-Otchet-OP-Marina-OMiK-VSM"
    r"\agent-transcripts\b515532c-b014-4f5c-b9de-f358cebe9fe8"
    r"\b515532c-b014-4f5c-b9de-f358cebe9fe8.jsonl"
)
OUT = Path(__file__).resolve().parents[1] / "mini-services/excel-service/integration_ops.py"

BOOTSTRAP = """import os
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
"""


def collect_patches() -> list[tuple[int, str, str]]:
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
                if "integration_ops.py" not in inp.get("path", "").replace("\\", "/"):
                    continue
                patches.append((line_no, inp.get("old_string", ""), inp.get("new_string", "")))
    return patches


def dedupe_functions(content: str) -> str:
    """Keep the longest definition for each top-level def/const block."""
    lines = content.splitlines()
    header_end = 0
    for i, line in enumerate(lines):
        if line.startswith("def ") or line.startswith("MATCH_") or line.startswith("FUZZY_"):
            header_end = i
            break

    header = "\n".join(lines[:header_end]).strip()
    body = "\n".join(lines[header_end:])

    chunks: list[tuple[str, str]] = []
    current: list[str] = []
    current_name = "__module__"

    for line in body.splitlines():
        m = re.match(r"^(def |MATCH_|FUZZY_|HIGHLIGHT_|_LATIN_|CALENDAR_|_merged_cache)", line)
        if m and current:
            chunks.append((current_name, "\n".join(current).strip()))
            current = [line]
            if line.startswith("def "):
                current_name = line.split("(")[0].replace("def ", "").strip()
            else:
                current_name = line.split("=")[0].strip()
        else:
            current.append(line)
    if current:
        chunks.append((current_name, "\n".join(current).strip()))

    best: dict[str, str] = {}
    for name, chunk in chunks:
        if not chunk:
            continue
        if name not in best or len(chunk) > len(best[name]):
            best[name] = chunk

    # Preserve order of first appearance
    order: list[str] = []
    seen: set[str] = set()
    for name, _ in chunks:
        if name in seen:
            continue
        seen.add(name)
        order.append(name)

    parts = [header]
    for name in order:
        if name in best and best[name]:
            parts.append(best[name])
    return "\n\n".join(parts) + "\n"


def main() -> None:
    content = BOOTSTRAP
    applied = failed = 0
    for _line_no, old, new in collect_patches():
        if not old:
            continue
        if old in content:
            content = content.replace(old, new, 1)
            applied += 1
        else:
            failed += 1

    content = dedupe_functions(content)

    # Fix imports block duplicates manually
    content = re.sub(
        r"(from data_paths import UPLOAD_DIR\n\n)+",
        "from data_paths import UPLOAD_DIR\n\n",
        content,
    )
    content = re.sub(
        r"(import tickets_db\n)+",
        "import tickets_db\n",
        content,
    )
    content = re.sub(
        r"(CALENDAR_MERGED_DB_PATH = os\.path\.join\(UPLOAD_DIR, \"calendar_merged_db\.sqlite\"\)\n"
        r"CALENDAR_MERGED_META_PATH = os\.path\.join\(UPLOAD_DIR, \"calendar_merged_meta\.json\"\)\n\n"
        r"_merged_cache: Dict\[str, Any\] = \{\"loaded\": False\}\n\n)+",
        "CALENDAR_MERGED_DB_PATH = os.path.join(UPLOAD_DIR, \"calendar_merged_db.sqlite\")\n"
        "CALENDAR_MERGED_META_PATH = os.path.join(UPLOAD_DIR, \"calendar_merged_meta.json\")\n\n"
        "_merged_cache: Dict[str, Any] = {\"loaded\": False}\n\n",
        content,
    )

    OUT.write_text(content, encoding="utf-8", newline="\n")
    print(f"applied={applied} failed={failed} len={len(content)}")
    for sym in (
        "_normalize_passport",
        "_normalize_fio",
        "_fuzzy_match_fio",
        "_build_fio_indexes",
        "_build_passport_indexes",
        "merge_calendar_with_main_db",
        "merge_tickets_with_main_db",
        "get_merged_calendar_status",
    ):
        chunk = content.split(f"def {sym}" if sym.startswith("merge") or sym.startswith("get_") else sym)
        ok = sym in content
        if sym.startswith("merge") and ok:
            body = content.split(f"def {sym}", 1)[-1][:300]
            ok = "not implemented" not in body and "error" not in body[:80]
        print(f"  {sym}: {ok}")


if __name__ == "__main__":
    main()
