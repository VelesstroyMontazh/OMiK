_merged_cache: Dict[str, Any] = {"loaded": False}

# Fuzzy passport match (0–100), like Excel Fuzzy Lookup
FUZZY_PASSPORT_SCORE_CUTOFF = 86
HIGHLIGHT_FILL = PatternFill(start_color="FFFFCC", end_color="FFFFCC", fill_type="solid")
MATCH_EXACT = "Точное"
MATCH_FUZZY = "Нечёткое (Fuzzy)"
MATCH_NONE = "Не найдено"


def _normalize_passport(value: Any) -> str: