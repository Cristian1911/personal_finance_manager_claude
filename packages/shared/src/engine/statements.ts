import { assignStatementOccurrenceIndexes } from "../utils/statement-import";
import { sha256, type HashFn } from "../utils/idempotency";
import { projectMinimumPayoff12mo } from "../utils/cc-projection";
import type { CommandResult, CommandType } from "./types";

/**
 * A bank statement as the PDF parser returns it (services/pdf_parser, the
 * web app's ParseResponse). Only what the import uses.
 */
export interface StatementInput {
  bank: string;
  statement_type: "savings" | "credit_card" | "loan" | "investment";
  account_number: string | null;
  card_last_four: string | null;
  period_from: string | null;
  period_to: string | null;
  currency: string;
  summary: { final_balance: number | null } | null;
  credit_card_metadata: {
    credit_limit: number | null; minimum_payment: number | null; payment_due_date: string | null; total_payment_due: number | null;
    /** E.A., in percent. */
    interest_rate?: number | null;
  } | null;
  loan_metadata?: { remaining_balance: number | null; minimum_payment?: number | null; payment_due_date?: string | null; interest_rate?: number | null } | null;
  transactions: {
    date: string; description: string; amount: number; direction: "INFLOW" | "OUTFLOW"; currency: string;
    installment_current: number | null; installment_total: number | null; original_amount: number | null;
  }[];
}

/** An account as the phone holds it (InicioAccount). */
export interface StatementAccount { id: string; name?: string; accountType: string; mask?: string | null; cutoffDay?: number | null }

/** Which v2 account types a statement can land on. Investments aren't in v2 yet. */
const TYPES: Record<StatementInput["statement_type"], string[]> = {
  savings: ["SAVINGS", "CHECKING"], credit_card: ["CREDIT_CARD"], loan: ["LOAN"], investment: [],
};
const NEW_TYPE: Record<StatementInput["statement_type"], string | null> = {
  savings: "SAVINGS", credit_card: "CREDIT_CARD", loan: "LOAN", investment: null,
};
const KIND_WORD: Record<StatementInput["statement_type"], string> = {
  savings: "ahorros", credit_card: "tarjeta", loan: "préstamo", investment: "inversión",
};

/** One statement of the PDF, as the phone shows it: matched to an account, or what to create. */
export interface StatementPlan {
  index: number;
  bank: string;
  kind: StatementInput["statement_type"];
  last4: string | null;
  period: { from: string | null; to: string | null };
  rows: number;
  currency: string;
  /** The account with that last 4 and kind, when there is exactly one. */
  accountId: string | null;
  /** For "Crear «…»". Null when v2 can't hold it (investments, another currency). */
  suggested: { name: string; accountType: string } | null;
  /** The user's accounts of this kind, to pick one by hand. */
  options: { id: string; name: string }[];
}

/** The user's choice per statement: an existing account, a new one, or skip. */
export type StatementChoice = { index: number; accountId?: string; create?: { name: string }; skip?: boolean };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const currencyOf = (st: StatementInput) => (st.currency || "COP").toUpperCase();
const dayOf = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? Number(iso.slice(8, 10)) : null);
export const statementLastFour = (s: Pick<StatementInput, "card_last_four" | "account_number">) =>
  s.card_last_four?.replace(/\D/g, "").slice(-4) || s.account_number?.replace(/\D/g, "").slice(-4) || null;
const labelOf = (st: StatementInput, last4: string | null) => `${cap(st.bank)} ${KIND_WORD[st.statement_type]}${last4 ? ` ••${last4}` : ""}`.slice(0, 60);

/** Statement → account by kind and last 4 (D1: an unknown one is offered, never created silently). */
export function planStatements(statements: StatementInput[], accounts: StatementAccount[]): StatementPlan[] {
  return statements.map((st, index) => {
    const last4 = statementLastFour(st);
    const fits = accounts.filter((a) => TYPES[st.statement_type].includes(a.accountType));
    const byMask = last4 ? fits.filter((a) => a.mask === last4) : [];
    // ponytail: v2 accounts are COP; a USD section (cards come with one) waits for multi-currency.
    const type = currencyOf(st) === "COP" ? NEW_TYPE[st.statement_type] : null;
    return {
      index, bank: st.bank, kind: st.statement_type, last4,
      period: { from: st.period_from, to: st.period_to },
      rows: st.transactions.length,
      currency: currencyOf(st),
      accountId: type && byMask.length === 1 ? byMask[0].id : null,
      suggested: type ? { name: labelOf(st, last4), accountType: type } : null,
      options: fits.map((a) => ({ id: a.id, name: a.name?.trim() || "Cuenta" })),
    };
  });
}

