/**
 * Parse Bancolombia statement PDF filenames.
 *
 * Format: Extracto_{id}_{YYYYMM}_{TYPE}_{LAST4}.pdf
 * Example: Extracto_1063686933_202603_TARJETA_AMEX_5747.pdf
 *
 * The type segment can be multi-word (e.g. TARJETA_AMEX, CUENTA_AHORROS).
 * The last4 is always the last segment before .pdf.
 */

export type StatementFilenameInfo = {
  /** Last 4 digits of the card/account — used for account matching */
  last4: string;
  /** Statement period (YYYYMM) */
  period: string;
  /** Account type description from filename (e.g. "TARJETA_AMEX") */
  accountType: string;
  /** Raw ID field from filename (not the password) */
  rawId: string;
};

const FILENAME_REGEX =
  /^Extracto_(\d+)_(\d{6})_(.+?)_(\d{4})\.pdf$/i;

export function parseStatementFilename(
  filename: string,
): StatementFilenameInfo | null {
  const match = filename.match(FILENAME_REGEX);
  if (!match) return null;

  return {
    rawId: match[1],
    period: match[2],
    accountType: match[3],
    last4: match[4],
  };
}

import { accountMaskSuffixMatches } from "@/lib/utils/account-mask";

/**
 * Match a statement's last4 to an account via the mask field.
 */
export function matchAccountByLast4(
  accounts: Array<{
    id: string;
    mask: string | null;
    pdf_password: string | null;
  }>,
  last4: string,
): { accountId: string; pdfPassword: string | null } | null {
  for (const account of accounts) {
    if (accountMaskSuffixMatches(account.mask, last4)) {
      return { accountId: account.id, pdfPassword: account.pdf_password };
    }
  }
  return null;
}
