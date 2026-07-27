"use server";

import { cacheTag, cacheLife } from "next/cache";
import { revalidateFinancialViews } from "@/lib/cache/revalidation";
import {
  TRANSFER_CATEGORY_ID,
  computeIdempotencyKey,
  getDebtPaymentCategoryId,
} from "@zeta/shared";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { applyAccountBalanceDelta } from "@/lib/utils/account-balance";
import {
  buildDebtBalanceUpdatePayload,
  deactivateTemplatesForPaidOffAccount,
} from "@/lib/debt/payoff";
import type { ActionResult } from "@/types/actions";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface NonDebtAccount {
  id: string;
  name: string;
  current_balance: number;
  currency_code: string;
  account_type: string;
}

export interface ExtraPaymentInput {
  sourceAccountId: string;
  sourceAccountName: string;
  allocations: Array<{
    accountId: string;
    accountName: string;
    amount: number;
  }>;
  description?: string;
}

// ── getNonDebtAccounts ────────────────────────────────────────────────────────

async function getNonDebtAccountsCached(
  userId: string,
  accessToken: string
): Promise<NonDebtAccount[]> {
  "use cache";
  cacheTag("accounts");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);

  const { data, error } = await supabase
    .from("accounts")
    .select("id, name, current_balance, currency_code, account_type")
    .eq("user_id", userId)
    .eq("is_active", true)
    .not("account_type", "in", "(CREDIT_CARD,LOAN)")
    .order("name");

  if (error) throw error;
  return data ?? [];
}

/**
 * Returns active non-debt accounts (checking, savings, etc.) for the
 * source account dropdown in the extra debt payment sheet.
 */
export async function getNonDebtAccounts(): Promise<
  ActionResult<NonDebtAccount[]>
> {
  const { user, accessToken } = await getAuthenticatedClient();

  if (!user || !accessToken) return { success: false, error: "No autenticado" };

  try {
    return { success: true, data: await getNonDebtAccountsCached(user.id, accessToken) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Error cargando cuentas",
    };
  }
}

// ── applyExtraDebtPayment ─────────────────────────────────────────────────────

/**
 * Records a lump-sum extra debt payment as a pair of transfer transactions:
 *  - OUTFLOW on source account (TRANSFER_CATEGORY_ID)
 *  - INFLOW on each debt account (DEBT_PAYMENT_CATEGORY_ID)
 *
 * Both transactions are inserted with idempotency keys so re-submissions are
 * safe. Balance deltas are applied immediately after insertion.
 */
