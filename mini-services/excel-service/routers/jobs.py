"""Background job status API with cancel support."""
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


@router.post("/api/jobs/{job_id}/cancel")
async def cancel_job(job_id: str):
    """Cancel a running background job."""
    result = task_queue.cancel_job(job_id)
    if not result:
        raise HTTPException(status_code=404, detail="Job not found or already completed")
    return {"status": "ok", "message": f"Job {job_id} cancelled", **result}
