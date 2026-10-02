import { isDebtAccountType } from "../../utils/account-balance";
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
