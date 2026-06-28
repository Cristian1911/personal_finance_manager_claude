"use server";

import { updateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import type { ActionResult } from "@/types/actions";
import type { BudgetMode } from "@/types/domain";

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

// ── Has at least one saved budget row ────────────────────
// Cheap signal for "the budget is really configured" (matches the wizard gate:
// budget_mode can be set without any saved budget). Used to hide month-scoped
// chrome during first-budget setup.
export async function getHasSavedBudget(): Promise<boolean> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return false;
  const { count } = await supabase
    .from("budgets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  return (count ?? 0) > 0;
}

// ── Set budget mode ──────────────────────────────────────

export async function setBudgetMode(
  mode: BudgetMode,
): Promise<ActionResult<null>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await supabase
    .from("profiles")
    .update({ budget_mode: mode })
    .eq("id", user.id);

  if (error) return { success: false, error: error.message };

  updateTag("budgets");
  updateTag("attention");
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

  updateTag("budgets");
  updateTag("dashboard:budgets");
  updateTag("attention");
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

  // getEstimatedIncome caches under "profile"; budget views derive from it.
  updateTag("profile");
  updateTag("budgets");
  updateTag("dashboard:budgets");
  return { success: true, data: null };
}
