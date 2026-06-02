def _build_fio_indexes(
    main_df: pd.DataFrame,
) -> Tuple[
    Dict[str, Dict[str, Any]],
    Dict[str, List[str]],
    Dict[str, List[str]],
    Dict[str, List[str]],
]:
    """Exact map + buckets (1-й символ, префикс 3, фамилия) для fuzzy FIO."""
    main_fio_map: Dict[str, Dict[str, Any]] = {}
    by_first_char: Dict[str, List[str]] = defaultdict(list)
    by_prefix3: Dict[str, List[str]] = defaultdict(list)
    by_surname: Dict[str, List[str]] = defaultdict(list)

    tab_key = "tab_num" if "tab_num" in main_df.columns else "tab"
    for row in main_df.itertuples(index=False):
        fio_val = getattr(row, "fio", None)
        norm = _normalize_fio(fio_val)
        if not norm or len(norm) < 3:
            continue
        if norm in main_fio_map:
            continue
        tab_num = getattr(row, tab_key, None)
        main_fio_map[norm] = {"tab_num": tab_num, "fio": fio_val}
        by_first_char[norm[0]].append(norm)
        if len(norm) >= 3:
            by_prefix3[norm[:3]].append(norm)
        parts = norm.split()
        if parts and len(parts[0]) >= 2:
            by_surname[parts[0]].append(norm)

    return main_fio_map, dict(by_first_char), dict(by_prefix3), dict(by_surname)