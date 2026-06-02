"""Ежедневный учёт API."""
from __future__ import annotations

import os
import tempfile
from typing import Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Query

from deps import run_blocking
import daily_tracking
import daily_validation
from data_paths import UPLOAD_DIR

router = APIRouter()


@router.get("/api/daily-tracking/sites")
async def daily_sites(
    active_only: bool = Query(True),
    detailed: bool = Query(False),
):
    try:
        if detailed:
            items = await run_blocking(daily_tracking.list_ploshchadki_detailed, active_only)
            return {"sites": [i["name"] for i in items], "items": items}
        return {"sites": await run_blocking(daily_tracking.list_ploshchadki, active_only)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/daily-tracking")
async def daily_list(
    date: str = Query(...),
    location_id: Optional[str] = None,
    combined: bool = Query(False),
    limit: int = Query(5000),
    offset: int = Query(0),
):
    try:
        return await run_blocking(
            daily_tracking.get_rows,
            date=date,
            location_id=location_id,
            combined=combined,
            limit=limit,
            offset=offset,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/daily-tracking/stats")
async def daily_stats(
    date: str = Query(...),
    location_id: Optional[str] = None,
    combined: bool = Query(False),
):
    try:
        return await run_blocking(
            daily_tracking.get_stats,
            date=date,
            location_id=location_id,
            combined=combined,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/daily-tracking/data")
async def daily_clear(
    date: str = Query(...),
    location_id: Optional[str] = Query(None),
    combined: bool = Query(False),
    user_role: Optional[str] = Query(None),
    user_sites: Optional[str] = Query(None, description="Площадки пользователя через |"),
):
    sites_list = [s for s in (user_sites or "").split("|") if s.strip()]
    try:
        if combined:
            result = await run_blocking(
                daily_tracking.clear_combined_report,
                date,
                role=user_role,
                user_sites=sites_list or None,
            )
        else:
            if not location_id:
                raise HTTPException(status_code=400, detail="Укажите location_id или combined=true")
            result = await run_blocking(
                daily_tracking.clear_site_date,
                location_id,
                date,
                role=user_role,
                user_sites=sites_list or None,
            )
        if result.get("error"):
            msg = str(result["error"])
            if "Нет прав" in msg:
                raise HTTPException(status_code=403, detail=msg)
            raise HTTPException(status_code=400, detail=msg)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/daily-tracking/combined/build")
async def daily_build_combined(
    date: str = Query(...),
    user_role: Optional[str] = Query(None),
):
    try:
        result = await run_blocking(
            daily_tracking.build_combined_report,
            date,
            role=user_role,
            user_sites=None,
        )
        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/daily-tracking/validate")
async def daily_validate(
    date: str = Query(...),
    location_id: Optional[str] = None,
    combined: bool = Query(False),
):
    try:
        result = await run_blocking(
            daily_validation.validate_report,
            date,
            location_id=location_id,
            combined=combined,
        )
        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/daily-tracking/aup")
async def daily_aup_status():
    try:
        return await run_blocking(daily_tracking.get_aup_status)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/daily-tracking/aup")
async def daily_aup_upload(file: UploadFile = File(...)):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    suffix = os.path.splitext(file.filename or ".xlsx")[1] or ".xlsx"
    fd, tmp = tempfile.mkstemp(suffix=suffix, dir=UPLOAD_DIR)
    os.close(fd)
    try:
        content = await file.read()
        with open(tmp, "wb") as out:
            out.write(content)
        result = await run_blocking(
            daily_tracking.save_aup_file,
            tmp,
            file.filename or "АУП_РОП_ИТР.xlsx",
        )
        if result.get("error"):
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass


@router.post("/api/daily-tracking/upload")
async def daily_upload(
    file: UploadFile = File(...),
    location_id: str = Query(...),
    date: str = Query(...),
    confirm: bool = Query(False),
    user_role: Optional[str] = Query(None),
    user_sites: Optional[str] = Query(None, description="Площадки пользователя через |"),
):
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    suffix = os.path.splitext(file.filename or ".xlsx")[1] or ".xlsx"
    fd, tmp = tempfile.mkstemp(suffix=suffix, dir=UPLOAD_DIR)
    os.close(fd)

    try:
        content = await file.read()
        with open(tmp, "wb") as out:
            out.write(content)

        sites_list = [s for s in (user_sites or "").split("|") if s.strip()]

        def _run():
            return daily_tracking.upload_excel(
                tmp,
                location_id=location_id,
                tracking_date=date,
                original_name=file.filename or "upload.xlsx",
                confirm=confirm,
                role=user_role,
                user_sites=sites_list or None,
            )

        result = await run_blocking(_run)
        if result.get("requiresConfirm"):
            raise HTTPException(status_code=409, detail=result)
        if result.get("error"):
            msg = str(result["error"])
            if "Нет прав" in msg:
                raise HTTPException(status_code=403, detail=msg)
            raise HTTPException(status_code=400, detail=msg)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        try:
            os.remove(tmp)
        except OSError:
            pass
