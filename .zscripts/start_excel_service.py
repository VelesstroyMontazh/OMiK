"""
Запуск excel-service на порту 3031 без PowerShell.
Не завершает уже работающий процесс, если /api/health отвечает.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

PORT = 3031
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SERVICE_DIR = os.path.join(ROOT, "mini-services", "excel-service")
HEALTH_URL = f"http://127.0.0.1:{PORT}/api/health"
LOG_DIR = os.path.join(ROOT, "logs")
LOG_PATH = os.path.join(LOG_DIR, "excel-service.log")
WAIT_SEC = int(os.environ.get("EXCEL_SERVICE_WAIT_SEC", "90"))

CREATE_NO_WINDOW = 0x08000000 if sys.platform == "win32" else 0
CREATE_NEW_CONSOLE = 0x00000010 if sys.platform == "win32" else 0


def _log(msg: str, quiet: bool) -> None:
    if not quiet:
        print(msg, flush=True)


def health_ok() -> bool:
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=2) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))
            return data.get("status") == "ok"
    except KeyboardInterrupt:
        raise
    except (urllib.error.URLError, OSError, json.JSONDecodeError, ValueError):
        return False


def _line_listens_on_port(line: str, port: int) -> bool:
    if f":{port}" not in line:
        return False
    if "LISTENING" in line.upper():
        return True
    return "ПРОСЛУШИВАНИЕ" in line


def pids_on_port(port: int) -> list[int]:
    if sys.platform != "win32":
        return []
    try:
        out = subprocess.check_output(["netstat", "-ano"], text=True, errors="replace")
    except subprocess.CalledProcessError:
        return []
    pids: set[int] = set()
    for line in out.splitlines():
        if not _line_listens_on_port(line, port):
            continue
        parts = line.split()
        if parts:
            try:
                pids.add(int(parts[-1]))
            except ValueError:
                pass
    return sorted(pids)


def kill_port_listeners(port: int, quiet: bool) -> None:
    for pid in pids_on_port(port):
        _log(f"Порт {port} занят PID {pid} — останавливаем...", quiet)
        subprocess.run(
            ["taskkill", "/F", "/PID", str(pid)],
            check=False,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            creationflags=CREATE_NO_WINDOW if sys.platform == "win32" else 0,
        )
    if pids_on_port(port):
        time.sleep(2)


def _log_tail(max_lines: int = 40) -> str:
    if not os.path.isfile(LOG_PATH):
        return "(лог пуст — файл не создан)"
    try:
        with open(LOG_PATH, encoding="utf-8", errors="replace") as f:
            lines = f.readlines()
        tail = lines[-max_lines:]
        return "".join(tail).strip() or "(лог пуст)"
    except OSError as e:
        return f"(не удалось прочитать лог: {e})"


def start_service(*, quiet: bool, foreground: bool) -> subprocess.Popen[str] | None:
    env = os.environ.copy()
    env["UVICORN_WORKERS"] = "1"
    env["PORT"] = str(PORT)
    env.setdefault("EXCEL_SERVICE_HOST", "127.0.0.1")

    cmd = [sys.executable, "app.py"]

    if foreground:
        _log("Запуск excel-service в этом окне (Ctrl+C для остановки)...", quiet)
        os.chdir(SERVICE_DIR)
        os.execve(sys.executable, cmd, env)

    os.makedirs(LOG_DIR, exist_ok=True)
    log_file = open(LOG_PATH, "a", encoding="utf-8", errors="replace")
    log_file.write(f"\n--- start {time.strftime('%Y-%m-%d %H:%M:%S')} pid parent={os.getpid()} ---\n")
    log_file.flush()

    if sys.platform == "win32":
        # Отдельное консольное окно — ошибки импорта видны пользователю (Kaspersky и т.д.)
        creationflags = CREATE_NEW_CONSOLE if not quiet else CREATE_NO_WINDOW
    else:
        creationflags = 0

    proc = subprocess.Popen(
        cmd,
        cwd=SERVICE_DIR,
        env=env,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        creationflags=creationflags,
    )
    return proc


def wait_for_health(
    proc: subprocess.Popen[str] | None,
    *,
    quiet: bool,
) -> int:
    for sec in range(1, WAIT_SEC + 1):
        if proc is not None and proc.poll() is not None:
            code = proc.returncode
            print(
                f"\nПроцесс excel-service завершился с кодом {code} (через {sec} с).",
                file=sys.stderr,
            )
            print(f"Последние строки лога ({LOG_PATH}):\n", file=sys.stderr)
            print(_log_tail(), file=sys.stderr)
            print(
                "\nПодсказка: python .zscripts/start_excel_service.py --foreground",
                file=sys.stderr,
            )
            return 1

        if health_ok():
            _log(f"Готово: {HEALTH_URL}", quiet)
            if not quiet:
                _log(f"Лог: {LOG_PATH}", quiet)
            return 0

        if not quiet and sec % 5 == 0:
            _log(f"  … ожидание health ({sec}/{WAIT_SEC} с)", quiet)

        time.sleep(1)

    print(
        f"Сервис не ответил за {WAIT_SEC} с. Лог: {LOG_PATH}",
        file=sys.stderr,
    )
    print(_log_tail(), file=sys.stderr)
    if proc is not None and proc.poll() is None:
        print(
            "Процесс ещё работает — откройте окно «OMiK Excel API» или проверьте антивирус.",
            file=sys.stderr,
        )
    return 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--quiet", action="store_true", help="Меньше вывода (лог в logs/excel-service.log)")
    parser.add_argument(
        "--force-restart",
        action="store_true",
        help="Освободить порт 3031 перед запуском",
    )
    parser.add_argument(
        "--foreground",
        action="store_true",
        help="Запуск в текущем окне (для отладки ошибок)",
    )
    args = parser.parse_args()
    quiet = args.quiet or os.environ.get("EXCEL_SERVICE_QUIET") == "1"

    if not os.path.isdir(SERVICE_DIR):
        print(f"Не найден каталог: {SERVICE_DIR}", file=sys.stderr)
        return 1

    if args.foreground:
        if pids_on_port(PORT):
            if health_ok():
                _log(f"Excel-service уже работает ({HEALTH_URL})", quiet=False)
                return 0
            _log(
                f"Порт {PORT} занят, но health не отвечает (зависший процесс).",
                quiet=False,
            )
            if not args.force_restart:
                pids = pids_on_port(PORT)
                print(
                    f"Остановите процесс(ы) PID {pids} или запустите:\n"
                    f"  python .zscripts/start_excel_service.py --foreground --force-restart\n"
                    f"  STOP.bat",
                    file=sys.stderr,
                )
                return 1
            kill_port_listeners(PORT, quiet=False)
        elif args.force_restart:
            kill_port_listeners(PORT, quiet=False)
        return start_service(quiet=False, foreground=True) or 0

    if health_ok():
        _log(f"Excel-service уже работает ({HEALTH_URL})", quiet)
        return 0

    if args.force_restart:
        kill_port_listeners(PORT, quiet)
    elif pids_on_port(PORT):
        _log(f"Порт {PORT} занят — ждём health до 12 с…", quiet)
        for _ in range(12):
            if health_ok():
                _log(f"Excel-service уже работает ({HEALTH_URL})", quiet)
                return 0
            time.sleep(1)
        _log(
            f"Порт {PORT} занят, но health не отвечает — перезапуск зависшего процесса…",
            quiet,
        )
        kill_port_listeners(PORT, quiet)

    _log("Запуск excel-service...", quiet)
    if not quiet:
        _log(f"Лог: {LOG_PATH}", quiet)

    proc = start_service(quiet=quiet, foreground=False)
    return wait_for_health(proc, quiet=quiet)


if __name__ == "__main__":
    raise SystemExit(main())
