"use server";

import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import { transferSchema } from "@/lib/validators/transfer";
import {
  TRANSFER_CATEGORY_ID,
  computeIdempotencyKey,
  getDebtPaymentCategoryId,
  isDebtAccountType,
} from "@zeta/shared";
import { flowClassColumns } from "@/lib/utils/flow-class-columns";
import {
  buildDebtBalanceUpdatePayload,
  deactivateTemplatesForPaidOffAccount,
} from "@/lib/debt/payoff";
import { formatDate } from "@/lib/utils/date";
import type { ActionResult } from "@/types/actions";

/**
 * Create a transfer between two accounts.
 * Inserts paired OUTFLOW + INFLOW transactions sharing a transfer_group_id,
 * then updates both account balances following the registerPayment pattern.
 */
export async function createTransfer(
  _prevState: ActionResult<{ outflowId: string; inflowId: string }>,
  formData: FormData
): Promise<ActionResult<{ outflowId: string; inflowId: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // 1. Parse & validate
  const raw = {
    fromAccountId: formData.get("fromAccountId") as string,
    toAccountId: formData.get("toAccountId") as string,
    amount: formData.get("amount") as string,
    currencyCode: formData.get("currencyCode") as string,
    date: formData.get("date") as string,
    notes: (formData.get("notes") as string) || undefined,
  };

  const parsed = transferSchema.safeParse(raw);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const { fromAccountId, toAccountId, amount, date, notes } = parsed.data;

  // 2. Fetch both accounts (validate ownership + get balances)
  const [fromRes, toRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, account_type, current_balance, credit_limit, currency_code, currency_balances")
      .eq("id", fromAccountId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("accounts")
      .select("id, name, account_type, current_balance, credit_limit, currency_code, currency_balances")
      .eq("id", toAccountId)
      .eq("user_id", user.id)
      .single(),
  ]);

  if (fromRes.error || !fromRes.data) {
    return { success: false, error: "Cuenta de origen no encontrada" };
  }
  if (toRes.error || !toRes.data) {
    return { success: false, error: "Cuenta de destino no encontrada" };
  }

  const fromAccount = fromRes.data;
  const toAccount = toRes.data;

  // Reject cross-currency transfers (no FX support yet)
  if (fromAccount.currency_code !== toAccount.currency_code) {
    return {
      success: false,
      error: "No se pueden hacer transferencias entre cuentas con diferente moneda. Ambas deben ser " + fromAccount.currency_code + ".",
    };
  }

  const now = new Date().toISOString();
  const transferGroupId = crypto.randomUUID();
  const isFromDebt = isDebtAccountType(fromAccount.account_type);
  const isToDebt = isDebtAccountType(toAccount.account_type);

  // 3. Build idempotency keys
  const outflowDescription = `Transferencia a ${toAccount.name}`;
  const inflowDescription = `Transferencia desde ${fromAccount.name}`;

  // Include account IDs + transferGroupId so two legitimate same-day transfers don't collide
  const [outflowKey, inflowKey] = await Promise.all([
    computeIdempotencyKey({
      provider: "MANUAL",
      transactionDate: date,
      amount,
      rawDescription: `${outflowDescription}|${fromAccountId}→${toAccountId}|${transferGroupId}`,
    }),
    computeIdempotencyKey({
      provider: "MANUAL",
      transactionDate: date,
      amount,
      rawDescription: `${inflowDescription}|${fromAccountId}→${toAccountId}|${transferGroupId}`,
    }),
  ]);

  // 4. Insert OUTFLOW transaction on source account
  const { data: outflow, error: outflowError } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      account_id: fromAccountId,
      amount,
      currency_code: fromAccount.currency_code,
      direction: "OUTFLOW",
      transaction_date: date,
      raw_description: outflowDescription,
      clean_description: outflowDescription,
      merchant_name: toAccount.name,
      capture_method: "MANUAL_FORM",
      provider: "MANUAL",
      // Categorize both legs like extra-payment does: a transfer is never
      // triage work, and leaving category_id null queued two extra rows in
      // Categorizar for every transfer.
      category_id: TRANSFER_CATEGORY_ID,
      categorization_source: "SYSTEM_DEFAULT",
      idempotency_key: outflowKey,
      transfer_group_id: transferGroupId,
      // Structural, confidence 1.0: both account types are in hand, so the
      // classifier never falls back to reading the description. Paying a card
      // through this flow yields DEBT_PAYMENT, not SELF_TRANSFER.
      ...flowClassColumns({
        direction: "OUTFLOW",
        accountType: fromAccount.account_type,
        description: outflowDescription,
        transferGroupId,
        counterpartAccountType: toAccount.account_type,
      }),
      notes: notes || null,
      status: "POSTED",
    })
    .select("id")
    .single();

  if (outflowError) {
    if (outflowError.code === "23505") {
      return { success: false, error: "Esta transferencia ya fue registrada" };
    }
    return { success: false, error: outflowError.message };
  }

  // 5. Insert INFLOW transaction on destination account
  const { data: inflow, error: inflowError } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      account_id: toAccountId,
      amount,
      currency_code: fromAccount.currency_code,
      direction: "INFLOW",
      transaction_date: date,
      raw_description: inflowDescription,
      clean_description: inflowDescription,
      merchant_name: fromAccount.name,
      capture_method: "MANUAL_FORM",
      provider: "MANUAL",
      category_id: isToDebt
        ? getDebtPaymentCategoryId(toAccount.account_type)
        : TRANSFER_CATEGORY_ID,
      categorization_source: "SYSTEM_DEFAULT",
      idempotency_key: inflowKey,
      transfer_group_id: transferGroupId,
      ...flowClassColumns({
        direction: "INFLOW",
        accountType: toAccount.account_type,
        description: inflowDescription,
        transferGroupId,
        counterpartAccountType: fromAccount.account_type,
      }),
      notes: notes || null,
      status: "POSTED",
    })
    .select("id")
    .single();

  if (inflowError) {
    // Rollback: delete the outflow transaction (balances not yet touched, so a
    // failed rollback only leaves an orphaned outflow — log it for cleanup).
    const { error: rollbackError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", outflow.id)
      .eq("user_id", user.id);
    if (rollbackError) {
      console.error("Transfer rollback failed — orphaned outflow", {
        transferGroupId,
        outflowId: outflow.id,
        rollbackError,
      });
    }
    if (inflowError.code === "23505") {
      return { success: false, error: "Esta transferencia ya fue registrada" };
    }
    return { success: false, error: inflowError.message };
  }

  // 6. Update account balances (following registerPayment pattern)
  // FROM account: OUTFLOW → debt increases balance, non-debt decreases balance
  const newFromBalance = isFromDebt
    ? fromAccount.current_balance + amount
    : fromAccount.current_balance - amount;

  // Debt accounts must go through the shared payload builder: it writes
  // current_balance, available_balance AND currency_balances together. The
  // /deudas page reads a multi-currency card's balance ONLY from
  // currency_balances, so a hand-rolled update leaves it visibly stale.
  const fromUpdate: Record<string, unknown> = isFromDebt
    ? { ...buildDebtBalanceUpdatePayload(fromAccount, newFromBalance, fromAccount.currency_code), updated_at: now }
    : { current_balance: newFromBalance, updated_at: now };

  // TO account: INFLOW → debt decreases balance, non-debt increases balance.
  // Clamp debt payments at 0 (matches registerPayment) so overpaying a credit
  // card / loan doesn't drive the owed balance negative.
  const newToBalance = isToDebt
    ? Math.max(0, toAccount.current_balance - amount)
    : toAccount.current_balance + amount;

  const toUpdate: Record<string, unknown> = isToDebt
    ? { ...buildDebtBalanceUpdatePayload(toAccount, newToBalance, toAccount.currency_code), updated_at: now }
    : { current_balance: newToBalance, updated_at: now };

  const [fromBalRes, toBalRes] = await Promise.all([
    supabase.from("accounts").update(fromUpdate).eq("id", fromAccountId).eq("user_id", user.id),
    supabase.from("accounts").update(toUpdate).eq("id", toAccountId).eq("user_id", user.id),
  ]);

  // A debt paid down to zero stops generating cuotas — every other
  // debt-payment path does this, and quick payments now land here.
  if (isToDebt && !toBalRes.error && newToBalance <= 0) {
    await deactivateTemplatesForPaidOffAccount({
      supabase,
      userId: user.id,
      accountId: toAccountId,
    });
  }

  // 7. Revalidate caches (do this even on balance failure so the new
  // transactions are reflected immediately).
  revalidateFinancialViews();

  if (fromBalRes.error || toBalRes.error) {
    // Transactions exist but balances may be inconsistent — surface a warning
    // so the user can reconcile (matches registerPayment's behavior).
    console.error("Balance update failed after transfer", {
      transferGroupId,
      fromError: fromBalRes.error,
      toError: toBalRes.error,
    });
    return {
      success: false,
      error:
        "Transferencia registrada, pero un saldo no se actualizó. Revísalo manualmente.",
    };
  }

  return {
    success: true,
    data: { outflowId: outflow.id, inflowId: inflow.id },
  };
}
// ─────────────────────────────────────────────────────────────────────────────
// Linking transactions as a transfer
//
// `createTransfer` above inserts both legs and moves balances. The actions
// below cover the other half of the problem: the legs already exist (captured
// separately by email/PDF/manual form) and just need to be tagged as the same
// movement, or only one leg exists and the mirror has to be synthesized.
//
// CRITICAL: `linkTransactionsAsTransfer` / `unlinkTransfer` never touch account
// balances — both transactions already applied their delta when they were
// created, and re-applying would corrupt the accounts. Only
// `createTransferCounterpart` moves a balance, and only for the leg it creates.
// ─────────────────────────────────────────────────────────────────────────────

