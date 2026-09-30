import type { CommandEnvelope, CommandResult, StoragePort } from "../types";
import { UUID_RE } from "../validate";
import { isNewer } from "./field-version";

export interface SetTransactionNotePayload {
  transactionId: string;
  notes: string | null;
}

/**
 * A user choice (S1-2): the edit with the latest clientTs wins, no matter
 * the order in which devices send it. Equal timestamps are broken by command
 * id, so phone and server always pick the same winner.
 */
export async function setTransactionNote(
  s: StoragePort,
  cmd: CommandEnvelope<SetTransactionNotePayload>,
): Promise<CommandResult> {
  const p = cmd.payload;
  if (!p || !UUID_RE.test(p.transactionId ?? "")) return { status: "rejected", replayed: false, code: "invalid", error: "Identificador inválido." };
  if (p.notes != null && (typeof p.notes !== "string" || p.notes.length > 500)) {
    return { status: "rejected", replayed: false, code: "invalid", error: "La nota es muy larga." };
  }

  const tx = await s.getTransaction(cmd.userId, p.transactionId);
  if (!tx) return { status: "rejected", replayed: false, code: "not_found", error: "Movimiento no encontrado." };

  const current = await s.getFieldVersion(cmd.userId, "transaction", p.transactionId, "notes");
  if (current && isNewer(current, cmd.clientTs, cmd.id)) {
    return {
      status: "superseded", replayed: false,
      data: { winningClientTs: current.clientTs, winningCommandId: current.commandId },
    };
  }

  await s.updateTransactionNotes(cmd.userId, p.transactionId, p.notes);
  await s.setFieldVersion({
    userId: cmd.userId, entity: "transaction", entityId: p.transactionId,
    field: "notes", clientTs: cmd.clientTs, commandId: cmd.id,
  });
  return { status: "applied", replayed: false };
}
