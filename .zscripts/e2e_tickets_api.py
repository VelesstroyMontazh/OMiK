#!/usr/bin/env python3
"""CLI: smoke E2E load → process. Run with excel-service on :3031.

Large .xlsm files can take many minutes on load/process — progress is printed
before each HTTP call. Use --background to queue process and poll job status.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from pathlib import Path

BASE = os.environ.get("EXCEL_BACKEND_URL", "http://127.0.0.1:3031").rstrip("/")
TEST_FILE = Path(
    os.environ.get(
        "OMIK_E2E_TICKET_FILE",
        r"C:\Otchet_OP_Marina\ВСМ_билеты_с 01.01.2025.xlsm",
    )
)
REGISTRY = os.environ.get("OMIK_E2E_REGISTRY", "vsm")
DEFAULT_TIMEOUT = int(os.environ.get("OMIK_E2E_TIMEOUT_SEC", "1800"))
POLL_SEC = int(os.environ.get("OMIK_E2E_POLL_SEC", "600"))


def _summary(payload: dict, keys: tuple[str, ...]) -> dict:
    out = {k: payload.get(k) for k in keys if k in payload}
    return out or {k: payload[k] for k in list(payload)[:6]}


def _log(msg: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def _req(method: str, path: str, body: dict | None = None, *, timeout: int) -> dict:
    headers = {"Content-Type": "application/json"}
    secret = os.environ.get("OMIK_API_SECRET", "").strip()
    if secret:
        headers["X-OMIK-Token"] = secret
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(f"{BASE}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, timeout=timeout) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        detail = e.read().decode(errors="replace")
        raise RuntimeError(f"HTTP {e.code} {path}: {detail}") from e
    except TimeoutError as e:
        raise RuntimeError(
            f"Timeout ({timeout}s) on {method} {path}. "
            "Increase OMIK_E2E_TIMEOUT_SEC or use --background for process."
        ) from e


def _poll_job(job_id: str, timeout: int) -> dict:
    deadline = time.time() + timeout
    while time.time() < deadline:
        job = _req("GET", f"/api/jobs/{job_id}", timeout=30)
        status = job.get("status")
        _log(f"job {job_id}: {status}")
        if status in ("done", "error"):
            return job
        time.sleep(2)
    raise RuntimeError(f"Job {job_id} did not finish within {timeout}s")


def main() -> int:
    parser = argparse.ArgumentParser(description="E2E tickets-costs load → process")
    parser.add_argument(
        "--background",
        action="store_true",
        help="Queue process in background and poll /api/jobs/{id}",
    )
    parser.add_argument(
        "--health-only",
        action="store_true",
        help="Only GET /api/health (fast smoke, no xlsm file)",
    )
    parser.add_argument(
        "--skip-load",
        action="store_true",
        help="Skip load step (raw data already in DB)",
    )
    parser.add_argument("--registry", default=REGISTRY)
    parser.add_argument("--file", type=Path, default=TEST_FILE, help="Source xlsm/xlsx")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT)
    args = parser.parse_args()

    if args.health_only:
        health = _req("GET", "/api/health", timeout=30)
        _log(f"health: {health.get('status')}")
        return 0 if health.get("status") == "ok" else 1

    if not args.skip_load and not args.file.is_file():
        _log(f"SKIP: file not found: {args.file}")
        return 2

    _log(f"backend {BASE} registry={args.registry} timeout={args.timeout}s")
    if not args.skip_load:
        size_mb = args.file.stat().st_size / (1024 * 1024)
        _log(f"test file: {args.file.name} ({size_mb:.1f} MB) — load may take several minutes")

    health = _req("GET", "/api/health", timeout=30)
    _log(f"health: {health.get('status')}")

    if not args.skip_load:
        _log("POST /api/tickets-costs/load …")
        t0 = time.time()
        load = _req(
            "POST",
            "/api/tickets-costs/load",
            {
                "file_paths": [str(args.file)],
                "registry": args.registry,
                "append": False,
            },
            timeout=args.timeout,
        )
        _log(
            f"load done in {time.time() - t0:.0f}s: "
            f"{_summary(load, ('loaded_files', 'total_rows', 'error', 'message'))}"
        )
        if load.get("error"):
            return 1

    if args.background:
        _log("POST /api/tickets-costs/process?background=true …")
        queued = _req(
            "POST",
            f"/api/tickets-costs/process?background=true",
            {"registry": args.registry, "fuzzy_fio_cutoff": 86},
            timeout=120,
        )
        job_id = queued.get("job_id")
        if not job_id:
            _log(f"process queue failed: {queued}")
            return 1
        _log(f"queued job_id={job_id}, polling up to {POLL_SEC}s …")
        job = _poll_job(job_id, POLL_SEC)
        if job.get("status") != "done":
            _log(f"process failed: {job}")
            return 1
        result = job.get("result") or {}
        _log(
            f"process done: "
            f"{_summary(result, ('rows', 'run_id', 'error', 'message'))}"
        )
        return 1 if result.get("error") else 0

    _log("POST /api/tickets-costs/process (sync) — can take 10+ min on large files …")
    t0 = time.time()
    proc = _req(
        "POST",
        "/api/tickets-costs/process",
        {"registry": args.registry, "fuzzy_fio_cutoff": 86},
        timeout=args.timeout,
    )
    _log(
        f"process done in {time.time() - t0:.0f}s: "
        f"{_summary(proc, ('rows', 'run_id', 'error', 'message'))}"
    )
    return 1 if proc.get("error") else 0


if __name__ == "__main__":
    raise SystemExit(main())
