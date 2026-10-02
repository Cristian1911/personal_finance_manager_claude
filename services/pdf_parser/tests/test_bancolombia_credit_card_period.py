from datetime import date
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from parsers.bancolombia_credit_card import _parse_period


def test_period_with_the_year_only_at_the_end():
    assert _parse_period("Periodo facturado 31 ago - 30 sep. 2025") == (date(2025, 8, 31), date(2025, 9, 30))


def test_period_across_the_new_year_with_both_years():
    # Bancolombia writes both years when the period crosses January (an Amex statement, Feb 2026).
    assert _parse_period("30 dic. 2025 - 31 ene. 2026 $$$ 111111") == (date(2025, 12, 30), date(2026, 1, 31))


def test_period_across_the_new_year_with_one_year():
    assert _parse_period("15 dic - 14 ene. 2026") == (date(2025, 12, 15), date(2026, 1, 14))
