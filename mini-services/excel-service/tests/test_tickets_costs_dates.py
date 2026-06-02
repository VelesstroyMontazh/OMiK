"""Unit tests for NaT-safe date formatting in tickets_costs."""
from __future__ import annotations

import pandas as pd

from tickets_costs import _format_date_series, _fmt_date_ddmmyyyy, _is_missing_date


def test_is_missing_date_nat():
    assert _is_missing_date(pd.NaT) is True
    assert _is_missing_date(None) is True


def test_fmt_date_ddmmyyyy_nat():
    assert _fmt_date_ddmmyyyy(pd.NaT) == ""
    assert _fmt_date_ddmmyyyy(None) == ""


def test_format_date_series_with_nat():
    s = pd.Series([pd.Timestamp("2025-01-15"), pd.NaT])
    out = _format_date_series(s)
    assert out.iloc[0] == "15.01.2025"
    assert out.iloc[1] == ""
