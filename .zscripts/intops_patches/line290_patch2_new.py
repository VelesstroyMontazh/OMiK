def _has_latin_letters(text: str) -> bool:
    return bool(re.search(r"[A-Za-z]", text))


def _translit_latin_to_russian(text: str) -> str:
    """Transliterate Latin letters in a name to Cyrillic (e.g. IVAN -> ИВАН)."""
    s = text.strip().lower()
    if not s:
        return s
    for lat, cyr in _LATIN_DIGRAPHS:
        s = s.replace(lat, cyr)
    out: List[str] = []
    for ch in s:
        if "a" <= ch <= "z":
            out.append(_LATIN_CHAR_MAP.get(ch, ch))
        else:
            out.append(ch)
    return "".join(out)


def _normalize_fio(value: Any) -> str:
    """Normalize FIO for comparison; transliterate Latin to Russian first."""
    if value is None or (isinstance(value, float) and pd.isna(value)):
        return ""
    s = str(value).strip()
    if not s:
        return ""
    s = re.sub(r"\s+", " ", s)
    if _has_latin_letters(s):
        s = _translit_latin_to_russian(s)
    s = s.upper()
    s = re.sub(r"[^А-ЯЁ\s\-]", "", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


def _detect_ticket_fio_column(columns: List[str]) -> Optional[str]:
    for c in columns:
        cl = str(c).lower().replace(" ", "")
        if "ф.и.о" in cl or "фио" in cl or "f.i.o" in cl or "fio" in cl:
            return c
    if len(columns) >= 9:
        return columns[8]
    return None


def _build_fio_indexes(
    main_df: pd.DataFrame,
) -> Tuple[Dict[str, Dict[str, Any]], Dict[str, List[str]]]:
    """Exact map + first-letter buckets for fuzzy FIO (column B / ФИО)."""
    main_fio_map: Dict[str, Dict[str, Any]] = {}
    by_first_char: Dict[str, List[str]] = defaultdict(list)

    for _, row in main_df.iterrows():
        fio_val = row.get("fio")
        norm = _normalize_fio(fio_val)
        if not norm or len(norm) < 3:
            continue
        data = {"tab_num": row.get("tab_num"), "fio": fio_val}
        if norm not in main_fio_map:
            main_fio_map[norm] = data
            by_first_char[norm[0]].append(norm)

    return main_fio_map, dict(by_first_char)


def _fuzzy_match_fio(
    query_raw: Any,
    main_fio_map: Dict[str, Dict[str, Any]],
    by_first_char: Dict[str, List[str]],
    score_cutoff: int = FUZZY_FIO_SCORE_CUTOFF,
) -> Tuple[Optional[Dict[str, Any]], int]:
    """
    Fuzzy match ticket column I (Ф.И.О.) against Main DB column B (ФИО).
    """
    query = _normalize_fio(query_raw)
    if not query or len(query) < 4:
        return None, 0

    candidates: List[str] = list(by_first_char.get(query[0], []))
    if len(query) >= 2 and query[1] != query[0]:
        for key in by_first_char.get(query[1], []):
            if key not in candidates:
                candidates.append(key)

    if not candidates:
        candidates = list(main_fio_map.keys())

    qlen = len(query)
    filtered = [c for c in candidates if abs(len(c) - qlen) <= max(6, qlen // 2)]
    if not filtered:
        filtered = candidates

    if len(filtered) > 4000:
        filtered = filtered[:4000]

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


def _normalize_passport(value: Any) -> str: