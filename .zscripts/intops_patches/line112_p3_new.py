    df_cal.to_excel(out_path, index=False, sheet_name="Календарь_с_Базой")
    _save_merged_calendar_to_sqlite(df_cal)

    return {
        "success": True,
        "file_path": out_path,
        "stored_filename": stored_filename,
        "file_id": os.path.splitext(stored_filename)[0],
        "rows": total,
        "matched_rows": matched,
        "unmatched_rows": total - matched,
        "merged_db_loaded": True,
    }