import { sha256, type HashFn } from "../../utils/idempotency";
import { calendarDayDiff, occurrenceAmountMatches, OCCURRENCE_AUTO_LINK_DAY_WINDOW } from "../../utils/occurrence-matching";
import { getOccurrencesBetween } from "../../utils/recurrence";
import type { EngineOptions } from "../runner";
import type { CommandEnvelope, CommandResult, OccurrenceRow, StoragePort, TemplateRow, TransactionRow } from "../types";
import { UUID_RE } from "../validate";
import { isNewer } from "./field-version";
import { isIsoDate, isMoney } from "./validate-money";

export interface CreatePagoFijoPayload {
  templateId: string;
  name: string;
  amount: number;
  /** 1–28: the server steps month by month, so 29–31 would drift (owner note D12). */
  dayOfMonth: number;
  accountId?: string | null;
  /** The first due date (YYYY-MM-DD, on dayOfMonth). */
  startDate: string;
}

export interface EditPagoFijoPayload {
  templateId: string;
  name?: string;
  amount?: number;
}

export interface ArchivePagoFijoPayload {
  templateId: string;
  archived: boolean;
}

export interface SetOccurrenceStatusPayload {
  templateId: string;
  date: string;
  status: "pending" | "paid" | "skipped";
  /** "Ya lo pagué" with the movement that paid it; none = paid elsewhere. */
  transactionId?: string | null;
}

const bad = (error: string, code: "invalid" | "not_found" = "invalid"): CommandResult => ({ status: "rejected", replayed: false, code, error });
const noon = (d: string) => new Date(`${d}T12:00:00`);
const addDays = (d: string, n: number) => {
  const x = new Date(`${d}T12:00:00Z`);
  x.setUTCDate(x.getUTCDate() + n);
  return x.toISOString().slice(0, 10);
};

/** The template's due dates between two days (inclusive), as the shared recurrence computes them. */
export function occurrenceDates(t: Pick<TemplateRow, "startDate" | "frequency" | "endDate">, from: string, to: string): string[] {
  return getOccurrencesBetween(t.startDate, t.frequency as never, t.endDate, noon(from), noon(to));
}

