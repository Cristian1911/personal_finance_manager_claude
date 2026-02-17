"""Shared utilities for bank statement parsers."""

from __future__ import annotations

from datetime import date

SPANISH_MONTHS: dict[str, int] = {
    "ene": 1,
    "feb": 2,
    "mar": 3,
    "abr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "ago": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dic": 12,
}


def parse_us_number(s: str) -> float:
    """Parse US-formatted number: 1,234.56 → 1234.56"""
    return float(s.replace(",", ""))


def parse_co_number(s: str) -> float:
    """Parse Colombian-formatted number: 1.234.567,89 → 1234567.89"""
    return float(s.replace(".", "").replace(",", "."))


def resolve_year(tx_month: int, from_date: date, to_date: date) -> int:
    """Resolve transaction year from month, handling Dec→Jan boundary.

    When a statement spans two years (e.g. Dec 2025 → Jan 2026),
    transaction months >= from_month belong to from_year,
    earlier months belong to to_year.
    """
    if from_date.year == to_date.year:
        return from_date.year
    if tx_month >= from_date.month:
        return from_date.year
    return to_date.year
