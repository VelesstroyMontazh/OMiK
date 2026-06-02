def merge_tickets_with_main_db(
    ticket_file_path: Optional[str] = None,
    output_name: Optional[str] = None,
    sheet_name: Optional[str] = None,
    passport_column: Optional[str] = None,
    use_registry: bool = False,
) -> Dict[str, Any]:
    # Ensure main DB is available