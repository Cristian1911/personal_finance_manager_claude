import { captureManualTransaction } from "./commands/capture-manual-transaction";
import { setTransactionNote } from "./commands/set-transaction-note";
import type { CommandEnvelope, CommandResult, CommandType, StoragePort } from "./types";
import { UUID_RE, isIsoUtc } from "./validate";

type Handler = (s: StoragePort, cmd: CommandEnvelope<never>) => Promise<CommandResult>;

const HANDLERS: Partial<Record<CommandType, Handler>> = {
  captureManualTransaction,
  setTransactionNote,
};

/**
 * Applies one command atomically. A command id seen before returns its stored
 * result with `replayed: true` and changes nothing. Handler results (including
 * validation rejections) are recorded; unexpected errors roll back and are
 * NOT recorded, so the command can be retried.
 *
 * Not recorded either: a malformed envelope (it could never be stored — ids
 * are uuid keys, clientTs a timestamptz) and an unknown command type (a newer
 * phone's command must stay applicable once this server learns it).
 */
export async function applyCommand(storage: StoragePort, cmd: CommandEnvelope): Promise<CommandResult> {
  if (!UUID_RE.test(cmd.id ?? "") || !UUID_RE.test(cmd.userId ?? "") || !isIsoUtc(cmd.clientTs)) {
    return { status: "rejected", replayed: false, code: "invalid", error: "Comando inválido." };
  }
  const handler = HANDLERS[cmd.type];
  if (!handler) {
    return { status: "rejected", replayed: false, code: "unsupported", error: `Comando desconocido: ${cmd.type}` };
  }

  return storage.withTransaction(async (s) => {
    const prior = await s.findCommand(cmd.userId, cmd.id);
    if (prior) return { ...prior.result, replayed: true };

    const result = await handler(s, cmd as CommandEnvelope<never>);
    await s.recordCommand(cmd, result);
    return result;
  });
}
