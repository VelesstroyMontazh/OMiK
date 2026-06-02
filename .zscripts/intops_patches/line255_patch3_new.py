    by_length, by_suffix = _build_passport_indexes(main_map)

    n = len(df)
    tab_nums: List[Any] = [None] * n
    fios: List[Any] = [None] * n
    match_statuses: List[str] = [MATCH_NONE] * n
    match_scores: List[Any] = [None] * n
    pending: List[int] = []

    src_values = df[src_col].tolist()
    for idx, raw in enumerate(src_values):
        key = _normalize_passport(raw)
        if not key:
            continue
        exact = main_map.get(key)
        if exact:
            tab_nums[idx] = exact.get("tab_num")
            fios[idx] = exact.get("fio")
            match_statuses[idx] = MATCH_EXACT
            match_scores[idx] = 100
        else:
            pending.append(idx)

    for idx in pending:
        raw = src_values[idx]
        key = _normalize_passport(raw)
        d_hit = _match_by_column_d_only(
            raw, main_num_map, main_digits_map, by_digit_suffix
        )
        if d_hit:
            tab_nums[idx] = d_hit.get("tab_num")
            fios[idx] = d_hit.get("fio")
            match_statuses[idx] = MATCH_NUM_D
            match_scores[idx] = 100
            continue

        fuzzy_hit, fuzzy_score = _fuzzy_match_passport(
            key, main_map, by_length, by_suffix
        )
        if fuzzy_hit:
            tab_nums[idx] = fuzzy_hit.get("tab_num")
            fios[idx] = fuzzy_hit.get("fio")
            match_statuses[idx] = MATCH_FUZZY
            match_scores[idx] = fuzzy_score