/** How far apart the two legs may be dated. A card payment often posts on the
 *  destination a day or two after it leaves the source. */
const TRANSFER_MATCH_WINDOW_DAYS = 3;

/** Marks a leg this module synthesized (vs. one the user actually captured), so
 *  `unlinkTransfer` can undo the whole operation instead of orphaning a row
 *  whose balance delta nothing justifies any more. A sentinel in `notes` keeps
 *  this migration-free — see BACKLOG for the proper column. */
const SYNTHETIC_LEG_MARKER = "[espejo-auto]";

const LINKABLE_TX_COLUMNS =
  "id, direction, amount, currency_code, account_id, transaction_date, merchant_name, clean_description, category_id, categorization_source, notes, is_excluded, transfer_group_id, personal_debt_id, split_group_id, reconciled_into_transaction_id";

export interface TransferCandidate {
  id: string;
  label: string;
  sublabel: string;
  amount: number;
  currencyCode: string;
  direction: "INFLOW" | "OUTFLOW";
  matchScore: number;
}

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Category a transfer leg should carry when it has none of its own: an INFLOW
 *  into a card/loan is a debt payment, everything else is a plain transfer. */
function transferLegCategoryId(
  direction: string,
  accountType: string | null | undefined
): string {
  return direction === "INFLOW" && accountType && isDebtAccountType(accountType)
    ? getDebtPaymentCategoryId(accountType)
    : TRANSFER_CATEGORY_ID;
}

