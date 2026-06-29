/** Net-worth helpers shared by the accounts screens. Currency-aware so foreign
 * balances are never summed into the COP headline 1:1 (the bug both screens had). */

const DEBT_TYPES = new Set(["CREDIT_CARD", "LOAN"]);

export const DISPLAY_CURRENCY = "COP";

type NetWorthAccount = {
  account_type: string;
  current_balance: number | null;
  currency_code?: string | null;
};

/** Net worth in `currency` — only same-currency accounts. Debt subtracts. */
export function computeNetWorth(
  accounts: NetWorthAccount[],
  currency: string = DISPLAY_CURRENCY
): number {
  return accounts.reduce((sum, acc) => {
    if ((acc.currency_code ?? DISPLAY_CURRENCY) !== currency) return sum;
    const balance = acc.current_balance ?? 0;
    return DEBT_TYPES.has(acc.account_type) ? sum - balance : sum + balance;
  }, 0);
}

/** Net worth per non-primary currency, so foreign accounts surface separately
 * instead of being dropped from (or wrongly 1:1-summed into) the headline. */
export function computeSecondaryNetWorth(
  accounts: NetWorthAccount[],
  primary: string = DISPLAY_CURRENCY
): Array<[string, number]> {
  const byCurrency = new Map<string, number>();
  for (const acc of accounts) {
    const cc = acc.currency_code ?? primary;
    if (cc === primary) continue;
    const balance = acc.current_balance ?? 0;
    const delta = DEBT_TYPES.has(acc.account_type) ? -balance : balance;
    byCurrency.set(cc, (byCurrency.get(cc) ?? 0) + delta);
  }
  return [...byCurrency.entries()];
}
