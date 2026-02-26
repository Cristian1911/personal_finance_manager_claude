from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess
import tempfile
from datetime import date, datetime
from pathlib import Path

from models import (
    CreditCardMetadata,
    LoanMetadata,
    ParsedStatement,
    ParsedTransaction,
    StatementSummary,
    StatementType,
    TransactionDirection,
)

logger = logging.getLogger("pdf_parser.opendataloader_fallback")

_AMOUNT_RE = re.compile(r"-?\$?\s*\d[\d.,]*")
_DATE_START_RE = re.compile(r"^\s*(\d{1,2}(?:[/-]\d{1,2})(?:[/-]\d{2,4})?)\s+")
_CARD_LAST_FOUR_RE = re.compile(r"(?:\*{2,}|•\s*)+(\d{4})")
_ACCOUNT_RE = re.compile(r"(?:CUENTA|N[UÚ]MERO)\D{0,8}(\d{6,20})", re.IGNORECASE)


def is_opendataloader_fallback_enabled() -> bool:
    raw = os.getenv("ENABLE_OPENDATALOADER_FALLBACK", "false").strip().lower()
    return raw in {"1", "true", "yes", "on"}


def get_opendataloaders_binary() -> str | None:
    env_bin = os.getenv("OPENDATALOADER_BIN")
    if env_bin:
        return env_bin
    return shutil.which("opendataloaders")


def try_parse_with_opendataloader(
    pdf_path: str, password: str | None = None
) -> list[ParsedStatement] | None:
    if not is_opendataloader_fallback_enabled():
        return None

    binary = get_opendataloaders_binary()
    if not binary:
        logger.warning(
            "OpenDataLoader fallback enabled but binary was not found "
            "(set OPENDATALOADER_BIN or install `opendataloaders`)."
        )
        return None

    if password:
        logger.info(
            "OpenDataLoader fallback will run on encrypted PDF input; password "
            "support depends on the local OpenDataLoader version."
        )

    mode = os.getenv("OPENDATALOADER_MODE", "hybrid")
    timeout_seconds = int(os.getenv("OPENDATALOADER_TIMEOUT_SEC", "120"))

    extracted_text = _extract_text_via_cli(
        binary=binary,
        pdf_path=pdf_path,
        mode=mode,
        timeout_seconds=timeout_seconds,
    )
    if not extracted_text:
        return None

    statements = _build_statements_from_text(extracted_text)
    if not statements:
        logger.warning("OpenDataLoader fallback produced no usable statements")
        return None
    return statements


def _extract_text_via_cli(
    binary: str, pdf_path: str, mode: str, timeout_seconds: int
) -> str | None:
    with tempfile.TemporaryDirectory(prefix="odl_out_") as out_dir:
        attempts = [
            [
                binary,
                "pdf",
                pdf_path,
                "--mode",
                mode,
                "--output-format",
                "markdown",
                "--output-dir",
                out_dir,
            ],
            [binary, "pdf", pdf_path, "--mode", mode, "--output-dir", out_dir],
        ]

        for cmd in attempts:
            try:
                proc = subprocess.run(
                    cmd,
                    check=False,
                    capture_output=True,
                    text=True,
                    timeout=timeout_seconds,
                )
            except Exception:
                logger.exception("OpenDataLoader command failed to execute: %s", cmd)
                continue

            if proc.returncode != 0:
                logger.warning(
                    "OpenDataLoader command failed: code=%s cmd=%s stderr=%s",
                    proc.returncode,
                    " ".join(cmd),
                    (proc.stderr or "").strip()[:500],
                )
                continue

            text = _read_generated_text(out_dir)
            if text:
                logger.info(
                    "OpenDataLoader extraction succeeded: mode=%s chars=%s",
                    mode,
                    len(text),
                )
                return text

            stdout = (proc.stdout or "").strip()
            if stdout:
                logger.info(
                    "OpenDataLoader extraction returned stdout fallback: chars=%s",
                    len(stdout),
                )
                return stdout

    return None


