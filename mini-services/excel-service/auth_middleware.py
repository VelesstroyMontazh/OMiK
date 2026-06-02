"""Optional API token for excel-service (OMIK_API_SECRET)."""
from __future__ import annotations

import os

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse


class ApiTokenMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        secret = os.environ.get("OMIK_API_SECRET", "").strip()
        if not secret or request.url.path == "/api/health":
            return await call_next(request)

        token = request.headers.get("x-omik-token") or ""
        if not token:
            auth = request.headers.get("authorization") or ""
            if auth.lower().startswith("bearer "):
                token = auth[7:].strip()

        if token != secret:
            return JSONResponse({"detail": "Unauthorized"}, status_code=401)
        return await call_next(request)
