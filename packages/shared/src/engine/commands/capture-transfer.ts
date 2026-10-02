import { isDebtAccountType } from "../../utils/account-balance";
import { computeIdempotencyKey } from "../../utils/idempotency";
import type { EngineOptions } from "../runner";
import type { CommandEnvelope, CommandResult, StoragePort } from "../types";
import { UUID_RE, isIsoUtc } from "../validate";
import { moveBalance } from "./balance";
import { isIsoDate, isMoney } from "./validate-money";

/** Anotar › Entre cuentas: money moved between two of your accounts (paying a card is one). */
export interface CaptureTransferPayload {
  transferGroupId: string;
  fromTransactionId: string;
  toTransactionId: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  currencyCode: string;
  date: string;
  description?: string;
  /** Deshacer: the original capture instant. Not after clientTs. */
  capturedAt?: string;
}

/**
 * Two legs sharing a transfer group: out of `from`, into `to`. Into a card
 * or loan it's a debt payment (DEBT_PAYMENT / DEBT_CREDIT, v1 flow classes),
 * otherwise SELF_TRANSFER; Disponible then decides by which accounts count.
 * Balances follow (a payment into a card lowers what you owe).
 */
export async function captureTransfer(
  s: StoragePort,
  cmd: CommandEnvelope<CaptureTransferPayload>,
  opts: EngineOptions = {},
): Promise<CommandResult> {
  const p = cmd.payload;
  const bad = (error: string): CommandResult => ({ status: "rejected", replayed: false, code: "invalid", error });
  const ids = [p?.transferGroupId, p?.fromTransactionId, p?.toTransactionId, p?.fromAccountId, p?.toAccountId];
  if (!p || ids.some((id) => !UUID_RE.test(id ?? "")) || p.fromTransactionId === p.toTransactionId) return bad("Identificador inválido.");
  if (p.fromAccountId === p.toAccountId) return bad("Elige dos cuentas distintas.");
  if (!isMoney(p.amount) || p.amount <= 0) return bad("El monto debe ser mayor que cero.");
  if (typeof p.currencyCode !== "string" || !/^[A-Z]{3}$/.test(p.currencyCode)) return bad("Moneda inválida.");
  if (!isIsoDate(p.date)) return bad("Fecha inválida.");
  if (p.description !== undefined && (typeof p.description !== "string" || p.description.length > 200)) return bad("La descripción es muy larga.");
  if (p.capturedAt !== undefined && (!isIsoUtc(p.capturedAt) || p.capturedAt > cmd.clientTs)) return bad("Hora de captura inválida.");

  const [from, to] = await Promise.all([s.getAccount(cmd.userId, p.fromAccountId), s.getAccount(cmd.userId, p.toAccountId)]);
  if (!from || !to) return { status: "rejected", replayed: false, code: "not_found", error: "Cuenta no encontrada." };
  if (await s.getTransaction(cmd.userId, p.fromTransactionId)) {
    return { status: "duplicate", replayed: false, data: { transferGroupId: p.transferGroupId } };
  }

  const payment = isDebtAccountType(to.accountType);
  const description = p.description?.trim() || (payment ? `Pago ${to.name || "tarjeta"}` : `A ${to.name || "otra cuenta"}`);
  const createdAt = p.capturedAt ?? cmd.clientTs;
  const legs = [
    { id: p.fromTransactionId, accountId: from.id, direction: "OUTFLOW" as const, flowClass: payment ? "DEBT_PAYMENT" : "SELF_TRANSFER" },
    { id: p.toTransactionId, accountId: to.id, direction: "INFLOW" as const, flowClass: payment ? "DEBT_CREDIT" : "SELF_TRANSFER" },
  ];
  for (const leg of legs) {
    await s.insertTransaction({
      id: leg.id, userId: cmd.userId, accountId: leg.accountId, amount: p.amount, currencyCode: p.currencyCode,
      direction: leg.direction, transactionDate: p.date, cleanDescription: description, notes: null,
      captureMethod: "MANUAL_FORM",
      idempotencyKey: await computeIdempotencyKey({
        provider: "MANUAL", providerTransactionId: leg.id, transactionDate: p.date, amount: p.amount, rawDescription: description,
      }, opts.hash),
      createdAt, flowClass: leg.flowClass, transferGroupId: p.transferGroupId,
    });
    await moveBalance(s, cmd.userId, leg.accountId, leg.direction === "OUTFLOW" ? -p.amount : p.amount);
  }
  return { status: "applied", replayed: false, data: { transferGroupId: p.transferGroupId } };
}
