"use server";

import { getAuthenticatedClient } from "@/lib/supabase/auth";
import { saveScenarioSchema, type SaveScenarioInput } from "@/lib/validators/scenario";
import type { ActionResult } from "@/types/actions";

interface DebtScenario {
  id: string;
  name: string | null;
  cash_entries: unknown;
  strategy: string;
  allocations: unknown;
  snapshot_accounts: unknown;
  results: unknown;
  created_at: string;
  updated_at: string;
}

export async function getScenarios(): Promise<DebtScenario[]> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return [];

  const { data, error } = await (supabase as any)
    .from("debt_scenarios")
    .select("*")
    .eq("user_id", user.id)
    .not("name", "is", null)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch scenarios:", error);
    return [];
  }

  return data ?? [];
}

export async function getScenario(id: string): Promise<DebtScenario | null> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return null;

  const { data, error } = await (supabase as any)
    .from("debt_scenarios")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (error) return null;
  return data;
}

export async function saveScenario(
  input: SaveScenarioInput
): Promise<ActionResult<DebtScenario>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const parsed = saveScenarioSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const data = parsed.data;
  const row = {
    user_id: user.id,
    name: data.name ?? null,
    cash_entries: data.cashEntries,
    strategy: data.strategy,
    allocations: data.allocations,
    snapshot_accounts: data.snapshotAccounts,
    results: data.results,
  };

  if (data.id) {
    // Update existing
    const { data: updated, error } = await (supabase as any)
      .from("debt_scenarios")
      .update(row)
      .eq("id", data.id)
      .eq("user_id", user.id)
      .select()
      .single();

    if (error) {
      return { success: false, error: "No se pudo actualizar el escenario" };
    }
    return { success: true, data: updated };
  } else {
    // Create new
    const { data: created, error } = await (supabase as any)
      .from("debt_scenarios")
      .insert(row)
      .select()
      .single();

    if (error) {
      return { success: false, error: "No se pudo guardar el escenario" };
    }
    return { success: true, data: created };
  }
}

export async function deleteScenario(id: string): Promise<ActionResult<void>> {
  const { supabase, user } = await getAuthenticatedClient();
  if (!user) return { success: false, error: "No autenticado" };

  const { error } = await (supabase as any)
    .from("debt_scenarios")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return { success: false, error: "No se pudo eliminar el escenario" };
  }
  return { success: true, data: undefined };
}
