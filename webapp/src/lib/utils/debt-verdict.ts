import { formatCurrency } from "@/lib/utils/currency";
import type { VerdictState } from "@/components/ui/verdict";
import type { CurrencyCode } from "@/types/domain";

export interface DebtVerdictResult {
  state: VerdictState;
  delta?: string;
  detail: string;
}

/**
 * Derives the debt hero verdict from the same three numbers every debt
 * surface already has: total balance, total monthly payment, and monthly
 * interest. Single source so desktop (`DebtHeroCard`) and mobile
 * (`DeudasHero`) never drift on what counts as "on track" — a hardcoded
 * `vas-bien` on one platform while the other computes it honestly is
 * exactly the kind of dialect drift the unification layer exists to kill.
 *
 * - `vas-bien`   — no debt, or payments cover interest (capital falling).
 * - `te-pasaste` — interest exceeds payments (negative amortization, balance
 *                  growing) — the only state that can legitimately show red.
 * - `atencion`   — payments exactly cover interest (no progress), or there's
 *                  no payment data yet to judge.
 */
export function deriveDebtVerdict({
  totalDebt,
  totalMonthlyPayment,
  monthlyInterest,
  currency,
}: {
  totalDebt: number;
  totalMonthlyPayment: number;
  monthlyInterest: number;
  currency: CurrencyCode;
}): DebtVerdictResult {
  const capitalPerMonth = totalMonthlyPayment - monthlyInterest;

  if (totalDebt <= 0) {
    return { state: "vas-bien", detail: "No tienes deudas activas." };
  }

  if (capitalPerMonth > 0) {
    return {
      state: "vas-bien",
      delta: `−${formatCurrency(capitalPerMonth, currency)}`,
      detail: "Tus pagos cubren los intereses; la deuda baja cada mes.",
    };
  }

  if (capitalPerMonth < 0) {
    return {
      state: "te-pasaste",
      delta: `+${formatCurrency(-capitalPerMonth, currency)}`,
      detail: "Los intereses superan tus pagos; la deuda crece cada mes.",
    };
  }

  if (totalMonthlyPayment > 0) {
    return {
      state: "atencion",
      detail: "Tus pagos solo cubren los intereses; la deuda no baja.",
    };
  }

  return {
    state: "atencion",
    detail: "Registra los pagos mensuales de tus deudas para ver tu avance.",
  };
}
