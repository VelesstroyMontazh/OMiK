"""Shared FastAPI dependencies for excel-service routers."""
from __future__ import annotations

import asyncio
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable


async def run_blocking(func: Callable[..., Any], /, *args: Any, **kwargs: Any) -> Any:
    """Run CPU/IO-heavy sync work off the event loop."""
    return await asyncio.to_thread(func, *args, **kwargs)


def configure_thread_pool(workers: int = 16) -> None:
    loop = asyncio.get_running_loop()
    loop.set_default_executor(ThreadPoolExecutor(max_workers=workers))
