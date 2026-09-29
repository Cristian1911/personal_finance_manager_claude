import type { CommandEnvelope, CommandResult, StoragePort } from "../types";

export interface SetTransactionNotePayload {
  transactionId: string;
  notes: string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A user choice (S1-2): the edit with the latest clientTs wins, no matter
 * the order in which devices send it. Ties apply (last arrival wins).
 */
export async function setTransactionNote(
  s: StoragePort,
  cmd: CommandEnvelope<SetTransactionNotePayload>,
): Promise<CommandResult> {
  const p = cmd.payload;
  if (!p || !UUID_RE.test(p.transactionId ?? "")) return { status: "rejected", replayed: false, error: "Identificador inválido." };
  if (p.notes != null && (typeof p.notes !== "string" || p.notes.length > 500)) {
    return { status: "rejected", replayed: false, error: "La nota es muy larga." };
  }

  const tx = await s.getTransaction(p.transactionId);
  if (!tx || tx.userId !== cmd.userId) return { status: "rejected", replayed: false, error: "Movimiento no encontrado." };

  const current = await s.getFieldVersion("transaction", p.transactionId, "notes");
  if (current && Date.parse(current) > Date.parse(cmd.clientTs)) {
    return { status: "superseded", replayed: false };
  }

  await s.updateTransactionNotes(p.transactionId, p.notes);
  await s.setFieldVersion({
    userId: cmd.userId, entity: "transaction", entityId: p.transactionId,
    field: "notes", clientTs: cmd.clientTs, commandId: cmd.id,
  });
  return { status: "applied", replayed: false };
}
