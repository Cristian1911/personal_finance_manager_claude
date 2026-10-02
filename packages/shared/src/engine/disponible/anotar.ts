import { isDebtAccountType } from "../../utils/account-balance";
import { defaultCountsInDisponible } from "../commands/set-account-counts-in-disponible";
import { calendarDayDiff, occurrenceAmountMatches, OCCURRENCE_AUTO_LINK_DAY_WINDOW } from "../../utils/occurrence-matching";
import { parseQuickCaptureText } from "../../utils/quick-capture";
import type { InicioAccount } from "./inicio";
import { buildInicio } from "./inicio";
import { isLiveTransaction, type StoredTransaction } from "./movements";
import { diffDays, type IsoDate } from "./dates";
import { movementTime, readableName, signedPesos } from "./view";
import { colombiaTime, relativeDay } from "./widgets";
import { formatPesos } from "./verdict";

export interface AnotarDraft {
  kind: "gasto" | "ingreso" | "entre";
  amount: number;
  accountId: string;
  /** Entre cuentas: where the money goes. */
  toAccountId?: string | null;
  date?: string;
}

export interface AnotarPreview {
  line: string;
  /** "bad" when the spend takes you below zero. */
  tone: "neutral" | "bad";
}

type InicioInput = Parameters<typeof buildInicio>[0];

/**
 * Anotar's effect line (S8-9): the same Inicio computation with the draft
 * added, so the preview and the number after Guardar never disagree.
 */
export function anotarPreview(input: InicioInput, draft: AnotarDraft): AnotarPreview | null {
  if (!(draft.amount > 0)) return null;
  const before = buildInicio(input);
  if (before.status !== "ready") return null;
  const from = input.accounts.find((a) => a.id === draft.accountId);
  if (!from) return null;
  const name = (a: typeof from) => a.name?.trim() || "Esa cuenta";
  const counts = (a: typeof from) => !isDebtAccountType(a.accountType) && (a.countsInDisponible ?? defaultCountsInDisponible(a.accountType));
  // Money out of an account you have can't go below zero without saying so
  // (not when its balance was never given: $0 there means "no sé").
  const out = draft.kind !== "ingreso" && !isDebtAccountType(from.accountType);
  if (out && from.currentBalance !== 0 && draft.amount > from.currentBalance) {
    const left = formatPesos(from.currentBalance - draft.amount).replace("-", "−");
    return { line: `${name(from)} tiene ${formatPesos(from.currentBalance)}: quedaría en ${left}.`, tone: "bad" };
  }
  const date = draft.date ?? input.today;
  const leg = (id: string, accountId: string, direction: "INFLOW" | "OUTFLOW", flowClass: string, transferGroupId?: string): StoredTransaction => ({
    id, accountId, date, amount: draft.amount, direction, currencyCode: "COP", flowClass, createdAt: input.now,
    ...(transferGroupId ? { transferGroupId } : {}),
  });

  let extra: StoredTransaction[];
  if (draft.kind === "entre") {
    const to = input.accounts.find((a) => a.id === draft.toAccountId);
    if (!to || to.id === from.id) return null;
    const pay = isDebtAccountType(to.accountType);
    extra = [
      leg("preview-out", from.id, "OUTFLOW", pay ? "DEBT_PAYMENT" : "SELF_TRANSFER", "preview"),
      leg("preview-in", to.id, "INFLOW", pay ? "DEBT_CREDIT" : "SELF_TRANSFER", "preview"),
    ];
    const after = buildInicio({ ...input, transactions: [...input.transactions, ...extra] });
    if (after.status !== "ready") return null;
    const level = formatPesos(after.result.disponible);
    const tone = after.result.disponible < 0 ? "bad" as const : "neutral" as const;
    if (pay) return { line: `Pagas ${name(to)}: tu Disponible baja a ${level}.`, tone };
    if (counts(from) && counts(to)) return { line: "Las dos cuentan para tu Disponible: no cambia.", tone: "neutral" };
    if (!counts(from) && !counts(to)) return { line: "Ninguna de las dos cuenta para tu Disponible: no cambia.", tone: "neutral" };
    if (counts(from)) return { line: `${name(to)} no cuenta para tu Disponible: baja a ${level}.`, tone };
    return { line: `${name(from)} no cuenta para tu Disponible: sube a ${level}.`, tone: "neutral" };
  }

  if (draft.kind === "gasto" && isDebtAccountType(from.accountType)) {
    return { line: `Va a ${name(from)}: tu Disponible no cambia hoy, lo pagas con la factura.`, tone: "neutral" };
  }
  if (!counts(from)) return { line: `${name(from)} no cuenta para tu Disponible: no cambia.`, tone: "neutral" };
  const income = draft.kind === "ingreso";
  extra = [leg("preview", from.id, income ? "INFLOW" : "OUTFLOW", income ? "INCOME" : "SPEND")];
  // Bill detection, as Guardar will do it: a spend that matches a pending fixed
  // payment pays it, so it doesn't lower Disponible a second time.
  // Same choice as Guardar's detection: that account (if the bill has one), the closest date.
  const bill = income ? undefined : before.bills
    .filter((b) => b.kind === "fijo" && b.status === "pending" && (!b.accountId || b.accountId === from.id)
      && Math.abs(calendarDayDiff(date, b.dueDate)) <= OCCURRENCE_AUTO_LINK_DAY_WINDOW
      && occurrenceAmountMatches(b.amount, draft.amount, false))
    .sort((a, b) => Math.abs(calendarDayDiff(date, a.dueDate)) - Math.abs(calendarDayDiff(date, b.dueDate)))[0];
  const occurrences = bill
    ? [...(input.occurrences ?? []), { templateId: bill.templateId!, date: bill.dueDate, expectedAmount: bill.amount, status: "paid" as const, transactionId: "preview", linkedManually: false }]
    : input.occurrences;
  const after = buildInicio({ ...input, occurrences, transactions: [...input.transactions, ...extra] });
  if (after.status !== "ready") return null;
  if (bill && Math.abs(after.result.disponible - before.result.disponible) < 0.005) {
    return { line: `Pagas ${bill.title}: ya estaba apartado, tu Disponible no cambia.`, tone: "neutral" };
  }
  if (income) return { line: `Tu Disponible sube a ${formatPesos(after.result.disponible)}`, tone: "neutral" };
  return {
    line: `Te quedan ${formatPesos(after.result.disponible)} · ${after.view.perDay}`,
    tone: after.result.disponible < 0 ? "bad" : "neutral",
  };
}

