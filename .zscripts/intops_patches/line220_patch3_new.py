    return re.sub(r"[^0-9A-ZА-ЯЁ]", "", s)


def _passport_digits(value: str) -> str:
    return re.sub(r"\D", "", value or "")


def _build_passport_indexes(
    main_map: Dict[str, Dict[str, Any]],
) -> Tuple[Dict[int, List[str]], Dict[str, List[str]]]:
    """Index main DB passport keys by length and last-6 digits for faster fuzzy lookup."""
    by_length: Dict[int, List[str]] = defaultdict(list)
    by_suffix: Dict[str, List[str]] = defaultdict(list)
    for key in main_map:
        by_length[len(key)].append(key)
        digits = _passport_digits(key)
        if len(digits) >= 6:
            by_suffix[digits[-6:]].append(key)
    return dict(by_length), dict(by_suffix)


def _fuzzy_match_passport(
    query: str,
    main_map: Dict[str, Dict[str, Any]],
    by_length: Dict[int, List[str]],
    by_suffix: Dict[str, List[str]],
    score_cutoff: int = FUZZY_PASSPORT_SCORE_CUTOFF,
) -> Tuple[Optional[Dict[str, Any]], int]:
    """
    Find best passport match when exact key lookup failed.
    Returns (employee data, score 0-100) or (None, 0).
    """
    if not query or len(query) < 4:
        return None, 0

    candidates: List[str] = []
    qlen = len(query)

    # Same-length bucket ±3 chars (OCR / missing leading zero)
    for length in range(max(4, qlen - 3), qlen + 4):
        candidates.extend(by_length.get(length, []))

    # Same last 6 digits (common when series formatting differs)
    qdigits = _passport_digits(query)
    if len(qdigits) >= 6:
        candidates.extend(by_suffix.get(qdigits[-6:], []))

    # Substring: ticket passport contained in main key or reverse
    for key in main_map:
        if len(key) >= 6 and (query in key or key in query):
            candidates.append(key)

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: List[str] = []
    for key in candidates:
        if key not in seen:
            seen.add(key)
            unique.append(key)

    if not unique:
        unique = list(main_map.keys())

    # Cap candidate set for performance on pathological rows
    if len(unique) > 8000:
        unique = unique[:8000]

    result = process.extractOne(
        query,
        unique,
        scorer=fuzz.ratio,
        score_cutoff=score_cutoff,
    )
    if not result:
        return None, 0

    matched_key, score, _ = result
    return main_map.get(matched_key), int(score)


def _write_tickets_excel_highlighted(
    df: pd.DataFrame,
    out_path: str,
    sheet_name: str,
    match_status_col: str = "Сопоставление",
) -> None:
    """Write tickets merge result; highlight fuzzy / not-found rows in light yellow."""
    wb = Workbook()
    ws = wb.active
    ws.title = (sheet_name or "Данные")[:31]

    headers = list(df.columns)
    status_idx = headers.index(match_status_col) if match_status_col in headers else None
    highlight_statuses = {MATCH_FUZZY, MATCH_NONE}

    for row_idx, row in enumerate(dataframe_to_rows(df, index=False, header=True), 1):
        for col_idx, value in enumerate(row, 1):
            ws.cell(row=row_idx, column=col_idx, value=value)

        if row_idx > 1 and status_idx is not None:
            status = ws.cell(row=row_idx, column=status_idx + 1).value
            if status in highlight_statuses:
                for col_idx in range(1, len(headers) + 1):
                    ws.cell(row=row_idx, column=col_idx).fill = HIGHLIGHT_FILL

    wb.save(out_path)


def _atomic_replace_file(src_path: str, dest_path: str) -> None: