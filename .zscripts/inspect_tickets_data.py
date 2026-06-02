import sqlite3
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "mini-services", "excel-service"))
from data_paths import UPLOAD_DIR

db = os.path.join(UPLOAD_DIR, "tickets_costs_vsm.sqlite")
conn = sqlite3.connect(db)
print("raw count", conn.execute("SELECT COUNT(*) FROM raw_import").fetchone()[0])
cols = [r[1] for r in conn.execute("PRAGMA table_info(raw_import)")]
print("raw cols", cols)
rows = conn.execute("SELECT * FROM raw_import LIMIT 3").fetchall()
print("raw col count", len(cols))
for i, r in enumerate(rows):
    print(f"raw row {i} col0={r[0]!r} col1={r[1]!r} col15={r[15] if len(r)>15 else None!r} col23={r[23] if len(r)>23 else None!r}")
conn.close()
