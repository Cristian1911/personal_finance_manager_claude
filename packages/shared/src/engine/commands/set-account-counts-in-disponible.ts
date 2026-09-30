import type { CommandEnvelope, CommandResult, StoragePort } from "../types";
import { UUID_RE } from "../validate";
import { isNewer } from "./field-version";

/** "Cuenta para mi Disponible" (A13, S3-0). */
export interface SetAccountCountsInDisponiblePayload {
  accountId: string;
  counts: boolean;
}

const DEBT_TYPES = new Set(["CREDIT_CARD", "LOAN"]);
const COUNTED_BY_DEFAULT = new Set(["CHECKING", "SAVINGS", "CASH"]);

/** With no setting yet: checking, savings and cash count; investments and the rest don't. */
export function defaultCountsInDisponible(accountType: string): boolean {
  return COUNTED_BY_DEFAULT.has(accountType);
}

export async function setAccountCountsInDisponible(
  s: StoragePort,
  cmd: CommandEnvelope<SetAccountCountsInDisponiblePayload>,
): Promise<CommandResult> {
  const p = cmd.payload;
  if (!p || !UUID_RE.test(p.accountId ?? "") || typeof p.counts !== "boolean") {
    return { status: "rejected", replayed: false, code: "invalid", error: "Datos inválidos." };
  }
  const account = await s.getAccount(cmd.userId, p.accountId);
  if (!account) return { status: "rejected", replayed: false, code: "not_found", error: "Cuenta no encontrada." };
  // A card's available credit is never Disponible (S3-0).
  if (p.counts && DEBT_TYPES.has(account.accountType)) {
    return {
      status: "rejected", replayed: false, code: "invalid",
      error: "Las tarjetas y los créditos no cuentan para tu Disponible.",
    };
  }

  const current = await s.getFieldVersion(cmd.userId, "account", p.accountId, "counts_in_disponible");
  if (current && isNewer(current, cmd.clientTs, cmd.id)) {
    return { status: "superseded", replayed: false, data: { winningClientTs: current.clientTs, winningCommandId: current.commandId } };
  }
  await s.setAccountSetting(cmd.userId, p.accountId, p.counts);
  await s.setFieldVersion({
    userId: cmd.userId, entity: "account", entityId: p.accountId,
    field: "counts_in_disponible", clientTs: cmd.clientTs, commandId: cmd.id,
  });
  return { status: "applied", replayed: false };
}
