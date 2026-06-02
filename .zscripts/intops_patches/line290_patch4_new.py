    fio_col_ticket = _detect_ticket_fio_column(list(df.columns))
    main_fio_map, fio_by_first_char = _build_fio_indexes(main_df)
    by_length, by_suffix = _build_passport_indexes(main_map)

    n = len(df)