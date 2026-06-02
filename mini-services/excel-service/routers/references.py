"""Справочники API."""
from __future__ import annotations

import os

from fastapi import APIRouter, HTTPException, UploadFile, File
from pydantic import BaseModel

from deps import run_blocking
import references

router = APIRouter()


class LoginRequest(BaseModel):
    login: str
    password: str


@router.post("/api/auth/login")
async def auth_login(body: LoginRequest):
    try:
        user = await run_blocking(references.verify_user, body.login, body.password)
        if not user:
            raise HTTPException(status_code=401, detail="Неверный логин или пароль")
        return {
            "user": {
                "login": user["login"],
                "role": user["role"],
                "sites": user.get("sites") or [],
            },
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/references/status")
async def references_status():
    try:
        return await run_blocking(references.status)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/references/load")
async def references_load():
    try:
        return await run_blocking(references.load_from_disk)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/references/apply")
async def references_apply():
    try:
        result = await run_blocking(references.apply_all)
        err = (result.get("main_db") or {}).get("error")
        if err:
            raise HTTPException(status_code=400, detail=err)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/api/references/upload/{kind}")
async def references_upload(kind: str, file: UploadFile = File(...)):
    kind_map = {
        "territory": references.TERRITORY_FILE,
        "podr": references.PODR_FILE,
        "login": references.LOGIN_FILE,
    }
    target_name = kind_map.get(kind)
    if not target_name:
        raise HTTPException(status_code=400, detail=f"Неизвестный тип: {kind}")

    content = await file.read()

    def _save():
        ref_dir = references.references_dir()
        dest = os.path.join(ref_dir, target_name)
        with open(dest, "wb") as out:
            out.write(content)
        return references.load_from_disk()

    try:
        return await run_blocking(_save)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
