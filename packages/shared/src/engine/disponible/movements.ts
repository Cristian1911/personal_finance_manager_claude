import type { IsoDate } from "./dates";
import type { DisponibleMovement, ExpectedIncome, Obligation } from "./disponible";

/**
 * Stored transactions → the movements computeDisponible reads. Pure: the
 * caller passes the rows (phone SQLite or the Supabase `transactions` view)
 * and the links it already knows. Classification builds on `flow_class`
 * (utils/flow-class.ts), never on the category.
 */

/** The fields of a `transactions` row this needs (camelCase). */
export interface StoredTransaction {
  id: string;
  accountId: string;
  date: IsoDate;
  /** Colombian wall time "HH:MM[:SS]" (transaction_time), when known. */
  time?: string | null;
  createdAt?: string | null;
  /** As stored: positive, in `currencyCode`. */
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  currencyCode: string;
  amountInBaseCurrency?: number | null;
  /** The effective class: flow_class_override ?? flow_class. */
  flowClass: string | null;
  captureMethod?: string | null;
  status?: string | null;
  isExcluded?: boolean | null;
  /** Merged into another row (a duplicate): that row counts instead. */
  reconciledIntoTransactionId?: string | null;
  transferGroupId?: string | null;
  /** The other own account when the caller resolved it (e.g. matchOwnAccount). */
  counterpartAccountId?: string | null;
  personalDebtId?: string | null;
  pdRole?: "origin" | "repayment" | null;
  /** From the linked personal_debts row. */
  personalDebtDirection?: "lent" | "borrowed" | null;
}

/** A transaction that paid (or brought) a recurring occurrence. */
export interface OccurrenceLink {
  transactionId: string;
  occurrenceId: string;
  /** The occurrence's template is income (salary), not a bill. */
  isIncome: boolean;
}

/** Colombia has no daylight saving: wall time is always UTC−5. */
const COLOMBIA_OFFSET = "-05:00";
/** Tier-1 captures carry the bank's exact COP amount. */
const EXACT_CAPTURE = new Set(["PDF_IMPORT", "EMAIL_PDF_IMPORT"]);

