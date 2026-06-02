        conn.commit()
    finally:
        conn.close()
        wb.close()

    _atomic_replace_file(tmp_db_path, calendar_db.CALENDAR_DB_PATH)

    meta = {