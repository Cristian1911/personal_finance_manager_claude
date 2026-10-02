import { computeIdempotencyKey } from "../../utils/idempotency";
import type { EngineOptions } from "../runner";
import type { CommandEnvelope, CommandResult, StoragePort } from "../types";
import { UUID_RE, isIsoUtc } from "../validate";
import { moveBalance } from "./balance";

export interface CaptureManualTransactionPayload {
  transactionId: string;
  accountId: string;
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  currencyCode: string;
  date: string;
  description: string;
  notes?: string | null;
  /** Deshacer: the original capture instant, so a re-created movement keeps its time. Not after clientTs. */
  capturedAt?: string;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Returns a Spanish error message, or null when the payload is valid. */
export function validateCaptureManualTransaction(p: CaptureManualTransactionPayload): string | null {
  if (!p || typeof p !== "object") return "Datos del movimiento inválidos.";
  if (!UUID_RE.test(p.transactionId ?? "") || !UUID_RE.test(p.accountId ?? "")) return "Identificador inválido.";
  if (typeof p.amount !== "number" || !Number.isFinite(p.amount) || p.amount <= 0) return "El monto debe ser mayor que cero.";
  // Tolerance, not equality: 0.29 * 100 === 28.999999999999996 in floating point.
  if (Math.abs(Math.round(p.amount * 100) - p.amount * 100) > 1e-6) return "El monto admite máximo dos decimales.";
  if (p.direction !== "INFLOW" && p.direction !== "OUTFLOW") return "Dirección inválida.";
  if (typeof p.currencyCode !== "string" || !/^[A-Z]{3}$/.test(p.currencyCode)) return "Moneda inválida.";
  if (typeof p.date !== "string" || !DATE_RE.test(p.date)) return "Fecha inválida.";
  if (typeof p.description !== "string" || p.description.trim() === "") return "Escribe una descripción.";
  if (p.description.length > 200) return "La descripción es muy larga.";
  if (p.notes != null && (typeof p.notes !== "string" || p.notes.length > 500)) return "La nota es muy larga.";
  return null;
}

export async function captureManualTransaction(
  s: StoragePort,
  cmd: CommandEnvelope<CaptureManualTransactionPayload>,
  opts: EngineOptions = {},
): Promise<CommandResult> {
  const p = cmd.payload;
  const error = validateCaptureManualTransaction(p);
  if (error) return { status: "rejected", replayed: false, code: "invalid", error };
  if (p.capturedAt !== undefined && (!isIsoUtc(p.capturedAt) || p.capturedAt > cmd.clientTs)) {
    return { status: "rejected", replayed: false, code: "invalid", error: "Hora de captura inválida." };
  }

  const account = await s.getAccount(cmd.userId, p.accountId);
  if (!account) return { status: "rejected", replayed: false, code: "not_found", error: "Cuenta no encontrada." };

  // The client-generated id is the movement's identity: resending it (even
  // with edited values) is a duplicate, never a second insert.
  if (await s.getTransaction(cmd.userId, p.transactionId)) {
    return { status: "duplicate", replayed: false, data: { transactionId: p.transactionId } };
  }

  const idempotencyKey = await computeIdempotencyKey({
    provider: "MANUAL",
    providerTransactionId: p.transactionId,
    transactionDate: p.date,
    amount: p.amount,
    rawDescription: p.description.trim(),
  }, opts.hash);
  const existing = await s.findTransactionByIdempotencyKey(cmd.userId, idempotencyKey);
  if (existing) return { status: "duplicate", replayed: false, data: { transactionId: existing.id } };

  await s.insertTransaction({
    id: p.transactionId,
    userId: cmd.userId,
    accountId: p.accountId,
    amount: p.amount,
    currencyCode: p.currencyCode,
    direction: p.direction,
    transactionDate: p.date,
    cleanDescription: p.description.trim(),
    notes: p.notes ?? null,
    captureMethod: "MANUAL_FORM",
    idempotencyKey,
    // When it was captured on the device, not when the server replays it: a
    // movement on the first-cycle balance's day lands before or after it the same everywhere.
    createdAt: p.capturedAt ?? cmd.clientTs,
  });
  await moveBalance(s, cmd.userId, p.accountId, p.direction === "OUTFLOW" ? -p.amount : p.amount);
  return { status: "applied", replayed: false, data: { transactionId: p.transactionId } };
}
