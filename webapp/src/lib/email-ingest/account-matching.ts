import type { ParsedEmailTransaction } from "@/lib/parsers/bancolombia-email";
import type { AccountType } from "@/types/domain";
import {
  accountMaskSuffixMatches,
  normalizeAccountMaskSuffix,
} from "../utils/account-mask";

type AccountMatchCandidate = {
  id: string;
  debit_card_mask: string | null;
  mask: string | null;
  account_type: AccountType;
};

type EmailCardType = ParsedEmailTransaction["card_type"];

/**
 * What kind of product a Bancolombia alert names. Drives which accounts can
 * match it, which mask column learns it, and what the "no registrada" prompt
 * offers: a credit card is created, a debit card is attached to the savings
 * account it draws from, an account number is attached or created.
 */
export type EmailProductKind = "credit_card" | "debit_card" | "account";

export type EmailAccountMatchStatus =
  /** Exactly one account carries the alert's mask. */
  | "matched"
  /** The alert has no mask; the ingest address default was used. */
  | "default"
  /** The alert carries a mask no account knows — a new card or account. */
  | "unrecognized"
  /** Several accounts share the mask and none of them is the default. */
  | "ambiguous"
  /** No mask and no default to fall back to. */
  | "none";

export interface EmailAccountMatch {
  accountId: string | null;
  status: EmailAccountMatchStatus;
  /** Normalized last four digits the alert carried, if any. */
  last4: string | null;
  productKind: EmailProductKind;
}

/** Account types a product kind can legitimately belong to. */
export const EMAIL_PRODUCT_ACCOUNT_TYPES: Record<EmailProductKind, AccountType[]> = {
  credit_card: ["CREDIT_CARD"],
  debit_card: ["SAVINGS", "CHECKING"],
  account: ["SAVINGS", "CHECKING"],
};

export function emailProductKind(cardType: EmailCardType): EmailProductKind {
  if (cardType === "T.Cred") return "credit_card";
  if (cardType === "T.Deb") return "debit_card";
  return "account";
}

/**
 * Whether an account can be the product an alert names. Debit cards live on
 * a savings/checking account; credit cards are their own account; "producto"
 * is Bancolombia's generic word, so it may name any product.
 */
export function accountFitsEmailProduct(
  accountType: AccountType,
  cardType: EmailCardType,
): boolean {
  if (cardType === "producto") return true;
  return EMAIL_PRODUCT_ACCOUNT_TYPES[emailProductKind(cardType)].includes(accountType);
}

/** Mask column an account learns from a product of this kind. */
export function emailProductMaskColumn(kind: EmailProductKind): "mask" | "debit_card_mask" {
  return kind === "debit_card" ? "debit_card_mask" : "mask";
}

/** True when `account` already carries the alert's mask on the right column. */
export function accountCarriesEmailProduct(
  account: AccountMatchCandidate,
  cardType: EmailCardType,
  last4: string | null | undefined,
): boolean {
  if (!accountFitsEmailProduct(account.account_type, cardType)) return false;
  const column = emailProductMaskColumn(emailProductKind(cardType));
  return accountMaskSuffixMatches(account[column], last4);
}

/**
 * Mask an account should learn from an alert it's about to absorb, or null
 * when there's nothing to learn. Cards are reissued, so a debit card always
 * takes the alert's number; a credit card does too when the user attached it
 * explicitly, but a mere pick from a row's selector only fills an empty one.
 * An account number is never overwritten — a different number is a different
 * account, and the mask is what PDF statements match against.
 */
export function emailProductMaskToLearn({
  account,
  cardType,
  last4,
  explicit,
}: {
  account: AccountMatchCandidate;
  cardType: EmailCardType;
  last4: string | null | undefined;
  /** The user chose this account for this product on purpose (link prompt). */
  explicit: boolean;
}): { column: "mask" | "debit_card_mask"; value: string } | null {
  const normalized = normalizeAccountMaskSuffix(last4);
  if (!normalized) return null;
  if (!accountFitsEmailProduct(account.account_type, cardType)) return null;

  const kind = emailProductKind(cardType);
  // A generic "producto" alert may be matched against any account, but only
  // an explicit link may teach a mask to something other than the kind's own
  // account types: `mask` is what PDF statements match on, and a row-selector
  // pick must not bind a credit card or loan to an account number.
  if (!explicit && !EMAIL_PRODUCT_ACCOUNT_TYPES[kind].includes(account.account_type)) {
    return null;
  }
  const column = emailProductMaskColumn(kind);
  const current = account[column];
  if (accountMaskSuffixMatches(current, normalized)) return null;

  const overwrite = kind === "debit_card" || (kind === "credit_card" && explicit);
  if (!overwrite && normalizeAccountMaskSuffix(current)) return null;

  return { column, value: normalized };
}

