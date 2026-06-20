"""
E2E: tickets-costs load → process via HTTP API.

Requires excel-service on EXCEL_BACKEND_URL (default http://127.0.0.1:3031).
Set OMIK_E2E_TICKET_FILE to a small .xlsx/.xlsm path, or uses default if file exists.
"""
from __future__ import annotations

import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest

BASE = os.environ.get("EXCEL_BACKEND_URL", "http://127.0.0.1:3031").rstrip("/")
DEFAULT_FILE = Path(__file__).parent / "fixtures" / "test_tickets.xlsm"
TEST_FILE = Path(os.environ.get("OMIK_E2E_TICKET_FILE", str(DEFAULT_FILE)))
REGISTRY = os.environ.get("OMIK_E2E_REGISTRY", "vsm")
POLL_SEC = int(os.environ.get("OMIK_E2E_POLL_SEC", "600"))


def _headers() -> dict[str, str]:
    h = {"Content-Type": "application/json"}
    secret = os.environ.get("OMIK_API_SECRET", "").strip()
    if secret:
        h["X-OMIK-Token"] = secret
    return h


def _post(path: str, body: dict) -> dict:
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(body).encode(),
        headers=_headers(),
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=120) as resp:
        return json.loads(resp.read().decode())


def _get(path: str) -> dict:
    req = urllib.request.Request(f"{BASE}{path}", headers=_headers(), method="GET")
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())


def _service_up() -> bool:
    try:
        data = _get("/api/health")
        return data.get("status") == "ok"
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


@pytest.mark.skipif(not _service_up(), reason="excel-service not running on 3031")
@pytest.mark.skipif(not TEST_FILE.is_file(), reason=f"test file missing: {TEST_FILE}")
def test_tickets_load_then_process_sync():
    load = _post(
        "/api/tickets-costs/load",
        {
            "file_paths": [str(TEST_FILE)],
            "registry": REGISTRY,
            "append": False,
        },
    )
    assert "error" not in load or not load.get("error"), load

    proc = _post(
        "/api/tickets-costs/process",
        {"registry": REGISTRY, "fuzzy_fio_cutoff": 86},
    )
    assert "error" not in proc or not proc.get("error"), proc
    assert proc.get("rows") is not None or proc.get("run_id") is not None


@pytest.mark.skipif(not _service_up(), reason="excel-service not running on 3031")
@pytest.mark.skipif(not TEST_FILE.is_file(), reason=f"test file missing: {TEST_FILE}")
def test_tickets_load_then_process_background():
    load = _post(
        "/api/tickets-costs/load",
        {
            "file_paths": [str(TEST_FILE)],
            "registry": REGISTRY,
            "append": True,
        },
    )
    assert "error" not in load or not load.get("error"), load

    queued = _post(
        f"/api/tickets-costs/process?background=true",
        {"registry": REGISTRY, "fuzzy_fio_cutoff": 86},
    )
    job_id = queued.get("job_id")
    assert job_id, queued

    deadline = time.time() + POLL_SEC
    status = "queued"
    job: dict = {}
    while time.time() < deadline:
        job = _get(f"/api/jobs/{job_id}")
        status = job.get("status")
        if status in ("done", "error"):
            break
        time.sleep(2)

    assert status == "done", job
    assert job.get("result") is not None
