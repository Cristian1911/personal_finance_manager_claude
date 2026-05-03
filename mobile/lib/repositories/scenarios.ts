import { supabase } from "../supabase";
import type {
  CashEntry,
  Database,
  Json,
  ScenarioAllocations,
  ScenarioResult,
  ScenarioStrategy,
} from "@zeta/shared";

type DebtScenarioInsert = Database["public"]["Tables"]["debt_scenarios"]["Insert"];

export interface SavedScenario {
  id: string;
  name: string | null;
  cash_entries: CashEntry[];
  strategy: ScenarioStrategy;
  allocations: ScenarioAllocations;
  snapshot_accounts: SnapshotAccount[];
  results: SavedScenarioResults | null;
  created_at: string;
  updated_at: string;
}

export interface SnapshotAccount {
  id: string;
  name: string;
  type: "CREDIT_CARD" | "LOAN";
  balance: number;
  currency: string;
  interestRate: number | null;
  monthlyPayment: number | null;
  creditLimit: number | null;
  paymentDay: number | null;
  cutoffDay: number | null;
  color: string | null;
  institutionName: string | null;
  currencyBreakdown: unknown;
}

export interface SavedScenarioResults {
  totalMonths: number;
  totalInterestPaid: number;
  totalAmountPaid: number;
  debtFreeDate: string;
  payoffOrder: ScenarioResult["payoffOrder"];
  timeline: ScenarioResult["timeline"];
}

export interface SaveScenarioPayload {
  id?: string;
  name: string;
  cashEntries: CashEntry[];
  strategy: ScenarioStrategy;
  allocations: ScenarioAllocations;
  snapshotAccounts: SnapshotAccount[];
  results: SavedScenarioResults;
}

const TABLE = "debt_scenarios" as const;

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

export async function getScenarios(): Promise<SavedScenario[]> {
  const userId = await getCurrentUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("user_id", userId)
    .not("name", "is", null)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("[scenarios] getScenarios failed:", error.message);
    return [];
  }
  return ((data ?? []) as unknown) as SavedScenario[];
}

export async function saveScenario(
  payload: SaveScenarioPayload
): Promise<{ ok: true; scenario: SavedScenario } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "No autenticado" };

  const row: DebtScenarioInsert = {
    user_id: userId,
    name: payload.name,
    cash_entries: payload.cashEntries as unknown as Json,
    strategy: payload.strategy,
    allocations: payload.allocations as unknown as Json,
    snapshot_accounts: payload.snapshotAccounts as unknown as Json,
    results: payload.results as unknown as Json,
  };

  if (payload.id) {
    const { data, error } = await supabase
      .from(TABLE)
      .update(row)
      .eq("id", payload.id)
      .eq("user_id", userId)
      .select()
      .single();
    if (error) return { ok: false, error: "No se pudo actualizar el plan" };
    return { ok: true, scenario: (data as unknown) as SavedScenario };
  }

  const { data, error } = await supabase
    .from(TABLE)
    .insert(row)
    .select()
    .single();
  if (error) return { ok: false, error: "No se pudo guardar el plan" };
  return { ok: true, scenario: (data as unknown) as SavedScenario };
}

export async function deleteScenario(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await getCurrentUserId();
  if (!userId) return { ok: false, error: "No autenticado" };

  const { error } = await supabase
    .from(TABLE)
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) return { ok: false, error: "No se pudo eliminar el plan" };
  return { ok: true };
}

/** 3-cap enforced server-side via UI; this just reports remaining slots. */
export const SCENARIO_SAVE_LIMIT = 3;
