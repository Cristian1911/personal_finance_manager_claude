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
  /** clean_description: what Últimos movimientos shows. */
  description?: string | null;
  /** The user's note (Detalle). */
  notes?: string | null;
  categoryId?: string | null;
  destinatarioId?: string | null;
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
  // A bank row (statement, email) happened on its date, not when it was imported: without a
  // time, it's placed by date. Only what you anotaste happened when you captured it.
  if (t.captureMethod && t.captureMethod !== "MANUAL_FORM" && t.captureMethod !== "TEXT_QUICK_CAPTURE") return undefined;
  return t.createdAt ? new Date(t.createdAt).toISOString() : undefined;
}

/** Rows that count at all: not excluded, not merged into a duplicate, not cancelled. */
export function isLiveTransaction(t: StoredTransaction): boolean {
  return !t.isExcluded && !t.reconciledIntoTransactionId && t.status !== "CANCELLED";
}

export function toDisponibleMovements(input: {
  transactions: StoredTransaction[];
  accounts: { id: string; accountType: string }[];
  occurrenceLinks?: OccurrenceLink[];
  baseCurrency?: string;
}): DisponibleMovement[] {
  const base = input.baseCurrency ?? "COP";
  const links = new Map((input.occurrenceLinks ?? []).map((l) => [l.transactionId, l]));

  const live = input.transactions.filter(isLiveTransaction);
  // With a single card or loan, an unnamed debt payment can only be for it.
  const debts = input.accounts.filter((a) => a.accountType === "CREDIT_CARD" || a.accountType === "LOAN");
  const onlyDebt = debts.length === 1 ? debts[0].id : undefined;
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

    const counterpart = counterpartOf(t) ?? (t.flowClass === "DEBT_PAYMENT" && t.direction === "OUTFLOW" ? onlyDebt : undefined);
    Object.assign(m, classify(t, links.get(t.id), counterpart));
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
  if (t.personalDebtId && t.pdRole) {
    // The debt's direction follows from role + flow (inverse of inferPersonalDebtRole),
    // so a caller that didn't join personal_debts still gets it right.
    const lent = t.personalDebtDirection
      ? t.personalDebtDirection === "lent"
      : (t.pdRole === "origin") !== inflow;
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
      // Card/loan unknown: computeDisponible applies it to the open card/loan bills first.
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
}

/**
 * Occurrences (the source of truth for recurring obligations) → the cycle's
 * expected incomes and bills. Pass the same transactions given to
 * toDisponibleMovements: a paid occurrence links its movement (following a
 * merged duplicate to the row that survived); when that movement isn't among
 * the live ones, the bill counts as already paid and the income as received.
 * Skipped occurrences are gone.
 */
export function occurrencesToCycleInputs(input: {
  occurrences: StoredOccurrence[];
  templates: StoredTemplate[];
  transactions: StoredTransaction[];
}): { expectedIncomes: ExpectedIncome[]; obligations: Obligation[]; occurrenceLinks: OccurrenceLink[] } {
  const templates = new Map(input.templates.map((t) => [t.id, t]));
  const byId = new Map(input.transactions.map((t) => [t.id, t]));
  /** The live row a link points at, after following merges (bounded, in case of a cycle). */
  const liveRow = (id: string | null) => {
    let t = id ? byId.get(id) : undefined;
    for (let hops = 0; t?.reconciledIntoTransactionId && hops < 5; hops++) t = byId.get(t.reconciledIntoTransactionId);
    return t && isLiveTransaction(t) ? t : undefined;
  };

  const expectedIncomes: ExpectedIncome[] = [];
  const obligations: Obligation[] = [];
  const occurrenceLinks: OccurrenceLink[] = [];
  const linked = new Set<string>();

  const sorted = [...input.occurrences].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  for (const o of sorted) {
    const t = templates.get(o.templateId);
    if (!t || o.status === "skipped") continue;
    const isIncome = t.direction === "INFLOW";
    const row = o.status === "paid" ? liveRow(o.transactionId) : undefined;
    // One movement can carry one link: when it paid several occurrences, the
    // first holds the link and the rest count as paid (its money is counted once).
    const linkedHere = !!row && !linked.has(row.id);
    if (row && linkedHere) {
      linked.add(row.id);
      occurrenceLinks.push({ transactionId: row.id, occurrenceId: o.id, isIncome });
    }
    const paidElsewhere = o.status === "paid" && !linkedHere;

    if (isIncome) {
      expectedIncomes.push({
        id: o.id, label: t.label, amount: o.amount, expectedDate: o.date,
        ...(paidElsewhere ? { received: true } : {}),
      });
      continue;
    }
    obligations.push({
      id: o.id, kind: "bill", label: t.label, dueDate: o.date, amount: o.amount,
      ...(paidElsewhere ? { paidBefore: o.amount } : {}),
    });
  }
  return { expectedIncomes, obligations, occurrenceLinks };
}
