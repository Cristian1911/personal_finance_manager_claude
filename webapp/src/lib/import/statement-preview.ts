import type { Account } from "@/types/domain";
import type { ParsedStatement } from "@/types/import";
import { formatDate } from "@/lib/utils/date";
import { parseStatementFilename } from "@/lib/email-ingest/statement-filename";
import {
  accountMaskSuffixMatches,
  normalizeAccountMaskSuffix,
} from "@/lib/utils/account-mask";

/**
 * Identity of a parsed statement as the import queue shows it: which bank,
 * which product, which period, and which account it will land in. Shared by
 * the wizard's auto-match (so the preview never disagrees with what the
 * review step pre-selects) and the "Cola de importación" card.
 */

/** Parser `bank` slug → display name (services/pdf_parser emits snake_case). */
const PARSER_BANK_LABELS: Record<string, string> = {
  bancolombia: "Bancolombia",
  banco_de_bogota: "Banco de Bogotá",
  banco_popular: "Banco Popular",
  cooperativa_confiar: "Confiar",
  davivienda: "Davivienda",
  falabella: "Falabella",
  lulo: "Lulo",
  nequi: "Nequi",
  nu: "Nu",
};

/** Parser `bank` slug → `accounts.bank_key` (used for the brand logo). */
const PARSER_BANK_KEYS: Record<string, string> = {
  bancolombia: "bancolombia",
  banco_de_bogota: "banco-de-bogota",
  banco_popular: "popular",
  cooperativa_confiar: "confiar",
  davivienda: "davivienda",
  falabella: "falabella",
  lulo: "lulo",
  nequi: "nequi",
  nu: "nu",
};

export const STATEMENT_TYPE_SHORT_LABELS: Record<ParsedStatement["statement_type"], string> = {
  savings: "Ahorros",
  credit_card: "Tarjeta",
  loan: "Préstamo",
  investment: "Inversión",
};

const STATEMENT_TYPE_ACCOUNT_TYPE: Record<ParsedStatement["statement_type"], Account["account_type"]> = {
  savings: "SAVINGS",
  credit_card: "CREDIT_CARD",
  loan: "LOAN",
  investment: "INVESTMENT",
};

