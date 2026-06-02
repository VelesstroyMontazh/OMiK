    df_cal.to_excel(out_path, index=False, sheet_name="Календарь_с_Базой")

    return {
        "success": True,
        "file_path": out_path,
        "stored_filename": stored_filename,
        "file_id": os.path.splitext(stored_filename)[0],
        "rows": total,
        "matched_rows": matched,
        "unmatched_rows": total - matched,
    }