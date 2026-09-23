import "server-only";
import { computeOutstanding } from "@zeta/shared";
import { allocateRepaidAcrossRows, type RepaidTargetRow } from "./allocate-repaid";

/**
 * Debt-bookkeeping helpers shared by every mutation path that can change a
 * personal debt's math: the personal-debts actions (link/unlink/repayment) AND
 * the generic transaction mutations (edit amount, delete) in transactions.ts.
 * Living here (plain server module, NOT "use server") keeps them out of the
 * client-invocable action surface while letting both files share one source of
 * truth — before this module existed, deleting/editing a linked transaction
 * silently left outstanding_amount frozen.
 *
 * All helpers THROW on failure. Callers run after a committed mutation, so on
 * catch they must still invalidate caches before returning the error.
 */

// ============================================================
// Recompute a shared payment's repaid total → the origin transaction's
// split_repaid_amount = Σ(repayments across all debts in the split group).
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recomputeSplitRepaid(
  supabase: any,
  userId: string,
  splitGroupId: string,
): Promise<void> {
  const { data: groupDebts, error: groupErr } = await supabase
    .from("personal_debts")
    .select("id, principal_amount, status")
    .eq("user_id", userId)
    .eq("split_group_id", splitGroupId);
  // Don't swallow a failed fetch — treating it as "no debts" would write
  // split_repaid_amount = 0 and silently corrupt the tx's effective spend.
  if (groupErr) {
    console.error("recomputeSplitRepaid: failed to fetch group debts:", groupErr);
    throw new Error("No se pudieron recomputar las deudas del pago compartido");
  }
  const ids: string[] = (groupDebts ?? []).map((d: { id: string }) => d.id);
  // The most that can be repaid is the total owed (Σ participant principals).
  // Clamp to it so an over-payment can't push split_repaid_amount above the
  // transaction's amount and make the effective spend go negative.
  const owed: number = (groupDebts ?? []).reduce(
    (s: number, d: { principal_amount: number }) => s + Number(d.principal_amount ?? 0),
    0,
  );
  let repaid = 0;
  if (ids.length > 0) {
    // The view counts a movement split across several debts by its share
    // here, not by its full amount on the anchor debt.
    const { data: reps, error: repsErr } = await supabase
      .from("personal_debt_repayment_amounts")
      .select("personal_debt_id, amount")
      .eq("user_id", userId)
      .in("personal_debt_id", ids);
    // A failed fetch must abort: treating it as "no repayments" would write
    // split_repaid_amount = 0 and erase what participants already paid back.
    if (repsErr) throw repsErr;

    const paidByDebt = new Map<string, number>();
    for (const t of (reps ?? []) as { personal_debt_id: string; amount: number | null }[]) {
      paidByDebt.set(
        t.personal_debt_id,
        (paidByDebt.get(t.personal_debt_id) ?? 0) + Number(t.amount ?? 0),
      );
    }

    // A participant's share counts as recovered when it was settled — "Saldar"
    // resolves the share (they paid you in cash, or you forgave it) without
    // creating a transaction, so summing transactions alone left the card
    // stuck at "Recuperado $0" after settling everyone. Auto-settled debts
    // reach the same number either way, and cancelled ones count only what
    // was actually paid.
    for (const d of (groupDebts ?? []) as {
      id: string;
      principal_amount: number;
      status: string;
    }[]) {
      const principal = Number(d.principal_amount ?? 0);
      const paid = paidByDebt.get(d.id) ?? 0;
      // Clamp per participant, not just for the group: one person overpaying
      // their share must not silently cover someone else's unpaid one.
      repaid += d.status === "settled" ? principal : Math.min(paid, principal);
    }
  }
  repaid = Math.min(repaid, owed);
  // The group-tagged txs without a personal_debt_id are the payment itself:
  // one row for a normal shared payment, or every cuota of a purchase shared as
  // "compra completa". Spread the repaid total across them in cuota order so no
  // row's effective spend (amount − split_repaid_amount) goes negative.
  const { data: rows, error: rowsErr } = await supabase
    .from("transactions")
    .select("id, amount, installment_current, transaction_date, split_repaid_amount")
    .eq("user_id", userId)
    .eq("split_group_id", splitGroupId)
    .is("personal_debt_id", null)
    // A duplicate cuota reconciled away by a later import must not absorb
    // repaid capacity the visible rows need.
    .is("reconciled_into_transaction_id", null);
  if (rowsErr) throw rowsErr;
  const targets = (rows ?? []) as (RepaidTargetRow & { split_repaid_amount: number | null })[];
  const alloc = allocateRepaidAcrossRows(targets, repaid);
  const updates = targets.filter((t) => Number(t.split_repaid_amount ?? 0) !== (alloc.get(t.id) ?? 0));
  const results = await Promise.all(
    updates.map((t) =>
      supabase
        .from("transactions")
        .update({ split_repaid_amount: alloc.get(t.id) ?? 0 })
        .eq("user_id", userId)
        .eq("id", t.id),
    ),
  );
  const failed = results.find((r: { error: unknown }) => r.error);
  if (failed?.error) throw failed.error;
}