export function parserBankLabel(bank: string | null | undefined): string {
  if (!bank) return "Banco";
  const key = bank.trim().toLowerCase();
  if (PARSER_BANK_LABELS[key]) return PARSER_BANK_LABELS[key];
  return key
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function parserBankKey(bank: string | null | undefined): string | null {
  if (!bank) return null;
  return PARSER_BANK_KEYS[bank.trim().toLowerCase()] ?? null;
}

/** Last-4 digits identifying the product on the statement, if the parser found them. */
export function statementMaskSuffix(stmt: ParsedStatement): string | null {
  switch (stmt.statement_type) {
    case "credit_card":
      return normalizeAccountMaskSuffix(stmt.card_last_four);
    case "investment":
      return normalizeAccountMaskSuffix(
        stmt.account_number ?? stmt.investment_metadata?.investment_account_number ?? null,
      );
    default:
      // Savings/loans identify by account number only — a debit card's last-4
      // is a different number and lives in `accounts.debit_card_mask`.
      return normalizeAccountMaskSuffix(stmt.account_number);
  }
}

/**
 * Auto-match a parsed statement to one of the user's accounts: same product
 * type + same last-4. Returns undefined when nothing matches (the review step
 * then asks the user to pick or create an account).
 */
export function matchStatementToAccount(
  stmt: ParsedStatement,
  accounts: readonly Account[],
): Account | undefined {
  const last4 = statementMaskSuffix(stmt);
  if (!last4) return undefined;
  const accountType = STATEMENT_TYPE_ACCOUNT_TYPE[stmt.statement_type];
  if (!accountType) return undefined;
  return accounts.find(
    (a) => a.account_type === accountType && accountMaskSuffixMatches(a.mask, last4),
  );
}

/**
 * "sep 2026" when the period sits inside one month, "16 ago – 15 sep 2026"
 * when it straddles two (credit-card cut cycles), a single date when only one
 * bound is known, null when the parser found neither.
 */
export function formatStatementPeriod(
  from: string | null | undefined,
  to: string | null | undefined,
): string | null {
  if (from && to) {
    if (from.slice(0, 7) === to.slice(0, 7)) return formatDate(to, "MMM yyyy");
    const sameYear = from.slice(0, 4) === to.slice(0, 4);
    return `${formatDate(from, sameYear ? "d MMM" : "d MMM yyyy")} – ${formatDate(to, "d MMM yyyy")}`;
  }
  const only = from ?? to;
  return only ? formatDate(only, "d MMM yyyy") : null;
}

/** "202609" (from the Bancolombia filename) → "sep 2026". */
function formatFilenamePeriod(yyyymm: string): string | null {
  if (!/^\d{6}$/.test(yyyymm)) return null;
  const month = Number(yyyymm.slice(4, 6));
  if (month < 1 || month > 12) return null;
  return formatDate(`${yyyymm.slice(0, 4)}-${yyyymm.slice(4, 6)}-15`, "MMM yyyy");
}

/** "TARJETA_AMEX" → "Tarjeta Amex", "CUENTA_AHORROS" → "Cuenta de ahorros". */
function humanizeFilenameProduct(raw: string): string {
  const words = raw.split(/[_\s]+/).filter(Boolean);
  if (words.length === 0) return "Extracto";
  const upper = words.map((w) => w.toUpperCase());
  if (upper[0] === "CUENTA" && upper[1] === "AHORROS") return "Cuenta de ahorros";
  if (upper[0] === "CUENTA" && upper[1] === "CORRIENTE") return "Cuenta corriente";
  return words
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

export type StatementPreview = {
  /** e.g. "Bancolombia" */
  bankLabel: string;
  /** `accounts.bank_key` for the brand mark, when the parser bank maps to one. */
  bankKey: string | null;
  /** e.g. "Tarjeta", "Ahorros" */
  typeLabel: string;
  accountType: Account["account_type"];
  /** Last-4 digits, or null when the statement carries no product number. */
  mask: string | null;
  /** e.g. "sep 2026" */
  periodLabel: string | null;
  currency: string;
  transactionCount: number;
  /** Account the wizard will pre-select, or null when the user must choose. */
  account: Account | null;
};

export function describeParsedStatement(
  stmt: ParsedStatement,
  accounts: readonly Account[],
): StatementPreview {
  return {
    bankLabel: parserBankLabel(stmt.bank),
    bankKey: parserBankKey(stmt.bank),
    typeLabel: STATEMENT_TYPE_SHORT_LABELS[stmt.statement_type] ?? stmt.statement_type,
    accountType: STATEMENT_TYPE_ACCOUNT_TYPE[stmt.statement_type] ?? "OTHER",
    mask: statementMaskSuffix(stmt),
    periodLabel: formatStatementPeriod(stmt.period_from, stmt.period_to),
    currency: stmt.currency,
    transactionCount: stmt.transactions?.length ?? 0,
    account: matchStatementToAccount(stmt, accounts) ?? null,
  };
}

/**
 * What we can say about a queued PDF that has NOT been parsed yet (pending,
 * needs_password, parse_failed), read off the Bancolombia filename pattern
 * `Extracto_{id}_{YYYYMM}_{PRODUCT}_{LAST4}.pdf`. Null for other filenames.
 */
export type FilenamePreview = {
  productLabel: string;
  mask: string;
  periodLabel: string | null;
  /** Unique account whose mask ends in the same digits, if any. */
  account: Account | null;
};

export function describeStatementFilename(
  filename: string | null | undefined,
  accounts: readonly Account[],
): FilenamePreview | null {
  if (!filename) return null;
  const info = parseStatementFilename(filename);
  if (!info) return null;
  const candidates = accounts.filter((a) => accountMaskSuffixMatches(a.mask, info.last4));
  return {
    productLabel: humanizeFilenameProduct(info.accountType),
    mask: info.last4,
    periodLabel: formatFilenamePeriod(info.period),
    account: candidates.length === 1 ? candidates[0] : null,
  };
}

/** Coerce the `parsed_data` JSON column into statements, or [] when it isn't one. */
export function parsedDataToStatements(parsedData: unknown): ParsedStatement[] {
  if (!Array.isArray(parsedData)) return [];
  return parsedData.filter(
    (s): s is ParsedStatement =>
      !!s && typeof s === "object" && typeof (s as ParsedStatement).statement_type === "string",
  );
}
