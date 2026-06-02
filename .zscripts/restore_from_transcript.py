"""Restore project files from agent transcript (Write + StrReplace chronologically)."""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

TRANSCRIPT = Path(
    r"C:\Users\derevyankoga\.cursor\projects\c-Otchet-OP-Marina-OMiK-VSM"
    r"\agent-transcripts\b515532c-b014-4f5c-b9de-f358cebe9fe8"
    r"\b515532c-b014-4f5c-b9de-f358cebe9fe8.jsonl"
)
ROOT = Path(__file__).resolve().parents[1]


def norm_path(p: str) -> str:
    if "OMiK_VSM" in p:
        p = re.split(r"OMiK_VSM[\\/]", p, maxsplit=1)[-1]
    return p.replace("\\", "/")


def git_base(rel: str) -> str | None:
    try:
        out = subprocess.check_output(
            ["git", "show", f"HEAD:{rel.replace('/', '\\')}"],
            cwd=ROOT,
            stderr=subprocess.DEVNULL,
        )
        return out.decode("utf-8")
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


def load_base(rel: str) -> str | None:
    path = ROOT / rel
    if path.is_file():
        return path.read_text(encoding="utf-8")
    return git_base(rel)


def main() -> None:
    files: dict[str, str | None] = {}
    applied = 0
    failed = 0
    writes = 0
    bootstrapped = 0

    with TRANSCRIPT.open(encoding="utf-8") as f:
        for line in f:
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            msg = obj.get("message", {})
            content = msg.get("content", [])
            if not isinstance(content, list):
                continue
            for part in content:
                if not isinstance(part, dict) or part.get("type") != "tool_use":
                    continue
                name = part.get("name")
                inp = part.get("input")
                if not isinstance(inp, dict):
                    continue
                p = inp.get("path", "")
                if not p or "OMiK_VSM" not in p:
                    continue
                rel = norm_path(p)

                if name == "Write" and "contents" in inp:
                    files[rel] = inp["contents"]
                    writes += 1
                elif name == "StrReplace" and "old_string" in inp and "new_string" in inp:
                    old = inp["old_string"]
                    new = inp["new_string"]
                    current = files.get(rel)
                    if current is None:
                        current = load_base(rel)
                        if current is not None:
                            files[rel] = current
                            bootstrapped += 1
                    if current is None:
                        failed += 1
                        continue
                    if old in current:
                        files[rel] = current.replace(old, new, 1)
                        applied += 1
                    else:
                        failed += 1

    written = 0
    for rel, content in files.items():
        if content is None:
            continue
        out = ROOT / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(content, encoding="utf-8", newline="\n")
        written += 1

    src_count = sum(1 for _ in (ROOT / "src").rglob("*") if _.is_file())
    print(f"Writes seen: {writes}")
    print(f"Bootstrapped from disk/git: {bootstrapped}")
    print(f"Written: {written} files")
    print(f"StrReplace applied: {applied}, failed: {failed}")
    print(f"Src files now: {src_count}")

    mdb = ROOT / "src/components/excel/MainDatabasePanel.tsx"
    if mdb.is_file():
        text = mdb.read_text(encoding="utf-8")
        print("MainDatabasePanel markers:")
        for marker in [
            "loadAllMode",
            "Загрузить все строки",
            "FilterableDataTable",
            "PAGE_SIZE_MAX",
        ]:
            print(f"  {marker}: {marker in text}")


if __name__ == "__main__":
    main()
