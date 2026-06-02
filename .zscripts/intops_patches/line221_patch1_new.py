    by_length, by_suffix = _build_passport_indexes(main_map)

    tab_nums: List[Any] = []
    fios: List[Any] = []
    match_statuses: List[str] = []
    match_scores: List[Any] = []

    for raw in df[src_col]:
        key = _normalize_passport(raw)
        tab_num: Any = None
        fio: Any = None
        status = MATCH_NONE
        score: Any = None

        if key:
            exact = main_map.get(key)
            if exact:
                tab_num = exact.get("tab_num")
                fio = exact.get("fio")
                status = MATCH_EXACT
                score = 100
            else:
                fuzzy_hit, fuzzy_score = _fuzzy_match_passport(
                    key, main_map, by_length, by_suffix
                )
                if fuzzy_hit:
                    tab_num = fuzzy_hit.get("tab_num")
                    fio = fuzzy_hit.get("fio")
                    status = MATCH_FUZZY
                    score = fuzzy_score
                else:
                    status = MATCH_NONE

        tab_nums.append(tab_num)
        fios.append(fio)
        match_statuses.append(status)
        match_scores.append(score)

    df["Табельный номер (с префиксами)"] = tab_nums
    df["ФИО"] = fios
    df["Сопоставление"] = match_statuses
    df["Схожесть %"] = match_scores

    # Move added columns to front: A:B + match info, then original columns
    front_cols = [
        "Табельный номер (с префиксами)",
        "ФИО",
        "Сопоставление",
        "Схожесть %",
    ]
    rest_cols = [c for c in df.columns if c not in front_cols]
    df = df[front_cols + rest_cols]

    total = int(len(df))
    matched_exact = int((df["Сопоставление"] == MATCH_EXACT).sum())
    matched_fuzzy = int((df["Сопоставление"] == MATCH_FUZZY).sum())
    matched_rows = matched_exact + matched_fuzzy
    unmatched_rows = int((df["Сопоставление"] == MATCH_NONE).sum())
    highlight_rows = matched_fuzzy + unmatched_rows

    excel_handler.ensure_upload_dir()
    base_name = output_name.strip() if output_name else f"tickets_with_main_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    if not base_name.lower().endswith(".xlsx"):
        base_name = f"{base_name}.xlsx"
    stored_filename = f"{excel_handler.generate_file_id()}_{base_name}"
    out_path = os.path.join(excel_handler.UPLOAD_DIR, stored_filename)

    _write_tickets_excel_highlighted(df, out_path, target_sheet)

    return {
        "success": True,
        "file_path": out_path,
        "stored_filename": stored_filename,
        "file_id": os.path.splitext(stored_filename)[0],
        "sheet_name": target_sheet,
        "rows": total,
        "matched_rows": matched_rows,
        "matched_exact": matched_exact,
        "matched_fuzzy": matched_fuzzy,
        "unmatched_rows": unmatched_rows,
        "highlight_rows": highlight_rows,
        "passport_source_column": str(src_col),
        "fuzzy_cutoff_percent": FUZZY_PASSPORT_SCORE_CUTOFF,
    }