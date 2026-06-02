    tmp_db_path = f"{calendar_db.CALENDAR_DB_PATH}.tmp"
    if os.path.exists(tmp_db_path):
        os.remove(tmp_db_path)

    total_arrivals = 0
    total_departures = 0
    try:
        conn = sqlite3.connect(tmp_db_path)
        try:
            _create_calendar_records_table(conn)

            for sheet_name in all_sheets:
                if sheet_name == "Параметры":
                    continue
                parsed = calendar_db._parse_sheet_name(sheet_name)
                if not parsed["direction"]:
                    continue

                ws = wb[sheet_name]
                rows_data: list[tuple[Any, ...]] = []
                for i, row in enumerate(ws.iter_rows(values_only=True), start=1):
                    if i == 1:
                        continue
                    cells = list(row)
                    if len(cells) < 5:
                        continue
                    if cells[0] is None and cells[1] is None and cells[4] is None:
                        continue

                    direction = parsed["direction"]
                    row_record = (
                        direction,
                        parsed["year"],
                        parsed["month_num"],
                        parsed["month"],
                        sheet_name,
                        _safe_get(cells, 1),
                        _safe_get(cells, 2),
                        _safe_get(cells, 3),
                        _safe_get(cells, 4),
                        _safe_get(cells, 5),
                        _safe_get(cells, 6),
                        _safe_get(cells, 7),
                        _safe_get(cells, 8),
                        _safe_get(cells, 9),
                        _safe_get(cells, 10),
                        _safe_get(cells, 11),
                        _safe_get(cells, 12),
                        _safe_get(cells, 13),
                        _safe_get(cells, 14),
                        _safe_get(cells, 15),
                        _safe_get(cells, 16),
                        _safe_get(cells, 17),
                        _safe_get(cells, 18),
                        _safe_get(cells, 19),
                        _safe_get(cells, 20),
                        _safe_get(cells, 21),
                        _safe_get(cells, 22),
                        _safe_get(cells, 23),
                        _safe_get(cells, 24),
                        _safe_get(cells, 25),
                        _safe_get(cells, 26),
                        _safe_get(cells, 27),
                        _safe_get(cells, 28),
                        _safe_get(cells, 29),
                        _safe_get(cells, 30),
                        _safe_get(cells, 31),
                        _safe_get(cells, 32),
                        _safe_get(cells, 33),
                        _safe_get(cells, 34),
                        _safe_get(cells, 35),
                        _safe_get(cells, 36),
                        i,
                    )
                    rows_data.append(row_record)

                if rows_data:
                    conn.executemany(
                        '''
                        INSERT INTO calendar_records (
                            direction, year, month, month_name, sheet_name,
                            tab_num, project, organization, full_name, full_name_latin,
                            birth_date, citizenship, passport_series, passport_number,
                            worker_type, position, department, supervisor,
                            ticket_departure_date, arrival_date, arrival_time,
                            transport_type, ticket_status, justification, arrival_status,
                            phone, route, notes, visa_type, visa_expiry,
                            residence, flight_number, charter_flight, charter_date,
                            declared_charter, arrival_date_loc, arrival_time_loc,
                            ticket_cost, pass_territory, airport, arrival_moscow_date,
                            row_number
                        ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                        ''',
                        rows_data,
                    )
                    if parsed["direction"] == "Прилет":
                        total_arrivals += len(rows_data)
                    else:
                        total_departures += len(rows_data)

            conn.commit()
        finally:
            conn.close()

        _atomic_replace_file(tmp_db_path, calendar_db.CALENDAR_DB_PATH)
    except Exception:
        if os.path.exists(tmp_db_path):
            os.remove(tmp_db_path)
        raise
    finally:
        wb.close()

    meta = {