import time
import sys

sys.path.insert(0, r"C:\Otchet_OP_Marina\OMiK_VSM\mini-services\excel-service")
import gelendzhik_report as gr

t0 = time.time()
r = gr.report_gelendzhik_career_path(output_name="bench.xlsx")
print("elapsed", round(time.time() - t0, 1), "s")
print(r.get("error") or {k: r[k] for k in ("employees_count", "chart_days", "max_events_per_person", "file_path")})
