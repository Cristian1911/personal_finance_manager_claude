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

/**
 * The instant an account's balance is true as of: when you told it (Agregar) or
 * the end of a statement's cut day. Bank movements before it are already inside
 * it. Kept as the version of the balance (field_versions, synced) — no schema change.
 */
export async function balanceAsOf(s: StoragePort, userId: string, accountId: string): Promise<string | null> {
  return (await s.getFieldVersion(userId, "account", accountId, "balance_as_of"))?.clientTs ?? null;
}

export async function setBalanceAsOf(s: StoragePort, userId: string, accountId: string, instant: string, commandId: string): Promise<void> {
  await s.setFieldVersion({ userId, entity: "account", entityId: accountId, field: "balance_as_of", clientTs: instant, commandId });
}

/** A Colombian wall time as a UTC instant ("2026-09-30", "23:59:59.999" → 2026-10-01T04:59:59.999Z). */
export const colombiaInstant = (date: string, time = "00:00:00.000") =>
  new Date(`${date}T${time.length === 5 ? `${time}:00.000` : time}-05:00`).toISOString();
