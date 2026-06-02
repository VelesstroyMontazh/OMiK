def _fuzzy_match_fio(
    query_raw: Any,
    main_fio_map: Dict[str, Dict[str, Any]],
    by_first_char: Dict[str, List[str]],
    score_cutoff: int = FUZZY_FIO_SCORE_CUTOFF,
    by_prefix3: Optional[Dict[str, List[str]]] = None,
    by_surname: Optional[Dict[str, List[str]]] = None,
) -> Tuple[Optional[Dict[str, Any]], int]:
    """
    Fuzzy match ticket column I (Ф.И.О.) against Main DB column B (ФИО).
    """
    query = _normalize_fio(query_raw)
    if not query or len(query) < 4:
        return None, 0

    if query in main_fio_map:
        return main_fio_map[query], 100

    seen: set[str] = set()
    candidates: List[str] = []

    def _add(keys: List[str], limit: int = 400) -> None:
        for key in keys:
            if key in seen:
                continue
            seen.add(key)
            candidates.append(key)
            if len(candidates) >= limit:
                return

    _add(by_first_char.get(query[0], []))
    if len(query) >= 2 and query[1] != query[0]:
        _add(by_first_char.get(query[1], []))
    if by_prefix3 and len(query) >= 3:
        _add(by_prefix3.get(query[:3], []))
    parts = query.split()
    if by_surname and parts:
        _add(by_surname.get(parts[0], []), limit=350)

    if not candidates:
        return None, 0

    qlen = len(query)
    filtered = [c for c in candidates if abs(len(c) - qlen) <= max(6, qlen // 2)]
    if not filtered:
        filtered = candidates

    if len(filtered) > 500:
        filtered = filtered[:500]

    result = process.extractOne(
        query,
        filtered,
        scorer=fuzz.token_sort_ratio,
        score_cutoff=score_cutoff,
    )
    if not result:
        return None, 0

    matched_key, score, _ = result
    return main_fio_map.get(matched_key), int(score)