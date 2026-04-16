"use server";

import { updateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { computeIdempotencyKey } from "@zeta/shared";
import { DEMO_ACCOUNTS, getDemoTransactions, DEMO_BUDGETS } from "@/lib/demo-data";
import type { ActionResult } from "@/types/actions";
import type { CurrencyCode } from "@/types/domain";

// ─── Toggle demo mode ────────────────────────────────────────────────────────

export async function toggleDemoMode(): Promise<ActionResult<{ demoMode: boolean }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Read current state
  const { data: profile, error: readError } = await supabase
    .from("profiles")
    .select("demo_mode")
    .eq("id", user.id)
    .single();

  if (readError || !profile) {
    return { success: false, error: "No se pudo leer el perfil" };
  }

  const nextMode = !profile.demo_mode;

  // If activating demo mode, check if demo data already exists
  if (nextMode) {
    const { count } = await supabase
      .from("accounts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_demo", true);

    if (!count || count === 0) {
      // Seed demo data on first activation
      const seedResult = await seedDemoDataInternal(supabase, user.id);
      if (!seedResult.success) return seedResult;
    }
  }

  // Flip the toggle
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ demo_mode: nextMode })
    .eq("id", user.id);

  if (updateError) return { success: false, error: updateError.message };

  revalidateAllTags();
  return { success: true, data: { demoMode: nextMode } };
}

// ─── Clear demo data ─────────────────────────────────────────────────────────

export async function clearDemoData(): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  // Get demo account IDs
  const { data: demoAccounts } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_demo", true);

  const demoAccountIds = (demoAccounts ?? []).map((a) => a.id);

  await Promise.all([
    // Transactions must be deleted before accounts (FK), but budgets are independent
    (async () => {
      if (demoAccountIds.length > 0) {
        await supabase.from("transactions").delete().eq("user_id", user.id).in("account_id", demoAccountIds);
        await supabase.from("accounts").delete().eq("user_id", user.id).eq("is_demo", true);
      }
    })(),
    supabase.from("budgets").delete().eq("user_id", user.id).eq("is_demo", true),
  ]);

  await supabase.from("profiles").update({ demo_mode: false }).eq("id", user.id);

  revalidateAllTags();
  return { success: true, data: null };
}

// ─── Internal seed function ──────────────────────────────────────────────────

type SupabaseClient = Awaited<ReturnType<typeof getAuthenticatedClient>>["supabase"];

async function seedDemoDataInternal(
  supabase: SupabaseClient,
  userId: string
): Promise<ActionResult<{ demoMode: boolean }>> {
  // 1. Batch insert demo accounts
  const { data: createdAccounts, error: acctError } = await supabase
    .from("accounts")
    .insert(
      DEMO_ACCOUNTS.map((acct, i) => ({
        user_id: userId,
        name: acct.name,
        account_type: acct.account_type,
        institution_name: acct.institution_name,
        currency_code: acct.currency_code,
        current_balance: acct.current_balance,
        available_balance: acct.available_balance,
        credit_limit: acct.credit_limit,
        interest_rate: acct.interest_rate,
        icon: acct.icon,
        color: acct.color,
        payment_day: acct.payment_day,
        cutoff_day: acct.cutoff_day,
        loan_amount: acct.loan_amount,
        monthly_payment: acct.monthly_payment,
        show_in_dashboard: acct.show_in_dashboard,
        is_demo: true,
        is_active: true,
        display_order: 100 + i,
        provider: "MANUAL" as const,
        connection_status: "CONNECTED" as const,
      }))
    )
    .select("id, name");

  if (acctError || !createdAccounts) {
    return { success: false, error: `Error creando cuentas demo: ${acctError?.message}` };
  }

  const nameToId = new Map(createdAccounts.map((a) => [a.name, a.id]));
  const accountIds = DEMO_ACCOUNTS.map((a) => nameToId.get(a.name)!);

  // 2. Create demo transactions
  const demoTransactions = getDemoTransactions();
  const txInserts = await Promise.all(
    demoTransactions.map(async (tx) => {
      const accountId = accountIds[tx.accountIndex];
      const idempotencyKey = await computeIdempotencyKey({
        provider: "DEMO",
        transactionDate: tx.transaction_date,
        amount: tx.amount,
        rawDescription: tx.raw_description,
      });

      return {
        user_id: userId,
        account_id: accountId,
        amount: tx.amount,
        currency_code: "COP" as CurrencyCode,
        direction: tx.direction,
        transaction_date: tx.transaction_date,
        merchant_name: tx.merchant_name,
        raw_description: tx.raw_description,
        clean_description: tx.merchant_name,
        category_id: tx.category_id,
        idempotency_key: idempotencyKey,
        provider: "MANUAL" as const,
        capture_method: "MANUAL_FORM" as const,
        categorization_source: "SYSTEM_DEFAULT" as const,
        status: "POSTED" as const,
        is_excluded: false,
      };
    })
  );

  // Batch insert transactions
  const { error: txError } = await supabase.from("transactions").insert(txInserts);
  if (txError) {
    // Cleanup: remove already-created demo accounts so next attempt re-seeds fully
    await supabase.from("accounts").delete().eq("user_id", userId).eq("is_demo", true);
    return { success: false, error: `Error creando transacciones demo: ${txError.message}` };
  }

  // 3. Create demo budgets with is_demo flag (isolated from real budgets)
  const budgetInserts = DEMO_BUDGETS.map((budget) => ({
    user_id: userId,
    category_id: budget.category_id,
    amount: budget.amount,
    period: budget.period,
    is_demo: true,
  }));

  const { error: budgetError } = await supabase.from("budgets").insert(budgetInserts);
  if (budgetError) {
    // Cleanup: remove demo accounts + transactions so next attempt re-seeds fully
    const demoIds = createdAccounts.map((a) => a.id);
    await supabase.from("transactions").delete().eq("user_id", userId).in("account_id", demoIds);
    await supabase.from("accounts").delete().eq("user_id", userId).eq("is_demo", true);
    return { success: false, error: `Error creando presupuestos demo: ${budgetError.message}` };
  }

  return { success: true, data: { demoMode: true } };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function revalidateAllTags() {
  updateTag("profile");
  updateTag("accounts");
  updateTag("transactions");
  updateTag("dashboard:hero");
  updateTag("dashboard:charts");
  updateTag("dashboard:cashflow");
  updateTag("dashboard:accounts");
  updateTag("dashboard:budgets");
  updateTag("budgets");
  updateTag("debt");
  updateTag("attention");
}
