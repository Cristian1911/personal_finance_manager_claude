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

      // Also update currency_balances + available_balance (debt page reads from these)
      const accountUpdate: Record<string, unknown> = { current_balance: newDebtBalance };

      // Credit cards: recalculate available_balance
      if (debtAccount.account_type === "CREDIT_CARD" && debtAccount.credit_limit != null) {
        accountUpdate.available_balance = Math.max(
          Number(debtAccount.credit_limit) - newDebtBalance,
          0
        );
      }

      // Sync currency_balances JSONB if present
      const cb = debtAccount.currency_balances as Record<string, Record<string, unknown>> | null;
      if (cb && cb[currencyCode]) {
        const newAvailable = debtAccount.account_type === "CREDIT_CARD" && debtAccount.credit_limit != null
          ? Math.max(Number(debtAccount.credit_limit) - newDebtBalance, 0)
          : undefined;
        const updatedCb: Record<string, unknown> = {
          ...cb[currencyCode],
          current_balance: newDebtBalance,
          // Sync all balance-derived fields so extractDebtAccounts reads correct values
          total_payment_due: Math.max(newDebtBalance, 0),
          ...(newAvailable !== undefined ? { available_balance: newAvailable } : {}),
        };
        accountUpdate.currency_balances = { ...cb, [currencyCode]: updatedCb };
      }

      const { error: debtBalErr } = await supabase
        .from("accounts")
        .update(accountUpdate)
        .eq("id", allocation.accountId)
        .eq("user_id", user.id);
      if (debtBalErr) console.error("[extraPayment] debt balance update failed:", debtBalErr);
    }

    // Count as applied even if idempotency skip (transaction already exists)
    applied++;
    totalPaid += allocation.amount;
  }

  // ── 4. Revalidate all affected cache tags ─────────────────────────────────
  revalidateFinancialViews();

  return { success: true, data: { applied, totalPaid } };
}