/** Balance after applying (or, with a negative `signedAmount`, reverting) one
 *  leg on `account`. Debt accounts invert the sign — an INFLOW pays the card
 *  down — and clamp at 0 exactly like `createTransfer` / `registerPayment`. */
function balanceAfterLeg(
  account: { account_type: string; current_balance: number },
  direction: "INFLOW" | "OUTFLOW",
  signedAmount: number
): number {
  const isDebt = isDebtAccountType(account.account_type);
  if (direction === "INFLOW") {
    return isDebt
      ? Math.max(0, account.current_balance - signedAmount)
      : account.current_balance + signedAmount;
  }
  return isDebt
    ? account.current_balance + signedAmount
    : account.current_balance - signedAmount;
}

/**
 * Counterpart transactions that could be the other leg of `transactionId`:
 * opposite direction, same amount + currency, different account in the same
 * demo scope, unlinked, not excluded, and dated within ±3 days. Never matched
 * on an exact date — the two legs of one movement routinely land on different
 * days.
 */
export async function getTransferCandidates(
  transactionId: string
): Promise<ActionResult<TransferCandidate[]>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .select(`${LINKABLE_TX_COLUMNS}, accounts!transactions_account_id_fkey(is_demo)`)
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .single();
  if (txError || !tx) return { success: false, error: "Transacción no encontrada" };

  const originIsDemo =
    (tx as unknown as { accounts?: { is_demo: boolean } | null }).accounts?.is_demo ?? false;

  const { data: rows, error } = await supabase
    .from("transactions")
    .select(`${LINKABLE_TX_COLUMNS}, accounts!transactions_account_id_fkey(name, is_demo)`)
    .eq("user_id", user.id)
    .eq("direction", tx.direction === "OUTFLOW" ? "INFLOW" : "OUTFLOW")
    .eq("amount", tx.amount)
    .eq("currency_code", tx.currency_code ?? "COP")
    .neq("account_id", tx.account_id)
    .gte("transaction_date", shiftDate(tx.transaction_date, -TRANSFER_MATCH_WINDOW_DAYS))
    .lte("transaction_date", shiftDate(tx.transaction_date, TRANSFER_MATCH_WINDOW_DAYS))
    // An excluded row is often an auto-excluded balance adjustment: neutralizing
    // a real outflow against one would delete the spend from every metric.
    .eq("is_excluded", false)
    .is("transfer_group_id", null)
    .is("personal_debt_id", null)
    .is("split_group_id", null)
    .is("reconciled_into_transaction_id", null)
    .order("transaction_date")
    .limit(20);

  if (error) return { success: false, error: "Error al buscar el otro movimiento" };

  const dayDiff = (date: string) =>
    Math.abs(
      Math.round(
        (new Date(`${date}T12:00:00`).getTime() -
          new Date(`${tx.transaction_date}T12:00:00`).getTime()) /
          86_400_000
      )
    );

  const candidates: TransferCandidate[] = (rows ?? [])
    .filter((r) => {
      const account = (r as unknown as { accounts?: { is_demo: boolean } | null }).accounts;
      // Demo and real accounts live in separate metric universes — never pair them.
      return (account?.is_demo ?? false) === originIsDemo;
    })
    .map((r) => {
      const account = (r as unknown as { accounts?: { name: string } | null }).accounts;
      const diff = dayDiff(r.transaction_date);
      return {
        id: r.id,
        label: account?.name ?? r.merchant_name ?? "Movimiento",
        sublabel: [
          formatDate(r.transaction_date, "dd MMM"),
          diff === 0 ? "mismo día" : `${diff} día${diff === 1 ? "" : "s"} de diferencia`,
          r.merchant_name ?? r.clean_description ?? null,
        ]
          .filter(Boolean)
          .join(" · "),
        amount: Number(r.amount),
        currencyCode: r.currency_code ?? "COP",
        direction: r.direction as "INFLOW" | "OUTFLOW",
        // 0–1 scale: the picker renders it as a percentage.
        matchScore: 1 - diff * 0.1,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore);

  return { success: true, data: candidates };
}

/**
 * Tags two existing transactions as the two legs of one transfer: they stop
 * counting as spending/income everywhere (`transfer_group_id IS NULL` is the
 * canonical filter) without creating or deleting anything.
 */
export async function linkTransactionsAsTransfer(
  transactionId: string,
  counterpartId: string
): Promise<ActionResult<{ transferGroupId: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };
  if (transactionId === counterpartId) {
    return { success: false, error: "Selecciona dos movimientos distintos" };
  }

  const { data: rows, error } = await supabase
    .from("transactions")
    .select(`${LINKABLE_TX_COLUMNS}, accounts!transactions_account_id_fkey(account_type, is_demo)`)
    .eq("user_id", user.id)
    .in("id", [transactionId, counterpartId]);

  if (error || !rows || rows.length !== 2) {
    return { success: false, error: "No se encontraron los dos movimientos" };
  }

  const outflow = rows.find((r) => r.direction === "OUTFLOW");
  const inflow = rows.find((r) => r.direction === "INFLOW");
  if (!outflow || !inflow) {
    return {
      success: false,
      error: "Una transferencia necesita una salida y una entrada, no dos del mismo tipo.",
    };
  }
  if (outflow.account_id === inflow.account_id) {
    return { success: false, error: "Ambos movimientos son de la misma cuenta" };
  }
  if ((outflow.currency_code ?? "COP") !== (inflow.currency_code ?? "COP")) {
    return { success: false, error: "Los movimientos están en monedas distintas" };
  }
  if (Number(outflow.amount) !== Number(inflow.amount)) {
    return { success: false, error: "Los montos no coinciden" };
  }
  const accountOf = (row: (typeof rows)[number]) =>
    (row as unknown as { accounts?: { account_type: string; is_demo: boolean } | null }).accounts;
  if ((accountOf(outflow)?.is_demo ?? false) !== (accountOf(inflow)?.is_demo ?? false)) {
    return { success: false, error: "No puedes mezclar cuentas demo con cuentas reales" };
  }
  for (const r of rows) {
    if (r.transfer_group_id) {
      return { success: false, error: "Uno de los movimientos ya es una transferencia" };
    }
    if (r.personal_debt_id) {
      return { success: false, error: "Uno de los movimientos está vinculado a una deuda personal" };
    }
    if (r.split_group_id) {
      return { success: false, error: "Uno de los movimientos pertenece a un pago compartido" };
    }
    if (r.reconciled_into_transaction_id) {
      return { success: false, error: "Uno de los movimientos fue conciliado con otro" };
    }
    if (r.is_excluded) {
      return { success: false, error: "Uno de los movimientos está excluido de las métricas" };
    }
  }

  const transferGroupId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Single statement so the pair is tagged atomically, with a compare-and-set on
  // `transfer_group_id`: two concurrent calls sharing a leg can't interleave into
  // a half-tagged pair (a lone tagged leg would silently stop counting as spend).
  const { data: tagged, error: updError } = await supabase
    .from("transactions")
    .update({ transfer_group_id: transferGroupId, updated_at: now })
    .eq("user_id", user.id)
    .in("id", [outflow.id, inflow.id])
    .is("transfer_group_id", null)
    .select("id");

  if (updError || tagged?.length !== 2) {
    const { error: rollbackError } = await supabase
      .from("transactions")
      .update({ transfer_group_id: null, updated_at: now })
      .eq("user_id", user.id)
      .eq("transfer_group_id", transferGroupId);
    if (rollbackError) {
      console.error("Transfer link rollback failed — half-tagged pair", {
        transferGroupId,
        outflowId: outflow.id,
        inflowId: inflow.id,
        rollbackError,
      });
    }
    // A write happened either way — never leave the caches serving the old state.
    revalidateFinancialViews();
    return { success: false, error: "No se pudo vincular. Intenta de nuevo." };
  }

  // Best-effort categorization, only for legs with no category of their own: a
  // user-set category is an enrichment and overwriting it would violate the
  // capture-hierarchy merge rules. A failure here doesn't undo the link.
  for (const row of [outflow, inflow]) {
    if (row.category_id) continue;
    await supabase
      .from("transactions")
      .update({
        category_id: transferLegCategoryId(row.direction, accountOf(row)?.account_type),
        categorization_source: "SYSTEM_DEFAULT",
        updated_at: now,
      })
      .eq("id", row.id)
      .eq("user_id", user.id);
  }

  revalidateFinancialViews();
  return { success: true, data: { transferGroupId } };
}

