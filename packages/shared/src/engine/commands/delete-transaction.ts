import type { CommandEnvelope, CommandResult, StoragePort } from "../types";
import { UUID_RE } from "../validate";

/** Movements the user wrote down; bank movements are only ever ignored. */
export const MANUAL_CAPTURE_METHODS: ReadonlySet<string> = new Set(["MANUAL_FORM", "TEXT_QUICK_CAPTURE"]);

export interface DeleteTransactionPayload {
  transactionId: string;
}

/**
 * "No es un movimiento" on a manual entry (D8): the row goes away and its
 * amount goes back to the account. Deshacer re-captures it with the same id
 * and its original capturedAt. Replays are no-ops (runner).
 */
export async function deleteTransaction(
  s: StoragePort,
  cmd: CommandEnvelope<DeleteTransactionPayload>,
): Promise<CommandResult> {
  const p = cmd.payload;
  if (!p || !UUID_RE.test(p.transactionId ?? "")) return { status: "rejected", replayed: false, code: "invalid", error: "Identificador inválido." };
  const tx = await s.getTransaction(cmd.userId, p.transactionId);
  if (!tx) return { status: "rejected", replayed: false, code: "not_found", error: "Movimiento no encontrado." };
  if (!MANUAL_CAPTURE_METHODS.has(tx.captureMethod)) {
    return { status: "rejected", replayed: false, code: "invalid", error: "Solo se pueden borrar los movimientos que anotaste a mano." };
  }
  await s.deleteTransaction(cmd.userId, tx.id);
  await s.adjustAccountBalance(cmd.userId, tx.accountId, tx.direction === "OUTFLOW" ? tx.amount : -tx.amount);
  return { status: "applied", replayed: false };
}