/** A UUID from text (sha256): the same row of the same statement is always the same movement. */
async function uuidFrom(text: string, hash: HashFn): Promise<string> {
  const h = await hash(text);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export interface StatementStep { type: CommandType; payload: unknown; kind: "account" | "row" | "card" | "anchor" | "statement" }

/** What a statement says, before importing it (v1's "Por pagar" card): to read it and trust it. */
export interface StatementReview {
  /** What you owe (cards: total_payment_due, like v1) or the account's balance at the cut. */
  saldo: number | null;
  minimo: number | null;
  vence: string | null;
  /** E.A., in percent. */
  tasa: number | null;
  /** Paying only the minimum for 12 months: interest paid, what's left; null when it can't be told. */
  intereses12: number | null;
  queda12: number | null;
  /** The minimum doesn't even cover the interest: the debt grows. */
  crece: boolean;
  movimientos: number;
  periodo: { from: string | null; to: string | null };
}

const finalOf = (st: StatementInput) =>
  st.statement_type === "credit_card" ? st.credit_card_metadata?.total_payment_due ?? st.summary?.final_balance ?? null
    : st.statement_type === "loan" ? st.loan_metadata?.remaining_balance ?? st.summary?.final_balance ?? null
      : st.summary?.final_balance ?? null;

export function statementReview(st: StatementInput): StatementReview {
  const meta = st.statement_type === "credit_card" ? st.credit_card_metadata : st.statement_type === "loan" ? st.loan_metadata : null;
  const saldo = finalOf(st);
  const minimo = meta?.minimum_payment ?? null;
  const tasa = meta?.interest_rate ?? null;
  const p = saldo != null && minimo != null && tasa != null ? projectMinimumPayoff12mo(saldo, tasa / 100, minimo) : null;
  return {
    saldo, minimo, vence: meta?.payment_due_date ?? null, tasa,
    intereses12: p && !p.growing ? Math.round(p.interestAccrued) : null,
    queda12: p && !p.growing ? Math.round(p.remainingBalance) : null,
    crece: !!p?.growing,
    movimientos: st.transactions.length,
    periodo: { from: st.period_from, to: st.period_to },
  };
}
export interface StatementWork {
  index: number;
  account: string;
  accountId: string | null;
  created: boolean;
  /** Why nothing is imported (skipped, another currency, not supported yet). */
  nota?: string;
  steps: StatementStep[];
}

/**
 * The commands that import the chosen statements, in order: the account (if
 * new), every row (captureBankTransaction, tier 1, v1's statement key), the
 * card's days and limit, then the balance anchored at the cut. Ids come from
 * the rows, so importing the same PDF again changes nothing. Pure: the phone
 * runs them locally (instant) and sync replays them on the server.
 */
export async function statementCommands(
  userId: string, statements: StatementInput[], plans: StatementPlan[], choices: StatementChoice[], accounts: StatementAccount[],
  hash: HashFn = sha256,
): Promise<StatementWork[]> {
  const work: StatementWork[] = [];
  for (const plan of plans) {
    const st = statements[plan.index];
    const choice = choices.find((c) => c.index === plan.index);
    const label = labelOf(st, plan.last4);
    const none = (nota: string) => work.push({ index: plan.index, account: label, accountId: null, created: false, nota, steps: [] });
    if (plan.currency !== "COP") { none(`${plan.rows} movimientos en ${plan.currency}: Zeta aún no lleva otras monedas.`); continue; }
    if (!plan.suggested) { none("Zeta aún no lleva este tipo de cuenta."); continue; }
    if (choice?.skip) { none("No lo importaste."); continue; }

    const steps: StatementStep[] = [];
    let accountId = choice?.accountId ?? plan.accountId;
    let account = accounts.find((a) => a.id === accountId);
    let created = false;
    if (!accountId && choice?.create) {
      // Same card, same id: importing again (or a retry) finds the account it already made.
      accountId = await uuidFrom(`pdf-account:${userId}:${st.statement_type}:${plan.last4 ?? plan.index}`, hash);
      account = accounts.find((a) => a.id === accountId);
      if (!account) {
        steps.push({ type: "createAccount", kind: "account", payload: {
          accountId, accountType: plan.suggested.accountType, name: choice.create.name.trim().slice(0, 60) || label,
          institutionName: cap(st.bank).slice(0, 60), mask: plan.last4 && /^\d{4}$/.test(plan.last4) ? plan.last4 : null,
          currencyCode: "COP", balance: 0, balanceUnknown: true,
        } });
        account = { id: accountId, name: label, accountType: plan.suggested.accountType, mask: plan.last4, cutoffDay: null };
        created = true;
      }
    }
    if (!accountId || !account) { none("Elige a qué cuenta va."); continue; }
    // Only an account of the statement's kind: a card statement on a savings account would flip every sign.
    if (!TYPES[st.statement_type].includes(account.accountType)) { none("Esa cuenta no es de este tipo."); continue; }

    const occurrences = assignStatementOccurrenceIndexes(st.transactions.map((t, j) => ({
      importKey: `${plan.index}:${j}`, transactionDate: t.date, amount: t.amount, originalAmount: t.original_amount,
      rawDescription: t.description, installmentCurrent: t.installment_current,
    })));
    for (const [j, t] of st.transactions.entries()) {
      if ((t.currency || st.currency || "COP").toUpperCase() !== "COP") continue;
      const identity = `${userId}:${accountId}:${t.date}:${t.amount}:${t.description}:${occurrences[j]}:${t.installment_current ?? ""}`;
      steps.push({ type: "captureBankTransaction", kind: "row", payload: {
        transactionId: await uuidFrom(`pdf-row:${identity}`, hash), accountId, source: "PDF",
        amount: t.amount, direction: t.direction, currencyCode: "COP", date: t.date,
        rawLine: t.description.slice(0, 1000), description: t.description.trim().slice(0, 200) || "Movimiento",
        occurrence: occurrences[j], originalAmount: t.original_amount, installmentCurrent: t.installment_current, installmentTotal: t.installment_total,
      } });
    }
    // A card learns its cut and payment days (and limit) from its first statement: the card bill needs them.
    if (account.accountType === "CREDIT_CARD" && account.cutoffDay == null) {
      const cutoffDay = dayOf(st.period_to);
      const paymentDay = dayOf(st.credit_card_metadata?.payment_due_date);
      if (cutoffDay) {
        steps.push({ type: "editAccount", kind: "card", payload: {
          accountId, cutoffDay, ...(paymentDay ? { paymentDay } : {}),
          ...(st.credit_card_metadata?.credit_limit ? { creditLimit: st.credit_card_metadata.credit_limit } : {}),
        } });
      }
    }
    // What the statement said (D24: the card's minimum is what Disponible counts), then the balance at its cut.
    const review = statementReview(st);
    if (st.statement_type !== "savings" && (review.minimo != null || review.vence)) {
      steps.push({ type: "recordStatement", kind: "statement", payload: {
        id: await uuidFrom(`statement:${accountId}:COP:${st.period_from ?? ""}:${st.period_to ?? ""}`, hash), accountId,
        periodFrom: st.period_from, periodTo: st.period_to, finalBalance: st.summary?.final_balance ?? null,
        totalPaymentDue: review.saldo, minimumPayment: review.minimo, paymentDueDate: review.vence, interestRate: review.tasa,
        currencyCode: "COP", transactionCount: st.transactions.length,
      } });
    }
    const finalBalance = finalOf(st);
    if (finalBalance != null && st.period_to) {
      steps.push({ type: "anchorStatementBalance", kind: "anchor", payload: { accountId, finalBalance, asOf: st.period_to } });
    }
    work.push({ index: plan.index, account: account.name?.trim() || label, accountId, created, steps });
  }
  return work;
}

export interface StatementResult {
  index: number; account: string; created: boolean; nuevos: number; yaEstaban: number; paraRevisar: number;
  errores: number; balance: number | null; nota?: string;
  /** The statement's minimum and due date, now counted in Disponible. */
  minimo?: number | null; vence?: string | null;
  /** The card learned its days from this statement. */
  corte?: number | null; pago?: number | null;
}

/** Counts a statement's command results for the summary ("3 nuevos · 2 ya estaban · 1 para revisar"). */
export function statementResult(w: StatementWork, results: CommandResult[]): StatementResult {
  const r: StatementResult = { index: w.index, account: w.account, created: w.created, nuevos: 0, yaEstaban: 0, paraRevisar: 0, errores: 0, balance: null, nota: w.nota };
  w.steps.forEach((step, i) => {
    const res = results[i];
    if (!res) return;
    const p = step.payload as Record<string, unknown>;
    if (step.kind === "statement" && res.status === "applied") {
      r.minimo = p.minimumPayment as number | null;
      r.vence = p.paymentDueDate as string | null;
      return;
    }
    if (step.kind === "card" && res.status === "applied") {
      r.corte = (p.cutoffDay as number | undefined) ?? null;
      r.pago = (p.paymentDay as number | undefined) ?? null;
      return;
    }
    if (step.kind === "anchor") {
      const d = res.data as { balance: number; kept?: boolean } | undefined;
      if (res.status === "applied" && d && !d.kept) r.balance = d.balance;
      return;
    }
    if (step.kind !== "row") return;
    if (res.status === "rejected") r.errores++;
    else if (res.status === "duplicate" || res.replayed) r.yaEstaban++;
    else if ((res.data as { heldFor?: string } | undefined)?.heldFor) r.paraRevisar++;
    else r.nuevos++;
  });
  return r;
}
