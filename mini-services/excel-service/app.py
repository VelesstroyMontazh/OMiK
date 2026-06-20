"""
Excel Processing Service - FastAPI Application
Provides REST API for Excel file processing with multiple libraries.
"""

import asyncio
import os
import sys
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Callable, Dict, List, Optional

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from slowapi import SlowAPI, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

# Add current directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import browse_dialog
import calendar_db
import data_merge
import data_ops
import data_paths
import excel_handler
import file_prepare
import gelendzhik_report
import integration_ops
import macro_engine
import main_db
import reports
import tickets_costs
import tickets_db
import vba_lab
import welcome_settings
from auth_middleware import ApiTokenMiddleware
from routers import include_routers

app = FastAPI(
    title="Excel Processing Service",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json"
)

# Initialize rate limiter
rate_limiter = SlowAPI(limiter_key_func=get_remote_address)
app.state.limiter = rate_limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


async def run_blocking(func: Callable[..., Any], /, *args: Any, **kwargs: Any) -> Any:
    """Run CPU/IO-heavy sync work off the event loop so /api/health stays responsive."""
    return await asyncio.to_thread(func, *args, **kwargs)


@app.on_event("startup")
async def _configure_thread_pool() -> None:
    loop = asyncio.get_running_loop()
    loop.set_default_executor(ThreadPoolExecutor(max_workers=16))

# CORS middleware — по умолчанию только localhost (см. CORS_ORIGINS в .env.example)
def _cors_origins() -> List[str]:
    raw = os.environ.get("CORS_ORIGINS", "").strip()
    if raw:
        return [o.strip() for o in raw.split(",") if o.strip()]
    return [
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:81",
        "http://localhost:81",
    ]


app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(ApiTokenMiddleware)
include_routers(app)

# Migrate legacy project upload/ → external data dir, then ensure it exists.
data_paths.migrate_legacy_upload_dir()
excel_handler.ensure_upload_dir()


# =============================================================================
# Request/Response Models
# =============================================================================

class SheetUpdateRequest(BaseModel):
    file_path: str
    sheet_name: str
    changes: List[dict]

class SheetCreateRequest(BaseModel):
    file_path: str
    sheet_name: str

class SheetDeleteRequest(BaseModel):
    file_path: str
    sheet_name: str

class SheetRenameRequest(BaseModel):
    file_path: str
    old_name: str
    new_name: str

class SortRequest(BaseModel):
    file_path: str
    sheet_name: str
    column: str
    ascending: bool = True
    range: Optional[str] = None

class FilterRequest(BaseModel):
    file_path: str
    sheet_name: str
    column: str
    condition: str
    value: object = None
    range: Optional[str] = None

class FindReplaceRequest(BaseModel):
    file_path: str
    sheet_name: str
    find: str
    replace: str
    range: Optional[str] = None

class PivotRequest(BaseModel):
    file_path: str
    sheet_name: str
    rows: List[str]
    columns: Optional[List[str]] = None
    values: Optional[List[str]] = None
    agg_func: str = "sum"

class MergeCellsRequest(BaseModel):
    file_path: str
    sheet_name: str
    range: str
    action: str = "merge"

class FormatCellsRequest(BaseModel):
    file_path: str
    sheet_name: str
    range: str
    format_type: str
    format_value: object = None

class InsertRowsColsRequest(BaseModel):
    file_path: str
    sheet_name: str
    position: int
    count: int = 1
    direction: str = "rows"

class DeleteRowsColsRequest(BaseModel):
    file_path: str
    sheet_name: str
    position: int
    count: int = 1
    direction: str = "rows"

class ConvertRequest(BaseModel):
    input_path: str
    output_format: str

class MacroExecuteRequest(BaseModel):
    file_path: str
    macro_code: str
    language: str = "vba"

class VbaLabImportRequest(BaseModel):
    file_path: str
    macro_names: Optional[List[str]] = None
    source_label: Optional[str] = None

