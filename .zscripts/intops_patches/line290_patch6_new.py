        if d_hit:
            tab_nums[idx] = d_hit.get("tab_num")
            fios[idx] = d_hit.get("fio")
            match_statuses[idx] = MATCH_NUM_D
            match_scores[idx] = 100
            continue

        fio_raw = fio_src_values[idx]
        if fio_raw is not None and str(fio_raw).strip():
            fio_norm = _normalize_fio(fio_raw)
            if fio_norm and fio_norm in main_fio_map:
                hit = main_fio_map[fio_norm]
                tab_nums[idx] = hit.get("tab_num")
                fios[idx] = hit.get("fio")
                match_statuses[idx] = MATCH_FIO_EXACT
                match_scores[idx] = 100
                continue

            fio_hit, fio_score = _fuzzy_match_fio(
                fio_raw, main_fio_map, fio_by_first_char
            )
            if fio_hit:
                tab_nums[idx] = fio_hit.get("tab_num")
                fios[idx] = fio_hit.get("fio")
                match_statuses[idx] = MATCH_FIO_FUZZY
                match_scores[idx] = fio_score
                continue

        fuzzy_hit, fuzzy_score = _fuzzy_match_passport(
            key, main_map, by_length, by_suffix
        )
        if fuzzy_hit:
            tab_nums[idx] = fuzzy_hit.get("tab_num")
            fios[idx] = fuzzy_hit.get("fio")
            match_statuses[idx] = MATCH_FUZZY
            match_scores[idx] = fuzzy_score