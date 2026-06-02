"""Restore app.py tickets/integration/merge routes from transcript patches."""
from __future__ import annotations

import json
import subprocess
from pathlib import Path

TRANSCRIPT = Path(
    r"C:\Users\derevyankoga\.cursor\projects\c-Otchet-OP-Marina-OMiK-VSM"
    r"\agent-transcripts\b515532c-b014-4f5c-b9de-f358cebe9fe8"
    r"\b515532c-b014-4f5c-b9de-f358cebe9fe8.jsonl"
)
ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "mini-services/excel-service/app.py"


def git_app() -> str:
    out = subprocess.check_output(
        ["git", "show", "HEAD:mini-services/excel-service/app.py"],
        cwd=ROOT,
        stderr=subprocess.DEVNULL,
    )
    return out.decode("utf-8")


def main() -> None:
    content = APP.read_text(encoding="utf-8") if APP.is_file() else git_app()
    patches: list[tuple[int, str, str]] = []
    writes: list[tuple[int, str]] = []

    with TRANSCRIPT.open(encoding="utf-8") as f:
        for line_no, line in enumerate(f, 1):
            obj = json.loads(line)
            parts = obj.get("message", {}).get("content", [])
            if not isinstance(parts, list):
                continue
            for part in parts:
                if not isinstance(part, dict) or part.get("type") != "tool_use":
                    continue
                inp = part.get("input", {})
                if not isinstance(inp, dict):
                    continue
                path = inp.get("path", "").replace("\\", "/")
                if not path.endswith("mini-services/excel-service/app.py") and "excel-service/app.py" not in path:
                    continue
                if part.get("name") == "Write":
                    writes.append((line_no, inp.get("contents", "")))
                elif part.get("name") == "StrReplace":
                    patches.append((line_no, inp.get("old_string", ""), inp.get("new_string", "")))

    # Skip tiny overwrite writes
    for line_no, w in writes:
        if line_no == 1350 and len(w) > 10000:
            content = w

    applied = failed = 0
    for _line_no, old, new in patches:
        if not old:
            continue
        if old in content:
            content = content.replace(old, new, 1)
            applied += 1
        else:
            failed += 1

    # Ensure critical imports
    for imp in (
        "import integration_ops",
        "import tickets_costs",
        "import data_merge",
        "import gelendzhik_report",
        "import file_prepare",
    ):
        if imp not in content:
            anchor = "import reports"
            if anchor in content:
                content = content.replace(anchor, f"{anchor}\n{imp}", 1)

    if "include_routers(app)" not in content:
        marker = 'app.add_middleware(\n    CORSMiddleware,'
        insert = (
            "include_routers(app)\n\n"
            if marker in content
            else ""
        )
        if insert and marker in content:
            content = content.replace(
                marker,
                f"{insert}{marker}",
                1,
            )

    APP.write_text(content, encoding="utf-8", newline="\n")
    print(f"writes={len(writes)} applied={applied} failed={failed} len={len(content)}")
    for route in (
        "/api/tickets-costs/status",
        "/api/tickets-registry/status",
        "/api/integration/calendar/load-by-path",
        "/api/merge/scan-folder",
        "/api/file-prepare",
        "/api/gelendzhik",
    ):
        print(f"  {route}: {route in content}")


if __name__ == "__main__":
    main()
