@app.delete("/api/tickets-registry/clear")
async def tickets_registry_clear(registry: Optional[str] = None):
    try:
        return await run_blocking(tickets_db.clear_cache, registry=registry)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tickets-costs/status")
async def tickets_costs_status(registry: Optional[str] = None):
    try:
        return await run_blocking(tickets_costs.get_status, registry=registry)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tickets-costs/dashboard")
async def tickets_costs_dashboard(
    registry: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    podrazdelenie: Optional[str] = None,
):
    try:
        return await run_blocking(
            tickets_costs.dashboard_stats,
            registry=registry,
            year=year,
            month=month,
            podrazdelenie=podrazdelenie,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tickets-costs/data")
async def tickets_costs_data(
    registry: str = "vsm",
    search: Optional[str] = None,
    podrazdelenie: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    obosnovanie: Optional[str] = None,
    offset: int = 0,
    limit: int = 200,
):
    try:
        return await run_blocking(
            tickets_costs.get_data,
            registry=registry,
            search=search,
            podrazdelenie=podrazdelenie,
            year=year,
            month=month,
            obosnovanie=obosnovanie,
            offset=offset,
            limit=limit,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tickets-costs/load")
async def tickets_costs_load(request: TicketsCostsLoadRequest):
    try:
        result = await run_blocking(
            tickets_costs.load_raw_files,
            request.file_paths,
            request.registry,
            request.sheet_name,
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tickets-costs/process")
async def tickets_costs_process(request: TicketsCostsActionRequest):
    try:
        result = await run_blocking(
            tickets_costs.process_and_display,
            request.registry,
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tickets-costs/dedupe-enrich")
async def tickets_costs_dedupe_enrich(request: TicketsCostsActionRequest):
    try:
        result = await run_blocking(
            tickets_costs.dedupe_and_enrich,
            request.registry,
            request.fuzzy,
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/tickets-costs/clear")
async def tickets_costs_clear(registry: str = "vsm"):
    try:
        return await run_blocking(tickets_costs.clear_registry, registry)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/integration/tickets/merge-with-main-db")