interface ResolveSuggestedEmailAccountParams {
  accounts: AccountMatchCandidate[];
  parsed: Pick<ParsedEmailTransaction, "card_last4" | "card_type">;
  defaultAccountId?: string | null;
}

/**
 * Match an alert to the account that carries its mask.
 *
 * A masked alert never falls back to the ingest default: a mask nobody knows
 * is a new card or account, and importing it into the default account was
 * how a brand-new credit card ended up as savings-account spending. The
 * default only covers alerts that carry no mask at all.
 */
export function resolveEmailAccountMatch({
  accounts,
  parsed,
  defaultAccountId,
}: ResolveSuggestedEmailAccountParams): EmailAccountMatch {
  const productKind = emailProductKind(parsed.card_type);
  const defaultAccount =
    defaultAccountId == null
      ? null
      : accounts.find((account) => account.id === defaultAccountId) ?? null;
  const last4 = normalizeAccountMaskSuffix(parsed.card_last4);

  if (!last4) {
    return {
      accountId: defaultAccount?.id ?? null,
      status: defaultAccount ? "default" : "none",
      last4: null,
      productKind,
    };
  }

  const exactMatches = accounts.filter((account) =>
    accountCarriesEmailProduct(account, parsed.card_type, last4),
  );

  if (exactMatches.length === 0) {
    return { accountId: null, status: "unrecognized", last4, productKind };
  }

  if (exactMatches.length === 1) {
    return { accountId: exactMatches[0].id, status: "matched", last4, productKind };
  }

  const preferred = exactMatches.find((account) => account.id === defaultAccount?.id);
  return preferred
    ? { accountId: preferred.id, status: "matched", last4, productKind }
    : { accountId: null, status: "ambiguous", last4, productKind };
}

export function resolveSuggestedEmailAccountId(
  params: ResolveSuggestedEmailAccountParams,
): string | null {
  return resolveEmailAccountMatch(params).accountId;
}

/**
 * Account a queued row imports into, in authority order: what the user picked
 * on this surface, then the server's suggestion, then the client-side match.
 * A row whose mask the client can't find on any account drops the stored
 * suggestion — it was written before the mask check existed (or by a default
 * fallback) and would send a new card's purchases to the wrong account.
 */
export function pickPendingEmailAccountId({
  override,
  suggested,
  match,
}: {
  override: string | null | undefined;
  suggested: string | null | undefined;
  match: EmailAccountMatch | null;
}): string | null {
  if (override) return override;
  if (match?.status === "unrecognized") return null;
  return suggested ?? match?.accountId ?? null;
}

const PRODUCT_LABELS: Record<EmailProductKind, string> = {
  credit_card: "Tarjeta de crédito",
  debit_card: "Tarjeta débito",
  account: "Cuenta",
};

/** "Tarjeta de crédito *7706" — the product exactly as the alert names it. */
export function describeEmailProduct(
  parsed: Pick<ParsedEmailTransaction, "card_last4" | "card_type">,
): string {
  const last4 = normalizeAccountMaskSuffix(parsed.card_last4);
  const label = PRODUCT_LABELS[emailProductKind(parsed.card_type)];
  return last4 ? `${label} *${last4}` : label;
}

/** Default name for an account created from an alert's product. */
export function suggestEmailProductAccountName(
  parsed: Pick<ParsedEmailTransaction, "card_last4" | "card_type">,
  institution = "Bancolombia",
): string {
  const last4 = normalizeAccountMaskSuffix(parsed.card_last4);
  const suffix = last4 ? ` ****${last4}` : "";
  const kind = emailProductKind(parsed.card_type);
  if (kind === "credit_card") return `${institution} Tarjeta${suffix}`;
  return `${institution} Ahorros${suffix}`;
}
