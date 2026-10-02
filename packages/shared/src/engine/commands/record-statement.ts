import type { CommandEnvelope, CommandResult, StatementSnapshotRow, StoragePort } from "../types";
import { UUID_RE } from "../validate";
import { isIsoDate, isMoney } from "./validate-money";

export type RecordStatementPayload = Omit<StatementSnapshotRow, "userId">;

const money = (v: unknown) => v == null || (typeof v === "number" && isMoney(Math.abs(v)));
const date = (v: unknown) => v == null || isIsoDate(v);

/**
 * What a bank statement said: its balance, the minimum, the due date, the rate
 * (D24: Disponible counts the card's minimum; the card shows them). The id is
 * the statement's (account + currency + period), so importing it again updates it.
 */
export async function recordStatement(s: StoragePort, cmd: CommandEnvelope<RecordStatementPayload>): Promise<CommandResult> {
  const p = cmd.payload;
  const bad = (error: string): CommandResult => ({ status: "rejected", replayed: false, code: "invalid", error });
  if (!p || !UUID_RE.test(p.id ?? "") || !UUID_RE.test(p.accountId ?? "")) return bad("Identificador inválido.");
  if (!date(p.periodFrom) || !date(p.periodTo) || !date(p.paymentDueDate)) return bad("Fecha inválida.");
  if (![p.finalBalance, p.totalPaymentDue, p.minimumPayment].every(money)) return bad("Monto inválido.");
  if (p.interestRate != null && (typeof p.interestRate !== "number" || p.interestRate < 0 || p.interestRate > 300)) return bad("Tasa inválida.");
  if (typeof p.currencyCode !== "string" || !/^[A-Z]{3}$/.test(p.currencyCode)) return bad("Moneda inválida.");
  if (!Number.isInteger(p.transactionCount) || p.transactionCount < 0) return bad("Cantidad inválida.");
  if (!(await s.getAccount(cmd.userId, p.accountId))) return { status: "rejected", replayed: false, code: "not_found", error: "Cuenta no encontrada." };
  await s.upsertStatementSnapshot({ ...p, userId: cmd.userId }, cmd.clientTs);
  return { status: "applied", replayed: false };
}
