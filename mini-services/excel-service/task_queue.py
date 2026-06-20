"""Background jobs: Celery+Redis (OMIK_USE_CELERY=1) or in-process ThreadPoolExecutor."""
from __future__ import annotations

import os
import threading
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Optional

from logger_config import get_logger

logger = get_logger("task_queue")

_executor = ThreadPoolExecutor(max_workers=4, thread_name_prefix="omik-job")
_lock = threading.Lock()
_jobs: Dict[str, Dict[str, Any]] = {}

_CELERY_STATE = {
    "PENDING": "queued",
    "STARTED": "running",
    "SUCCESS": "done",
    "FAILURE": "error",
    "REVOKED": "error",
    "RETRY": "running",
}


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def celery_enabled() -> bool:
    return os.environ.get("OMIK_USE_CELERY", "").strip().lower() in (
        "1",
        "true",
        "yes",
        "on",
    )


def _set_job_progress(job_id: str, phase: str, detail: str = "") -> None:
    with _lock:
        rec = _jobs.get(job_id)
        if rec:
            rec["phase"] = phase
            rec["progress_detail"] = detail


def submit_job(name: str, func: Callable[..., Any], /, *args: Any, **kwargs: Any) -> str:
    """Generic in-process job (fallback)."""
    job_id = str(uuid.uuid4())
    with _lock:
        _jobs[job_id] = {
            "id": job_id,
            "name": name,
            "status": "queued",
            "backend": "inprocess",
            "created_at": _utc_now(),
            "started_at": None,
            "finished_at": None,
            "result": None,
            "error": None,
            "phase": None,
            "progress_detail": None,
        }

    def _run() -> None:
        logger.info(f"Job {job_id} started: {name}")
        with _lock:
            rec = _jobs.get(job_id)
            if rec:
                rec["status"] = "running"
                rec["started_at"] = _utc_now()
        try:
            result = func(*args, **kwargs)
            with _lock:
                rec = _jobs.get(job_id)
                if rec:
                    rec["status"] = "done"
                    rec["result"] = result
                    rec["finished_at"] = _utc_now()
            logger.info(f"Job {job_id} completed successfully")
        except Exception as exc:
            logger.error(f"Job {job_id} failed: {exc}", exc_info=True)
            with _lock:
                rec = _jobs.get(job_id)
                if rec:
                    rec["status"] = "error"
                    rec["error"] = str(exc)
                    rec["finished_at"] = _utc_now()

    _executor.submit(_run)
    return job_id


def submit_tickets_costs_load(
    registry: str,
    file_paths: list,
    sheet_name: Optional[str],
    append: bool,
) -> Dict[str, Any]:
    import tickets_costs

    def _run_sync() -> dict:
        result = tickets_costs.load_raw_files(file_paths, registry, sheet_name, append)
        if result.get("error"):
            raise ValueError(result["error"])
        return result

    job_id = submit_job(f"tickets-costs-load:{registry}", _run_sync)
    return {"job_id": job_id, "status": "queued", "backend": "inprocess"}


