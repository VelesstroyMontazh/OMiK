        if key:
            exact = main_map.get(key)
            if exact:
                tab_num = exact.get("tab_num")
                fio = exact.get("fio")
                status = MATCH_EXACT
                score = 100
            else:
                # Step 2: only for not found — J vs column D (no series C)
                d_hit = _match_by_column_d_only(
                    raw, main_num_map, main_digits_map, by_digit_suffix
                )
                if d_hit:
                    tab_num = d_hit.get("tab_num")
                    fio = d_hit.get("fio")
                    status = MATCH_NUM_D
                    score = 100
                else:
                    # Step 3: fuzzy lookup on full passport (C+D)
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