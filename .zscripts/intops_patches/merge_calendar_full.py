def _save_merged_calendar_to_sqlite(df: pd.DataFrame) -> None:
    excel_handler.ensure_upload_dir()
    if os.path.exists(CALENDAR_MERGED_DB_PATH):
        os.remove(CALENDAR_MERGED_DB_PATH)

    conn = sqlite3.connect(CALENDAR_MERGED_DB_PATH)
    try:
        df.to_sql("calendar_merged_records", conn, index=False, if_exists="replace")
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_merged_direction ON calendar_merged_records(direction)'
        )
        conn.execute(
            'CREATE INDEX IF NOT EXISTS idx_merged_year_month ON calendar_merged_records(year, month)'
        )
        conn.commit()
    finally:
        conn.close()

    meta = {
        "loaded_at": datetime.now().isoformat(),
        "rows": int(len(df)),
        "columns": list(df.columns),
    }
    with open(CALENDAR_MERGED_META_PATH, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    global _merged_cache
    _merged_cache = {
        "loaded": True,
        "loaded_at": meta["loaded_at"],
        "rows": meta["rows"],
        "columns": meta["columns"],
    }


def _load_merged_meta_from_disk() -> bool:
    global _merged_cache
    if _merged_cache.get("loaded"):
        return True
    if os.path.exists(CALENDAR_MERGED_META_PATH) and os.path.exists(CALENDAR_MERGED_DB_PATH):
        try:
            with open(CALENDAR_MERGED_META_PATH, "r", encoding="utf-8") as f:
                meta = json.load(f)
            _merged_cache = {
                "loaded": True,
                "loaded_at": meta["loaded_at"],
                "rows": meta["rows"],
                "columns": meta.get("columns", []),
            }
            return True
        except Exception:
            return False
    return False


def is_merged_calendar_loaded() -> bool:
    if _merged_cache.get("loaded"):
        return True
    return _load_merged_meta_from_disk()


def get_merged_calendar_status() -> Dict[str, Any]:
    if not is_merged_calendar_loaded():
        return {"loaded": False}
    return {
        "loaded": True,
        "loaded_at": _merged_cache["loaded_at"],
        "rows": _merged_cache["rows"],
        "columns": _merged_cache.get("columns", []),
    }


def get_merged_calendar_data(
    direction: Optional[str] = None,
    year: Optional[int] = None,
    month: Optional[int] = None,
    search: Optional[str] = None,
    offset: int = 0,
    limit: int = 200,
) -> Dict[str, Any]:
    if not is_merged_calendar_loaded():
        return {"error": "Объединенный календарь не построен", "data": [], "total": 0}

    conn = sqlite3.connect(CALENDAR_MERGED_DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        where_parts = []
        params: list[Any] = []

        if direction:
            where_parts.append("direction = ?")
            params.append(direction)
        if year:
            where_parts.append("year = ?")
            params.append(year)
        if month:
            where_parts.append("month = ?")
            params.append(month)
        if search:
            s = f"%{search.lower()}%"
            where_parts.append(
                '(LOWER(COALESCE(full_name, "")) LIKE ? OR '
                'LOWER(COALESCE("Табельный номер (База)", "")) LIKE ? OR '
                'LOWER(COALESCE("ФИО (База)", "")) LIKE ?)'
            )
            params.extend([s, s, s])

        where_clause = f'WHERE {" AND ".join(where_parts)}' if where_parts else ""
        total = conn.execute(
            f"SELECT COUNT(*) FROM calendar_merged_records {where_clause}",
            params,
        ).fetchone()[0]

        rows = conn.execute(
            f'SELECT * FROM calendar_merged_records {where_clause} '
            f"ORDER BY year, month, row_number LIMIT ? OFFSET ?",
            params + [limit, offset],
        ).fetchall()

        data = [{key: row[key] for key in row.keys()} for row in rows]
        return {
            "data": data,
            "total": total,
            "offset": offset,
            "limit": limit,
            "has_more": (offset + limit) < total,
        }
    finally:
        conn.close()


def merge_calendar_with_main_db(output_name: Optional[str] = None) -> Dict[str, Any]: