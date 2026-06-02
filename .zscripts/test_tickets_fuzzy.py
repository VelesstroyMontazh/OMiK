import os
import sys
import time

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "mini-services", "excel-service"))
import integration_ops

t0 = time.time()
r = integration_ops.merge_tickets_with_main_db(
    r"C:\Otchet_OP_Marina\ВСМ_билеты_с 01.01.2025.xlsm",
    output_name="test_fuzzy_tickets.xlsx",
)
print("elapsed", round(time.time() - t0, 1), "s")
if r.get("error"):
    print("ERROR", r["error"])
else:
    print(
        "exact", r.get("matched_exact"),
        "fuzzy", r.get("matched_fuzzy"),
        "unmatched", r.get("unmatched_rows"),
        "highlight", r.get("highlight_rows"),
    )
