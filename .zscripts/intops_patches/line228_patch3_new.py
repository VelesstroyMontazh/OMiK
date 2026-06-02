    main_df["passport_key"] = (
        main_df["pass_series"].fillna("").astype(str) + main_df["pass_number"].fillna("").astype(str)
    ).map(_normalize_passport)

    main_map = (
        main_df[main_df["passport_key"] != ""]
        .drop_duplicates(subset=["passport_key"])
        .set_index("passport_key")[["tab_num", "fio"]]
        .to_dict(orient="index")
    )
    main_num_map, main_digits_map, by_digit_suffix = _build_column_d_maps(main_df)