function captureInstant(t: StoredTransaction): string | undefined {
  if (t.time && /^\d{2}:\d{2}(:\d{2})?$/.test(t.time)) {
    const hhmmss = t.time.length === 5 ? `${t.time}:00` : t.time;
    const d = new Date(`${t.date}T${hhmmss}${COLOMBIA_OFFSET}`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return t.createdAt ? new Date(t.createdAt).toISOString() : undefined;
}

export function toDisponibleMovements(input: {
  transactions: StoredTransaction[];
  accounts: { id: string; accountType: string }[];
  occurrenceLinks?: OccurrenceLink[];
  baseCurrency?: string;
}): DisponibleMovement[] {
  const base = input.baseCurrency ?? "COP";
  const links = new Map((input.occurrenceLinks ?? []).map((l) => [l.transactionId, l]));

  const live = input.transactions.filter(
    (t) => !t.isExcluded && !t.reconciledIntoTransactionId && t.status !== "CANCELLED",
  );
  // Each transfer leg learns the other leg's account.
  const legs = new Map<string, StoredTransaction[]>();
  for (const t of live) {
    if (t.transferGroupId) legs.set(t.transferGroupId, [...(legs.get(t.transferGroupId) ?? []), t]);
  }
  const counterpartOf = (t: StoredTransaction) =>
    t.counterpartAccountId
    ?? (t.transferGroupId ? legs.get(t.transferGroupId)?.find((o) => o.id !== t.id)?.accountId : undefined)
    ?? undefined;

  return live.map((t) => {
    const foreign = t.currencyCode !== base;
    const m: DisponibleMovement = {
      id: t.id,
      accountId: t.accountId,
      date: t.date,
      amount: Math.abs(foreign ? t.amountInBaseCurrency ?? t.amount : t.amount),
      direction: t.direction,
      kind: "ignored",
    };
    const at = captureInstant(t);
    if (at) m.at = at;
    if (foreign && !EXACT_CAPTURE.has(t.captureMethod ?? "")) m.approx = true;

    Object.assign(m, classify(t, links.get(t.id), counterpartOf(t)));
    return m;
  });
}

function classify(
  t: StoredTransaction,
  link: OccurrenceLink | undefined,
  counterpart: string | undefined,
): Pick<DisponibleMovement, "kind"> & Partial<DisponibleMovement> {
  const inflow = t.direction === "INFLOW";

  // 1. A recurring occurrence it paid (or brought, for salary).
  if (link) {
    if (link.isIncome && inflow) return { kind: "salary", expectedIncomeId: link.occurrenceId };
    if (!link.isIncome && !inflow) return { kind: "payment", obligationId: link.occurrenceId };
  }

  // 2. People (D8): lent → spend, repaid to you → Te pagaron,
  //    you pay back → settles that Tú debes, borrowed → money in.
  if (t.personalDebtId && t.pdRole && t.personalDebtDirection) {
    const lent = t.personalDebtDirection === "lent";
    if (t.pdRole === "repayment") {
      if (lent && inflow) return { kind: "repayment" };
      if (!lent && !inflow) return { kind: "payment", obligationId: t.personalDebtId };
    } else {
      if (lent && !inflow) return { kind: "spend" };
      if (!lent && inflow) return { kind: "income" };
    }
  }

  // 3. Between own accounts: computeDisponible decides by which ones count.
  if (counterpart) return { kind: "transfer", counterpartAccountId: counterpart };

  // 4. Everything else by flow class.
  switch (t.flowClass) {
    case "SPEND":
      return { kind: inflow ? "refund" : "spend" };
    case "CASH_WITHDRAWAL": // S3-1: counts when withdrawn
    case "BANK_FEE":
      return { kind: inflow ? "refund" : "spend" };
    case "INCOME":
      return { kind: inflow ? "income" : "spend" };
    case "DEBT_PAYMENT":
      // Card/loan unknown: an extra payment until a leg or a match says which.
      return { kind: inflow ? "ignored" : "payment" };
    case "DEBT_CREDIT":
      // Lands on the card/loan itself, which never counts.
      return { kind: "ignored" };
    case "DEBT_DRAWDOWN":
    case "SELF_TRANSFER":
      // The other account isn't known: money in or out of the counted set.
      return { kind: "transfer" };
    default:
      // Unclassified: like the web, outflow is spend and inflow is income.
      return { kind: inflow ? "income" : "spend" };
  }
}

// ── Recurring occurrences → expected incomes and bills ───────────────────

export interface StoredOccurrence {
  id: string;
  templateId: string;
  date: IsoDate;
  amount: number;
  status: "pending" | "paid" | "skipped";
  transactionId: string | null;
}

export interface StoredTemplate {
  id: string;
  direction: "INFLOW" | "OUTFLOW";
  label: string;
  /** The account it's paid from (or into). */
  accountId?: string;
}

/**
 * Occurrences (the source of truth for recurring obligations) → the cycle's
 * expected incomes and bills. Skipped occurrences are gone. A paid occurrence
 * links its movement; when that movement isn't among the ones being passed
 * (paid in an earlier window), it counts as already paid.
 */
export function occurrencesToCycleInputs(input: {
  occurrences: StoredOccurrence[];
  templates: StoredTemplate[];
  /** Ids of the transactions that will be passed to toDisponibleMovements. */
  transactionIds?: ReadonlySet<string>;
}): { expectedIncomes: ExpectedIncome[]; obligations: Obligation[]; occurrenceLinks: OccurrenceLink[] } {
  const templates = new Map(input.templates.map((t) => [t.id, t]));
  const expectedIncomes: ExpectedIncome[] = [];
  const obligations: Obligation[] = [];
  const occurrenceLinks: OccurrenceLink[] = [];

  for (const o of input.occurrences) {
    const t = templates.get(o.templateId);
    if (!t || o.status === "skipped") continue;
    const isIncome = t.direction === "INFLOW";
    if (o.transactionId) occurrenceLinks.push({ transactionId: o.transactionId, occurrenceId: o.id, isIncome });
    const paidElsewhere = o.status === "paid" && !(o.transactionId && input.transactionIds?.has(o.transactionId));

    if (isIncome) {
      // Income received outside this window is already in the balance.
      if (!paidElsewhere) expectedIncomes.push({ id: o.id, label: t.label, amount: o.amount, expectedDate: o.date });
      continue;
    }
    obligations.push({
      id: o.id, kind: "bill", label: t.label, dueDate: o.date, amount: o.amount,
      ...(paidElsewhere ? { paidBefore: o.amount } : {}),
      ...(t.accountId ? { accountId: t.accountId } : {}),
    });
  }
  return { expectedIncomes, obligations, occurrenceLinks };
}
