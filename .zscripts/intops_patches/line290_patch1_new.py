MATCH_EXACT = "Точное"
MATCH_NUM_D = "По номеру (столбец D)"
MATCH_FIO_EXACT = "Точное по ФИО"
MATCH_FIO_FUZZY = "Нечёткое по ФИО (Fuzzy)"
MATCH_FUZZY = "Нечёткое по паспорту (Fuzzy)"
MATCH_NONE = "Не найдено"

FUZZY_FIO_SCORE_CUTOFF = 86

# Latin → Russian (translit for names in ticket column I)
_LATIN_DIGRAPHS: List[Tuple[str, str]] = [
    ("shch", "щ"),
    ("sch", "щ"),
    ("sh", "ш"),
    ("ch", "ч"),
    ("kh", "х"),
    ("zh", "ж"),
    ("ts", "ц"),
    ("yu", "ю"),
    ("ya", "я"),
    ("yo", "ё"),
    ("ye", "е"),
    ("iu", "ю"),
    ("ia", "я"),
    ("ii", "ий"),
    ("iy", "ий"),
    ("ey", "ей"),
    ("ay", "ай"),
    ("oy", "ой"),
    ("je", "е"),
]
_LATIN_CHAR_MAP: Dict[str, str] = {
    "a": "а",
    "b": "б",
    "c": "к",
    "d": "д",
    "e": "е",
    "f": "ф",
    "g": "г",
    "h": "х",
    "i": "и",
    "j": "й",
    "k": "к",
    "l": "л",
    "m": "м",
    "n": "н",
    "o": "о",
    "p": "п",
    "q": "к",
    "r": "р",
    "s": "с",
    "t": "т",
    "u": "у",
    "v": "в",
    "w": "в",
    "x": "кс",
    "y": "ы",
    "z": "з",
}