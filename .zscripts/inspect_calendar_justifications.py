import sqlite3

c = sqlite3.connect(r"C:\Otchet_OP_Marina\OMiK_VSM\upload\calendar_db.sqlite")
rows = c.execute(
    "SELECT justification, COUNT(*) FROM calendar_records "
    "GROUP BY justification ORDER BY COUNT(*) DESC LIMIT 30"
).fetchall()
for r in rows:
    print(repr(r[0]), r[1])
c.close()
