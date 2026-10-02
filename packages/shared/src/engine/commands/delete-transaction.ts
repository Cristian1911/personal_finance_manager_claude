import type { EngineOptions } from "../runner";
import type { CommandEnvelope, CommandResult, StoragePort } from "../types";
import { UUID_RE } from "../validate";
import { moveBalance } from "./balance";
import { unlinkPayment } from "./pagos";

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
  opts: EngineOptions = {},
): Promise<CommandResult> {
  const p = cmd.payload;
  if (!p || !UUID_RE.test(p.transactionId ?? "")) return { status: "rejected", replayed: false, code: "invalid", error: "Identificador inválido." };
  const tx = await s.getTransaction(cmd.userId, p.transactionId);
  if (!tx) return { status: "rejected", replayed: false, code: "not_found", error: "Movimiento no encontrado." };
  if (!MANUAL_CAPTURE_METHODS.has(tx.captureMethod)) {
    return { status: "rejected", replayed: false, code: "invalid", error: "Solo se pueden borrar los movimientos que anotaste a mano." };
  }
  // Entre cuentas: both legs go together, or the money would vanish from one side —
  // but only when every leg was written by hand. v1 can link a manual row to a
  // bank row as a transfer; the bank's row is a fact and stays.
  const legs = tx.transferGroupId ? await s.getTransferLegs(cmd.userId, tx.transferGroupId) : [tx];
  const rows = legs.every((l) => MANUAL_CAPTURE_METHODS.has(l.captureMethod)) ? legs : [tx];
  for (const row of rows) {
    await unlinkPayment(s, cmd.userId, row.id, cmd.clientTs, opts);
    await s.deleteTransaction(cmd.userId, row.id);
    // An ignored movement's amount already left the balance when it was ignored.
    if (!row.isExcluded) await moveBalance(s, cmd.userId, row.accountId, row.direction === "OUTFLOW" ? row.amount : -row.amount);
  }
  return { status: "applied", replayed: false, data: { deleted: rows.map((r) => r.id) } };
}
