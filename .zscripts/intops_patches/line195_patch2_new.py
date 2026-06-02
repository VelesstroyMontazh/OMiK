        if parsed["month_num"]:
            available_months.add(parsed["month_num"])

    tmp_db_path = f"{calendar_db.CALENDAR_DB_PATH}.tmp"
    if os.path.exists(tmp_db_path):
        os.remove(tmp_db_path)

    conn = sqlite3.connect(tmp_db_path)
    try:
        _create_calendar_records_table(conn)

        total_arrivals = 0
        total_departures = 0

        for sheet_name in all_sheets: