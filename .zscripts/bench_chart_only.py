import time
import sys
from datetime import date

sys.path.insert(0, r"C:\Otchet_OP_Marina\OMiK_VSM\mini-services\excel-service")
import gelendzhik_report as gr

t0 = time.time()
df, _ = gr._load_main_db_dataframe()
print("load db", time.time() - t0)

site = gr.DEFAULT_SITE
df["person_key"] = df.apply(
    lambda r: gr._person_key(
        r["ФИО"], r["Дата рождения"], r["Удостоверение.Серия"], r["Удостоверение.Номер"],
        r["Табельный номер (с префиксами)"],
    ),
    axis=1,
)
site_keys = set(df.loc[df["Территория"].apply(lambda v: gr._normalize_territory(v) == site), "person_key"])
involved = df[df["person_key"].isin(site_keys)]
print("people", len(site_keys), "rows", len(involved), time.time() - t0)

person_meta = {}
person_site_intervals = {}
for pk in list(site_keys)[:100]:  # sample 100
    pdf = involved[involved["person_key"] == pk]
    person_site_intervals[pk] = gr._site_intervals_for_person(pdf, site)
    person_meta[pk] = {"fio": "x", "dob": "", "tabs": ""}

chart = gr._build_presence_chart(
    set(list(site_keys)[:100]), person_meta, person_site_intervals,
    gr.SITE_OPEN_DATE, date.today(),
)
print("chart sample", chart.shape, time.time() - t0)

person_meta2 = {}
person_site_intervals2 = {}
for pk in site_keys:
    pdf = involved[involved["person_key"] == pk]
    person_site_intervals2[pk] = gr._site_intervals_for_person(pdf, site)
    row = pdf.iloc[0]
    person_meta2[pk] = {"fio": gr._normalize_text(row["ФИО"]), "dob": "", "tabs": ""}

t1 = time.time()
chart_full = gr._build_presence_chart(
    site_keys, person_meta2, person_site_intervals2, gr.SITE_OPEN_DATE, date.today(),
)
print("chart full", chart_full.shape, time.time() - t1)
