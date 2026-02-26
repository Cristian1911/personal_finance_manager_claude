export const DEBT_PAYMENT_CATEGORY_ID = "a0000001-0001-4000-8000-000000000019";

export function isDebtAccountType(accountType: string | null | undefined): boolean {
  return accountType === "CREDIT_CARD" || accountType === "LOAN";
}

export function isDebtInflow(params: {
  direction: "INFLOW" | "OUTFLOW" | string | null | undefined;
  accountType: string | null | undefined;
}): boolean {
  return params.direction === "INFLOW" && isDebtAccountType(params.accountType);
}

export function getTransactionTypeLabel(params: {
  direction: "INFLOW" | "OUTFLOW";
  accountType: string | null | undefined;
}): string {
  if (isDebtInflow(params)) return "Abono a deuda";
  return params.direction === "INFLOW" ? "Ingreso" : "Gasto";
}
