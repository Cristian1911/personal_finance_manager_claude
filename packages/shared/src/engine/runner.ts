import { archiveAccount, createAccount, editAccount } from "./commands/accounts";
import { captureManualTransaction } from "./commands/capture-manual-transaction";
import { captureTransfer } from "./commands/capture-transfer";
import { createDestinatario, setDestinatarioCategory, setTransactionCategory, setTransactionDestinatario } from "./commands/categorias";
import { archivePagoFijo, createPagoFijo, editPagoFijo, setOccurrenceStatus } from "./commands/pagos";
import { setAccountCountsInDisponible } from "./commands/set-account-counts-in-disponible";
import { setCycleSettings } from "./commands/set-cycle-settings";
import { deleteTransaction } from "./commands/delete-transaction";
import { editTransaction } from "./commands/edit-transaction";
import { setTransactionExcluded } from "./commands/set-transaction-excluded";
import { setTransactionNote } from "./commands/set-transaction-note";
import type { HashFn } from "../utils/idempotency";
import type { CommandEnvelope, CommandResult, CommandType, StoragePort } from "./types";
import { UUID_RE, isIsoUtc } from "./validate";

/** Platform services a handler may need. The phone passes expo-crypto's SHA-256 (Hermes has no crypto.subtle). */
export interface EngineOptions {
  hash?: HashFn;
}

type Handler = (s: StoragePort, cmd: CommandEnvelope<never>, opts: EngineOptions) => Promise<CommandResult>;

const HANDLERS: Partial<Record<CommandType, Handler>> = {
  captureManualTransaction,
  setTransactionNote,
  setTransactionExcluded,
  deleteTransaction,
  editTransaction,
  setCycleSettings,
  setAccountCountsInDisponible,
  createAccount,
  editAccount,
  archiveAccount,
  captureTransfer,
  createPagoFijo,
  editPagoFijo,
  archivePagoFijo,
  setOccurrenceStatus,
  setTransactionCategory,
  createDestinatario,
  setTransactionDestinatario,
  setDestinatarioCategory,
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
export async function applyCommand(
  storage: StoragePort,
  cmd: CommandEnvelope,
  opts: EngineOptions = {},
): Promise<CommandResult> {
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

    const result = await handler(s, cmd as CommandEnvelope<never>, opts);
    await s.recordCommand(cmd, result);
    return result;
  });
}