def _read_generated_text(output_dir: str) -> str | None:
    base = Path(output_dir)
    if not base.exists():
        return None

    candidates = sorted(
        (p for p in base.rglob("*") if p.is_file()),
        key=lambda p: p.stat().st_mtime,
        reverse=True,
    )
    if not candidates:
        return None

    text_chunks: list[str] = []
    for path in candidates:
        suffix = path.suffix.lower()
        if suffix in {".md", ".markdown", ".txt"}:
            try:
                content = path.read_text(encoding="utf-8", errors="ignore").strip()
            except Exception:
                logger.exception("Could not read OpenDataLoader output file: %s", path)
                continue
            if content:
                text_chunks.append(content)
        elif suffix == ".json":
            try:
                payload = json.loads(path.read_text(encoding="utf-8", errors="ignore"))
            except Exception:
                logger.exception("Could not parse OpenDataLoader JSON output: %s", path)
                continue
            json_text = _collect_strings(payload)
            if json_text:
                text_chunks.append(json_text)

    if not text_chunks:
        return None
    return "\n\n".join(text_chunks)


def _collect_strings(value: object) -> str:
    parts: list[str] = []

    def visit(node: object) -> None:
        if isinstance(node, str):
            stripped = node.strip()
            if stripped:
                parts.append(stripped)
            return
        if isinstance(node, list):
            for item in node:
                visit(item)
            return
        if isinstance(node, dict):
            for item in node.values():
                visit(item)

    visit(value)
    return "\n".join(parts)


def _build_statements_from_text(text: str) -> list[ParsedStatement]:
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    if not lines:
        return []

    upper_text = text.upper()
    statement_type = _detect_statement_type(upper_text)
    bank = _detect_bank(upper_text)
    account_number = _extract_account_number(upper_text)
    card_last_four = _extract_card_last_four(text)
    transactions = _extract_transactions(lines, statement_type)

    summary = _extract_summary(upper_text)
    credit_meta = _extract_credit_metadata(upper_text)
    loan_meta = _extract_loan_metadata(upper_text)

    if statement_type != StatementType.CREDIT_CARD:
        credit_meta = None
    if statement_type != StatementType.LOAN:
        loan_meta = None

    has_metadata = bool(summary or credit_meta or loan_meta)
    if not transactions and not has_metadata:
        return []

    return [
        ParsedStatement(
            bank=bank,
            statement_type=statement_type,
            account_number=account_number,
            card_last_four=card_last_four,
            currency="COP",
            summary=summary,
            credit_card_metadata=credit_meta,
            loan_metadata=loan_meta,
            transactions=transactions,
        )
    ]


def _detect_statement_type(upper_text: str) -> StatementType:
    credit_signals = ("TARJETA", "CUPO", "PAGO MÍNIMO", "PAGO MINIMO")
    loan_signals = ("CRÉDITO", "CREDITO", "OBLIGACIÓN", "OBLIGACION", "PRÉSTAMO")

    if any(token in upper_text for token in loan_signals):
        return StatementType.LOAN
    if any(token in upper_text for token in credit_signals):
        return StatementType.CREDIT_CARD
    return StatementType.SAVINGS


def _detect_bank(upper_text: str) -> str:
    bank_tokens = {
        "bancolombia": ("BANCOLOMBIA",),
        "nu": ("NU FINANCIERA", "NU COLOMBIA", "NUBANK"),
        "lulo_bank": ("LULO BANK",),
        "banco_de_bogota": ("BANCO DE BOGOT", "BANCODEBOGOTA"),
        "banco_popular": ("BANCO POPULAR", "BANCOPOPULAR"),
        "davivienda": ("DAVIVIENDA",),
        "falabella": ("FALABELLA", "CMR"),
        "cooperativa_confiar": ("CONFIAR",),
    }
    for bank_name, tokens in bank_tokens.items():
        if any(token in upper_text for token in tokens):
            return bank_name
    return "unknown_bank"


