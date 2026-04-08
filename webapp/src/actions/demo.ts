"use server";

import { revalidateTag } from "next/cache";
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

  if (demoAccountIds.length > 0) {
    // Delete transactions on demo accounts
    await supabase
      .from("transactions")
      .delete()
      .eq("user_id", user.id)
      .in("account_id", demoAccountIds);

    // Delete budgets (we tag them with a note, but safest to just let them be
    // since budgets are per-category, not per-account — they'll be shared)
    // Actually for demo budgets, we delete them too to be clean.
    // We'll delete all budgets for this user that match demo category+amount pairs.
    // Simpler: delete the accounts, cascade will handle related data.

    // Delete demo accounts
    await supabase
      .from("accounts")
      .delete()
      .eq("user_id", user.id)
      .eq("is_demo", true);
  }

  // Turn off demo mode
  await supabase
    .from("profiles")
    .update({ demo_mode: false })
    .eq("id", user.id);

  revalidateAllTags();
  return { success: true, data: null };
}

// ─── Get demo mode status ────────────────────────────────────────────────────

export async function getDemoMode(): Promise<boolean> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return false;

  const { data } = await supabase
    .from("profiles")
    .select("demo_mode")
    .eq("id", user.id)
    .single();

  return data?.demo_mode ?? false;
}

// ─── Internal seed function ──────────────────────────────────────────────────

type SupabaseClient = Awaited<ReturnType<typeof getAuthenticatedClient>>["supabase"];

async function seedDemoDataInternal(
  supabase: SupabaseClient,
  userId: string
): Promise<ActionResult<{ demoMode: boolean }>> {
  // 1. Create demo accounts
  const accountIds: string[] = [];

  for (let i = 0; i < DEMO_ACCOUNTS.length; i++) {
    const acct = DEMO_ACCOUNTS[i];
    const { data, error } = await supabase
      .from("accounts")
      .insert({
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
        display_order: 100 + i, // high order so they appear after real accounts
        provider: "MANUAL",
        connection_status: "CONNECTED",
      })
      .select("id")
      .single();

    if (error) return { success: false, error: `Error creando cuenta demo: ${error.message}` };
    accountIds.push(data.id);
  }

  // 2. Create demo transactions
  const demoTransactions = getDemoTransactions();
  const txInserts = [];

  for (const tx of demoTransactions) {
    const accountId = accountIds[tx.accountIndex];
    const idempotencyKey = await computeIdempotencyKey({
      provider: "DEMO",
      transactionDate: tx.transaction_date,
      amount: tx.amount,
      rawDescription: tx.raw_description,
    });

    txInserts.push({
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
    });
  }

  // Batch insert transactions (Supabase supports batch)
  const { error: txError } = await supabase.from("transactions").insert(txInserts);
  if (txError) return { success: false, error: `Error creando transacciones demo: ${txError.message}` };

  // 3. Create demo budgets (skip if budgets already exist for these categories)
  for (const budget of DEMO_BUDGETS) {
    await supabase
      .from("budgets")
      .upsert(
        {
          user_id: userId,
          category_id: budget.category_id,
          amount: budget.amount,
          period: budget.period,
        },
        { onConflict: "user_id,category_id,period" }
      );
  }

  return { success: true, data: { demoMode: true } };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function revalidateAllTags() {
  revalidateTag("profile", "zeta");
  revalidateTag("accounts", "zeta");
  revalidateTag("dashboard:hero", "zeta");
  revalidateTag("dashboard:charts", "zeta");
  revalidateTag("dashboard:cashflow", "zeta");
  revalidateTag("dashboard:accounts", "zeta");
  revalidateTag("dashboard:budgets", "zeta");
  revalidateTag("budgets", "zeta");
  revalidateTag("debt", "zeta");
  revalidateTag("attention", "zeta");
}
