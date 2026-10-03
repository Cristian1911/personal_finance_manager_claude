import { HELD_ERROR, isHeld, isMerged } from "./reconciled";
import type { CommandEnvelope, CommandResult, StoragePort } from "../types";
import { UUID_RE } from "../validate";
import { MANUAL_CAPTURE_METHODS } from "./delete-transaction";
import { isNewer } from "./field-version";
import { isIsoDate, isMoney } from "./validate-money";
import { moveBalance } from "./balance";
import type { EngineOptions } from "../runner";
import { autoLinkPayment, unlinkPayment } from "./pagos";
import { matchOnCapture } from "./categorias";

export interface EditTransactionPayload {
  transactionId: string;
  amount?: number;
  date?: string;
  accountId?: string;
  /** Its name, as you wrote it. */
  description?: string;
  /** "HH:mm" (Colombia), or null to fall back to when it was captured. */
  time?: string | null;
}

const FIELDS = [
  { key: "amount", field: "amount" },
  { key: "date", field: "transaction_date" },
  { key: "accountId", field: "account_id" },
  { key: "description", field: "clean_description" },
  { key: "time", field: "transaction_time" },
] as const;

/**
 * Fix the amount, date or account of a manual entry (D7). Bank movements keep
 * the bank's facts (S1-2). Each field is versioned on its own: the latest
 * clientTs wins per field, so two devices editing different fields both stick.
 * Balances follow: the old effect comes off the old account, the new one goes
 * on the (possibly new) account.
 */
export async function editTransaction(
  s: StoragePort,
  cmd: CommandEnvelope<EditTransactionPayload>,
  opts: EngineOptions = {},
): Promise<CommandResult> {
  const p = cmd.payload;
  const bad = (error: string): CommandResult => ({ status: "rejected", replayed: false, code: "invalid", error });
  if (!p || !UUID_RE.test(p.transactionId ?? "")) return bad("Identificador inválido.");
  if (FIELDS.every(({ key }) => p[key] === undefined)) return bad("No hay nada que cambiar.");
  if (p.description !== undefined && (typeof p.description !== "string" || !p.description.trim() || p.description.length > 200)) return bad("Escribe un nombre.");
  if (p.time != null && (typeof p.time !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(p.time))) return bad("Hora inválida.");
  if (p.amount !== undefined && (!isMoney(p.amount) || p.amount <= 0)) return bad("El monto debe ser mayor que cero.");
  if (p.date !== undefined && !isIsoDate(p.date)) return bad("Fecha inválida.");
  if (p.accountId !== undefined && !UUID_RE.test(p.accountId)) return bad("Cuenta inválida.");

  const tx = await s.getTransaction(cmd.userId, p.transactionId);
  if (!tx) return { status: "rejected", replayed: false, code: "not_found", error: "Movimiento no encontrado." };
  // Merged into the bank's row (a phone that hadn't pulled yet): the bank's facts stand, nothing moves twice.
  if (isMerged(tx)) return { status: "superseded", replayed: false };
  if (isHeld(tx)) return { status: "rejected", replayed: false, code: "invalid", error: HELD_ERROR };
  if (!MANUAL_CAPTURE_METHODS.has(tx.captureMethod)) return bad("Los datos del banco no se pueden cambiar; puedes ignorar el movimiento.");
  if (tx.transferGroupId) return bad("Para cambiar un movimiento entre cuentas, bórralo y anótalo de nuevo.");
  if (p.accountId !== undefined && !(await s.getAccount(cmd.userId, p.accountId))) {
    return { status: "rejected", replayed: false, code: "not_found", error: "Cuenta no encontrada." };
  }

  const next = { amount: tx.amount, transactionDate: tx.transactionDate, accountId: tx.accountId, cleanDescription: tx.cleanDescription, transactionTime: tx.transactionTime };
  let changed = 0;
  for (const { key, field } of FIELDS) {
    if (p[key] === undefined) continue;
    const current = await s.getFieldVersion(cmd.userId, "transaction", tx.id, field);
    if (current && isNewer(current, cmd.clientTs, cmd.id)) continue; // a newer edit of this field already won
    if (key === "amount") next.amount = p.amount!;
    if (key === "date") next.transactionDate = p.date!;
    if (key === "accountId") next.accountId = p.accountId!;
    if (key === "description") next.cleanDescription = p.description!.trim();
    if (key === "time") next.transactionTime = p.time ?? null;
    await s.setFieldVersion({ userId: cmd.userId, entity: "transaction", entityId: tx.id, field, clientTs: cmd.clientTs, commandId: cmd.id });
    changed++;
  }
  if (changed === 0) return { status: "superseded", replayed: false };

  const sign = tx.direction === "OUTFLOW" ? -1 : 1;
  await s.updateTransactionFacts(cmd.userId, tx.id, next);
  // A new name runs the destinatario rules again ("Ifood" → Ifood), unless you chose who it is by hand.
  if (next.cleanDescription !== tx.cleanDescription && !(await s.getFieldVersion(cmd.userId, "transaction", tx.id, "destinatario_id"))) {
    const m = await matchOnCapture(s, cmd.userId, next.cleanDescription ?? "");
    if (m.destinatarioId) {
      const handCategory = await s.getFieldVersion(cmd.userId, "transaction", tx.id, "category_id");
      await s.updateTransactionLabels(cmd.userId, tx.id, { destinatario_id: m.destinatarioId, ...(handCategory ? {} : { category_id: m.categoryId }) });
    }
  }
  const moved = next.amount !== tx.amount || next.transactionDate !== tx.transactionDate || next.accountId !== tx.accountId;
  if (!tx.isExcluded && moved) { // an ignored movement isn't in any balance
    await moveBalance(s, cmd.userId, tx.accountId, -sign * tx.amount, tx.currencyCode);
    await moveBalance(s, cmd.userId, next.accountId, sign * next.amount, tx.currencyCode);
    // New amount, date or account: check again which bill it pays.
    await unlinkPayment(s, cmd.userId, tx.id, cmd.clientTs, opts);
    await autoLinkPayment(s, cmd.userId, { ...tx, ...next }, cmd.clientTs, opts);
  }
  return { status: "applied", replayed: false };
}
