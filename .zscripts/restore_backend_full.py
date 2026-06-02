"""Extract and apply specific large patches from transcript."""
from __future__ import annotations

import json
import re
from pathlib import Path

TRANSCRIPT = Path(
    r"C:\Users\derevyankoga\.cursor\projects\c-Otchet-OP-Marina-OMiK-VSM"
    r"\agent-transcripts\b515532c-b014-4f5c-b9de-f358cebe9fe8"
    r"\b515532c-b014-4f5c-b9de-f358cebe9fe8.jsonl"
)
ROOT = Path(__file__).resolve().parents[1]
INTOPS = ROOT / "mini-services/excel-service/integration_ops.py"
APP = ROOT / "mini-services/excel-service/app.py"


def collect_patches(filename: str) -> list[tuple[int, str, str]]:
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
                if filename not in inp.get("path", "").replace("\\", "/"):
                    continue
                patches.append((line_no, inp.get("old_string", ""), inp.get("new_string", "")))
    return patches


def apply_patches(content: str, patches: list[tuple[int, str, str]]) -> tuple[str, int, int]:
    applied = failed = 0
    for _line_no, old, new in patches:
        if not old:
            continue
        if old in content:
            content = content.replace(old, new, 1)
            applied += 1
        else:
            failed += 1
    return content, applied, failed


def dedupe_intops(content: str) -> str:
    # Remove trailing duplicate stub get_merged_* after merge_tickets
    marker = '\ndef get_merged_calendar_status() -> Dict[str, Any]:\n    return {"loaded": False}'
    idx = content.rfind(marker)
    if idx > 0 and content.count("def get_merged_calendar_status") > 1:
        content = content[:idx].rstrip() + "\n"
    return content


def ensure_atomic_replace(content: str) -> str:
    if "_atomic_replace_file" in content:
        return content
    fn = '''

def _atomic_replace_file(src_path: str, dest_path: str) -> None:
    """Atomically replace dest_path with src_path (src must exist)."""
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
        if os.path.exists(dest_path) and os.path.exists(backup_path):
            os.replace(backup_path, dest_path)
        raise
'''
    anchor = "def _save_merged_calendar_to_sqlite"
    if anchor in content:
        return content.replace(anchor, fn + "\n\n" + anchor, 1)
    return content + fn


def main() -> None:
    # --- integration_ops ---
    base = INTOPS.read_text(encoding="utf-8") if INTOPS.is_file() else ""
    base = dedupe_intops(base)
    patches = collect_patches("integration_ops.py")
    content, applied, failed = apply_patches(base, patches)
    content = dedupe_intops(content)
    content = ensure_atomic_replace(content)
    INTOPS.write_text(content, encoding="utf-8", newline="\n")
    print(f"integration_ops: applied={applied} failed={failed} len={len(content)}")
    for sym in (
        "_normalize_passport",
        "_normalize_fio",
        "_fuzzy_match_fio",
        "_build_fio_indexes",
        "_build_passport_indexes",
        "_atomic_replace_file",
        "merge_calendar_with_main_db",
        "merge_tickets_with_main_db",
    ):
        ok = sym in content and "not implemented" not in content.split(f"def {sym}")[-1][:200]
        print(f"  {sym}: {sym in content} ok={ok}")

    # --- app.py tickets block from line 514 patch if missing ---
    app = APP.read_text(encoding="utf-8")
    if "/api/tickets-costs/status" not in app:
        patches_app = collect_patches("app.py")
        content_app, a, f = apply_patches(app, patches_app)
        app = content_app
        print(f"app.py patches: applied={a} failed={f}")

    if "import integration_ops" not in app:
        app = app.replace("import reports", "import reports\nimport integration_ops\nimport tickets_costs\nimport data_merge", 1)
    if "import gelendzhik_report" not in app:
        app = app.replace("import data_merge", "import data_merge\nimport gelendzhik_report\nimport file_prepare", 1)

    APP.write_text(app, encoding="utf-8", newline="\n")
    print(f"app.py len={len(app)} tickets-costs={'/api/tickets-costs/status' in app}")


if __name__ == "__main__":
    main()