def _extract_account_number(upper_text: str) -> str | None:
    match = _ACCOUNT_RE.search(upper_text)
    return match.group(1) if match else None


def _extract_card_last_four(text: str) -> str | None:
    match = _CARD_LAST_FOUR_RE.search(text)
    return match.group(1) if match else None


def _extract_transactions(
    lines: list[str], statement_type: StatementType
) -> list[ParsedTransaction]:
    parsed: list[ParsedTransaction] = []
    seen: set[tuple[str, str, float, str]] = set()

    for raw_line in lines:
        tx = _parse_transaction_line(raw_line, statement_type)
        if not tx:
            continue
        key = (
            tx.date.isoformat(),
            tx.description.lower(),
            tx.amount,
            tx.direction.value,
        )
        if key in seen:
            continue
        seen.add(key)
        parsed.append(tx)

    return parsed


def _parse_transaction_line(
    line: str, statement_type: StatementType
) -> ParsedTransaction | None:
    date_match = _DATE_START_RE.match(line)
    if not date_match:
        return None

    tx_date = _parse_date_token(date_match.group(1))
    if not tx_date:
        return None

    rest = line[date_match.end() :].strip()
    amounts = list(_AMOUNT_RE.finditer(rest))
    if not amounts:
        return None

    first_amount = amounts[0]
    amount_value = _parse_mixed_number(first_amount.group(0))
    if amount_value == 0:
        return None

    description = rest[: first_amount.start()].strip(" -|")
    if len(description) < 3:
        return None

    balance = None
    if len(amounts) > 1:
        try:
            balance_value = _parse_mixed_number(amounts[-1].group(0))
            balance = abs(balance_value) if balance_value != 0 else None
        except Exception:
            balance = None

    if statement_type == StatementType.SAVINGS:
        direction = (
            TransactionDirection.INFLOW
            if amount_value > 0
            else TransactionDirection.OUTFLOW
        )
    else:
        direction = (
            TransactionDirection.INFLOW
            if amount_value < 0
            else TransactionDirection.OUTFLOW
        )

    return ParsedTransaction(
        date=tx_date,
        description=description,
        amount=abs(amount_value),
        direction=direction,
        balance=balance,
        currency="COP",
    )


def _parse_date_token(token: str) -> date | None:
    token = token.strip()
    formats = ("%d/%m/%Y", "%d-%m-%Y", "%d/%m/%y", "%d-%m-%y", "%d/%m", "%d-%m")
    for fmt in formats:
        try:
            parsed = datetime.strptime(token, fmt).date()
            if fmt in ("%d/%m", "%d-%m"):
                return date(date.today().year, parsed.month, parsed.day)
            return parsed
        except ValueError:
            continue
    return None


def _parse_mixed_number(raw: str) -> float:
    s = raw.replace("$", "").replace(" ", "").strip()
    if not s:
        return 0.0

    negative = s.startswith("-")
    if negative:
        s = s[1:]

    has_comma = "," in s
    has_dot = "." in s

    if has_comma and has_dot:
        if s.rfind(",") > s.rfind("."):
            normalized = s.replace(".", "").replace(",", ".")
        else:
            normalized = s.replace(",", "")
    elif has_comma:
        decimals = len(s) - s.rfind(",") - 1
        if s.count(",") > 1 or decimals != 2:
            normalized = s.replace(",", "")
        else:
            normalized = s.replace(",", ".")
    elif has_dot:
        decimals = len(s) - s.rfind(".") - 1
        if s.count(".") > 1 or decimals != 2:
            normalized = s.replace(".", "")
        else:
            normalized = s
    else:
        normalized = s

    value = float(normalized)
    return -value if negative else value


