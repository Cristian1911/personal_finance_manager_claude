import { isDebtAccountType } from "../../utils/account-balance";
import { parseQuickCaptureText } from "../../utils/quick-capture";
import type { InicioAccount } from "./inicio";
import { buildInicio } from "./inicio";
import type { StoredTransaction } from "./movements";
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
  // Money out of an account you have: it can't go below zero without saying so.
  const out = draft.kind !== "ingreso" && !isDebtAccountType(from.accountType);
  if (out && draft.amount > from.currentBalance) {
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
    const moved = after.result.disponible - before.result.disponible;
    const level = formatPesos(after.result.disponible);
    if (Math.abs(moved) < 0.005) return { line: `Las dos cuentan para tu Disponible: no cambia.`, tone: "neutral" };
    if (pay) return { line: `Pagas ${name(to)}: tu Disponible baja a ${level}.`, tone: after.result.disponible < 0 ? "bad" : "neutral" };
    if (moved < 0) return { line: `${name(to)} no cuenta para tu Disponible: baja a ${level}.`, tone: after.result.disponible < 0 ? "bad" : "neutral" };
    return { line: `${name(from)} no cuenta para tu Disponible: sube a ${level}.`, tone: "neutral" };
  }

  if (draft.kind === "gasto" && isDebtAccountType(from.accountType)) {
    return { line: `Va a ${name(from)}: tu Disponible no cambia hoy, lo pagas con la factura.`, tone: "neutral" };
  }
  const income = draft.kind === "ingreso";
  extra = [leg("preview", from.id, income ? "INFLOW" : "OUTFLOW", income ? "INCOME" : "SPEND")];
  const after = buildInicio({ ...input, transactions: [...input.transactions, ...extra] });
  if (after.status !== "ready") return null;
  if (Math.abs(after.result.disponible - before.result.disponible) < 0.005) {
    return { line: `${name(from)} no cuenta para tu Disponible: no cambia.`, tone: "neutral" };
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
export function dictado(text: string, accounts: InicioAccount[], now: Date = new Date()): Dictado {
  const said = fold(text);
  const named = [...accounts]
    .filter((a) => a.name?.trim())
    .sort((a, b) => (b.name!.length - a.name!.length))
    .find((a) => said.includes(fold(a.name!.trim())));
  let r = parseQuickCaptureText(text, { now });
  // Most of what people dictate is a spend and says so without a verb ("almuerzo 45 mil").
  // (account_id is always "missing" there: the parser never picks one.)
  if (!r.success && r.missing_fields.includes("direction") && !r.missing_fields.includes("amount")) {
    r = parseQuickCaptureText(`gasté ${text}`, { now });
  }
  if (!r.success) return { kind: "gasto", amount: null, what: text.trim(), accountId: named?.id ?? null };
  // En qué without the verb we added and without the account it named ("en efectivo").
  let what = r.data.description.replace(/^gast[eé]\s+/i, "");
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
