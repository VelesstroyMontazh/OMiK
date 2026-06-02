"""Background job status API."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

import task_queue

router = APIRouter()


@router.get("/api/jobs/{job_id}")
async def job_status(job_id: str):
    rec = task_queue.get_job(job_id)
    if not rec:
        raise HTTPException(status_code=404, detail="Job not found")
    return rec
