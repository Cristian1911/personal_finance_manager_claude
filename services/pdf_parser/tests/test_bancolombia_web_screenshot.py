"""Test for Bancolombia web screenshot parser with visual row reconstruction."""

from datetime import date
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from parsers.bancolombia_web_screenshot import parse_bancolombia_web
from models import TransactionDirection


def test_bancolombia_web_with_bounding_boxes():
    """Parse the sample image and verify all 16 transactions match ground truth.

    Ground truth (16 rows, top to bottom):
    | date | description | ref | amount | direction |
    |---|---|---|---|---|
    | 2026-06-10 | COMPRA EN RAPPI*RAPPI COLOMBIA | — | 69800.00 | OUTFLOW |
    | 2026-06-09 | COBRO TRANSF QR | — | 520.00 | OUTFLOW |
    | 2026-06-09 | IVA COBRO TRANSF QR | — | 98.80 | OUTFLOW |
    | 2026-06-09 | PAGO QR supermercado | 0089349501 | 20600.00 | OUTFLOW |
    | 2026-06-09 | COMPRA EN URBANIA TN | — | 8600.00 | OUTFLOW |
    | 2026-06-09 | COMPRA EN INVERSIONE | — | 37000.00 | OUTFLOW |
    | 2026-06-09 | COBRO TRANSF QR | — | 520.00 | OUTFLOW |
    | 2026-06-09 | TRANSF QR CENTRO INTEGRAL DE S | — | 16000.00 | OUTFLOW |
    | 2026-06-09 | IVA COBRO TRANSF QR | — | 98.80 | OUTFLOW |
    | 2026-06-09 | TRANSF QR CENTRO INTEGRAL DE S | — | 7500.00 | OUTFLOW |
    | 2026-06-09 | PAGO PLAN VIDA A LA MEDIDA | — | 30266.00 | OUTFLOW |
    | 2026-06-09 | ABONO INTERESES AHORROS | — | 3.06 | INFLOW |
    | 2026-06-08 | TRANSFERENCIA CTA SUC VIRTUAL | 49937225678 | 31900.00 | OUTFLOW |
    | 2026-06-08 | ABONO INTERESES AHORROS | — | 3.14 | INFLOW |
    | 2026-06-08 | TRANSFERENCIA CTA SUC VIRTUAL | 49900001361 | 26100.00 | OUTFLOW |
    | 2026-06-07 | ABONO INTERESES AHORROS | — | 3.48 | INFLOW |
    """
    # Parse the sample image — real user data, kept out of git. Skip when absent.
    image_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "unrecognized",
        "bancolombia_web_transactions_sample.png",
    )
    if not os.path.exists(image_path):
        print("SKIP: sample image not available (local-only fixture)")
        return

    stmt = parse_bancolombia_web(
        image_path=image_path,
        screenshot_date=date(2026, 6, 10),
    )

    # Ground truth data: (date, description_contains, ref, amount, direction)
    ground_truth = [
        (date(2026, 6, 10), "COMPRA EN RAPPI", None, 69800.00, TransactionDirection.OUTFLOW),
        (date(2026, 6, 9), "COBRO TRANSF QR", None, 520.00, TransactionDirection.OUTFLOW),
        (date(2026, 6, 9), "IVA COBRO TRANSF QR", None, 98.80, TransactionDirection.OUTFLOW),
        (date(2026, 6, 9), "PAGO QR supermercado", "0089349501", 20600.00, TransactionDirection.OUTFLOW),
        (date(2026, 6, 9), "COMPRA EN URBANIA", None, 8600.00, TransactionDirection.OUTFLOW),
        (date(2026, 6, 9), "COMPRA EN INVERSIONE", None, 37000.00, TransactionDirection.OUTFLOW),
        (date(2026, 6, 9), "COBRO TRANSF QR", None, 520.00, TransactionDirection.OUTFLOW),
        (date(2026, 6, 9), "TRANSF QR CENTRO", None, 16000.00, TransactionDirection.OUTFLOW),
        (date(2026, 6, 9), "IVA COBRO TRANSF QR", None, 98.80, TransactionDirection.OUTFLOW),
        (date(2026, 6, 9), "TRANSF QR CENTRO", None, 7500.00, TransactionDirection.OUTFLOW),
        (date(2026, 6, 9), "PAGO PLAN VIDA", None, 30266.00, TransactionDirection.OUTFLOW),
        (date(2026, 6, 9), "ABONO INTERESES AHORROS", None, 3.06, TransactionDirection.INFLOW),
        (date(2026, 6, 8), "TRANSFERENCIA CTA", "49937225678", 31900.00, TransactionDirection.OUTFLOW),
        (date(2026, 6, 8), "ABONO INTERESES AHORROS", None, 3.14, TransactionDirection.INFLOW),
        (date(2026, 6, 8), "TRANSFERENCIA CTA", "49900001361", 26100.00, TransactionDirection.OUTFLOW),
        (date(2026, 6, 7), "ABONO INTERESES AHORROS", None, 3.48, TransactionDirection.INFLOW),
    ]

    # Verify count
    if len(stmt.transactions) != 16:
        print(f"❌ Expected 16 transactions, got {len(stmt.transactions)}")
        for i, tx in enumerate(stmt.transactions):
            print(f"  {i+1:2d}. {tx.date} | {tx.description[:40]:<40} | {tx.amount:>12,.2f} {tx.direction.value}")
        return False

    # Verify each transaction
    all_pass = True
    for i, (expected_date, expected_desc_part, expected_ref, expected_amount, expected_dir) in enumerate(ground_truth):
        tx = stmt.transactions[i]

        # Check date
        if tx.date != expected_date:
            print(f"❌ TX {i}: date mismatch. Expected {expected_date}, got {tx.date}")
            all_pass = False
            continue

        # Check description contains key parts (OCR may vary slightly)
        if expected_desc_part.replace(" ", "") not in tx.description.replace(" ", ""):
            print(f"❌ TX {i}: description missing key part. Expected to contain '{expected_desc_part}', got '{tx.description}'")
            all_pass = False

        # Check amount
        if abs(tx.amount - expected_amount) > 0.01:
            print(f"❌ TX {i}: amount mismatch. Expected {expected_amount}, got {tx.amount}")
            all_pass = False

        # Check direction
        if tx.direction != expected_dir:
            print(f"❌ TX {i}: direction mismatch. Expected {expected_dir}, got {tx.direction}")
            all_pass = False

        # Check reference
        if expected_ref:
            if tx.authorization_number != expected_ref:
                print(f"❌ TX {i}: reference mismatch. Expected {expected_ref}, got {tx.authorization_number}")
                all_pass = False
        else:
            if tx.authorization_number is not None:
                print(f"❌ TX {i}: should have no reference, got {tx.authorization_number}")
                all_pass = False

    if all_pass:
        print("✓ All 16 transactions parsed correctly!")
        print()
        for i, tx in enumerate(stmt.transactions):
            direction_str = tx.direction.value
            ref_str = f" [ref: {tx.authorization_number}]" if tx.authorization_number else ""
            print(f"  {i+1:2d}. {tx.date} | {tx.description[:45]:<45} | {tx.amount:>12,.2f} {direction_str}{ref_str}")
        print()
        return True
    else:
        return False


if __name__ == "__main__":
    success = test_bancolombia_web_with_bounding_boxes()
    sys.exit(0 if success else 1)
