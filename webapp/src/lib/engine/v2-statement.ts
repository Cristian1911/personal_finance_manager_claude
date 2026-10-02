import "server-only";
import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { applyCommand, assignStatementOccurrenceIndexes, createSqlStorage, toDialect, type CommandResult, type CommandType, type SqlDriver } from "@zeta/shared";
import type { ParsedStatement } from "@/types/import";
import { createUserScopedPgDriver } from "./pg-driver";

/** Which v2 account types a statement can land on. Investments aren't in v2 yet. */
const TYPES: Record<ParsedStatement["statement_type"], string[]> = {
  savings: ["SAVINGS", "CHECKING"], credit_card: ["CREDIT_CARD"], loan: ["LOAN"], investment: [],
};
const NEW_TYPE: Record<ParsedStatement["statement_type"], string | null> = {
  savings: "SAVINGS", credit_card: "CREDIT_CARD", loan: "LOAN", investment: null,
};
const KIND_WORD: Record<ParsedStatement["statement_type"], string> = {
  savings: "ahorros", credit_card: "tarjeta", loan: "préstamo", investment: "inversión",
};

function uuidFrom(text: string): string {
  const h = createHash("sha256").update(text).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

export const lastFour = (s: Pick<ParsedStatement, "card_last_four" | "account_number">) =>
  s.card_last_four?.replace(/\D/g, "").slice(-4) || s.account_number?.replace(/\D/g, "").slice(-4) || null;

interface Account { id: string; name: string; account_type: string; mask: string | null; cutoff_day: number | null; payment_day: number | null; currency_code: string }

/** One statement of the PDF, as the phone shows it: matched to an account, or what to create. */
export interface StatementPlan {
  index: number;
  bank: string;
  kind: ParsedStatement["statement_type"];
  last4: string | null;
  period: { from: string | null; to: string | null };
  rows: number;
  currency: string;
  /** The account with that last 4 and kind, when there is exactly one. */
  accountId: string | null;
  /** For "Crear «…»". Null when v2 can't hold this kind (investments). */
  suggested: { name: string; accountType: string } | null;
  /** The user's accounts of this kind, to pick one by hand. */
  options: { id: string; name: string }[];
}

/** The user's choice per statement: an existing account, a new one, or skip. */
export type StatementChoice = { index: number; accountId?: string; create?: { accountId: string; name: string }; skip?: boolean };

export interface StatementResult {
  index: number;
  account: string;
  created: boolean;
  nuevos: number;
  yaEstaban: number;
  paraRevisar: number;
  otraMoneda: number;
  errores: number;
  balance: number | null;
  /** Why nothing was imported (skipped, another currency, not supported yet). */
  nota?: string;
}

async function accountsOf(driver: SqlDriver, userId: string): Promise<Account[]> {
  return driver.query<Account>(toDialect(
    "SELECT id, name, account_type, mask, cutoff_day, payment_day, currency_code FROM accounts WHERE user_id = ? AND is_active = ?", "postgres"),
  [userId, true]);
}

/** Statement → account by kind and last 4 (D1: an unknown one is offered, never created silently). */
export async function planStatements(pool: Pool, userId: string, statements: ParsedStatement[]): Promise<StatementPlan[]> {
  const accounts = await accountsOf(createUserScopedPgDriver(pool, userId), userId);
  return statements.map((st, index) => {
    const last4 = lastFour(st);
    const fits = accounts.filter((a) => TYPES[st.statement_type].includes(a.account_type));
    const byMask = last4 ? fits.filter((a) => a.mask === last4) : [];
    // ponytail: v2 accounts are COP; a USD section (cards come with one) waits for multi-currency.
    const type = currencyOf(st) === "COP" ? NEW_TYPE[st.statement_type] : null;
    return {
      index, bank: st.bank, kind: st.statement_type, last4,
      period: { from: st.period_from, to: st.period_to },
      rows: st.transactions.length,
      currency: currencyOf(st),
      accountId: type && byMask.length === 1 ? byMask[0].id : null,
      suggested: type ? { name: `${cap(st.bank)} ${KIND_WORD[st.statement_type]}${last4 ? ` ••${last4}` : ""}`.slice(0, 60), accountType: type } : null,
      options: fits.map((a) => ({ id: a.id, name: a.name })),
    };
  });
}

const currencyOf = (st: ParsedStatement) => (st.currency || "COP").toUpperCase();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
const dayOf = (iso: string | null | undefined) => (iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? Number(iso.slice(8, 10)) : null);

/**
 * Imports the statements as commands (S9-3): each row a captureBankTransaction
 * (tier 1, v1's statement key; merges with emails and what you anotaste), then
 * the account anchored to the statement's final balance at its cut. Ids come
 * from the rows, so uploading the same PDF again changes nothing.
 */
export async function importStatements(
  pool: Pool, userId: string, statements: ParsedStatement[], choices: StatementChoice[], now = new Date(),
): Promise<StatementResult[]> {
  let tick = 0;
  const plans = await planStatements(pool, userId, statements);
  const results: StatementResult[] = [];

  // One transaction per statement: all of it or none, and one connection, role and lock for all its rows
  // (per-command transactions cost ~20 round trips each to the database).
  for (const plan of plans) await createUserScopedPgDriver(pool, userId).transaction(async (tx) => {
    const storage = createSqlStorage(tx);
    // Each command a distinct, increasing client time (field versions order by it).
    const run = (type: CommandType, id: string, payload: unknown): Promise<CommandResult> =>
      applyCommand(storage, { id, type, userId, deviceId: "pdf", clientTs: new Date(now.getTime() + tick++).toISOString(), payload });
    const st = statements[plan.index];
    const choice = choices.find((c) => c.index === plan.index);
    const label = `${cap(st.bank)} ${KIND_WORD[st.statement_type]}${plan.last4 ? ` ••${plan.last4}` : ""}`;
    const nothing = (nota: string) => results.push({ index: plan.index, account: label, created: false, nuevos: 0, yaEstaban: 0, paraRevisar: 0, otraMoneda: 0, errores: 0, balance: null, nota });
    if (plan.currency !== "COP") return void nothing(`${plan.rows} movimientos en ${plan.currency}: Zeta aún no lleva otras monedas.`);
    if (!plan.suggested) return void nothing("Zeta aún no lleva este tipo de cuenta.");
    if (choice?.skip) return void nothing("No lo importaste.");
    let accountId = choice?.accountId ?? plan.accountId;
    let created = false;
    if (!accountId && choice?.create) {
      // Same card, same id: a retry after a timeout finds the account it already made instead of a second one.
      const id = plan.last4 ? uuidFrom(`pdf-account:${userId}:${st.statement_type}:${plan.last4}`) : choice.create.accountId;
      const r = await run("createAccount", uuidFrom(`pdf-create:${userId}:${id}`), {
        accountId: id, accountType: plan.suggested.accountType, name: choice.create.name.trim().slice(0, 60) || label,
        institutionName: cap(st.bank).slice(0, 60), mask: plan.last4 && /^\d{4}$/.test(plan.last4) ? plan.last4 : null,
        currencyCode: "COP", balance: 0, balanceUnknown: true,
      });
      if (r.status !== "applied" && r.status !== "duplicate") return void nothing("No se pudo crear la cuenta.");
      accountId = id;
      created = r.status === "applied" && !r.replayed;
    }
    if (!accountId) return void nothing("Elige a qué cuenta va.");
    const account = (await accountsOf(tx, userId)).find((a) => a.id === accountId);
    // Only an account of the statement's kind: a card statement on a savings account would flip every sign.
    if (!account || !TYPES[st.statement_type].includes(account.account_type)) return void nothing("Esa cuenta no es de este tipo.");

    const result: StatementResult = { index: plan.index, account: account.name, created, nuevos: 0, yaEstaban: 0, paraRevisar: 0, otraMoneda: 0, errores: 0, balance: null };
    const occurrences = assignStatementOccurrenceIndexes(st.transactions.map((t, j) => ({
      importKey: `${plan.index}:${j}`, transactionDate: t.date, amount: t.amount, originalAmount: t.original_amount,
      rawDescription: t.description, installmentCurrent: t.installment_current,
    })));
    for (const [j, t] of st.transactions.entries()) {
      // ponytail: v2 accounts are COP; a USD section of a card statement waits for multi-currency.
      if ((t.currency || st.currency || "COP").toUpperCase() !== account.currency_code) { result.otraMoneda++; continue; }
      const identity = `${userId}:${accountId}:${t.date}:${t.amount}:${t.description}:${occurrences[j]}:${t.installment_current ?? ""}`;
      const r = await run("captureBankTransaction", uuidFrom(`pdf-command:${identity}`), {
        transactionId: uuidFrom(`pdf-row:${identity}`), accountId, source: "PDF",
        amount: t.amount, direction: t.direction, currencyCode: account.currency_code, date: t.date,
        rawLine: t.description.slice(0, 1000), description: t.description.trim().slice(0, 200) || "Movimiento",
        occurrence: occurrences[j], originalAmount: t.original_amount, installmentCurrent: t.installment_current, installmentTotal: t.installment_total,
      });
      if (r.status === "rejected") result.errores++;
      else if (r.status === "duplicate" || r.replayed) result.yaEstaban++;
      else if ((r.data as { heldFor?: string } | undefined)?.heldFor) result.paraRevisar++;
      else if (r.status === "applied") result.nuevos++;
      else result.errores++;
    }

    // A card learns its cut and payment days from its first statement (the card bill needs them).
    if (account.account_type === "CREDIT_CARD" && account.cutoff_day == null) {
      const cutoffDay = dayOf(st.period_to);
      const paymentDay = dayOf(st.credit_card_metadata?.payment_due_date);
      if (cutoffDay) {
        await run("editAccount", uuidFrom(`pdf-days:${userId}:${accountId}`), {
          accountId, cutoffDay, ...(paymentDay ? { paymentDay } : {}),
          ...(st.credit_card_metadata?.credit_limit ? { creditLimit: st.credit_card_metadata.credit_limit } : {}),
        });
      }
    }
    const finalBalance = st.statement_type === "loan" ? st.loan_metadata?.remaining_balance ?? st.summary?.final_balance : st.summary?.final_balance;
    if (finalBalance != null && st.period_to) {
      const r = await run("anchorStatementBalance", uuidFrom(`pdf-anchor:${userId}:${accountId}:${st.period_to}:${finalBalance}`), {
        accountId, finalBalance, asOf: st.period_to,
      });
      const d = r.data as { balance: number; kept?: boolean } | undefined;
      if (r.status === "applied" && d && !d.kept) result.balance = d.balance;
    }
    results.push(result);
  });
  return results;
}