export async function applyExtraDebtPayment(
  input: ExtraPaymentInput
): Promise<ActionResult<{ applied: number; totalPaid: number }>> {
  const { supabase, user } = await getAuthenticatedClient();

  if (!user) return { success: false, error: "No autenticado" };

  const { sourceAccountId, sourceAccountName, allocations, description } =
    input;

  const label = description?.trim() || "Pago extra";

  // Collect all account IDs we need to touch
  const allAccountIds = [
    sourceAccountId,
    ...allocations.map((a) => a.accountId),
  ];

  // Validate all accounts belong to the user and fetch current state
  const { data: accounts, error: accountsError } = await supabase
    .from("accounts")
    .select("id, name, account_type, current_balance, currency_code, currency_balances, credit_limit")
    .eq("user_id", user.id)
    .in("id", allAccountIds);

  if (accountsError) return { success: false, error: accountsError.message };

  const accountMap = new Map(
    (accounts ?? []).map((a) => [a.id, { ...a }])
  );

  // Verify source account exists and belongs to user
  const sourceAccount = accountMap.get(sourceAccountId);
  if (!sourceAccount) {
    return {
      success: false,
      error: "Cuenta origen no encontrada o no tienes acceso.",
    };
  }

  const today = new Date().toISOString().split("T")[0];
  const currencyCode = sourceAccount.currency_code;

  let applied = 0;
  let totalPaid = 0;

  for (const allocation of allocations) {
    if (allocation.amount <= 0) continue;

    const debtAccount = accountMap.get(allocation.accountId);
    if (!debtAccount) continue;

    const debtAccountName = allocation.accountName || debtAccount.name;

    // Both legs share a transfer_group_id, exactly like createTransfer: moving
    // your own money to your own debt is not spending. Every spend metric
    // filters `.is("transfer_group_id", null)`, so without this the dashboard
    // reports the payoff as an expense of the same size.
    const transferGroupId = crypto.randomUUID();

    // ── 1. OUTFLOW on source account ────────────────────────────────────────
    const outflowDescription = `Transferencia a ${debtAccountName} - ${label}`;
    const outflowKey = await computeIdempotencyKey({
      provider: "EXTRA_PAYMENT",
      providerTransactionId: `${sourceAccountId}|${allocation.accountId}|OUTFLOW`,
      transactionDate: today,
      amount: allocation.amount,
      rawDescription: outflowDescription,
    });

    const { error: outflowError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        account_id: sourceAccountId,
        amount: allocation.amount,
        currency_code: currencyCode,
        direction: "OUTFLOW",
        transaction_date: today,
        raw_description: outflowDescription,
        clean_description: outflowDescription,
        merchant_name: `Transferencia a ${debtAccountName}`,
        category_id: TRANSFER_CATEGORY_ID,
        categorization_source: "SYSTEM_DEFAULT",
        provider: "MANUAL",
        capture_method: "MANUAL_FORM",
        status: "POSTED",
        idempotency_key: outflowKey,
        transfer_group_id: transferGroupId,
      });

    if (outflowError) {
      if (outflowError.code === "23505") {
        console.warn("[extraPayment] duplicate outflow skipped:", outflowKey);
      } else {
        return { success: false, error: outflowError.message };
      }
    }

    const outflowSkipped = outflowError?.code === "23505";

    // ── 2. INFLOW on debt account ────────────────────────────────────────────
    const inflowDescription = `Abono deuda desde ${sourceAccountName} - ${label}`;
    const inflowKey = await computeIdempotencyKey({
      provider: "EXTRA_PAYMENT",
      providerTransactionId: `${sourceAccountId}|${allocation.accountId}|INFLOW`,
      transactionDate: today,
      amount: allocation.amount,
      rawDescription: inflowDescription,
    });

    const { error: inflowError } = await supabase
      .from("transactions")
      .insert({
        user_id: user.id,
        account_id: allocation.accountId,
        amount: allocation.amount,
        currency_code: currencyCode,
        direction: "INFLOW",
        transaction_date: today,
        raw_description: inflowDescription,
        clean_description: inflowDescription,
        merchant_name: debtAccountName,
        category_id: getDebtPaymentCategoryId(debtAccount.account_type),
        categorization_source: "SYSTEM_DEFAULT",
        provider: "MANUAL",
        capture_method: "MANUAL_FORM",
        status: "POSTED",
        idempotency_key: inflowKey,
        transfer_group_id: transferGroupId,
      });

    if (inflowError) {
      if (inflowError.code === "23505") {
        console.warn("[extraPayment] duplicate inflow skipped:", inflowKey);
      } else {
        return { success: false, error: inflowError.message };
      }
    }

    const inflowSkipped = inflowError?.code === "23505";

    // ── 3. Update account balances (only when newly inserted) ────────────────
    if (!outflowSkipped) {
      const newSourceBalance = applyAccountBalanceDelta({
        currentBalance: sourceAccount.current_balance,
        accountType: sourceAccount.account_type,
        direction: "OUTFLOW",
        amount: allocation.amount,
      });
      sourceAccount.current_balance = newSourceBalance;
      const { error: srcBalErr } = await supabase
        .from("accounts")
        .update({ current_balance: newSourceBalance })
        .eq("id", sourceAccountId)
        .eq("user_id", user.id);
      if (srcBalErr) console.error("[extraPayment] source balance update failed:", srcBalErr);
    }

    if (!inflowSkipped) {
      const newDebtBalance = applyAccountBalanceDelta({
        currentBalance: debtAccount.current_balance,
        accountType: debtAccount.account_type,
        direction: "INFLOW",
        amount: allocation.amount,
      });
      debtAccount.current_balance = newDebtBalance;

      // Shared payload builder: current_balance + available_balance +
      // currency_balances JSONB (debt page reads from these).
      const { error: debtBalErr } = await supabase
        .from("accounts")
        .update(buildDebtBalanceUpdatePayload(debtAccount, newDebtBalance, currencyCode))
        .eq("id", allocation.accountId)
        .eq("user_id", user.id);
      if (debtBalErr) console.error("[extraPayment] debt balance update failed:", debtBalErr);

      // Payoff lifecycle: a debt that just reached 0 stops generating cuotas.
      if (!debtBalErr && newDebtBalance <= 0) {
        await deactivateTemplatesForPaidOffAccount({
          supabase,
          userId: user.id,
          accountId: allocation.accountId,
        });
      }
    }

    // Count as applied even if idempotency skip (transaction already exists)
    applied++;
    totalPaid += allocation.amount;
  }

  // ── 4. Revalidate all affected cache tags ─────────────────────────────────
  revalidateFinancialViews();

  return { success: true, data: { applied, totalPaid } };
}
