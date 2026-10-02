import type { CommandEnvelope, CommandResult, StoragePort } from "../types";
import { UUID_RE } from "../validate";
import { MANUAL_CAPTURE_METHODS } from "./delete-transaction";
import { isNewer } from "./field-version";
import { isIsoDate, isMoney } from "./validate-money";
import { moveBalance } from "./balance";

export interface EditTransactionPayload {
  transactionId: string;
  amount?: number;
  date?: string;
  accountId?: string;
}

const FIELDS = [
  { key: "amount", field: "amount" },
  { key: "date", field: "transaction_date" },
  { key: "accountId", field: "account_id" },
] as const;

/**
 * Fix the amount, date or account of a manual entry (D7). Bank movements keep
 * the bank's facts (S1-2). Each field is versioned on its own: the latest
 * clientTs wins per field, so two devices editing different fields both stick.
 * Balances follow: the old effect comes off the old account, the new one goes
 * on the (possibly new) account.
 */
export async function editTransaction(
  s: StoragePort,
  cmd: CommandEnvelope<EditTransactionPayload>,
): Promise<CommandResult> {
  const p = cmd.payload;
  const bad = (error: string): CommandResult => ({ status: "rejected", replayed: false, code: "invalid", error });
  if (!p || !UUID_RE.test(p.transactionId ?? "")) return bad("Identificador inválido.");
  if (p.amount === undefined && p.date === undefined && p.accountId === undefined) return bad("No hay nada que cambiar.");
  if (p.amount !== undefined && (!isMoney(p.amount) || p.amount <= 0)) return bad("El monto debe ser mayor que cero.");
  if (p.date !== undefined && !isIsoDate(p.date)) return bad("Fecha inválida.");
  if (p.accountId !== undefined && !UUID_RE.test(p.accountId)) return bad("Cuenta inválida.");

  const tx = await s.getTransaction(cmd.userId, p.transactionId);
  if (!tx) return { status: "rejected", replayed: false, code: "not_found", error: "Movimiento no encontrado." };
  if (!MANUAL_CAPTURE_METHODS.has(tx.captureMethod)) return bad("Los datos del banco no se pueden cambiar; puedes ignorar el movimiento.");
  if (p.accountId !== undefined && !(await s.getAccount(cmd.userId, p.accountId))) {
    return { status: "rejected", replayed: false, code: "not_found", error: "Cuenta no encontrada." };
  }

  const next = { amount: tx.amount, transactionDate: tx.transactionDate, accountId: tx.accountId };
  let changed = 0;
  for (const { key, field } of FIELDS) {
    if (p[key] === undefined) continue;
    const current = await s.getFieldVersion(cmd.userId, "transaction", tx.id, field);
    if (current && isNewer(current, cmd.clientTs, cmd.id)) continue; // a newer edit of this field already won
    if (key === "amount") next.amount = p.amount!;
    if (key === "date") next.transactionDate = p.date!;
    if (key === "accountId") next.accountId = p.accountId!;
    await s.setFieldVersion({ userId: cmd.userId, entity: "transaction", entityId: tx.id, field, clientTs: cmd.clientTs, commandId: cmd.id });
    changed++;
  }
  if (changed === 0) return { status: "superseded", replayed: false };

  const sign = tx.direction === "OUTFLOW" ? -1 : 1;
  await s.updateTransactionFacts(cmd.userId, tx.id, next);
  if (!tx.isExcluded) { // an ignored movement isn't in any balance
    await moveBalance(s, cmd.userId, tx.accountId, -sign * tx.amount);
    await moveBalance(s, cmd.userId, next.accountId, sign * next.amount);
  }
  return { status: "applied", replayed: false };
}