export interface Dictado {
  kind: "gasto" | "ingreso";
  amount: number | null;
  what: string;
  accountId: string | null;
}

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Dictar (S8-9): what the person said → Anotar's fields, with v1's offline
 * parser. An account named in the sentence ("en efectivo", "con la tarjeta
 * nu") is picked, longest name first. What can't be read goes to En qué.
 */
export function dictado(text: string, accounts: InicioAccount[], now: Date = new Date(), kind: "gasto" | "ingreso" | "entre" = "gasto"): Dictado {
  const said = fold(text);
  const named = [...accounts]
    .filter((a) => a.name?.trim())
    .sort((a, b) => (b.name!.length - a.name!.length))
    .find((a) => said.includes(fold(a.name!.trim())));
  let r = parseQuickCaptureText(text, { now });
  // People rarely say the verb ("almuerzo 45 mil"): the kind already chosen in Anotar says it.
  // (account_id is always "missing" there: the parser never picks one.)
  if (!r.success && r.missing_fields.includes("direction") && !r.missing_fields.includes("amount")) {
    r = parseQuickCaptureText(`${kind === "ingreso" ? "recibí" : "gasté"} ${text}`, { now });
  }
  if (!r.success) return { kind: "gasto", amount: null, what: text.trim(), accountId: named?.id ?? null };
  // En qué without the verb we added and without the account it named ("en efectivo").
  let what = r.data.description.replace(/^(?:gast[eé]|recib[ií])\s+/i, "");
  if (named) {
    const name = fold(named.name!.trim()).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    what = what.replace(new RegExp(`\\s*(?:\\b(?:en|con|de|del|desde)\\s+)?(?:\\b(?:la|el|mi)\\s+)?${name}\\b`, "i"), "");
  }
  what = what.trim();
  return {
    kind: r.data.direction === "INFLOW" ? "ingreso" : "gasto",
    amount: r.data.amount > 0 ? r.data.amount : null,
    what: what ? what[0].toUpperCase() + what.slice(1) : "",
    accountId: named?.id ?? null,
  };
}

/**
 * "Ya está": a movement of the same amount, same account and direction, a day
 * around the one you're anotando (the bank's email that already came, or the
 * same thing anotado twice). Asked, never blocked: two equal coffees are real.
 */
export function yaEsta(
  transactions: StoredTransaction[], today: IsoDate,
  draft: Pick<AnotarDraft, "kind" | "amount" | "accountId" | "date">,
): string | null {
  if (draft.kind === "entre" || !(draft.amount > 0)) return null;
  const date = draft.date ?? today;
  const direction = draft.kind === "ingreso" ? "INFLOW" : "OUTFLOW";
  const same = transactions
    .filter((t) => isLiveTransaction(t) && t.accountId === draft.accountId && t.direction === direction
      && Math.abs(t.amount - draft.amount) < 0.005 && Math.abs(diffDays(t.date, date)) <= 1)
    .sort((a, b) => b.date.localeCompare(a.date) || (movementTime(b, colombiaTime) ?? "").localeCompare(movementTime(a, colombiaTime) ?? ""))[0];
  if (!same) return null;
  const when = [relativeDay(today, same.date).toLowerCase(), movementTime(same, colombiaTime)].filter(Boolean).join(" ");
  return `Ya está: ${readableName(same.description?.trim() || "un movimiento")} ${signedPesos(direction === "OUTFLOW" ? -same.amount : same.amount)} · ${when}. ¿Es otro?`;
}