// ============================================================
// Recompute outstanding_amount + auto-settle.
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recomputeOutstanding(
  supabase: any,
  userId: string,
  personalDebtId: string,
  principal: number,
  options?: { allowReopen?: boolean },
): Promise<void> {
  // personal_debt_repayment_amounts = linked repayments + this debt's share of
  // movements split across several of the person's debts.
  const { data: repayments, error: repaymentsErr } = await supabase
    .from("personal_debt_repayment_amounts")
    .select("amount")
    .eq("user_id", userId)
    .eq("personal_debt_id", personalDebtId);
  // Never fall back to "no repayments" on a failed fetch — that would write
  // outstanding = principal and un-settle a debt the user already paid off.
  if (repaymentsErr) throw repaymentsErr;
  const amounts: number[] = (repayments ?? []).map((t: { amount: number }) => t.amount);
  const { outstanding, status } = computeOutstanding(principal, amounts);
  let update = supabase
    .from("personal_debts")
    .update({ outstanding_amount: outstanding, status })
    .eq("id", personalDebtId)
    .eq("user_id", userId)
    .neq("status", "cancelled");
  // "Saldar" is a user decision, not a derived state: it zeroes the balance
  // without creating repayment transactions. Recomputing it from transactions
  // would flip it back to `active` on the next repayment/edit — and since a
  // settled share counts as recovered, that would make LOGGING money come in
  // lower the shared payment's recovered total. So leave settled rows alone
  // unless the caller is genuinely reopening the debt (a new loan raising the
  // principal, or an explicit reopen).
  if (!options?.allowReopen) update = update.neq("status", "settled");
  const { error: updateErr } = await update;
  // Surface a failed recompute instead of silently returning success with a
  // stale outstanding — better a thrown mutation error the user can retry
  // (inserts are idempotent) than a false success with drifted state.
  if (updateErr) throw updateErr;
}

/** Minimal shape of a (former) linked transaction detachTransactionFromDebt needs. */
export interface DetachedDebtTx {
  id: string;
  amount: number | null;
  personal_debt_id: string;
  pd_role: "origin" | "repayment" | null;
  /**
   * This movement's shares when it was split across several debts
   * (personal_debt_allocations), read BEFORE the unlink/delete — a deleted
   * transaction cascades its allocation rows away, so they can't be read
   * afterwards.
   */
  allocations?: DebtAllocationShare[];
}

export type DebtAllocationShare = { personal_debt_id: string; amount: number };

/**
 * A movement's shares across a person's debts ("abono a la persona en
 * general"); empty for a movement linked to a single debt. Callers read it
 * before mutating.
 */