/**
 * Undo: clears the group from BOTH legs so they count as spend/income again.
 * A leg this module synthesized is deleted instead — leaving it behind would
 * turn it into a phantom movement whose balance delta nothing justifies.
 */
export async function unlinkTransfer(
  transactionId: string
): Promise<ActionResult<{ deletedLegs: number }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .select("id, transfer_group_id")
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .single();
  if (txError || !tx) return { success: false, error: "Transacción no encontrada" };
  if (!tx.transfer_group_id) {
    return { success: false, error: "Este movimiento no es una transferencia" };
  }

  const { data: legs, error: legsError } = await supabase
    .from("transactions")
    .select(`${LINKABLE_TX_COLUMNS}, accounts!transactions_account_id_fkey(id, account_type, current_balance, credit_limit, currency_code, currency_balances)`)
    .eq("user_id", user.id)
    .eq("transfer_group_id", tx.transfer_group_id);
  if (legsError || !legs) return { success: false, error: "No se pudo desvincular" };

  const synthetic = legs.filter((l) => (l.notes ?? "").includes(SYNTHETIC_LEG_MARKER));
  const now = new Date().toISOString();

  for (const leg of synthetic) {
    const { error: delError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", leg.id)
      .eq("user_id", user.id);
    if (delError) {
      revalidateFinancialViews();
      return { success: false, error: "No se pudo eliminar el movimiento espejo" };
    }
    // Revert the delta this leg applied when it was created.
    const account = (
      leg as unknown as {
        accounts?: {
          id: string;
          account_type: string;
          current_balance: number;
          credit_limit: number | null;
          currency_code: string;
          currency_balances: unknown;
        } | null;
      }
    ).accounts;
    if (!account) continue;
    const reverted = balanceAfterLeg(
      account,
      leg.direction as "INFLOW" | "OUTFLOW",
      -Number(leg.amount)
    );
    await supabase
      .from("accounts")
      .update(
        isDebtAccountType(account.account_type)
          ? {
              ...buildDebtBalanceUpdatePayload(account, reverted, account.currency_code),
              updated_at: now,
            }
          : { current_balance: reverted, updated_at: now }
      )
      .eq("id", account.id)
      .eq("user_id", user.id);
  }

  const { error } = await supabase
    .from("transactions")
    .update({ transfer_group_id: null, updated_at: now })
    .eq("user_id", user.id)
    .eq("transfer_group_id", tx.transfer_group_id);
  if (error) {
    revalidateFinancialViews();
    return { success: false, error: "No se pudo desvincular" };
  }

  // Legs whose category we set ourselves go back to null so they return to the
  // Categorizar queue instead of silently sitting in "Obligaciones".
  for (const leg of legs) {
    if (synthetic.some((s) => s.id === leg.id)) continue;
    if (leg.categorization_source !== "SYSTEM_DEFAULT") continue;
    const account = (leg as unknown as { accounts?: { account_type: string } | null }).accounts;
    if (leg.category_id !== transferLegCategoryId(leg.direction, account?.account_type)) continue;
    await supabase
      .from("transactions")
      // `categorization_source` stays as-is: the Categorizar queue keys off a
      // null `category_id`, and the column is not nullable.
      .update({ category_id: null, updated_at: now })
      .eq("id", leg.id)
      .eq("user_id", user.id);
  }

  revalidateFinancialViews();
  return { success: true, data: { deletedLegs: synthetic.length } };
}

