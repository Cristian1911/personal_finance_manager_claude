import { addDays, format, parseISO } from "date-fns";
import { getCaptureTier } from "../../utils/capture-hierarchy";
import { classifyFlow, FLOW_CLASS_RULES_VERSION } from "../../utils/flow-class";
import { computeIdempotencyKey } from "../../utils/idempotency";
import { findReconciliationCandidates, type ReconciliationCandidate } from "../../utils/reconciliation";
import type { TransactionCaptureMethod } from "../../types/domain";
import type { EngineOptions } from "../runner";
import type { CommandEnvelope, CommandResult, StoragePort, TransactionRow } from "../types";
import { UUID_RE } from "../validate";
import { moveBalance } from "./balance";
import { matchOnCapture } from "./categorias";
import { autoLinkPayment, relinkPayment } from "./pagos";
import { isIsoDate, isMoney } from "./validate-money";

/**
 * A movement the bank told us about (S9-3). Built by the server from a bank
 * email (parseBancolombiaEmail); a PDF statement will use the same command
 * with source "PDF". Never sent by the phone.
 */
export interface CaptureBankTransactionPayload {
  transactionId: string;
  accountId: string;
  source: "EMAIL";
  amount: number;
  direction: "INFLOW" | "OUTFLOW";
  currencyCode: string;
  date: string;
  /** "HH:mm" when the bank said it. */
  time?: string | null;
  /** The bank's own line: feeds the idempotency key exactly like v1 (`raw_line`). */
  rawLine: string;
  /** What to show: merchant ?? destination ?? rawLine. */
  description: string;
  merchantName?: string | null;
  /** The parser's alert family ("compra_debito", "transferencia"…), evidence for the flow class. */
  sourcePattern?: string | null;
}

const METHOD: Record<CaptureBankTransactionPayload["source"], TransactionCaptureMethod> = { EMAIL: "EMAIL_IMPORT" };
/** ±3 days: the date tolerance of scoreReconciliationCandidate. */
const WINDOW_DAYS = 3;

function validate(p: CaptureBankTransactionPayload): string | null {
  if (!p || typeof p !== "object") return "Datos del movimiento inválidos.";
  if (!UUID_RE.test(p.transactionId ?? "") || !UUID_RE.test(p.accountId ?? "")) return "Identificador inválido.";
  if (!(p.source in METHOD)) return "Origen inválido.";
  if (!isMoney(p.amount) || p.amount <= 0) return "Monto inválido.";
  if (p.direction !== "INFLOW" && p.direction !== "OUTFLOW") return "Dirección inválida.";
  if (typeof p.currencyCode !== "string" || !/^[A-Z]{3}$/.test(p.currencyCode)) return "Moneda inválida.";
  if (!isIsoDate(p.date)) return "Fecha inválida.";
  if (p.time != null && !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time)) return "Hora inválida.";
  if (typeof p.rawLine !== "string" || !p.rawLine.trim() || p.rawLine.length > 1000) return "Texto del banco inválido.";
  if (typeof p.description !== "string" || !p.description.trim() || p.description.length > 200) return "Descripción inválida.";
  if (p.merchantName != null && (typeof p.merchantName !== "string" || p.merchantName.length > 200)) return "Comercio inválido.";
  if (p.sourcePattern != null && (typeof p.sourcePattern !== "string" || p.sourcePattern.length > 40)) return "Tipo de alerta inválido.";
  return null;
}

const signed = (t: { direction: "INFLOW" | "OUTFLOW"; amount: number }) => (t.direction === "OUTFLOW" ? -t.amount : t.amount);

function asCandidate(t: TransactionRow): ReconciliationCandidate {
  return {
    id: t.id, user_id: t.userId, account_id: t.accountId, amount: t.amount, direction: t.direction,
    transaction_date: t.transactionDate, raw_description: t.rawDescription, clean_description: t.cleanDescription,
    category_id: t.categoryId, notes: t.notes, capture_method: t.captureMethod as TransactionCaptureMethod,
    transaction_time: t.transactionTime, source_pattern: t.sourcePattern, currency_code: t.currencyCode,
  };
}

/**
 * Records the bank's movement. Conflicts follow S1-2:
 * - the literal same alert again (webhook retry) → duplicate, by v1's idempotency key;
 * - a strong match with something lower in the hierarchy (what you anotaste) → the
 *   bank's row takes over: bank facts win; your category / destinatario / note (and
 *   their versions), the bill it paid and its balance effect carry over;
 * - a strong match with something higher (the PDF already has it) → duplicate;
 * - a weak match across tiers ("Almuerzo" vs CREPES Y WAFFLES, same amount) → never
 *   resolved alone: held (PENDING, pointing at its likely twin), not counted, until
 *   Revisar's "¿Es el mismo?" (resolveBankDuplicate);
 * - same tier or nothing → a new movement (two coffees of the same price are two emails).
 */