export async function readAllocations(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  transactionId: string,
): Promise<DebtAllocationShare[]> {
  const { data, error } = await supabase
    .from("personal_debt_allocations")
    .select("personal_debt_id, amount")
    .eq("user_id", userId)
    .eq("transaction_id", transactionId);
  if (error) throw error;
  return ((data ?? []) as { personal_debt_id: string; amount: number }[]).map((r) => ({
    personal_debt_id: r.personal_debt_id,
    amount: Number(r.amount),
  }));
}

/**
 * Recompute outstanding (and the split group's repaid) for each debt.
 *
 * `removed` = shares just taken off each debt (an unlinked/deleted split
 * abono). A debt that is `settled` only because those payments covered it
 * reopens; one the user settled by hand ("Saldar", repaid < principal even
 * with the removed share) stays settled.
 */
export async function recomputeDebts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  debtIds: string[],
  removed?: Map<string, number>,
): Promise<void> {
  const ids = [...new Set(debtIds)];
  if (ids.length === 0) return;
  const { data: debts, error } = await supabase
    .from("personal_debts")
    .select("id, principal_amount, split_group_id, status")
    .eq("user_id", userId)
    .in("id", ids);
  if (error) throw error;
  const rows = (debts ?? []) as {
    id: string;
    principal_amount: number;
    split_group_id: string | null;
    status: string;
  }[];
  for (const d of rows) {
    const principal = Number(d.principal_amount);
    let allowReopen = false;
    const gone = removed?.get(d.id) ?? 0;
    if (d.status === "settled" && gone > 0) {
      const { data: reps, error: repsErr } = await supabase
        .from("personal_debt_repayment_amounts")
        .select("amount")
        .eq("user_id", userId)
        .eq("personal_debt_id", d.id);
      if (repsErr) throw repsErr;
      const repaidNow = ((reps ?? []) as { amount: number | null }[]).reduce(
        (sum, r) => sum + Number(r.amount ?? 0),
        0,
      );
      allowReopen = repaidNow + gone >= principal - 1e-6;
    }
    await recomputeOutstanding(supabase, userId, d.id, principal, { allowReopen });
  }
  const groups = [...new Set(rows.map((d) => d.split_group_id).filter((x): x is string => !!x))];
  for (const g of groups) {
    await recomputeSplitRepaid(supabase, userId, g);
  }
}

// ============================================================
// Debt bookkeeping after a linked transaction stops counting — because it was
// unlinked (personal_debt_id cleared) or deleted outright. MUST run after the
// row no longer matches the pd_role='repayment' queries, or the recompute
// would still count it (the repayment view only counts linked movements).
//   - additional origin (not the canonical pointer): its amount was summed
//     into principal when linked, so shrink it back symmetrically.
//   - canonical origin: clear the pointer (principal documents itself).
//   - repayment: recompute outstanding; shared-payment debts also refresh the
//     origin tx's split_repaid_amount.
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function detachTransactionFromDebt(
  supabase: any,
  userId: string,
  tx: DetachedDebtTx,
): Promise<void> {
  const debtId = tx.personal_debt_id;
  const { data: debt, error: debtErr } = await supabase
    .from("personal_debts")
    .select("principal_amount, origin_transaction_id, split_group_id")
    .eq("id", debtId)
    .eq("user_id", userId)
    .single();
  if (debtErr || !debt) throw new Error("Deuda vinculada no encontrada");

  const wasOrigin = tx.pd_role === "origin";
  if (wasOrigin && debt.origin_transaction_id !== tx.id) {
    const newPrincipal = Math.max(
      0,
      Number(debt.principal_amount) - Number(tx.amount ?? 0),
    );
    const { error: princErr } = await supabase
      .from("personal_debts")
      .update({ principal_amount: newPrincipal })
      .eq("id", debtId)
      .eq("user_id", userId)
      .neq("status", "cancelled");
    if (princErr) throw new Error("Error al ajustar la deuda");
    await recomputeOutstanding(supabase, userId, debtId, newPrincipal);
  } else if (wasOrigin) {
    const { error: originErr } = await supabase
      .from("personal_debts")
      .update({ origin_transaction_id: null })
      .eq("id", debtId)
      .eq("user_id", userId);
    if (originErr) throw new Error("Error al desvincular el origen");
  } else if (tx.allocations && tx.allocations.length > 0) {
    // A movement split across several debts: drop its shares (a no-op when
    // the delete already cascaded them) and recompute every debt it touched,
    // reopening the ones only these shares had paid off.
    const { error: delErr } = await supabase
      .from("personal_debt_allocations")
      .delete()
      .eq("user_id", userId)
      .eq("transaction_id", tx.id);
    if (delErr) throw new Error("Error al quitar el reparto del abono");
    const removed = new Map<string, number>();
    for (const a of tx.allocations) {
      removed.set(a.personal_debt_id, (removed.get(a.personal_debt_id) ?? 0) + a.amount);
    }
    await recomputeDebts(supabase, userId, [debtId, ...removed.keys()], removed);
  } else {
    await recomputeOutstanding(supabase, userId, debtId, debt.principal_amount);
    if (debt.split_group_id) {
      await recomputeSplitRepaid(supabase, userId, debt.split_group_id);
    }
  }
}

