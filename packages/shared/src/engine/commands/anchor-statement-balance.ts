import { addDays, format, parseISO } from "date-fns";
import { anchorStatementBalance as anchorBalance } from "../../utils/statement-import";
import type { CommandEnvelope, CommandResult, StoragePort } from "../types";
import { UUID_RE } from "../validate";
import { isIsoDate, isMoney } from "./validate-money";
import { balanceAsOf, colombiaInstant, setBalanceAsOf } from "./balance";

/**
 * A statement's final balance is the truth at its cut, not today (v1's
 * "137k → 937k" bug): the account becomes that balance plus what the app
 * knows moved after the cut. Never older than what the balance is true as of. Server only.
 */
export async function anchorStatementBalance(
  s: StoragePort,
  cmd: CommandEnvelope<{ accountId: string; finalBalance: number; asOf: string }>,
): Promise<CommandResult> {
  const p = cmd.payload;
  if (!p || !UUID_RE.test(p.accountId ?? "") || !isIsoDate(p.asOf) || typeof p.finalBalance !== "number" || !isMoney(Math.abs(p.finalBalance))) {
    return { status: "rejected", replayed: false, code: "invalid", error: "Datos del extracto inválidos." };
  }
  const account = await s.getAccount(cmd.userId, p.accountId);
  if (!account) return { status: "rejected", replayed: false, code: "not_found", error: "Cuenta no encontrada." };
  // An older statement than what the balance is already true as of (the balance you told today, or a
  // newer statement): it would replace a newer balance with an older, incomplete one. Keep it.
  const current = await balanceAsOf(s, cmd.userId, p.accountId);
  const cut = colombiaInstant(p.asOf, "23:59:59.999");
  if (current && cut < current) return { status: "applied", replayed: false, data: { balance: account.currentBalance, kept: true } };
  const after = (await s.listTransactionsSince(cmd.userId, format(addDays(parseISO(p.asOf), 1), "yyyy-MM-dd")))
    .filter((t) => t.accountId === p.accountId && !t.isExcluded && !t.reconciledIntoTransactionId);
  const r = anchorBalance({
    finalBalance: p.finalBalance,
    accountType: account.accountType,
    postCutoffTransactions: after.map((t) => ({ amount: t.amount, direction: t.direction, rawDescription: t.rawDescription ?? t.cleanDescription })),
  });
  if (r.keepExisting) return { status: "applied", replayed: false, data: { balance: account.currentBalance, kept: true } };
  await s.adjustAccountBalance(cmd.userId, p.accountId, Math.round((r.balance - account.currentBalance) * 100) / 100);
  await setBalanceAsOf(s, cmd.userId, p.accountId, cut, cmd.id);
  return { status: "applied", replayed: false, data: { balance: r.balance } };
}
