    tmp_db_path = f"{calendar_db.CALENDAR_DB_PATH}.tmp"
    if os.path.exists(tmp_db_path):
        os.remove(tmp_db_path)

    conn = sqlite3.connect(tmp_db_path)
    try:
        _create_calendar_records_table(conn)

        total_arrivals = 0
        total_departures = 0

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
                    _safe_get(cells, 1),   # Таб. №
                    _safe_get(cells, 2),   # Проект
                    _safe_get(cells, 3),   # Организация
                    _safe_get(cells, 4),   # ФИО
                    _safe_get(cells, 5),   # ФИО латиница
                    _safe_get(cells, 6),   # Дата рождения
                    _safe_get(cells, 7),   # Гражданство
                    _safe_get(cells, 8),   # Серия паспорта
                    _safe_get(cells, 9),   # Номер паспорта
                    _safe_get(cells, 10),  # Рабочий или ИТР
                    _safe_get(cells, 11),  # Фактическая должность
                    _safe_get(cells, 12),  # Отдел / Участок
                    _safe_get(cells, 13),  # Начальник участка
                    _safe_get(cells, 14),  # Дата вылета по билету
                    _safe_get(cells, 15),  # Дата прибытия
                    _safe_get(cells, 16),  # Время прибытия
                    _safe_get(cells, 17),  # АВИА /ЖД
                    _safe_get(cells, 18),  # Билет куплен
                    _safe_get(cells, 19),  # Обоснование перелета
                    _safe_get(cells, 20),  # Сотрудник прибыл/не прибыл
                    _safe_get(cells, 21),  # Номер телефона
                    _safe_get(cells, 22),  # Маршрут
                    _safe_get(cells, 23),  # Примечание
                    _safe_get(cells, 24),  # Вид визы
                    _safe_get(cells, 25),  # Срок действия визы
                    _safe_get(cells, 26),  # Место проживания
                    _safe_get(cells, 27),  # Номер рейса
                    _safe_get(cells, 28),  # чартерный рейс
                    _safe_get(cells, 29),  # Дата чартера
                    _safe_get(cells, 30),  # Заявлен на чартер
                    _safe_get(cells, 31),  # Дата прибытия в
                    _safe_get(cells, 32),  # Время прибытия в
                    _safe_get(cells, 33),  # Сумма стоимости билета
                    _safe_get(cells, 34),  # Пропуска на территории
                    _safe_get(cells, 35),  # Аэропорт
                    _safe_get(cells, 36),  # Дата прибытие в Москву
                    i,  # row_number
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
        wb.close()

    _atomic_replace_file(tmp_db_path, calendar_db.CALENDAR_DB_PATH)

    meta = {