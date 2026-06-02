import calendar_db
import excel_handler
import main_db

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
UPLOAD_DIR = os.path.join(PROJECT_ROOT, "upload")
CALENDAR_MERGED_DB_PATH = os.path.join(UPLOAD_DIR, "calendar_merged_db.sqlite")
CALENDAR_MERGED_META_PATH = os.path.join(UPLOAD_DIR, "calendar_merged_meta.json")

_merged_cache: Dict[str, Any] = {"loaded": False}