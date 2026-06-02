import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "mini-services", "excel-service"))
import reports

r = reports.report_calendar_conditional(
    direction="Вылет",
    justification_contains="увольн",
    date_from="01.01.2025",
    date_to="31.12.2025",
    output_name="test_vylet_uvoln.xlsx",
)
print("ok" if r.get("file_id") else r.get("error"))
print("total", r.get("total"))
print("preview", len(r.get("preview_rows") or []))

r2 = reports.report_calendar_conditional(
    direction="Прилет",
    justification="Устройство на работу",
    year=2025,
)
print("hire total", r2.get("total"))
