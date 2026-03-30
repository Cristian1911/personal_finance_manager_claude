"use server";

import { revalidateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import type { ActionResult } from "@/types/actions";

// ── Get budget mode ──────────────────────────────────────

export async function getBudgetMode(): Promise<ActionResult<string | null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { data, error } = await supabase
    .from("profiles")
    .select("budget_mode")
    .eq("id", user.id)
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data: data.budget_mode };
}

// ── Set budget mode ──────────────────────────────────────

export async function setBudgetMode(
  mode: "per_category" | "zero_based",
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("profiles")
    .update({ budget_mode: mode })
    .eq("id", user.id);

  if (error) return { success: false, error: error.message };

  revalidateTag("budgets", "zeta");
  return { success: true, data: null };
}

// ── Upsert budget for a category ─────────────────────────

export async function upsertBudgetForCategory(
  categoryId: string,
  amount: number,
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("budgets")
    .upsert(
      {
        user_id: user.id,
        category_id: categoryId,
        amount,
        period: "monthly",
      },
      { onConflict: "user_id,category_id,period" },
    );

  if (error) return { success: false, error: error.message };

  revalidateTag("budgets", "zeta");
  revalidateTag("dashboard:budgets", "zeta");
  return { success: true, data: null };
}

// ── Bulk upsert budgets (wizard completion) ──────────────

export async function bulkUpsertBudgets(
  budgets: { category_id: string; amount: number }[],
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const rows = budgets
    .filter((b) => b.amount > 0)
    .map((b) => ({
      user_id: user.id,
      category_id: b.category_id,
      amount: b.amount,
      period: "monthly" as const,
    }));

  if (rows.length === 0) return { success: true, data: null };

  const { error } = await supabase
    .from("budgets")
    .upsert(rows, { onConflict: "user_id,category_id,period" });

  if (error) return { success: false, error: error.message };

  revalidateTag("budgets", "zeta");
  revalidateTag("dashboard:budgets", "zeta");
  return { success: true, data: null };
}

// ── Update income in profile ─────────────────────────────

export async function updateEstimatedIncome(
  amount: number,
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("profiles")
    .update({ estimated_monthly_income: amount })
    .eq("id", user.id);

  if (error) return { success: false, error: error.message };
  return { success: true, data: null };
}
