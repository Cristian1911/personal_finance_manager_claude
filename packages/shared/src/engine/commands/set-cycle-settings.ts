import type { CommandEnvelope, CommandResult, CycleSettingsPatch, StoragePort, StoredPaySchedule } from "../types";
import { isNewer } from "./field-version";
import { isIsoDate, isMoney } from "./validate-money";

/**
 * When the user gets paid and what they set aside (A2, A3, A4, I1, S3-2).
 * Every key is optional; each one present is a separate user choice with its
 * own "latest edit wins" version (S1-2), so two devices editing different
 * questions never undo each other.
 */
export interface SetCycleSettingsPayload {
  schedule?: StoredPaySchedule;
  incomePerCycle?: number | null;
  savingsPerCycle?: number;
  /** "¿Cuánto tienes hoy?"; stamped with the command's clientTs. null clears it. */
  balanceAnchor?: number | null;
  bigPurchaseThreshold?: number;
}

const FIELDS = ["schedule", "incomePerCycle", "savingsPerCycle", "balanceAnchor", "bigPurchaseThreshold"] as const;
type Field = (typeof FIELDS)[number];

const invalid = (error: string): CommandResult => ({ status: "rejected", replayed: false, code: "invalid", error });

const isDay = (d: unknown) => Number.isInteger(d) && (d as number) >= 1 && (d as number) <= 31;

function validateSchedule(s: unknown): string | null {
  if (!s || typeof s !== "object") return "Frecuencia de pago inválida.";
  const x = s as Record<string, unknown>;
  const days = x.paydays;
  switch (x.kind) {
    case "semimonthly":
      return Array.isArray(days) && days.length === 2 && isDay(days[0]) && isDay(days[1]) && days[0] < days[1]
        ? null : "Los días de pago no son válidos.";
    case "monthly":
      return Array.isArray(days) && days.length === 1 && isDay(days[0]) ? null : "Los días de pago no son válidos.";
    case "biweekly":
      return isIsoDate(x.anchor) ? null : "La fecha de pago no es válida.";
    case "irregular":
      return null;
    default:
      return "Frecuencia de pago inválida.";
  }
}

/** Returns a Spanish error message, or null when the payload is valid. */
export function validateSetCycleSettings(p: SetCycleSettingsPayload): string | null {
  if (!p || typeof p !== "object") return "Datos inválidos.";
  if (!FIELDS.some((f) => p[f] !== undefined)) return "No hay nada que guardar.";
  if (p.schedule !== undefined) {
    const e = validateSchedule(p.schedule);
    if (e) return e;
  }
  const nonNegative = (v: unknown) => isMoney(v) && v >= 0;
  if (p.incomePerCycle !== undefined && p.incomePerCycle !== null && !nonNegative(p.incomePerCycle)) return "El monto no es válido.";
  if (p.savingsPerCycle !== undefined && !nonNegative(p.savingsPerCycle)) return "El monto no es válido.";
  // A first-day balance can be negative (overdrawn).
  if (p.balanceAnchor !== undefined && p.balanceAnchor !== null && !isMoney(p.balanceAnchor)) return "El monto no es válido.";
  if (p.bigPurchaseThreshold !== undefined && !(isMoney(p.bigPurchaseThreshold) && p.bigPurchaseThreshold > 0)) return "El monto no es válido.";
  return null;
}

export async function setCycleSettings(
  s: StoragePort,
  cmd: CommandEnvelope<SetCycleSettingsPayload>,
): Promise<CommandResult> {
  const p = cmd.payload;
  const error = validateSetCycleSettings(p);
  if (error) return invalid(error);

  const applied: Field[] = [];
  const superseded: Field[] = [];
  const patch: CycleSettingsPatch = {};
  for (const field of FIELDS) {
    if (p[field] === undefined) continue;
    const current = await s.getFieldVersion(cmd.userId, "cycle_settings", cmd.userId, field);
    if (current && isNewer(current, cmd.clientTs, cmd.id)) {
      superseded.push(field);
      continue;
    }
    applied.push(field);
    if (field === "schedule") patch.schedule = normalize(p.schedule!);
    else if (field === "balanceAnchor") patch.balanceAnchor = p.balanceAnchor === null ? null : { balance: p.balanceAnchor!, at: cmd.clientTs };
    else patch[field] = p[field] as never;
  }

  if (applied.length === 0) return { status: "superseded", replayed: false, data: { applied, superseded } };
  await s.upsertCycleSettings(cmd.userId, patch);
  for (const field of applied) {
    await s.setFieldVersion({
      userId: cmd.userId, entity: "cycle_settings", entityId: cmd.userId,
      field, clientTs: cmd.clientTs, commandId: cmd.id,
    });
  }
  return { status: "applied", replayed: false, data: { applied, superseded } };
}

/** Keep only the keys of the schedule's kind (a payload may carry extras). */
function normalize(s: StoredPaySchedule): StoredPaySchedule {
  switch (s.kind) {
    case "semimonthly": return { kind: "semimonthly", paydays: [s.paydays[0], s.paydays[1]] };
    case "monthly": return { kind: "monthly", paydays: [s.paydays[0]] };
    case "biweekly": return { kind: "biweekly", anchor: s.anchor };
    case "irregular": return { kind: "irregular" };
  }
}