export async function captureBankTransaction(
  s: StoragePort,
  cmd: CommandEnvelope<CaptureBankTransactionPayload>,
  opts: EngineOptions = {},
): Promise<CommandResult> {
  const p = cmd.payload;
  const error = validate(p);
  if (error) return { status: "rejected", replayed: false, code: "invalid", error };
  const account = await s.getAccount(cmd.userId, p.accountId);
  if (!account) return { status: "rejected", replayed: false, code: "not_found", error: "Cuenta no encontrada." };
  if (await s.getTransaction(cmd.userId, p.transactionId)) {
    return { status: "duplicate", replayed: false, data: { transactionId: p.transactionId } };
  }

  // Exactly v1's email key (route.ts): provider, date, amount, the bank's line.
  const idempotencyKey = await computeIdempotencyKey({
    provider: p.source, transactionDate: p.date, amount: p.amount, rawDescription: p.rawLine,
  }, opts.hash);
  const same = await s.findTransactionByIdempotencyKey(cmd.userId, idempotencyKey);
  if (same) return { status: "duplicate", replayed: false, data: { transactionId: same.id } };

  const method = METHOD[p.source];
  const tier = getCaptureTier(method);
  const day = parseISO(p.date);
  const candidates = await s.listReconciliationCandidates(
    cmd.userId, p.accountId, format(addDays(day, -WINDOW_DAYS), "yyyy-MM-dd"), format(addDays(day, WINDOW_DAYS), "yyyy-MM-dd"));
  const { bestMatch } = findReconciliationCandidates({
    account_id: p.accountId, amount: p.amount, direction: p.direction, transaction_date: p.date, raw_description: p.rawLine,
    capture_method: method, transaction_time: p.time ?? null, source_pattern: p.sourcePattern ?? null, currency_code: p.currencyCode,
  }, candidates.map(asCandidate));
  const twin = bestMatch && bestMatch.decision !== "NO_MATCH" ? candidates.find((c) => c.id === bestMatch.candidateId) : undefined;
  const twinTier = twin ? getCaptureTier(twin.captureMethod as TransactionCaptureMethod) : tier;
  // The statement (higher) already has it, strongly or weakly: it's the authority, this is a duplicate.
  if (twin && twinTier < tier) return { status: "duplicate", replayed: false, data: { transactionId: twin.id } };
  const replaces = twin && bestMatch!.decision === "AUTO_MERGE" && twinTier > tier ? twin : undefined;
  const held = twin && bestMatch!.decision === "REVIEW" && twinTier > tier ? twin : undefined;

  const matched = await matchOnCapture(s, cmd.userId, p.merchantName ?? p.description);
  const { flowClass } = classifyFlow({ direction: p.direction, accountType: account.accountType, description: p.description, sourcePattern: p.sourcePattern ?? null });
  await s.insertTransaction({
    id: p.transactionId,
    userId: cmd.userId,
    accountId: p.accountId,
    amount: p.amount,
    currencyCode: p.currencyCode,
    direction: p.direction,
    transactionDate: p.date,
    cleanDescription: p.description.trim(),
    notes: null,
    captureMethod: method as "EMAIL_IMPORT",
    idempotencyKey,
    flowClass,
    flowClassVersion: FLOW_CLASS_RULES_VERSION,
    transferGroupId: null,
    categoryId: matched.categoryId,
    destinatarioId: matched.destinatarioId,
    rawDescription: p.rawLine,
    transactionTime: p.time ?? null,
    merchantName: p.merchantName ?? null,
    sourcePattern: p.sourcePattern ?? null,
    provider: p.source,
    status: held ? "PENDING" : "POSTED",
    reconciledIntoTransactionId: held?.id ?? null,
    createdAt: cmd.clientTs,
  });
  const row = (await s.getTransaction(cmd.userId, p.transactionId))!;
  if (held) return { status: "applied", replayed: false, data: { transactionId: p.transactionId, heldFor: held.id } };
  if (replaces) {
    await takeOver(s, cmd, row, replaces, opts);
    return { status: "applied", replayed: false, data: { transactionId: p.transactionId, mergedFrom: replaces.id } };
  }
  await post(s, cmd, row, opts);
  return { status: "applied", replayed: false, data: { transactionId: p.transactionId } };
}

