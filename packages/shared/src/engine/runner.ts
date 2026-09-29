import { captureManualTransaction } from "./commands/capture-manual-transaction";
import type { CommandEnvelope, CommandResult, CommandType, StoragePort } from "./types";

type Handler = (s: StoragePort, cmd: CommandEnvelope<never>) => Promise<CommandResult>;

const HANDLERS: Partial<Record<CommandType, Handler>> = {
  captureManualTransaction,
};

/**
 * Applies one command atomically. A command id seen before returns its stored
 * result with `replayed: true` and changes nothing. Handler results (including
 * validation rejections) are recorded; unexpected errors roll back and are
 * NOT recorded, so the command can be retried.
 */
export function applyCommand(storage: StoragePort, cmd: CommandEnvelope): Promise<CommandResult> {
  return storage.withTransaction(async (s) => {
    const prior = await s.findCommand(cmd.id);
    if (prior) return { ...prior.result, replayed: true };

    const handler = HANDLERS[cmd.type];
    const result: CommandResult = handler
      ? await handler(s, cmd as CommandEnvelope<never>)
      : { status: "rejected", replayed: false, error: `Comando desconocido: ${cmd.type}` };

    await s.recordCommand(cmd, result);
    return result;
  });
}
