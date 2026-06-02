import sqlite3

c = sqlite3.connect(r"C:\Otchet_OP_Marina\OMiK_VSM\upload\calendar_db.sqlite")
rows = c.execute(
    "SELECT justification, direction, COUNT(*) FROM calendar_records "
    "WHERE LOWER(justification) LIKE '%увольн%' "
    "GROUP BY justification, direction"
).fetchall()
for r in rows:
    print(r)
print("total", c.execute(
    "SELECT COUNT(*) FROM calendar_records WHERE LOWER(justification) LIKE '%увольн%'"
).fetchone()[0])
print("vylet uvoln", c.execute(
    "SELECT COUNT(*) FROM calendar_records WHERE direction='Вылет' "
    "AND LOWER(justification) LIKE '%увольн%'"
).fetchone()[0])
c.close()
