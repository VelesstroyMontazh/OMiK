    conn = sqlite3.connect(tmp_db_path)
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

    _atomic_replace_file(tmp_db_path, CALENDAR_MERGED_DB_PATH)

    meta = {