/** A movement that counts on its own: the balance and bill detection, like any capture. */
async function post(s: StoragePort, cmd: CommandEnvelope, row: TransactionRow, opts: EngineOptions) {
  await moveBalance(s, cmd.userId, row.accountId, signed(row));
  await autoLinkPayment(s, cmd.userId, row, cmd.clientTs, opts);
}

/** A held movement that turns out to be its own (Revisar's "No, son dos", or its twin was deleted): it counts. */
export async function releaseHeld(s: StoragePort, cmd: CommandEnvelope, held: TransactionRow, opts: EngineOptions = {}) {
  await s.setReconciliation(cmd.userId, held.id, null, "POSTED");
  await post(s, cmd, { ...held, status: "POSTED", reconciledIntoTransactionId: null }, opts);
}

/** The bank's row becomes the movement `twin` was: twin stops counting, its choices and bill move over. */
async function takeOver(s: StoragePort, cmd: CommandEnvelope, bank: TransactionRow, twin: TransactionRow, opts: EngineOptions) {
  await s.setReconciliation(cmd.userId, twin.id, bank.id, "POSTED");
  // An Entre cuentas leg stays a transfer; a class set by hand (Anotar's Gasto/Ingreso, version 0) is the user's word.
  const hand = twin.flowClassVersion === 0 && twin.flowClass;
  if (twin.transferGroupId || hand) {
    await s.updateTransactionFlow(cmd.userId, bank.id, {
      flowClass: hand ? twin.flowClass : bank.flowClass, flowClassVersion: hand ? 0 : bank.flowClassVersion,
      transferGroupId: twin.transferGroupId ?? bank.transferGroupId,
    });
  }
  // "No es un movimiento" was your choice: the bank's row stays ignored (and out of the balance).
  if (twin.isExcluded) await s.updateTransactionExcluded(cmd.userId, bank.id, true);
  await s.updateTransactionLabels(cmd.userId, bank.id, {
    category_id: twin.categoryId ?? bank.categoryId, destinatario_id: twin.destinatarioId ?? bank.destinatarioId,
  });
  if (twin.notes) await s.updateTransactionNotes(cmd.userId, bank.id, twin.notes);
  // Your choices stay yours on the new row: their versions travel with them.
  for (const field of ["category_id", "destinatario_id", "notes", "is_excluded"]) {
    const v = await s.getFieldVersion(cmd.userId, "transaction", twin.id, field);
    if (v) await s.setFieldVersion({ userId: cmd.userId, entity: "transaction", entityId: bank.id, field, clientTs: v.clientTs, commandId: v.commandId });
  }
  // Only the difference: the twin already moved the balance. Ignored, neither is in it.
  if (!twin.isExcluded) await moveBalance(s, cmd.userId, bank.accountId, signed(bank) - signed(twin));
  await relinkPayment(s, cmd.userId, twin.id, bank.id, cmd.clientTs, opts);
}

/** Revisar's "¿Es el mismo que anotaste?" for a held bank movement: once. */
export async function resolveBankDuplicate(
  s: StoragePort,
  cmd: CommandEnvelope<{ transactionId: string; same: boolean }>,
  opts: EngineOptions = {},
): Promise<CommandResult> {
  const p = cmd.payload;
  if (!p || !UUID_RE.test(p.transactionId ?? "") || typeof p.same !== "boolean") {
    return { status: "rejected", replayed: false, code: "invalid", error: "Datos inválidos." };
  }
  const row = await s.getTransaction(cmd.userId, p.transactionId);
  if (!row) return { status: "rejected", replayed: false, code: "not_found", error: "Movimiento no encontrado." };
  if (row.status !== "PENDING") return { status: "rejected", replayed: false, code: "invalid", error: "Ya respondiste esto." };
  const twin = row.reconciledIntoTransactionId ? await s.getTransaction(cmd.userId, row.reconciledIntoTransactionId) : null;
  // The twin may be gone (deleted, or merged elsewhere) since: then it's simply a new movement.
  if (p.same && twin && !twin.reconciledIntoTransactionId) {
    await s.setReconciliation(cmd.userId, row.id, null, "POSTED");
    await takeOver(s, cmd, { ...row, status: "POSTED", reconciledIntoTransactionId: null }, twin, opts);
  } else {
    await releaseHeld(s, cmd, row, opts);
  }
  return { status: "applied", replayed: false };
}
