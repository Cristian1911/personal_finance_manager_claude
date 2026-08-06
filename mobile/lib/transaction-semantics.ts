/**
 * Transaction semantics for the mobile UI.
 *
 * `isDebtAccountType` and `isDebtInflow` used to be redefined here. They now
 * come from `@zeta/shared` so mobile and webapp cannot drift — a divergence
 * between the two is exactly what produced 7-33x different "Resumen del mes"
 * numbers before `computeMonthlyAggregates` was introduced.
 */
export {
  DEBT_PAYMENT_CATEGORY_ID,
  isDebtAccountType,
  isDebtInflow,
} from "@zeta/shared";

import { isDebtInflow } from "@zeta/shared";

/** Spanish label for a movement, as shown on the transaction row and detail. */
export function getTransactionTypeLabel(params: {
  direction: "INFLOW" | "OUTFLOW";
  accountType: string | null | undefined;
}): string {
  if (isDebtInflow(params)) return "Abono a deuda";
  return params.direction === "INFLOW" ? "Ingreso" : "Gasto";
}
