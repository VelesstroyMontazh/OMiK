"""Остановить процессы на порту 3031 без PowerShell."""
from __future__ import annotations

import subprocess
import sys
import time

PORT = 3031


def pids_on_port(port: int) -> list[int]:
    if sys.platform != "win32":
        return []
    try:
        out = subprocess.check_output(["netstat", "-ano"], text=True, errors="replace")
    except subprocess.CalledProcessError:
        return []
    pids: set[int] = set()
    for line in out.splitlines():
        if f":{port}" not in line:
            continue
        upper = line.upper()
        if "LISTENING" not in upper and "ПРОСЛУШИВАНИЕ" not in line:
            continue
        parts = line.split()
        if parts:
            try:
                pids.add(int(parts[-1]))
            except ValueError:
                pass
    return sorted(pids)


def main() -> int:
    pids = pids_on_port(PORT)
    if not pids:
        print(f"Порт {PORT} свободен.")
        return 0
    for pid in pids:
        print(f"Останавливаем PID {pid}...")
        subprocess.run(["taskkill", "/F", "/PID", str(pid)], check=False)
    time.sleep(2)
    if pids_on_port(PORT):
        print(f"Порт {PORT} всё ещё занят. Завершите Python вручную.", file=sys.stderr)
        return 1
    print(f"Порт {PORT} освобождён. Запуск: python .zscripts/start_excel_service.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
