import sys

sys.path.insert(0, r"C:\Otchet_OP_Marina\OMiK_VSM\mini-services\excel-service")
import gelendzhik_report

result = gelendzhik_report.report_gelendzhik_career_path(
    gelendzhik_file_path=None,
    output_name="test_gelendzhik_base_only.xlsx",
)
if "error" in result:
    print("ERROR:", result["error"])
    sys.exit(1)
print(
    "OK",
    {k: result[k] for k in ("employees_count", "base_periods_count", "max_events_per_person", "chart_days", "file_path")},
)
