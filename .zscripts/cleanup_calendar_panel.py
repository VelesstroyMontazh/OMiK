"""Remove dead tickets tab code from CalendarPanel.tsx."""
from __future__ import annotations

import re
from pathlib import Path

p = Path(__file__).resolve().parents[1] / "src/components/excel/CalendarPanel.tsx"
text = p.read_text(encoding="utf-8")

text = re.sub(
    r"\n  const \[vsmPath.*?\n  \} \| null>\(null\)\n",
    "\n",
    text,
    count=1,
    flags=re.DOTALL,
)

text = re.sub(
    r"\n  const ticketsColumns = useMemo\(.*?"
    r"\n  const ticketsEditColumns = useMemo\(.*?\n  \)\n",
    "\n",
    text,
    count=1,
    flags=re.DOTALL,
)

text = re.sub(
    r"\n  const refreshTicketsRegistry = useCallback\(async \(\) => \{.*?\n  \}, \[api\]\)\n",
    "\n",
    text,
    count=1,
    flags=re.DOTALL,
)

text = text.replace(
    "if (activeTab === 'reports' || activeTab === 'tickets')",
    "if (activeTab === 'reports')",
)

text = text.replace("    void refreshTicketsRegistry()\n", "")
text = text.replace(", refreshTicketsRegistry]", "]")

text = re.sub(
    r"\n  const loadTicketsRegistryData = useCallback\(async \(\) => \{.*?"
    r"\n  \}, \[activeTab, loadTicketsRegistryData\]\)\n",
    "\n",
    text,
    count=1,
    flags=re.DOTALL,
)

text = re.sub(
    r"\n  const handleLoadTicketsRegistry = useCallback\(.*?\n  \)\n",
    "\n",
    text,
    count=1,
    flags=re.DOTALL,
)

text = re.sub(
    r"\n  const handleMergeTickets = useCallback\(async \(\) => \{.*?"
    r"\n  \}, \[mergeRegistry\]\)\n",
    "\n",
    text,
    count=1,
    flags=re.DOTALL,
)

text = re.sub(
    r"\n        \{activeTab === 'tickets' && \(\n          <div className=\"space-y-2 w-full\">.*?\n        \)\}\n",
    "\n",
    text,
    count=1,
    flags=re.DOTALL,
)

text = text.replace("activeTab !== 'tickets' && activeTab !== 'reports'", "activeTab !== 'reports'")

text = re.sub(
    r"\n        \{ticketsResult && activeTab === 'tickets' && \(.*?\n        \)\}\n",
    "\n",
    text,
    count=1,
    flags=re.DOTALL,
)

text = re.sub(
    r"\n      \{activeTab === 'tickets' && \(\n        <div className=\"flex-1 min-h-0 flex flex-col\">.*?"
    r"\n      \)\}\n    </div>\n  \)\n\}\n",
    "\n    </div>\n  )\n}\n",
    text,
    count=1,
    flags=re.DOTALL,
)

p.write_text(text, encoding="utf-8")
print("OK", p, "lines", text.count("\n"))