/** Same id on every device for the same (template, date): a hash, shaped like a uuid. */
async function occurrenceId(templateId: string, date: string, hash: HashFn = sha256): Promise<string> {
  const h = (await hash(`occurrence|${templateId}|${date}`)).slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function writeOccurrence(s: StoragePort, userId: string, t: TemplateRow, row: Omit<OccurrenceRow, "templateId" | "expectedAmount">, at: string, opts: EngineOptions) {
  const current = await s.getOccurrence(userId, t.id, row.date);
  await s.upsertOccurrence(userId, await occurrenceId(t.id, row.date, opts.hash), {
    templateId: t.id, expectedAmount: current?.expectedAmount ?? t.amount, ...row,
  }, at);
}

/**
 * Bill detection (v1 occurrence-matching rules, shared): a spend within ±3
 * days of a due date whose amount is within 1% pays that bill, unless it was
 * already paid or skipped. The closest date wins.
 */
export async function autoLinkPayment(s: StoragePort, userId: string, tx: TransactionRow, at: string, opts: EngineOptions = {}): Promise<void> {
  if (tx.direction !== "OUTFLOW" || tx.isExcluded || tx.transferGroupId) return;
  const w = OCCURRENCE_AUTO_LINK_DAY_WINDOW;
  let best: { t: TemplateRow; date: string; diff: number } | null = null;
  for (const t of await s.listTemplates(userId, "OUTFLOW")) {
    for (const date of occurrenceDates(t, addDays(tx.transactionDate, -w), addDays(tx.transactionDate, w))) {
      const stored = await s.getOccurrence(userId, t.id, date);
      if (stored && stored.status !== "pending") continue;
      if (!occurrenceAmountMatches(stored?.expectedAmount ?? t.amount, tx.amount, false)) continue;
      const diff = Math.abs(calendarDayDiff(tx.transactionDate, date));
      if (!best || diff < best.diff) best = { t, date, diff };
    }
  }
  if (best) await writeOccurrence(s, userId, best.t, { date: best.date, status: "paid", transactionId: tx.id, linkedManually: false }, at, opts);
}

/** When a movement goes away, the bills it paid are pending again. */
export async function unlinkPayment(s: StoragePort, userId: string, transactionId: string, at: string, opts: EngineOptions = {}): Promise<void> {
  for (const o of await s.findOccurrencesByTransaction(userId, transactionId)) {
    await s.upsertOccurrence(userId, await occurrenceId(o.templateId, o.date, opts.hash), { ...o, status: "pending", transactionId: null, linkedManually: false }, at);
  }
}

/** Pagos › Agregar pago fijo: a monthly bill. A payment already made near its first date is found right away. */
export async function createPagoFijo(s: StoragePort, cmd: CommandEnvelope<CreatePagoFijoPayload>, opts: EngineOptions = {}): Promise<CommandResult> {
  const p = cmd.payload;
  if (!p || !UUID_RE.test(p.templateId ?? "") || (p.accountId != null && !UUID_RE.test(p.accountId))) return bad("Identificador inválido.");
  if (typeof p.name !== "string" || !p.name.trim()) return bad("Escribe qué pagas.");
  if (p.name.trim().length > 60) return bad("El nombre es muy largo.");
  if (!isMoney(p.amount) || p.amount <= 0) return bad("El monto debe ser mayor que cero.");
  if (!Number.isInteger(p.dayOfMonth) || p.dayOfMonth < 1 || p.dayOfMonth > 28) return bad("El día va del 1 al 28.");
  if (!isIsoDate(p.startDate) || Number(p.startDate.slice(8)) !== p.dayOfMonth) return bad("Fecha inválida.");
  if (p.accountId && !(await s.getAccount(cmd.userId, p.accountId))) return bad("Cuenta no encontrada.", "not_found");
  if (await s.getTemplate(cmd.userId, p.templateId)) return { status: "duplicate", replayed: false, data: { templateId: p.templateId } };

  const t: TemplateRow = {
    id: p.templateId, userId: cmd.userId, accountId: p.accountId ?? null, amount: p.amount, currencyCode: "COP",
    direction: "OUTFLOW", frequency: "MONTHLY", dayOfMonth: p.dayOfMonth, startDate: p.startDate, endDate: null,
    name: p.name.trim(), isActive: true,
  };
  await s.insertTemplate(t, cmd.clientTs);
  // Already paid? Look at movements around the first due date.
  for (const tx of await s.listTransactionsSince(cmd.userId, addDays(p.startDate, -OCCURRENCE_AUTO_LINK_DAY_WINDOW))) {
    if (tx.transactionDate > addDays(p.startDate, OCCURRENCE_AUTO_LINK_DAY_WINDOW)) break;
    if ((await s.findOccurrencesByTransaction(cmd.userId, tx.id)).length) continue;
    await autoLinkPayment(s, cmd.userId, tx, cmd.clientTs, opts);
  }
  return { status: "applied", replayed: false, data: { templateId: p.templateId } };
}

async function versioned(s: StoragePort, cmd: CommandEnvelope<{ templateId: string }>, field: string): Promise<boolean> {
  const current = await s.getFieldVersion(cmd.userId, "recurring_template", cmd.payload.templateId, field);
  if (current && isNewer(current, cmd.clientTs, cmd.id)) return false;
  await s.setFieldVersion({ userId: cmd.userId, entity: "recurring_template", entityId: cmd.payload.templateId, field, clientTs: cmd.clientTs, commandId: cmd.id });
  return true;
}

/** Name and amount; the day stays (changing it would move every due date). */
export async function editPagoFijo(s: StoragePort, cmd: CommandEnvelope<EditPagoFijoPayload>): Promise<CommandResult> {
  const p = cmd.payload;
  if (!p || !UUID_RE.test(p.templateId ?? "")) return bad("Identificador inválido.");
  if (p.name !== undefined && (typeof p.name !== "string" || !p.name.trim() || p.name.trim().length > 60)) return bad("Escribe qué pagas.");
  if (p.amount !== undefined && (!isMoney(p.amount) || p.amount <= 0)) return bad("El monto debe ser mayor que cero.");
  if (p.name === undefined && p.amount === undefined) return bad("No hay nada que cambiar.");
  if (!(await s.getTemplate(cmd.userId, p.templateId))) return bad("Pago no encontrado.", "not_found");
  const patch: { merchant_name?: string; description?: string; amount?: number } = {};
  if (p.name !== undefined && (await versioned(s, cmd, "merchant_name"))) patch.merchant_name = patch.description = p.name.trim();
  if (p.amount !== undefined && (await versioned(s, cmd, "amount"))) patch.amount = p.amount;
  if (Object.keys(patch).length === 0) return { status: "superseded", replayed: false };
  await s.updateTemplate(cmd.userId, p.templateId, patch, cmd.clientTs);
  return { status: "applied", replayed: false };
}

export async function archivePagoFijo(s: StoragePort, cmd: CommandEnvelope<ArchivePagoFijoPayload>): Promise<CommandResult> {
  const p = cmd.payload;
  if (!p || !UUID_RE.test(p.templateId ?? "") || typeof p.archived !== "boolean") return bad("Datos inválidos.");
  if (!(await s.getTemplate(cmd.userId, p.templateId))) return bad("Pago no encontrado.", "not_found");
  if (!(await versioned(s, cmd, "is_active"))) return { status: "superseded", replayed: false };
  await s.updateTemplate(cmd.userId, p.templateId, { is_active: !p.archived }, cmd.clientTs);
  return { status: "applied", replayed: false };
}

/** Ya lo pagué / Este mes no / back to pending, for one due date. Latest choice wins. */
export async function setOccurrenceStatus(s: StoragePort, cmd: CommandEnvelope<SetOccurrenceStatusPayload>, opts: EngineOptions = {}): Promise<CommandResult> {
  const p = cmd.payload;
  if (!p || !UUID_RE.test(p.templateId ?? "") || (p.transactionId != null && !UUID_RE.test(p.transactionId))) return bad("Identificador inválido.");
  if (!isIsoDate(p.date) || !["pending", "paid", "skipped"].includes(p.status)) return bad("Datos inválidos.");
  const t = await s.getTemplate(cmd.userId, p.templateId);
  if (!t) return bad("Pago no encontrado.", "not_found");
  if (!occurrenceDates(t, p.date, p.date).includes(p.date)) return bad("Ese día no le toca a este pago.");
  if (p.transactionId && !(await s.getTransaction(cmd.userId, p.transactionId))) return bad("Movimiento no encontrado.", "not_found");
  const current = await s.getFieldVersion(cmd.userId, "recurring_template", t.id, `occurrence:${p.date}`);
  if (current && isNewer(current, cmd.clientTs, cmd.id)) return { status: "superseded", replayed: false };
  await writeOccurrence(s, cmd.userId, t, {
    date: p.date, status: p.status, transactionId: p.status === "paid" ? p.transactionId ?? null : null, linkedManually: p.status === "paid",
  }, cmd.clientTs, opts);
  await s.setFieldVersion({ userId: cmd.userId, entity: "recurring_template", entityId: t.id, field: `occurrence:${p.date}`, clientTs: cmd.clientTs, commandId: cmd.id });
  return { status: "applied", replayed: false };
}