class VbaLabUpdateRequest(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    language: Optional[str] = None

class VbaLabImportRequest(BaseModel):
    file_path: str
    macro_names: Optional[List[str]] = None
    source_label: Optional[str] = None

class VbaLabUpdateRequest(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    language: Optional[str] = None

class VbaLabImportRequest(BaseModel):
    file_path: str
    macro_names: Optional[List[str]] = None
    source_label: Optional[str] = None

class VbaLabUpdateRequest(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    language: Optional[str] = None

class AnalyzeRequest(BaseModel):
    file_path: str
    sheet_name: str
    range: Optional[str] = None
    operations: List[str] = ["sum", "avg", "count", "min", "max", "std", "median"]

class MainDbLoadRequest(BaseModel):
    file_path: Optional[str] = None
    sheet_name: Optional[str] = None
    force_reload: bool = False
    set_active: bool = True

class MainDbSearchRequest(BaseModel):
    query: str
    key_columns_only: bool = False
    exact_match: bool = False
    offset: int = 0
    limit: int = 100

class ReportRequest(BaseModel):
    report_type: str  # employment_by_period, dismissal_by_period, current_composition, calendar_summary
    year: Optional[int] = None
    month: Optional[int] = None
    citizenship: Optional[str] = None
    territory: Optional[str] = None
    organization: Optional[str] = None
    status: Optional[str] = None
    direction: Optional[str] = None  # Прилет / Вылет (for calendar reports)
    justification: Optional[str] = None
    justification_contains: Optional[str] = None
    arrival_status: Optional[str] = None
    worker_type: Optional[str] = None
    department: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    output_name: Optional[str] = None
    gelendzhik_file_path: Optional[str] = None
    site_territory: Optional[str] = None

class CalendarLoadRequest(BaseModel):
    file_path: Optional[str] = None


class TicketsRegistryLoadRequest(BaseModel):
    file_path: str
    registry: str = "vsm"
    sheet_name: Optional[str] = None


class TicketsMergeRequest(BaseModel):
    ticket_file_path: Optional[str] = None
    output_name: Optional[str] = None
    sheet_name: Optional[str] = None
    passport_column: Optional[str] = None
    use_registry: bool = False
    registry: str = "vsm"


class TicketsCostsLoadRequest(BaseModel):
    file_paths: List[str]
    registry: str = "vsm"
    sheet_name: Optional[str] = None
    append: bool = False
    fuzzy_fio_cutoff: int = 86


class TicketsCostsActionRequest(BaseModel):
    registry: str = "vsm"
    fuzzy: bool = False
    fuzzy_fio_cutoff: int = 86
    run_dedupe: bool = True


class TicketsCostsSaveRowsRequest(BaseModel):
    registry: str = "vsm"
    rows: List[Dict[str, Any]]


class TicketsCostsTableActionRequest(BaseModel):
    registry: str = "vsm"
    action: str
    fuzzy_fio_cutoff: int = 90


class TicketsCostsRunRequest(BaseModel):
    registry: str = "vsm"
    run_id: str


class TicketsCostsQueueRequest(BaseModel):
    registry: str = "vsm"
    items: List[Dict[str, Any]]


class MergeScanRequest(BaseModel):
    folder_path: str


class MergeExecuteRequest(BaseModel):
    mode: str
    items: List[dict]
    selected_headers: Optional[List[str]] = None
    target_headers: Optional[List[str]] = None
    mappings: Optional[dict] = None
    output_name: Optional[str] = None


class FilePrepareRequest(BaseModel):
    file_path: str
    output_name: Optional[str] = None
    save_in_place: bool = False


class CalendarPathLoadRequest(BaseModel):
    file_path: str


class CalendarMainMergeRequest(BaseModel):
    output_name: Optional[str] = None


# =============================================================================
# Health Check & Metrics
# =============================================================================

@app.get("/api/health")
@rate_limiter.limit("60/minute")  # Rate limit: 60 requests per minute
async def health_check():
    """Liveness: быстрый ответ без блокировки на тяжёлых задачах."""
    from data_paths import UPLOAD_DIR

    upload_ok = os.path.isdir(UPLOAD_DIR)
    return {
        "status": "ok",
        "service": "excel-service",
        "version": "1.0.0",
        "upload_dir": UPLOAD_DIR,
        "upload_dir_ready": upload_ok,
    }


@app.get("/api/metrics/memory")
async def memory_metrics():
    """Memory usage metrics using psutil."""
    try:
        import psutil
        
        process = psutil.Process(os.getpid())
        mem_info = process.memory_info()
        
        return {
            "status": "ok",
            "memory": {
                "rss_mb": round(mem_info.rss / (1024 * 1024), 2),
                "vms_mb": round(mem_info.vms / (1024 * 1024), 2),
                "percent": round(process.memory_percent(), 2),
            },
            "system": {
                "total_mb": round(psutil.virtual_memory().total / (1024 * 1024), 2),
                "available_mb": round(psutil.virtual_memory().available / (1024 * 1024), 2),
                "percent_used": round(psutil.virtual_memory().percent, 2),
            }
        }
    except ImportError:
        raise HTTPException(status_code=503, detail="psutil not installed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/metrics/system")
async def system_metrics():
    """System resource metrics using psutil."""
    try:
        import psutil
        
        return {
            "status": "ok",
            "cpu": {
                "percent": psutil.cpu_percent(interval=0.1),
                "count_physical": psutil.cpu_count(logical=False),
                "count_logical": psutil.cpu_count(logical=True),
            },
            "disk": {
                "total_gb": round(psutil.disk_usage('/').total / (1024**3), 2),
                "used_gb": round(psutil.disk_usage('/').used / (1024**3), 2),
                "percent": psutil.disk_usage('/').percent,
            },
            "process": {
                "pid": os.getpid(),
                "threads": psutil.Process(os.getpid()).num_threads(),
                "open_files": len(psutil.Process(os.getpid()).open_files()),
            }
        }
    except ImportError:
        raise HTTPException(status_code=503, detail="psutil not installed")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Database Backup API
# =============================================================================

@app.post("/api/db/backup")
async def run_db_backup():
    """Trigger manual database backup."""
    try:
        from db_backup import run_scheduled_backup
        result = run_scheduled_backup()
        return {"status": "ok", "backup": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/db/backups")
async def list_db_backups():
    """List all available database backups."""
    try:
        from db_backup import list_backups
        backups = list_backups()
        return {"status": "ok", "backups": backups}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/db/backup/{backup_filename}")
async def delete_db_backup(backup_filename: str):
    """Delete a specific backup file."""
    try:
        from db_backup import BACKUP_DIR
        from pathlib import Path
        
        backup_path = BACKUP_DIR / backup_filename
        
        # Security check: ensure path is within BACKUP_DIR
        try:
            backup_path.resolve().relative_to(BACKUP_DIR.resolve())
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid backup filename")
        
        if not backup_path.exists():
            raise HTTPException(status_code=404, detail="Backup not found")
        
        backup_path.unlink()
        return {"status": "ok", "deleted": backup_filename}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



# =============================================================================
# Welcome Modules Settings
# =============================================================================

@app.get("/api/settings/welcome-modules")
async def get_welcome_modules():
    """Get welcome screen module configuration."""
    return await run_blocking(welcome_settings.get_welcome_modules)


class SaveWelcomeModulesRequest(BaseModel):
    modules: List[Dict[str, Any]]


@app.post("/api/settings/welcome-modules")
async def save_welcome_modules(request: SaveWelcomeModulesRequest):
    """Save welcome screen module configuration."""
    return await run_blocking(welcome_settings.save_welcome_modules, request.modules)


@app.get("/api/libraries")
async def excel_libraries():
    """Какие Excel-библиотеки установлены и как маршрутизируются задачи."""
    import excel_handler

    return await run_blocking(excel_handler.get_excel_libraries)


class XlwingsReadRequest(BaseModel):
    file_path: str
    sheet_name: str
    cell_range: str = "A1:Z100"


@app.post("/api/xlwings/read-range")
async def xlwings_read_range(request: XlwingsReadRequest):
    """Чтение через Excel COM (Windows + установленный Excel). Опционально."""
    import excel_libs

    try:
        return await run_blocking(
            excel_libs.read_range_xlwings,
            request.file_path,
            request.sheet_name,
            request.cell_range,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# File Operations
# =============================================================================

@app.post("/api/upload")
@rate_limiter.limit("10/minute")  # Rate limit: 10 uploads per minute to prevent abuse
async def upload_file(file: UploadFile = File(...)):
    """Upload an Excel file, save to upload directory, return file info with sheets list."""
    if not excel_handler.is_excel_file(file.filename):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file format. Supported: .xlsx, .xls, .xlsb, .xlsm, .csv, .tsv"
        )

    try:
        content = await file.read()
        result = await run_blocking(excel_handler.save_uploaded_file, content, file.filename)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/files")
async def list_files(include_sheets: bool = False):
    """List all uploaded files. Pass include_sheets=true only when opening a file in the grid."""
    try:
        files = excel_handler.list_uploaded_files(include_sheets=include_sheets)
        return {"files": files, "count": len(files)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/file/{file_id}")
async def get_file(file_id: str):
    """Get file metadata by file ID."""
    file_path = excel_handler.find_file_by_id(file_id)
    if not file_path:
        raise HTTPException(status_code=404, detail=f"File not found: {file_id}")

    try:
        info = excel_handler.get_file_info(file_path)
        info["file_id"] = file_id
        return info
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/file/{file_id}")
async def delete_file(file_id: str):
    """Delete a file by file ID."""
    file_path = excel_handler.find_file_by_id(file_id)
    if not file_path:
        raise HTTPException(status_code=404, detail=f"File not found: {file_id}")

    try:
        deleted = excel_handler.delete_file(file_path)
        return {"deleted": deleted, "file_id": file_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/download/{file_id}")
async def download_file(file_id: str):
    """Download a file by file ID."""
    file_path = excel_handler.find_file_by_id(file_id)
    if not file_path:
        raise HTTPException(status_code=404, detail=f"File not found: {file_id}")

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File no longer exists on disk")

    filename = os.path.basename(file_path)
    return FileResponse(
        path=file_path,
        filename=filename,
        media_type="application/octet-stream",
    )


# =============================================================================
# Sheet Operations
# =============================================================================

@app.get("/api/sheet-data")
async def get_sheet_data(
    file_path: str = Query(..., description="Path to the Excel file"),
    sheet_name: str = Query(..., description="Name of the sheet"),
    range: Optional[str] = Query(None, description="Cell range like A1:Z100"),
    max_rows: int = Query(10000, description="Maximum rows to return"),
):
    """Get sheet data with optional range and pagination."""
    # Handle relative paths - if just a file_id, resolve it
    if not os.path.isabs(file_path):
        resolved = excel_handler.find_file_by_id(file_path)
        if resolved:
            file_path = resolved
        else:
            file_path = os.path.join(excel_handler.UPLOAD_DIR, file_path)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    try:
        result = await run_blocking(
            excel_handler.read_sheet_data, file_path, sheet_name, range, max_rows
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sheet-update")
async def update_sheet(request: SheetUpdateRequest):
    """Update cell values in a sheet."""
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")

    try:
        result = excel_handler.update_cells(request.file_path, request.sheet_name, request.changes)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sheet-create")
async def create_sheet(request: SheetCreateRequest):
    """Create a new sheet."""
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")

    try:
        result = excel_handler.create_sheet(request.file_path, request.sheet_name)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/sheet-delete")
async def delete_sheet(request: SheetDeleteRequest):
    """Delete a sheet."""
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")

    try:
        result = excel_handler.delete_sheet(request.file_path, request.sheet_name)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sheet-rename")
async def rename_sheet(request: SheetRenameRequest):
    """Rename a sheet."""
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")

    try:
        result = excel_handler.rename_sheet(request.file_path, request.old_name, request.new_name)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Data Operations
# =============================================================================

@app.post("/api/sort")
async def sort_data(request: SortRequest):
    """Sort data in a sheet."""
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")

    try:
        result = data_ops.sort_data(
            request.file_path, request.sheet_name,
            request.column, request.ascending, request.range
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/filter")
async def filter_data(request: FilterRequest):
    """Filter data based on conditions."""
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")

    try:
        result = data_ops.filter_data(
            request.file_path, request.sheet_name,
            request.column, request.condition, request.value, request.range
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/find-replace")
async def find_replace(request: FindReplaceRequest):
    """Find and replace values in a sheet."""
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")

    try:
        result = data_ops.find_replace(
            request.file_path, request.sheet_name,
            request.find, request.replace, request.range
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/pivot")
async def create_pivot(request: PivotRequest):
    """Create a pivot table."""
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")

    try:
        result = data_ops.create_pivot(
            request.file_path, request.sheet_name,
            request.rows, request.columns, request.values, request.agg_func
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/merge-cells")
async def merge_cells(request: MergeCellsRequest):
    """Merge or unmerge cells."""
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")

    try:
        result = data_ops.merge_unmerge_cells(
            request.file_path, request.sheet_name,
            request.range, request.action
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/format-cells")
async def format_cells(request: FormatCellsRequest):
    """Format cells in a sheet."""
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")

    try:
        result = data_ops.format_cells(
            request.file_path, request.sheet_name,
            request.range, request.format_type, request.format_value
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/insert-rows-cols")
async def insert_rows_cols(request: InsertRowsColsRequest):
    """Insert rows or columns."""
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")

    try:
        result = data_ops.insert_rows_cols(
            request.file_path, request.sheet_name,
            request.position, request.count, request.direction
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/delete-rows-cols")
async def delete_rows_cols(request: DeleteRowsColsRequest):
    """Delete rows or columns."""
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")

    try:
        result = data_ops.delete_rows_cols(
            request.file_path, request.sheet_name,
            request.position, request.count, request.direction
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/convert")
async def convert_file(request: ConvertRequest):
    """Convert between Excel formats."""
    if not os.path.exists(request.input_path):
        raise HTTPException(status_code=404, detail=f"File not found: {request.input_path}")

    try:
        result = excel_handler.convert_file(request.input_path, request.output_format)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except ImportError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Macro Operations
# =============================================================================

@app.post("/api/macro/execute")
async def execute_macro(request: MacroExecuteRequest):
    """Execute VBA or Python macro code."""
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")

    try:
        result = macro_engine.execute_macro(
            request.file_path, request.macro_code, request.language
        )
        if not result["success"]:
            return JSONResponse(status_code=400, content=result)
        return result
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/macro/list")
async def list_macros(file_path: str = Query(..., description="Path to the Excel file")):
    """List macros in a file."""
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    try:
        result = vba_lab.extract_vba_from_file(file_path)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/vba-laboratory/detect")
async def vba_laboratory_detect(file_path: str = Query(..., description="Path to Excel file")):
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")
    result = await run_blocking(vba_lab.extract_vba_from_file, file_path)
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.get("/api/vba-laboratory/macros")
async def vba_laboratory_list():
    return await run_blocking(vba_lab.list_stored_macros)


@app.post("/api/vba-laboratory/import")
async def vba_laboratory_import(request: VbaLabImportRequest):
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")
    result = await run_blocking(
        vba_lab.import_macros,
        request.file_path,
        request.macro_names,
        request.source_label,
    )
    if result.get("error"):
        raise HTTPException(status_code=400, detail=result["error"])
    return result


@app.patch("/api/vba-laboratory/macros/{macro_id}")
async def vba_laboratory_update(macro_id: str, request: VbaLabUpdateRequest):
    result = await run_blocking(
        vba_lab.update_stored_macro,
        macro_id,
        request.model_dump(exclude_none=True),
    )
    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@app.delete("/api/vba-laboratory/macros/{macro_id}")
async def vba_laboratory_delete(macro_id: str):
    result = await run_blocking(vba_lab.delete_stored_macro, macro_id)
    if result.get("error"):
        raise HTTPException(status_code=404, detail=result["error"])
    return result


# =============================================================================
# Analysis
# =============================================================================

@app.post("/api/analyze")
async def analyze_data(request: AnalyzeRequest):
    """Perform statistical analysis on data."""
    if not os.path.exists(request.file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {request.file_path}")

    try:
        result = data_ops.analyze_data(
            request.file_path, request.sheet_name,
            request.range, request.operations
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sheet-info")
async def get_sheet_info(
    file_path: str = Query(..., description="Path to the Excel file"),
    sheet_name: str = Query(..., description="Name of the sheet"),
):
    """Get sheet dimensions and info."""
    # Handle relative paths
    if not os.path.isabs(file_path):
        resolved = excel_handler.find_file_by_id(file_path)
        if resolved:
            file_path = resolved
        else:
            file_path = os.path.join(excel_handler.UPLOAD_DIR, file_path)

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail=f"File not found: {file_path}")

    try:
        result = excel_handler.get_sheet_info(file_path, sheet_name)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Main Database Operations
# =============================================================================

@app.get("/api/main-db/status")
async def main_db_status():
    """Check if main database is loaded, return metadata. Auto-loads if file exists."""
    try:
        result = await run_blocking(main_db.get_status)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/main-db/load")
async def main_db_load(request: MainDbLoadRequest):
    """Load Excel into main_db.sqlite. force_reload=True перечитывает файл заново."""
    try:
        file_path = (request.file_path or "").strip()
        if not file_path:
            raise HTTPException(
                status_code=400,
                detail=(
                    "Укажите путь к файлу Excel в папке upload проекта "
                    "(C:\\Otchet_OP_Marina\\OMiK_VSM\\upload)."
                ),
            )

        if request.force_reload:
            await run_blocking(main_db.clear_cache)

        result = await run_blocking(
            main_db.load_main_db,
            file_path=request.file_path,
            sheet_name=request.sheet_name,
            set_active=request.set_active,
        )
        if not result.get("loaded", False):
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to load"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/main-db/data")
async def main_db_data(
    offset: int = Query(0, description="Row offset for pagination"),
    limit: int = Query(100, description="Maximum rows to return"),
    search: Optional[str] = Query(None, description="Global search across all columns"),
    filters: Optional[str] = Query(None, description="JSON dict of column_name:filter_value"),
    sort_column: Optional[str] = Query(None, description="Column name or index to sort by"),
    sort_ascending: bool = Query(True, description="Sort ascending"),
    key_columns_only: bool = Query(False, description="Only return key columns"),
):
    """Get paginated data from the main database with optional filters."""
    import json

    parsed_filters = None
    if filters:
        try:
            parsed_filters = json.loads(filters)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid filters JSON format")

    try:
        result = await run_blocking(
            main_db.get_data,
            offset=offset,
            limit=limit,
            search=search,
            filters=parsed_filters,
            sort_column=sort_column,
            sort_ascending=sort_ascending,
            key_columns_only=key_columns_only,
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/main-db/columns")
async def main_db_columns():
    """Get column info with key column markers."""
    try:
        result = await run_blocking(main_db.get_columns)
        if "error" in result and result.get("columns") == []:
            raise HTTPException(status_code=400, detail=result.get("error", "Main database not loaded"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/main-db/stats")
async def main_db_stats():
    """Get statistics about the main database."""
    try:
        result = await run_blocking(main_db.get_stats)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/main-db/search")
async def main_db_search(request: MainDbSearchRequest):
    """Advanced search across all or key columns."""
    try:
        result = await run_blocking(
            main_db.search_advanced,
            query=request.query,
            key_columns_only=request.key_columns_only,
            exact_match=request.exact_match,
            offset=request.offset,
            limit=request.limit,
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/main-db/clear")
async def main_db_clear():
    """Clear the main database cache."""
    try:
        result = await run_blocking(main_db.clear_cache)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Main Database Instance Operations
# =============================================================================

class MainDbActivateRequest(BaseModel):
    instance_id: str


@app.get("/api/main-db/instances")
async def main_db_instances():
    """List all main database instances."""
    try:
        result = await run_blocking(main_db.list_instances)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/main-db/instances/activate")
async def main_db_instances_activate(request: MainDbActivateRequest):
    """Activate a main database instance by ID."""
    try:
        result = await run_blocking(main_db.activate_instance, request.instance_id)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/main-db/instances/{instance_id}")
async def main_db_instances_delete(instance_id: str):
    """Delete a main database instance by ID."""
    try:
        result = await run_blocking(main_db.delete_instance, instance_id)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/main-db/instances/{instance_id}/verify")
async def main_db_instances_verify(instance_id: str):
    """Verify a main database instance by ID."""
    try:
        result = await run_blocking(main_db.verify_instance, instance_id)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/main-db/instances/{instance_id}/export")
async def main_db_instances_export(instance_id: str):
    """Export a main database instance to Excel."""
    try:
        result = await run_blocking(main_db.export_instance_to_excel, instance_id)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Calendar Database Operations
# =============================================================================

@app.get("/api/calendar/status")
async def calendar_status():
    """Check if calendar database is loaded."""
    try:
        result = await run_blocking(calendar_db.get_status)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/calendar/load")
async def calendar_load(request: CalendarLoadRequest):
    """Load the calendar .xlsb file into SQLite database."""
    try:
        if calendar_db.is_loaded():
            return calendar_db.get_status()

        result = await run_blocking(
            calendar_db.load_calendar_db,
            file_path=request.file_path,
        )
        if not result.get("loaded", False):
            raise HTTPException(status_code=400, detail=result.get("error", "Failed to load calendar file"))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/calendar/data")
async def calendar_data(
    direction: Optional[str] = Query(None, description="Прилет or Вылет"),
    year: Optional[int] = Query(None, description="Year filter"),
    month: Optional[int] = Query(None, description="Month filter (1-12)"),
    citizenship: Optional[str] = Query(None, description="Citizenship filter"),
    justification: Optional[str] = Query(None, description="Justification exact filter"),
    justification_contains: Optional[str] = Query(None, description="Justification contains filter"),
    arrival_status: Optional[str] = Query(None, description="Arrival status filter"),
    worker_type: Optional[str] = Query(None, description="Worker type filter"),
    department: Optional[str] = Query(None, description="Department filter"),
    date_from: Optional[str] = Query(None, description="Arrival date from (DD.MM.YYYY)"),
    date_to: Optional[str] = Query(None, description="Arrival date to (DD.MM.YYYY)"),
    search: Optional[str] = Query(None, description="Search across fields"),
    offset: int = Query(0, description="Row offset"),
    limit: int = Query(200, description="Max rows"),
):
    """Get calendar data with filters."""
    try:
        result = await run_blocking(
            calendar_db.get_calendar_data,
            direction=direction,
            year=year,
            month=month,
            citizenship=citizenship,
            justification=justification,
            justification_contains=justification_contains,
            arrival_status=arrival_status,
            worker_type=worker_type,
            department=department,
            date_from=date_from,
            date_to=date_to,
            search=search,
            offset=offset,
            limit=limit,
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/calendar/stats")
async def calendar_stats(
    direction: Optional[str] = Query(None, description="Прилет or Вылет"),
    year: Optional[int] = Query(None, description="Year filter"),
    month: Optional[int] = Query(None, description="Month filter"),
):
    """Get calendar statistics."""
    try:
        result = await run_blocking(
            calendar_db.get_calendar_stats,
            direction=direction,
            year=year,
            month=month,
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/calendar/unique-values")
async def calendar_unique_values(
    column: str = Query(..., description="Column name to get unique values for"),
):
    """Get unique values for a calendar column."""
    try:
        result = await run_blocking(calendar_db.get_unique_values, column)
        return {"column": column, "values": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/calendar/clear")
async def calendar_clear():
    """Clear the calendar database cache."""
    try:
        result = await run_blocking(calendar_db.clear_cache)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/calendar/merged/status")
async def calendar_merged_status():
    """Check if calendar+main DB merged dataset is available."""
    try:
        return await run_blocking(integration_ops.get_merged_calendar_status)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/calendar/merged/data")
async def calendar_merged_data(
    direction: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    search: Optional[str] = None,
    offset: int = 0,
    limit: int = 200,
):
    """Get merged calendar+main DB data for in-app viewing."""
    try:
        result = await run_blocking(
            integration_ops.get_merged_calendar_data,
            direction=direction,
            year=year,
            month=month,
            search=search,
            offset=offset,
            limit=limit,
        )
        if "error" in result and not result.get("data"):
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Reporting Operations
# =============================================================================

@app.post("/api/reports/generate")
async def generate_report(request: ReportRequest):
    """Generate a statistical report based on filters."""
    try:
        if request.report_type == "employment_by_period":
            result = reports.report_employment_by_period(
                year=request.year,
                month=request.month,
                citizenship=request.citizenship,
                territory=request.territory,
                organization=request.organization,
                status=request.status,
            )
        elif request.report_type == "dismissal_by_period":
            result = reports.report_dismissal_by_period(
                year=request.year,
                month=request.month,
                citizenship=request.citizenship,
                territory=request.territory,
                organization=request.organization,
            )
        elif request.report_type == "current_composition":
            result = reports.report_current_composition(
                status=request.status,
                citizenship=request.citizenship,
                territory=request.territory,
                organization=request.organization,
            )
        elif request.report_type == "calendar_summary":
            result = reports.report_calendar_summary(
                direction=request.direction,
                year=request.year,
                month=request.month,
                citizenship=request.citizenship,
                justification=request.justification,
                justification_contains=request.justification_contains,
                arrival_status=request.arrival_status,
                worker_type=request.worker_type,
                department=request.department,
                date_from=request.start_date,
                date_to=request.end_date,
            )
        elif request.report_type == "calendar_conditional":
            result = reports.report_calendar_conditional(
                direction=request.direction,
                year=request.year,
                month=request.month,
                citizenship=request.citizenship,
                justification=request.justification,
                justification_contains=request.justification_contains,
                arrival_status=request.arrival_status,
                worker_type=request.worker_type,
                department=request.department,
                date_from=request.start_date,
                date_to=request.end_date,
                output_name=request.output_name,
            )
        elif request.report_type == "calendar_merged_conditional":
            result = reports.report_calendar_merged_conditional(
                direction=request.direction,
                year=request.year,
                month=request.month,
                citizenship=request.citizenship,
                justification=request.justification,
                justification_contains=request.justification_contains,
                arrival_status=request.arrival_status,
                worker_type=request.worker_type,
                department=request.department,
                date_from=request.start_date,
                date_to=request.end_date,
                output_name=request.output_name,
            )
        elif request.report_type == "base_presence_matrix":
            result = reports.report_base_presence_matrix(
                start_date_str=request.start_date,
                end_date_str=request.end_date,
            )
        elif request.report_type == "gelendzhik_career_path":
            result = gelendzhik_report.report_gelendzhik_career_path(
                gelendzhik_file_path=request.gelendzhik_file_path,
                site_territory=request.site_territory,
                output_name=request.output_name,
            )
        else:
            raise HTTPException(status_code=400, detail=f"Unknown report type: {request.report_type}")

        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/reports/filters")
async def get_report_filters():
    """Get available filter options for report generation."""
    try:
        result = reports.get_available_report_filters()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Tickets Registry Operations
# =============================================================================

@app.get("/api/tickets-registry/status")
async def tickets_registry_status(registry: Optional[str] = None):
    try:
        return await run_blocking(tickets_db.get_status, registry)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tickets-registry/load")
async def tickets_registry_load(request: TicketsRegistryLoadRequest):
    try:
        result = await run_blocking(
            tickets_db.load_tickets_registry,
            request.file_path,
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


@app.get("/api/tickets-registry/data")
async def tickets_registry_data(
    registry: str = "vsm",
    search: Optional[str] = None,
    offset: int = 0,
    limit: int = 200,
):
    try:
        result = await run_blocking(
            tickets_db.get_registry_data,
            registry,
            search,
            offset,
            limit,
        )
        if "error" in result and not result.get("data"):
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/tickets-registry/clear")
async def tickets_registry_clear(registry: Optional[str] = None):
    try:
        return await run_blocking(tickets_db.clear_cache, registry=registry)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Tickets Costs Operations
# =============================================================================

def _delete_all_ticket_source_files(registry: str) -> Dict[str, Any]:
    listed = tickets_costs.list_source_files(registry)
    files = listed.get("files", [])
    deleted = 0
    errors: List[str] = []
    for item in files:
        file_id = item.get("file_id")
        if not file_id:
            continue
        result = tickets_costs.delete_source_file(registry, file_id)
        if result.get("error"):
            errors.append(str(result["error"]))
        else:
            deleted += 1
    return {
        "success": len(errors) == 0,
        "registry": registry,
        "deleted": deleted,
        "errors": errors,
    }


@app.get("/api/tickets-costs/status")
async def tickets_costs_status(registry: Optional[str] = None, light: bool = False):
    try:
        return await run_blocking(tickets_costs.get_status, registry=registry, light=light)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tickets-costs/filter-options")
async def tickets_costs_filter_options(registry: str = "vsm"):
    try:
        return await run_blocking(tickets_costs.registry_filter_options, registry)
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
    ploshchadka: Optional[str] = None,
    obosnovanie: Optional[str] = None,
    organizaciya: Optional[str] = None,
    klassifikaciya: Optional[str] = None,
    aviaperevozchik: Optional[str] = None,
):
    try:
        return await run_blocking(
            tickets_costs.dashboard_stats,
            registry=registry,
            year=year,
            month=month,
            podrazdelenie=podrazdelenie,
            ploshchadka=ploshchadka,
            obosnovanie=obosnovanie,
            organizaciya=organizaciya,
            klassifikaciya=klassifikaciya,
            aviaperevozchik=aviaperevozchik,
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
    ploshchadka: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    obosnovanie: Optional[str] = None,
    organizaciya: Optional[str] = None,
    klassifikaciya: Optional[str] = None,
    aviaperevozchik: Optional[str] = None,
    offset: int = 0,
    limit: int = 200,
):
    try:
        return await run_blocking(
            tickets_costs.get_data,
            registry,
            search,
            podrazdelenie,
            ploshchadka,
            year,
            month,
            obosnovanie,
            organizaciya,
            klassifikaciya,
            aviaperevozchik,
            offset,
            limit,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tickets-costs/export")
async def tickets_costs_export(
    registry: str = "vsm",
    search: Optional[str] = None,
    podrazdelenie: Optional[str] = None,
    ploshchadka: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    obosnovanie: Optional[str] = None,
    organizaciya: Optional[str] = None,
    klassifikaciya: Optional[str] = None,
    aviaperevozchik: Optional[str] = None,
):
    try:
        result = await run_blocking(
            tickets_costs.export_processed_to_excel,
            registry,
            search,
            podrazdelenie,
            ploshchadka,
            year,
            month,
            obosnovanie,
            organizaciya,
            klassifikaciya,
            aviaperevozchik,
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


@app.get("/api/tickets-costs/source-preview")
async def tickets_costs_source_preview(
    registry: str = "vsm",
    file_id: str = Query(..., description="Stored source file id"),
    limit: int = 100,
):
    try:
        result = await run_blocking(tickets_costs.preview_source_file, registry, file_id, limit)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tickets-costs/runs")
async def tickets_costs_runs(registry: str = "vsm"):
    try:
        return await run_blocking(tickets_costs.list_processing_runs, registry)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/tickets-costs/run-data")
async def tickets_costs_run_data(
    registry: str = "vsm",
    run_id: str = Query(..., description="Processing run id"),
    offset: int = 0,
    limit: int = 0,
):
    try:
        result = await run_blocking(tickets_costs.get_run_data, registry, run_id, offset, limit)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tickets-costs/upload-queue")
async def tickets_costs_upload_queue(request: TicketsCostsQueueRequest):
    try:
        return await run_blocking(tickets_costs.merge_upload_queue, request.registry, request.items)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/tickets-costs/upload-queue")
async def tickets_costs_upload_queue_delete(registry: str = "vsm", queue_id: str = Query(...)):
    try:
        return await run_blocking(tickets_costs.remove_upload_queue_item, registry, queue_id)
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
            request.append,
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


@app.post("/api/tickets-costs/pipeline")
async def tickets_costs_pipeline(request: TicketsCostsLoadRequest):
    try:
        load_result = await run_blocking(
            tickets_costs.load_raw_files,
            request.file_paths,
            request.registry,
            request.sheet_name,
            request.append,
        )
        if "error" in load_result:
            raise HTTPException(status_code=400, detail=load_result["error"])

        process_result = await run_blocking(
            tickets_costs.process_and_display,
            request.registry,
            request.fuzzy_fio_cutoff,
        )
        if "error" in process_result:
            raise HTTPException(status_code=400, detail=process_result["error"])

        return {
            "success": True,
            "registry": request.registry,
            "load": load_result,
            "process": process_result,
        }
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
            request.fuzzy_fio_cutoff,
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


@app.post("/api/tickets-costs/save-rows")
async def tickets_costs_save_rows(request: TicketsCostsSaveRowsRequest):
    try:
        result = await run_blocking(tickets_costs.update_processed_rows, request.registry, request.rows)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/tickets-costs/activate-run")
async def tickets_costs_activate_run(request: TicketsCostsRunRequest):
    try:
        result = await run_blocking(tickets_costs.activate_processing_run, request.registry, request.run_id)
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
            request.fuzzy_fio_cutoff,
            request.run_dedupe,
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


@app.post("/api/tickets-costs/table-action")
async def tickets_costs_table_action(request: TicketsCostsTableActionRequest):
    try:
        result = await run_blocking(
            tickets_costs.apply_processed_table_action,
            request.registry,
            request.action,
            request.fuzzy_fio_cutoff,
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


@app.delete("/api/tickets-costs/run")
async def tickets_costs_delete_run(registry: str = "vsm", run_id: str = Query(...)):
    try:
        return await run_blocking(tickets_costs.delete_processing_run, registry, run_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/tickets-costs/source-file")
async def tickets_costs_delete_source_file(registry: str = "vsm", file_id: str = Query(...)):
    try:
        result = await run_blocking(tickets_costs.delete_source_file, registry, file_id)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/tickets-costs/source-files")
async def tickets_costs_delete_source_files(registry: str = "vsm"):
    try:
        result = await run_blocking(_delete_all_ticket_source_files, registry)
        if result.get("errors"):
            raise HTTPException(status_code=400, detail="; ".join(result["errors"]))
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
        result = await run_blocking(tickets_costs.clear_registry, registry)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# File Prepare
# =============================================================================

@app.post("/api/file-prepare/process")
async def file_prepare_process(request: FilePrepareRequest):
    """Prepare Excel: visible sheets, unhide rows/cols, clear filters, formulas to values."""
    try:
        result = await run_blocking(
            file_prepare.prepare_excel_file,
            file_path=request.file_path,
            output_name=request.output_name,
            save_in_place=request.save_in_place,
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Integration Operations
# =============================================================================

@app.post("/api/integration/calendar/load-by-path")
async def integration_calendar_load_by_path(request: CalendarPathLoadRequest):
    """Load calendar file from explicit path and process into calendar DB."""
    try:
        result = await run_blocking(integration_ops.load_calendar_by_path, request.file_path)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/integration/calendar/merge-with-main-db")
async def integration_calendar_merge_with_main_db(request: CalendarMainMergeRequest):
    try:
        result = await run_blocking(
            integration_ops.merge_calendar_with_main_db,
            output_name=request.output_name,
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/integration/tickets/merge-with-main-db")
async def integration_tickets_merge_with_main_db(request: TicketsMergeRequest):
    try:
        result = await run_blocking(
            integration_ops.merge_tickets_with_main_db,
            ticket_file_path=request.ticket_file_path,
            output_name=request.output_name,
            sheet_name=request.sheet_name,
            passport_column=request.passport_column,
            use_registry=request.use_registry,
            registry=request.registry,
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Data Merge Operations
# =============================================================================

@app.post("/api/merge/scan-folder")
async def merge_scan_folder(request: MergeScanRequest):
    try:
        result = await run_blocking(data_merge.scan_folder, request.folder_path)
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/merge/execute")
async def merge_execute(request: MergeExecuteRequest):
    try:
        result = await run_blocking(
            data_merge.merge_data,
            request.mode,
            request.items,
            request.selected_headers,
            request.target_headers,
            request.mappings,
            request.output_name,
        )
        if "error" in result:
            raise HTTPException(status_code=400, detail=result["error"])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# =============================================================================
# Startup
# =============================================================================

if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", "3031"))
    host = os.environ.get("EXCEL_SERVICE_HOST", "127.0.0.1")
    default_workers = "1" if sys.platform == "win32" else "2"
    workers = int(os.environ.get("UVICORN_WORKERS", default_workers))
    print(f"Starting Excel Processing Service on {host}:{port} (workers={workers})...")
    if workers > 1:
        uvicorn.run("app:app", host=host, port=port, workers=workers)
    else:
        uvicorn.run(app, host=host, port=port)
