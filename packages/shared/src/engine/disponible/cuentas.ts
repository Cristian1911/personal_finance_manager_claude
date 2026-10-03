import { isDebtAccountType } from "../../utils/account-balance";
import { defaultCountsInDisponible } from "../commands/set-account-counts-in-disponible";
import type { InicioAccount } from "./inicio";
import { formatPesos, formatUsd } from "./verdict";

export interface CuentaRow {
  id: string;
  title: string;
  /** Kind, last digits and the one detail that matters (cut day, cuota, "aparte"). */
  sub: string;
  /** What you have; on a card or loan, what you owe. */
  amount: string;
  /** A card's USD debt, apart from the pesos ("+ US$1.234") (S10-14). */
  usd?: string;
  counts: boolean;
  /** Cards and loans never count (S3-0): no switch. */
  canCount: boolean;
  isDebt: boolean;
  accountType: string;
}

export interface CuentasView {
  /** What the counted accounts hold: the rows below add up to it (null when none count). */
  counted: string | null;
  /** Money you have that doesn't count (null when none). */
  apart: string | null;
  /** What you owe on cards and loans (null when none). */
  owed: string | null;
  /** Cards' USD debt, said apart ("y US$1.234"), null when none. */
  owedUsd: string | null;
  cuentas: CuentaRow[];
  deudas: CuentaRow[];
}

const KIND: Record<string, string> = {
  CHECKING: "Cuenta corriente", SAVINGS: "Ahorros", CASH: "Efectivo", CREDIT_CARD: "Tarjeta", LOAN: "Crédito",
  INVESTMENT: "Inversión", OTHER: "Cuenta",
};

function row(a: InicioAccount): CuentaRow {
  const isDebt = isDebtAccountType(a.accountType);
  const counts = !isDebt && (a.countsInDisponible ?? defaultCountsInDisponible(a.accountType));
  const kind = KIND[a.accountType] ?? "Cuenta";
  const parts: string[] = [];
  if (a.accountType === "CASH") parts.push("Lo que llevas encima");
  else if (a.accountType === "LOAN") parts.push(a.institutionName || kind);
  else parts.push(a.mask ? `${kind} ··${a.mask}` : kind);
  if (a.accountType === "CREDIT_CARD" && a.cutoffDay) parts.push(`corte el ${a.cutoffDay}`);
  if (a.accountType === "LOAN" && a.monthlyPayment) parts.push(`cuota ${formatPesos(a.monthlyPayment)}`);
  if (!isDebt && !counts) parts.push("aparte");
  return {
    id: a.id,
    title: a.name?.trim() || kind,
    sub: parts.join(" · "),
    amount: formatPesos(a.currentBalance),
    ...(a.usdOwed ? { usd: `+ ${formatUsd(a.usdOwed)}` } : {}),
    counts,
    canCount: !isDebt,
    isDebt,
    accountType: a.accountType,
  };
}

/**
 * Mis cuentas (S8-4, S8-5): money you have apart from money you owe, and
 * what counts for Disponible. Every total is the sum of the rows shown, so
 * the screen always adds up (owner note D1: first-run balance vs accounts).
 */
export function cuentasView(i: { accounts: InicioAccount[] }): CuentasView {
  const rows = i.accounts.map(row);
  const cuentas = rows.filter((r) => !r.isDebt);
  const deudas = rows.filter((r) => r.isDebt);
  const sum = (ids: Set<string>) => i.accounts.filter((a) => ids.has(a.id)).reduce((s, a) => s + a.currentBalance, 0);
  const countedIds = new Set(cuentas.filter((r) => r.counts).map((r) => r.id));
  const apartIds = new Set(cuentas.filter((r) => !r.counts).map((r) => r.id));
  const debtIds = new Set(deudas.map((r) => r.id));
  return {
    counted: countedIds.size ? formatPesos(sum(countedIds)) : null,
    apart: apartIds.size ? formatPesos(sum(apartIds)) : null,
    owed: debtIds.size ? formatPesos(sum(debtIds)) : null,
    owedUsd: (() => {
      const usd = i.accounts.reduce((s, a) => s + (a.usdOwed ?? 0), 0);
      return usd > 0 ? formatUsd(usd) : null;
    })(),
    cuentas,
    deudas,
  };
}
