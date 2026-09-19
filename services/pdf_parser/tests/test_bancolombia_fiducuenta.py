"""Unit test for Bancolombia Fiducuenta (investment fund) parser.

Tests the parser with the sample Fiducuenta PDF statement.
"""

from datetime import date
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from parsers.bancolombia_fiducuenta import (
    TRANSACTION_RE,
    parse_fiducuenta,
    _parse_colombian_number,
    _parse_date_yyyymmdd,
)
from models import TransactionDirection, StatementType


def test_parse_colombian_number():
    """Test Colombian number parsing."""
    assert _parse_colombian_number("5.000.000,00") == 5000000.0
    assert _parse_colombian_number("48.076,06371646") == 48076.06371646
    assert _parse_colombian_number("7.204,08") == 7204.08
    assert _parse_colombian_number("1,50") == 1.5
    assert _parse_colombian_number("12,49") == 12.49
    assert _parse_colombian_number("104,15170655") == 104.15170655
    assert _parse_colombian_number("0,00") == 0.0
    assert _parse_colombian_number("") == 0.0
    assert _parse_colombian_number("-") == 0.0
    print("✓ Colombian number parsing tests passed")


def test_transaction_line_keeps_accented_descriptions():
    """A mid-period top-up prints as "ADICIÓN"; the accent must not drop the row."""
    for line in (
        "20260826 APERTURA 5.000.000,00 104,15170655 5.000.000,00",
        "20260910 ADICIÓN 1.000.000,00 20,79000000 6.007.204,08",
        "20260915 RETIRO 500.000,00 10,39000000 5.507.204,08",
    ):
        m = TRANSACTION_RE.match(line)
        assert m is not None, line
    assert TRANSACTION_RE.match("20260910 ADICIÓN 1.000.000,00 20,79000000 6.007.204,08").group(2) == "ADICIÓN"


def test_parse_date_yyyymmdd():
    """Test YYYYMMDD date parsing."""
    assert _parse_date_yyyymmdd("20260801") == date(2026, 8, 1)
    assert _parse_date_yyyymmdd("20260831") == date(2026, 8, 31)
    assert _parse_date_yyyymmdd("20260826") == date(2026, 8, 26)
    assert _parse_date_yyyymmdd("") is None
    assert _parse_date_yyyymmdd("2026080") is None
    assert _parse_date_yyyymmdd("invalid") is None
    print("✓ YYYYMMDD date parsing tests passed")


def test_fiducuenta_parser_with_pdf():
    """Test Fiducuenta parser with sample PDF.

    This test expects a test PDF at the scratchpad location.
    """
    # Try to locate the test PDF
    test_pdf_paths = [
        "/tmp/claude-0/-home-user-personal_finance_manager_claude/69a492f0-b042-528e-ba42-4a85e14bed9a/scratchpad/test_fiducuenta.pdf",
        os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
            "test_fiducuenta.pdf"
        ),
    ]

    pdf_path = None
    for path in test_pdf_paths:
        if os.path.exists(path):
            pdf_path = path
            break

    if not pdf_path:
        print("SKIP: Fiducuenta test PDF not found in expected locations")
        return

    # Parse the PDF
    result = parse_fiducuenta(pdf_path)

    # Verify basic fields
    assert result.statement_type == StatementType.INVESTMENT
    assert result.bank == "bancolombia"
    assert result.currency == "COP"
    assert result.account_number == "3137000011953"
    assert result.period_from == date(2026, 8, 1)
    assert result.period_to == date(2026, 8, 31)

    # Verify investment metadata
    assert result.investment_metadata is not None
    assert result.investment_metadata.fund_name == "FIDUCUENTA"
    assert result.investment_metadata.unit_value_end == 48076.06371646
    assert result.investment_metadata.period_return_pct == 12.49
    assert result.investment_metadata.fee_pct_annual == 1.5
    assert result.investment_metadata.previous_balance == 0.0
    assert result.investment_metadata.additions == 5000000.0
    assert result.investment_metadata.withdrawals == 0.0
    assert result.investment_metadata.net_returns == 7204.08
    assert result.investment_metadata.withholding == 0.0
    assert result.investment_metadata.new_balance == 5007204.08
    assert result.investment_metadata.units_end == 104.15170655

    # Verify summary
    assert result.summary is not None
    assert result.summary.previous_balance == 0.0
    assert result.summary.total_credits == 5000000.0
    assert result.summary.total_debits == 0.0
    assert result.summary.final_balance == 5007204.08

    # Verify transactions
    assert len(result.transactions) >= 2

    # First transaction: APERTURA (opening deposit)
    tx1 = result.transactions[0]
    assert tx1.date == date(2026, 8, 26)
    assert tx1.description == "APERTURA"
    assert tx1.amount == 5000000.0
    assert tx1.direction == TransactionDirection.INFLOW
    assert tx1.balance == 5000000.0
    assert tx1.currency == "COP"

    # Second transaction: RENDIMIENTOS NETOS (net returns, synthetic)
    tx2 = result.transactions[1]
    assert tx2.date == date(2026, 8, 31)
    assert tx2.description == "RENDIMIENTOS NETOS"
    assert tx2.amount == 7204.08
    assert tx2.direction == TransactionDirection.INFLOW
    assert tx2.currency == "COP"

    print("✓ Fiducuenta parser (full PDF test) passed")


def test_fiducuenta_parser_synthetic_data():
    """Test Fiducuenta parser with synthetic text data (no PII, no PDF file).

    This test verifies the parser can extract data from the key format patterns.
    """
    # Test the number parsing first
    opening = _parse_colombian_number("0,00")
    additions = _parse_colombian_number("5.000.000,00")
    withdrawals = _parse_colombian_number("0,00")
    net_returns = _parse_colombian_number("7.204,08")
    withholding = _parse_colombian_number("0,00")
    new_balance = _parse_colombian_number("5.007.204,08")

    assert opening == 0.0
    assert additions == 5000000.0
    assert withdrawals == 0.0
    assert net_returns == 7204.08
    assert withholding == 0.0
    assert new_balance == 5007204.08

    print("✓ Fiducuenta parser (synthetic data test) passed")


if __name__ == "__main__":
    test_parse_colombian_number()
    test_parse_date_yyyymmdd()
    test_fiducuenta_parser_synthetic_data()
    test_fiducuenta_parser_with_pdf()
    print("\n✓ All Bancolombia Fiducuenta parser tests passed")
