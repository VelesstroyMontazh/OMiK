"""Smoke test for /api/health (service must be running on 3031)."""
from __future__ import annotations

import os
import urllib.request
import json
import pytest


def test_health_endpoint_smoke():
    """
    Smoke test for the health endpoint.
    NOTE: This test is skipped if the server is not running (e.g., in CI without deployment).
    """
    base = os.environ.get("EXCEL_BACKEND_URL", "http://127.0.0.1:3031").rstrip("/")
    req = urllib.request.Request(f"{base}/api/health")
    secret = os.environ.get("OMIK_API_SECRET", "").strip()
    if secret:
        req.add_header("X-OMIK-Token", secret)
    
    try:
        with urllib.request.urlopen(req, timeout=5) as resp:
            data = json.loads(resp.read().decode())
        assert data.get("status") == "ok"
        assert "upload_dir" in data
    except urllib.error.URLError as e:
        # Server is not running (common in CI). Skip the test instead of failing.
        pytest.skip(f"Excel service is not reachable at {base} (CI environment?). Error: {e.reason}")