// ============================================================
// Recompute after a linked transaction's AMOUNT changed (edit paths).
//
// An ADDITIONAL origin (a second loan from the same person) had its amount
// summed into principal_amount at link time, so an edit must move the principal
// by the same delta — otherwise detachTransactionFromDebt would later subtract
// an amount that was never added and corrupt the debt permanently.
// The CANONICAL origin is different: principal_amount was entered by the user
// when the debt was created and merely documented by that transaction, so its
// amount is not part of the debt's math and is left alone.
// ============================================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recomputeDebtAfterTxAmountChange(
  supabase: any,
  userId: string,
  tx: { id: string; personal_debt_id: string; pd_role: "origin" | "repayment" | null },
  previousAmount: number,
  nextAmount: number,
): Promise<void> {
  const { data: debt, error } = await supabase
    .from("personal_debts")
    .select("principal_amount, origin_transaction_id, split_group_id")
    .eq("id", tx.personal_debt_id)
    .eq("user_id", userId)
    .single();
  if (error || !debt) throw new Error("Deuda vinculada no encontrada");

  let principal = Number(debt.principal_amount);
  if (tx.pd_role === "origin" && debt.origin_transaction_id !== tx.id) {
    principal = Math.max(0, principal + (Number(nextAmount) - Number(previousAmount)));
    const { error: princErr } = await supabase
      .from("personal_debts")
      .update({ principal_amount: principal })
      .eq("id", tx.personal_debt_id)
      .eq("user_id", userId)
      .neq("status", "cancelled");
    if (princErr) throw new Error("Error al ajustar la deuda");
  }

  await recomputeOutstanding(supabase, userId, tx.personal_debt_id, principal);
  if (debt.split_group_id) {
    await recomputeSplitRepaid(supabase, userId, debt.split_group_id);
  }
}

/**
 * True when any debt of these shared payments received a share of an abono
 * split across several debts. Deleting such debts would drop the share (and,
 * for the anchor, unlink the movement) so the money would count nowhere —
 * callers refuse and ask the user to unlink that abono first.
 */
export async function sharedGroupsHaveSplitRepayments(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  splitGroupIds: string[],
): Promise<boolean> {
  if (splitGroupIds.length === 0) return false;
  const { data: debts, error } = await supabase
    .from("personal_debts")
    .select("id")
    .eq("user_id", userId)
    .in("split_group_id", splitGroupIds);
  if (error) throw error;
  const ids = ((debts ?? []) as { id: string }[]).map((d) => d.id);
  if (ids.length === 0) return false;
  const { count, error: cntErr } = await supabase
    .from("personal_debt_allocations")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .in("personal_debt_id", ids);
  if (cntErr) throw cntErr;
  return (count ?? 0) > 0;
}

export const SPLIT_REPAYMENT_BLOCK_MESSAGE =
  "Un abono repartido entre varias deudas incluye este pago compartido. Desvincula ese abono primero.";
