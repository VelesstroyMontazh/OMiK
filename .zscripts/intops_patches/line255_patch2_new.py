def _write_tickets_excel_highlighted(
    df: pd.DataFrame,
    out_path: str,
    sheet_name: str,
    match_status_col: str = "Сопоставление",
) -> None:
    """Write tickets merge result; highlight fuzzy / not-found rows in light yellow."""
    sheet = (sheet_name or "Данные")[:31]
    with pd.ExcelWriter(out_path, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name=sheet, index=False)

    if match_status_col not in df.columns:
        return

    highlight_mask = df[match_status_col].isin({MATCH_FUZZY, MATCH_NONE})
    if not highlight_mask.any():
        return

    wb = load_workbook(out_path)
    ws = wb[sheet]
    n_cols = len(df.columns)
    # On very large files, highlight key columns only (much faster than every cell).
    cols_to_fill = n_cols if len(df) <= 50000 else min(n_cols, 6)

    for i in df.index[highlight_mask]:
        row_num = int(i) + 2
        for col in range(1, cols_to_fill + 1):
            ws.cell(row=row_num, column=col).fill = HIGHLIGHT_FILL

    wb.save(out_path)