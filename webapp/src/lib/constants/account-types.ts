/**
 * Canonical Spanish labels for account types.
 *
 * "Full" labels are used in detail views, badges, and settings.
 * "Short" labels are used in compact dashboard widgets where space is tight.
 */

export const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  CHECKING: "Cuenta Corriente",
  SAVINGS: "Cuenta de Ahorros",
  CREDIT_CARD: "Tarjeta de Crédito",
  CASH: "Efectivo",
  INVESTMENT: "Inversión",
  LOAN: "Préstamo",
  OTHER: "Otro",
};

export const ACCOUNT_TYPE_SHORT_LABELS: Record<string, string> = {
  CHECKING: "Corriente",
  SAVINGS: "Ahorros",
  CREDIT_CARD: "Tarjeta",
  CASH: "Efectivo",
  INVESTMENT: "Inversión",
  LOAN: "Préstamo",
  OTHER: "Otro",
};

/** Dashboard-specific labels that use semantic names ("Cuenta principal"). */
export const ACCOUNT_TYPE_DASHBOARD_LABELS: Record<string, string> = {
  CHECKING: "Cuenta principal",
  SAVINGS: "Cuenta principal",
  CASH: "Efectivo",
  CREDIT_CARD: "Tarjeta",
  INVESTMENT: "Inversión",
  LOAN: "Préstamo",
  OTHER: "Cuenta",
};
