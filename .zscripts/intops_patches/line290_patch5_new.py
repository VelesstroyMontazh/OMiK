    src_values = df[src_col].tolist()
    fio_src_values = (
        df[fio_col_ticket].tolist() if fio_col_ticket and fio_col_ticket in df.columns else [None] * n
    )
    for idx, raw in enumerate(src_values):