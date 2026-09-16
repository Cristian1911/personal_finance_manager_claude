import type { TransactionCaptureMethod } from "../types/domain";
import { getCaptureTier } from "./capture-hierarchy";
import { isSpendClass, UNCLASSIFIED } from "./flow-class";

/**
 * "¿Fue del viaje?" — the rule that decides whether a transaction belongs to a
 * viaje/evento (modo) without the user tagging it by hand.
 *
 * Three verdicts:
 *  - `skip`    never trip spend, never proposed: balance moves (transfers,
 *              personal-debt legs), scheduled/recurring charges, instalments of
 *              older purchases, excluded rows, income, out-of-range dates,
 *              rows already tagged or already decided.
 *  - `auto`    user-entered captures (tier 3: form, quick capture, voice,
 *              Telegram) inside the range → tagged silently while the trip is
 *              active.
 *  - `suggest` bank/semi-structured imports (tier 1/2) inside the range → go
 *              to the review tray for a one-tap yes/no.
 *
 * Pure and framework-free so the webapp hook, the tray and (later) mobile all
 * apply the same rule.
 */
export type ModoCandidateTx = {
  id: string;
  direction: "INFLOW" | "OUTFLOW";
  transaction_date: string;
  capture_method: TransactionCaptureMethod;
  /** `flow_class` on insert, `flow_class_effective` when read back from the view. */
  flow_class?: string | null;
  currency_code?: string | null;
  is_excluded?: boolean | null;
  is_recurring?: boolean | null;
  is_subscription?: boolean | null;
  recurrence_group_id?: string | null;
  installment_group_id?: string | null;
  transfer_group_id?: string | null;
  personal_debt_id?: string | null;
  /** True when the row was linked to a recurring occurrence after insert. */
  linkedToOccurrence?: boolean;
  /** Tag ids already on the row. */
  tag_ids?: readonly string[] | null;
  /** True when `modo_tx_reviews` already holds a decision for this row. */
  reviewed?: boolean;
};

export type ModoCandidateRange = {
  date_from: string;
  date_to: string;
  tag_ids?: readonly string[] | null;
};

export type ModoCandidateVerdict = "auto" | "suggest" | "skip";

export type ModoCandidateReason =
  | "transfer"
  | "person"
  | "excluded"
  | "installment"
  | "recurring"
  | "inflow"
  | "not_spend"
  | "out_of_range"
  | "already_tagged"
  | "already_reviewed"
  | "manual_capture"
  | "imported";

export type ModoCandidate = {
  verdict: ModoCandidateVerdict;
  reason: ModoCandidateReason;
  /** Strong hint the row is trip spend: paid in a currency other than home. */
  foreignCurrency: boolean;
};

export function classifyModoCandidate(
  tx: ModoCandidateTx,
  range: ModoCandidateRange,
  opts: { homeCurrency?: string | null } = {},
): ModoCandidate {
  const foreignCurrency =
    !!opts.homeCurrency && !!tx.currency_code && tx.currency_code !== opts.homeCurrency;
  const skip = (reason: ModoCandidateReason): ModoCandidate => ({
    verdict: "skip",
    reason,
    foreignCurrency,
  });

  if (tx.transfer_group_id) return skip("transfer");
  if (tx.personal_debt_id) return skip("person");
  if (tx.is_excluded) return skip("excluded");
  if (tx.installment_group_id) return skip("installment");
  if (tx.is_recurring || tx.is_subscription || tx.recurrence_group_id || tx.linkedToOccurrence) {
    return skip("recurring");
  }
  if (tx.direction !== "OUTFLOW") return skip("inflow");
  // Positive allow-list (never NOT IN): SPEND, CASH_WITHDRAWAL, BANK_FEE. Rows
  // that no write path classified yet (null / UNCLASSIFIED) are OUTFLOW and keep
  // behaving as spend, same as COUNTED_FLOW_CLASSES does for metrics.
  if (tx.flow_class && tx.flow_class !== UNCLASSIFIED && !isSpendClass(tx.flow_class)) {
    return skip("not_spend");
  }
  if (tx.transaction_date < range.date_from || tx.transaction_date > range.date_to) {
    return skip("out_of_range");
  }
  if (range.tag_ids?.length && tx.tag_ids?.some((id) => range.tag_ids!.includes(id))) {
    return skip("already_tagged");
  }
  if (tx.reviewed) return skip("already_reviewed");

  if (getCaptureTier(tx.capture_method) === 3) {
    return { verdict: "auto", reason: "manual_capture", foreignCurrency };
  }
  return { verdict: "suggest", reason: "imported", foreignCurrency };
}

/**
 * Tray order: foreign-currency rows first (almost certainly the trip), then
 * cash withdrawals, then newest first.
 */
export function compareModoCandidates(
  a: { candidate: ModoCandidate; tx: Pick<ModoCandidateTx, "flow_class" | "transaction_date"> },
  b: { candidate: ModoCandidate; tx: Pick<ModoCandidateTx, "flow_class" | "transaction_date"> },
): number {
  const fx = Number(b.candidate.foreignCurrency) - Number(a.candidate.foreignCurrency);
  if (fx !== 0) return fx;
  const cash =
    Number(b.tx.flow_class === "CASH_WITHDRAWAL") - Number(a.tx.flow_class === "CASH_WITHDRAWAL");
  if (cash !== 0) return cash;
  return a.tx.transaction_date < b.tx.transaction_date ? 1 : a.tx.transaction_date > b.tx.transaction_date ? -1 : 0;
}