def _extract_summary(upper_text: str) -> StatementSummary | None:
    previous_balance = _find_amount_after(
        upper_text, ("SALDO ANTERIOR", "SALDO INICIAL")
    )
    total_credits = _find_amount_after(
        upper_text, ("TOTAL ABONOS", "TOTAL CRÉDITOS", "TOTAL CREDITOS")
    )
    total_debits = _find_amount_after(
        upper_text, ("TOTAL CARGOS", "TOTAL DÉBITOS", "TOTAL DEBITOS")
    )
    final_balance = _find_amount_after(
        upper_text, ("SALDO ACTUAL", "SALDO FINAL", "NUEVO SALDO")
    )
    purchases = _find_amount_after(
        upper_text, ("COMPRAS DEL MES", "COMPRAS Y CARGOS")
    )
    interest = _find_amount_after(
        upper_text, ("INTERESES CORRIENTES", "INTERÉS CORRIENTE", "INTERES CORRIENTE")
    )

    if all(
        value is None
        for value in (
            previous_balance,
            total_credits,
            total_debits,
            final_balance,
            purchases,
            interest,
        )
    ):
        return None

    return StatementSummary(
        previous_balance=previous_balance,
        total_credits=total_credits,
        total_debits=total_debits,
        final_balance=final_balance,
        purchases_and_charges=purchases,
        interest_charged=interest,
    )


def _extract_credit_metadata(upper_text: str) -> CreditCardMetadata | None:
    credit_limit = _find_amount_after(
        upper_text, ("CUPO TOTAL", "CUPO DEFINIDO", "LÍMITE DE CRÉDITO")
    )
    available_credit = _find_amount_after(
        upper_text, ("CUPO DISPONIBLE", "DISPONIBLE")
    )
    minimum_payment = _find_amount_after(
        upper_text, ("PAGO MÍNIMO", "PAGO MINIMO")
    )
    total_payment_due = _find_amount_after(
        upper_text, ("PAGO TOTAL", "TOTAL A PAGAR")
    )

    if all(
        value is None
        for value in (credit_limit, available_credit, minimum_payment, total_payment_due)
    ):
        return None

    return CreditCardMetadata(
        credit_limit=credit_limit,
        available_credit=available_credit,
        minimum_payment=minimum_payment,
        total_payment_due=total_payment_due,
    )


def _extract_loan_metadata(upper_text: str) -> LoanMetadata | None:
    remaining_balance = _find_amount_after(
        upper_text, ("SALDO CAPITAL", "SALDO PENDIENTE", "SALDO ACTUAL")
    )
    total_payment_due = _find_amount_after(
        upper_text, ("VALOR A PAGAR", "PAGO TOTAL", "CUOTA DEL PERIODO")
    )
    interest_rate = _find_percentage_after(
        upper_text, ("TASA PACTADA", "TASA INTERÉS", "TASA INTERES")
    )
    late_interest_rate = _find_percentage_after(
        upper_text, ("TASA MORA", "INTERÉS MORA", "INTERES MORA")
    )

    if all(
        value is None
        for value in (
            remaining_balance,
            total_payment_due,
            interest_rate,
            late_interest_rate,
        )
    ):
        return None

    return LoanMetadata(
        remaining_balance=remaining_balance,
        total_payment_due=total_payment_due,
        interest_rate=interest_rate,
        late_interest_rate=late_interest_rate,
    )


def _find_amount_after(upper_text: str, keywords: tuple[str, ...]) -> float | None:
    for keyword in keywords:
        idx = upper_text.find(keyword)
        if idx < 0:
            continue
        window = upper_text[idx : idx + 180]
        matches = _AMOUNT_RE.findall(window)
        if not matches:
            continue
        for match in matches:
            value = _parse_mixed_number(match)
            if value != 0:
                return abs(value)
    return None


def _find_percentage_after(upper_text: str, keywords: tuple[str, ...]) -> float | None:
    rate_re = re.compile(r"(\d{1,2}(?:[.,]\d{1,4})?)\s*%")
    for keyword in keywords:
        idx = upper_text.find(keyword)
        if idx < 0:
            continue
        window = upper_text[idx : idx + 120]
        match = rate_re.search(window)
        if not match:
            continue
        value = _parse_mixed_number(match.group(1))
        if value > 0:
            return value
    return None
