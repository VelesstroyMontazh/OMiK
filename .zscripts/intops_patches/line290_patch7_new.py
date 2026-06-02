    matched_exact = int((df["Сопоставление"] == MATCH_EXACT).sum())
    matched_by_d = int((df["Сопоставление"] == MATCH_NUM_D).sum())
    matched_fio_exact = int((df["Сопоставление"] == MATCH_FIO_EXACT).sum())
    matched_fio_fuzzy = int((df["Сопоставление"] == MATCH_FIO_FUZZY).sum())
    matched_fuzzy = int((df["Сопоставление"] == MATCH_FUZZY).sum())
    matched_rows = matched_exact + matched_by_d + matched_fio_exact + matched_fio_fuzzy + matched_fuzzy
    unmatched_rows = int((df["Сопоставление"] == MATCH_NONE).sum())
    highlight_rows = matched_fio_fuzzy + matched_fuzzy + unmatched_rows