"""Register excel-service API routers on the FastAPI app."""
from __future__ import annotations

from .daily import router as daily_router
from .references import router as references_router
from .jobs import router as jobs_router


def include_routers(app) -> None:
    app.include_router(daily_router)
    app.include_router(references_router)
    app.include_router(jobs_router)
