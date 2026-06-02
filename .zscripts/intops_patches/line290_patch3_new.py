    highlight_mask = df[match_status_col].isin(
        {MATCH_FUZZY, MATCH_FIO_FUZZY, MATCH_NONE}
    )