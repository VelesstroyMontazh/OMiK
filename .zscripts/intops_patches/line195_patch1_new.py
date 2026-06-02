def _normalize_passport(value: Any) -> str:
    if value is None:
        return ""
    s = str(value).strip().upper()
    if not s:
        return ""
    return re.sub(r"[^0-9A-ZА-ЯЁ]", "", s)


def _atomic_replace_file(src_path: str, dest_path: str) -> None:
    """Atomically replace dest_path with src_path (src must exist)."""
    dest_dir = os.path.dirname(dest_path) or "."
    os.makedirs(dest_dir, exist_ok=True)
    backup_path = f"{dest_path}.bak"
    if os.path.exists(backup_path):
        os.remove(backup_path)
    if os.path.exists(dest_path):
        os.replace(dest_path, backup_path)
    try:
        os.replace(src_path, dest_path)
        if os.path.exists(backup_path):
            os.remove(backup_path)
    except Exception:
        if os.path.exists(backup_path) and not os.path.exists(dest_path):
            os.replace(backup_path, dest_path)
        raise