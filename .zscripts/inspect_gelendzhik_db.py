import json
import sqlite3
from pathlib import Path

root = Path(r"C:\Otchet_OP_Marina\OMiK_VSM")
meta = json.loads((root / "upload/main_db_meta.json").read_text(encoding="utf-8"))
cm = meta["col_mapping"]
conn = sqlite3.connect(root / "upload/main_db.sqlite")
cur = conn.cursor()
cur.execute(
    f'SELECT DISTINCT "{cm["Территория"]}" FROM employees '
    f'WHERE "{cm["Территория"]}" LIKE \'%004%\' OR "{cm["Территория"]}" LIKE \'%Гелен%\' LIMIT 20'
)
print("territories:", [r[0] for r in cur.fetchall()])
site = "004 (Геленджик Марина (ВСМ))"
cur.execute(f'SELECT COUNT(*) FROM employees WHERE "{cm["Территория"]}" = ?', (site,))
print("rows exact site:", cur.fetchone()[0])
cur.execute(
    f'SELECT COUNT(DISTINCT "{cm["ФИО"]}" || "|" || COALESCE("{cm["Дата рождения"]}", "")) '
    f'FROM employees WHERE "{cm["Территория"]}" = ?',
    (site,),
)
print("unique fio+dob at site:", cur.fetchone()[0])
cur.execute(
    f"""
    SELECT "{cm['ФИО']}", "{cm['Дата рождения']}",
           COUNT(DISTINCT "{cm['Табельный номер (с префиксами)']}") as tabs,
           COUNT(*) as rows
    FROM employees
    WHERE "{cm['ФИО']}" IS NOT NULL AND "{cm['ФИО']}" != ''
    GROUP BY "{cm['ФИО']}", "{cm['Дата рождения']}"
    HAVING rows > 1
    ORDER BY rows DESC
    LIMIT 5
    """
)
print("top duplicate fio+dob:")
for r in cur.fetchall():
    print(r)
conn.close()
