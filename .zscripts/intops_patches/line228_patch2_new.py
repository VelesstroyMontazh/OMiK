def _build_column_d_maps(
    main_df: pd.DataFrame,
) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, Dict[str, Any]], Dict[str, List[str]]]:
    """
    Maps for matching ticket column J only against Main DB column D (Удостоверение.Номер),
    without series (column C).
    """
    main_num_map: Dict[str, Dict[str, Any]] = {}
    main_digits_map: Dict[str, Dict[str, Any]] = {}
    by_digit_suffix: Dict[str, List[str]] = defaultdict(list)

    for _, row in main_df.iterrows():
        pass_number = row.get("pass_number")
        if pass_number is None or (isinstance(pass_number, float) and pd.isna(pass_number)):
            continue
        data = {"tab_num": row.get("tab_num"), "fio": row.get("fio")}
        num_norm = _normalize_passport(pass_number)
        digits = _passport_digits(str(pass_number))

        if num_norm and num_norm not in main_num_map:
            main_num_map[num_norm] = data
        if digits and digits not in main_digits_map:
            main_digits_map[digits] = data
            if len(digits) >= 6:
                by_digit_suffix[digits[-6:]].append(digits)

    return main_num_map, main_digits_map, dict(by_digit_suffix)


def _match_by_column_d_only(
    raw: Any,
    main_num_map: Dict[str, Dict[str, Any]],
    main_digits_map: Dict[str, Dict[str, Any]],
    by_digit_suffix: Dict[str, List[str]],
) -> Optional[Dict[str, Any]]:
    """Match ticket passport (J) against Main DB column D only (no C+D)."""
    norm_j = _normalize_passport(raw)
    if not norm_j:
        return None

    if norm_j in main_num_map:
        return main_num_map[norm_j]

    digits_j = _passport_digits(norm_j)
    if digits_j and digits_j in main_digits_map:
        return main_digits_map[digits_j]

    # J often has series+number; D is number only — compare by trailing digits
    if len(digits_j) >= 6:
        for d_key in by_digit_suffix.get(digits_j[-6:], []):
            if digits_j.endswith(d_key) or d_key.endswith(digits_j):
                return main_digits_map.get(d_key)

    return None


def _build_passport_indexes(
    main_map: Dict[str, Dict[str, Any]],
) -> Tuple[Dict[int, List[str]], Dict[str, List[str]]]: