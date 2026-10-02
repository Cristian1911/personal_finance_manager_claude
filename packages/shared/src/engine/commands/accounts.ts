import { setBalanceAsOf } from "./balance";
import { isDebtAccountType } from "../../utils/account-balance";
import type { AccountDetailsPatch, CommandEnvelope, CommandResult, StoragePort } from "../types";
import { UUID_RE } from "../validate";
import { isNewer } from "./field-version";
import { isMoney } from "./validate-money";

/** The kinds Agregar offers (S8-4): cuenta (ahorros/corriente), efectivo, tarjeta, crédito. */
const ACCOUNT_TYPES = new Set(["CHECKING", "SAVINGS", "CASH", "CREDIT_CARD", "LOAN"]);

export interface CreateAccountPayload {
  accountId: string;
  accountType: string;
  name: string;
  institutionName?: string | null;
  mask?: string | null;
  currencyCode: string;
  /** Money you have today; on a card or loan, what you owe (≥ 0). */
  balance: number;
  creditLimit?: number | null;
  cutoffDay?: number | null;
  paymentDay?: number | null;
  monthlyPayment?: number | null;
  /** Created from a statement: its balance comes from the statement's cut, not from today. */
  balanceUnknown?: boolean;
}

export interface EditAccountPayload {
  accountId: string;
  name?: string;
  institutionName?: string | null;
  mask?: string | null;
  creditLimit?: number | null;
  cutoffDay?: number | null;
  paymentDay?: number | null;
  monthlyPayment?: number | null;
}

export interface ArchiveAccountPayload {
  accountId: string;
  archived: boolean;
}

type Details = Omit<EditAccountPayload, "accountId">;

const rejected = (error: string, code: "invalid" | "not_found" = "invalid"): CommandResult =>
  ({ status: "rejected", replayed: false, code, error });

/** The optional details both commands accept; Spanish text when one is wrong. */
function validateDetails(p: Details): string | null {
  if (p.name !== undefined && (typeof p.name !== "string" || p.name.trim() === "")) return "Escribe un nombre para la cuenta.";
  if (typeof p.name === "string" && p.name.trim().length > 60) return "El nombre es muy largo.";
  if (p.institutionName != null && (typeof p.institutionName !== "string" || p.institutionName.length > 60)) return "El banco no es válido.";
  if (p.mask != null && (typeof p.mask !== "string" || !/^\d{4}$/.test(p.mask))) return "Los últimos dígitos son 4 números.";
  for (const v of [p.creditLimit, p.monthlyPayment]) {
    if (v != null && (!isMoney(v) || v < 0)) return "El monto no es válido.";
  }
  for (const v of [p.cutoffDay, p.paymentDay]) {
    if (v != null && (!Number.isInteger(v) || v < 1 || v > 31)) return "El día debe estar entre 1 y 31.";
  }
  return null;
}

/** Agregar (S8-4): a new account with today's balance. The client's id makes retries duplicates. */
export async function createAccount(s: StoragePort, cmd: CommandEnvelope<CreateAccountPayload>): Promise<CommandResult> {
  const p = cmd.payload;
  if (!p || !UUID_RE.test(p.accountId ?? "")) return rejected("Identificador inválido.");
  if (!ACCOUNT_TYPES.has(p.accountType)) return rejected("Tipo de cuenta inválido.");
  if (typeof p.name !== "string") return rejected("Escribe un nombre para la cuenta.");
  const invalid = validateDetails(p);
  if (invalid) return rejected(invalid);
  if (typeof p.currencyCode !== "string" || !/^[A-Z]{3}$/.test(p.currencyCode)) return rejected("Moneda inválida.");
  if (!isMoney(p.balance)) return rejected("El saldo no es válido.");
  if (isDebtAccountType(p.accountType) && p.balance < 0) return rejected("Lo que debes no puede ser negativo.");

  if (await s.getAccount(cmd.userId, p.accountId)) {
    return { status: "duplicate", replayed: false, data: { accountId: p.accountId } };
  }
  await s.insertAccount({
    id: p.accountId,
    userId: cmd.userId,
    name: p.name.trim(),
    accountType: p.accountType,
    institutionName: p.institutionName?.trim() || null,
    mask: p.mask ?? null,
    currencyCode: p.currencyCode,
    currentBalance: p.balance,
    creditLimit: p.creditLimit ?? null,
    cutoffDay: p.cutoffDay ?? null,
    paymentDay: p.paymentDay ?? null,
    monthlyPayment: p.monthlyPayment ?? null,
  });
  // The balance you told is today's: bank rows from before today are already inside it.
  // A statement creating its account doesn't know one yet (its cut anchors it).
  if (!p.balanceUnknown) await setBalanceAsOf(s, cmd.userId, p.accountId, cmd.clientTs, cmd.id);
  return { status: "applied", replayed: false, data: { accountId: p.accountId } };
}

