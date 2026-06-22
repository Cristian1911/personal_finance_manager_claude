/**
 * Build the accounts-row update payload for a debt account whose balance just
 * changed: current_balance, available_balance, and the currency_balances
 * JSONB that /deudas reads via extractDebtAccounts. Single source of truth —
 * every debt-payment path (checklist, extra payment, auto-linked companion
 * leg, mobile ledger mutations) must write these fields together or the page
 * shows stale debt.
 *
 * Pure function — no Supabase / no I/O. Lives in @zeta/shared so both the
 * webapp Server Actions and the mobile offline-first repositories produce a
 * byte-identical payload.
 */
export function buildDebtBalanceUpdatePayload(
  account: {
    credit_limit: number | null;
    currency_balances: unknown;
  },
  nextBalance: number,
  currencyCode: string
): Record<string, unknown> {
  const nextAvailable =
    account.credit_limit != null ? Math.max(account.credit_limit - nextBalance, 0) : undefined;

  const updatePayload: Record<string, unknown> = { current_balance: nextBalance };
  if (nextAvailable !== undefined) updatePayload.available_balance = nextAvailable;

  const cb = account.currency_balances as Record<string, Record<string, unknown>> | null;
  if (cb && cb[currencyCode]) {
    updatePayload.currency_balances = {
      ...cb,
      [currencyCode]: {
        ...cb[currencyCode],
        current_balance: nextBalance,
        total_payment_due: Math.max(nextBalance, 0),
        ...(nextAvailable !== undefined ? { available_balance: nextAvailable } : {}),
      },
    };
  }

  return updatePayload;
}