def submit_tickets_costs_pipeline(
    registry: str,
    file_paths: list,
    sheet_name: Optional[str],
    append: bool,
    fuzzy_fio_cutoff: int,
) -> Dict[str, Any]:
    import tickets_costs

    job_id = str(uuid.uuid4())
    with _lock:
        _jobs[job_id] = {
            "id": job_id,
            "name": f"tickets-costs-pipeline:{registry}",
            "status": "queued",
            "backend": "inprocess",
            "created_at": _utc_now(),
            "started_at": None,
            "finished_at": None,
            "result": None,
            "error": None,
            "phase": "queued",
            "progress_detail": "Ожидание запуска…",
        }

    def _progress(phase: str, detail: str = "") -> None:
        _set_job_progress(job_id, phase, detail)

    def _run_sync() -> dict:
        load_result = None
        if file_paths:
            _progress("load", f"0/{len(file_paths)} файлов")

            def _load_progress(done: int, total: int, name: str) -> None:
                _progress("load", f"{done}/{total}: {name}")

            load_result = tickets_costs.load_raw_files(
                file_paths,
                registry,
                sheet_name,
                append,
                progress=_load_progress,
            )
            if load_result.get("error"):
                raise ValueError(load_result["error"])
            _progress("read_raw", f"Загружено {load_result.get('files_loaded', len(file_paths))} файл(ов)")

        def _proc_progress(phase: str, detail: str = "") -> None:
            _progress(phase, detail)

        proc = tickets_costs.process_and_display(
            registry,
            fuzzy_fio_cutoff,
            progress=_proc_progress,
        )
        if proc.get("error"):
            raise ValueError(proc["error"])
        out = dict(proc)
        if load_result:
            out["load"] = load_result
        return out

    def _run() -> None:
        logger.info(f"Pipeline job {job_id} started")
        with _lock:
            rec = _jobs.get(job_id)
            if rec:
                rec["status"] = "running"
                rec["started_at"] = _utc_now()
        try:
            result = _run_sync()
            with _lock:
                rec = _jobs.get(job_id)
                if rec:
                    rec["status"] = "done"
                    rec["result"] = result
                    rec["finished_at"] = _utc_now()
                    rec["phase"] = "done"
                    rec["progress_detail"] = "Готово"
            logger.info(f"Pipeline job {job_id} completed successfully")
        except Exception as exc:
            logger.error(f"Pipeline job {job_id} failed: {exc}", exc_info=True)
            with _lock:
                rec = _jobs.get(job_id)
                if rec:
                    rec["status"] = "error"
                    rec["error"] = str(exc)
                    rec["finished_at"] = _utc_now()
                    rec["phase"] = "error"
                    rec["progress_detail"] = str(exc)

    _executor.submit(_run)
    return {"job_id": job_id, "status": "queued", "backend": "inprocess"}


def submit_tickets_costs_process(registry: str, fuzzy_fio_cutoff: int) -> Dict[str, Any]:
    """Queue tickets-costs process; returns {job_id, status, backend}."""
    if celery_enabled():
        from celery_tasks import tickets_costs_process_task

        async_result = tickets_costs_process_task.delay(registry, fuzzy_fio_cutoff)
        return {
            "job_id": async_result.id,
            "status": "queued",
            "backend": "celery",
        }

    def _run_sync() -> dict:
        result = tickets_costs.process_and_display(registry, fuzzy_fio_cutoff)
        if result.get("error"):
            raise ValueError(result["error"])
        return result

    job_id = submit_job(f"tickets-costs-process:{registry}", _run_sync)
    return {"job_id": job_id, "status": "queued", "backend": "inprocess"}


def _get_inprocess_job(job_id: str) -> Optional[Dict[str, Any]]:
    with _lock:
        rec = _jobs.get(job_id)
        return dict(rec) if rec else None


def _get_celery_job(job_id: str) -> Optional[Dict[str, Any]]:
    try:
        from celery.result import AsyncResult

        from celery_app import celery_app

        ar = AsyncResult(job_id, app=celery_app)
        if ar.state == "PENDING" and ar.result is None and not ar.ready():
            # Unknown id still returns PENDING — treat as queued for polling
            pass

        status = _CELERY_STATE.get(ar.state, ar.state.lower())
        finished = ar.date_done.isoformat() if ar.date_done else None
        error = None
        result = None
        if ar.successful():
            result = ar.result
        elif ar.failed():
            err = ar.result
            error = str(err) if err is not None else "Task failed"

        return {
            "id": job_id,
            "name": getattr(ar, "name", None) or "omik.tickets_costs_process",
            "status": status,
            "backend": "celery",
            "created_at": None,
            "started_at": None,
            "finished_at": finished,
            "result": result,
            "error": error,
        }
    except Exception:
        return None


def get_job(job_id: str) -> Optional[Dict[str, Any]]:
    inproc = _get_inprocess_job(job_id)
    if inproc:
        return inproc
    if celery_enabled():
        return _get_celery_job(job_id)
    # Allow polling celery ids even if env flag off (e.g. after restart)
    celery_rec = _get_celery_job(job_id)
    if celery_rec and celery_rec.get("status") != "queued":
        return celery_rec
    if celery_rec and celery_rec.get("backend") == "celery":
        return celery_rec
    return None