const DETAIL_FIELDS = [
  ["name", "name"],
  ["institutionName", "institution_name"],
  ["mask", "mask"],
  ["creditLimit", "credit_limit"],
  ["cutoffDay", "cutoff_day"],
  ["paymentDay", "payment_day"],
  ["monthlyPayment", "monthly_payment"],
] as const;

/** Applies each sent field unless a newer edit of that field already won (per-field versions). */
async function applyVersioned(
  s: StoragePort,
  cmd: CommandEnvelope<{ accountId: string }>,
  changes: [column: keyof AccountDetailsPatch, value: AccountDetailsPatch[keyof AccountDetailsPatch]][],
): Promise<CommandResult> {
  const patch: AccountDetailsPatch = {};
  for (const [column, value] of changes) {
    const current = await s.getFieldVersion(cmd.userId, "account", cmd.payload.accountId, column);
    if (current && isNewer(current, cmd.clientTs, cmd.id)) continue;
    (patch as Record<string, unknown>)[column] = value;
    await s.setFieldVersion({ userId: cmd.userId, entity: "account", entityId: cmd.payload.accountId, field: column, clientTs: cmd.clientTs, commandId: cmd.id });
  }
  if (Object.keys(patch).length === 0) return { status: "superseded", replayed: false };
  await s.updateAccountDetails(cmd.userId, cmd.payload.accountId, patch);
  return { status: "applied", replayed: false };
}

/** Editar cuenta: name, bank, last digits, card/loan details. The balance changes only through movements. */
export async function editAccount(s: StoragePort, cmd: CommandEnvelope<EditAccountPayload>): Promise<CommandResult> {
  const p = cmd.payload;
  if (!p || !UUID_RE.test(p.accountId ?? "")) return rejected("Identificador inválido.");
  const invalid = validateDetails(p);
  if (invalid) return rejected(invalid);
  const changes = DETAIL_FIELDS
    .filter(([key]) => p[key] !== undefined)
    .map(([key, column]) => {
      const v = p[key];
      return [column, typeof v === "string" ? v.trim() || null : v] as [keyof AccountDetailsPatch, AccountDetailsPatch[keyof AccountDetailsPatch]];
    });
  if (changes.length === 0) return rejected("No hay nada que cambiar.");
  if (!(await s.getAccount(cmd.userId, p.accountId))) return rejected("Cuenta no encontrada.", "not_found");
  return applyVersioned(s, cmd, changes);
}

/** Archivar: the account leaves Mis cuentas, pickers and Disponible; its movements stay. */
export async function archiveAccount(s: StoragePort, cmd: CommandEnvelope<ArchiveAccountPayload>): Promise<CommandResult> {
  const p = cmd.payload;
  if (!p || !UUID_RE.test(p.accountId ?? "") || typeof p.archived !== "boolean") return rejected("Datos inválidos.");
  if (!(await s.getAccount(cmd.userId, p.accountId))) return rejected("Cuenta no encontrada.", "not_found");
  return applyVersioned(s, cmd, [["is_active", !p.archived]]);
}
