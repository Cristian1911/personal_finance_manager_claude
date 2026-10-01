import type { CommandEnvelope, CommandResult, StoragePort } from "../types";
import { UUID_RE } from "../validate";
import { isNewer } from "./field-version";

export interface SetTransactionExcludedPayload {
  transactionId: string;
  /** true: "esto no es un movimiento" — it stays listed but stops counting (D8). */
  excluded: boolean;
}

/**
 * Ignorar / Contar de nuevo from Detalle. A user choice (S1-2): the edit with
 * the latest clientTs wins, ties broken by command id, like the note.
 */
export async function setTransactionExcluded(
  s: StoragePort,
  cmd: CommandEnvelope<SetTransactionExcludedPayload>,
): Promise<CommandResult> {
  const p = cmd.payload;
  if (!p || !UUID_RE.test(p.transactionId ?? "") || typeof p.excluded !== "boolean") {
    return { status: "rejected", replayed: false, code: "invalid", error: "Datos inválidos." };
  }

  const tx = await s.getTransaction(cmd.userId, p.transactionId);
  if (!tx) return { status: "rejected", replayed: false, code: "not_found", error: "Movimiento no encontrado." };

  const current = await s.getFieldVersion(cmd.userId, "transaction", p.transactionId, "is_excluded");
  if (current && isNewer(current, cmd.clientTs, cmd.id)) {
    return {
      status: "superseded", replayed: false,
      data: { winningClientTs: current.clientTs, winningCommandId: current.commandId },
    };
  }

  await s.updateTransactionExcluded(cmd.userId, p.transactionId, p.excluded);
  await s.setFieldVersion({
    userId: cmd.userId, entity: "transaction", entityId: p.transactionId,
    field: "is_excluded", clientTs: cmd.clientTs, commandId: cmd.id,
  });
  return { status: "applied", replayed: false };
}
