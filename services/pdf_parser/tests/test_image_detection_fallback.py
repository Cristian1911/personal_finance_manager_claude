"""Regression tests for image-detector routing of Bancolombia APP screenshots.

Real-world failure (2026-07-07): a screenshot of the app's account view
("Cuenta de Ahorros" → Movimientos tab) fired the Bancolombia WEB detector's
keyword signals (dates, $ amounts, TRANSFERENCIA/PAGO) harder than the APP
detector's, so it was routed to the web parser. That parser reconstructs
horizontal table rows — the app stacks date/description/amount vertically —
so it extracted 0 transactions and the upload failed as "Formato no compatible"
even though parse_bancolombia_app handles the layout perfectly.

Two fixes covered here:
1. The app detector now scores the "Detalles | Movimientos | Plan" tab row,
   so this layout wins the primary routing.
2. detect_and_parse_image falls through to the next confident detector when
   the winner raises ValueError, so signal overlap can't hard-fail a
   parseable screenshot.
"""

from datetime import date
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import parsers.image_detection as image_detection
import parsers.bancolombia_web_screenshot as bancolombia_web_screenshot
from models import TransactionDirection

# Verbatim OCR output (tesseract, lang=spa, --psm 4) of the failing screenshot.
APP_ACCOUNT_VIEW_OCR = """931 BOUORO - 2 Ball 019%

« Cuenta de Ahorros

Detalles Movimientos Plan

06 JUL 2026
PAGO QR ISOLUCIONESYT

coP -$ 6.000,00

05 JUL 2026
TRANSF A JUAN ANDRES

coP -$ 23.000,00

05 JUL 2026
PAGO QR BAKERY SPONGE

coP -$ 5.400,00

05 JUL 2026
TRANSFERENCIAS A NEQUI

cor -$ 30.000,00
"""

EXPECTED_TRANSACTIONS = [
    (date(2026, 7, 6), "PAGO QR ISOLUCIONESYT", 6000.00),
    (date(2026, 7, 5), "TRANSF A JUAN ANDRES", 23000.00),
    (date(2026, 7, 5), "PAGO QR BAKERY SPONGE", 5400.00),
    (date(2026, 7, 5), "TRANSFERENCIAS A NEQUI", 30000.00),
]


def _assert_expected_statement(statements):
    assert len(statements) == 1, f"expected 1 statement, got {len(statements)}"
    stmt = statements[0]
    assert stmt.bank == "bancolombia", stmt.bank
    assert len(stmt.transactions) == len(EXPECTED_TRANSACTIONS), (
        f"expected {len(EXPECTED_TRANSACTIONS)} transactions, got {len(stmt.transactions)}"
    )
    for tx, (tx_date, description, amount) in zip(stmt.transactions, EXPECTED_TRANSACTIONS):
        assert tx.date == tx_date, (tx.date, tx_date)
        assert tx.description == description, (tx.description, description)
        assert tx.amount == amount, (tx.amount, amount)
        assert tx.direction == TransactionDirection.OUTFLOW, tx.direction


def test_app_account_view_routes_to_app_parser():
    """The account view (with the Detalles/Movimientos/Plan tab row) must
    outscore the web detector and parse via parse_bancolombia_app."""
    original_ocr = image_detection.ocr_image
    image_detection.ocr_image = lambda path: APP_ACCOUNT_VIEW_OCR
    try:
        statements = image_detection.detect_and_parse_image("dummy.jpg")
    finally:
        image_detection.ocr_image = original_ocr
    _assert_expected_statement(statements)
    print("✓ app account view routes to app parser")


def test_fallback_to_next_detector_when_winner_fails():
    """When the web detector wins (cropped screenshot without the tab row)
    but its parser finds nothing, detection must fall through to the app
    parser instead of failing the request."""
    # Strip the tab-row line so bancolombia_web outscores bancolombia_app again.
    cropped_ocr = "\n".join(
        line for line in APP_ACCOUNT_VIEW_OCR.splitlines()
        if "Detalles" not in line
    )

    original_ocr = image_detection.ocr_image
    original_boxes = bancolombia_web_screenshot.ocr_image_with_boxes
    image_detection.ocr_image = lambda path: cropped_ocr
    # The web parser re-OCRs the image with bounding boxes; on the app's
    # vertical layout it reconstructs no valid rows. Empty boxes reproduce
    # its ValueError without needing tesseract or the original image.
    bancolombia_web_screenshot.ocr_image_with_boxes = lambda path: []
    try:
        upper = cropped_ocr.upper()
        scores = {
            d["name"]: sum(w for w, fn in d["signals"] if fn(upper))
            for d in image_detection.IMAGE_DETECTORS
        }
        assert scores["bancolombia_web"] > scores["bancolombia_app"], scores

        statements = image_detection.detect_and_parse_image("dummy.jpg")
    finally:
        image_detection.ocr_image = original_ocr
        bancolombia_web_screenshot.ocr_image_with_boxes = original_boxes
    _assert_expected_statement(statements)
    print("✓ fallback to next confident detector works")


if __name__ == "__main__":
    test_app_account_view_routes_to_app_parser()
    test_fallback_to_next_detector_when_winner_fails()
    print("\n✓ All image detection routing tests passed")
