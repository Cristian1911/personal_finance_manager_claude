import * as Crypto from "expo-crypto";
import { isDebtAccountType } from "@zeta/shared";
import { getDatabase } from "../db/database";
import {
  applyLocalBalanceDelta,
  buildLedgerTxPayload,
  computeIdempotencyKey,
  insertLedgerTransaction,
  type LedgerAccountRow,
} from "./ledger-helpers";

export type CreateTransferInput = {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  /** YYYY-MM-DD */
  date: string;
  notes?: string;
};

export type CreateTransferResult =
  | { success: true; outflowId: string; inflowId: string }
  | { success: false; error: string };

/**
 * Offline-first mirror of webapp transfers.ts `createTransfer`.
 *
 * Inserts a paired OUTFLOW (on `from`) + INFLOW (on `to`) sharing one
 * `transfer_group_id`, then updates both balances (from = OUTFLOW, to = INFLOW)
 * via applyLocalBalanceDelta — so debt legs clamp at 0 and recompute
 * available_balance through the shared debt payload. All 4 writes are wrapped in
 * ONE withTransactionAsync, so any throw rolls back the whole transfer (this
 * replaces the webapp's manual outflow-delete rollback).
 *
 * Guards (match webapp): from !== to, amount > 0, SAME currency (hard reject —
 * no FX). Idempotency rawDescription is byte-identical:
 *   `${desc}|${fromId}→${toId}|${groupId}` — so the two legs never collide and
 * legitimate same-day transfers don't dedup against each other.
 */
export async function createTransfer(
  input: CreateTransferInput
): Promise<CreateTransferResult> {
  if (input.fromAccountId === input.toAccountId) {
    return { success: false, error: "No puedes transferir a la misma cuenta." };
  }
  if (!(input.amount > 0)) {
    return { success: false, error: "El monto debe ser mayor que cero." };
  }

  const db = await getDatabase();

  const fromAccount = await db.getFirstAsync<LedgerAccountRow>(
    "SELECT * FROM accounts WHERE id = ?",
    [input.fromAccountId]
  );
  if (!fromAccount) return { success: false, error: "Cuenta de origen no encontrada" };

  const toAccount = await db.getFirstAsync<LedgerAccountRow>(
    "SELECT * FROM accounts WHERE id = ?",
    [input.toAccountId]
  );
  if (!toAccount) return { success: false, error: "Cuenta de destino no encontrada" };

  // Fail fast on a missing/mismatched user_id — an empty-string user_id produces
  // rows that fail Supabase RLS and stick in sync_queue forever. Both legs share
  // one owner; validate both and use the verified id for the ledger payloads.
  const userId = fromAccount.user_id;
  if (!userId || !toAccount.user_id || toAccount.user_id !== userId) {
    return { success: false, error: "Sesión inválida" };
  }

  // Reject cross-currency transfers (no FX support yet) — matches webapp.
  if (fromAccount.currency_code !== toAccount.currency_code) {
    return {
      success: false,
      error:
        "No se pueden hacer transferencias entre cuentas con diferente moneda. Ambas deben ser " +
        fromAccount.currency_code +
        ".",
    };
  }

  const now = new Date().toISOString();
  const transferGroupId = Crypto.randomUUID();
  const currencyCode = fromAccount.currency_code;

  const outflowDescription = `Transferencia a ${toAccount.name}`;
  const inflowDescription = `Transferencia desde ${fromAccount.name}`;

  // Account IDs + transferGroupId in the rawDescription so two legitimate
  // same-day transfers don't collide, and the legs differ from one another.
  const outflowKey = await computeIdempotencyKey({
    provider: "MANUAL",
    transactionDate: input.date,
    amount: input.amount,
    rawDescription: `${outflowDescription}|${input.fromAccountId}→${input.toAccountId}|${transferGroupId}`,
  });
  const inflowKey = await computeIdempotencyKey({
    provider: "MANUAL",
    transactionDate: input.date,
    amount: input.amount,
    rawDescription: `${inflowDescription}|${input.fromAccountId}→${input.toAccountId}|${transferGroupId}`,
  });

  const outflowPayload = buildLedgerTxPayload(
    {
      userId,
      accountId: input.fromAccountId,
      amount: input.amount,
      currencyCode,
      direction: "OUTFLOW",
      transactionDate: input.date,
      rawDescription: outflowDescription,
      merchantName: toAccount.name,
      notes: input.notes ?? null,
      idempotencyKey: outflowKey,
      transferGroupId,
      // Both account types are in hand, so this is structural, not a reading of
      // the wording — same verdict webapp's createTransfer produces. Paying a
      // card through this flow is DEBT_PAYMENT, not SELF_TRANSFER.
      flowClass: isDebtAccountType(toAccount.account_type)
        ? "DEBT_PAYMENT"
        : "SELF_TRANSFER",
    },
    now
  );
  const inflowPayload = buildLedgerTxPayload(
    {
      userId,
      accountId: input.toAccountId,
      amount: input.amount,
      currencyCode,
      direction: "INFLOW",
      transactionDate: input.date,
      rawDescription: inflowDescription,
      merchantName: fromAccount.name,
      notes: input.notes ?? null,
      idempotencyKey: inflowKey,
      transferGroupId,
      // The receiving leg: landing on a card is DEBT_CREDIT, landing on a
      // liquid account is a plain move between the user's own accounts.
      flowClass: isDebtAccountType(toAccount.account_type)
        ? "DEBT_CREDIT"
        : "SELF_TRANSFER",
    },
    now
  );

  let duplicate = false;
  await db.withTransactionAsync(async () => {
    const outflowRes = await insertLedgerTransaction(db, outflowPayload, now);
    if (!outflowRes.inserted) {
      duplicate = true;
      return;
    }
    const inflowRes = await insertLedgerTransaction(db, inflowPayload, now);
    if (!inflowRes.inserted) {
      // Throw to roll back the outflow + its sync row in one atomic step
      // (replaces webapp's manual outflow-delete rollback).
      duplicate = true;
      throw new Error("__TRANSFER_DUPLICATE__");
    }

    // FROM: OUTFLOW · TO: INFLOW. Both clamp/recompute as applicable (debt).
    await applyLocalBalanceDelta(db, fromAccount, "OUTFLOW", input.amount, currencyCode, now);
    await applyLocalBalanceDelta(db, toAccount, "INFLOW", input.amount, currencyCode, now);
  }).catch((err) => {
    if (err instanceof Error && err.message === "__TRANSFER_DUPLICATE__") return;
    throw err;
  });

  if (duplicate) return { success: false, error: "Esta transferencia ya fue registrada" };

  return { success: true, outflowId: outflowPayload.id, inflowId: inflowPayload.id };
}
