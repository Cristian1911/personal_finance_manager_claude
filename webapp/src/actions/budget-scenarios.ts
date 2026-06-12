"use server";

import { cacheTag, cacheLife, updateTag } from "next/cache";
import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { createCachedClient } from "@/lib/supabase/cached";
import { getIsDemoFilter } from "@/lib/demo-filter";
import { saveScenarioSchema } from "@/lib/validators/budget-scenario";
import { uuidStr } from "@/lib/validators/shared";
import type { ActionResult } from "@/types/actions";
import type { BudgetScenarioDraft } from "@zeta/shared";

export interface BudgetScenarioRecord {
  id: string;
  name: string;
  draft: BudgetScenarioDraft;
  applied_at: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Cached reads ─────────────────────────────────────────────────────────────

async function getBudgetScenariosCached(
  userId: string,
  accessToken: string,
): Promise<BudgetScenarioRecord[]> {
  "use cache";
  cacheTag("budget-scenarios");
  cacheLife("zeta");

  const supabase = createCachedClient(accessToken);
  const { data, error } = await supabase
    .from("budget_scenarios")
    .select("id, name, draft, applied_at, created_at, updated_at")
    .eq("user_id", userId)
    .is("applied_at", null)
    .order("updated_at", { ascending: false })
    .limit(10);

  if (error) throw error;
  return (data ?? []) as unknown as BudgetScenarioRecord[];
}

export async function getBudgetScenarios(): Promise<BudgetScenarioRecord[]> {
  const { user, accessToken } = await getAuthenticatedClient();
  if (!user || !accessToken) return [];
  try {
    return await getBudgetScenariosCached(user.id, accessToken);
  } catch (error) {
    console.error("Error loading budget scenarios:", error);
    return [];
  }
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export async function saveBudgetScenario(input: {
  id: string | null;
  draft: BudgetScenarioDraft;
}): Promise<ActionResult<{ id: string }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = saveScenarioSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { id, draft } = parsed.data;

  if (id) {
    const { data, error } = await supabase
      .from("budget_scenarios")
      .update({ name: draft.name, draft, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id")
      .single();
    if (error) return { success: false, error: "No se pudo guardar la simulación" };
    updateTag("budget-scenarios");
    return { success: true, data: { id: data.id } };
  }

  const { data, error } = await supabase
    .from("budget_scenarios")
    .insert({ user_id: user.id, name: draft.name, draft })
    .select("id")
    .single();
  if (error) return { success: false, error: "No se pudo guardar la simulación" };

  updateTag("budget-scenarios");
  return { success: true, data: { id: data.id } };
}

export async function deleteBudgetScenario(id: string): Promise<ActionResult> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = uuidStr().safeParse(id);
  if (!parsed.success) return { success: false, error: "Simulación inválida" };

  const { error } = await supabase
    .from("budget_scenarios")
    .delete()
    .eq("id", parsed.data)
    .eq("user_id", user.id);

  if (error) return { success: false, error: "No se pudo eliminar la simulación" };

  updateTag("budget-scenarios");
  return { success: true, data: undefined };
}

/**
 * Apply a scenario to the real budget: upsert each line's amount as the
 * standing monthly budget. Lines cut to 0 that had a budget get deleted.
 * The scenario is then marked applied (it leaves the drafts list).
 */
export async function applyBudgetScenario(input: {
  id: string | null;
  draft: BudgetScenarioDraft;
}): Promise<ActionResult<{ updated: number }>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = saveScenarioSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }
  const { id, draft } = parsed.data;
  const isDemo = await getIsDemoFilter(user.id);

  // Defense-in-depth: every line must reference the user's own or a system category
  const lineIds = draft.lines.map((l) => l.categoryId);
  if (lineIds.length > 0) {
    const { data: owned, error: ownError } = await supabase
      .from("categories")
      .select("id")
      .in("id", lineIds)
      .or(`user_id.eq.${user.id},user_id.is.null`);
    if (ownError || (owned ?? []).length !== new Set(lineIds).size) {
      return { success: false, error: "El escenario tiene categorías inválidas" };
    }
  }

  const upserts = draft.lines
    .filter((l) => l.scenario > 0)
    .map((l) => ({
      user_id: user.id,
      category_id: l.categoryId,
      amount: l.scenario,
      period: "monthly" as const,
      is_demo: isDemo,
    }));

  const removedIds = draft.lines
    .filter((l) => l.scenario === 0 && (l.current ?? 0) > 0)
    .map((l) => l.categoryId);

  // Independent writes on disjoint category sets — run in parallel
  const [upsertResult, deleteResult] = await Promise.all([
    upserts.length > 0
      ? supabase.from("budgets").upsert(upserts, { onConflict: "user_id,category_id,period" })
      : Promise.resolve({ error: null }),
    removedIds.length > 0
      ? supabase
          .from("budgets")
          .delete()
          .eq("user_id", user.id)
          .eq("period", "monthly")
          .eq("is_demo", isDemo)
          .in("category_id", removedIds)
      : Promise.resolve({ error: null }),
  ]);
  if (upsertResult.error || deleteResult.error) {
    return { success: false, error: "No se pudo aplicar el escenario" };
  }

  // Scenario amounts are group-level truth: drop child lines ("budget builder"
  // composition rows) of every touched group so the rollup (Base + Σ children)
  // equals exactly the applied amount.
  const touchedParentIds = [
    ...new Set([...upserts.map((u) => u.category_id), ...removedIds]),
  ];
  if (touchedParentIds.length > 0) {
    const { data: childRows, error: childErr } = await supabase
      .from("categories")
      .select("id")
      .or(`user_id.eq.${user.id},user_id.is.null`)
      .in("parent_id", touchedParentIds);
    if (childErr) {
      return { success: false, error: "No se pudo aplicar el escenario" };
    }
    const childIds = (childRows ?? []).map((c) => c.id);
    if (childIds.length > 0) {
      const { error: delErr } = await supabase
        .from("budgets")
        .delete()
        .eq("user_id", user.id)
        .eq("period", "monthly")
        .eq("is_demo", isDemo)
        .in("category_id", childIds);
      if (delErr) {
        return { success: false, error: "No se pudo aplicar el escenario" };
      }
    }
  }

  if (id) {
    const { error: markError } = await supabase
      .from("budget_scenarios")
      .update({ applied_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    // Budgets already updated — log instead of failing the whole apply
    if (markError) console.error("Error marking scenario as applied:", markError);
  }

  updateTag("budgets");
  updateTag("dashboard:budgets");
  updateTag("attention");
  updateTag("budget-scenarios");
  return { success: true, data: { updated: upserts.length + removedIds.length } };
}
