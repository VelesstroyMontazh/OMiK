"""Extract calendar/reports/merge/tickets routes from app.py into routers/."""
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVICE = ROOT / "mini-services/excel-service"
APP = SERVICE / "app.py"
ROUTERS = SERVICE / "routers"
SCHEMAS = SERVICE / "schemas.py"

SECTIONS = [
    ("calendar", "# Calendar Database Operations", "# Reporting Operations"),
    ("reports", "# Reporting Operations", "# Data Merge Operations"),
    ("merge", "# Data Merge Operations", '@app.get("/api/browse/file")'),
    ("tickets", '@app.get("/api/tickets-registry/status")', "# =============================================================================\n# Startup"),
]

ROUTER_HEADER = '''"""{title} API routes."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from deps import run_blocking
from schemas import (
{schema_imports}
)

router = APIRouter()

'''

SCHEMA_MAP = {
    "calendar": ["CalendarLoadRequest"],
    "reports": ["ReportRequest"],
    "merge": ["MergeScanRequest", "MergeExecuteRequest"],
    "tickets": [
        "TicketsRegistryLoadRequest",
        "TicketsMergeRequest",
        "TicketsCostsLoadRequest",
        "TicketsCostsActionRequest",
        "TicketsCostsSaveRowsRequest",
        "TicketsCostsRunRequest",
        "CalendarMainMergeRequest",
    ],
}


def main() -> None:
    text = APP.read_text(encoding="utf-8")

    # schemas.py from models block
    m_start = text.index("class SheetUpdateRequest")
    m_end = text.index("# =============================================================================\n# Health Check")
    schemas_body = text[m_start:m_end].strip()
    SCHEMAS.write_text(
        '"""Pydantic request models for excel-service."""\n'
        "from __future__ import annotations\n\n"
        "from typing import Any, Dict, List, Optional\n\n"
        "from pydantic import BaseModel\n\n"
        + schemas_body
        + "\n",
        encoding="utf-8",
    )
    text = text[:m_start] + "from schemas import *  # noqa: F403\n\n" + text[m_end:]

    ROUTERS.mkdir(exist_ok=True)

    for name, start_marker, end_marker in SECTIONS:
        start = text.index(start_marker)
        end = text.index(end_marker, start)
        block = text[start:end].strip()
        block = "\n".join(
            ln for ln in block.splitlines() if not ln.startswith("# =====")
        )
        block = block.replace("@app.", "@router.")
        imports = ",\n".join(f"    {s}" for s in SCHEMA_MAP[name])
        header = ROUTER_HEADER.format(title=name.title(), schema_imports=imports)

        if name == "reports":
            # keep _generate_report_sync in reports router
            pass
        elif name == "calendar":
            block = "import calendar_db\nimport integration_ops\n\n" + block
        elif name == "merge":
            block = "import data_merge\n\n" + block
        elif name == "tickets":
            block = (
                "import integration_ops\nimport tickets_costs\nimport tickets_db\n\n"
                + block
            )

        (ROUTERS / f"{name}.py").write_text(header + block + "\n", encoding="utf-8")
        text = text[:start] + f"# → routers/{name}.py\n\n" + text[end:]

    (ROUTERS / "__init__.py").write_text(
        '"""Domain routers."""\n'
        "from .calendar import router as calendar_router\n"
        "from .reports import router as reports_router\n"
        "from .merge import router as merge_router\n"
        "from .tickets import router as tickets_router\n\n\n"
        "def include_routers(app):\n"
        "    app.include_router(calendar_router)\n"
        "    app.include_router(reports_router)\n"
        "    app.include_router(merge_router)\n"
        "    app.include_router(tickets_router)\n",
        encoding="utf-8",
    )

    if "from routers import include_routers" not in text:
        startup = "# =============================================================================\n# Startup"
        text = text.replace(
            startup,
            "from routers import include_routers\n"
            "from auth_middleware import ApiTokenMiddleware\n"
            "from deps import configure_thread_pool, run_blocking\n\n"
            "app.add_middleware(ApiTokenMiddleware)\n"
            "include_routers(app)\n\n"
            + startup,
            1,
        )

    # Remove duplicate run_blocking definition
    text = text.replace(
        "async def run_blocking(func: Callable[..., Any], /, *args: Any, **kwargs: Any) -> Any:\n"
        '    """Run CPU/IO-heavy sync work off the event loop so /api/health stays responsive."""\n'
        "    return await asyncio.to_thread(func, *args, **kwargs)\n\n\n",
        "",
    )
    text = text.replace(
        "@app.on_event(\"startup\")\nasync def _configure_thread_pool() -> None:\n"
        "    loop = asyncio.get_running_loop()\n"
        "    loop.set_default_executor(ThreadPoolExecutor(max_workers=16))\n",
        '@app.on_event("startup")\nasync def _configure_thread_pool() -> None:\n'
        "    configure_thread_pool(16)\n",
    )

    APP.write_text(text, encoding="utf-8")
    print("OK: routers + schemas created")


if __name__ == "__main__":
    main()
