import sqlite3
import os

p = r"C:\Otchet_OP_Marina\OMiK_VSM\upload\calendar_db.sqlite"
c = sqlite3.connect(p)
rows = c.execute(
    "SELECT arrival_date, justification, direction FROM calendar_records "
    "WHERE justification LIKE '%вольн%' LIMIT 5"
).fetchall()
print("samples", rows)
j = c.execute(
    "SELECT DISTINCT justification FROM calendar_records "
    "WHERE justification LIKE '%вольн%'"
).fetchall()
print("justifications", j)
d = c.execute(
    "SELECT MIN(arrival_date), MAX(arrival_date) FROM calendar_records "
    "WHERE arrival_date IS NOT NULL AND arrival_date != ''"
).fetchone()
print("date range", d)
c.close()