/**
 * The lone-leg case: only one side of the movement was ever captured (e.g. the
 * bank emailed the debit but the destination account is tracked by hand). Creates
 * the missing mirror leg, ties both with a `transfer_group_id`, and moves ONLY
 * the counterpart account's balance — the original leg already moved its own.
 */
export async function createTransferCounterpart(
  transactionId: string,
  otherAccountId: string
): Promise<ActionResult<{ counterpartId: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data: tx, error: txError } = await supabase
    .from("transactions")
    .select(LINKABLE_TX_COLUMNS)
    .eq("id", transactionId)
    .eq("user_id", user.id)
    .single();
  if (txError || !tx) return { success: false, error: "Transacción no encontrada" };
  if (tx.transfer_group_id) {
    return { success: false, error: "Este movimiento ya es una transferencia" };
  }
  if (tx.personal_debt_id) {
    return { success: false, error: "Este movimiento está vinculado a una deuda personal" };
  }
  if (tx.split_group_id) {
    return { success: false, error: "Este movimiento pertenece a un pago compartido" };
  }
  if (tx.reconciled_into_transaction_id) {
    return { success: false, error: "Este movimiento fue conciliado con otro" };
  }
  if (tx.is_excluded) {
    return { success: false, error: "Este movimiento está excluido de las métricas" };
  }
  if (tx.account_id === otherAccountId) {
    return { success: false, error: "Elige una cuenta distinta a la del movimiento" };
  }

  const [{ data: other }, { data: origin }] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, name, account_type, current_balance, credit_limit, currency_code, currency_balances, is_active, is_demo")
      .eq("id", otherAccountId)
      .eq("user_id", user.id)
      .single(),
    supabase
      .from("accounts")
      .select("id, name, account_type, is_demo")
      .eq("id", tx.account_id)
      .eq("user_id", user.id)
      .single(),
  ]);
  if (!other) return { success: false, error: "Cuenta no encontrada" };
  if (!other.is_active) return { success: false, error: "Esa cuenta está archivada" };
  if ((other.is_demo ?? false) !== (origin?.is_demo ?? false)) {
    return { success: false, error: "No puedes mezclar cuentas demo con cuentas reales" };
  }
  const currency = tx.currency_code ?? "COP";
  if (other.currency_code !== currency) {
    return {
      success: false,
      error: `La cuenta está en ${other.currency_code} y el movimiento en ${currency}.`,
    };
  }

  const amount = Number(tx.amount);
  const mirrorDirection = tx.direction === "OUTFLOW" ? "INFLOW" : "OUTFLOW";
  const transferGroupId = crypto.randomUUID();
  const now = new Date().toISOString();
  const description = `Transferencia ${mirrorDirection === "INFLOW" ? "desde" : "hacia"} ${origin?.name ?? "otra cuenta"}`;

  // Deterministic on the PAIRING, not on this execution: a double submit hits
  // the unique constraint (23505) instead of inserting a second mirror and
  // applying the balance delta twice.
  const idempotencyKey = await computeIdempotencyKey({
    provider: "MANUAL",
    transactionDate: tx.transaction_date,
    amount,
    rawDescription: `TRANSFER_COUNTERPART|${tx.id}|${otherAccountId}`,
  });

  const { data: counterpart, error: insertError } = await supabase
    .from("transactions")
    .insert({
      user_id: user.id,
      account_id: otherAccountId,
      amount,
      currency_code: currency,
      direction: mirrorDirection,
      transaction_date: tx.transaction_date,
      raw_description: description,
      clean_description: description,
      merchant_name: origin?.name ?? null,
      capture_method: "MANUAL_FORM",
      provider: "MANUAL",
      category_id: transferLegCategoryId(mirrorDirection, other.account_type),
      categorization_source: "SYSTEM_DEFAULT",
      idempotency_key: idempotencyKey,
      transfer_group_id: transferGroupId,
      notes: SYNTHETIC_LEG_MARKER,
      status: "POSTED",
    })
    .select("id")
    .single();

  if (insertError || !counterpart) {
    if (insertError?.code === "23505") {
      return { success: false, error: "Ese movimiento espejo ya existe" };
    }
    return { success: false, error: "No se pudo crear el otro lado" };
  }

  // CAS again: only tag the original if it is still unlinked.
  const { data: tagged, error: tagError } = await supabase
    .from("transactions")
    .update({
      transfer_group_id: transferGroupId,
      category_id: tx.category_id ?? transferLegCategoryId(tx.direction, origin?.account_type),
      categorization_source: tx.category_id ? tx.categorization_source : "SYSTEM_DEFAULT",
      updated_at: now,
    })
    .eq("id", tx.id)
    .eq("user_id", user.id)
    .is("transfer_group_id", null)
    .select("id");

  if (tagError || !tagged?.length) {
    // Rollback: an orphan mirror leg would double-count the movement.
    const { error: rollbackError } = await supabase
      .from("transactions")
      .delete()
      .eq("id", counterpart.id)
      .eq("user_id", user.id);
    if (rollbackError) {
      console.error("Counterpart rollback failed — orphaned mirror leg", {
        transferGroupId,
        counterpartId: counterpart.id,
        rollbackError,
      });
      revalidateFinancialViews();
    }
    return { success: false, error: "No se pudo vincular. Intenta de nuevo." };
  }

  // Balance: only the NEW leg's account moves — the original already moved its own.
  const newBalance = balanceAfterLeg(other, mirrorDirection, amount);
  const isOtherDebt = isDebtAccountType(other.account_type);
  const { error: balError } = await supabase
    .from("accounts")
    .update(
      isOtherDebt
        ? { ...buildDebtBalanceUpdatePayload(other, newBalance, other.currency_code), updated_at: now }
        : { current_balance: newBalance, updated_at: now }
    )
    .eq("id", otherAccountId)
    .eq("user_id", user.id);

  if (isOtherDebt && !balError && newBalance <= 0) {
    await deactivateTemplatesForPaidOffAccount({
      supabase,
      userId: user.id,
      accountId: otherAccountId,
    });
  }

  revalidateFinancialViews();

  if (balError) {
    console.error("Balance update failed after counterpart creation", {
      transferGroupId,
      balError,
    });
    return {
      success: false,
      error: "Transferencia creada, pero el saldo de la cuenta no se actualizó. Revísalo.",
    };
  }

  return { success: true, data: { counterpartId: counterpart.id } };
}
