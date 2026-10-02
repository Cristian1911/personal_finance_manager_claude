import { sha256 } from "../../utils/idempotency";
import { cleanDescription, matchDestinatario } from "../../utils/destinatario-matcher";
import { isV2Category } from "../categories";
import type { EngineOptions } from "../runner";
import type { CommandEnvelope, CommandResult, StoragePort } from "../types";
import { UUID_RE } from "../validate";
import { isNewer } from "./field-version";

const bad = (error: string, code: "invalid" | "not_found" = "invalid"): CommandResult => ({ status: "rejected", replayed: false, code, error });

/** Same id on every device for the same rule. */
async function ruleId(destinatarioId: string, pattern: string, hash = sha256): Promise<string> {
  const h = (await hash(`rule|${destinatarioId}|${pattern.toLowerCase()}`)).slice(0, 32);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** What to remember from a movement's text: noise and numbers out ("COMPRA RAPPI 1234" → "RAPPI"). */
export function patternFrom(text: string): string {
  return cleanDescription(text).slice(0, 60);
}

/**
 * On capture: the first destinatario rule the text matches (v1's matcher,
 * exact before contains, by priority) gives the movement its destinatario
 * and that destinatario's category. Not a user choice: no field version, so
 * anything the user picks later wins.
 */
export async function matchOnCapture(s: StoragePort, userId: string, text: string): Promise<{ destinatarioId: string | null; categoryId: string | null }> {
  const m = matchDestinatario(text, await s.listDestinatarioRules(userId));
  return { destinatarioId: m?.destinatario_id ?? null, categoryId: m?.category_id ?? null };
}

/** The category of a movement (Categoría quick action, Detalle). Latest choice wins. */
export async function setTransactionCategory(s: StoragePort, cmd: CommandEnvelope<{ transactionId: string; categoryId: string | null }>): Promise<CommandResult> {
  const p = cmd.payload;
  if (!p || !UUID_RE.test(p.transactionId ?? "")) return bad("Identificador inválido.");
  if (p.categoryId !== null && (typeof p.categoryId !== "string" || !isV2Category(p.categoryId))) return bad("Categoría inválida.");
  if (!(await s.getTransaction(cmd.userId, p.transactionId))) return bad("Movimiento no encontrado.", "not_found");
  const current = await s.getFieldVersion(cmd.userId, "transaction", p.transactionId, "category_id");
  if (current && isNewer(current, cmd.clientTs, cmd.id)) return { status: "superseded", replayed: false };
  await s.updateTransactionLabels(cmd.userId, p.transactionId, { category_id: p.categoryId });
  await s.setFieldVersion({ userId: cmd.userId, entity: "transaction", entityId: p.transactionId, field: "category_id", clientTs: cmd.clientTs, commandId: cmd.id });
  return { status: "applied", replayed: false };
}

export interface CreateDestinatarioPayload {
  destinatarioId: string;
  name: string;
  kind: "merchant" | "person";
  /** Bank text that means this destinatario ('contains'). */
  pattern?: string | null;
  defaultCategoryId?: string | null;
}

/** A new comercio or persona (picker › "+ Nuevo"). */
export async function createDestinatario(s: StoragePort, cmd: CommandEnvelope<CreateDestinatarioPayload>, opts: EngineOptions = {}): Promise<CommandResult> {
  const p = cmd.payload;
  if (!p || !UUID_RE.test(p.destinatarioId ?? "")) return bad("Identificador inválido.");
  if (typeof p.name !== "string" || !p.name.trim()) return bad("Escribe un nombre.");
  if (p.name.trim().length > 60) return bad("El nombre es muy largo.");
  if (p.kind !== "merchant" && p.kind !== "person") return bad("Elige comercio o persona.");
  if (p.defaultCategoryId != null && !isV2Category(p.defaultCategoryId)) return bad("Categoría inválida.");
  if (p.pattern != null && (typeof p.pattern !== "string" || p.pattern.length > 60)) return bad("El texto es muy largo.");
  if (await s.getDestinatario(cmd.userId, p.destinatarioId)) return { status: "duplicate", replayed: false, data: { destinatarioId: p.destinatarioId } };
  await s.insertDestinatario({ id: p.destinatarioId, userId: cmd.userId, name: p.name.trim(), kind: p.kind, defaultCategoryId: p.defaultCategoryId ?? null }, cmd.clientTs);
  const pattern = p.pattern?.trim();
  if (pattern) await s.addDestinatarioRule(cmd.userId, await ruleId(p.destinatarioId, pattern, opts.hash), p.destinatarioId, pattern, cmd.clientTs);
  return { status: "applied", replayed: false, data: { destinatarioId: p.destinatarioId } };
}

/**
 * Who a movement is (Destinatario quick action). `remember`: its text becomes
 * a pattern, so the next one is recognized. When the movement has no category
 * chosen by hand, it takes the destinatario's.
 */
export async function setTransactionDestinatario(
  s: StoragePort,
  cmd: CommandEnvelope<{ transactionId: string; destinatarioId: string | null; remember?: boolean }>,
  opts: EngineOptions = {},
): Promise<CommandResult> {
  const p = cmd.payload;
  if (!p || !UUID_RE.test(p.transactionId ?? "") || (p.destinatarioId !== null && !UUID_RE.test(p.destinatarioId ?? ""))) return bad("Identificador inválido.");
  const tx = await s.getTransaction(cmd.userId, p.transactionId);
  if (!tx) return bad("Movimiento no encontrado.", "not_found");
  const d = p.destinatarioId ? await s.getDestinatario(cmd.userId, p.destinatarioId) : null;
  if (p.destinatarioId && !d) return bad("Destinatario no encontrado.", "not_found");
  const current = await s.getFieldVersion(cmd.userId, "transaction", tx.id, "destinatario_id");
  if (current && isNewer(current, cmd.clientTs, cmd.id)) return { status: "superseded", replayed: false };
  const patch: { destinatario_id: string | null; category_id?: string | null } = { destinatario_id: p.destinatarioId };
  const userCategory = await s.getFieldVersion(cmd.userId, "transaction", tx.id, "category_id");
  if (!userCategory && d?.defaultCategoryId) patch.category_id = d.defaultCategoryId;
  await s.updateTransactionLabels(cmd.userId, tx.id, patch);
  await s.setFieldVersion({ userId: cmd.userId, entity: "transaction", entityId: tx.id, field: "destinatario_id", clientTs: cmd.clientTs, commandId: cmd.id });
  const pattern = tx.cleanDescription ? patternFrom(tx.cleanDescription) : "";
  if (p.remember && d && pattern) await s.addDestinatarioRule(cmd.userId, await ruleId(d.id, pattern, opts.hash), d.id, pattern, cmd.clientTs);
  return { status: "applied", replayed: false };
}

/**
 * "¿Siempre Domicilios para Rappi?": the destinatario's default category;
 * `applyToPast` also sets it on its movements whose category wasn't chosen
 * by hand.
 */
export async function setDestinatarioCategory(
  s: StoragePort,
  cmd: CommandEnvelope<{ destinatarioId: string; categoryId: string | null; applyToPast?: boolean }>,
): Promise<CommandResult> {
  const p = cmd.payload;
  if (!p || !UUID_RE.test(p.destinatarioId ?? "")) return bad("Identificador inválido.");
  if (p.categoryId !== null && (typeof p.categoryId !== "string" || !isV2Category(p.categoryId))) return bad("Categoría inválida.");
  if (!(await s.getDestinatario(cmd.userId, p.destinatarioId))) return bad("Destinatario no encontrado.", "not_found");
  const current = await s.getFieldVersion(cmd.userId, "destinatario", p.destinatarioId, "default_category_id");
  if (current && isNewer(current, cmd.clientTs, cmd.id)) return { status: "superseded", replayed: false };
  await s.setDestinatarioDefaultCategory(cmd.userId, p.destinatarioId, p.categoryId, cmd.clientTs);
  await s.setFieldVersion({ userId: cmd.userId, entity: "destinatario", entityId: p.destinatarioId, field: "default_category_id", clientTs: cmd.clientTs, commandId: cmd.id });
  let changed = 0;
  if (p.applyToPast) {
    for (const tx of await s.listTransactionsByDestinatario(cmd.userId, p.destinatarioId)) {
      if (await s.getFieldVersion(cmd.userId, "transaction", tx.id, "category_id")) continue; // chosen by hand: it stays
      await s.updateTransactionLabels(cmd.userId, tx.id, { category_id: p.categoryId });
      changed++;
    }
  }
  return { status: "applied", replayed: false, data: { changed } };
}
