#!/usr/bin/env python3
"""
PDF Parser CLI Test Script

A command-line tool for testing PDF parsers with debug capabilities.
Allows manual verification and adjustment of parsed statement data.

Usage:
    python test_parser.py <pdf_file> [options]
    
Examples:
    # Auto-detect and parse
    python test_parser.py statement.pdf
    
    # Use specific parser with debug mode
    python test_parser.py statement.pdf -p bancolombia_savings --debug
    
    # Save to JSON for further analysis
    python test_parser.py statement.pdf -o output.json
    
    # Show raw text from PDF
    python test_parser.py statement.pdf --raw-text
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
from datetime import date
from pathlib import Path
from typing import Any

import pdfplumber

# Import all parsers
from models import ParsedStatement, ParsedTransaction, StatementType
from parsers import detect_and_parse
from parsers.bancolombia_credit_card import parse_credit_card as parse_bancolombia_cc
from parsers.bancolombia_loan import parse_loan as parse_bancolombia_loan
from parsers.bancolombia_savings import parse_savings as parse_bancolombia_savings
from parsers.bogota_credit_card import parse_bogota_credit_card
from parsers.bogota_loan import parse_bogota_loan
from parsers.bogota_savings import parse_bogota_savings
from parsers.davivienda_loan import parse_davivienda_loan
from parsers.falabella_credit_card import parse_falabella_credit_card
from parsers.lulo_loan import parse_lulo_loan
from parsers.nu_credit_card import parse_nu_credit_card
from parsers.popular_credit_card import parse_popular_credit_card

# Available parsers registry
PARSERS = {
    "auto": detect_and_parse,
    "bancolombia_savings": parse_bancolombia_savings,
    "bancolombia_credit_card": parse_bancolombia_cc,
    "bancolombia_loan": parse_bancolombia_loan,
    "bogota_savings": parse_bogota_savings,
    "bogota_credit_card": parse_bogota_credit_card,
    "bogota_loan": parse_bogota_loan,
    "davivienda_loan": parse_davivienda_loan,
    "falabella_credit_card": parse_falabella_credit_card,
    "lulo_loan": parse_lulo_loan,
    "nu_credit_card": parse_nu_credit_card,
    "popular_credit_card": parse_popular_credit_card,
}


def print_header(text: str, char: str = "=") -> None:
    """Print a formatted header."""
    width = min(70, len(text) + 4)
    print(f"\n{char * width}")
    print(f"  {text}")
    print(f"{char * width}\n")


def print_section(text: str) -> None:
    """Print a section header."""
    print(f"\n{'─' * 50}")
    print(f"  {text}")
    print(f"{'─' * 50}")


def print_debug(label: str, value: Any, indent: int = 0) -> None:
    """Print debug information with formatting."""
    prefix = "  " * indent
    if value is None:
        print(f"{prefix}{label}: {value}")
    elif isinstance(value, (int, float)):
        print(f"{prefix}{label}: {value:,.2f}")
    elif isinstance(value, date):
        print(f"{prefix}{label}: {value.isoformat()}")
    elif isinstance(value, str):
        print(f"{prefix}{label}: {value}")
    else:
        print(f"{prefix}{label}: {value}")


def show_raw_text(pdf_path: str, password: str | None = None, max_pages: int = 0) -> None:
    """Display raw text extracted from PDF."""
    print_header("RAW PDF TEXT", "#")
    
    with pdfplumber.open(pdf_path, password=password) as pdf:
        pages_to_show = len(pdf.pages) if max_pages == 0 else min(max_pages, len(pdf.pages))
        
        for i, page in enumerate(pdf.pages[:pages_to_show], 1):
            print_section(f"PAGE {i}/{pages_to_show}")
            text = page.extract_text()
            if text:
                print(text)
            else:
                print("[No text extracted from this page]")
            print()


def show_detection_info(pdf_path: str, password: str | None = None) -> None:
    """Show information about detected PDF type."""
    print_header("DETECTION ANALYSIS", "#")
    
    with pdfplumber.open(pdf_path, password=password) as pdf:
        sample_text = ""
        for page in pdf.pages[:3]:
            try:
                text = page.extract_text() or ""
                sample_text += text + "\n"
            except Exception:
                pass
    
    sample_upper = sample_text.upper()
    
    print("Checking for bank indicators:")
    checks = [
        ("NU Financiera / NU Colombia", "NU FINANCIERA" in sample_upper or "NU COLOMBIA" in sample_upper),
        ("NUBANK", "NUBANK" in sample_upper),
        ("NU Pagos", "NU PAGOS" in sample_upper),
        ("Lulo Bank", "LULO BANK" in sample_upper),
        ("Davivienda", "DAVIVIENDA" in sample_upper),
        ("Banco Popular", "BANCO POPULAR" in sample_upper or "BANCOPOPULAR" in sample_upper),
        ("Falabella / CMR", "FALABELLA" in sample_upper or "CMR" in sample_upper),
        ("Banco de Bogotá", "BANCO DE BOGOT" in sample_upper or "BANCO DE BOGOTA" in sample_upper),
        ("Bancolombia Cuenta de Ahorros", "CUENTA DE AHORROS" in sample_upper),
        ("Bancolombia Línea de Crédito", "LÍNEA DE CRÉDITO" in sample_upper and "OBLIGACIÓN" in sample_upper),
        ("Bancolombia Tarjeta", "TARJETA" in sample_upper or "MASTERCARD" in sample_upper),
    ]
    
    for name, detected in checks:
        status = "✓ DETECTED" if detected else "✗ not found"
        print(f"  {name:.<40} {status}")
    
    print()


def show_transaction_debug(tx: ParsedTransaction, index: int) -> None:
    """Display debug info for a single transaction."""
    print(f"\n  [{index}] Transaction:")
    print_debug("Date", tx.date, indent=2)
    print_debug("Description", tx.description, indent=2)
    print_debug("Amount", tx.amount, indent=2)
    print_debug("Direction", tx.direction.value, indent=2)
    print_debug("Balance", tx.balance, indent=2)
    print_debug("Currency", tx.currency, indent=2)
    if tx.authorization_number:
        print_debug("Authorization #", tx.authorization_number, indent=2)
    if tx.installments:
        print_debug("Installments", tx.installments, indent=2)


def show_statement_debug(statement: ParsedStatement, index: int = 0) -> None:
    """Display debug info for a parsed statement."""
    suffix = f" #{index + 1}" if index > 0 else ""
    print_header(f"PARSED STATEMENT{suffix}", "*")
    
    # Basic info
    print_section("BASIC INFORMATION")
    print_debug("Bank", statement.bank, indent=1)
    print_debug("Statement Type", statement.statement_type.value, indent=1)
    print_debug("Account Number", statement.account_number, indent=1)
    print_debug("Card Last 4", statement.card_last_four, indent=1)
    print_debug("Currency", statement.currency, indent=1)
    print_debug("Period From", statement.period_from, indent=1)
    print_debug("Period To", statement.period_to, indent=1)
    
    # Summary
    if statement.summary:
        print_section("SUMMARY")
        print_debug("Previous Balance", statement.summary.previous_balance, indent=1)
        print_debug("Total Credits", statement.summary.total_credits, indent=1)
        print_debug("Total Debits", statement.summary.total_debits, indent=1)
        print_debug("Final Balance", statement.summary.final_balance, indent=1)
        print_debug("Purchases & Charges", statement.summary.purchases_and_charges, indent=1)
        print_debug("Interest Charged", statement.summary.interest_charged, indent=1)
    
    # Credit card metadata
    if statement.credit_card_metadata:
        print_section("CREDIT CARD METADATA")
        cc = statement.credit_card_metadata
        print_debug("Credit Limit", cc.credit_limit, indent=1)
        print_debug("Available Credit", cc.available_credit, indent=1)
        print_debug("Interest Rate (monthly)", cc.interest_rate, indent=1)
        print_debug("Late Interest Rate", cc.late_interest_rate, indent=1)
        print_debug("Total Payment Due", cc.total_payment_due, indent=1)
        print_debug("Minimum Payment", cc.minimum_payment, indent=1)
        print_debug("Payment Due Date", cc.payment_due_date, indent=1)
    
    # Loan metadata
    if statement.loan_metadata:
        print_section("LOAN METADATA")
        ln = statement.loan_metadata
        print_debug("Loan Number", ln.loan_number, indent=1)
        print_debug("Loan Type", ln.loan_type, indent=1)
        print_debug("Initial Amount", ln.initial_amount, indent=1)
        print_debug("Disbursement Date", ln.disbursement_date, indent=1)
        print_debug("Remaining Balance", ln.remaining_balance, indent=1)
        print_debug("Interest Rate (EA)", ln.interest_rate, indent=1)
        print_debug("Late Interest Rate", ln.late_interest_rate, indent=1)
        print_debug("Total Payment Due", ln.total_payment_due, indent=1)
        print_debug("Minimum Payment", ln.minimum_payment, indent=1)
        print_debug("Payment Due Date", ln.payment_due_date, indent=1)
        print_debug("Installments in Default", ln.installments_in_default, indent=1)
        print_debug("Statement Cut Date", ln.statement_cut_date, indent=1)
        print_debug("Last Payment Date", ln.last_payment_date, indent=1)
    
    # Transactions
    print_section(f"TRANSACTIONS ({len(statement.transactions)} total)")
    
    # Calculate statistics
    inflows = [tx for tx in statement.transactions if tx.direction.value == "INFLOW"]
    outflows = [tx for tx in statement.transactions if tx.direction.value == "OUTFLOW"]
    
    total_inflow = sum(tx.amount for tx in inflows)
    total_outflow = sum(tx.amount for tx in outflows)
    
    print("  Statistics:")
    print_debug("Inflows", f"{len(inflows)} transactions = ${total_inflow:,.2f}", indent=2)
    print_debug("Outflows", f"{len(outflows)} transactions = ${total_outflow:,.2f}", indent=2)
    print_debug("Net", f"${total_inflow - total_outflow:,.2f}", indent=2)
    
    print("\n  Transaction List:")
    for i, tx in enumerate(statement.transactions, 1):
        show_transaction_debug(tx, i)


def export_to_json(statements: list[ParsedStatement], output_path: str) -> None:
    """Export parsed statements to JSON file."""
    data = [stmt.model_dump(mode="json") for stmt in statements]
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"\n✓ Exported {len(statements)} statement(s) to: {output_path}")


def interactive_transaction_editor(statement: ParsedStatement) -> ParsedStatement:
    """Interactive mode to review and filter transactions."""
    print_header("INTERACTIVE TRANSACTION REVIEW", "#")
    print("Commands: [s]how, [f]ilter, [d]elete, [q]uit\n")
    
    transactions = statement.transactions.copy()
    
    while True:
        cmd = input("Enter command (s/f/d/q): ").strip().lower()
        
        if cmd == "q":
            break
        
        elif cmd == "s":
            print(f"\nShowing {len(transactions)} transactions:")
            for i, tx in enumerate(transactions, 1):
                direction = "+" if tx.direction.value == "INFLOW" else "-"
                print(f"  [{i}] {tx.date} {direction}${tx.amount:,.2f} | {tx.description[:50]}")
        
        elif cmd == "f":
            keyword = input("Filter by keyword (in description): ").strip().lower()
            filtered = [tx for tx in transactions if keyword in tx.description.lower()]
            print(f"\nFound {len(filtered)} transactions matching '{keyword}':")
            for tx in filtered:
                direction = "+" if tx.direction.value == "INFLOW" else "-"
                print(f"  {tx.date} {direction}${tx.amount:,.2f} | {tx.description[:50]}")
        
        elif cmd == "d":
            try:
                idx = int(input("Enter transaction number to delete: ")) - 1
                if 0 <= idx < len(transactions):
                    removed = transactions.pop(idx)
                    print(f"Removed: {removed.description[:50]}")
                else:
                    print("Invalid transaction number")
            except ValueError:
                print("Please enter a valid number")
        
        else:
            print("Unknown command. Use: s (show), f (filter), d (delete), q (quit)")
    
    # Create new statement with filtered transactions
    new_statement = statement.model_copy(update={"transactions": transactions})
    print(f"\n✓ Final transaction count: {len(transactions)}")
    return new_statement


def main() -> int:
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Test PDF parsers with debug capabilities",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Available parsers:
  auto                    Auto-detect bank and type (default)
  bancolombia_savings     Bancolombia savings account
  bancolombia_credit_card Bancolombia credit card
  bancolombia_loan        Bancolombia loan/credit line
  bogota_savings          Banco de Bogotá savings
  bogota_credit_card      Banco de Bogotá credit card
  bogota_loan             Banco de Bogotá loan
  davivienda_loan         Davivienda loan
  falabella_credit_card   Falabella/CMR credit card
  lulo_loan               Lulo Bank loan
  nu_credit_card          NU Colombia credit card
  popular_credit_card     Banco Popular credit card
        """
    )
    
    parser.add_argument("pdf_file", help="Path to the PDF file to parse")
    parser.add_argument(
        "-p", "--parser",
        choices=list(PARSERS.keys()),
        default="auto",
        help="Parser to use (default: auto)"
    )
    parser.add_argument(
        "--password",
        help="PDF password if encrypted"
    )
    parser.add_argument(
        "-d", "--debug",
        action="store_true",
        help="Enable debug mode with detailed output"
    )
    parser.add_argument(
        "-o", "--output",
        help="Export parsed data to JSON file"
    )
    parser.add_argument(
        "--raw-text",
        action="store_true",
        help="Show raw text extracted from PDF"
    )
    parser.add_argument(
        "--max-pages",
        type=int,
        default=0,
        help="Limit pages for raw text display (0 = all)"
    )
    parser.add_argument(
        "--detect-only",
        action="store_true",
        help="Only show detection analysis, don't parse"
    )
    parser.add_argument(
        "-i", "--interactive",
        action="store_true",
        help="Interactive mode to review/filter transactions"
    )
    parser.add_argument(
        "--silent",
        action="store_true",
        help="Minimal output (for scripting)"
    )
    
    args = parser.parse_args()
    
    # Validate PDF file
    pdf_path = Path(args.pdf_file)
    if not pdf_path.exists():
        print(f"Error: File not found: {pdf_path}", file=sys.stderr)
        return 1
    
    if not pdf_path.suffix.lower() == ".pdf":
        print(f"Error: File must be a PDF: {pdf_path}", file=sys.stderr)
        return 1
    
    try:
        # Show detection info
        if args.detect_only:
            show_detection_info(str(pdf_path), args.password)
            return 0
        
        # Show raw text if requested
        if args.raw_text:
            show_raw_text(str(pdf_path), args.password, args.max_pages)
            if not args.debug:
                return 0
        
        # Parse the PDF
        if not args.silent:
            print_header(f"PARSING: {pdf_path.name}", "=")
            print(f"Parser: {args.parser}")
        
        parse_func = PARSERS[args.parser]
        
        # Some parsers return a single statement, others return a list
        result = parse_func(str(pdf_path), password=args.password)
        
        if isinstance(result, list):
            statements = result
        else:
            statements = [result]
        
        if not args.silent:
            print(f"✓ Parsed {len(statements)} statement(s)\n")
        
        # Show debug info for each statement
        if args.debug:
            for i, stmt in enumerate(statements):
                show_statement_debug(stmt, i)
        
        # Interactive mode
        if args.interactive and len(statements) > 0:
            statements[0] = interactive_transaction_editor(statements[0])
        
        # Export to JSON
        if args.output:
            export_to_json(statements, args.output)
        
        # Summary output
        if not args.silent and not args.debug:
            for stmt in statements:
                print(f"\n{stmt.bank.upper()} - {stmt.statement_type.value}")
                print(f"  Account: {stmt.account_number or 'N/A'}")
                print(f"  Period: {stmt.period_from} to {stmt.period_to}")
                print(f"  Transactions: {len(stmt.transactions)}")
                
                if stmt.summary:
                    print(f"  Final Balance: ${stmt.summary.final_balance:,.2f}" 
                          if stmt.summary.final_balance else "  Final Balance: N/A")
        
        return 0
        
    except Exception as e:
        print(f"\n✗ Error parsing PDF: {e}", file=sys.stderr)
        
        if args.debug:
            import traceback
            print("\n--- Full Traceback ---", file=sys.stderr)
            traceback.print_exc()
        
        return 1


if __name__ == "__main__":
    sys.exit(main())
