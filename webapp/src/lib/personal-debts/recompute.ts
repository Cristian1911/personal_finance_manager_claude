import "server-only";
import { computeOutstanding } from "@zeta/shared";

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
    const { data: reps, error: repsErr } = await supabase
      .from("transactions")
      .select("personal_debt_id, amount")
      .eq("user_id", userId)
      .eq("pd_role", "repayment")
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
  // The origin transaction is the only group-tagged tx without a personal_debt_id.
  const { error } = await supabase
    .from("transactions")
    .update({ split_repaid_amount: repaid })
    .eq("user_id", userId)
    .eq("split_group_id", splitGroupId)
    .is("personal_debt_id", null);
  if (error) throw error;
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
  const { data: repayments, error: repaymentsErr } = await supabase
    .from("transactions")
    .select("amount")
    .eq("user_id", userId)
    .eq("personal_debt_id", personalDebtId)
    .eq("pd_role", "repayment");
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
}

// ============================================================
// Debt bookkeeping after a linked transaction stops counting — because it was
// unlinked (personal_debt_id cleared) or deleted outright. MUST run after the
// row no longer matches the pd_role='repayment' queries, or the recompute
// would still count it.
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
