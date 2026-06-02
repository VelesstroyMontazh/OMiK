    main_num_map, main_digits_map, by_digit_suffix = _build_column_d_maps(main_df)

    used_registry = False
    if use_registry or not ticket_file_path:
        if not tickets_db.is_loaded():
            return {
                "error": "Реестр билетов не загружен. Сначала нажмите «Загрузить Реестр по Билетам».",
            }
        try:
            df, detected_passport, target_sheet = tickets_db.read_registry_dataframe()
        except ValueError as e:
            return {"error": str(e)}
        used_registry = True
    else:
        if not os.path.exists(ticket_file_path):
            return {"error": f"Файл не найден: {ticket_file_path}"}
        xls = pd.ExcelFile(ticket_file_path, engine="openpyxl")
        target_sheet = sheet_name or (xls.sheet_names[0] if xls.sheet_names else None)
        if not target_sheet:
            return {"error": "Не удалось определить лист отчета"}
        df = pd.read_excel(
            ticket_file_path,
            sheet_name=target_sheet,
            header=0,
            dtype=object,
            engine="openpyxl",
        )
        detected_passport = None

    if df.empty:
        return {"error": "Данные реестра билетов пустые"}

    src_col: Optional[str] = None
    if passport_column and passport_column in df.columns:
        src_col = passport_column
    elif detected_passport and detected_passport in df.columns:
        src_col = detected_passport
    else:
        for c in df.columns:
            if "паспорт" in str(c).lower():
                src_col = c
                break
        if src_col is None:
            if len(df.columns) >= 10:
                src_col = df.columns[9]
            else:
                return {"error": "В отчете не найден столбец ПАСПОРТ (и нет колонки J)"}