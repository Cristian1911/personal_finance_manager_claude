import { isDebtAccountType } from "../../utils/account-balance";
import type { StoragePort } from "../types";

/**
 * Moves an account's balance by a movement's effect on your money (+ in,
 * − out). A card or loan stores what you owe, so the effect is reversed
 * there (v1 applyAccountBalanceDelta): a purchase raises the debt.
 */
export async function moveBalance(s: StoragePort, userId: string, accountId: string, moneyDelta: number): Promise<void> {
  const account = await s.getAccount(userId, accountId);
  if (!account) return;
  await s.adjustAccountBalance(userId, accountId, isDebtAccountType(account.accountType) ? -moneyDelta : moneyDelta);
}
